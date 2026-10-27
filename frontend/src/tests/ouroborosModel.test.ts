// ============================================================================
// ФАЙЛ: frontend/src/tests/ouroborosModel.test.ts
// НАЗНАЧЕНИЕ: Проверить формат, детерминизм и безопасные границы объёмной формы.
// РАЗДЕЛЫ: 1. Проверка активных точек; 2. Контракты заполнения и морфинга.
// ФУНКЦИИ: validPoints, projectedBodyAspectRatio, runOuroborosModelChecks.
// ============================================================================
import { OUROBOROS_CAPACITY, OUROBOROS_STRIDE, fillOuroborosPoints } from '../core/ouroborosModel';

// НАЧАЛО РАЗДЕЛА 1. ПРОВЕРКА АКТИВНЫХ ТОЧЕК
// НАЧАЛО ФУНКЦИИ validPoints
function validPoints(points: Float32Array, count: number): boolean {
    for (let i = 0; i < count; i++) {
        const offset = i * OUROBOROS_STRIDE;
        for (let field = 0; field < OUROBOROS_STRIDE; field++) {
            if (!Number.isFinite(points[offset + field])) return false;
        }
        const length = Math.hypot(points[offset + 3], points[offset + 4], points[offset + 5]);
        if (Math.abs(length - 1) > 1e-6 || points[offset + 6] <= 0 || points[offset + 6] > 7 ||
            ![0, 1, 2].includes(points[offset + 7])) return false;
    }
    return true;
}
// КОНЕЦ ФУНКЦИИ validPoints

// НАЧАЛО ФУНКЦИИ projectedBodyAspectRatio
/** Отношение осей реальной перспективной проекции, без знания углов модели. */
function projectedBodyAspectRatio(points: Float32Array): number {
    let count = 0, x = 0, y = 0, xx = 0, xy = 0, yy = 0;
    for (let offset = 0; offset < points.length; offset += OUROBOROS_STRIDE) {
        if (points[offset + 7] !== 0) continue;
        const perspective = 3 / (3 + points[offset + 2]);
        const px = points[offset] * perspective, py = -points[offset + 1] * perspective;
        count++; x += px; y += py; xx += px * px; xy += px * py; yy += py * py;
    }
    if (count < 3) return 0;
    const vx = xx / count - (x / count) ** 2;
    const vy = yy / count - (y / count) ** 2;
    const covariance = xy / count - x * y / (count * count);
    const difference = Math.sqrt((vx - vy) ** 2 + 4 * covariance * covariance);
    return Math.sqrt(Math.max(0, (vx + vy - difference) / (vx + vy + difference)));
}
// КОНЕЦ ФУНКЦИИ projectedBodyAspectRatio
// КОНЕЦ РАЗДЕЛА 1. ПРОВЕРКА АКТИВНЫХ ТОЧЕК

