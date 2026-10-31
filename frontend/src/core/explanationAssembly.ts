// ============================================================================
// ФАЙЛ: frontend/src/core/explanationAssembly.ts
// НАЗНАЧЕНИЕ: Общие часы и детерминированная геометрия сборки окна путеводителя из пыли сцены.
//             Часть пыли со всех сторон летит к окну и, закручиваясь у цели, ложится на его
//             контур и плоскость; песчинки остаются частью открытого окна, а при закрытии
//             рассыпаются обратно в поле. DOM-окно и Canvas-проход читают одно состояние.
// РАЗДЕЛЫ: 1. Константы и кривые времени; 2. Поле песчинок; 3. Положение песчинки;
//          4. Общее состояние страницы.
// ФУНКЦИИ: smootherstep, getExplanationAssemblyFrame, fraction, buildPanelTargets, buildDirectionWeights,
// buildDustOrigins, buildExplanationDustField, sampleExplanationDustGrain, sampleExplanationDustScatter;
// ExplanationAssemblyState: begin, scatter, end, isActive, getActive, getRemainingTextDelayMs, ensureField, reset.
// Собственного RAF, таймеров и DOM здесь нет: кадр задают renderer и окно.
// ============================================================================

import { resourceLedger } from './resourceLedger';

// НАЧАЛО РАЗДЕЛА 1. КОНСТАНТЫ И КРИВЫЕ ВРЕМЕНИ
/** Полёт песчинок от поля сцены до места окна: отдельный неторопливый визуальный номер. */
export const EXPLANATION_ASSEMBLY_MS = 3600;
/** Окно начинает проявляться, пока последние песчинки плоскости ещё ввинчиваются на место. */
export const EXPLANATION_REVEAL_START_MS = 3000;
export const EXPLANATION_REVEAL_MS = 900;
/** Текст набирается только после того, как окно стало непрозрачным. */
export const EXPLANATION_TEXT_DELAY_MS = EXPLANATION_REVEAL_START_MS + EXPLANATION_REVEAL_MS;
/** Поза окна (прозрачность и поворот) анимируется до этого момента; песчинки остаются, пока окно открыто. */
export const EXPLANATION_TRAIL_DURATION_MS = EXPLANATION_TEXT_DELAY_MS;
/** После закрытия окно рассыпается обратно в поле пыли за это время. */
export const EXPLANATION_SCATTER_MS = 1600;
/** Песчинок на большом экране и на телефоне/узком окне. */
export const EXPLANATION_DUST_COUNT = 560;
export const EXPLANATION_DUST_COUNT_COMPACT = 300;
const MIN_DUST_COUNT = 24;
const MAX_DUST_COUNT = 2000;
/** Доли: контур окна и песчинки из нажатой кнопки. */
const CONTOUR_SHARE = 0.42;
const TRIGGER_SHARE = 0.12;
/** Задержки старта в долях полёта: контур садится первым, затем заполняется плоскость. */
const CONTOUR_DELAY_SHARE = 0.22;
const PLANE_DELAY_MIN_SHARE = 0.12;
export const EXPLANATION_MAX_DELAY_SHARE = 0.4;
/** Изгиб прямого пути: доля расстояния и предел в пикселях. */
const BEND_SHARE = 0.18;
const BEND_MAX_PX = 90;
/** Спираль у цели: с какой доли пути песчинка начинает «ввинчиваться», обороты и радиус. */
export const EXPLANATION_CURL_START = 0.55;
export const EXPLANATION_CURL_TURNS_MIN = 0.6;
export const EXPLANATION_CURL_TURNS_MAX = 1.1;
export const EXPLANATION_CURL_RADIUS_MAX = 26;
/** Песчинки не стартуют «под» окном: старты внутри расширенного прямоугольника окна пропускаются. */
const ORIGIN_CLEARANCE_PX = 24;
/** Рамка из пыли проходит на столько пикселей снаружи окна: панель её не закрывает. */
export const EXPLANATION_CONTOUR_OUTSET_PX = 4;
/** Направление «с пылью»: до ближайшей по углу частицы сцены не больше 2°. */
const DUST_COVER_RAD = Math.PI / 90;
/** Одна частица сцены отдаёт окну около стольких песчинок, не больше: ни одна точка не становится «фонтаном». */
export const EXPLANATION_MAX_GRAINS_PER_PARTICLE = 4;
const TAU = Math.PI * 2;

