// ============================================================================
// ФАЙЛ: physics_engine/src/breach_math.rs
// НАЗНАЧЕНИЕ: Математическая модель преломления BREACH LENS (MASTER 04 v2.5)
// ОГЛАВЛЕНИЕ:
// 1. compute_refraction_offset_with_stress: C¹-кольцо и волновая кромка линзы.
// 2. compute_refraction_offset: обёртка с фиксированными напряжением и временем.
// ============================================================================

#![allow(dead_code)]

// --- НАЧАЛО РАЗДЕЛА 1: ПОЛЕ ЛИНЗЫ С НАПРЯЖЕНИЕМ ---
// --- НАЧАЛО ФУНКЦИИ compute_refraction_offset_with_stress ---
pub fn compute_refraction_offset_with_stress(
    px: f32,
    py: f32,
    lens_x: f32,
    lens_y: f32,
    lens_radius: f32,
    reveal_intensity: f32,
    global_stress: f32,
    sim_time_sec: f32,
) -> (f32, f32, f32) {
    if lens_radius < 8.0 {
        return (0.0, 0.0, 0.0);
    }

    let dx = px - lens_x;
    let dy = py - lens_y;
    let dist = (dx * dx + dy * dy).sqrt() + 0.0001;
    let angle = dy.atan2(dx);

    let warp = 1.0
        + ((angle * 3.0 + sim_time_sec * 1.7).sin() * 0.042
            + (angle * 5.0 - sim_time_sec * 1.1).cos() * 0.024)
            * (0.5 + global_stress * 0.5);

    let local_r = (lens_radius * warp).max(8.0);
    let d = dist / local_r;

    let ring_half_width = 0.24_f32;
    let u = ((d - 1.0) / ring_half_width).abs();

    // Строго g(d) = 0 за границей кольца преломления (u >= 1.0)
    if u >= 1.0 {
        return (0.0, 0.0, 0.0);
    }

    // C¹-гладкий колокол: g(u) = (1 - u²)²
    let one_minus_u2 = 1.0 - u * u;
    let g = one_minus_u2 * one_minus_u2;

    let radial_unit_x = dx / dist;
    let radial_unit_y = dy / dist;
    let tangent_unit_x = -radial_unit_y;
    let tangent_unit_y = radial_unit_x;

    let radial_amp = (6.5 + reveal_intensity * 8.5) * g;
    let tangent_amp = (angle * 4.0 + sim_time_sec * 2.0).sin() * 3.4 * g;

    let offset_x = radial_unit_x * radial_amp + tangent_unit_x * tangent_amp;
    let offset_y = radial_unit_y * radial_amp + tangent_unit_y * tangent_amp;

    (offset_x, offset_y, g)
}
// --- КОНЕЦ ФУНКЦИИ compute_refraction_offset_with_stress ---
// --- КОНЕЦ РАЗДЕЛА 1: ПОЛЕ ЛИНЗЫ С НАПРЯЖЕНИЕМ ---

// --- НАЧАЛО РАЗДЕЛА 2: ОБЁРТКА С ПАРАМЕТРАМИ ПО УМОЛЧАНИЮ ---
// --- НАЧАЛО ФУНКЦИИ compute_refraction_offset ---
pub fn compute_refraction_offset(
    px: f32,
    py: f32,
    lens_x: f32,
    lens_y: f32,
    lens_radius: f32,
    reveal_intensity: f32,
) -> (f32, f32, f32) {
    compute_refraction_offset_with_stress(
        px,
        py,
        lens_x,
        lens_y,
        lens_radius,
        reveal_intensity,
        0.25,
        0.0,
    )
}
// --- КОНЕЦ ФУНКЦИИ compute_refraction_offset ---
// --- КОНЕЦ РАЗДЕЛА 2: ОБЁРТКА С ПАРАМЕТРАМИ ПО УМОЛЧАНИЮ ---
