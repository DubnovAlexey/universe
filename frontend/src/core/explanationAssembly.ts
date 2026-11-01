// ============================================================================
// ФАЙЛ: frontend/src/core/explanationAssembly.ts
// НАЗНАЧЕНИЕ: Общие часы и детерминированная геометрия сборки окна путеводителя из пыли сцены.
//             Пыль всего облака вихрем в форме окна стягивается в его плоскость; пока окно
//             проявляется, пыль впитывается в него, а при закрытии окно рассыпается обратно
//             в облако. DOM-окно и Canvas-проход читают одно состояние.
// РАЗДЕЛЫ: 1. Константы и кривые времени; 2. Поле песчинок; 3. Положение песчинки;
//          4. Общее состояние страницы.
// ФУНКЦИИ: smootherstep, getExplanationAssemblyFrame, fraction, wrapAngle, buildPanelTargets, buildDustOrigins,
// buildExplanationDustField, swirlEase, writeSwirlPoint, sampleExplanationDustGrain, sampleExplanationDustScatter;
// ExplanationAssemblyState: begin, scatter, end, isActive, getActive, getRemainingTextDelayMs, ensureField, reset.
// Собственного RAF, таймеров и DOM здесь нет: кадр задают renderer и окно.
// ============================================================================

import { resourceLedger } from './resourceLedger';

// НАЧАЛО РАЗДЕЛА 1. КОНСТАНТЫ И КРИВЫЕ ВРЕМЕНИ
/** Вся сборка: к этому моменту села последняя песчинка. Отдельный неторопливый визуальный номер. */
export const EXPLANATION_ASSEMBLY_MS = 3600;
/** Полёт одной песчинки; старты разнесены на EXPLANATION_ASSEMBLY_MS − EXPLANATION_FLIGHT_MS, посадки — тоже. */
export const EXPLANATION_FLIGHT_MS = 2400;
/** Окно проявляется, пока садятся последние песчинки; пыль при этом впитывается в него. */
export const EXPLANATION_REVEAL_START_MS = 3000;
export const EXPLANATION_REVEAL_MS = 900;
/** Текст набирается только после того, как окно стало непрозрачным. */
export const EXPLANATION_TEXT_DELAY_MS = EXPLANATION_REVEAL_START_MS + EXPLANATION_REVEAL_MS;
/** Поза окна (прозрачность и поворот) анимируется до этого момента; дальше на экране только само окно. */
export const EXPLANATION_TRAIL_DURATION_MS = EXPLANATION_TEXT_DELAY_MS;
/** После закрытия окно рассыпается обратно в облако за это время. */
export const EXPLANATION_SCATTER_MS = 1600;
/** Песчинок на большом экране и на телефоне/узком окне. */
export const EXPLANATION_DUST_COUNT = 1000;
export const EXPLANATION_DUST_COUNT_COMPACT = 520;
const MIN_DUST_COUNT = 24;
const MAX_DUST_COUNT = 2400;
/** Доля песчинок, вылетающих из нажатой кнопки: мгновенный отклик на нажатие. */
const TRIGGER_SHARE = 0.1;
/** Доля песчинок, садящихся на видимую рамку окна; остальные ложатся на его поверхность. */
const FRAME_SHARE = 0.3;
/** Рамка по SVG-контуру панели: не меньше стольких точек, иначе берётся прямоугольник окна. */
const MIN_OUTLINE_POINTS = 8;
/** Мягкий вихрь: каждая песчинка проворачивается вокруг центра окна примерно на столько оборотов, по часовой стрелке. */
export const EXPLANATION_SWIRL_TURNS = 0.3;
/** Выпуклость углового хода: основное вращение — в конце пути, у окна («глаз вихря»). */
const SWIRL_EASING = 2.2;
const SWIRL_EASE_NORM = Math.expm1(SWIRL_EASING);
/** Песчинки не стартуют «под» окном: частицы внутри расширенного прямоугольника окна пропускаются. */
const ORIGIN_CLEARANCE_PX = 24;
/** Песчинка отрывается в пределах этого радиуса от частицы: облако осыпается, а не стреляет из точек. */
const ORIGIN_SCATTER_PX = 10;
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
    /** Пыль впитывается в окно по мере его проявления: после проявления на экране только окно, без рамок и точек. */
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
        dustOpacity: 1 - nativeOpacity,
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
export const DUST_KIND_TRIGGER = 2;
export const DUST_KIND_WARM = 4;

