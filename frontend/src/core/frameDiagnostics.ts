// ============================================================================
// ФАЙЛ: frontend/src/core/frameDiagnostics.ts
// НАЗНАЧЕНИЕ: Ограниченный журнал реальных интервалов и CPU кадра для ?profile=1.
// РАЗДЕЛЫ: 1. Метрики и ограниченные окна/пики; 2. Browser LoAF; 3. Запись и публикация.
// ФУНКЦИИ: emptyMetrics, emptySamples, recordSample, sampleQuantiles, accumulateRenderPasses, copyFrameWork,
// topFrameSlot, snapshotFrames, browserLongFrameSource, browserTime, slowestBrowserEntries,
// snapshotBrowserLongFrames, getDiagnosticDpr, constructor, resetContinuity,
// retainTopFrames, accumulate, snapshotMetrics, record, snapshot.
// Использует существующий RAF; не ограничивает измеренный интервал до шага физики.
// ============================================================================
import type { UniverseState } from '../store/universeState';

// НАЧАЛО РАЗДЕЛА 1. МЕТРИКИ
interface FrameMetrics {
    frames: number;
    maxGapMs: number;
    maxCpuMs: number;
    gapsOver100Ms: number;
    gapsOver500Ms: number;
    gapsOver1000Ms: number;
    maxSetupMs: number;
    maxSimulationMs: number;
    maxUiMs: number;
    maxRenderMs: number;
    maxVisualSignalsMs: Record<string, number>;
    maxRenderPassesMs: Record<string, number>;
}
interface FramePercentiles {
    sampleWindowFrames: number;
    p50GapMs: number;
    p95GapMs: number;
    p50CpuMs: number;
    p95CpuMs: number;
    p95SetupMs: number;
    p95SimulationMs: number;
    p95UiMs: number;
    p95RenderMs: number;
}
type FrameSummary = FrameMetrics & FramePercentiles;
export interface FrameWorkBreakdown {
    setupMs: number; simulationMs: number; uiMs: number; renderMs: number;
    visualSignals?: Readonly<Record<string, number>>;
    renderPasses?: Readonly<Record<string, number>>;
}
/** Gap относится к интервалу перед этим callback, CPU/work — к самому callback. */
export interface DiagnosticFrame {
    /** Номер принятого активного образца с 1; paused/hidden/невалидные записи не увеличивают его. */
    frameIndex: number;
    /** Переданный timestamp RAF; stage фиксируется в момент record, а не в начале интервала gap. */
    nowMs: number;
    stage: string;
    /** null после первого кадра/reset/возобновления или при невалидном интервале. */
    gapMs: number | null;
    gapInterval: 'before-current-callback';
    cpuMs: number;
    work?: FrameWorkBreakdown;
}
// НАЧАЛО ФУНКЦИИ emptyMetrics
const emptyMetrics = (): FrameMetrics => ({ frames: 0, maxGapMs: 0, maxCpuMs: 0,
    gapsOver100Ms: 0, gapsOver500Ms: 0, gapsOver1000Ms: 0,
    maxSetupMs: 0, maxSimulationMs: 0, maxUiMs: 0, maxRenderMs: 0, maxVisualSignalsMs: {},
    maxRenderPassesMs: Object.create(null) as Record<string, number> });
// КОНЕЦ ФУНКЦИИ emptyMetrics
type FrameState = Pick<UniverseState, 'currentPhase' | 'singularityAct' | 'isPaused' | 'isTabHidden'>;

export const FRAME_DIAGNOSTIC_WINDOW = 512;
export const FRAME_DIAGNOSTIC_TOP_LIMIT = 12;
export const BROWSER_LONG_FRAME_LIMIT = 12;
export const BROWSER_LONG_FRAME_SCRIPT_LIMIT = 8;
interface MetricSamples { readonly values: Float64Array; count: number; cursor: number; }
interface FrameSamples {
    gap: MetricSamples; cpu: MetricSamples; setup: MetricSamples;
    simulation: MetricSamples; ui: MetricSamples; render: MetricSamples;
}

