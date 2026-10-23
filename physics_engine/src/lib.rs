// ============================================================================
// ФАЙЛ: physics_engine/src/lib.rs
// НАЗНАЧЕНИЕ: Корневой модуль Rust/WebAssembly ядра UNIVERSE v2.5 (MASTER 00B)
// ЗАДАЧИ ФАЙЛА:
// 1. Объявлять все 4 подмодуля крейта (prng, memory, gravity, breach_math).
// 2. Экспортировать C-ABI интерфейс (#[no_mangle] pub extern "C") для вызова
//    из frontend/src/bridge/wasmBridge.ts.
// 3. Содержать модульные тесты (#[cfg(test)] mod tests) для проверки через `cargo test`.
// ============================================================================

#![allow(dead_code)]

pub mod breach_math;
pub mod gravity;
pub mod memory;
pub mod prng;

use std::sync::Mutex;

use crate::breach_math::compute_refraction_offset;
use crate::gravity::step_symplectic_verlet_and_kuramoto;
use crate::memory::{SceneStateSoA, MAX_CAPACITY};

static GLOBAL_SCENE: Mutex<Option<SceneStateSoA>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn init_bodies(seed: u32, count: u32) -> u32 {
    let clamped_count = (count as usize).min(MAX_CAPACITY);
    let mut scene = SceneStateSoA::new(seed, clamped_count);
    let digest = scene.recompute_state_digest();

    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        *guard = Some(scene);
    }
    digest
}

#[no_mangle]
pub extern "C" fn step_verlet_nbody(dt: f32, gravity_scale: f32, kuramoto_coupling: f32) -> u32 {
    if let Ok(mut guard) = GLOBAL_SCENE.lock() {
        if let Some(ref mut scene) = *guard {
            step_symplectic_verlet_and_kuramoto(scene, dt, gravity_scale, kuramoto_coupling);
            return scene.recompute_state_digest();
        }
    }
    0
}

#[no_mangle]
pub extern "C" fn get_positions_ptr() -> *const f32 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.pos.as_ptr();
        }
    }
    std::ptr::null()
}

#[no_mangle]
pub extern "C" fn get_velocities_ptr() -> *const f32 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.vel.as_ptr();
        }
    }
    std::ptr::null()
}

#[no_mangle]
pub extern "C" fn get_energy_drift() -> f32 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.energy_drift_ratio;
        }
    }
    0.0
}

#[no_mangle]
pub extern "C" fn get_kuramoto_r() -> f32 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.kuramoto_order_r;
        }
    }
    0.0
}

#[no_mangle]
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

// ============================================================================
// МОДУЛЬНЫЕ ТЕСТЫ ФИЗИЧЕСКОГО ЯДРА RUST (`cargo test`)
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::breach_math::compute_refraction_offset_with_stress;
    use crate::memory::{SCENE_BUFFER_MAGIC, SCENE_SCHEMA_VERSION};
    use crate::prng::{verify_golden_vectors, GOLDEN_SEED};

    #[test]
    fn test_golden_prng_vectors_parity() {
        assert!(verify_golden_vectors());
    }

    #[test]
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

    #[test]
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

    #[test]
    fn test_breach_lens_refraction_c1_boundary() {
        let (dx_out, dy_out, g_out) =
            compute_refraction_offset_with_stress(500.0, 500.0, 100.0, 80.0, 140.0, 0.85, 0.35, 1.0);
        assert_eq!(dx_out, 0.0);
        assert_eq!(dy_out, 0.0);
        assert_eq!(g_out, 0.0);

        let (dx_rim, _dy_rim, g_rim) =
            compute_refraction_offset_with_stress(232.0, 80.0, 100.0, 80.0, 140.0, 0.85, 0.35, 1.0);
        assert!(g_rim > 0.0);
        assert!(dx_rim.abs() > 0.0);
    }

    #[test]
    fn test_c_abi_exports_and_nan_guard() {
        let digest = init_bodies(GOLDEN_SEED, 32);
        assert_ne!(digest, 0);

        let pos_ptr = get_positions_ptr();
        let vel_ptr = get_velocities_ptr();
        assert!(!pos_ptr.is_null());
        assert!(!vel_ptr.is_null());
        assert_eq!((pos_ptr as usize) % 4, 0);
        assert_eq!((vel_ptr as usize) % 4, 0);

        assert_eq!(SceneStateSoA::sanitize_finite(f32::NAN, 0.0), 0.0);
        assert_eq!(SceneStateSoA::sanitize_finite(f32::INFINITY, 0.0), 0.0);
    }
}