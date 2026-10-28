// ============================================================================
// ФАЙЛ: frontend/src/core/ouroborosModel.ts
// НАЗНАЧЕНИЕ: Детерминированные объёмные точки Уробороса, пылевого кольца и спутников.
// РАЗДЕЛЫ: 1. Формат и проверка входов; 2. Заполнение геометрии без выделения памяти.
// ФУНКЦИИ: isValidOuroborosSample, smooth, fillOuroborosPoints.
// Позиции и нормали уже повёрнуты; size хранит базовый радиус в CSS-пикселях.
// ============================================================================
import { DeterministicPRNG } from './prng';

// НАЧАЛО РАЗДЕЛА 1. ФОРМАТ И ПРОВЕРКА ВХОДОВ
export const OUROBOROS_CAPACITY = 3072;
export const OUROBOROS_STRIDE = 8;
export const OUROBOROS_KIND_BODY = 0;
export const OUROBOROS_KIND_DUST = 1;
export const OUROBOROS_KIND_SATELLITE = 2;
const TAU = Math.PI * 2;

// НАЧАЛО ФУНКЦИИ isValidOuroborosSample
export function isValidOuroborosSample(seed: number, count: number, timeSec: number, morph: number, energy: number): boolean {
    return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff &&
        Number.isInteger(count) && count >= 0 && count <= OUROBOROS_CAPACITY &&
        Number.isFinite(timeSec) && timeSec >= 0 &&
        Number.isFinite(morph) && morph >= 0 && morph <= 1 &&
        Number.isFinite(energy) && energy >= 0 && energy <= 1;
}
// КОНЕЦ ФУНКЦИИ isValidOuroborosSample

// НАЧАЛО ФУНКЦИИ smooth
function smooth(value: number): number {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
}
// КОНЕЦ ФУНКЦИИ smooth
// КОНЕЦ РАЗДЕЛА 1. ФОРМАТ И ПРОВЕРКА ВХОДОВ

