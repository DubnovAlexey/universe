// ============================================================================
// ФАЙЛ: frontend/src/core/ouroborosFieldMorph.ts
// НАЗНАЧЕНИЕ: Передать существующие экранные частицы в объёмную форму и обратно.
// РАЗДЕЛЫ: 1. Контракт и проверка; 2. C²-переход координат, нормалей и размеров.
// ФУНКЦИИ: applyOuroborosFieldMorph.
// Буфер содержит форму при morph=1 до вызова; источники и часы не изменяются.
// ============================================================================
import { DeterministicPRNG } from './prng';
import { OUROBOROS_CAPACITY, OUROBOROS_STRIDE, OUROBOROS_KIND_DUST } from './ouroborosModel';
import type { OuroborosLayout } from './ouroborosEpisode';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ
export interface OuroborosFieldSource {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
}
const MAX_FLOAT32 = 3.4028234663852886e38;
// КОНЕЦ РАЗДЕЛА 1. КОНТРАКТ

// НАЧАЛО РАЗДЕЛА 2. C²-ПЕРЕХОД ОТ ПОЛЯ К ФОРМЕ
// НАЧАЛО ФУНКЦИИ applyOuroborosFieldMorph
/** false означает безопасный no-op. Входы полностью проверяются до первой записи. */
export function applyOuroborosFieldMorph(
    points: Float32Array, count: number, sources: readonly OuroborosFieldSource[],
    layout: Readonly<OuroborosLayout>, morph: number, seed: number
): boolean {
    if (!(points instanceof Float32Array) || !Number.isInteger(count) || count <= 0 || count > OUROBOROS_CAPACITY ||
        points.length < count * OUROBOROS_STRIDE || !Array.isArray(sources) || sources.length === 0 || !layout ||
        !Number.isFinite(layout.centerX) || !Number.isFinite(layout.centerY) ||
        !Number.isFinite(layout.scale) || layout.scale <= 0 ||
        !Number.isFinite(morph) || morph < 0 || morph > 1 ||
        !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return false;

    for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        if (!source || !Number.isFinite(source.x) || !Number.isFinite(source.y) ||
            !Number.isFinite(source.radius) || source.radius < 0 || source.radius > MAX_FLOAT32) return false;
        const x = (source.x - layout.centerX) / layout.scale;
        const y = (layout.centerY - source.y) / layout.scale;
        if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_FLOAT32 || Math.abs(y) > MAX_FLOAT32) return false;
    }
    for (let i = 0; i < count; i++) {
        const offset = i * OUROBOROS_STRIDE;
        for (let field = 0; field < OUROBOROS_STRIDE; field++) {
            if (!Number.isFinite(points[offset + field])) return false;
        }
        const kind = points[offset + 7];
        const nx = points[offset + 3], ny = points[offset + 4], nz = points[offset + 5];
        if (!Number.isInteger(kind) || kind < 0 || kind > 2 || points[offset + 6] < 0 ||
            nx * nx + ny * ny + nz * nz < 1e-20) return false;
    }
    // Собранный конец сохраняет исходные f32-биты, в том числе нормали Rust.
    if (morph === 1) return true;
    const progress = Math.max(0, Math.min(1, morph * morph * morph * (morph * (morph * 6 - 15) + 10)));
    for (let i = 0; i < count; i++) {
        const offset = i * OUROBOROS_STRIDE;
        const source = sources[i % sources.length];
        const sourceX = (source.x - layout.centerX) / layout.scale;
        const sourceY = (layout.centerY - source.y) / layout.scale;
        if (morph === 0) {
            // z=0 делает перспективный коэффициент 3/(3+z) равным единице.
            points[offset] = sourceX;
            points[offset + 1] = sourceY;
            points[offset + 2] = 0;
            points[offset + 3] = 0;
            points[offset + 4] = 0;
            points[offset + 5] = -1;
            points[offset + 6] = source.radius;
            points[offset + 7] = OUROBOROS_KIND_DUST;
            continue;
        }
        const targetX = points[offset], targetY = points[offset + 1], targetZ = points[offset + 2];
        const targetSize = points[offset + 6], targetKind = points[offset + 7];
        const targetNx = points[offset + 3], targetNy = points[offset + 4], targetNz = points[offset + 5];
        const length = Math.sqrt(targetNx * targetNx + targetNy * targetNy + targetNz * targetNz);
        const nx = targetNx / length, ny = targetNy / length, nz = targetNz / length;
        const horizontal = Math.sqrt(nx * nx + ny * ny);
        const angle = Math.acos(Math.max(-1, Math.min(1, -nz))) * progress;
        let directionX = 0, directionY = 0;
        if (horizontal > 1e-10) {
            directionX = nx / horizontal;
            directionY = ny / horizontal;
        } else if (nz > 0) {
            // Антиподальные нормали проходят по устойчивой дуге без нулевого вектора.
            const axis = DeterministicPRNG.hashFloat(seed, i) * Math.PI * 2;
            directionX = Math.cos(axis);
            directionY = Math.sin(axis);
        }
        points[offset] = sourceX + (targetX - sourceX) * progress;
        points[offset + 1] = sourceY + (targetY - sourceY) * progress;
        points[offset + 2] = targetZ * progress;
        points[offset + 3] = directionX * Math.sin(angle);
        points[offset + 4] = directionY * Math.sin(angle);
        points[offset + 5] = -Math.cos(angle);
        points[offset + 6] = source.radius + (targetSize - source.radius) * progress;
        // Поля непрерывны; дискретный материал меняется после середины перехода.
        points[offset + 7] = progress > 0.5 ? targetKind : OUROBOROS_KIND_DUST;
    }
    return true;
}
// КОНЕЦ ФУНКЦИИ applyOuroborosFieldMorph
// КОНЕЦ РАЗДЕЛА 2. C²-ПЕРЕХОД ОТ ПОЛЯ К ФОРМЕ
