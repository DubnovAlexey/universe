// ============================================================================
// ФАЙЛ: physics_engine/src/gravity.rs
// НАЗНАЧЕНИЕ: TS-совместимые Kuramoto и Velocity Verlet с арифметикой f64.
// ОГЛАВЛЕНИЕ:
// 1. Константы консервативного потенциала Пламмера и границы подшагов.
// 2. compute_reference_total_energy: энергия отдельного ансамбля из 64 орбит.
// 3. step_symplectic_verlet_and_kuramoto: атомарный шаг фаз и контрольных орбит.
// ============================================================================

// --- НАЧАЛО РАЗДЕЛА 1: КОНСТАНТЫ ---
use crate::memory::{SceneStateSoA, MAX_CAPACITY, REFERENCE_ENSEMBLE_COUNT};

pub const GM_CONSERVATIVE: f64 = 4900.0;
pub const PLUMMER_SOFTENING_SQ: f64 = 64.0;
pub const MAX_STABLE_SUBSTEP_SEC: f64 = 0.004;
pub const MAX_STEP_SEC: f64 = 0.05;

// --- КОНЕЦ РАЗДЕЛА 1: КОНСТАНТЫ ---

// --- НАЧАЛО РАЗДЕЛА 2: КОНТРОЛЬНАЯ ЭНЕРГИЯ ---
// --- НАЧАЛО ФУНКЦИИ compute_reference_total_energy ---
pub fn compute_reference_total_energy(pos: &[f32], vel: &[f32], gravity_scale: f64) -> f64 {
    let mut total = 0.0_f64;
    for i in 0..REFERENCE_ENSEMBLE_COUNT {
        let i3 = i * 3;
        let px = pos[i3] as f64;
        let py = pos[i3 + 1] as f64;
        let vx = vel[i3] as f64;
        let vy = vel[i3 + 1] as f64;
        let radius = (px * px + py * py + PLUMMER_SOFTENING_SQ).sqrt();
        total += 0.5 * (vx * vx + vy * vy) - GM_CONSERVATIVE * gravity_scale / radius;
    }
    total
}
// --- КОНЕЦ ФУНКЦИИ compute_reference_total_energy ---
// --- КОНЕЦ РАЗДЕЛА 2: КОНТРОЛЬНАЯ ЭНЕРГИЯ ---

// --- НАЧАЛО РАЗДЕЛА 3: ШАГ ИНТЕГРАТОРА ---

