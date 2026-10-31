// ============================================================================
// ФАЙЛ: frontend/src/core/explanationAssembly.ts
// НАЗНАЧЕНИЕ: Общие часы и детерминированная геометрия «песчаного вихря», из которого
//             собирается окно путеводителя. DOM-окно и Canvas-проход читают одно состояние.
// РАЗДЕЛЫ: 1. Константы и кривые времени; 2. Дуга вихря; 3. Поле песчинок;
//          4. Положение песчинки; 5. Общее состояние страницы.
// ФУНКЦИИ: smootherstep, getExplanationAssemblyFrame, buildExplanationVortexPath,
// sampleExplanationVortexPath, fraction, wrapAngle, buildPanelTargets, buildDustOrigins,
// buildExplanationDustField, sampleExplanationDustGrain;
// ExplanationAssemblyState: begin, end, isActive, getActive, getRemainingTextDelayMs, ensureField, reset.
// Собственного RAF, таймеров и DOM здесь нет: кадр задают renderer и окно.
// ============================================================================

import { resourceLedger } from './resourceLedger';

// НАЧАЛО РАЗДЕЛА 1. КОНСТАНТЫ И КРИВЫЕ ВРЕМЕНИ
/** Полёт песчинок от поля сцены до места окна. */
export const EXPLANATION_ASSEMBLY_MS = 2000;
/** Окно начинает проявляться, пока последние песчинки ещё садятся на контур. */
export const EXPLANATION_REVEAL_START_MS = 1650;
export const EXPLANATION_REVEAL_MS = 600;
/** Текст набирается только после того, как окно стало непрозрачным. */
export const EXPLANATION_TEXT_DELAY_MS = EXPLANATION_REVEAL_START_MS + EXPLANATION_REVEAL_MS;
const DUST_FADE_START_MS = 2050;
const DUST_FADE_MS = 550;
/** После этого момента временных ресурсов сборки не остаётся. */
export const EXPLANATION_TRAIL_DURATION_MS = DUST_FADE_START_MS + DUST_FADE_MS;
/** Песчинок на большом экране и на телефоне/узком окне. */
export const EXPLANATION_DUST_COUNT = 560;
export const EXPLANATION_DUST_COUNT_COMPACT = 300;
const MIN_DUST_COUNT = 24;
const MAX_DUST_COUNT = 2000;
/** Доли: контур окна, песчинки из нажатой кнопки, максимальная задержка старта. */
const CONTOUR_SHARE = 0.42;
const TRIGGER_SHARE = 0.12;
const MAX_DELAY_SHARE = 0.3;
/** Насколько вихрь сжимается в середине пути и сколько полных оборотов делает. */
export const EXPLANATION_SWIRL_SQUEEZE = 0.58;
const SWIRL_TURNS = 1;
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
    readonly dustOpacity: number;
    readonly yaw: number;
    readonly scale: number;
}

// НАЧАЛО ФУНКЦИИ getExplanationAssemblyFrame
/** Один кадр общей шкалы: сбор песка, проявление окна и угасание песчинок. */
export function getExplanationAssemblyFrame(elapsedMs: number): ExplanationAssemblyFrame {
    const time = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
    const nativeOpacity = smootherstep((time - EXPLANATION_REVEAL_START_MS) / EXPLANATION_REVEAL_MS);
    return {
        gather: smootherstep(time / EXPLANATION_ASSEMBLY_MS),
        nativeOpacity,
        dustOpacity: 1 - smootherstep((time - DUST_FADE_START_MS) / DUST_FADE_MS),
        // Небольшой поворот вокруг Y гаснет вместе с проявлением: плоскость «встаёт» на место.
        yaw: -7 * (1 - nativeOpacity),
        scale: 0.985 + nativeOpacity * 0.015,
    };
}
// КОНЕЦ ФУНКЦИИ getExplanationAssemblyFrame
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ДУГА, ПО КОТОРОЙ ПЛЫВЁТ ЦЕНТР ВИХРЯ
export interface ExplanationPoint { readonly x: number; readonly y: number; }
export interface ExplanationRect { readonly left: number; readonly top: number; readonly width: number; readonly height: number; }
export interface ExplanationViewport { readonly width: number; readonly height: number; }
export interface ExplanationVortexPath {
    readonly start: ExplanationPoint;
    readonly control: ExplanationPoint;
    readonly end: ExplanationPoint;
}