// НАЧАЛО ФУНКЦИИ emptySamples
/** Память выделяется только после первого активного образца opt-in диагностики. */
function emptySamples(): FrameSamples {
    const metric = (): MetricSamples => ({ values: new Float64Array(FRAME_DIAGNOSTIC_WINDOW), count: 0, cursor: 0 });
    return { gap: metric(), cpu: metric(), setup: metric(), simulation: metric(), ui: metric(), render: metric() };
}
// КОНЕЦ ФУНКЦИИ emptySamples

// НАЧАЛО ФУНКЦИИ recordSample
/** Кольцевое окно не ограничивает величину задержки и не выделяет память в кадре. */
function recordSample(samples: MetricSamples, value: number | undefined): void {
    if (value === undefined || !Number.isFinite(value) || value < 0) return;
    samples.values[samples.cursor] = value;
    samples.cursor = (samples.cursor + 1) % samples.values.length;
    samples.count = Math.min(samples.count + 1, samples.values.length);
}
// КОНЕЦ ФУНКЦИИ recordSample

// НАЧАЛО ФУНКЦИИ sampleQuantiles
/** Сортируется копия только при снимке/публикации, не в каждом record(). */
function sampleQuantiles(samples: MetricSamples | undefined): readonly [number, number] {
    if (!samples?.count) return [0, 0];
    const sorted = samples.values.slice(0, samples.count).sort();
    const quantile = (fraction: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!;
    return [quantile(0.5), quantile(0.95)];
}
// КОНЕЦ ФУНКЦИИ sampleQuantiles

// НАЧАЛО ФУНКЦИИ accumulateRenderPasses
/** Только внутренние имена проходов: до 16 собственных labels длиной до 64 символов. */
function accumulateRenderPasses(target: Record<string, number>, passes: Readonly<Record<string, number>>): Record<string, number> {
    let retained = 0, inspected = 0;
    for (const _label in target) retained++;
    for (const label in passes) {
        if (!Object.hasOwn(passes, label)) continue;
        if (inspected++ >= 16) break;
        const elapsedMs = passes[label]!;
        if (!label || label.length > 64 || !Number.isFinite(elapsedMs) || elapsedMs < 0) continue;
        const previous = target[label];
        if (previous === undefined && retained >= 16) continue;
        target[label] = Math.max(previous ?? 0, elapsedMs);
        if (previous === undefined) retained++;
    }
    return target;
}
// КОНЕЦ ФУНКЦИИ accumulateRenderPasses

// НАЧАЛО ФУНКЦИИ copyFrameWork
/** Источник может переиспользовать объект/labels; сохранённый пик владеет своей копией. */
function copyFrameWork(work: Readonly<FrameWorkBreakdown> | undefined): FrameWorkBreakdown | undefined {
    return work ? { ...work, ...(work.visualSignals ? { visualSignals: { ...work.visualSignals } } : {}),
        ...(work.renderPasses ? { renderPasses: accumulateRenderPasses(Object.create(null) as Record<string, number>, work.renderPasses) } : {}) } : undefined;
}
// КОНЕЦ ФУНКЦИИ copyFrameWork

// НАЧАЛО ФУНКЦИИ topFrameSlot
/** Не сортирует кадры и не создаёт копию: максимум 12 сравнений только с текущими пиками. */
function topFrameSlot(frames: readonly DiagnosticFrame[], value: number, metric: 'cpuMs' | 'gapMs'): number {
    if (frames.length < FRAME_DIAGNOSTIC_TOP_LIMIT) return frames.length;
    let minimum = 0;
    for (let index = 1; index < frames.length; index++) {
        if (frames[index]![metric]! < frames[minimum]![metric]!) minimum = index;
    }
    return value > frames[minimum]![metric]! ? minimum : -1;
}
// КОНЕЦ ФУНКЦИИ topFrameSlot

// НАЧАЛО ФУНКЦИИ snapshotFrames
/** Сортировка/копирование выполняются только при явном снимке или редкой публикации. */
function snapshotFrames(frames: readonly DiagnosticFrame[], metric: 'cpuMs' | 'gapMs'): DiagnosticFrame[] {
    return frames.map(frame => ({ ...frame, ...(frame.work ? { work: copyFrameWork(frame.work) } : {}) }))
        .sort((left, right) => right[metric]! - left[metric]! || left.frameIndex - right.frameIndex);
}
// КОНЕЦ ФУНКЦИИ snapshotFrames

// НАЧАЛО ФУНКЦИИ getDiagnosticDpr
/** Для проверки телефонного backing store; обычный просмотр использует физический DPR. */
export function getDiagnosticDpr(search: string): number | null {
    const params = new URLSearchParams(search);
    const dpr = Number(params.get('dpr'));
    return params.get('profile') === '1' && Number.isFinite(dpr) && dpr >= 1 && dpr <= 3 ? dpr : null;
}
// КОНЕЦ ФУНКЦИИ getDiagnosticDpr
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. BROWSER LONG ANIMATION FRAMES
/** Узкая инъекция для тестов: observer не создаётся, native entries нигде не сохраняются. */
export interface BrowserLongFrameSource {
    readonly supportedEntryTypes: readonly string[];
    getEntriesByType(type: string): readonly unknown[];
}
export interface BrowserLongFrameScript {
    startTime: number; duration: number;
    sourceFunctionName: string; sourceURL: string; invoker: string;
    forcedStyleAndLayoutDuration: number; pauseDuration: number;
}
export interface BrowserLongFrame {
    startTime: number; duration: number; renderStart: number;
    styleAndLayoutStart: number; blockingDuration: number;
    scripts: BrowserLongFrameScript[];
}
export interface BrowserLongFrameSnapshot {
    /** События всей страницы, включая paused/hidden: не приписываются автоматически CPU/gap сцены. */
    scope: 'page-timeline';
    supported: boolean;
    entries: BrowserLongFrame[];
    /** Top по сумме всех исходных script forced-layout; в выводе остаются только 8 самых дорогих scripts. */
    layoutEntries: BrowserLongFrame[];
}

// НАЧАЛО ФУНКЦИИ browserLongFrameSource
/** Только feature detection по static supportedEntryTypes; никакой подписки/нового таймера. */
function browserLongFrameSource(): BrowserLongFrameSource | null {
    if (typeof window === 'undefined' || typeof performance === 'undefined' ||
        typeof PerformanceObserver === 'undefined' || typeof performance.getEntriesByType !== 'function') return null;
    return { supportedEntryTypes: PerformanceObserver.supportedEntryTypes,
        getEntriesByType: type => performance.getEntriesByType(type) };
}
// КОНЕЦ ФУНКЦИИ browserLongFrameSource

// НАЧАЛО ФУНКЦИИ browserTime
function browserTime(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}
// КОНЕЦ ФУНКЦИИ browserTime

// НАЧАЛО ФУНКЦИИ slowestBrowserEntries
/** Browser timeline ограничен 200 LoAF; сортировка делается только при snapshot. */
function slowestBrowserEntries(values: readonly unknown[], limit: number,
    metric: 'duration' | 'forcedStyleAndLayoutDuration' = 'duration'): Record<string, unknown>[] {
    return values.filter((value): value is Record<string, unknown> => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const entry = value as Record<string, unknown>;
        return typeof entry.startTime === 'number' && Number.isFinite(entry.startTime) && entry.startTime >= 0 &&
            typeof entry.duration === 'number' && Number.isFinite(entry.duration) && entry.duration >= 0;
    }).sort((left, right) => browserTime(right[metric]) - browserTime(left[metric]) ||
        (right.duration as number) - (left.duration as number) ||
        (left.startTime as number) - (right.startTime as number)).slice(0, limit);
}
// КОНЕЦ ФУНКЦИИ slowestBrowserEntries

