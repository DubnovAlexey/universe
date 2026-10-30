// ============================================================================
// ФАЙЛ: frontend/src/core/frameDiagnostics.ts
// НАЗНАЧЕНИЕ: Ограниченный журнал реальных интервалов и CPU кадра для ?profile=1.
// РАЗДЕЛЫ: 1. Метрики и ограниченные окна; 2. Запись и публикация.
// ФУНКЦИИ: emptyMetrics, emptySamples, recordSample, sampleQuantiles, getDiagnosticDpr,
// constructor, resetContinuity, accumulate, snapshotMetrics, record, snapshot.
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
}
// НАЧАЛО ФУНКЦИИ emptyMetrics
const emptyMetrics = (): FrameMetrics => ({ frames: 0, maxGapMs: 0, maxCpuMs: 0,
    gapsOver100Ms: 0, gapsOver500Ms: 0, gapsOver1000Ms: 0,
    maxSetupMs: 0, maxSimulationMs: 0, maxUiMs: 0, maxRenderMs: 0, maxVisualSignalsMs: {} });
// КОНЕЦ ФУНКЦИИ emptyMetrics
type FrameState = Pick<UniverseState, 'currentPhase' | 'singularityAct' | 'isPaused' | 'isTabHidden'>;

export const FRAME_DIAGNOSTIC_WINDOW = 512;
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

// НАЧАЛО ФУНКЦИИ getDiagnosticDpr
/** Для проверки телефонного backing store; обычный просмотр использует физический DPR. */
export function getDiagnosticDpr(search: string): number | null {
    const params = new URLSearchParams(search);
    const dpr = Number(params.get('dpr'));
    return params.get('profile') === '1' && Number.isFinite(dpr) && dpr >= 1 && dpr <= 3 ? dpr : null;
}
// КОНЕЦ ФУНКЦИИ getDiagnosticDpr
// КОНЕЦ РАЗДЕЛА 1

export class FrameDiagnostics {
    public readonly enabled: boolean;
    private readonly totals = emptyMetrics();
    private readonly stages = new Map<string, FrameMetrics>();
    private readonly sampleWindows = new Map<FrameMetrics, FrameSamples>();
    private previouslyActive = false;
    private publishedAtMs = -Infinity;
    private publishedStage = '';

    // НАЧАЛО ФУНКЦИИ constructor
    constructor(private readonly canvas: HTMLCanvasElement, enabled = typeof window !== 'undefined' &&
        new URLSearchParams(window.location?.search ?? '').get('profile') === '1') {
        this.enabled = enabled;
    }
    // КОНЕЦ ФУНКЦИИ constructor

    // НАЧАЛО РАЗДЕЛА 2. ЗАПИСЬ И ПУБЛИКАЦИЯ
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
        if (stage !== this.publishedStage || nowMs - this.publishedAtMs >= 500) {
            this.canvas.dataset.frameProfile = JSON.stringify(this.snapshot());
            this.publishedAtMs = nowMs;
            this.publishedStage = stage;
        }
    }
    // КОНЕЦ ФУНКЦИИ record

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
        return { ...metrics, maxVisualSignalsMs: { ...metrics.maxVisualSignalsMs },
            sampleWindowFrames: samples?.cpu.count ?? 0, p50GapMs, p95GapMs, p50CpuMs, p95CpuMs,
            p95SetupMs: sampleQuantiles(samples?.setup)[1],
            p95SimulationMs: sampleQuantiles(samples?.simulation)[1],
            p95UiMs: sampleQuantiles(samples?.ui)[1], p95RenderMs: sampleQuantiles(samples?.render)[1] };
    }
    // КОНЕЦ ФУНКЦИИ snapshotMetrics

    // НАЧАЛО ФУНКЦИИ snapshot
    public snapshot(): { totals: FrameSummary; stages: Record<string, FrameSummary> } {
        return { totals: this.snapshotMetrics(this.totals),
            stages: Object.fromEntries(Array.from(this.stages, ([key, value]) => [key,
                this.snapshotMetrics(value)])) };
    }
    // КОНЕЦ ФУНКЦИИ snapshot
    // КОНЕЦ РАЗДЕЛА 2
}
