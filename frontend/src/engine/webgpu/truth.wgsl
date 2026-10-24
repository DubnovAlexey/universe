// ============================================================================
// ФАЙЛ: frontend/src/engine/webgpu/truth.wgsl
// НАЗНАЧЕНИЕ: Инженерный шейдер X-RAY / TRUTH и сплайнов NEXUS (MASTER 03 / 04 v2.0)
// ЗАДАЧИ ФАЙЛА:
// 1. Строить координатную сетку в мировых координатах с толщиной осей 0.5–0.8 px.
// 2. Масштабировать длину векторов скорости логарифмически: L = log(1 + |v|).
// 3. Отрисовывать 3 класса кривых (магистрали MST, мосты Габриэля, дендриты)
//    с сужением радиуса по закону Мюррея r_parent^3 = sum(r_child^3).
// ФУНКЦИИ: vs_truth_main, evaluate_world_grid, fs_truth_main.
// ОГЛАВЛЕНИЕ РАЗДЕЛОВ:
//   0. Контракты данных и uniform-ресурсы: TruthUniforms, SplineVertexInput, SplineVertexOutput.
//   1. vs_truth_main: инженерная геометрия.
//   2. evaluate_world_grid: координатная сетка.
//   3. fs_truth_main: маска и цвет рентген-оптики.
// ============================================================================

// РАЗДЕЛ 0. КОНТРАКТЫ ДАННЫХ И UNIFORM-РЕСУРСЫ
struct TruthUniforms {
    resolution: vec2<f32>,
    camera_drift: vec2<f32>,
    lens_center: vec2<f32>,
    lens_radius: f32,
    xray_weight: f32,
    logic_convergence: f32,
    sim_time_sec: f32,
};

@group(0) @binding(0)
var<uniform> u_truth: TruthUniforms;

struct SplineVertexInput {
    @location(0) world_pos: vec2<f32>,
    @location(1) velocity: vec2<f32>,
    @location(2) murray_radius: f32,
    @location(3) edge_class: f32, // 0.0: AXON_TRUNK, 1.0: BRIDGE, 2.0: DENDRITE
    @location(4) afterglow: f32,
};

struct SplineVertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) screen_pos: vec2<f32>,
    @location(1) speed_log: f32,
    @location(2) edge_class: f32,
    @location(3) afterglow: f32,
};

// ----------------------------------------------------------------------------
// 1. ВЕРШИННЫЙ ШЕЙДЕР ИНЖЕНЕРНОЙ ГЕОМЕТРИИ И ЛОГАРИФМИЧЕСКИХ ВЕКТОРОВ СКОРОСТИ
// ----------------------------------------------------------------------------
// --- НАЧАЛО ФУНКЦИИ vs_truth_main ---
@vertex
fn vs_truth_main(in: SplineVertexInput) -> SplineVertexOutput {
    var out: SplineVertexOutput;
    let shifted = in.world_pos + u_truth.camera_drift * 0.32;
    let ndc = (shifted / max(vec2<f32>(1.0), u_truth.resolution)) * 2.0 - vec2<f32>(1.0, 1.0);

    out.clip_position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
    out.screen_pos = shifted;
    // Логарифмическое масштабирование модуля скорости по MASTER 04
    out.speed_log = log(1.0 + length(in.velocity));
    out.edge_class = in.edge_class;
    out.afterglow = in.afterglow;
    return out;
}
// --- КОНЕЦ ФУНКЦИИ vs_truth_main ---

// ----------------------------------------------------------------------------
// 2. ФУНКЦИЯ МИРОВОЙ ИНЖЕНЕРНОЙ СЕТКИ ВНУТРИ ЛИНЗЫ И В РЕЖИМЕ LOGIC
// ----------------------------------------------------------------------------
// --- НАЧАЛО ФУНКЦИИ evaluate_world_grid ---
fn evaluate_world_grid(screen_pos: vec2<f32>, grid_step: f32) -> f32 {
    let world_coord = screen_pos - u_truth.camera_drift * 0.32;
    let cell = abs(fract(world_coord / grid_step - 0.5) - 0.5) * grid_step;
    let d_line = min(cell.x, cell.y);
    // Тонкая инженерная ось 0.65 px (MASTER 00 раздел 4)
    return 1.0 - smoothstep(0.0, 0.75, d_line);
}
// --- КОНЕЦ ФУНКЦИИ evaluate_world_grid ---

// ----------------------------------------------------------------------------
// 3. ФРАГМЕНТНЫЙ ШЕЙДЕР ОПТИКИ X-RAY / TRUTH
// ----------------------------------------------------------------------------
// --- НАЧАЛО ФУНКЦИИ fs_truth_main ---
@fragment
fn fs_truth_main(in: SplineVertexOutput) -> @location(0) vec4<f32> {
    let d_lens = distance(in.screen_pos, u_truth.lens_center);
    let inside_lens = 1.0 - smoothstep(u_truth.lens_radius * 0.65, u_truth.lens_radius, d_lens);
    let reveal_mask = max(inside_lens, max(u_truth.xray_weight, u_truth.logic_convergence));

    if (reveal_mask <= 0.01) {
        discard;
    }

    let col_cyan = vec3<f32>(0.2196, 0.7412, 0.9725);  // #38BDF8
    let col_ice = vec3<f32>(0.4902, 0.8275, 0.9882);   // #7DD3FC
    let col_pearl = vec3<f32>(0.9725, 0.9804, 0.9882); // #F8FAFC
    let col_amber = vec3<f32>(0.9608, 0.6196, 0.0431); // #F59E0B

    var base_color = col_cyan;
    if (in.edge_class < 0.5) {
        base_color = mix(col_ice, col_pearl, min(1.0, in.afterglow * 0.7));
    } else if (in.edge_class > 1.5) {
        base_color = col_cyan * 0.82;
    }

    // При интерференции сигналов (afterglow > 0.85) добавляется редкий янтарный отблеск
    if (in.afterglow > 0.85) {
        base_color = mix(base_color, col_amber, (in.afterglow - 0.85) * 4.0);
    }

    let grid_Contribution = evaluate_world_grid(in.screen_pos, 72.0) * 0.16;
    let alpha = clamp((0.28 + in.afterglow * 0.62 + grid_Contribution) * reveal_mask, 0.0, 0.95);

    return vec4<f32>(base_color, alpha);
}
// --- КОНЕЦ ФУНКЦИИ fs_truth_main ---