// НАЧАЛО ФУНКЦИИ smootherstep
/** Квинтическая кривая: нулевые скорость и ускорение на обоих концах (C2). */
export function smootherstep(value: number): number {
    const t = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    return t * t * t * (t * (t * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ smootherstep

export interface ExplanationAssemblyFrame {
    readonly gather: number;
    readonly nativeOpacity: number;
    /** Пыль окна не гаснет: она остаётся контуром и плоскостью, пока окно открыто. */
    readonly dustOpacity: number;
    readonly yaw: number;
    readonly scale: number;
}

// НАЧАЛО ФУНКЦИИ getExplanationAssemblyFrame
/** Один кадр общей шкалы: сбор пыли и проявление окна на её месте. */
export function getExplanationAssemblyFrame(elapsedMs: number): ExplanationAssemblyFrame {
    const time = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    const nativeOpacity = smootherstep((time - EXPLANATION_REVEAL_START_MS) / EXPLANATION_REVEAL_MS);
    return {
        gather: smootherstep(time / EXPLANATION_ASSEMBLY_MS),
        nativeOpacity,
        dustOpacity: 1,
        // Небольшой поворот вокруг Y гаснет вместе с проявлением: плоскость «встаёт» на место.
        yaw: -7 * (1 - nativeOpacity),
        scale: 0.985 + nativeOpacity * 0.015,
    };
}
// КОНЕЦ ФУНКЦИИ getExplanationAssemblyFrame
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ДЕТЕРМИНИРОВАННОЕ ПОЛЕ ПЕСЧИНОК
export interface ExplanationPoint { readonly x: number; readonly y: number; }
export interface ExplanationRect { readonly left: number; readonly top: number; readonly width: number; readonly height: number; }
export interface ExplanationViewport { readonly width: number; readonly height: number; }

/** Флаги песчинки в поле kind. */
export const DUST_KIND_CONTOUR = 1;
export const DUST_KIND_TRIGGER = 2;
export const DUST_KIND_WARM = 4;

export interface ExplanationDustField {
    readonly count: number;
    /** Песчинки 0..contourCount-1 лежат на контуре окна по обходу периметра. */
    readonly contourCount: number;
    /** Центр окна: относительно него старты и цели сопоставлены по направлению. */
    readonly center: ExplanationPoint;
    readonly trigger: ExplanationPoint | null;
    readonly originX: Float64Array;
    readonly originY: Float64Array;
    readonly targetX: Float64Array;
    readonly targetY: Float64Array;
    /** Изгиб прямого пути (пиксели, знак — сторона) и спираль у цели: радиус, фаза, обороты. */
    readonly bend: Float64Array;
    readonly curlRadius: Float64Array;
    readonly curlPhase: Float64Array;
    readonly curlTurns: Float64Array;
    readonly delayMs: Float64Array;
    readonly radius: Float64Array;
    readonly kind: Uint8Array;
}

export interface ExplanationDustInput {
    readonly from: ExplanationRect | null;
    readonly to: ExplanationRect;
    readonly viewport: ExplanationViewport;
    readonly count?: number;
    /** Точки поля сцены; песчинки отделяются от реальных частиц Вселенной (сами частицы остаются). */
    readonly sources?: ArrayLike<{ readonly x: number; readonly y: number }> | null;
}

// НАЧАЛО ФУНКЦИИ fraction
/** Детерминированная дробь [0, 1] без общего PRNG: поле одинаково при каждом открытии. */
function fraction(index: number): number {
    let bits = Math.imul(index + 1, 0x9e3779b1) ^ 0x85ebca6b;
    bits = Math.imul(bits ^ (bits >>> 16), 0x7feb352d);
    return ((bits ^ (bits >>> 15)) >>> 0) / 0xffffffff;
}
// КОНЕЦ ФУНКЦИИ fraction

// НАЧАЛО ФУНКЦИИ buildPanelTargets
/**
 * Контур — по периметру прямоугольника окна, расширенного на EXPLANATION_CONTOUR_OUTSET_PX (по часовой
 * от левого верхнего угла): панель почти непрозрачна, и рамка снаружи остаётся видна, пока окно
 * открыто. Плоскость — неровная решётка внутри окна, под панелью; она снова видна при закрытии.
 */
function buildPanelTargets(to: ExplanationRect, count: number, contourCount: number): { x: Float64Array; y: Float64Array } {
    const x = new Float64Array(count), y = new Float64Array(count);
    const outset = EXPLANATION_CONTOUR_OUTSET_PX;
    const frameLeft = to.left - outset, frameTop = to.top - outset;
    const frameWidth = to.width + outset * 2, frameHeight = to.height + outset * 2;
    const perimeter = 2 * (frameWidth + frameHeight);
    for (let index = 0; index < contourCount; index++) {
        const distance = index / contourCount * perimeter;
        if (distance < frameWidth) { x[index] = frameLeft + distance; y[index] = frameTop; }
        else if (distance < frameWidth + frameHeight) { x[index] = frameLeft + frameWidth; y[index] = frameTop + distance - frameWidth; }
        else if (distance < frameWidth * 2 + frameHeight) {
            x[index] = frameLeft + frameWidth - (distance - frameWidth - frameHeight); y[index] = frameTop + frameHeight;
        }
        else { x[index] = frameLeft; y[index] = frameTop + frameHeight - (distance - frameWidth * 2 - frameHeight); }
    }
    const insetX = Math.min(14, to.width * 0.04);
    const insetY = Math.min(16, to.height * 0.04);
    const left = to.left + insetX, top = to.top + insetY;
    const width = Math.max(1, to.width - insetX * 2), height = Math.max(1, to.height - insetY * 2);
    const planeCount = count - contourCount;
    const columns = Math.max(2, Math.round(Math.sqrt(planeCount * width / height)));
    const rows = Math.max(1, Math.ceil(planeCount / columns));
    for (let plane = 0; plane < planeCount; plane++) {
        const index = contourCount + plane;
        const jitterX = (fraction(index * 5 + 3) - 0.5) * 0.7;
        const jitterY = (fraction(index * 5 + 4) - 0.5) * 0.7;
        const column = plane % columns, row = Math.floor(plane / columns);
        x[index] = left + Math.min(1, Math.max(0, (column + 0.5 + jitterX) / columns)) * width;
        y[index] = top + Math.min(1, Math.max(0, (row + 0.5 + jitterY) / rows)) * height;
    }
    return { x, y };
}
// КОНЕЦ ФУНКЦИИ buildPanelTargets

// НАЧАЛО ФУНКЦИИ buildDirectionWeights
/**
 * Вес частицы сцены — её доля направлений вокруг окна: половины промежутков до соседей по углу,
 * каждая не больше DUST_COVER_RAD, так что пустой сектор у края экрана почти не засчитывается.
 * Вес ограничен сверху так, чтобы одна частица отдавала не больше EXPLANATION_MAX_GRAINS_PER_PARTICLE
 * песчинок; если частиц слишком мало и для этого, все веса равны.
 */
function buildDirectionWeights(candidates: readonly { readonly angle: number }[], fieldCount: number): Float64Array {
    const count = candidates.length;
    const cells = new Float64Array(count);
    for (let index = 0; index < count; index++) {
        const next = index + 1 < count ? candidates[index + 1].angle : candidates[0].angle + TAU;
        const half = Math.min(DUST_COVER_RAD, (next - candidates[index].angle) / 2);
        cells[index] += half;
        cells[(index + 1) % count] += half;
    }
    // Песчинок у самой «весомой» частицы при пределе веса limit; растёт вместе с limit.
    const busiest = (limit: number): number => {
        let sum = 0;
        for (let index = 0; index < count; index++) sum += Math.min(cells[index], limit);
        return sum > 0 ? fieldCount * limit / sum : Infinity;
    };
    let low = 0, high = 0;
    for (let index = 0; index < count; index++) high = Math.max(high, cells[index]);
    if (busiest(high) <= EXPLANATION_MAX_GRAINS_PER_PARTICLE) low = high;
    else for (let step = 0; step < 40; step++) {
        const middle = (low + high) / 2;
        if (busiest(middle) <= EXPLANATION_MAX_GRAINS_PER_PARTICLE) low = middle; else high = middle;
    }
    for (let index = 0; index < count; index++) cells[index] = low > 0 ? Math.min(cells[index], low) : 1;
    return cells;
}
// КОНЕЦ ФУНКЦИИ buildDirectionWeights

// НАЧАЛО ФУНКЦИИ buildDustOrigins
/**
 * Старты «со всех сторон»: направления вокруг окна распределены равномерно, но только там, где
 * в сцене есть пыль. Окно у края экрана не получает «фонтанов» из одной крайней частицы на
 * пустой стороне, а скопление частиц делится между соседними направлениями. Частицы не
 * исчезают — песчинка лишь стартует из их текущей точки. Часть песчинок вылетает из нажатой
 * кнопки. Без частиц (тест, ранний кадр) — кольцо вокруг окна за краем поля.
 */
function buildDustOrigins(input: ExplanationDustInput, count: number, triggerCount: number,
    center: ExplanationPoint): { x: Float64Array; y: Float64Array } {
    const x = new Float64Array(count), y = new Float64Array(count);
    const { width, height } = input.viewport;
    const { from, to } = input;
    const candidates: { angle: number; x: number; y: number }[] = [];
    const sources = input.sources;
    if (sources) {
        for (let index = 0; index < sources.length; index++) {
            const point = sources[index];
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
                point.x < -40 || point.x > width + 40 || point.y < -40 || point.y > height + 40) continue;
            const underPanel = point.x > to.left - ORIGIN_CLEARANCE_PX && point.x < to.left + to.width + ORIGIN_CLEARANCE_PX &&
                point.y > to.top - ORIGIN_CLEARANCE_PX && point.y < to.top + to.height + ORIGIN_CLEARANCE_PX;
            if (!underPanel) candidates.push({ angle: Math.atan2(point.y - center.y, point.x - center.x), x: point.x, y: point.y });
        }
        candidates.sort((a, b) => a.angle - b.angle);
    }
    const fieldCount = count - triggerCount;
    const useSources = candidates.length >= Math.min(fieldCount, 12);
    const weights = useSources ? buildDirectionWeights(candidates, fieldCount) : null;
    let total = 0;
    if (weights) for (let index = 0; index < weights.length; index++) total += weights[index];
    let candidate = 0, cumulative = weights ? weights[0] : 0;
    const ringRadius = Math.hypot(width, height) * 0.55;
    for (let index = 0; index < count; index++) {
        if (from && index < triggerCount) {
            x[index] = from.left + from.width / 2 + (fraction(index + 59) - 0.5) * from.width * 0.9;
            y[index] = from.top + from.height / 2 + (fraction(index + 83) - 0.5) * from.height * 0.9;
            continue;
        }
        const fieldIndex = index - triggerCount;
        // Равномерные доли круга с детерминированным сдвигом: пыль приходит со всех сторон.
        const share = (fieldIndex + 0.25 + fraction(index * 7 + 17) * 0.5) / Math.max(1, fieldCount);
        if (weights) {
            // Доли растут вместе с fieldIndex, поэтому частицы по углу проходятся один раз за всё поле.
            const position = share * total;
            while (candidate < weights.length - 1 && cumulative <= position) cumulative += weights[++candidate];
            x[index] = candidates[candidate].x;
            y[index] = candidates[candidate].y;
            continue;
        }
        const angle = -Math.PI + share * TAU;
        const r = ringRadius * (0.7 + 0.3 * fraction(index * 11 + 43));
        x[index] = center.x + Math.cos(angle) * r;
        y[index] = center.y + Math.sin(angle) * r;
    }
    return { x, y };
}
// КОНЕЦ ФУНКЦИИ buildDustOrigins

// НАЧАЛО ФУНКЦИИ buildExplanationDustField
/**
 * Песчинка i всегда садится в точку окна i. Старты и цели сопоставляются по направлению от центра
 * окна: пыль с каждой стороны летит к ближней к ней части окна, потоки не пересекаются и не
 * образуют общего вихря. Изгиб, спираль и задержка у каждой песчинки свои.
 */
export function buildExplanationDustField(input: ExplanationDustInput): ExplanationDustField {
    const requested = Number.isFinite(input.count) ? Math.round(input.count!) : EXPLANATION_DUST_COUNT;
    const count = Math.max(MIN_DUST_COUNT, Math.min(MAX_DUST_COUNT, requested));
    const contourCount = Math.round(count * CONTOUR_SHARE);
    const triggerCount = input.from ? Math.round(count * TRIGGER_SHARE) : 0;
    const center = { x: input.to.left + input.to.width / 2, y: input.to.top + input.to.height / 2 };
    const targets = buildPanelTargets(input.to, count, contourCount);
    const origins = buildDustOrigins(input, count, triggerCount, center);

    // Сопоставление по углу: k-я по направлению цель получает k-й по направлению старт.
    const angleOrder = (xs: Float64Array, ys: Float64Array): number[] => Array.from({ length: count }, (_, index) => index)
        .map((index) => ({ index, angle: Math.atan2(ys[index] - center.y, xs[index] - center.x) }))
        .sort((a, b) => a.angle - b.angle || a.index - b.index)
        .map((entry) => entry.index);
    const byOrigin = angleOrder(origins.x, origins.y);
    const byTarget = angleOrder(targets.x, targets.y);

    const field: ExplanationDustField = {
        count, contourCount, center,
        trigger: input.from ? { x: input.from.left + input.from.width / 2, y: input.from.top + input.from.height / 2 } : null,
        originX: new Float64Array(count), originY: new Float64Array(count),
        targetX: targets.x, targetY: targets.y,
        bend: new Float64Array(count), curlRadius: new Float64Array(count),
        curlPhase: new Float64Array(count), curlTurns: new Float64Array(count),
        delayMs: new Float64Array(count), radius: new Float64Array(count), kind: new Uint8Array(count),
    };
    for (let rank = 0; rank < count; rank++) {
        const target = byTarget[rank];
        const origin = byOrigin[rank];
        const ox = origins.x[origin], oy = origins.y[origin];
        field.originX[target] = ox;
        field.originY[target] = oy;
        const distance = Math.hypot(targets.x[target] - ox, targets.y[target] - oy);
        // Мягкая дуга вправо или влево: соседние потоки изгибаются по-разному, как струйки пыли.
        field.bend[target] = (fraction(target * 3 + 7) - 0.5) * 2 * Math.min(BEND_MAX_PX, distance * BEND_SHARE);
        field.curlRadius[target] = Math.min(EXPLANATION_CURL_RADIUS_MAX, 4 + distance * 0.12) * (0.6 + 0.4 * fraction(target * 13 + 5));
        field.curlPhase[target] = fraction(target * 17 + 3) * TAU;
        field.curlTurns[target] = EXPLANATION_CURL_TURNS_MIN +
            (EXPLANATION_CURL_TURNS_MAX - EXPLANATION_CURL_TURNS_MIN) * fraction(target * 19 + 11);
        const fromTrigger = input.from !== null && origin < triggerCount;
        const contour = target < contourCount;
        field.kind[target] = (contour ? DUST_KIND_CONTOUR : 0) | (fromTrigger ? DUST_KIND_TRIGGER : 0) |
            (target % 9 === 4 ? DUST_KIND_WARM : 0);
        // Песок из кнопки стартует сразу (отклик на нажатие); контур — раньше плоскости.
        const delayShare = fromTrigger ? fraction(target + 151) * 0.06
            : contour ? fraction(target + 151) * CONTOUR_DELAY_SHARE
                : PLANE_DELAY_MIN_SHARE + fraction(target + 151) * (EXPLANATION_MAX_DELAY_SHARE - PLANE_DELAY_MIN_SHARE);
        field.delayMs[target] = delayShare * EXPLANATION_ASSEMBLY_MS;
        field.radius[target] = (contour ? 1.05 : 0.75) + fraction(target + 251) * (contour ? 0.85 : 0.6);
    }
    return field;
}
// КОНЕЦ ФУНКЦИИ buildExplanationDustField
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ПОЛОЖЕНИЕ ПЕСЧИНКИ БЕЗ ВЫДЕЛЕНИЯ ПАМЯТИ
export interface ExplanationGrainSample { x: number; y: number; progress: number; }

// НАЧАЛО ФУНКЦИИ sampleExplanationDustGrain
/**
 * Песчинка летит к своей точке напрямую по мягкой дуге, а на последних 45% пути закручивается
 * вокруг цели спиралью убывающего радиуса и «ввинчивается» на место. Обе части гладкие:
 * скорость и ускорение нулевые при отрыве и при посадке (квинтическая кривая и sin³).
 * Результат пишется в out, чтобы кадр с сотнями песчинок не создавал мусор для GC.
 */
export function sampleExplanationDustGrain(field: ExplanationDustField, index: number, elapsedMs: number,
    out: ExplanationGrainSample): ExplanationGrainSample {
    const delay = field.delayMs[index];
    const time = Number.isFinite(elapsedMs) ? elapsedMs : 0;
    const progress = smootherstep((time - delay) / Math.max(1, EXPLANATION_ASSEMBLY_MS - delay));
    out.progress = progress;
    const ox = field.originX[index], oy = field.originY[index];
    const tx = field.targetX[index], ty = field.targetY[index];
    if (progress <= 0) { out.x = ox; out.y = oy; return out; }
    if (progress >= 1) { out.x = tx; out.y = ty; return out; }
    const dx = tx - ox, dy = ty - oy;
    const distance = Math.hypot(dx, dy);
    const bend = field.bend[index] * Math.sin(Math.PI * progress);
    let x = ox + dx * progress + (distance > 0 ? -dy / distance : 0) * bend;
    let y = oy + dy * progress + (distance > 0 ? dx / distance : 0) * bend;
    const curl = (progress - EXPLANATION_CURL_START) / (1 - EXPLANATION_CURL_START);
    if (curl > 0) {
        const swell = Math.sin(Math.PI * curl);
        const rho = field.curlRadius[index] * swell * swell * swell;
        // Все песчинки ввинчиваются в одну сторону — против часовой стрелки на экране.
        const phi = field.curlPhase[index] - TAU * field.curlTurns[index] * curl;
        x += rho * Math.cos(phi);
        y += rho * Math.sin(phi);
    }
    out.x = x;
    out.y = y;
    return out;
}
// КОНЕЦ ФУНКЦИИ sampleExplanationDustGrain

// НАЧАЛО ФУНКЦИИ sampleExplanationDustScatter
/**
 * Рассыпание после закрытия: песчинка возвращается туда, откуда пришла, по обратной дуге —
 * из точки окна или, если окно закрыли во время сборки, из того места полёта, где она была
 * в момент закрытия (closedAtMs — время сборки на этот момент). Плоскость уходит первой,
 * контур — последним. progress — доля обратного пути (0..1).
 */
export function sampleExplanationDustScatter(field: ExplanationDustField, index: number, scatterElapsedMs: number,
    closedAtMs: number, out: ExplanationGrainSample): ExplanationGrainSample {
    const contour = index < field.contourCount;
    const delay = (contour ? 0.1 + fraction(index + 401) * 0.2 : fraction(index + 401) * 0.15) * EXPLANATION_SCATTER_MS;
    const time = Number.isFinite(scatterElapsedMs) ? scatterElapsedMs : 0;
    const progress = smootherstep((time - delay) / Math.max(1, EXPLANATION_SCATTER_MS - delay));
    sampleExplanationDustGrain(field, index, Number.isFinite(closedAtMs) ? closedAtMs : EXPLANATION_ASSEMBLY_MS, out);
    out.progress = progress;
    const sx = out.x, sy = out.y;
    const ox = field.originX[index], oy = field.originY[index];
    if (progress <= 0) return out;
    if (progress >= 1) { out.x = ox; out.y = oy; return out; }
    const dx = ox - sx, dy = oy - sy;
    const distance = Math.hypot(dx, dy);
    // Изгиб пропорционален оставшемуся пути: песчинка, не успевшая далеко улететь, возвращается почти прямо.
    const flight = Math.hypot(field.targetX[index] - ox, field.targetY[index] - oy);
    const bend = -0.6 * field.bend[index] * (flight > 0 ? distance / flight : 0) * Math.sin(Math.PI * progress);
    out.x = sx + dx * progress + (distance > 0 ? -dy / distance : 0) * bend;
    out.y = sy + dy * progress + (distance > 0 ? dx / distance : 0) * bend;
    return out;
}
// КОНЕЦ ФУНКЦИИ sampleExplanationDustScatter
// КОНЕЦ РАЗДЕЛА 3

// НАЧАЛО РАЗДЕЛА 4. ОДНА АКТИВНАЯ СБОРКА НА СТРАНИЦУ
export interface ExplanationAssemblySpec {
    readonly from: ExplanationRect | null;
    readonly to: ExplanationRect;
    readonly viewport: ExplanationViewport;
    readonly startMs: number;
    readonly count: number;
}
interface ActiveAssembly {
    readonly token: number;
    readonly spec: ExplanationAssemblySpec;
    field: ExplanationDustField | null;
    /** Момент закрытия окна: с него песчинки рассыпаются обратно в поле; null — окно открыто. */
    scatterStartMs: number | null;
    /** Время сборки на момент закрытия: рассыпание начинается с того кадра, который был на экране. */
    closedAtMs: number;
}

export class ExplanationAssemblyState {
    private active: ActiveAssembly | null = null;
    private nextToken = 1;

    // НАЧАЛО ФУНКЦИИ begin
    /** Новая сборка заменяет прежнюю (и её рассыпание); поле строится лениво на первом кадре renderer. */
    public begin(spec: ExplanationAssemblySpec): number {
        this.end(this.active?.token ?? -1);
        const token = this.nextToken++;
        this.active = { token, spec, field: null, scatterStartMs: null, closedAtMs: 0 };
        return token;
    }
    // КОНЕЦ ФУНКЦИИ begin

    // НАЧАЛО ФУНКЦИИ scatter
    /** Окно закрыто: песчинки своей сборки начинают рассыпаться; освобождает их renderer по окончании. */
    public scatter(token: number, nowMs: number): void {
        if (!this.active || this.active.token !== token || this.active.scatterStartMs !== null) return;
        if (!Number.isFinite(nowMs) || !this.active.field) { this.end(token); return; }
        this.active.scatterStartMs = nowMs;
        this.active.closedAtMs = Math.max(0, nowMs - this.active.spec.startMs);
    }
    // КОНЕЦ ФУНКЦИИ scatter

    // НАЧАЛО ФУНКЦИИ end
    /** Освобождает только свою сборку: поздний cleanup старого окна не гасит новую. */
    public end(token: number): void {
        if (!this.active || this.active.token !== token) return;
        if (this.active.field) resourceLedger.trackPageLifetimeRelease('buffers', 1);
        this.active = null;
    }
    // КОНЕЦ ФУНКЦИИ end

    // НАЧАЛО ФУНКЦИИ isActive
    public isActive(): boolean { return this.active !== null; }
    // КОНЕЦ ФУНКЦИИ isActive

    // НАЧАЛО ФУНКЦИИ getActive
    public getActive(): Readonly<{ token: number; spec: ExplanationAssemblySpec; field: ExplanationDustField | null;
        scatterStartMs: number | null; closedAtMs: number }> | null {
        return this.active;
    }
    // КОНЕЦ ФУНКЦИИ getActive

    // НАЧАЛО ФУНКЦИИ getRemainingTextDelayMs
    /** Сколько ещё ждать набору текста, чтобы он не начался под невидимым окном. */
    public getRemainingTextDelayMs(nowMs: number): number {
        if (!this.active || this.active.scatterStartMs !== null || !Number.isFinite(nowMs)) return 0;
        return Math.max(0, EXPLANATION_TEXT_DELAY_MS - Math.max(0, nowMs - this.active.spec.startMs));
    }
    // КОНЕЦ ФУНКЦИИ getRemainingTextDelayMs

    // НАЧАЛО ФУНКЦИИ ensureField
    /** Первый кадр после нажатия берёт текущие координаты частиц сцены. */
    public ensureField(sources?: ArrayLike<{ readonly x: number; readonly y: number }> | null): ExplanationDustField | null {
        if (!this.active) return null;
        if (!this.active.field) {
            const { from, to, viewport, count } = this.active.spec;
            this.active.field = buildExplanationDustField({ from, to, viewport, count, sources });
            resourceLedger.trackPageLifetimeAllocation('buffers', 1);
        }
        return this.active.field;
    }
    // КОНЕЦ ФУНКЦИИ ensureField

    // НАЧАЛО ФУНКЦИИ reset
    public reset(): void { this.end(this.active?.token ?? -1); }
    // КОНЕЦ ФУНКЦИИ reset
}

export const explanationAssembly = new ExplanationAssemblyState();
// КОНЕЦ РАЗДЕЛА 4