// НАЧАЛО ФУНКЦИИ buildExplanationVortexPath
/** Квадратичная дуга от центра облака к центру окна; изгиб всегда направлен вверх по экрану. */
export function buildExplanationVortexPath(start: ExplanationPoint, end: ExplanationPoint): ExplanationVortexPath {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const bend = Math.min(170, distance * 0.24);
    let nx = distance > 0 ? -dy / distance : 0;
    let ny = distance > 0 ? dx / distance : 0;
    if (ny > 0) { nx = -nx; ny = -ny; }
    return {
        start: { x: start.x, y: start.y },
        control: { x: (start.x + end.x) / 2 + nx * bend, y: (start.y + end.y) / 2 + ny * bend },
        end: { x: end.x, y: end.y },
    };
}
// КОНЕЦ ФУНКЦИИ buildExplanationVortexPath

// НАЧАЛО ФУНКЦИИ sampleExplanationVortexPath
/** Параметр уже сглажен вызывающим; значения за пределами [0, 1] прижимаются к концам. */
export function sampleExplanationVortexPath(path: ExplanationVortexPath, progress: number): ExplanationPoint {
    const t = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    const u = 1 - t;
    return {
        x: u * u * path.start.x + 2 * u * t * path.control.x + t * t * path.end.x,
        y: u * u * path.start.y + 2 * u * t * path.control.y + t * t * path.end.y,
    };
}
// КОНЕЦ ФУНКЦИИ sampleExplanationVortexPath
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ДЕТЕРМИНИРОВАННОЕ ПОЛЕ ПЕСЧИНОК
/** Флаги песчинки в поле kind. */
export const DUST_KIND_CONTOUR = 1;
export const DUST_KIND_TRIGGER = 2;
export const DUST_KIND_WARM = 4;

export interface ExplanationDustField {
    readonly count: number;
    /** Песчинки 0..contourCount-1 лежат на контуре окна по обходу периметра. */
    readonly contourCount: number;
    readonly path: ExplanationVortexPath;
    readonly trigger: ExplanationPoint | null;
    readonly originX: Float64Array;
    readonly originY: Float64Array;
    readonly targetX: Float64Array;
    readonly targetY: Float64Array;
    /** Полярные координаты относительно концов дуги: старт — центр облака, финиш — центр окна. */
    readonly rho0: Float64Array;
    readonly phi0: Float64Array;
    readonly rho1: Float64Array;
    readonly turn: Float64Array;
    readonly delayMs: Float64Array;
    readonly radius: Float64Array;
    readonly kind: Uint8Array;
}

