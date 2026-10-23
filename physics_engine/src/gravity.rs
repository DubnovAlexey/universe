// ============================================================================
// ФАЙЛ: physics_engine/src/gravity.rs
// НАЗНАЧЕНИЕ: Симплектический интегратор Velocity Verlet и синхронизация Курамото (v2.5)
// ЗАДАЧИ ФАЙЛА:
// 1. Интегрировать движение тел в гравитационном потенциале двух барицентров (Tier A)
//    с регуляризацией Пламмера (Plummer softening ε) и защитой от NaN.
// 2. Вычислять истинный относительный дрейф механической энергии ΔE/E₀ без
//    искусственных масштабирующих коэффициентов и сдвигов.
// 3. Рассчитывать фазовую синхронизацию осцилляторов Курамото и параметр порядка r(t) ∈ [0,1].
// ============================================================================

#![allow(dead_code)]

use crate::memory::{SceneStateSoA, MAX_CAPACITY};

const PLUMMER_SOFTENING_SQ: f32 = 64.0;
const GM_BARYCENTER: f32 = 4900.0;
const MAX_ACCEL_CLAMP: f32 = 420.0;

#[inline]
pub fn compute_barycenter_acceleration(
    px: f32,
    py: f32,
    b1x: f32,
    b1y: f32,
    b2x: f32,
    b2y: f32,
    gravity_scale: f32,
) -> (f32, f32, f32) {
    let dx1 = b1x - px;
    let dy1 = b1y - py;
    let r1_sq = dx1 * dx1 + dy1 * dy1 + PLUMMER_SOFTENING_SQ;
    let r1 = r1_sq.sqrt();
    let inv_r1_cubed = 1.0 / (r1_sq * r1);

    let dx2 = b2x - px;
    let dy2 = b2y - py;
    let r2_sq = dx2 * dx2 + dy2 * dy2 + PLUMMER_SOFTENING_SQ;
    let r2 = r2_sq.sqrt();
    let inv_r2_cubed = 1.0 / (r2_sq * r2);

    let gm = GM_BARYCENTER * gravity_scale;
    let ax = (dx1 * inv_r1_cubed + dx2 * inv_r2_cubed) * gm;
    let ay = (dy1 * inv_r1_cubed + dy2 * inv_r2_cubed) * gm;
    let potential = -gm / r1 - gm / r2;

    (
        ax.clamp(-MAX_ACCEL_CLAMP, MAX_ACCEL_CLAMP),
        ay.clamp(-MAX_ACCEL_CLAMP, MAX_ACCEL_CLAMP),
        potential,
    )
}

pub fn compute_scene_total_energy(scene: &SceneStateSoA, gravity_scale: f32, sim_t: f32) -> f32 {
    let count = (scene.header.count as usize).min(MAX_CAPACITY);
    if count == 0 {
        return 0.0;
    }

    let orbit_angle = sim_t * 0.42;
    let b1x = orbit_angle.cos() * 140.0;
    let b1y = orbit_angle.sin() * 90.0;
    let b2x = -b1x * 1.05;
    let b2y = -b1y * 1.05;

    let mut total_energy = 0.0_f32;
    for i in 0..count {
        let i3 = i * 3;
        let px = SceneStateSoA::sanitize_finite(scene.pos[i3], 0.0);
        let py = SceneStateSoA::sanitize_finite(scene.pos[i3 + 1], 0.0);
        let vx = SceneStateSoA::sanitize_finite(scene.vel[i3], 0.0);
        let vy = SceneStateSoA::sanitize_finite(scene.vel[i3 + 1], 0.0);

        let (_ax, _ay, pot) =
            compute_barycenter_acceleration(px, py, b1x, b1y, b2x, b2y, gravity_scale);
        let kinetic = 0.5 * (vx * vx + vy * vy);
        total_energy += kinetic + pot;
    }
    total_energy
}

