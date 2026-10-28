// ============================================================================
// ФАЙЛ: frontend/src/core/frameDiagnostics.ts
// НАЗНАЧЕНИЕ: Ограниченный журнал реальных интервалов и CPU кадра для ?profile=1.
// РАЗДЕЛЫ: 1. Метрики; 2. Запись и публикация.
// ФУНКЦИИ: emptyMetrics, getDiagnosticDpr, constructor, resetContinuity, record, snapshot.
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
}
// НАЧАЛО ФУНКЦИИ emptyMetrics
const emptyMetrics = (): FrameMetrics => ({ frames: 0, maxGapMs: 0, maxCpuMs: 0,
    gapsOver100Ms: 0, gapsOver500Ms: 0, gapsOver1000Ms: 0 });
// КОНЕЦ ФУНКЦИИ emptyMetrics
type FrameState = Pick<UniverseState, 'currentPhase' | 'singularityAct' | 'isPaused' | 'isTabHidden'>;

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
    public record(gapMs: number, cpuMs: number, state: FrameState, nowMs: number): void {
        if (!this.enabled) return;
        const active = !state.isPaused && !state.isTabHidden;
        // Возобновление вкладки или паузы не считается зависанием активной сцены.
        const validGap = active && this.previouslyActive && Number.isFinite(gapMs) && gapMs >= 0 ? gapMs : 0;
        this.previouslyActive = active;
        if (!active || !Number.isFinite(cpuMs) || cpuMs < 0 || !Number.isFinite(nowMs)) return;
        const stage = state.currentPhase + ':' + state.singularityAct;
        let metrics = this.stages.get(stage);
        if (!metrics) { metrics = emptyMetrics(); this.stages.set(stage, metrics); }
        for (const target of [this.totals, metrics]) {
            target.frames++;
            target.maxGapMs = Math.max(target.maxGapMs, validGap);
            target.maxCpuMs = Math.max(target.maxCpuMs, cpuMs);
            if (validGap > 100) target.gapsOver100Ms++;
            if (validGap > 500) target.gapsOver500Ms++;
            if (validGap > 1000) target.gapsOver1000Ms++;
        }
        if (stage !== this.publishedStage || nowMs - this.publishedAtMs >= 500) {
            this.canvas.dataset.frameProfile = JSON.stringify(this.snapshot());
            this.publishedAtMs = nowMs;
            this.publishedStage = stage;
        }
    }
    // КОНЕЦ ФУНКЦИИ record

    // НАЧАЛО ФУНКЦИИ snapshot
    public snapshot(): { totals: FrameMetrics; stages: Record<string, FrameMetrics> } {
        return { totals: { ...this.totals },
            stages: Object.fromEntries(Array.from(this.stages, ([key, value]) => [key, { ...value }])) };
    }
    // КОНЕЦ ФУНКЦИИ snapshot
    // КОНЕЦ РАЗДЕЛА 2
}
