// ============================================================================
// ФАЙЛ: physics_engine/src/ouroboros.rs
// НАЗНАЧЕНИЕ: Геометрия Уробороса, внутреннее течение пыли и optional raw ABI v1.
// РАЗДЕЛЫ: 1. Формат; 2. Заполнение точек; 3. Статическая память и ABI; 4. Тесты.
// ФУНКЦИИ: smooth, smoother, smoother_derivative, hash_float, fill_ouroboros_points, get_ouroboros_abi_version,
// get_ouroboros_capacity, get_ouroboros_points_ptr, sample_ouroboros.
// ============================================================================
use crate::prng::DeterministicPrng;
use std::sync::Mutex;

// --- НАЧАЛО РАЗДЕЛА 1. ФОРМАТ ---
pub const OUROBOROS_CAPACITY: usize = 3072;
pub const OUROBOROS_STRIDE: usize = 8;
const FLOAT_COUNT: usize = OUROBOROS_CAPACITY * OUROBOROS_STRIDE;
const TAU: f64 = std::f64::consts::TAU;
// --- КОНЕЦ РАЗДЕЛА 1. ФОРМАТ ---

// --- НАЧАЛО РАЗДЕЛА 2. ЗАПОЛНЕНИЕ ТОЧЕК ---
// --- НАЧАЛО ФУНКЦИИ smooth ---
fn smooth(value: f64) -> f64 {
    let t = value.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}
// --- КОНЕЦ ФУНКЦИИ smooth ---

// --- НАЧАЛО ФУНКЦИИ smoother ---
/// C²-профиль соединяет морду, череп и туловище без ступеней кривизны.
fn smoother(value: f64) -> f64 {
    let t = value.clamp(0.0, 1.0);
    t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
}
// --- КОНЕЦ ФУНКЦИИ smoother ---

// --- НАЧАЛО ФУНКЦИИ smoother_derivative ---
fn smoother_derivative(value: f64) -> f64 {
    if value <= 0.0 || value >= 1.0 { return 0.0; }
    30.0 * value * value * (value - 1.0) * (value - 1.0)
}
// --- КОНЕЦ ФУНКЦИИ smoother_derivative ---

// --- НАЧАЛО ФУНКЦИИ hash_float ---
fn hash_float(seed: u32, index: u32) -> f64 {
    DeterministicPrng::hash_u32(seed, index) as f64 / 4294967296.0
}
// --- КОНЕЦ ФУНКЦИИ hash_float ---

