// ============================================================================
// ФАЙЛ: physics_engine/src/lib.rs
// НАЗНАЧЕНИЕ: Raw C ABI v1 для физических фаз и контрольного ансамбля UNIVERSE.
// ОГЛАВЛЕНИЕ:
// 1. Модули, импорты и глобальное состояние provider.
// 2. ABI: версия, инициализация, шаг, импорт, указатели и метрики.
// 3. Независимый C ABI оптического преломления BREACH.
// 4. Тесты инициализации, миграции, времени, границ и энергии.
// ============================================================================

#![allow(dead_code)]

// --- НАЧАЛО РАЗДЕЛА 1: МОДУЛИ И СОСТОЯНИЕ ---
pub mod breach_math;
pub mod gravity;
pub mod memory;
pub mod ouroboros;
pub mod prng;

use std::sync::Mutex;

use crate::breach_math::compute_refraction_offset;
use crate::gravity::step_symplectic_verlet_and_kuramoto;
use crate::memory::{SceneStateSoA, MAX_CAPACITY};

static GLOBAL_SCENE: Mutex<Option<SceneStateSoA>> = Mutex::new(None);
// --- КОНЕЦ РАЗДЕЛА 1: МОДУЛИ И СОСТОЯНИЕ ---

// --- НАЧАЛО РАЗДЕЛА 2: ABI ФИЗИЧЕСКОГО PROVIDER ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_abi_version ---
pub extern "C" fn get_abi_version() -> u32 {
    1
}
// --- КОНЕЦ ФУНКЦИИ get_abi_version ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ init_bodies ---
pub extern "C" fn init_bodies(seed: u32, count: u32) -> u32 {
    let clamped_count = (count as usize).min(MAX_CAPACITY);
    let mut scene = SceneStateSoA::new(seed, clamped_count);
    let digest = scene.recompute_state_digest();

    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        *guard = Some(scene);
        return digest;
    }
    0
}
// --- КОНЕЦ ФУНКЦИИ init_bodies ---

/// ABI v1 step status: 1 means a complete accepted step (including a valid
/// no-op), 0 means rejection or an uninitialized provider. Digests are not status.
#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ step_verlet_nbody ---
pub extern "C" fn step_verlet_nbody(dt: f64, gravity_scale: f64, kuramoto_coupling: f64) -> u32 {
    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        if let Some(ref mut scene) = *guard {
            if step_symplectic_verlet_and_kuramoto(scene, dt, gravity_scale, kuramoto_coupling) {
                scene.recompute_state_digest();
                return 1;
            }
        }
    }
    0
}
// --- КОНЕЦ ФУНКЦИИ step_verlet_nbody ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_active_count ---
pub extern "C" fn get_active_count() -> u32 {
    GLOBAL_SCENE
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|s| s.header.count))
        .unwrap_or(0)
}
// --- КОНЕЦ ФУНКЦИИ get_active_count ---