// НАЧАЛО ФУНКЦИИ snapshotBrowserLongFrames
/** Читает текущий browser buffer (до 200 событий), а не создаёт полную историю прогона.
 * https://developer.chrome.com/docs/web-platform/long-animation-frames
 * При недоступном/бросающем API supported:false означает невозможность получить снимок. */
function snapshotBrowserLongFrames(enabled: boolean, source: BrowserLongFrameSource | null | undefined): BrowserLongFrameSnapshot {
    const empty = (): BrowserLongFrameSnapshot => ({ scope: 'page-timeline', supported: false, entries: [], layoutEntries: [] });
    if (!enabled) return empty();
    try {
        const api = source === undefined ? browserLongFrameSource() : source;
        if (!api?.supportedEntryTypes.includes('long-animation-frame')) return empty();
        const entries = api.getEntriesByType('long-animation-frame');
        if (!Array.isArray(entries)) return empty();
        const text = (value: unknown, limit: number): string => typeof value === 'string' ? value.slice(0, limit) : '';
        const copyEntry = (entry: Record<string, unknown>, layoutScripts = false): BrowserLongFrame => ({
                startTime: entry.startTime as number, duration: entry.duration as number,
                renderStart: browserTime(entry.renderStart), styleAndLayoutStart: browserTime(entry.styleAndLayoutStart),
                blockingDuration: browserTime(entry.blockingDuration),
                scripts: slowestBrowserEntries(Array.isArray(entry.scripts) ? entry.scripts : [], BROWSER_LONG_FRAME_SCRIPT_LIMIT,
                    layoutScripts ? 'forcedStyleAndLayoutDuration' : 'duration')
                    .map(script => ({ startTime: script.startTime as number, duration: script.duration as number,
                        sourceFunctionName: text(script.sourceFunctionName, 128), sourceURL: text(script.sourceURL, 512),
                        invoker: text(script.invoker, 128),
                        forcedStyleAndLayoutDuration: browserTime(script.forcedStyleAndLayoutDuration),
                        pauseDuration: browserTime(script.pauseDuration) }))
            });
        // Не ранжируем по усечённым 8 scripts: короткий LoAF с дорогим layout иначе потеряется.
        const layout = slowestBrowserEntries(entries, entries.length).map(entry => ({ entry,
            forcedMs: slowestBrowserEntries(Array.isArray(entry.scripts) ? entry.scripts : [], Number.POSITIVE_INFINITY)
                .reduce((sum, script) => Math.min(Number.MAX_VALUE, sum + browserTime(script.forcedStyleAndLayoutDuration)), 0)
        })).filter(candidate => candidate.forcedMs > 0)
            .sort((left, right) => right.forcedMs - left.forcedMs ||
                (right.entry.duration as number) - (left.entry.duration as number) ||
                (left.entry.startTime as number) - (right.entry.startTime as number))
            .slice(0, BROWSER_LONG_FRAME_LIMIT);
        return { scope: 'page-timeline', supported: true,
            entries: slowestBrowserEntries(entries, BROWSER_LONG_FRAME_LIMIT).map(entry => copyEntry(entry)),
            layoutEntries: layout.map(({ entry }) => copyEntry(entry, true)) };
    } catch { return empty(); }
}
// КОНЕЦ ФУНКЦИИ snapshotBrowserLongFrames
// КОНЕЦ РАЗДЕЛА 2

