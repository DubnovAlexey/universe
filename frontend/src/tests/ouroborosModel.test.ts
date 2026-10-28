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

    const nextPose = new Float32Array(512 * OUROBOROS_STRIDE);
    const position = (buffer: Float32Array, index: number): number[] =>
        Array.from(buffer.subarray(index * OUROBOROS_STRIDE, index * OUROBOROS_STRIDE + 3));
    const midpoint = (a: readonly number[], b: readonly number[]): number[] => a.map((v, i) => (v + b[i]) / 2);
    const project = (v: readonly number[]): number[] => [v[0] * 3 / (3 + v[2]), -v[1] * 3 / (3 + v[2])];
    let tailInsideMouth = true, headLeads = true, minNormalZ = Infinity, maxNormalZ = -Infinity;
    for (const seed of [0, 104729, 0xffffffff]) {
        for (let time = 0; time <= 216; time += 3) {
            fillOuroborosPoints(prefix, seed, 512, time, 1, 0.5);
            fillOuroborosPoints(nextPose, seed, 512, time + 0.05, 1, 0.5);
            const mouth = midpoint(position(prefix, 2), position(prefix, 3));
            const head = midpoint(position(prefix, 0), position(prefix, 1));
            const axis = head.map((v, i) => v - mouth[i]);
            const tail = position(prefix, 4).map((v, i) => v - mouth[i]);
            const depth = tail.reduce((sum, v, i) => sum + v * axis[i], 0) / axis.reduce((sum, v) => sum + v * v, 0);
            const radialOffset = Math.hypot(...tail.map((v, i) => v - depth * axis[i]));
            const lipRadius = Math.hypot(...position(prefix, 2).map((v, i) => v - position(prefix, 3)[i])) / 2;
            tailInsideMouth &&= depth > 0.25 && depth < 1 && radialOffset < lipRadius && prefix[4 * 8 + 7] === 0;
            const screenMouth = project(mouth), screenHead = project(head);
            const nextMouth = project(midpoint(position(nextPose, 2), position(nextPose, 3)));
            const forwardTravel = nextMouth.reduce((sum, v, i) => sum + (v - screenMouth[i]) * (screenMouth[i] - screenHead[i]), 0);
            headLeads &&= forwardTravel > 0;
            minNormalZ = Math.min(minNormalZ, prefix[5]);
            maxNormalZ = Math.max(maxNormalZ, prefix[5]);
        }
    }
    check(tailInsideMouth,
        'The tapered tail enters behind the lips and stays within the mouth volume across seeds, quality prefixes and two cycles');
    check(headLeads && maxNormalZ - minNormalZ > 0.12,
        'Projected motion always leads mouth-first rather than tail-first, while normals confirm gentle spatial rocking');

    let completesTurn = true;
    for (let cycle = 0; cycle < 3; cycle++) {
        let previousAngle = 0, travel = 0;
        for (let frame = 0; frame <= 251; frame++) {
            // От конца сборки(103.05) до конца удержания VOID(108+7.6):12.55 движущейся секунды.
            fillOuroborosPoints(prefix, 104729, 512, 103.05 + cycle * 108 + frame * 0.05, 1, 0.5);
            const mouth = project(midpoint(position(prefix, 2), position(prefix, 3)));
            const angle = Math.atan2(mouth[1], mouth[0]);
            if (frame > 0) travel += Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle));
            previousAngle = angle;
        }
        completesTurn &&= travel >= Math.PI * 2;
    }
    check(completesTurn,
        'The fully formed head completes at least one visible orbit before automatic dispersion in each of three cycles');

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