// --- НАЧАЛО ФУНКЦИИ fill_ouroboros_points ---
/// Все входы проверяются до первой записи. Ни PRNG физики, ни её часы не изменяются.
pub fn fill_ouroboros_points(
    target: &mut [f32], seed: u32, count: usize, time_sec: f64, morph: f64, energy: f64,
) -> Option<usize> {
    if count > OUROBOROS_CAPACITY || target.len() < count * OUROBOROS_STRIDE
        || !time_sec.is_finite() || time_sec < 0.0
        || !morph.is_finite() || !(0.0..=1.0).contains(&morph)
        || !energy.is_finite() || !(0.0..=1.0).contains(&energy)
    {
        return None;
    }
    // Голова направлена к убывающему theta: отрицательный оборот ведёт пастью вперёд.
    // Ограниченное покачивание трёх осей сохраняет читаемую плоскость тела.
    let ax = 0.38 + 0.24 * (time_sec * 0.21).sin();
    let ay = -0.32 + 0.24 * (time_sec * 0.17).sin();
    let az = 0.12 - time_sec * (TAU / 12.0) + 0.07 * (time_sec * 0.11).sin();
    let (sx, cx) = (ax.sin(), ax.cos());
    let (sy, cy) = (ay.sin(), ay.cos());
    let (sz, cz) = (az.sin(), az.cos());
    let (r00, r01, r02) = (cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx);
    let (r10, r11, r12) = (sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx);
    let (r20, r21, r22) = (-sy, cy * sx, cy * cx);
    // Поле разделяет пространственное покачивание, но не полный оборот тела каждые 12 с.
    let flow_az = 0.12 + 0.07 * (time_sec * 0.11).sin();
    let (flow_sin, flow_cos) = (flow_az.sin(), flow_az.cos());
    let (f00, f01, f02) = (flow_cos * cy, flow_cos * sy * sx - flow_sin * cx, flow_cos * sy * cx + flow_sin * sx);
    let (f10, f11, f12) = (flow_sin * cy, flow_sin * sy * sx + flow_cos * cx, flow_sin * sy * cx - flow_cos * sx);
    let flow_blend = smooth(morph);
    let surface_shift_u = hash_float(seed, 0x7ffffffe);
    let surface_shift_phi = hash_float(seed, 0x7fffffff);

    for i in 0..count {
        let h0 = hash_float(seed, (i * 11) as u32);
        let h1 = hash_float(seed, (i * 11 + 1) as u32);
        let h2 = hash_float(seed, (i * 11 + 2) as u32);
        let h3 = hash_float(seed, (i * 11 + 3) as u32);
        let h4 = hash_float(seed, (i * 11 + 4) as u32);
        let dust_angle = h0 * TAU + time_sec * (0.035 + h3 * 0.025);
        let dust_radius = 1.35 + 0.85 * h1.sqrt();
        let dx = dust_angle.cos() * dust_radius;
        let dy = dust_angle.sin() * dust_radius;
        let dz = (h2 - 0.5) * 0.22 + (dust_angle * 3.0 + time_sec * 0.13).sin() * 0.035;
        // Стабильная четверть пылевых индексов: 192 из 3072, без расходования исходного облака.
        let interior = i % 16 == 6;
        let (mut x, mut y, mut z, mut nx, mut ny, mut nz, mut size, kind);
        if i % 384 == 383 {
            let orbit = h0 * TAU + time_sec * (0.07 + h3 * 0.04) * if h4 < 0.5 { -1.0 } else { 1.0 };
            let radius = 1.3 + 0.7 * h1;
            x = orbit.cos() * radius;
            y = orbit.sin() * radius;
            z = (orbit * 2.0 + h2 * TAU).sin() * 0.24;
            nx = x; ny = y; nz = z;
            size = 3.0 + 4.0 * h4;
            kind = 2.0;
        } else if i % 8 >= 6 {
            x = dx; y = dy; z = dz;
            nx = dust_angle.cos(); ny = dust_angle.sin(); nz = 0.12;
            size = 0.4 + h4;
            kind = 1.0;
            if interior {
                // Музыка меняет амплитуду дыхания, сохраняя непрерывную фазу траекторий.
                let flow_angle = h0 * TAU + time_sec * (0.055 + h3 * 0.04);
                let flow_radius = 0.17 + 0.31 * h1.sqrt()
                    + (time_sec * 0.24 + h2 * TAU).sin() * (0.008 + 0.006 * energy);
                let flow_z = (h2 - 0.5) * 0.16 + (flow_angle * 2.0 + time_sec * 0.14).sin() * 0.025;
                x += (flow_angle.cos() * flow_radius - x) * flow_blend;
                y += (flow_angle.sin() * flow_radius - y) * flow_blend;
                z += (flow_z - z) * flow_blend;
                size += (0.75 + 0.65 * h4 - size) * flow_blend;
            }
        } else {
            let eye = i < 2;
            let lip = i == 2 || i == 3;
            // Парные ориентиры сечений сохраняются даже в коротком префиксе качества.
            let neck_landmark = i == 8 || i == 9;
            let cheek = i == 10 || i == 11;
            let cheek_depth = i == 16 || i == 17;
            let throat = i == 12 || i == 13 || i == 26 || i == 27;
            let join = i == 18 || i == 19 || i == 24 || i == 25;
            let neck_depth = i == 20 || i == 21;
            let torso = i == 28 || i == 29 || i == 32 || i == 33;
            let depth_landmark = cheek_depth || neck_depth || i == 24 || i == 25
                || i == 26 || i == 27 || i == 32 || i == 33;
            // Равномерное R2-покрытие не оставляет случайных пустых полос на шее.
            let surface_index = i / 8 * 6 + i % 8;
            let sequence_u = ((surface_index as f64 + 0.5) * 0.7548776662466927 + surface_shift_u) % 1.0;
            let sequence_phi = ((surface_index as f64 + 0.5) * 0.5698402909980532 + surface_shift_phi) % 1.0;
            let surface_u = if surface_index % 5 == 0 { sequence_u * 0.15 } else { 0.15 + sequence_u * 0.85 };
            let u = if eye { 0.055 } else if lip { 0.0 } else if i == 4 { 1.0 } else if i == 5 { 0.975 }
                else if neck_landmark || neck_depth { 0.125 } else if cheek || cheek_depth { 0.05 }
                else if throat { 0.10 } else if join { 0.15 } else if torso { 0.18 } else { surface_u };
            // Хвост пересекает плоскость губ и заканчивается внутри объёма головы.
            let theta = -0.06 + u * (TAU + 0.20);
            let phi = if eye { -std::f64::consts::PI / 2.0 + if i == 0 { -0.82 } else { 0.82 } }
                else if depth_landmark { ((i % 2) as f64 - 0.5) * std::f64::consts::PI }
                else if lip || neck_landmark || cheek || throat || join || torso { (i % 2) as f64 * std::f64::consts::PI }
                else { sequence_phi * TAU };
            let (c, s) = (theta.cos(), theta.sin());
            let (cp, sp) = (phi.cos(), phi.sin());
            // Уплощённая морда расширяется к черепу; затылок плавно округляется в туловище.
            // Отрицательная перетяжка отсутствует: площадь шеи не проваливается за головой.
            let tail = 0.13 + 0.87 * smooth((1.0 - u) / 0.17);
            let tail_t = ((1.0 - u) / 0.17).clamp(0.0, 1.0);
            let baseline = 0.110 + 0.015 * (theta * 3.0 + 0.35).sin() + 0.015 * energy;
            let body_tube = baseline * tail;
            let body_derivative = 0.045 * (TAU + 0.20) * (theta * 3.0 + 0.35).cos() * tail
                - baseline * 0.87 / 0.17 * 6.0 * tail_t * (1.0 - tail_t);
            let profile_t = if u <= 0.05 { u / 0.05 } else { (u - 0.05) / 0.10 };
            let blend = smoother(profile_t);
            let slope = smoother_derivative(profile_t) / if u <= 0.05 { 0.05 } else { 0.10 };
            let tube = if u <= 0.05 { 0.106 + 0.050 * blend } else { 0.156 + (body_tube - 0.156) * blend };
            let depth = if u <= 0.05 { 0.066 + 0.034 * blend } else { 0.100 + (1.06 * body_tube - 0.100) * blend };
            let tube_derivative = if u <= 0.05 { 0.050 * slope } else {
                body_derivative * blend + (body_tube - 0.156) * slope };
            let depth_derivative = if u <= 0.05 { 0.034 * slope } else {
                1.06 * body_derivative * blend + (1.06 * body_tube - 0.100) * slope };
            let head = if u <= 0.05 { blend } else { 1.0 - blend };
            let radius = 0.85 + 0.022 * (theta * 2.0 + time_sec * 0.11).sin() * (0.4 + energy * 0.6);
            let body_x = (radius + tube * cp) * c;
            let body_y = (radius + tube * cp) * s;
            let body_z = depth * sp + (theta * 2.0 + time_sec * 0.11).sin() * 0.035;
            // Аналитическая нормаль учитывает продольный наклон каждой поверхности.
            let radius_derivative = 0.044 * (TAU + 0.20) * (theta * 2.0 + time_sec * 0.11).cos() * (0.4 + energy * 0.6);
            let z_derivative = 0.070 * (TAU + 0.20) * (theta * 2.0 + time_sec * 0.11).cos();
            let tangent = (TAU + 0.20) * (radius + tube * cp);
            let normal_radial = tangent * depth * cp;
            let normal_tangent = -(depth * cp * (radius_derivative + tube_derivative * cp)
                + tube * sp * (z_derivative + depth_derivative * sp));
            let normal_z = tangent * tube * sp;
            let normal_x = normal_radial * c - normal_tangent * s;
            let normal_y = normal_radial * s + normal_tangent * c;
            let normal_length = (normal_x * normal_x + normal_y * normal_y + normal_z * normal_z).sqrt();
            let materialize = smooth((morph - (0.08 + h3 * 0.68)) / 0.24);
            x = dx + (body_x - dx) * materialize;
            y = dy + (body_y - dy) * materialize;
            z = dz + (body_z - dz) * materialize;
            nx = dust_angle.cos() * (1.0 - materialize) + normal_x / normal_length * materialize;
            ny = dust_angle.sin() * (1.0 - materialize) + normal_y / normal_length * materialize;
            nz = 0.12 * (1.0 - materialize) + normal_z / normal_length * materialize;
            let core_size = if eye { 2.8 } else { 1.20 + h4 * 1.05 + head * 0.22 };
            size = (0.4 + h4) + (core_size - (0.4 + h4)) * materialize;
            kind = if materialize < 0.5 { 1.0 } else { 0.0 };
        }
        let length = (nx * nx + ny * ny + nz * nz).sqrt();
        if length > 1e-12 { nx /= length; ny /= length; nz /= length; }
        else { nx = 0.0; ny = 0.0; nz = 1.0; }
        let offset = i * OUROBOROS_STRIDE;
        target[offset] = (if interior { f00 * x + f01 * y + f02 * z } else { r00 * x + r01 * y + r02 * z }) as f32;
        target[offset + 1] = (if interior { f10 * x + f11 * y + f12 * z } else { r10 * x + r11 * y + r12 * z }) as f32;
        target[offset + 2] = (r20 * x + r21 * y + r22 * z) as f32;
        target[offset + 3] = (if interior { f00 * nx + f01 * ny + f02 * nz } else { r00 * nx + r01 * ny + r02 * nz }) as f32;
        target[offset + 4] = (if interior { f10 * nx + f11 * ny + f12 * nz } else { r10 * nx + r11 * ny + r12 * nz }) as f32;
        target[offset + 5] = (r20 * nx + r21 * ny + r22 * nz) as f32;
        target[offset + 6] = size as f32;
        target[offset + 7] = kind;
    }
    Some(count)
}
// --- КОНЕЦ ФУНКЦИИ fill_ouroboros_points ---
// --- КОНЕЦ РАЗДЕЛА 2. ЗАПОЛНЕНИЕ ТОЧЕК ---