export interface ExplanationDustField {
    readonly count: number;
    /** Песчинки 0..frameCount−1 садятся на видимую рамку окна; остальные — на его поверхность. */
    readonly frameCount: number;
    /** Центр окна — глаз вихря. */
    readonly center: ExplanationPoint;
    /**
     * Полуоси окна: вихрь строится в координатах, где окно — квадрат со стороной 2, и повторяет его форму.
     * Поэтому витки у окна, прижатого к краю экрана, не уходят за край.
     */
    readonly halfWidth: number;
    readonly halfHeight: number;
    readonly trigger: ExplanationPoint | null;
    readonly originX: Float64Array;
    readonly originY: Float64Array;
    readonly targetX: Float64Array;
    readonly targetY: Float64Array;
    /** Полярные координаты старта и цели в нормированном пространстве окна и полный угол вихря (всегда > 0). */
    readonly startRadius: Float64Array;
    readonly startAngle: Float64Array;
    readonly endRadius: Float64Array;
    readonly swirlAngle: Float64Array;
    readonly delayMs: Float64Array;
    readonly radius: Float64Array;
    readonly kind: Uint8Array;
}

export interface ExplanationDustInput {
    readonly from: ExplanationRect | null;
    readonly to: ExplanationRect;
    readonly viewport: ExplanationViewport;
    readonly count?: number;
    /** Точки облака сцены; песчинки отделяются от реальных частиц Вселенной (сами частицы остаются). */
    readonly sources?: ArrayLike<{ readonly x: number; readonly y: number }> | null;
    /** Видимая рамка окна (замкнутая ломаная в координатах экрана); без неё — прямоугольник с отступом. */
    readonly outline?: ArrayLike<ExplanationPoint> | null;
}

// НАЧАЛО ФУНКЦИИ fraction
/** Детерминированная дробь [0, 1] без общего PRNG: поле одинаково при каждом открытии. */
function fraction(index: number): number {
    let bits = Math.imul(index + 1, 0x9e3779b1) ^ 0x85ebca6b;
    bits = Math.imul(bits ^ (bits >>> 16), 0x7feb352d);
    return ((bits ^ (bits >>> 15)) >>> 0) / 0xffffffff;
}
// КОНЕЦ ФУНКЦИИ fraction

// НАЧАЛО ФУНКЦИИ wrapAngle
/** Угол в (−π, π]. */
function wrapAngle(angle: number): number {
    const wrapped = angle - TAU * Math.floor((angle + Math.PI) / TAU);
    return wrapped <= -Math.PI ? wrapped + TAU : wrapped;
}
// КОНЕЦ ФУНКЦИИ wrapAngle

// НАЧАЛО ФУНКЦИИ buildPanelTargets
/**
 * Пыль собирается в само окно: песчинки 0..frameCount−1 садятся равномерно по длине его видимой рамки
 * (волнистого SVG-контура панели), остальные — неровной решёткой на поверхность. Когда окно проявляется,
 * пыльная рамка совпадает с настоящей и растворяется в ней; лишней обводки вокруг окна нет.
 * Без контура (тест, ранний кадр) рамка — прямоугольник окна с отступом, как у волнистого края.
 */