/// Upload pos/vel (1024 * 3 f32), phases/omegas (1024 f32) through their
/// pointers, then call this function. A rejected upload returns 0; success 1.
#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ commit_uploaded_state ---
pub extern "C" fn commit_uploaded_state(baseline_energy: f64, integrated_sec: f64) -> u32 {
    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        if let Some(ref mut scene) = *guard {
            return u32::from(scene.commit_uploaded_state(baseline_energy, integrated_sec));
        }
    }
    0
}
// --- КОНЕЦ ФУНКЦИИ commit_uploaded_state ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_integrated_time ---
pub extern "C" fn get_integrated_time() -> f64 {
    GLOBAL_SCENE
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|s| s.integrated_sim_sec))
        .unwrap_or(0.0)
}
// --- КОНЕЦ ФУНКЦИИ get_integrated_time ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_positions_ptr ---
pub extern "C" fn get_positions_ptr() -> *mut f32 {
    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        if let Some(ref mut scene) = *guard {
            return scene.pos.as_mut_ptr();
        }
    }
    std::ptr::null_mut()
}
// --- КОНЕЦ ФУНКЦИИ get_positions_ptr ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_velocities_ptr ---
pub extern "C" fn get_velocities_ptr() -> *mut f32 {
    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        if let Some(ref mut scene) = *guard {
            return scene.vel.as_mut_ptr();
        }
    }
    std::ptr::null_mut()
}
// --- КОНЕЦ ФУНКЦИИ get_velocities_ptr ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_phases_ptr ---
pub extern "C" fn get_phases_ptr() -> *mut f32 {
    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        if let Some(ref mut scene) = *guard {
            return scene.kuramoto_phase.as_mut_ptr();
        }
    }
    std::ptr::null_mut()
}
// --- КОНЕЦ ФУНКЦИИ get_phases_ptr ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_omegas_ptr ---
pub extern "C" fn get_omegas_ptr() -> *mut f32 {
    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        if let Some(ref mut scene) = *guard {
            return scene.natural_omega.as_mut_ptr();
        }
    }
    std::ptr::null_mut()
}
// --- КОНЕЦ ФУНКЦИИ get_omegas_ptr ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_energy_drift ---
pub extern "C" fn get_energy_drift() -> f64 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.energy_drift_ratio;
        }
    }
    0.0
}
// --- КОНЕЦ ФУНКЦИИ get_energy_drift ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_kuramoto_r ---
pub extern "C" fn get_kuramoto_r() -> f64 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.kuramoto_order_r;
        }
    }
    0.0
}
// --- КОНЕЦ ФУНКЦИИ get_kuramoto_r ---

// --- КОНЕЦ РАЗДЕЛА 2: ABI ФИЗИЧЕСКОГО PROVIDER ---

// --- НАЧАЛО РАЗДЕЛА 3: BREACH ABI ---
/// Scalar reference magnitude, not a rendered offset vector: global stress is
/// fixed at 0.25 and simulation time at 0. The Canvas renderer uses TS optics.
#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ evaluate_lens_refraction ---
pub extern "C" fn evaluate_lens_refraction(
    px: f32,
    py: f32,
    lens_x: f32,
    lens_y: f32,
    lens_radius: f32,
    reveal_intensity: f32,
) -> f32 {
    let (dx, dy, _rim) =
        compute_refraction_offset(px, py, lens_x, lens_y, lens_radius, reveal_intensity);
    (dx * dx + dy * dy).sqrt()
}
// --- КОНЕЦ ФУНКЦИИ evaluate_lens_refraction ---
// --- КОНЕЦ РАЗДЕЛА 3: BREACH ABI ---

