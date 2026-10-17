// ============================================================================
// ФАЙЛ: frontend/src/engine/webgpu/breach.wgsl
// НАЗНАЧЕНИЕ: Оптическое преломление BREACH LENS и линзирование Гаргантюа (MASTER 04 / 05)
// ЗАДАЧИ ФАЙЛА:
// 1. Вычислять C^1-непрерывное поле преломления delta(p) = r_hat*A*g(d) + t_hat*B*g(d),
//    где колокол g(u) = (1 - u^2)^2 строго равен 0 за границей кольца (u >= 1).
// 2. Разделять 4 зоны маски: ядро X-RAY -> полоса смешивания -> кольцо рефракции -> ILLUSION.
// 3. Выполнять хроматическую дисперсию с коэффициентами (1, 1 + k, 1 + 2k) только на дугах кромки.
// 4. Моделировать гравитационное отклонение лучей alpha = 4GM/(c^2*b) и допплеровское
//    усиление яркости аккреционного диска для фазы SINGULARITY (MASTER 05 Акт A).
// ============================================================================

struct BreachUniforms {
    resolution: vec2<f32>,
    lens_center: vec2<f32>,
    lens_radius: f32,
    reveal_intensity: f32,
    global_stress: f32,
    sim_time_sec: f32,
    accretion_strength: f32,
    schwarzschild_radius: f32,
};

@group(0) @binding(0)
var<uniform> u_breach: BreachUniforms;

struct BreachFragmentInput {
    @builtin(position) frag_coord: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// ----------------------------------------------------------------------------
// 1. МАТЕМАТИЧЕСКАЯ МОДЕЛЬ КОЛЬЦА ПРЕЛОМЛЕНИЯ g(d) (C^1-НЕПРЕРЫВНАЯ, g = 0 ЗА ГРАНИЦЕЙ)
// ----------------------------------------------------------------------------
struct LensRefractionResult {
    offset_px: vec2<f32>,
    rim_bell: f32,
    core_xray_mask: f32,
};

fn evaluate_breach_lens_field(frag_px: vec2<f32>) -> LensRefractionResult {
    var res: LensRefractionResult;
    res.offset_px = vec2<f32>(0.0, 0.0);
    res.rim_bell = 0.0;
    res.core_xray_mask = 0.0;

    if (u_breach.lens_radius < 8.0) {
        return res;
    }

    let delta = frag_px - u_breach.lens_center;
    let dist = length(delta) + 0.0001;
    let angle = atan2(delta.y, delta.x);

    // Лёгкая анизотропная деформация кромки от напряжения мембраны
    let warp = 1.0 + (sin(angle * 3.0 + u_breach.sim_time_sec * 1.7) * 0.042 +
                      cos(angle * 5.0 - u_breach.sim_time_sec * 1.1) * 0.024) *
                     (0.5 + u_breach.global_stress * 0.5);
    let local_r = max(8.0, u_breach.lens_radius * warp);
    let d = dist / local_r;

    // 4 зоны маски по MASTER 04: ядро X-RAY (d < 0.55) -> полоса смешивания (0.55..1.0)
    if (d < 1.0) {
        let blend_t = clamp((d - 0.55) / 0.45, 0.0, 1.0);
        let smooth_blend = blend_t * blend_t * (3.0 - 2.0 * blend_t);
        res.core_xray_mask = (1.0 - smooth_blend) * (0.45 + u_breach.reveal_intensity * 0.55);
    }

    // Кольцо максимальной рефракции вокруг d = 1.0 с полушириной w = 0.24
    let w = 0.24;
    let u = abs(d - 1.0) / w;
    if (u < 1.0) {
        let one_minus_u2 = 1.0 - u * u;
        let g = one_minus_u2 * one_minus_u2; // C^1-гладкий колокол, строго 0 при u = 1
        res.rim_bell = g;

        let r_hat = delta / dist;
        let t_hat = vec2<f32>(-r_hat.y, r_hat.x);

        let radial_amp = (6.5 + u_breach.reveal_intensity * 8.5) * g;
        let tangent_amp = sin(angle * 4.0 + u_breach.sim_time_sec * 2.0) * 3.4 * g;

        res.offset_px = r_hat * radial_amp + t_hat * tangent_amp;
    }

    return res;
}

// ----------------------------------------------------------------------------
// 2. ГРАВИТАЦИОННОЕ ЛИНЗИРОВАНИЕ alpha = 4GM/(c^2*b) И ДОППЛЕРОВСКИЙ ДИСК (MASTER 05)
// ----------------------------------------------------------------------------
fn evaluate_relativistic_accretion(frag_px: vec2<f32>) -> vec3<f32> {
    if (u_breach.accretion_strength <= 0.01) {
        return vec3<f32>(0.0);
    }

    let center = u_breach.resolution * 0.5;
    let rel = frag_px - center;
    let b = length(rel) + 0.1; // Прицельный параметр луча b
    let r_s = max(12.0, u_breach.schwarzschild_radius);

    // Тёмная сфера горизонта событий
    if (b < r_s) {
        return vec3<f32>(0.0078, 0.0117, 0.0314);
    }

    // Угол отклонения Эйнштейна alpha ≈ 4GM / (c^2 * b) = 2 * R_s / b
    let deflection_alpha = (2.0 * r_s) / b;
    let photon_ring = exp(-pow((b - r_s * 1.06) / 2.2, 2.0));

    // Допплеровское усиление: приближающееся левое крыло диска (rel.x < 0) ярче удаляющегося
    let doppler_beaming = clamp(1.0 - (rel.x / max(1.0, u_breach.resolution.x * 0.35)) * 0.45, 0.4, 1.6);

    let col_pearl = vec3<f32>(0.9725, 0.9804, 0.9882);
    let col_amber = vec3<f32>(0.9608, 0.6196, 0.0431);
    let col_cyan = vec3<f32>(0.4902, 0.8275, 0.9882);

    let halo = clamp(deflection_alpha * 0.18, 0.0, 1.0) * doppler_beaming;
    let color = col_pearl * photon_ring + mix(col_cyan, col_amber, 0.55) * halo * 0.42;

    return color * u_breach.accretion_strength;
}

// ----------------------------------------------------------------------------
// 3. ФРАГМЕНТНЫЙ ШЕЙДЕР ОПТИЧЕСКОГО РАЗРЫВА И ХРОМАТИЧЕСКОЙ ДИСПЕРСИИ КРОМКИ
// ----------------------------------------------------------------------------
@fragment
fn fs_breach_main(in: BreachFragmentInput) -> @location(0) vec4<f32> {
    let frag_px = in.uv * u_breach.resolution;
    let lens = evaluate_breach_lens_field(frag_px);

    // Хроматическая дисперсия на кромке с масштабами (1, 1 + k, 1 + 2k) по MASTER 04
    let kappa = 0.14 * lens.rim_bell;
    let r_scale = 1.0;
    let g_scale = 1.0 + kappa;
    let b_scale = 1.0 + 2.0 * kappa;

    let rim_silver_cyan = vec3<f32>(
        0.4902 * r_scale,
        0.8275 * g_scale,
        0.9882 * b_scale
    ) * lens.rim_bell * (0.35 + u_breach.reveal_intensity * 0.55);

    let accretion_glow = evaluate_relativistic_accretion(frag_px + lens.offset_px);
    let final_rgb = clamp(rim_silver_cyan + accretion_glow, vec3<f32>(0.0), vec3<f32>(1.0));
    let alpha = clamp(lens.rim_bell * 0.85 + u_breach.accretion_strength * 0.5, 0.0, 1.0);

    return vec4<f32>(final_rgb, alpha);
}