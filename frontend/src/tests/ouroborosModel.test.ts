// ============================================================================
// ФАЙЛ: frontend/src/tests/ouroborosModel.test.ts
// НАЗНАЧЕНИЕ: Проверить формат, детерминизм, силуэт головы и мягкое внутреннее течение.
// РАЗДЕЛЫ: 1. Проверка активных точек; 2. Контракты заполнения и морфинга.
// ФУНКЦИИ: validPoints, projectedBodyAspectRatio, bodyVolumeRatio, runOuroborosModelChecks.
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

// НАЧАЛО ФУНКЦИИ bodyVolumeRatio
/** Нормированный объём ковариации не меняется при повороте: плоское кольцо даёт ноль. */
function bodyVolumeRatio(points: Float32Array): number {
    let count = 0, x = 0, y = 0, z = 0, xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0;
    for (let offset = 0; offset < points.length; offset += OUROBOROS_STRIDE) {
        if (points[offset + 7] !== 0) continue;
        const px = points[offset], py = points[offset + 1], pz = points[offset + 2];
        count++; x += px; y += py; z += pz;
        xx += px * px; yy += py * py; zz += pz * pz;
        xy += px * py; xz += px * pz; yz += py * pz;
    }
    if (count < 4) return 0;
    const a = xx / count - (x / count) ** 2, b = yy / count - (y / count) ** 2;
    const c = zz / count - (z / count) ** 2, d = xy / count - x * y / (count * count);
    const e = xz / count - x * z / (count * count), f = yz / count - y * z / (count * count);
    const determinant = a * (b * c - f * f) - d * (d * c - e * f) + e * (d * f - b * e);
    return Math.cbrt(Math.max(0, determinant)) / ((a + b + c) / 3);
}
// КОНЕЦ ФУНКЦИИ bodyVolumeRatio
// КОНЕЦ РАЗДЕЛА 1. ПРОВЕРКА АКТИВНЫХ ТОЧЕК