/// Publish one complete step, never a partially updated substep. Scratch arrays
/// stay on the stack, so stepping does not allocate or relocate exported arrays.
/// Invalid inputs/results return false. Zero/negative dt and count=0 are no-ops.
// --- НАЧАЛО ФУНКЦИИ step_symplectic_verlet_and_kuramoto ---
pub fn step_symplectic_verlet_and_kuramoto(
    scene: &mut SceneStateSoA,
    raw_dt: f64,
    gravity_scale: f64,
    kuramoto_coupling: f64,
) -> bool {
    if !raw_dt.is_finite()
        || !gravity_scale.is_finite()
        || !kuramoto_coupling.is_finite()
        || !scene.has_finite_uploaded_state()
    {
        return false;
    }
    let count = (scene.header.count as usize).min(MAX_CAPACITY);
    if raw_dt <= 0.0 || count == 0 {
        return true;
    }

    let dt = raw_dt.min(MAX_STEP_SEC);
    let substeps = (dt / MAX_STABLE_SUBSTEP_SEC).ceil().max(1.0) as usize;
    let sub_dt = dt / substeps as f64;
    let half_dt = 0.5 * sub_dt;
    let half_dt_sq = 0.5 * sub_dt * sub_dt;
    let gm = GM_CONSERVATIVE * gravity_scale;
    if !gm.is_finite() {
        return false;
    }

    let mut phase = [0.0_f32; MAX_CAPACITY];
    phase.copy_from_slice(&scene.kuramoto_phase);
    let mut pos = [0.0_f32; REFERENCE_ENSEMBLE_COUNT * 3];
    let mut vel = [0.0_f32; REFERENCE_ENSEMBLE_COUNT * 3];
    pos.copy_from_slice(&scene.pos[..REFERENCE_ENSEMBLE_COUNT * 3]);
    vel.copy_from_slice(&scene.vel[..REFERENCE_ENSEMBLE_COUNT * 3]);
    let mut integrated_sec = scene.integrated_sim_sec;

    for _ in 0..substeps {
        let mut sum_cos = 0.0_f64;
        let mut sum_sin = 0.0_f64;
        for theta in &phase[..count] {
            sum_cos += (*theta as f64).cos();
            sum_sin += (*theta as f64).sin();
        }
        let mean_angle = (sum_sin / count as f64).atan2(sum_cos / count as f64);
        for (i, theta_f32) in phase[..count].iter_mut().enumerate() {
            let theta = *theta_f32 as f64;
            let derivative =
                scene.natural_omega[i] as f64 + kuramoto_coupling * (mean_angle - theta).sin();
            // JS uses remainder followed by one addition for negative phases.
            let next = (theta + derivative * sub_dt) % std::f64::consts::TAU;
            *theta_f32 = if next < 0.0 {
                next + std::f64::consts::TAU
            } else {
                next
            } as f32;
        }

        for i in 0..REFERENCE_ENSEMBLE_COUNT {
            let i3 = i * 3;
            let px = pos[i3] as f64;
            let py = pos[i3 + 1] as f64;
            let vx = vel[i3] as f64;
            let vy = vel[i3 + 1] as f64;
            let r0_sq = px * px + py * py + PLUMMER_SOFTENING_SQ;
            let inv_r0_cubed = 1.0 / (r0_sq * r0_sq.sqrt());
            let ax0 = -gm * px * inv_r0_cubed;
            let ay0 = -gm * py * inv_r0_cubed;
            let next_px = px + vx * sub_dt + ax0 * half_dt_sq;
            let next_py = py + vy * sub_dt + ay0 * half_dt_sq;
            let r1_sq = next_px * next_px + next_py * next_py + PLUMMER_SOFTENING_SQ;
            let inv_r1_cubed = 1.0 / (r1_sq * r1_sq.sqrt());
            let ax1 = -gm * next_px * inv_r1_cubed;
            let ay1 = -gm * next_py * inv_r1_cubed;

            // Match Float32Array assignment after each TS substep, retaining
            // double-precision positions for the new acceleration calculation.
            pos[i3] = next_px as f32;
            pos[i3 + 1] = next_py as f32;
            vel[i3] = (vx + (ax0 + ax1) * half_dt) as f32;
            vel[i3 + 1] = (vy + (ay0 + ay1) * half_dt) as f32;
        }
        integrated_sec += sub_dt;
    }

    if !integrated_sec.is_finite()
        || !phase
            .iter()
            .chain(&pos)
            .chain(&vel)
            .all(|value| value.is_finite())
        || !compute_reference_total_energy(&pos, &vel, gravity_scale).is_finite()
    {
        return false;
    }
    scene.kuramoto_phase.copy_from_slice(&phase);
    scene.pos[..REFERENCE_ENSEMBLE_COUNT * 3].copy_from_slice(&pos);
    scene.vel[..REFERENCE_ENSEMBLE_COUNT * 3].copy_from_slice(&vel);
    scene.integrated_sim_sec = integrated_sec;
    scene.header.tick = scene.header.tick.wrapping_add(1);
    scene.refresh_metrics(gravity_scale);
    true
}
// --- КОНЕЦ ФУНКЦИИ step_symplectic_verlet_and_kuramoto ---
// --- КОНЕЦ РАЗДЕЛА 3: ШАГ ИНТЕГРАТОРА ---
