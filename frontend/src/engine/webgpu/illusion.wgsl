// ============================================================================
// ФАЙЛ: frontend/src/engine/webgpu/illusion.wgsl
// НАЗНАЧЕНИЕ: Шейдер космической оптики ILLUSION (MASTER 00 / 01 / 02 v2.0)
// ЗАДАЧИ ФАЙЛА:
// 1. Вычислять 5-октавный анизотропный шум FBM (lacunarity 2.0, gain 0.5)
//    и двухпроходный domain warping для газовых складок туманности.
// 2. Вычитать ridged-поле поглощения света, формируя тёмные пылевые каньоны (#020308)
//    без использования запрещённых грязно-коричневых или кислотных оттенков.
// 3. Рассчитывать локальное затухание света I / (1 + k1*d + k2*d^2) и rim light (#7DD3FC).
// 4. Применять высокочастотный Blue-Noise дизеринг против ступенчатости (banding).
// ФУНКЦИИ: vs_main, hash21, value_noise, fbm_anisotropic, ridged_dust_canyon, blue_noise_dither, fs_main.
// ОГЛАВЛЕНИЕ РАЗДЕЛОВ:
//   0. Контракты данных и uniform-ресурсы: IllusionUniforms, VertexOutput.
//   1. vs_main: полноэкранный треугольник.
//   2. hash21, value_noise, fbm_anisotropic, ridged_dust_canyon, blue_noise_dither.
//   3. fs_main: цвет космической оптики.
// ============================================================================

// РАЗДЕЛ 0. КОНТРАКТЫ ДАННЫХ И UNIFORM-РЕСУРСЫ
struct IllusionUniforms {
    resolution: vec2<f32>,
    camera_drift: vec2<f32>,
    sim_time_sec: f32,
    camera_zoom: f32,
    phase_index: f32,
    illusion_weight: f32,
    active_node_pos: vec2<f32>,
    active_node_charge: f32,
    quality_octaves: f32,
};

@group(0) @binding(0)
var<uniform> u_illusion: IllusionUniforms;

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// ----------------------------------------------------------------------------
// 1. ВЕРШИННЫЙ ШЕЙДЕР ПОЛНОЭКРАННОГО ТРЕУГОЛЬНИКА (БЕЗ ВЕРШИННЫХ БУФЕРОВ)
// ----------------------------------------------------------------------------
// --- НАЧАЛО ФУНКЦИИ vs_main ---
@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;
    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);
    out.clip_position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    out.uv = vec2<f32>(x, y);
    return out;
}
// --- КОНЕЦ ФУНКЦИИ vs_main ---