// НАЧАЛО РАЗДЕЛА 2. КОНТРАКТЫ ЗАПОЛНЕНИЯ И МОРФИНГА
// НАЧАЛО ФУНКЦИИ runOuroborosModelChecks
export function runOuroborosModelChecks(check: (passed: boolean, description: string) => void): void {
    const points = new Float32Array(OUROBOROS_CAPACITY * OUROBOROS_STRIDE);
    const repeated = new Float32Array(points.length);
    fillOuroborosPoints(points, 104729, OUROBOROS_CAPACITY, 17, 1, 0.7);
    let body = 0, dust = 0, interiorDust = 0, exteriorDust = 0, satellites = 0;
    let radiiValid = true;
    for (let i = 0; i < OUROBOROS_CAPACITY; i++) {
        const offset = i * OUROBOROS_STRIDE;
        const radius = Math.hypot(points[offset], points[offset + 1], points[offset + 2]);
        const kind = points[offset + 7];
        if (kind === 0) { body++; radiiValid &&= radius >= 0.6 && radius <= 1.15; }
        else if (kind === 1) {
            dust++;
            if (i % 16 === 6) { interiorDust++; radiiValid &&= radius >= 0.15 && radius <= 0.52; }
            else { exteriorDust++; radiiValid &&= radius >= 1.34 && radius <= 2.22; }
        }
        else { satellites++; radiiValid &&= radius >= 1.29 && radius <= 2.04; }
    }
    check(OUROBOROS_STRIDE === 8 && points.length === 24576 && validPoints(points, OUROBOROS_CAPACITY) &&
        body === 2304 && dust === 760 && interiorDust === 192 && exteriorDust === 568 && satellites === 8 && radiiValid,
        'Packed Ouroboros geometry preserves all point counts, unit normals and separate airy interior, exterior dust, body and satellite bands');

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

    let readableProjection = true, substantialVolume = true;
    for (const seed of [0, 104729, 0xffffffff]) {
        for (let time = 0; time <= 216; time += 9) {
            fillOuroborosPoints(points, seed, OUROBOROS_CAPACITY, time, 1, 0.7);
            readableProjection &&= projectedBodyAspectRatio(points) > 0.62 && validPoints(points, OUROBOROS_CAPACITY);
            // Общая ковариация включает намеренно уплощённую голову; объём туловища сохраняется.
            substantialVolume &&= bodyVolumeRatio(points) > 0.38;
        }
    }
    check(readableProjection,
        'The formed body keeps a readable projected minor axis above62% of its major axis across two cycles, with finite unit lighting normals');
    check(substantialVolume,
        'The formed body retains a substantial three-dimensional cross-section independent of camera tilt across seeds and two cycles');

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
    const distance = (a: readonly number[], b: readonly number[]): number => Math.hypot(...a.map((v, i) => v - b[i]));
    let elongatedHead = true, flattenedHead = true, taperedHead = true;
    for (const seed of [0, 104729, 0xffffffff]) {
        for (let time = 0; time <= 216; time += 9) {
            for (const energy of [0, 1]) {
                fillOuroborosPoints(prefix, seed, 512, time, 1, energy);
                const mouth = midpoint(position(prefix, 2), position(prefix, 3));
                const neck = midpoint(position(prefix, 8), position(prefix, 9));
                const cheekWidth = distance(position(prefix, 10), position(prefix, 11));
                const cheekDepth = distance(position(prefix, 16), position(prefix, 17));
                const muzzleWidth = distance(position(prefix, 2), position(prefix, 3));
                const neckWidth = distance(position(prefix, 8), position(prefix, 9));
                elongatedHead &&= distance(mouth, neck) / cheekWidth > 1.65;
                flattenedHead &&= cheekDepth / cheekWidth > 0.55 && cheekDepth / cheekWidth < 0.8;
                taperedHead &&= muzzleWidth < cheekWidth * 0.8 && neckWidth < cheekWidth * 0.8 &&
                    [2, 3, 8, 9, 10, 11, 16, 17].every(index => prefix[index * OUROBOROS_STRIDE + 7] === 0);
            }
        }
    }
    check(elongatedHead,
        'The snake head stays longer from mouth to neck than 1.65 times its cranial width across seeds, music extremes and two cycles');
    check(flattenedHead,
        'The snake head retains a flattened but volumetric cranial cross-section through every spatial rotation');
    check(taperedHead,
        'The formed head has a narrower muzzle and neck than its cranium at reduced quality across seeds and music extremes');

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

    const interiorIndices = Array.from({ length: 32 }, (_, index) => index * 16 + 6);
    let interiorBounds = true, gentleMotion = true, differentialFlow = true, repeatableFlow = true;
    for (const seed of [0, 104729, 0xffffffff]) {
        for (const time of [0, 17, 103.05, 216]) {
            fillOuroborosPoints(prefix, seed, 512, time, 1, 0.7);
            fillOuroborosPoints(nextPose, seed, 512, time + 0.05, 1, 0.7);
            for (const index of interiorIndices) {
                const offset = index * OUROBOROS_STRIDE;
                const radius = Math.hypot(prefix[offset], prefix[offset + 1], prefix[offset + 2]);
                const step = Math.hypot(nextPose[offset] - prefix[offset], nextPose[offset + 1] - prefix[offset + 1],
                    nextPose[offset + 2] - prefix[offset + 2]);
                interiorBounds &&= prefix[offset + 7] === 1 && radius >= 0.15 && radius <= 0.52;
                // Медленный поток не наследует быстрый полный оборот тела каждые 12 секунд.
                gentleMotion &&= step > 1e-6 && step / 0.05 < 0.12;
            }
            fillOuroborosPoints(nextPose, seed, 512, time + 2, 1, 0.7);
            let nonRigidPairs = 0;
            for (let pair = 1; pair < 8; pair++) {
                const a = interiorIndices[0] * OUROBOROS_STRIDE;
                const b = interiorIndices[pair] * OUROBOROS_STRIDE;
                const distance = (buffer: Float32Array): number => Math.hypot(buffer[a] - buffer[b], buffer[a + 1] - buffer[b + 1],
                    buffer[a + 2] - buffer[b + 2]);
                if (Math.abs(distance(nextPose) - distance(prefix)) > 1e-4) nonRigidPairs++;
            }
            differentialFlow &&= nonRigidPairs >= 4;
            fillOuroborosPoints(nextPose, seed, 512, time, 1, 0.7);
            repeatableFlow &&= prefix.every((value, index) => value === nextPose[index]);
        }
    }
    check(interiorBounds && gentleMotion,
        'Interior dust stays inside the body with an open central region and moves continuously at a restrained speed instead of inheriting the full twelve-second body spin');
    check(differentialFlow && repeatableFlow,
        'Interior point separations change as a differential field rather than one rigid object; fixed shared time replays the exact paused Float32 pose');

    fillOuroborosPoints(points, 104729, OUROBOROS_CAPACITY, 17, 1, 0.5);
    let exteriorUnchanged = true;
    for (let i = 0; i < OUROBOROS_CAPACITY; i++) {
        if (i % 8 < 6 || i % 16 === 6) continue;
        for (let field = 0; field < OUROBOROS_STRIDE; field++) {
            const offset = i * OUROBOROS_STRIDE + field;
            exteriorUnchanged &&= points[offset] === dissolved[offset];
        }
    }
    check(exteriorUnchanged,
        'Interior organization leaves every exterior dust point and satellite unchanged between dissolved and formed poses at the same time');

    let smoothFlowHandoff = true;
    for (const [boundary, neighbor] of [[0, 0.0001], [1, 0.9999]]) {
        fillOuroborosPoints(prefix, 104729, 512, 17, boundary, 0.7);
        fillOuroborosPoints(nextPose, 104729, 512, 17, neighbor, 0.7);
        for (const index of interiorIndices) {
            const offset = index * OUROBOROS_STRIDE;
            smoothFlowHandoff &&= Math.hypot(nextPose[offset] - prefix[offset], nextPose[offset + 1] - prefix[offset + 1],
                nextPose[offset + 2] - prefix[offset + 2]) < 1e-5;
            if (boundary === 0) smoothFlowHandoff &&= Math.hypot(prefix[offset], prefix[offset + 1], prefix[offset + 2]) >= 1.34;
        }
    }
    check(smoothFlowHandoff,
        'Interior flow emerges continuously from the original exterior dust and reaches its formed pose without a positional snap at either morph endpoint');

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