// НАЧАЛО РАЗДЕЛА 2. КОНТРАКТЫ ЗАПОЛНЕНИЯ И МОРФИНГА
// НАЧАЛО ФУНКЦИИ runOuroborosModelChecks
export function runOuroborosModelChecks(check: (passed: boolean, description: string) => void): void {
    const points = new Float32Array(OUROBOROS_CAPACITY * OUROBOROS_STRIDE);
    const repeated = new Float32Array(points.length);
    fillOuroborosPoints(points, 104729, OUROBOROS_CAPACITY, 17, 1, 0.7);
    let body = 0, dust = 0, satellites = 0;
    let radiiValid = true;
    for (let i = 0; i < OUROBOROS_CAPACITY; i++) {
        const offset = i * OUROBOROS_STRIDE;
        const radius = Math.hypot(points[offset], points[offset + 1], points[offset + 2]);
        const kind = points[offset + 7];
        if (kind === 0) { body++; radiiValid &&= radius >= 0.6 && radius <= 1.1; }
        else if (kind === 1) { dust++; radiiValid &&= radius >= 1.34 && radius <= 2.22; }
        else { satellites++; radiiValid &&= radius >= 1.29 && radius <= 2.04; }
    }
    check(OUROBOROS_STRIDE === 8 && points.length === 24576 && validPoints(points, OUROBOROS_CAPACITY) &&
        body === 2304 && dust === 760 && satellites === 8 && radiiValid,
        'Packed Ouroboros geometry has finite positions, unit normals, CSS radii and distinct body/dust/satellite spatial bands');

    let deterministic = true;
    for (const seed of [0, 104729, 0xffffffff]) {
        fillOuroborosPoints(points, seed, OUROBOROS_CAPACITY, 108, 0.5, 1);
        fillOuroborosPoints(repeated, seed, OUROBOROS_CAPACITY, 108, 0.5, 1);
        deterministic &&= points.every((value, index) => value === repeated[index]);
    }
    fillOuroborosPoints(repeated, 0, OUROBOROS_CAPACITY, 108, 0.5, 1);
    check(deterministic && points.some((value, index) => value !== repeated[index]),
        'Equal seeds and inputs replay exact Float32 geometry; distinct seeds retain distinct arrangements');

    const prefix = new Float32Array(512 * OUROBOROS_STRIDE);
    fillOuroborosPoints(prefix, 104729, 512, 17, 0.6, 0.2);
    fillOuroborosPoints(points, 104729, OUROBOROS_CAPACITY, 17, 0.6, 0.2);
    check(prefix.every((value, index) => value === points[index]),
        'Quality counts preserve identical shared point indices instead of reshuffling the visible geometry');

    fillOuroborosPoints(points, 104729, OUROBOROS_CAPACITY, 17, 0, 0.5);
    const dissolved = points.slice();
    let dissolvedBody = false;
    for (let i = 7; i < points.length; i += OUROBOROS_STRIDE) dissolvedBody ||= points[i] === 0;
    fillOuroborosPoints(points, 104729, OUROBOROS_CAPACITY, 17, 1, 0.5);
    const changed = points.some((value, index) => value !== dissolved[index]);
    fillOuroborosPoints(points, 104729, OUROBOROS_CAPACITY, 17, 0, 0.5);
    check(!dissolvedBody && changed && points.every((value, index) => value === dissolved[index]),
        'Morph 0→1→0 assembles the body from dust and returns exactly without integrating a second clock');

    let finiteMotion = true;
    for (const time of [0, 17, 108]) {
        for (const morph of [0, 0.5, 1]) {
            for (const energy of [0, 1]) {
                fillOuroborosPoints(points, 104729, OUROBOROS_CAPACITY, time, morph, energy);
                finiteMotion &&= validPoints(points, OUROBOROS_CAPACITY);
            }
        }
    }
    check(finiteMotion,
        'All rotation, morph and energy endpoints preserve finite points and normalized lighting normals');

    let readableProjection = true;
    for (const seed of [0, 104729, 0xffffffff]) {
        for (let time = 0; time <= 216; time += 9) {
            fillOuroborosPoints(points, seed, OUROBOROS_CAPACITY, time, 1, 0.7);
            readableProjection &&= projectedBodyAspectRatio(points) > 0.62 && validPoints(points, OUROBOROS_CAPACITY);
        }
    }
    check(readableProjection,
        'The formed body keeps a readable projected minor axis above62% of its major axis across two cycles, with finite unit lighting normals');

    fillOuroborosPoints(points, 104729, 512, 0, 1, 0.7);
    const eyeDistance = Math.hypot(points[0] - points[8], points[1] - points[9], points[2] - points[10]);
    check(points[6] >= 2.5 && points[14] >= 2.5 && points[7] === 0 && points[15] === 0 &&
        eyeDistance > 0.05 && eyeDistance < 0.4 && validPoints(points, 512),
        'Two distinct larger luminous eye cores remain part of the head and keep valid normals at reduced quality');

    const guard = new Float32Array(16).fill(19);
    const invalid = [[-1, 1, 0, 1, 0], [0, 1.5, 0, 1, 0], [0, 3073, 0, 1, 0],
        [0, 1, Number.NaN, 1, 0], [0, 1, -1, 1, 0], [0, 1, 0, -0.1, 0], [0, 1, 0, 1, Infinity]];
    let rejectedAtomically = true;
    for (const [seed, count, time, morph, energy] of invalid) {
        rejectedAtomically &&= fillOuroborosPoints(guard, seed, count, time, morph, energy) === -1 &&
            guard.every((value) => value === 19);
    }
    rejectedAtomically &&= fillOuroborosPoints(guard, 0, 3, 0, 1, 0) === -1 &&
        fillOuroborosPoints(guard, 0, 0, 0, 0, 0) === 0 && guard.every((value) => value === 19);
    check(rejectedAtomically,
        'Invalid inputs and undersized buffers reject before any write; zero count is a harmless no-op');
}
// КОНЕЦ ФУНКЦИИ runOuroborosModelChecks
// КОНЕЦ РАЗДЕЛА 2. КОНТРАКТЫ ЗАПОЛНЕНИЯ И МОРФИНГА