export class FrameDiagnostics {
    public readonly enabled: boolean;
    private readonly totals = emptyMetrics();
    private readonly stages = new Map<string, FrameMetrics>();
    private readonly sampleWindows = new Map<FrameMetrics, FrameSamples>();
    private readonly topCPUFrames: DiagnosticFrame[] = [];
    private readonly topGapFrames: DiagnosticFrame[] = [];
    private previouslyActive = false;
    private publishedAtMs = -Infinity;
    private publishedStage = '';

    // НАЧАЛО ФУНКЦИИ constructor
    constructor(private readonly canvas: HTMLCanvasElement, enabled = typeof window !== 'undefined' &&
        new URLSearchParams(window.location?.search ?? '').get('profile') === '1',
        private readonly browserFrames?: BrowserLongFrameSource | null) {
        this.enabled = enabled;
    }
    // КОНЕЦ ФУНКЦИИ constructor

    // НАЧАЛО РАЗДЕЛА 3. ЗАПИСЬ И ПУБЛИКАЦИЯ
    // НАЧАЛО ФУНКЦИИ resetContinuity
    /** visibilitychange приходит даже тогда, когда браузер не рисует ни одного скрытого кадра. */
    public resetContinuity(): void { this.previouslyActive = false; }
    // КОНЕЦ ФУНКЦИИ resetContinuity

