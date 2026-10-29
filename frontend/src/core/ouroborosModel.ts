// ============================================================================
// ФАЙЛ: frontend/src/core/ouroborosModel.ts
// НАЗНАЧЕНИЕ: Объёмные точки Уробороса, внутреннее течение пыли, ореол и спутники.
// РАЗДЕЛЫ: 1. Формат и проверка входов; 2. Заполнение геометрии без выделения памяти.
// ФУНКЦИИ: isValidOuroborosSample, smooth, smoother, smootherDerivative, fillOuroborosPoints.
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

// НАЧАЛО ФУНКЦИИ smoother
/** C²-профиль соединяет морду, череп и туловище без ступеней кривизны. */
function smoother(value: number): number {
    const t = Math.max(0, Math.min(1, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ smoother

// НАЧАЛО ФУНКЦИИ smootherDerivative
function smootherDerivative(value: number): number {
    if (value <= 0 || value >= 1) return 0;
    return 30 * value * value * (value - 1) * (value - 1);
}
// КОНЕЦ ФУНКЦИИ smootherDerivative
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
    // Поле разделяет пространственное покачивание, но не полный оборот тела каждые 12 с.
    const flowAz = 0.12 + 0.07 * Math.sin(timeSec * 0.11);
    const flowSin = Math.sin(flowAz), flowCos = Math.cos(flowAz);
    const f00 = flowCos * cy, f01 = flowCos * sy * sx - flowSin * cx, f02 = flowCos * sy * cx + flowSin * sx;
    const f10 = flowSin * cy, f11 = flowSin * sy * sx + flowCos * cx, f12 = flowSin * sy * cx - flowCos * sx;
    const flowBlend = smooth(morph);
    const surfaceShiftU = DeterministicPRNG.hashFloat(seed, 0x7ffffffe);
    const surfaceShiftPhi = DeterministicPRNG.hashFloat(seed, 0x7fffffff);

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
        // Стабильная четверть пылевых индексов: 192 из 3072, без расходования исходного облака.
        const interior = i % 16 === 6;
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
            if (interior) {
                // Разные скорости и мягкое радиальное дыхание не создают второго жёсткого кольца.
                // Музыка меняет амплитуду дыхания, сохраняя непрерывную фазу каждой траектории.
                const flowAngle = h0 * TAU + timeSec * (0.055 + h3 * 0.04);
                const flowRadius = 0.17 + 0.31 * Math.sqrt(h1) +
                    Math.sin(timeSec * 0.24 + h2 * TAU) * (0.008 + 0.006 * energy);
                const flowZ = (h2 - 0.5) * 0.16 + Math.sin(flowAngle * 2 + timeSec * 0.14) * 0.025;
                x += (Math.cos(flowAngle) * flowRadius - x) * flowBlend;
                y += (Math.sin(flowAngle) * flowRadius - y) * flowBlend;
                z += (flowZ - z) * flowBlend;
                size += (0.75 + 0.65 * h4 - size) * flowBlend;
            }
        } else {
            // Парные ориентиры сечений сохраняются даже в коротком префиксе качества.
            const eye = i < 2;
            const lip = i === 2 || i === 3;
            const neckLandmark = i === 8 || i === 9;
            const cheek = i === 10 || i === 11;
            const cheekDepth = i === 16 || i === 17;
            const throat = i === 12 || i === 13 || i === 26 || i === 27;
            const join = i === 18 || i === 19 || i === 24 || i === 25;
            const neckDepth = i === 20 || i === 21;
            const torso = i === 28 || i === 29 || i === 32 || i === 33;
            const depthLandmark = cheekDepth || neckDepth || i === 24 || i === 25 ||
                i === 26 || i === 27 || i === 32 || i === 33;
            // Равномерное R2-покрытие не оставляет случайных пустых полос на шее.
            const surfaceIndex = Math.floor(i / 8) * 6 + i % 8;
            const sequenceU = ((surfaceIndex + 0.5) * 0.7548776662466927 + surfaceShiftU) % 1;
            const sequencePhi = ((surfaceIndex + 0.5) * 0.5698402909980532 + surfaceShiftPhi) % 1;
            const surfaceU = surfaceIndex % 5 === 0 ? sequenceU * 0.15 : 0.15 + sequenceU * 0.85;
            const u = eye ? 0.055 : lip ? 0 : i === 4 ? 1 : i === 5 ? 0.975 :
                neckLandmark || neckDepth ? 0.125 : cheek || cheekDepth ? 0.05 :
                throat ? 0.10 : join ? 0.15 : torso ? 0.18 : surfaceU;
            // Дуга хвоста проходит через вход пасти и заканчивается внутри объёма головы.
            const theta = -0.06 + u * (TAU + 0.20);
            const phi = eye ? -Math.PI / 2 + (i === 0 ? -0.82 : 0.82) :
                depthLandmark ? (i % 2 - 0.5) * Math.PI :
                lip || neckLandmark || cheek || throat || join || torso ? (i % 2) * Math.PI : sequencePhi * TAU;
            const c = Math.cos(theta), s = Math.sin(theta);
            const cp = Math.cos(phi), sp = Math.sin(phi);
            // Уплощённая морда расширяется к черепу; затылок плавно округляется в туловище.
            // Отрицательная перетяжка отсутствует: площадь шеи не проваливается за головой.
            const tail = 0.13 + 0.87 * smooth((1 - u) / 0.17);
            const tailT = Math.max(0, Math.min(1, (1 - u) / 0.17));
            const baseline = 0.110 + 0.015 * Math.sin(theta * 3 + 0.35) + 0.015 * energy;
            const bodyTube = baseline * tail;
            const bodyDerivative = 0.045 * (TAU + 0.20) * Math.cos(theta * 3 + 0.35) * tail -
                baseline * 0.87 / 0.17 * 6 * tailT * (1 - tailT);
            const profileT = u <= 0.05 ? u / 0.05 : (u - 0.05) / 0.10;
            const blend = smoother(profileT);
            const slope = smootherDerivative(profileT) / (u <= 0.05 ? 0.05 : 0.10);
            const tube = u <= 0.05 ? 0.106 + 0.050 * blend : 0.156 + (bodyTube - 0.156) * blend;
            const depth = u <= 0.05 ? 0.066 + 0.034 * blend : 0.100 + (1.06 * bodyTube - 0.100) * blend;
            const tubeDerivative = u <= 0.05 ? 0.050 * slope :
                bodyDerivative * blend + (bodyTube - 0.156) * slope;
            const depthDerivative = u <= 0.05 ? 0.034 * slope :
                1.06 * bodyDerivative * blend + (1.06 * bodyTube - 0.100) * slope;
            const head = u <= 0.05 ? blend : 1 - blend;
            const radius = 0.85 + 0.022 * Math.sin(theta * 2 + timeSec * 0.11) * (0.4 + energy * 0.6);
            const bodyX = (radius + tube * cp) * c;
            const bodyY = (radius + tube * cp) * s;
            const bodyZ = depth * sp + Math.sin(theta * 2 + timeSec * 0.11) * 0.035;
            // Аналитическая нормаль учитывает продольный наклон каждой поверхности.
            const radiusDerivative = 0.044 * (TAU + 0.20) * Math.cos(theta * 2 + timeSec * 0.11) * (0.4 + energy * 0.6);
            const zDerivative = 0.070 * (TAU + 0.20) * Math.cos(theta * 2 + timeSec * 0.11);
            const tangent = (TAU + 0.20) * (radius + tube * cp);
            const normalRadial = tangent * depth * cp;
            const normalTangent = -(depth * cp * (radiusDerivative + tubeDerivative * cp) +
                tube * sp * (zDerivative + depthDerivative * sp));
            const normalZ = tangent * tube * sp;
            const normalX = normalRadial * c - normalTangent * s;
            const normalY = normalRadial * s + normalTangent * c;
            const normalLength = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);
            const materialize = smooth((morph - (0.08 + h3 * 0.68)) / 0.24);
            x = dx + (bodyX - dx) * materialize;
            y = dy + (bodyY - dy) * materialize;
            z = dz + (bodyZ - dz) * materialize;
            nx = Math.cos(dustAngle) * (1 - materialize) + normalX / normalLength * materialize;
            ny = Math.sin(dustAngle) * (1 - materialize) + normalY / normalLength * materialize;
            nz = 0.12 * (1 - materialize) + normalZ / normalLength * materialize;
            const coreSize = eye ? 2.8 : 1.20 + h4 * 1.05 + head * 0.22;
            size = (0.4 + h4) + (coreSize - (0.4 + h4)) * materialize;
            kind = materialize < 0.5 ? OUROBOROS_KIND_DUST : OUROBOROS_KIND_BODY;
        }
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (length > 1e-12) { nx /= length; ny /= length; nz /= length; }
        else { nx = 0; ny = 0; nz = 1; }
        const offset = i * OUROBOROS_STRIDE;
        target[offset] = interior ? f00 * x + f01 * y + f02 * z : r00 * x + r01 * y + r02 * z;
        target[offset + 1] = interior ? f10 * x + f11 * y + f12 * z : r10 * x + r11 * y + r12 * z;
        target[offset + 2] = r20 * x + r21 * y + r22 * z;
        target[offset + 3] = interior ? f00 * nx + f01 * ny + f02 * nz : r00 * nx + r01 * ny + r02 * nz;
        target[offset + 4] = interior ? f10 * nx + f11 * ny + f12 * nz : r10 * nx + r11 * ny + r12 * nz;
        target[offset + 5] = r20 * nx + r21 * ny + r22 * nz;
        target[offset + 6] = size;
        target[offset + 7] = kind;
    }
    return count;
}
// КОНЕЦ ФУНКЦИИ fillOuroborosPoints
// КОНЕЦ РАЗДЕЛА 2. ЗАПОЛНЕНИЕ ГЕОМЕТРИИ