// --- НАЧАЛО РАЗДЕЛА 3. СТАТИЧЕСКАЯ ПАМЯТЬ И OPTIONAL ABI ---
static OUROBOROS_POINTS: Mutex<[f32; FLOAT_COUNT]> = Mutex::new([0.0; FLOAT_COUNT]);

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_ouroboros_abi_version ---
pub extern "C" fn get_ouroboros_abi_version() -> u32 { 1 }
// --- КОНЕЦ ФУНКЦИИ get_ouroboros_abi_version ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_ouroboros_capacity ---
pub extern "C" fn get_ouroboros_capacity() -> u32 { OUROBOROS_CAPACITY as u32 }
// --- КОНЕЦ ФУНКЦИИ get_ouroboros_capacity ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ get_ouroboros_points_ptr ---
pub extern "C" fn get_ouroboros_points_ptr() -> *const f32 {
    OUROBOROS_POINTS.lock().map(|points| points.as_ptr()).unwrap_or(std::ptr::null())
}
// --- КОНЕЦ ФУНКЦИИ get_ouroboros_points_ptr ---

#[no_mangle]
// --- НАЧАЛО ФУНКЦИИ sample_ouroboros ---
pub extern "C" fn sample_ouroboros(seed: u32, count: u32, time_sec: f64, morph: f64, energy: f64) -> u32 {
    if let Ok(mut points) = OUROBOROS_POINTS.lock() {
        return fill_ouroboros_points(&mut *points, seed, count as usize, time_sec, morph, energy)
            .map(|written| written as u32).unwrap_or(u32::MAX);
    }
    u32::MAX
}
// --- КОНЕЦ ФУНКЦИИ sample_ouroboros ---
// --- КОНЕЦ РАЗДЕЛА 3. СТАТИЧЕСКАЯ ПАМЯТЬ И OPTIONAL ABI ---