// НАЧАЛО РАЗДЕЛА 2. ЗАПОЛНЕНИЕ ГЕОМЕТРИИ
// НАЧАЛО ФУНКЦИИ fillOuroborosPoints
/** Возвращает число точек либо -1. Отклонённый вызов не изменяет ни одного элемента. */
export function fillOuroborosPoints(
    target: Float32Array, seed: number, count: number, timeSec: number, morph: number, energy: number
): number {
    if (!isValidOuroborosSample(seed, count, timeSec, morph, energy) ||
        !(target instanceof Float32Array) || target.length < count * OUROBOROS_STRIDE) return -1;

    // Голова направлена к убывающему theta: отрицательный оборот ведёт пастью вперёд.
    // Ограниченное покачивание трёх осей сохраняет читаемую плоскость тела.
    const ax = 0.38 + 0.24 * Math.sin(timeSec * 0.21);
    const ay = -0.32 + 0.24 * Math.sin(timeSec * 0.17);
    const az = 0.12 - timeSec * (TAU / 12) + 0.07 * Math.sin(timeSec * 0.11);
    const sx = Math.sin(ax), cx = Math.cos(ax);
    const sy = Math.sin(ay), cy = Math.cos(ay);
    const sz = Math.sin(az), cz = Math.cos(az);
    const r00 = cz * cy, r01 = cz * sy * sx - sz * cx, r02 = cz * sy * cx + sz * sx;
    const r10 = sz * cy, r11 = sz * sy * sx + cz * cx, r12 = sz * sy * cx - cz * sx;
    const r20 = -sy, r21 = cy * sx, r22 = cy * cx;

    for (let i = 0; i < count; i++) {
        // Независимые hash-каналы не расходуют PRNG физики и сохраняют prefix при смене качества.
        const h0 = DeterministicPRNG.hashFloat(seed, i * 11);
        const h1 = DeterministicPRNG.hashFloat(seed, i * 11 + 1);
        const h2 = DeterministicPRNG.hashFloat(seed, i * 11 + 2);
        const h3 = DeterministicPRNG.hashFloat(seed, i * 11 + 3);
        const h4 = DeterministicPRNG.hashFloat(seed, i * 11 + 4);
        const dustAngle = h0 * TAU + timeSec * (0.035 + h3 * 0.025);
        const dustRadius = 1.35 + 0.85 * Math.sqrt(h1);
        const dx = Math.cos(dustAngle) * dustRadius;
        const dy = Math.sin(dustAngle) * dustRadius;
        const dz = (h2 - 0.5) * 0.22 + Math.sin(dustAngle * 3 + timeSec * 0.13) * 0.035;
        let x: number, y: number, z: number, nx: number, ny: number, nz: number, size: number, kind: number;

        if (i % 384 === 383) {
            const orbit = h0 * TAU + timeSec * (0.07 + h3 * 0.04) * (h4 < 0.5 ? -1 : 1);
            const radius = 1.3 + 0.7 * h1;
            x = Math.cos(orbit) * radius;
            y = Math.sin(orbit) * radius;
            z = Math.sin(orbit * 2 + h2 * TAU) * 0.24;
            nx = x; ny = y; nz = z;
            size = 3 + 4 * h4;
            kind = OUROBOROS_KIND_SATELLITE;
        } else if (i % 8 >= 6) {
            x = dx; y = dy; z = dz;
            nx = Math.cos(dustAngle); ny = Math.sin(dustAngle); nz = 0.12;
            size = 0.4 + h4;
            kind = OUROBOROS_KIND_DUST;
        } else {
            // Стабильные ориентиры: глаза0/1, противоположные губы2/3, конец хвоста4/5.
            const eye = i < 2;
            const lip = i === 2 || i === 3;
            const u = eye ? 0.035 : lip ? 0 : i === 4 ? 1 : i === 5 ? 0.975 :
                i < 34 ? (i % 2 === 0 ? 0.016 : 0.05) + h0 * 0.018 : h0;
            // Дуга хвоста проходит через вход пасти и заканчивается внутри объёма головы.
            const theta = -0.06 + u * (TAU + 0.20);
            const phi = eye ? -Math.PI / 2 + (i === 0 ? -0.55 : 0.55) :
                lip ? (i - 2) * Math.PI : h1 * TAU;
            const c = Math.cos(theta), s = Math.sin(theta);
            const cp = Math.cos(phi), sp = Math.sin(phi);
            // Полая поверхность челюстей окружает тонкий хвост, заходящий за плоскость губ.
            const headDistance = (u - 0.045) / 0.032;
            const head = Math.exp(-headDistance * headDistance);
            const jawDistance = (u - 0.012) / 0.020;
            const jaw = Math.exp(-jawDistance * jawDistance);
            const tail = 0.13 + 0.87 * smooth((1 - u) / 0.17);
            const tube = (0.088 + 0.012 * Math.sin(theta * 3 + 0.35) + 0.012 * energy) * tail + 0.105 * head + 0.05 * jaw;
            const radius = 0.85 + 0.022 * Math.sin(theta * 2 + timeSec * 0.11) * (0.4 + energy * 0.6);
            const bodyX = (radius + tube * cp) * c;
            const bodyY = (radius + tube * cp) * s;
            const bodyZ = tube * 0.82 * sp + Math.sin(theta * 2 + timeSec * 0.11) * 0.035;
            const materialize = smooth((morph - (0.08 + h3 * 0.68)) / 0.24);
            x = dx + (bodyX - dx) * materialize;
            y = dy + (bodyY - dy) * materialize;
            z = dz + (bodyZ - dz) * materialize;
            nx = Math.cos(dustAngle) * (1 - materialize) + cp * c * materialize;
            ny = Math.sin(dustAngle) * (1 - materialize) + cp * s * materialize;
            nz = 0.12 * (1 - materialize) + sp / 0.82 * materialize;
            const coreSize = eye ? 3.6 : 1.0 + h4 * 0.9 + head * 0.65;
            size = (0.4 + h4) + (coreSize - (0.4 + h4)) * materialize;
            kind = materialize < 0.5 ? OUROBOROS_KIND_DUST : OUROBOROS_KIND_BODY;
        }
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (length > 1e-12) { nx /= length; ny /= length; nz /= length; }
        else { nx = 0; ny = 0; nz = 1; }
        const offset = i * OUROBOROS_STRIDE;
        target[offset] = r00 * x + r01 * y + r02 * z;
        target[offset + 1] = r10 * x + r11 * y + r12 * z;
        target[offset + 2] = r20 * x + r21 * y + r22 * z;
        target[offset + 3] = r00 * nx + r01 * ny + r02 * nz;
        target[offset + 4] = r10 * nx + r11 * ny + r12 * nz;
        target[offset + 5] = r20 * nx + r21 * ny + r22 * nz;
        target[offset + 6] = size;
        target[offset + 7] = kind;
    }
    return count;
}
// КОНЕЦ ФУНКЦИИ fillOuroborosPoints
// КОНЕЦ РАЗДЕЛА 2. ЗАПОЛНЕНИЕ ГЕОМЕТРИИ
