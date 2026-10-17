// ============================================================================
// ФАЙЛ: physics_engine/src/breach_math.rs
// НАЗНАЧЕНИЕ: Математическая модель преломления BREACH LENS и микротрещин (MASTER 04)
// ЗАДАЧИ ФАЙЛА:
// 1. Вычислять C¹-непрерывное радиальное и тангенциальное смещение δ(p) = r̂·A·g(d) + t̂·B·g(d)
//    с колоколообразной функцией кольца g(u) = (1 - u²)² вокруг d = 1.
// 2. Гарантировать строгое равенство g(d) = 0 за пределами границы линзы (u >= 1).
// ============================================================================

#![allow(dead_code)]

// ----------------------------------------------------------------------------
// 1. РАСЧЁТ ВЕКТОРА ПРЕЛОМЛЕНИЯ δ(p) НА КРОМКЕ ОПТИЧЕСКОЙ ЛИНЗЫ BREACH LENS
// Возвращает кортеж (dx, dy, rim_highlight) в полном паритете со stressState.ts.
// ----------------------------------------------------------------------------
pub fn compute_refraction_offset(
    px: f32,
    py: f32,
    lens_x: f32,
    lens_y: f32,
    lens_radius: f32,
    reveal_intensity: f32,
) -> (f32, f32, f32) {
    if lens_radius < 8.0 {
        return (0.0, 0.0, 0.0);
    }

    let dx = px - lens_x;
    let dy = py - lens_y;
    let dist = (dx * dx + dy * dy).sqrt() + 0.0001;
    let d = dist / lens_radius;

    let ring_half_width = 0.24_f32;
    let u = ((d - 1.0) / ring_half_width).abs();

    // Строго g(d) = 0 за границей кольца преломления (u >= 1.0) по MASTER 04
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

    let angle = dy.atan2(dx);
    let radial_amp = (6.5 + reveal_intensity * 8.5) * g;
    let tangent_amp = (angle * 4.0).sin() * 3.4 * g;

    let offset_x = radial_unit_x * radial_amp + tangent_unit_x * tangent_amp;
    let offset_y = radial_unit_y * radial_amp + tangent_unit_y * tangent_amp;

    (offset_x, offset_y, g)
}