export interface ExplanationDustInput {
    readonly from: ExplanationRect | null;
    readonly to: ExplanationRect;
    readonly viewport: ExplanationViewport;
    readonly count?: number;
    /** Точки поля сцены; песчинки «отрываются» от реальных частиц Вселенной. */
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

// НАЧАЛО ФУНКЦИИ wrapAngle
/** Угол в полуинтервале (-π, π]. */
function wrapAngle(angle: number): number {
    let value = angle % TAU;
    if (value <= -Math.PI) value += TAU;
    else if (value > Math.PI) value -= TAU;
    return value;
}
// КОНЕЦ ФУНКЦИИ wrapAngle

// НАЧАЛО ФУНКЦИИ buildPanelTargets
/** Контур по периметру (по часовой от левого верхнего угла) и неровная решётка плоскости. */
function buildPanelTargets(to: ExplanationRect, count: number, contourCount: number): { x: Float64Array; y: Float64Array } {
    const x = new Float64Array(count), y = new Float64Array(count);
    const insetX = Math.min(14, to.width * 0.04);
    const insetY = Math.min(16, to.height * 0.04);
    const left = to.left + insetX, top = to.top + insetY;
    const width = Math.max(1, to.width - insetX * 2), height = Math.max(1, to.height - insetY * 2);
    const perimeter = 2 * (width + height);
    for (let index = 0; index < contourCount; index++) {
        const distance = index / contourCount * perimeter;
        if (distance < width) { x[index] = left + distance; y[index] = top; }
        else if (distance < width + height) { x[index] = left + width; y[index] = top + distance - width; }
        else if (distance < width * 2 + height) { x[index] = left + width - (distance - width - height); y[index] = top + height; }
        else { x[index] = left; y[index] = top + height - (distance - width * 2 - height); }
    }
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

// НАЧАЛО ФУНКЦИИ buildDustOrigins
/**
 * Старты: часть песчинок вылетает из нажатой кнопки, остальные отрываются от частиц сцены.
 * Без частиц (тест, ранний кадр) используется детерминированный диск вокруг центра экрана.
 */
function buildDustOrigins(input: ExplanationDustInput, count: number, triggerCount: number): { x: Float64Array; y: Float64Array } {
    const x = new Float64Array(count), y = new Float64Array(count);
    const { width, height } = input.viewport;
    const from = input.from;
    const valid: number[] = [];
    const sources = input.sources;
    if (sources) {
        for (let index = 0; index < sources.length; index++) {
            const point = sources[index];
            if (point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
                point.x >= -40 && point.x <= width + 40 && point.y >= -40 && point.y <= height + 40) valid.push(index);
        }
    }
    const fieldCount = count - triggerCount;
    const stride = valid.length / Math.max(1, fieldCount);
    const radius = Math.min(width, height) * 0.42;
    for (let index = 0; index < count; index++) {
        if (from && index < triggerCount) {
            x[index] = from.left + from.width / 2 + (fraction(index + 59) - 0.5) * from.width * 0.9;
            y[index] = from.top + from.height / 2 + (fraction(index + 83) - 0.5) * from.height * 0.9;
            continue;
        }
        const fieldIndex = index - triggerCount;
        if (valid.length >= fieldCount * 0.5 && sources) {
            const point = sources[valid[Math.min(valid.length - 1, Math.floor((fieldIndex + 0.5) * stride))]];
            x[index] = point.x;
            y[index] = point.y;
            continue;
        }
        // Запасное облако: эллиптический диск с лёгким спиральным закручиванием.
        const r = (0.08 + 0.92 * Math.sqrt(fraction(index * 7 + 17))) * radius;
        const angle = fraction(index * 11 + 43) * TAU + r / radius * 2.2;
        x[index] = width / 2 + Math.cos(angle) * r * 1.35;
        y[index] = height / 2 + Math.sin(angle) * r * 0.78;
    }
    return { x, y };
}
// КОНЕЦ ФУНКЦИИ buildDustOrigins

// НАЧАЛО ФУНКЦИИ buildExplanationDustField
/**
 * Песчинка i всегда садится в точку окна i. Старты и цели сопоставляются по углу вокруг
 * своих центров, поэтому весь рой поворачивается согласованно — получается вихрь, а не хаос.
 */
export function buildExplanationDustField(input: ExplanationDustInput): ExplanationDustField {
    const requested = Number.isFinite(input.count) ? Math.round(input.count!) : EXPLANATION_DUST_COUNT;
    const count = Math.max(MIN_DUST_COUNT, Math.min(MAX_DUST_COUNT, requested));
    const contourCount = Math.round(count * CONTOUR_SHARE);
    const triggerCount = input.from ? Math.round(count * TRIGGER_SHARE) : 0;
    const targets = buildPanelTargets(input.to, count, contourCount);
    const origins = buildDustOrigins(input, count, triggerCount);

    let sumX = 0, sumY = 0;
    for (let index = 0; index < count; index++) { sumX += origins.x[index]; sumY += origins.y[index]; }
    const start = { x: sumX / count, y: sumY / count };
    const end = { x: input.to.left + input.to.width / 2, y: input.to.top + input.to.height / 2 };
    const path = buildExplanationVortexPath(start, end);

    // Сопоставление по углу: k-я по углу цель получает k-й по углу старт.
    const byOriginAngle = Array.from({ length: count }, (_, index) => index)
        .map((index) => ({ index, angle: Math.atan2(origins.y[index] - start.y, origins.x[index] - start.x) }))
        .sort((a, b) => a.angle - b.angle || a.index - b.index);
    const byTargetAngle = Array.from({ length: count }, (_, index) => index)
        .map((index) => ({ index, angle: Math.atan2(targets.y[index] - end.y, targets.x[index] - end.x) }))
        .sort((a, b) => a.angle - b.angle || a.index - b.index);

    const field: ExplanationDustField = {
        count, contourCount, path,
        trigger: input.from ? { x: input.from.left + input.from.width / 2, y: input.from.top + input.from.height / 2 } : null,
        originX: new Float64Array(count), originY: new Float64Array(count),
        targetX: targets.x, targetY: targets.y,
        rho0: new Float64Array(count), phi0: new Float64Array(count),
        rho1: new Float64Array(count), turn: new Float64Array(count),
        delayMs: new Float64Array(count), radius: new Float64Array(count), kind: new Uint8Array(count),
    };
    for (let rank = 0; rank < count; rank++) {
        const target = byTargetAngle[rank].index;
        const origin = byOriginAngle[rank].index;
        const ox = origins.x[origin], oy = origins.y[origin];
        const tx = targets.x[target], ty = targets.y[target];
        field.originX[target] = ox;
        field.originY[target] = oy;
        const phi0 = Math.atan2(oy - start.y, ox - start.x);
        const phi1 = Math.atan2(ty - end.y, tx - end.x);
        field.rho0[target] = Math.hypot(ox - start.x, oy - start.y);
        field.phi0[target] = phi0;
        field.rho1[target] = Math.hypot(tx - end.x, ty - end.y);
        // Все песчинки крутятся в одну сторону (против часовой стрелки на экране) и попадают точно в цель.
        field.turn[target] = wrapAngle(phi1 - phi0) - TAU * SWIRL_TURNS;
        const fromTrigger = input.from !== null && origin < triggerCount;
        const contour = target < contourCount;
        field.kind[target] = (contour ? DUST_KIND_CONTOUR : 0) | (fromTrigger ? DUST_KIND_TRIGGER : 0) |
            (target % 9 === 4 ? DUST_KIND_WARM : 0);
        // Песок из кнопки стартует сразу: это мгновенный отклик на нажатие.
        field.delayMs[target] = fraction(target + 151) * EXPLANATION_ASSEMBLY_MS * (fromTrigger ? 0.08 : MAX_DELAY_SHARE);
        field.radius[target] = (contour ? 1.05 : 0.75) + fraction(target + 251) * (contour ? 0.85 : 0.6);
    }
    return field;
}
// КОНЕЦ ФУНКЦИИ buildExplanationDustField
// КОНЕЦ РАЗДЕЛА 3

// НАЧАЛО РАЗДЕЛА 4. ПОЛОЖЕНИЕ ПЕСЧИНКИ БЕЗ ВЫДЕЛЕНИЯ ПАМЯТИ
export interface ExplanationGrainSample { x: number; y: number; progress: number; }

// НАЧАЛО ФУНКЦИИ sampleExplanationDustGrain
/**
 * Центр вихря плывёт по дуге, песчинка обращается вокруг него и меняет радиус:
 * в середине пути рой сжимается в плотную воронку, к концу раскрывается в прямоугольник окна.
 * Результат пишется в out, чтобы кадр с сотнями песчинок не создавал мусор для GC.
 */
export function sampleExplanationDustGrain(field: ExplanationDustField, index: number, elapsedMs: number,
    out: ExplanationGrainSample): ExplanationGrainSample {
    const delay = field.delayMs[index];
    const time = Number.isFinite(elapsedMs) ? elapsedMs : 0;
    const progress = smootherstep((time - delay) / Math.max(1, EXPLANATION_ASSEMBLY_MS - delay));
    out.progress = progress;
    if (progress <= 0) { out.x = field.originX[index]; out.y = field.originY[index]; return out; }
    if (progress >= 1) { out.x = field.targetX[index]; out.y = field.targetY[index]; return out; }
    const path = field.path;
    const u = 1 - progress;
    const centerX = u * u * path.start.x + 2 * u * progress * path.control.x + progress * progress * path.end.x;
    const centerY = u * u * path.start.y + 2 * u * progress * path.control.y + progress * progress * path.end.y;
    const squeeze = 1 - EXPLANATION_SWIRL_SQUEEZE * Math.sin(Math.PI * progress);
    const rho = (field.rho0[index] * u + field.rho1[index] * progress) * squeeze;
    const phi = field.phi0[index] + field.turn[index] * progress;
    out.x = centerX + rho * Math.cos(phi);
    out.y = centerY + rho * Math.sin(phi);
    return out;
}
// КОНЕЦ ФУНКЦИИ sampleExplanationDustGrain
// КОНЕЦ РАЗДЕЛА 4

// НАЧАЛО РАЗДЕЛА 5. ОДНА АКТИВНАЯ СБОРКА НА СТРАНИЦУ
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
}

export class ExplanationAssemblyState {
    private active: ActiveAssembly | null = null;
    private nextToken = 1;

    // НАЧАЛО ФУНКЦИИ begin
    /** Новая сборка заменяет прежнюю; поле строится лениво на первом кадре renderer. */
    public begin(spec: ExplanationAssemblySpec): number {
        this.end(this.active?.token ?? -1);
        const token = this.nextToken++;
        this.active = { token, spec, field: null };
        return token;
    }
    // КОНЕЦ ФУНКЦИИ begin

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
    public getActive(): Readonly<{ token: number; spec: ExplanationAssemblySpec; field: ExplanationDustField | null }> | null {
        return this.active;
    }
    // КОНЕЦ ФУНКЦИИ getActive

    // НАЧАЛО ФУНКЦИИ getRemainingTextDelayMs
    /** Сколько ещё ждать набору текста, чтобы он не начался под невидимым окном. */
    public getRemainingTextDelayMs(nowMs: number): number {
        if (!this.active || !Number.isFinite(nowMs)) return 0;
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
// КОНЕЦ РАЗДЕЛА 5