    // НАЧАЛО ФУНКЦИИ record
    public record(gapMs: number, cpuMs: number, state: FrameState, nowMs: number, work?: Readonly<FrameWorkBreakdown>): void {
        if (!this.enabled) return;
        const active = !state.isPaused && !state.isTabHidden;
        // Возобновление вкладки или паузы не считается зависанием активной сцены.
        const continuousGap = active && this.previouslyActive && Number.isFinite(gapMs) && gapMs >= 0;
        const validGap = continuousGap ? gapMs : 0;
        this.previouslyActive = active;
        if (!active || !Number.isFinite(cpuMs) || cpuMs < 0 || !Number.isFinite(nowMs)) return;
        const stage = state.currentPhase + ':' + state.singularityAct;
        let metrics = this.stages.get(stage);
        if (!metrics) { metrics = emptyMetrics(); this.stages.set(stage, metrics); }
        this.accumulate(this.totals, validGap, continuousGap, cpuMs, work);
        this.accumulate(metrics, validGap, continuousGap, cpuMs, work);
        this.retainTopFrames(stage, nowMs, continuousGap ? validGap : null, cpuMs, work);
        if (stage !== this.publishedStage || nowMs - this.publishedAtMs >= 500) {
            this.canvas.dataset.frameProfile = JSON.stringify(this.snapshot());
            this.publishedAtMs = nowMs;
            this.publishedStage = stage;
        }
    }
    // КОНЕЦ ФУНКЦИИ record

    // НАЧАЛО ФУНКЦИИ retainTopFrames
    /** Две независимые bounded-выборки: большой gap не объявляет текущий callback причиной. */
    private retainTopFrames(stage: string, nowMs: number, gapMs: number | null, cpuMs: number,
        work: Readonly<FrameWorkBreakdown> | undefined): void {
        const cpuSlot = topFrameSlot(this.topCPUFrames, cpuMs, 'cpuMs');
        const gapSlot = gapMs === null ? -1 : topFrameSlot(this.topGapFrames, gapMs, 'gapMs');
        if (cpuSlot < 0 && gapSlot < 0) return;
        const frame: DiagnosticFrame = { frameIndex: this.totals.frames, nowMs, stage, gapMs,
            gapInterval: 'before-current-callback', cpuMs, ...(work ? { work: copyFrameWork(work) } : {}) };
        if (cpuSlot >= 0) this.topCPUFrames[cpuSlot] = frame;
        if (gapSlot >= 0) this.topGapFrames[gapSlot] = frame;
    }
    // КОНЕЦ ФУНКЦИИ retainTopFrames