function buildPanelTargets(to: ExplanationRect, count: number, frameCount: number,
    outline: ArrayLike<ExplanationPoint> | null | undefined): { x: Float64Array; y: Float64Array } {
    const x = new Float64Array(count), y = new Float64Array(count);
    const insetX = Math.min(14, to.width * 0.04);
    const insetY = Math.min(16, to.height * 0.04);
    const left = to.left + insetX, top = to.top + insetY;
    const width = Math.max(1, to.width - insetX * 2), height = Math.max(1, to.height - insetY * 2);
    const polyline: ExplanationPoint[] = [];
    if (outline && outline.length >= MIN_OUTLINE_POINTS) {
        for (let index = 0; index < outline.length; index++) {
            const point = outline[index];
            if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) polyline.push({ x: point.x, y: point.y });
        }
    }
    if (polyline.length < MIN_OUTLINE_POINTS) {
        polyline.length = 0;
        polyline.push({ x: left, y: top }, { x: left + width, y: top }, { x: left + width, y: top + height }, { x: left, y: top + height });
    }
    // Равномерно по длине замкнутой ломаной: песчинки рамки стоят с одинаковым шагом и на волнах края.
    const lengths: number[] = [];
    let perimeter = 0;
    for (let index = 0; index < polyline.length; index++) {
        const a = polyline[index], b = polyline[(index + 1) % polyline.length];
        const segment = Math.hypot(b.x - a.x, b.y - a.y);
        lengths.push(segment);
        perimeter += segment;
    }
    let segmentIndex = 0, segmentStart = 0;
    for (let index = 0; index < frameCount; index++) {
        const distance = perimeter > 0 ? index / frameCount * perimeter : 0;
        while (segmentIndex < lengths.length - 1 && segmentStart + lengths[segmentIndex] < distance) {
            segmentStart += lengths[segmentIndex];
            segmentIndex++;
        }
        const a = polyline[segmentIndex], b = polyline[(segmentIndex + 1) % polyline.length];
        const t = lengths[segmentIndex] > 0 ? Math.min(1, Math.max(0, (distance - segmentStart) / lengths[segmentIndex])) : 0;
        x[index] = a.x + (b.x - a.x) * t;
        y[index] = a.y + (b.y - a.y) * t;
    }
    const surfaceCount = count - frameCount;
    const columns = Math.max(2, Math.round(Math.sqrt(surfaceCount * width / height)));
    const rows = Math.max(1, Math.ceil(surfaceCount / columns));
    for (let surface = 0; surface < surfaceCount; surface++) {
        const index = frameCount + surface;
        const jitterX = (fraction(index * 5 + 3) - 0.5) * 0.8;
        const jitterY = (fraction(index * 5 + 4) - 0.5) * 0.8;
        const column = surface % columns, row = Math.floor(surface / columns);
        x[index] = left + Math.min(1, Math.max(0, (column + 0.5 + jitterX) / columns)) * width;
        y[index] = top + Math.min(1, Math.max(0, (row + 0.5 + jitterY) / rows)) * height;
    }
    return { x, y };
}
// КОНЕЦ ФУНКЦИИ buildPanelTargets

// НАЧАЛО ФУНКЦИИ buildDustOrigins
/**
 * Старты — всё облако: каждая видимая частица сцены вне окна отдаёт поровну песчинок (по одной-две),
 * в пределах ORIGIN_SCATTER_PX от себя, поэтому пыль стягивается отовсюду, где есть облако, а не из
 * нескольких точек. Часть песчинок вылетает из нажатой кнопки. Без частиц (тест, ранний кадр) —
 * кольцо вокруг окна за краем поля.
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
        // Порядок по углу держит соседние песчинки рядом и в вихре: потоки не перекрещиваются.
        candidates.sort((a, b) => a.angle - b.angle);
    }
    const fieldCount = count - triggerCount;
    const useSources = candidates.length >= Math.min(fieldCount, 12);
    const ringRadius = Math.hypot(width, height) * 0.55;
    for (let index = 0; index < count; index++) {
        if (from && index < triggerCount) {
            x[index] = from.left + from.width / 2 + (fraction(index + 59) - 0.5) * from.width * 0.9;
            y[index] = from.top + from.height / 2 + (fraction(index + 83) - 0.5) * from.height * 0.9;
            continue;
        }
        const fieldIndex = index - triggerCount;
        const share = (fieldIndex + 0.25 + fraction(index * 7 + 17) * 0.5) / Math.max(1, fieldCount);
        if (useSources) {
            const particle = candidates[Math.min(candidates.length - 1, Math.floor(share * candidates.length))];
            const scatterAngle = fraction(index * 13 + 29) * TAU;
            const scatterRadius = ORIGIN_SCATTER_PX * Math.sqrt(fraction(index * 17 + 31));
            x[index] = particle.x + Math.cos(scatterAngle) * scatterRadius;
            y[index] = particle.y + Math.sin(scatterAngle) * scatterRadius;
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
 * Песчинка i всегда садится в точку окна i. Старты и цели сопоставлены по углу вокруг центра окна со
 * сдвигом на угол вихря: каждая песчинка проворачивается примерно на EXPLANATION_SWIRL_TURNS оборота в
 * одну сторону, и всё облако закручивается в окно как один вихрь. Углы считаются в нормированных
 * координатах окна, поэтому вихрь повторяет его форму.
 */