// ============================================================================
// МОДУЛЬНЫЕ ТЕСТЫ ФИЗИЧЕСКОГО ЯДРА RUST (`cargo test`)
// ============================================================================
// --- НАЧАЛО РАЗДЕЛА 4: ТЕСТЫ ---
#[cfg(test)]
mod tests {
    use super::*;
    use crate::breach_math::compute_refraction_offset_with_stress;
    use crate::memory::{SCENE_BUFFER_MAGIC, SCENE_SCHEMA_VERSION};
    use crate::prng::{verify_golden_vectors, GOLDEN_SEED};

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_golden_prng_vectors_parity ---
    fn test_golden_prng_vectors_parity() {
        assert!(verify_golden_vectors());
        // Independent Python reference outputs cover ordinary keys, seed zero,
        // and multiplication/wrapping at both uint32 boundaries.
        for (seed, index, expected) in [
            (GOLDEN_SEED, 42, 1_767_988_650),
            (GOLDEN_SEED, 0, 3_329_588_566),
            (0, 42, 2_800_543_238),
            (u32::MAX, u32::MAX, 920_564_995),
        ] {
            assert_eq!(
                crate::prng::DeterministicPrng::hash_u32(seed, index),
                expected
            );
        }
    }
    // --- КОНЕЦ ФУНКЦИИ test_golden_prng_vectors_parity ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_scene_state_header_and_digest_determinism ---
    fn test_scene_state_header_and_digest_determinism() {
        let mut s1 = SceneStateSoA::new(GOLDEN_SEED, 64);
        let mut s2 = SceneStateSoA::new(GOLDEN_SEED, 64);
        let d1 = s1.recompute_state_digest();
        let d2 = s2.recompute_state_digest();

        assert_eq!(s1.header.magic, SCENE_BUFFER_MAGIC);
        assert_eq!(s1.header.schema_version, SCENE_SCHEMA_VERSION);
        assert_eq!(d1, d2);
        assert_ne!(d1, 0);
    }
    // --- КОНЕЦ ФУНКЦИИ test_scene_state_header_and_digest_determinism ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_symplectic_verlet_true_energy_drift_and_kuramoto ---
    fn test_symplectic_verlet_true_energy_drift_and_kuramoto() {
        let mut scene = SceneStateSoA::new(GOLDEN_SEED, 64);
        assert_eq!(scene.energy_drift_ratio, 0.0);

        step_symplectic_verlet_and_kuramoto(&mut scene, 0.0, 1.0, 1.2);
        assert_eq!(scene.energy_drift_ratio, 0.0);

        step_symplectic_verlet_and_kuramoto(&mut scene, 0.016, 1.0, 1.2);
        assert!(scene.energy_drift_ratio.is_finite());
        assert!(scene.energy_drift_ratio > 0.0);
        assert!(scene.kuramoto_order_r > 0.0 && scene.kuramoto_order_r <= 1.0);
    }
    // --- КОНЕЦ ФУНКЦИИ test_symplectic_verlet_true_energy_drift_and_kuramoto ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_breach_lens_refraction_c1_boundary ---
    fn test_breach_lens_refraction_c1_boundary() {
        let (dx_out, dy_out, g_out) = compute_refraction_offset_with_stress(
            500.0, 500.0, 100.0, 80.0, 140.0, 0.85, 0.35, 1.0,
        );
        assert_eq!(dx_out, 0.0);
        assert_eq!(dy_out, 0.0);
        assert_eq!(g_out, 0.0);

        let (dx_rim, _dy_rim, g_rim) =
            compute_refraction_offset_with_stress(232.0, 80.0, 100.0, 80.0, 140.0, 0.85, 0.35, 1.0);
        assert!(g_rim > 0.0);
        assert!(dx_rim.abs() > 0.0);
    }
    // --- КОНЕЦ ФУНКЦИИ test_breach_lens_refraction_c1_boundary ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_c_abi_exports_and_nan_guard ---
    fn test_c_abi_exports_and_nan_guard() {
        assert_eq!(get_abi_version(), 1);
        let digest = init_bodies(GOLDEN_SEED, 32);
        assert_ne!(digest, 0);
        assert_eq!(get_active_count(), 32);
        assert_eq!(get_integrated_time(), 0.0);

        let pos_ptr = get_positions_ptr();
        let vel_ptr = get_velocities_ptr();
        assert!(!pos_ptr.is_null());
        assert!(!vel_ptr.is_null());
        assert_eq!((pos_ptr as usize) % 4, 0);
        assert_eq!((vel_ptr as usize) % 4, 0);
        assert!(!get_phases_ptr().is_null());
        assert!(!get_omegas_ptr().is_null());
        assert_eq!(commit_uploaded_state(f64::NAN, 0.0), 0);
        assert_eq!(commit_uploaded_state(0.0, 0.125), 1);
        assert_eq!(get_integrated_time(), 0.125);
        assert_eq!(step_verlet_nbody(0.016, 1.0, 1.2), 1);
        assert!((get_integrated_time() - 0.141).abs() < 1e-12);
        assert!(get_energy_drift().is_finite());
        assert!((0.0..=1.0).contains(&get_kuramoto_r()));
        let previous_time = get_integrated_time();
        let previous_drift = get_energy_drift();
        assert_eq!(step_verlet_nbody(0.0, 1.0, 1.2), 1);
        assert_eq!(step_verlet_nbody(f64::NAN, 1.0, 1.2), 0);
        assert_eq!(get_integrated_time(), previous_time);
        assert_eq!(get_energy_drift(), previous_drift);

        // A fresh init invalidates old pointers and starts the requested seed,
        // count and clock again. No other test uses the global ABI state.
        init_bodies(GOLDEN_SEED + 1, u32::MAX);
        assert_eq!(get_active_count(), MAX_CAPACITY as u32);
        assert_eq!(get_integrated_time(), 0.0);
        assert_eq!(get_energy_drift(), 0.0);
    }
    // --- КОНЕЦ ФУНКЦИИ test_c_abi_exports_and_nan_guard ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_initialization_matches_typescript_float32_fixture ---
    fn test_initialization_matches_typescript_float32_fixture() {
        // Generated independently with the JS Mulberry32/range implementation,
        // Float32Array assignments and the existing TS initialization order.
        let scene = SceneStateSoA::new(GOLDEN_SEED, 820);
        assert_eq!(
            scene.kuramoto_phase[..4]
                .iter()
                .map(|v| v.to_bits())
                .collect::<Vec<_>>(),
            [1_056_153_244, 1_067_784_575, 1_050_148_484, 1_079_184_979]
        );
        assert_eq!(
            scene.natural_omega[..4]
                .iter()
                .map(|v| v.to_bits())
                .collect::<Vec<_>>(),
            [1_068_174_224, 3_214_661_640, 1_067_112_895, 3_216_595_903]
        );
        assert_eq!(scene.kuramoto_phase[1023], 2.828134775161743_f32);
        assert_eq!(scene.natural_omega[1023], -1.000696063041687_f32);
        let expected_pos = [
            64.99212646484375,
            1.0115394592285156,
            0.0,
            92.84213256835938,
            5.416545391082764,
            0.0,
        ];
        let expected_vel = [
            -0.13360226154327393,
            8.584040641784668,
            0.0,
            -0.42043089866638184,
            7.206383228302002,
            0.0,
        ];
        for i in 0..6 {
            assert!((scene.pos[i] as f64 - expected_pos[i]).abs() < 1e-5);
            assert!((scene.vel[i] as f64 - expected_vel[i]).abs() < 1e-6);
        }
        assert_eq!(scene.pos.len(), MAX_CAPACITY * 3);
        assert_eq!(scene.vel.len(), MAX_CAPACITY * 3);
        assert_eq!(scene.kuramoto_phase.len(), MAX_CAPACITY);
        assert_eq!(scene.natural_omega.len(), MAX_CAPACITY);
        assert!(scene.pos[64 * 3..].iter().all(|v| *v == 0.0));
        assert!(scene.baseline_energy < 0.0);
        assert_eq!(scene.integrated_sim_sec, 0.0);
    }
    // --- КОНЕЦ ФУНКЦИИ test_initialization_matches_typescript_float32_fixture ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_substep_partition_preserves_orbits_phases_and_time ---
    fn test_substep_partition_preserves_orbits_phases_and_time() {
        let mut whole = SceneStateSoA::new(GOLDEN_SEED, 820);
        let mut halves = SceneStateSoA::new(GOLDEN_SEED, 820);
        let mut quarters = SceneStateSoA::new(GOLDEN_SEED, 820);
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut whole, 0.016, 1.0, 1.2
        ));
        for _ in 0..2 {
            assert!(step_symplectic_verlet_and_kuramoto(
                &mut halves,
                0.008,
                1.0,
                1.2
            ));
        }
        for _ in 0..4 {
            assert!(step_symplectic_verlet_and_kuramoto(
                &mut quarters,
                0.004,
                1.0,
                1.2
            ));
        }
        assert_eq!(whole.pos, halves.pos);
        assert_eq!(whole.vel, halves.vel);
        assert_eq!(whole.kuramoto_phase, halves.kuramoto_phase);
        assert_eq!(whole.pos, quarters.pos);
        assert_eq!(whole.vel, quarters.vel);
        assert_eq!(whole.kuramoto_phase, quarters.kuramoto_phase);
        for scene in [&whole, &halves, &quarters] {
            assert!((scene.integrated_sim_sec - 0.016).abs() < 1e-12);
        }
    }
    // --- КОНЕЦ ФУНКЦИИ test_substep_partition_preserves_orbits_phases_and_time ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_variable_steps_accumulate_time_without_minimum_dt ---
    fn test_variable_steps_accumulate_time_without_minimum_dt() {
        let mut scene = SceneStateSoA::new(GOLDEN_SEED, 64);
        for dt in [0.016, 0.007, 0.033, 0.0001, 1.0] {
            assert!(step_symplectic_verlet_and_kuramoto(
                &mut scene, dt, 1.0, 1.2
            ));
        }
        assert!((scene.integrated_sim_sec - 0.1061).abs() < 1e-12);
        assert_eq!(scene.header.tick, 5);
        assert!(scene.energy_drift_ratio.is_finite());
    }
    // --- КОНЕЦ ФУНКЦИИ test_variable_steps_accumulate_time_without_minimum_dt ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_invalid_steps_and_zero_dt_preserve_last_complete_state ---
    fn test_invalid_steps_and_zero_dt_preserve_last_complete_state() {
        let mut scene = SceneStateSoA::new(GOLDEN_SEED, 64);
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut scene, 0.016, 1.0, 1.2
        ));
        let before_pos = scene.pos.clone();
        let before_vel = scene.vel.clone();
        let before_phase = scene.kuramoto_phase.clone();
        let before_time = scene.integrated_sim_sec;
        let before_drift = scene.energy_drift_ratio;
        let before_tick = scene.header.tick;
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut scene, 0.0, 1.0, 1.2
        ));
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut scene, -0.01, 1.0, 1.2
        ));
        for (dt, gravity, coupling) in [
            (f64::NAN, 1.0, 1.2),
            (f64::INFINITY, 1.0, 1.2),
            (0.016, f64::NAN, 1.2),
            (0.016, 1.0, f64::INFINITY),
            (0.016, f64::MAX, 1.2),
        ] {
            assert!(!step_symplectic_verlet_and_kuramoto(
                &mut scene, dt, gravity, coupling
            ));
        }
        assert_eq!(scene.pos, before_pos);
        assert_eq!(scene.vel, before_vel);
        assert_eq!(scene.kuramoto_phase, before_phase);
        assert_eq!(scene.integrated_sim_sec, before_time);
        assert_eq!(scene.energy_drift_ratio, before_drift);
        assert_eq!(scene.header.tick, before_tick);
    }
    // --- КОНЕЦ ФУНКЦИИ test_invalid_steps_and_zero_dt_preserve_last_complete_state ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_active_count_bounds_phases_and_reference_ensemble_is_independent ---
    fn test_active_count_bounds_phases_and_reference_ensemble_is_independent() {
        let mut small = SceneStateSoA::new(GOLDEN_SEED, 1);
        let mut full = SceneStateSoA::new(GOLDEN_SEED, usize::MAX);
        let mut empty = SceneStateSoA::new(GOLDEN_SEED, 0);
        let inactive_phases = small.kuramoto_phase[1..].to_vec();
        assert_eq!(full.header.count as usize, MAX_CAPACITY);
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut small, 0.016, 1.0, 1.2
        ));
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut full, 0.016, 1.0, 1.2
        ));
        assert_eq!(small.kuramoto_phase[1..], inactive_phases);
        assert_eq!(small.pos, full.pos);
        assert_eq!(small.vel, full.vel);
        assert_eq!(small.energy_drift_ratio, full.energy_drift_ratio);
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut empty, 0.016, 1.0, 1.2
        ));
        assert_eq!(empty.integrated_sim_sec, 0.0);
        assert_eq!(empty.kuramoto_order_r, 0.0);
        assert!(full.has_finite_uploaded_state());
        assert!((0.0..=1.0).contains(&full.kuramoto_order_r));
    }
    // --- КОНЕЦ ФУНКЦИИ test_active_count_bounds_phases_and_reference_ensemble_is_independent ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_uploaded_state_resumes_same_trajectory_and_preserves_baseline ---
    fn test_uploaded_state_resumes_same_trajectory_and_preserves_baseline() {
        let mut source = SceneStateSoA::new(GOLDEN_SEED, 420);
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut source,
            0.019,
            1.0,
            1.2
        ));
        let mut resumed = SceneStateSoA::new(7, 420);
        resumed.pos.copy_from_slice(&source.pos);
        resumed.vel.copy_from_slice(&source.vel);
        resumed
            .kuramoto_phase
            .copy_from_slice(&source.kuramoto_phase);
        resumed.natural_omega.copy_from_slice(&source.natural_omega);
        assert!(resumed.commit_uploaded_state(source.baseline_energy, source.integrated_sim_sec));
        assert_eq!(resumed.energy_drift_ratio, source.energy_drift_ratio);
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut source,
            0.016,
            1.0,
            0.8
        ));
        assert!(step_symplectic_verlet_and_kuramoto(
            &mut resumed,
            0.016,
            1.0,
            0.8
        ));
        assert_eq!(resumed.pos, source.pos);
        assert_eq!(resumed.vel, source.vel);
        assert_eq!(resumed.kuramoto_phase, source.kuramoto_phase);
        assert_eq!(resumed.integrated_sim_sec, source.integrated_sim_sec);
        assert_eq!(resumed.baseline_energy, source.baseline_energy);
        assert_eq!(resumed.energy_drift_ratio, source.energy_drift_ratio);
    }
    // --- КОНЕЦ ФУНКЦИИ test_uploaded_state_resumes_same_trajectory_and_preserves_baseline ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_commit_rejects_nonfinite_arrays_or_metadata ---
    fn test_commit_rejects_nonfinite_arrays_or_metadata() {
        let mut scene = SceneStateSoA::new(GOLDEN_SEED, 64);
        let baseline = scene.baseline_energy;
        for (energy, time) in [(f64::NAN, 1.0), (baseline, f64::INFINITY), (baseline, -1.0)] {
            assert!(!scene.commit_uploaded_state(energy, time));
            assert_eq!(scene.baseline_energy, baseline);
            assert_eq!(scene.integrated_sim_sec, 0.0);
        }
        for field in 0..4 {
            let mut corrupted = SceneStateSoA::new(GOLDEN_SEED, 64);
            match field {
                0 => corrupted.pos[0] = f32::NAN,
                1 => corrupted.vel[1] = f32::INFINITY,
                2 => corrupted.kuramoto_phase[1023] = f32::NAN,
                _ => corrupted.natural_omega[1023] = f32::NEG_INFINITY,
            }
            assert!(!corrupted.commit_uploaded_state(baseline, 1.0));
            assert_eq!(corrupted.integrated_sim_sec, 0.0);
        }
    }
    // --- КОНЕЦ ФУНКЦИИ test_commit_rejects_nonfinite_arrays_or_metadata ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ test_reference_energy_stays_finite_and_bounded_over_sixty_seconds ---
    fn test_reference_energy_stays_finite_and_bounded_over_sixty_seconds() {
        let mut scene = SceneStateSoA::new(GOLDEN_SEED, 64);
        for _ in 0..1200 {
            assert!(step_symplectic_verlet_and_kuramoto(
                &mut scene, 0.05, 1.0, 1.2
            ));
        }
        assert!((scene.integrated_sim_sec - 60.0).abs() < 1e-8);
        assert!(scene.energy_drift_ratio < 0.001);
        assert!(scene.has_finite_uploaded_state());
    }
    // --- КОНЕЦ ФУНКЦИИ test_reference_energy_stays_finite_and_bounded_over_sixty_seconds ---
}
// --- КОНЕЦ РАЗДЕЛА 4: ТЕСТЫ ---
