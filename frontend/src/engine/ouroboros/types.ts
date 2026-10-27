// ============================================================================
// ФАЙЛ: frontend/src/engine/ouroboros/types.ts
// НАЗНАЧЕНИЕ: Контракт трёхмерных частиц между геометрией, GPU и Canvas fallback.
// РАЗДЕЛЫ: 1. Геометрия и кадр; 2. Размеры поверхности и диагностика.
// Позиции/нормали уже повёрнуты провайдером; size задаёт базовый радиус в CSS px.
// ============================================================================

// НАЧАЛО РАЗДЕЛА 1. ГЕОМЕТРИЯ И КАДР
export interface OuroborosUniforms {
    width: number;
    height: number;
    dpr: number;
    timeSec: number;
    opacity: number;
    morph: number;
    energy: number;
    centerX: number;
    centerY: number;
    scale: number;
}

export interface OuroborosFrame {
    /** По 8 float32: x, y, z, nx, ny, nz, size, kind; kind: 0 body, 1 dust, 2 satellite. */
    points: Float32Array;
    count: number;
    uniforms: OuroborosUniforms;
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПОВЕРХНОСТЬ И ДИАГНОСТИКА
export interface OuroborosViewport {
    width: number;
    height: number;
    dpr: number;
}

export interface OuroborosGpuStats {
    submittedFrames: number;
    validationErrors: number;
    lastError: string | null;
    initialized: boolean;
}
// КОНЕЦ РАЗДЕЛА 2