export function buildExplanationDustField(input: ExplanationDustInput): ExplanationDustField {
    const requested = Number.isFinite(input.count) ? Math.round(input.count!) : EXPLANATION_DUST_COUNT;
    const count = Math.max(MIN_DUST_COUNT, Math.min(MAX_DUST_COUNT, requested));
    const triggerCount = input.from ? Math.round(count * TRIGGER_SHARE) : 0;
    const frameCount = Math.round(count * FRAME_SHARE);
    const center = { x: input.to.left + input.to.width / 2, y: input.to.top + input.to.height / 2 };
    const halfWidth = Math.max(1, input.to.width / 2), halfHeight = Math.max(1, input.to.height / 2);
    const targets = buildPanelTargets(input.to, count, frameCount, input.outline);
    const origins = buildDustOrigins(input, count, triggerCount, center);
    const swirl = EXPLANATION_SWIRL_TURNS * TAU;
    const angleOf = (x: number, y: number): number => Math.atan2((y - center.y) / halfHeight, (x - center.x) / halfWidth);

    // k-й по углу старт получает k-ю по углу цель, повёрнутую назад на угол вихря.
    const order = (angle: (index: number) => number): number[] => Array.from({ length: count }, (_, index) => index)
        .map((index) => ({ index, angle: angle(index) }))
        .sort((a, b) => a.angle - b.angle || a.index - b.index)
        .map((entry) => entry.index);
    const byOrigin = order((index) => angleOf(origins.x[index], origins.y[index]));
    const byTarget = order((index) => wrapAngle(angleOf(targets.x[index], targets.y[index]) - swirl));

    const field: ExplanationDustField = {
        count, frameCount, center, halfWidth, halfHeight,
        trigger: input.from ? { x: input.from.left + input.from.width / 2, y: input.from.top + input.from.height / 2 } : null,
        originX: new Float64Array(count), originY: new Float64Array(count),
        targetX: targets.x, targetY: targets.y,
        startRadius: new Float64Array(count), startAngle: new Float64Array(count),
        endRadius: new Float64Array(count), swirlAngle: new Float64Array(count),
        delayMs: new Float64Array(count), radius: new Float64Array(count), kind: new Uint8Array(count),
    };
    for (let rank = 0; rank < count; rank++) {
        const target = byTarget[rank];
        const origin = byOrigin[rank];
        const ox = origins.x[origin], oy = origins.y[origin];
        field.originX[target] = ox;
        field.originY[target] = oy;
        const u0 = (ox - center.x) / halfWidth, v0 = (oy - center.y) / halfHeight;
        const u1 = (targets.x[target] - center.x) / halfWidth, v1 = (targets.y[target] - center.y) / halfHeight;
        const startAngle = Math.atan2(v0, u0);
        field.startRadius[target] = Math.hypot(u0, v0);
        field.startAngle[target] = startAngle;
        field.endRadius[target] = Math.hypot(u1, v1);
        // Полный угол ≡ (конец − начало) по модулю 2π и близок к углу вихря; всегда по часовой стрелке.
        let travel = swirl + wrapAngle(Math.atan2(v1, u1) - startAngle - swirl);
        if (travel <= 0.15) travel += TAU;
        field.swirlAngle[target] = travel;
        const fromTrigger = input.from !== null && origin < triggerCount;
        field.kind[target] = (fromTrigger ? DUST_KIND_TRIGGER : 0) | (target % 7 === 3 ? DUST_KIND_WARM : 0);
        // Песок из кнопки стартует сразу (отклик на нажатие), облако — вразнобой: посадки рассыпаны по времени.
        field.delayMs[target] = (fromTrigger ? fraction(target + 151) * 0.2 : fraction(target + 151)) *
            (EXPLANATION_ASSEMBLY_MS - EXPLANATION_FLIGHT_MS);
        field.radius[target] = 1.2 + fraction(target + 251) * 1.0;
    }
    return field;
}
// КОНЕЦ ФУНКЦИИ buildExplanationDustField
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ПОЛОЖЕНИЕ ПЕСЧИНКИ БЕЗ ВЫДЕЛЕНИЯ ПАМЯТИ
export interface ExplanationGrainSample { x: number; y: number; progress: number; }

