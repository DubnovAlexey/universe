// ============================================================================
// ФАЙЛ: physics_engine/src/memory.rs
// НАЗНАЧЕНИЕ: Память фаз сцены и отдельного контрольного ансамбля из 64 орбит.
// ОГЛАВЛЕНИЕ:
// 1. Константы, заголовок и массивы f32 физического provider.
// 2. new: TS-совместимая инициализация фаз, частот и орбит.
// 3. sanitize_finite, has_finite_uploaded_state, commit_uploaded_state: валидация.
// 4. refresh_metrics, recompute_state_digest: метрики и контрольный дайджест.
// ============================================================================

// --- НАЧАЛО РАЗДЕЛА 1: КОНТРАКТ ПАМЯТИ ---
use crate::gravity::{compute_reference_total_energy, GM_CONSERVATIVE, PLUMMER_SOFTENING_SQ};
use crate::prng::{compute_quantized_state_digest, DeterministicPrng};

pub const SCENE_BUFFER_MAGIC: u32 = 0x5356_4e55;
pub const SCENE_SCHEMA_VERSION: u16 = 2;
pub const MAX_CAPACITY: usize = 1024;
pub const REFERENCE_ENSEMBLE_COUNT: usize = 64;

#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct SceneBufferHeader {
    pub magic: u32,
    pub schema_version: u16,
    pub flags: u16,
    pub tick: u32,
    pub count: u32,
    pub seed: u32,
    pub digest: u32,
}

pub struct SceneStateSoA {
    pub header: SceneBufferHeader,
    // Fixed lengths survive every step and commit. init_bodies replaces them;
    // hosts must refresh pointers after init and memory.buffer changes.
    pub pos: Vec<f32>,
    pub vel: Vec<f32>,
    pub kuramoto_phase: Vec<f32>,
    pub natural_omega: Vec<f32>,
    pub baseline_energy: f64,
    pub integrated_sim_sec: f64,
    pub energy_drift_ratio: f64,
    pub kuramoto_order_r: f64,
}

// --- КОНЕЦ РАЗДЕЛА 1: КОНТРАКТ ПАМЯТИ ---

impl SceneStateSoA {
    // --- НАЧАЛО РАЗДЕЛА 2: ИНИЦИАЛИЗАЦИЯ ---
    // --- НАЧАЛО ФУНКЦИИ new ---
    pub fn new(seed: u32, active_count: usize) -> Self {
        let mut rng = DeterministicPrng::new(seed);
        let mut phase = vec![0.0_f32; MAX_CAPACITY];
        let mut omega = vec![0.0_f32; MAX_CAPACITY];

        // Match TS: all 1024 phase/omega pairs precede every reference orbit.
        for i in 0..MAX_CAPACITY {
            phase[i] = rng.next_range_f64(0.0, std::f64::consts::TAU) as f32;
            let sign = if i % 2 == 0 { 1.0 } else { -1.0 };
            omega[i] = (rng.next_range_f64(0.85, 1.45) * sign) as f32;
        }

        let mut pos = vec![0.0_f32; MAX_CAPACITY * 3];
        let mut vel = vec![0.0_f32; MAX_CAPACITY * 3];
        for i in 0..REFERENCE_ENSEMBLE_COUNT {
            let angle = (i as f64 / REFERENCE_ENSEMBLE_COUNT as f64) * std::f64::consts::TAU
                + rng.next_range_f64(-0.05, 0.05);
            let radius = 65.0 + (i % 8) as f64 * 28.0;
            let circular_speed = ((GM_CONSERVATIVE * radius * radius)
                / (radius * radius + PLUMMER_SOFTENING_SQ).powf(1.5))
            .sqrt();
            let i3 = i * 3;
            pos[i3] = (angle.cos() * radius) as f32;
            pos[i3 + 1] = (angle.sin() * radius) as f32;
            vel[i3] = (-angle.sin() * circular_speed) as f32;
            vel[i3 + 1] = (angle.cos() * circular_speed) as f32;
        }

        let mut scene = Self {
            header: SceneBufferHeader {
                magic: SCENE_BUFFER_MAGIC,
                schema_version: SCENE_SCHEMA_VERSION,
                flags: 1,
                tick: 0,
                count: active_count.min(MAX_CAPACITY) as u32,
                seed,
                digest: 0,
            },
            pos,
            vel,
            kuramoto_phase: phase,
            natural_omega: omega,
            baseline_energy: 0.0,
            integrated_sim_sec: 0.0,
            energy_drift_ratio: 0.0,
            kuramoto_order_r: 0.0,
        };
        scene.baseline_energy = compute_reference_total_energy(&scene.pos, &scene.vel, 1.0);
        scene.refresh_metrics(1.0);
        scene
    }
    // --- КОНЕЦ ФУНКЦИИ new ---
    // --- КОНЕЦ РАЗДЕЛА 2: ИНИЦИАЛИЗАЦИЯ ---

