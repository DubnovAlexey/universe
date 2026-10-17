// ============================================================================
// ФАЙЛ: physics_engine/src/memory.rs
// НАЗНАЧЕНИЕ: Выровненный буфер состояния SceneStateSoA ('UNVS' Little-Endian)
// ЗАДАЧИ ФАЙЛА:
// 1. Хранить 24-байтный заголовок SceneBufferHeader ('UNVS', schemaVersion=2, tick, digest).
// 2. Размещать в линейной памяти выровненные массивы сущностей (SoA):
//    id, kind, pos, vel, depth_z, energy, kuramoto_phase, natural_omega.
// 3. Выполнять защиту от NaN / Infinity (sanitize_finite) при записи координат.
// ============================================================================

#![allow(dead_code)]

use crate::prng::{compute_quantized_state_digest, DeterministicPrng};

pub const SCENE_BUFFER_MAGIC: u32 = 0x5356_4e55; // 'UNVS' в little-endian
pub const SCENE_SCHEMA_VERSION: u16 = 2;
pub const MAX_CAPACITY: usize = 1024;

// ----------------------------------------------------------------------------
// 1. БИНАРНЫЙ ЗАГОЛОВОК БУФЕРА СЦЕНЫ (24 БАЙТА, ВЫРАВНИВАНИЕ 4 БАЙТА)
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// 2. КОНТЕЙНЕР STRUCTURE OF ARRAYS (SOA) ДЛЯ ФИЗИЧЕСКОГО ЯДРА
// ----------------------------------------------------------------------------
pub struct SceneStateSoA {
    pub header: SceneBufferHeader,
    pub id: Vec<u32>,
    pub kind: Vec<u8>,
    pub pos: Vec<f32>,
    pub vel: Vec<f32>,
    pub depth_z: Vec<f32>,
    pub energy: Vec<f32>,
    pub kuramoto_phase: Vec<f32>,
    pub natural_omega: Vec<f32>,
    pub baseline_energy: f32,
    pub energy_drift_ratio: f32,
    pub kuramoto_order_r: f32,
}

impl SceneStateSoA {
    pub fn new(seed: u32, active_count: usize) -> Self {
        let count = active_count.min(MAX_CAPACITY);
        let mut rng = DeterministicPrng::new(seed);

        let mut id = Vec::with_capacity(MAX_CAPACITY);
        let mut kind = Vec::with_capacity(MAX_CAPACITY);
        let mut pos = vec![0.0_f32; MAX_CAPACITY * 3];
        let mut vel = vec![0.0_f32; MAX_CAPACITY * 3];
        let mut depth_z = Vec::with_capacity(MAX_CAPACITY);
        let mut energy = Vec::with_capacity(MAX_CAPACITY);
        let mut kuramoto_phase = Vec::with_capacity(MAX_CAPACITY);
        let mut natural_omega = Vec::with_capacity(MAX_CAPACITY);

        for i in 0..MAX_CAPACITY {
            id.push(i as u32);
            kind.push(if i % 9 == 0 { 2 } else { 0 });

            let angle = rng.next_range(0.0, std::f32::consts::TAU);
            let radius = rng.next_range(24.0, 420.0);
            let circular_speed = (9800.0_f32 / (radius + 40.0)).sqrt() * 0.15;

            let i3 = i * 3;
            pos[i3] = angle.cos() * radius;
            pos[i3 + 1] = angle.sin() * radius * 0.78;
            pos[i3 + 2] = rng.next_range(0.1, 1.6);

            vel[i3] = -angle.sin() * circular_speed;
            vel[i3 + 1] = angle.cos() * circular_speed;
            vel[i3 + 2] = 0.0;

            depth_z.push(pos[i3 + 2]);
            energy.push(rng.next_range(0.25, 0.85));
            kuramoto_phase.push(rng.next_range(0.0, std::f32::consts::TAU));

            let sign = if i % 2 == 0 { 1.0 } else { -1.0 };
            natural_omega.push(rng.next_range(0.85, 1.45) * sign);
        }

        let header = SceneBufferHeader {
            magic: SCENE_BUFFER_MAGIC,
            schema_version: SCENE_SCHEMA_VERSION,
            flags: 1,
            tick: 0,
            count: count as u32,
            seed,
            digest: 0,
        };

        Self {
            header,
            id,
            kind,
            pos,
            vel,
            depth_z,
            energy,
            kuramoto_phase,
            natural_omega,
            baseline_energy: 0.0,
            energy_drift_ratio: 0.000_002_1,
            kuramoto_order_r: 0.15,
        }
    }

    #[inline]
    pub fn sanitize_finite(val: f32, fallback: f32) -> f32 {
        if val.is_finite() {
            val
        } else {
            fallback
        }
    }

    pub fn recompute_state_digest(&mut self) -> u32 {
        let count = (self.header.count as usize).min(MAX_CAPACITY);
        let digest = compute_quantized_state_digest(
            self.header.tick,
            count,
            &self.pos,
            &self.vel,
            &self.energy,
            4,
        );
        self.header.digest = digest;
        digest
    }
}