// НАЧАЛО ФУНКЦИИ swirlEase
/** Доля угла вихря на доле пути p: выпуклая кривая — издалека почти прямо, у окна — основное вращение. */
function swirlEase(progress: number): number {
    return Math.expm1(SWIRL_EASING * progress) / SWIRL_EASE_NORM;
}
// КОНЕЦ ФУНКЦИИ swirlEase

// НАЧАЛО ФУНКЦИИ writeSwirlPoint
/** Точка спирали на доле пути progress: радиус убывает линейно, угол нарастает по swirlEase. */
function writeSwirlPoint(field: ExplanationDustField, index: number, progress: number, out: ExplanationGrainSample): void {
    const rho = field.startRadius[index] + (field.endRadius[index] - field.startRadius[index]) * progress;
    const angle = field.startAngle[index] + field.swirlAngle[index] * swirlEase(progress);
    out.x = field.center.x + field.halfWidth * rho * Math.cos(angle);
    out.y = field.center.y + field.halfHeight * rho * Math.sin(angle);
}
// КОНЕЦ ФУНКЦИИ writeSwirlPoint

// НАЧАЛО ФУНКЦИИ sampleExplanationDustGrain
/**
 * Песчинка летит EXPLANATION_FLIGHT_MS по спирали вихря от своей частицы облака к своей точке окна.
 * Ход по пути — квинтическая кривая: нулевые скорость и ускорение при отрыве и при посадке, старт и
 * финиш точные. Результат пишется в out, чтобы кадр с тысячей песчинок не создавал мусор для GC.
 */
export function sampleExplanationDustGrain(field: ExplanationDustField, index: number, elapsedMs: number,
    out: ExplanationGrainSample): ExplanationGrainSample {
    const time = Number.isFinite(elapsedMs) ? elapsedMs : 0;
    const progress = smootherstep((time - field.delayMs[index]) / EXPLANATION_FLIGHT_MS);
    out.progress = progress;
    if (progress <= 0) { out.x = field.originX[index]; out.y = field.originY[index]; return out; }
    if (progress >= 1) { out.x = field.targetX[index]; out.y = field.targetY[index]; return out; }
    writeSwirlPoint(field, index, progress, out);
    return out;
}
// КОНЕЦ ФУНКЦИИ sampleExplanationDustGrain

// НАЧАЛО ФУНКЦИИ sampleExplanationDustScatter
/**
 * Рассыпание после закрытия: песчинка раскручивается по той же спирали обратно к своей частице облака —
 * из точки окна или, если окно закрыли во время сборки, с того места полёта, где она была в момент
 * закрытия (closedAtMs — время сборки на этот момент). progress — доля обратного пути (0..1).
 */
export function sampleExplanationDustScatter(field: ExplanationDustField, index: number, scatterElapsedMs: number,
    closedAtMs: number, out: ExplanationGrainSample): ExplanationGrainSample {
    const delay = fraction(index + 401) * 0.12 * EXPLANATION_SCATTER_MS;
    const time = Number.isFinite(scatterElapsedMs) ? scatterElapsedMs : 0;
    const progress = smootherstep((time - delay) / Math.max(1, EXPLANATION_SCATTER_MS - delay));
    sampleExplanationDustGrain(field, index, Number.isFinite(closedAtMs) ? closedAtMs : EXPLANATION_ASSEMBLY_MS, out);
    const closedProgress = out.progress;
    out.progress = progress;
    if (progress <= 0) return out;
    const pathProgress = closedProgress * (1 - progress);
    if (progress >= 1 || pathProgress <= 0) { out.x = field.originX[index]; out.y = field.originY[index]; return out; }
    writeSwirlPoint(field, index, pathProgress, out);
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
    /** Видимая рамка окна в координатах экрана, снятая при открытии; null — прямоугольник с отступом. */
    readonly outline?: readonly ExplanationPoint[] | null;
}
interface ActiveAssembly {
    readonly token: number;
    readonly spec: ExplanationAssemblySpec;
    field: ExplanationDustField | null;
    /** Момент закрытия окна: с него песчинки рассыпаются обратно в облако; null — окно открыто. */
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
            const { from, to, viewport, count, outline } = this.active.spec;
            this.active.field = buildExplanationDustField({ from, to, viewport, count, sources, outline });
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