    // НАЧАЛО ФУНКЦИИ accumulate
    /** Максимумы/счётчики охватывают весь запуск, перцентили — последние 512 активных кадров. */
    private accumulate(target: FrameMetrics, gapMs: number, continuousGap: boolean, cpuMs: number,
        work: Readonly<FrameWorkBreakdown> | undefined): void {
        let samples = this.sampleWindows.get(target);
        if (!samples) { samples = emptySamples(); this.sampleWindows.set(target, samples); }
        target.frames++;
        target.maxGapMs = Math.max(target.maxGapMs, gapMs);
        target.maxCpuMs = Math.max(target.maxCpuMs, cpuMs);
        if (continuousGap) recordSample(samples.gap, gapMs);
        recordSample(samples.cpu, cpuMs);
        if (work) {
            if (Number.isFinite(work.setupMs) && work.setupMs >= 0) target.maxSetupMs = Math.max(target.maxSetupMs, work.setupMs);
            if (Number.isFinite(work.simulationMs) && work.simulationMs >= 0) target.maxSimulationMs = Math.max(target.maxSimulationMs, work.simulationMs);
            if (Number.isFinite(work.uiMs) && work.uiMs >= 0) target.maxUiMs = Math.max(target.maxUiMs, work.uiMs);
            if (Number.isFinite(work.renderMs) && work.renderMs >= 0) target.maxRenderMs = Math.max(target.maxRenderMs, work.renderMs);
            recordSample(samples.setup, work.setupMs);
            recordSample(samples.simulation, work.simulationMs);
            recordSample(samples.ui, work.uiMs);
            recordSample(samples.render, work.renderMs);
            if (work.visualSignals) for (const label in work.visualSignals) {
                const elapsedMs = work.visualSignals[label]!;
                if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
                    target.maxVisualSignalsMs[label] = Math.max(target.maxVisualSignalsMs[label] ?? 0, elapsedMs);
                }
            }
            if (work.renderPasses) accumulateRenderPasses(target.maxRenderPassesMs, work.renderPasses);
        }
        if (gapMs > 100) target.gapsOver100Ms++;
        if (gapMs > 500) target.gapsOver500Ms++;
        if (gapMs > 1000) target.gapsOver1000Ms++;
    }
    // КОНЕЦ ФУНКЦИИ accumulate

    // НАЧАЛО ФУНКЦИИ snapshotMetrics
    private snapshotMetrics(metrics: FrameMetrics): FrameSummary {
        const samples = this.sampleWindows.get(metrics);
        const [p50GapMs, p95GapMs] = sampleQuantiles(samples?.gap);
        const [p50CpuMs, p95CpuMs] = sampleQuantiles(samples?.cpu);
        return { ...metrics, maxVisualSignalsMs: { ...metrics.maxVisualSignalsMs }, maxRenderPassesMs: { ...metrics.maxRenderPassesMs },
            sampleWindowFrames: samples?.cpu.count ?? 0, p50GapMs, p95GapMs, p50CpuMs, p95CpuMs,
            p95SetupMs: sampleQuantiles(samples?.setup)[1],
            p95SimulationMs: sampleQuantiles(samples?.simulation)[1],
            p95UiMs: sampleQuantiles(samples?.ui)[1], p95RenderMs: sampleQuantiles(samples?.render)[1] };
    }
    // КОНЕЦ ФУНКЦИИ snapshotMetrics

    // НАЧАЛО ФУНКЦИИ snapshot
    public snapshot(): { totals: FrameSummary; stages: Record<string, FrameSummary>;
        topCPUFrames: DiagnosticFrame[]; topGapFrames: DiagnosticFrame[]; browserLongFrames: BrowserLongFrameSnapshot } {
        return { totals: this.snapshotMetrics(this.totals),
            stages: Object.fromEntries(Array.from(this.stages, ([key, value]) => [key,
                this.snapshotMetrics(value)])),
            topCPUFrames: snapshotFrames(this.topCPUFrames, 'cpuMs'),
            topGapFrames: snapshotFrames(this.topGapFrames, 'gapMs'),
            browserLongFrames: snapshotBrowserLongFrames(this.enabled, this.browserFrames) };
    }
    // КОНЕЦ ФУНКЦИИ snapshot
    // КОНЕЦ РАЗДЕЛА 3
}