    // --- НАЧАЛО РАЗДЕЛА 3: ВАЛИДАЦИЯ И ИМПОРТ ---

    #[inline]
    // --- НАЧАЛО ФУНКЦИИ sanitize_finite ---
    pub fn sanitize_finite(val: f32, fallback: f32) -> f32 {
        if val.is_finite() {
            val
        } else {
            fallback
        }
    }
    // --- КОНЕЦ ФУНКЦИИ sanitize_finite ---

    // --- НАЧАЛО ФУНКЦИИ has_finite_uploaded_state ---
    pub fn has_finite_uploaded_state(&self) -> bool {
        self.pos[..REFERENCE_ENSEMBLE_COUNT * 3]
            .iter()
            .chain(&self.vel[..REFERENCE_ENSEMBLE_COUNT * 3])
            .chain(&self.kuramoto_phase)
            .chain(&self.natural_omega)
            .all(|value| value.is_finite())
    }
    // --- КОНЕЦ ФУНКЦИИ has_finite_uploaded_state ---

    /// Hosts upload arrays first, then commit metadata. Failed validation leaves
    /// metadata intact; the host must restore arrays or discard the provider.
    // --- НАЧАЛО ФУНКЦИИ commit_uploaded_state ---
    pub fn commit_uploaded_state(&mut self, baseline_energy: f64, integrated_sec: f64) -> bool {
        if !baseline_energy.is_finite()
            || !integrated_sec.is_finite()
            || integrated_sec < 0.0
            || !self.has_finite_uploaded_state()
        {
            return false;
        }
        let energy = compute_reference_total_energy(&self.pos, &self.vel, 1.0);
        let effective_baseline = if baseline_energy == 0.0 && energy != 0.0 {
            energy
        } else {
            baseline_energy
        };
        let drift = if effective_baseline != 0.0 {
            ((energy - effective_baseline) / effective_baseline).abs()
        } else {
            0.0
        };
        if !energy.is_finite() || !drift.is_finite() {
            return false;
        }
        self.baseline_energy = effective_baseline;
        self.integrated_sim_sec = integrated_sec;
        self.refresh_metrics(1.0);
        self.recompute_state_digest();
        true
    }
    // --- КОНЕЦ ФУНКЦИИ commit_uploaded_state ---
    // --- КОНЕЦ РАЗДЕЛА 3: ВАЛИДАЦИЯ И ИМПОРТ ---

    // --- НАЧАЛО РАЗДЕЛА 4: МЕТРИКИ ---

    // --- НАЧАЛО ФУНКЦИИ refresh_metrics ---
    pub fn refresh_metrics(&mut self, gravity_scale: f64) {
        let count = (self.header.count as usize).min(MAX_CAPACITY);
        let mut sum_cos = 0.0_f64;
        let mut sum_sin = 0.0_f64;
        for theta in &self.kuramoto_phase[..count] {
            sum_cos += (*theta as f64).cos();
            sum_sin += (*theta as f64).sin();
        }
        let divisor = count.max(1) as f64;
        self.kuramoto_order_r = (sum_cos / divisor).hypot(sum_sin / divisor).min(1.0);

        let energy = compute_reference_total_energy(&self.pos, &self.vel, gravity_scale);
        if self.baseline_energy == 0.0 && energy != 0.0 {
            self.baseline_energy = energy;
        }
        let drift = if self.baseline_energy != 0.0 {
            ((energy - self.baseline_energy) / self.baseline_energy).abs()
        } else {
            0.0
        };
        self.energy_drift_ratio = if drift.is_finite() { drift } else { 0.0 };
    }
    // --- КОНЕЦ ФУНКЦИИ refresh_metrics ---

    // --- НАЧАЛО ФУНКЦИИ recompute_state_digest ---
    pub fn recompute_state_digest(&mut self) -> u32 {
        // This legacy digest covers reference orbits. The browser separately
        // computes the digest of its visible scene after choreography.
        let digest = compute_quantized_state_digest(
            self.header.tick,
            REFERENCE_ENSEMBLE_COUNT,
            &self.pos,
            &self.vel,
            &[0.0; REFERENCE_ENSEMBLE_COUNT],
            4,
        );
        self.header.digest = digest;
        digest
    }
    // --- КОНЕЦ ФУНКЦИИ recompute_state_digest ---
    // --- КОНЕЦ РАЗДЕЛА 4: МЕТРИКИ ---
}
