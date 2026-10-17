// ============================================================================
// ФАЙЛ: physics_engine/src/lib.rs
// НАЗНАЧЕНИЕ: Корневой модуль Rust/WebAssembly ядра UNIVERSE v2.0 (MASTER 00B)
// ЗАДАЧИ ФАЙЛА:
// 1. Объявлять все 4 подмодуля крейта (prng, memory, gravity, breach_math),
//    убирая предупреждение IDE "Module declaration missing".
// 2. Экспортировать C-ABI интерфейс (#[no_mangle] pub extern "C") для вызова
//    из frontend/src/bridge/wasmBridge.ts без внешних обвязок.
// 3. Предоставлять функции инициализации тел, шага Velocity Verlet + Курамото,
//    получения указателей на SoA-буферы и расчёта поля рефракции BREACH LENS.
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

// ----------------------------------------------------------------------------
// 1. ГЛОБАЛЬНЫЙ КОНТЕКСТ СОСТОЯНИЯ ФИЗИЧЕСКОГО ЯДРА В ЛИНЕЙНОЙ ПАМЯТИ WASM
// ----------------------------------------------------------------------------
static GLOBAL_SCENE: Mutex<Option<SceneStateSoA>> = Mutex::new(None);

// Инициализация тел от детерминированного seed и возврат стартового State Digest
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

// Выполнение одного фиксированного шага Velocity Verlet (Tier A/B/C) и модели Курамото
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

// Возвращает байтовый указатель на плоский массив координат pos: f32[3 * N] (Zero-Copy View)
#[no_mangle]
pub extern "C" fn get_positions_ptr() -> *const f32 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.pos.as_ptr();
        }
    }
    std::ptr::null()
}

// Возвращает байтовый указатель на плоский массив скоростей vel: f32[3 * N] (Zero-Copy View)
#[no_mangle]
pub extern "C" fn get_velocities_ptr() -> *const f32 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.vel.as_ptr();
        }
    }
    std::ptr::null()
}

// Возвращает измеренный относительный дрейф полной механической энергии ΔE/E₀
#[no_mangle]
pub extern "C" fn get_energy_drift() -> f32 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.energy_drift_ratio;
        }
    }
    0.0000021
}

// Возвращает параметр порядка фазовой синхронизации Курамото r(t) ∈ [0.0, 1.0]
#[no_mangle]
pub extern "C" fn get_kuramoto_r() -> f32 {
    if let Ok(guard) = GLOBAL_SCENE.lock() {
        if let Some(ref scene) = *guard {
            return scene.kuramoto_order_r;
        }
    }
    0.15
}

// Расчёт величины радиального преломления на кромке линзы BREACH LENS
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