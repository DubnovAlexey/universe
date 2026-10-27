// ============================================================================
// ФАЙЛ: frontend/src/engine/webgpu/ouroboros.wgsl
// НАЗНАЧЕНИЕ: Перспективные частицы Уробороса, объёмное освещение и мягкая пыль.
// РАЗДЕЛЫ: 1. Контракт; 2. Проекция; 3. Ядра с глубиной; 4. Полупрозрачный свет.
// ФУНКЦИИ: projectPoint, vsCore, vsGlow, fsCore, fsGlow.
// ============================================================================

// НАЧАЛО РАЗДЕЛА 1. ВХОДНЫЕ ДАННЫЕ
struct Uniforms {
    viewport: vec4<f32>, // CSS width, CSS height, DPR, active time
    material: vec4<f32>, // opacity, morph, energy, scene scale in CSS px
    placement: vec4<f32>, // center X/Y, camera distance, reserved
    reserved: vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

// Смещения vertex attributes: 0, 12, 24, 28; arrayStride=32, stepMode=instance.
struct PointInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) size: f32,
    @location(3) kind: f32,
};
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) @interpolate(flat) kind: f32,
    @location(3) @interpolate(flat) depth: f32,
    @location(4) @interpolate(flat) worldRadius: f32,
};
struct CoreOutput {
    @location(0) color: vec4<f32>,
    @builtin(frag_depth) depth: f32,
};
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПЕРСПЕКТИВА И ЭКРАННЫЕ КВАДРАТЫ
// НАЧАЛО ФУНКЦИИ projectPoint
fn projectPoint(point: PointInput, vertexIndex: u32, spread: f32) -> VertexOutput {
    var corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
    );
    let corner = corners[vertexIndex];
    let cameraDistance = u.placement.z;
    let perspective = cameraDistance / max(0.35, cameraDistance + point.position.z);
    let sizeFactor = clamp(min(u.viewport.x, u.viewport.y) / 800.0, 0.6, 1.2);
    let radius = max(0.3, point.size * sizeFactor * perspective);
    let center = vec2<f32>(
        u.placement.x + u.material.w * point.position.x * perspective,
        u.placement.y - u.material.w * point.position.y * perspective
    );
    let pixel = center + corner * radius * spread;
    let depth = clamp((cameraDistance + point.position.z - 0.35) / 7.0, 0.001, 0.999);
    var out: VertexOutput;
    out.position = vec4<f32>(pixel.x / u.viewport.x * 2.0 - 1.0,
        1.0 - pixel.y / u.viewport.y * 2.0, depth, 1.0);
    out.uv = corner;
    out.normal = normalize(point.normal + vec3<f32>(0.00001, 0.00002, -0.00003));
    out.kind = point.kind;
    out.depth = depth;
    out.worldRadius = radius / max(1.0, u.material.w * perspective);
    return out;
}
// КОНЕЦ ФУНКЦИИ projectPoint

// НАЧАЛО ФУНКЦИИ vsCore
@vertex fn vsCore(point: PointInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    return projectPoint(point, vertexIndex, 1.0);
}
// КОНЕЦ ФУНКЦИИ vsCore

// НАЧАЛО ФУНКЦИИ vsGlow
@vertex fn vsGlow(point: PointInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let spread = select(2.6, 1.9, point.kind > 0.5 && point.kind < 1.5);
    return projectPoint(point, vertexIndex, spread);
}
// КОНЕЦ ФУНКЦИИ vsGlow
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ОБЪЁМНЫЕ ЯДРА И САМООККЛЮЗИЯ
// НАЧАЛО ФУНКЦИИ fsCore
@fragment fn fsCore(input: VertexOutput) -> CoreOutput {
    let radiusSquared = dot(input.uv, input.uv);
    if ((input.kind > 0.5 && input.kind < 1.5) || radiusSquared >= 1.0) { discard; }
    let hemisphere = sqrt(max(0.0, 1.0 - radiusSquared));
    let sphereNormal = normalize(vec3<f32>(input.uv.x, -input.uv.y, -hemisphere));
    let satellite = input.kind > 1.5;
    let normal = normalize(mix(input.normal, sphereNormal, select(0.24, 1.0, satellite)));
    let light = normalize(vec3<f32>(-0.5, 0.75, -0.9));
    let diffuse = max(0.0, dot(normal, light));
    let facing = clamp(-normal.z, 0.0, 1.0);
    let rim = pow(1.0 - facing, 2.4);
    let specular = pow(max(0.0, dot(reflect(-light, normal), vec3<f32>(0.0, 0.0, -1.0))), 22.0);
    let shadow = mix(vec3<f32>(0.025, 0.055, 0.12), vec3<f32>(0.045, 0.075, 0.15), u.material.y * 0.45);
    let pearl = mix(vec3<f32>(0.55, 0.76, 0.86), vec3<f32>(0.67, 0.84, 0.93), u.material.y * 0.3);
    let color = shadow * (0.7 + facing * 0.3)
        + pearl * pow(diffuse, 0.8) * select(0.94, 1.06, satellite)
        + vec3<f32>(0.23, 0.65, 0.83) * rim * (0.4 + u.material.z * 0.3)
        + vec3<f32>(0.85, 0.95, 1.0) * specular * select(0.34, 0.8, satellite);
    let coverage = 1.0 - smoothstep(0.45, 1.0, radiusSquared);
    let alpha = coverage * u.material.x * select(0.82 + facing * 0.16, 0.98, satellite);
    if (alpha < 0.025) { discard; }
    var out: CoreOutput;
    let depthShade = clamp(1.2 - input.depth * 0.7, 0.5, 1.1);
    out.color = vec4<f32>(clamp(color * depthShade, vec3<f32>(0.0), vec3<f32>(1.0)) * alpha, alpha);
    out.depth = clamp(input.depth - hemisphere * input.worldRadius / 7.0, 0.0, 1.0);
    return out;
}
// КОНЕЦ ФУНКЦИИ fsCore
// КОНЕЦ РАЗДЕЛА 3

// НАЧАЛО РАЗДЕЛА 4. ПЫЛЬ И СВЕТОВОЕ ОКРУЖЕНИЕ
// НАЧАЛО ФУНКЦИИ fsGlow
@fragment fn fsGlow(input: VertexOutput) -> @location(0) vec4<f32> {
    let radiusSquared = dot(input.uv, input.uv);
    if (radiusSquared >= 1.0) { discard; }
    let dust = input.kind > 0.5 && input.kind < 1.5;
    let satellite = input.kind > 1.5;
    let envelope = exp(-radiusSquared * select(4.8, 3.2, dust)) * (1.0 - smoothstep(0.5, 1.0, radiusSquared));
    let breath = 0.96 + 0.04 * sin(u.viewport.w * 0.7 + input.normal.x * 3.0);
    let intensity = select(select(0.1, 0.22, satellite), 0.38, dust) * (0.65 + u.material.z * 0.35);
    let alpha = envelope * intensity * u.material.x * breath;
    let dustColor = vec3<f32>(0.35, 0.60, 0.78);
    let pearlGlow = mix(vec3<f32>(0.2, 0.47, 0.64), vec3<f32>(0.34, 0.62, 0.78), u.material.y * 0.3);
    let color = select(pearlGlow, dustColor, dust);
    return vec4<f32>(color * alpha, alpha);
}
// КОНЕЦ ФУНКЦИИ fsGlow
// КОНЕЦ РАЗДЕЛА 4