// ----------------------------------------------------------------------------
// 2. ПРОЦЕДУРНЫЙ ХЕШ, СИМПЛЕКСНЫЙ ГРАДИЕНТНЫЙ ШУМ, FBM И RIDGED CANYON NOISE
// ----------------------------------------------------------------------------
// --- НАЧАЛО ФУНКЦИИ hash21 ---
fn hash21(p_in: vec2<f32>) -> f32 {
    var p = fract(p_in * vec2<f32>(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
// --- КОНЕЦ ФУНКЦИИ hash21 ---

// --- НАЧАЛО ФУНКЦИИ value_noise ---
fn value_noise(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);

    let a = hash21(i + vec2<f32>(0.0, 0.0));
    let b = hash21(i + vec2<f32>(1.0, 0.0));
    let c = hash21(i + vec2<f32>(0.0, 1.0));
    let d = hash21(i + vec2<f32>(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// --- КОНЕЦ ФУНКЦИИ value_noise ---

// 5-октавный фрактальный броуновский шум (lacunarity = 2.0, gain = 0.5 по MASTER 01/02)
// --- НАЧАЛО ФУНКЦИИ fbm_anisotropic ---
fn fbm_anisotropic(p_in: vec2<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var p = p_in;
    let rot = mat2x2<f32>(0.80, -0.60, 0.60, 0.80);

    for (var i: i32 = 0; i < 5; i = i + 1) {
        value += amplitude * value_noise(p);
        p = rot * p * 2.02;
        amplitude *= 0.5;
    }
    return value;
}
// --- КОНЕЦ ФУНКЦИИ fbm_anisotropic ---

// Ridged-поле поглощения света для создания тёмных пылевых каньонов
// --- НАЧАЛО ФУНКЦИИ ridged_dust_canyon ---
fn ridged_dust_canyon(p_in: vec2<f32>) -> f32 {
    var p = p_in * 1.35;
    let n = abs(value_noise(p) * 2.0 - 1.0);
    let ridge = 1.0 - n;
    return ridge * ridge * ridge;
}
// --- КОНЕЦ ФУНКЦИИ ridged_dust_canyon ---

// Дизеринг синим шумом (Interleaved Gradient Noise) против ступенчатости в тенях #020308..#060B19
// --- НАЧАЛО ФУНКЦИИ blue_noise_dither ---
fn blue_noise_dither(frag_coord: vec2<f32>) -> f32 {
    let magic = vec3<f32>(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(frag_coord, magic.xy))) - 0.5;
}
// --- КОНЕЦ ФУНКЦИИ blue_noise_dither ---

// ----------------------------------------------------------------------------
// 3. ФРАГМЕНТНЫЙ ШЕЙДЕР ОБЪЁМНОЙ ТУМАННОСТИ, ПЫЛЕВЫХ КАНЬОНОВ И RIM LIGHT
// ----------------------------------------------------------------------------
// --- НАЧАЛО ФУНКЦИИ fs_main ---
@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = u_illusion.resolution.x / max(1.0, u_illusion.resolution.y);
    let centered_uv = (in.uv - vec2<f32>(0.5, 0.5)) * vec2<f32>(aspect, 1.0);
    let p = centered_uv / max(0.2, u_illusion.camera_zoom) - u_illusion.camera_drift * 0.0005;
    let t = u_illusion.sim_time_sec * 0.06;

    // 1. Двухпроходный Domain Warping (MASTER 02 раздел Туманность FX 01)
    let q = vec2<f32>(
        fbm_anisotropic(p + vec2<f32>(0.0, 0.0) + t),
        fbm_anisotropic(p + vec2<f32>(5.2, 1.3) - t * 0.8)
    );
    let r = vec2<f32>(
        fbm_anisotropic(p + 1.85 * q + vec2<f32>(1.7, 9.2) + t * 0.5),
        fbm_anisotropic(p + 1.85 * q + vec2<f32>(8.3, 2.8) - t * 0.4)
    );

    let raw_density = fbm_anisotropic(p + 1.15 * r);
    let canyon_absorption = ridged_dust_canyon(p + 0.75 * q);

    // Пылевые каньоны вычитаются из плотности как зоны поглощения света
    let effective_density = clamp(smoothstep(0.22, 0.86, raw_density) - canyon_absorption * 0.52, 0.0, 1.0);

    // 2. Каноническая палитра MASTER 00 (вакуум, ультрамарин, индиго, циан, жемчуг)
    let col_obsidian = vec3<f32>(0.0078, 0.0117, 0.0314);    // #020308
    let col_indigo_void = vec3<f32>(0.0235, 0.0431, 0.0980); // #060B19
    let col_ultramarine = vec3<f32>(0.1176, 0.1059, 0.2941); // #1E1B4B
    let col_violet_gas = vec3<f32>(0.3882, 0.4000, 0.9451);  // #6366F1
    let col_cyan_rim = vec3<f32>(0.4902, 0.8275, 0.9882);    // #7DD3FC
    let col_pearl = vec3<f32>(0.9725, 0.9804, 0.9882);       // #F8FAFC

    let radial_dist = length(centered_uv);
    var color = mix(col_indigo_void, col_obsidian, smoothstep(0.0, 0.95, radial_dist));

    // Наложение газовых складок и вычитание тёмных каньонов
    let gas_fold = mix(col_ultramarine, col_violet_gas, clamp(length(q), 0.0, 1.0));
    color = mix(color, gas_fold, effective_density * 0.34);
    color = mix(color, col_obsidian, canyon_absorption * 0.65);

    // 3. Контровой свет (Rim Light #7DD3FC) на крутом перепаде плотности у границы каньона
    let rim_mask = smoothstep(0.32, 0.58, raw_density) * smoothstep(0.28, 0.72, canyon_absorption);
    color += col_cyan_rim * rim_mask * 0.26;

    // 4. Внутреннее локальное освещение от активной сомы I / (1 + k1*d + k2*d^2)
    let frag_px = in.uv * u_illusion.resolution;
    let d_node = distance(frag_px, u_illusion.active_node_pos);
    let attenuation = u_illusion.active_node_charge / (1.0 + 0.0045 * d_node + 0.000016 * d_node * d_node);
    color += mix(col_cyan_rim, col_pearl, 0.45) * attenuation * (0.25 + effective_density * 0.75);

    // 5. Мягкая виньетка и Blue-Noise дизеринг против бандинга
    let vignette = 1.0 - smoothstep(0.48, 1.05, radial_dist) * 0.55;
    let dither = blue_noise_dither(frag_px) / 255.0;
    let final_rgb = clamp(color * vignette * u_illusion.illusion_weight + vec3<f32>(dither), vec3<f32>(0.0), vec3<f32>(1.0));

    return vec4<f32>(final_rgb, 1.0);
}
// --- КОНЕЦ ФУНКЦИИ fs_main ---