// --- НАЧАЛО РАЗДЕЛА 4. ТЕСТЫ ---
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // --- НАЧАЛО ФУНКЦИИ deterministic_prefix_and_normals ---
    fn deterministic_prefix_and_normals() {
        let mut full = [0.0; FLOAT_COUNT];
        let mut prefix = [0.0; 96 * OUROBOROS_STRIDE];
        for seed in [0, 104729, u32::MAX] {
            assert_eq!(fill_ouroboros_points(&mut full, seed, 3072, 17.0, 1.0, 0.7), Some(3072));
            assert_eq!(fill_ouroboros_points(&mut prefix, seed, 96, 17.0, 1.0, 0.7), Some(96));
            assert_eq!(&full[..prefix.len()], &prefix);
            for point in full.chunks_exact(OUROBOROS_STRIDE) {
                assert!(point.iter().all(|value| value.is_finite()));
                let length = (point[3] * point[3] + point[4] * point[4] + point[5] * point[5]).sqrt();
                assert!((length - 1.0).abs() < 0.00001);
                assert!(point[6] > 0.0 && point[6] <= 7.0);
                assert!(point[7] == 0.0 || point[7] == 1.0 || point[7] == 2.0);
            }
        }
    }
    // --- КОНЕЦ ФУНКЦИИ deterministic_prefix_and_normals ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ projected_body_remains_readable ---
    fn projected_body_remains_readable() {
        let mut points = [0.0; FLOAT_COUNT];
        for seed in [0, 104729, u32::MAX] {
            for time in (0..=216).step_by(9) {
                assert_eq!(fill_ouroboros_points(&mut points, seed, 3072, time as f64, 1.0, 0.7), Some(3072));
                let (mut count, mut x, mut y, mut xx, mut xy, mut yy) = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
                for point in points.chunks_exact(OUROBOROS_STRIDE) {
                    if point[7] != 0.0 { continue; }
                    let perspective = 3.0 / (3.0 + point[2] as f64);
                    let px = point[0] as f64 * perspective;
                    let py = -(point[1] as f64) * perspective;
                    count += 1.0; x += px; y += py; xx += px * px; xy += px * py; yy += py * py;
                }
                let vx = xx / count - (x / count) * (x / count);
                let vy = yy / count - (y / count) * (y / count);
                let covariance = xy / count - x * y / (count * count);
                let difference = ((vx - vy) * (vx - vy) + 4.0 * covariance * covariance).sqrt();
                let aspect = ((vx + vy - difference) / (vx + vy + difference)).max(0.0).sqrt();
                assert!(aspect > 0.62, "projected body is too narrow at time {time}: {aspect}");
            }
        }
    }
    // --- КОНЕЦ ФУНКЦИИ projected_body_remains_readable ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ rejection_is_atomic ---
    fn rejection_is_atomic() {
        let mut points = [13.0; 16];
        for (count, time, morph, energy) in [(3, 0.0, 1.0, 0.0), (1, f64::NAN, 1.0, 0.0),
            (1, -1.0, 1.0, 0.0), (1, 0.0, 1.1, 0.0), (1, 0.0, 1.0, f64::INFINITY)] {
            assert_eq!(fill_ouroboros_points(&mut points, 0, count, time, morph, energy), None);
            assert_eq!(points, [13.0; 16]);
        }
        assert_eq!(fill_ouroboros_points(&mut points, 0, 0, 0.0, 0.0, 0.0), Some(0));
        assert_eq!(points, [13.0; 16]);
    }
    // --- КОНЕЦ ФУНКЦИИ rejection_is_atomic ---

    #[test]
    // --- НАЧАЛО ФУНКЦИИ abi_static_region_and_morph ---
    fn abi_static_region_and_morph() {
        assert_eq!(get_ouroboros_abi_version(), 1);
        assert_eq!(get_ouroboros_capacity(), 3072);
        let pointer = get_ouroboros_points_ptr();
        assert!(!pointer.is_null());
        assert_eq!(sample_ouroboros(104729, 3072, 0.0, 0.0, 0.0), 3072);
        {
            let points = OUROBOROS_POINTS.lock().unwrap();
            assert!(points.chunks_exact(8).all(|point| point[7] != 0.0));
        }
        assert_eq!(sample_ouroboros(104729, 3072, 108.0, 1.0, 1.0), 3072);
        assert_eq!(pointer, get_ouroboros_points_ptr());
        let before = *OUROBOROS_POINTS.lock().unwrap();
        assert_eq!(sample_ouroboros(104729, 3073, 0.0, 0.0, 0.0), u32::MAX);
        assert_eq!(*OUROBOROS_POINTS.lock().unwrap(), before);
        let points = OUROBOROS_POINTS.lock().unwrap();
        assert_eq!(points.chunks_exact(8).filter(|point| point[7] == 2.0).count(), 8);
        assert_eq!(points.chunks_exact(8).filter(|point| point[7] == 0.0).count(), 2304);
    }
    // --- КОНЕЦ ФУНКЦИИ abi_static_region_and_morph ---
}
// --- КОНЕЦ РАЗДЕЛА 4. ТЕСТЫ ---