pub fn step_symplectic_verlet_and_kuramoto(
    scene: &mut SceneStateSoA,
    raw_dt: f32,
    gravity_scale: f32,
    kuramoto_coupling: f32,
) {
    let count = (scene.header.count as usize).min(MAX_CAPACITY);
    if count == 0 {
        return;
    }

    if scene.baseline_energy == 0.0 {
        let init_e = compute_scene_total_energy(scene, gravity_scale, 0.0);
        if init_e.abs() > 0.001 {
            scene.baseline_energy = init_e;
        }
    }

    if !raw_dt.is_finite() || raw_dt <= 0.0 {
        scene.energy_drift_ratio = 0.0;
        return;
    }

    let dt = raw_dt.clamp(0.0005, 0.05);
    scene.header.tick = scene.header.tick.wrapping_add(1);
    let sim_t = (scene.header.tick as f32) * dt;

    let orbit_angle = sim_t * 0.42;
    let b1x = orbit_angle.cos() * 140.0;
    let b1y = orbit_angle.sin() * 90.0;
    let b2x = -b1x * 1.05;
    let b2y = -b1y * 1.05;

    let mut sum_cos = 0.0_f32;
    let mut sum_sin = 0.0_f32;
    for i in 0..count {
        let theta = scene.kuramoto_phase[i];
        sum_cos += theta.cos();
        sum_sin += theta.sin();
    }
    let inv_n = 1.0 / (count as f32);
    let mean_cos = sum_cos * inv_n;
    let mean_sin = sum_sin * inv_n;
    let mean_angle = mean_sin.atan2(mean_cos);
    scene.kuramoto_order_r = (mean_cos * mean_cos + mean_sin * mean_sin).sqrt().min(1.0);

    let mut total_energy = 0.0_f32;
    let half_dt_sq = 0.5 * dt * dt;
    let half_dt = 0.5 * dt;

    for i in 0..count {
        let theta = scene.kuramoto_phase[i];
        let d_theta = scene.natural_omega[i] + kuramoto_coupling * (mean_angle - theta).sin();
        scene.kuramoto_phase[i] = (theta + d_theta * dt).rem_euclid(std::f32::consts::TAU);

        let i3 = i * 3;
        let px = SceneStateSoA::sanitize_finite(scene.pos[i3], 0.0);
        let py = SceneStateSoA::sanitize_finite(scene.pos[i3 + 1], 0.0);
        let vx = SceneStateSoA::sanitize_finite(scene.vel[i3], 0.0);
        let vy = SceneStateSoA::sanitize_finite(scene.vel[i3 + 1], 0.0);

        let (ax0, ay0, _pot0) =
            compute_barycenter_acceleration(px, py, b1x, b1y, b2x, b2y, gravity_scale);

        let next_px = px + vx * dt + ax0 * half_dt_sq;
        let next_py = py + vy * dt + ay0 * half_dt_sq;

        let (ax1, ay1, pot1) = compute_barycenter_acceleration(
            next_px,
            next_py,
            b1x,
            b1y,
            b2x,
            b2y,
            gravity_scale,
        );

        let next_vx = vx + (ax0 + ax1) * half_dt;
        let next_vy = vy + (ay0 + ay1) * half_dt;

        scene.pos[i3] = SceneStateSoA::sanitize_finite(next_px, 0.0);
        scene.pos[i3 + 1] = SceneStateSoA::sanitize_finite(next_py, 0.0);
        scene.vel[i3] = SceneStateSoA::sanitize_finite(next_vx, 0.0);
        scene.vel[i3 + 1] = SceneStateSoA::sanitize_finite(next_vy, 0.0);

        let kinetic = 0.5 * (next_vx * next_vx + next_vy * next_vy);
        total_energy += kinetic + pot1;
    }

    if scene.baseline_energy.abs() > 0.001 {
        scene.energy_drift_ratio =
            ((total_energy - scene.baseline_energy) / scene.baseline_energy).abs();
    } else {
        scene.energy_drift_ratio = 0.0;
    }
}