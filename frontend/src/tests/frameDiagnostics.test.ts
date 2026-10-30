// ============================================================================
// ФАЙЛ: frontend/src/tests/frameDiagnostics.test.ts
// НАЗНАЧЕНИЕ: Проверить обнаружение длинных кадров без маскировки паузой/клипом dt.
// РАЗДЕЛЫ: 1. Активный кадр; 2. Пауза/скрытие и opt-in.
// ФУНКЦИИ: runFrameDiagnosticsChecks.
// ============================================================================
import { FRAME_DIAGNOSTIC_WINDOW, FrameDiagnostics, getDiagnosticDpr } from '../core/frameDiagnostics';
import { universeStore } from '../store/universeState';

// НАЧАЛО ФУНКЦИИ runFrameDiagnosticsChecks
export function runFrameDiagnosticsChecks(check: (passed: boolean, description: string) => void): void {
    const canvas = { dataset: {} as Record<string, string> } as HTMLCanvasElement;
    const profile = new FrameDiagnostics(canvas, true);
    const state = { ...universeStore.getState(), isPaused: false, isTabHidden: false };
    profile.record(16, 4, state, 0);
    profile.record(1450, 1200, state, 1450, { setupMs: 10, simulationMs: 100, uiMs: 70, renderMs: 1020,
        visualSignals: { 'finale-card': 65, waterfall: 2 } });
    const report = profile.snapshot();
    check(report.totals.frames === 2 && report.totals.maxGapMs === 1450 && report.totals.maxCpuMs === 1200 &&
        report.totals.gapsOver1000Ms === 1 && JSON.parse(canvas.dataset.frameProfile!).totals.maxGapMs === 1450,
    'Opt-in profiling retains a1.45-second actual gap and CPU cost instead of clamping them to physics dt');
    check(report.totals.maxSetupMs === 10 && report.totals.maxSimulationMs === 100 &&
        report.totals.maxUiMs === 70 && report.totals.maxRenderMs === 1020 &&
        Object.values(report.stages).some(stage => stage.maxRenderMs === 1020) &&
        report.totals.maxVisualSignalsMs['finale-card'] === 65 && report.totals.maxVisualSignalsMs.waterfall === 2,
        'The active stage distinguishes setup, simulation, UI updates and rendering instead of attributing every hitch to geometry');
    profile.record(2000, 2, { ...state, isPaused: true }, 3450);
    profile.record(2000, 2, state, 5450);
    profile.record(3000, 2, { ...state, isTabHidden: true }, 8450);
    profile.record(3000, 2, state, 11450);
    check(profile.snapshot().totals.gapsOver1000Ms === 1,
        'Paused, hidden and first resumed intervals do not masquerade as active rendering stalls');
    profile.resetContinuity();
    profile.record(60000, 5, state, 71450);
    check(profile.snapshot().totals.gapsOver1000Ms === 1,
        'Visibility suspension excludes a full hidden interval even when no hidden RAF was delivered');
    const disabledCanvas = { dataset: {} as Record<string, string> } as HTMLCanvasElement;
    const disabled = new FrameDiagnostics(disabledCanvas, false);
    disabled.record(3000, 2000, state, 0);
    check(disabled.snapshot().totals.frames === 0 && Object.keys(disabledCanvas.dataset).length === 0,
        'Normal viewing does not record or publish the optional diagnostic profile');
    check(getDiagnosticDpr('?profile=1&dpr=3') === 3 && getDiagnosticDpr('?dpr=3') === null &&
        ['?profile=1&dpr=100', '?profile=1&dpr=NaN', '?profile=1&dpr=-1', '?profile=1'].every(search => getDiagnosticDpr(search) === null),
        'A bounded diagnostic DPR requires explicit profiling; normal viewing and malformed requests retain the physical ratio');

    const rolling = new FrameDiagnostics(canvas, true);
    const rollingState = { ...state, currentPhase: '01_VOID' as const, singularityAct: 'INACTIVE' as const };
    for (let i = 1; i <= FRAME_DIAGNOSTIC_WINDOW; i++) rolling.record(i, i, rollingState, i * 20,
        { setupMs: i / 4, simulationMs: i / 2, uiMs: i / 8, renderMs: i * 2 });
    const percentiles = rolling.snapshot().totals;
    check(percentiles.sampleWindowFrames === 512 && percentiles.p50CpuMs === 257 && percentiles.p95CpuMs === 487 &&
        percentiles.p95SimulationMs === 243.5 && percentiles.p95RenderMs === 974 &&
        percentiles.p95UiMs === 60.875 && percentiles.p95SetupMs === 121.75,
        'Opt-in snapshots provide exact bounded p50/p95 CPU and work costs without sorting on every frame');

    for (let i = 1; i <= FRAME_DIAGNOSTIC_WINDOW; i++) rolling.record(16, 2, rollingState, 11000 + i * 20,
        { setupMs: 0.1, simulationMs: 0.5, uiMs: 0.4, renderMs: 1 });
    const expired = rolling.snapshot().totals;
    check(expired.frames === 1024 && expired.sampleWindowFrames === 512 && expired.p50CpuMs === 2 && expired.p95CpuMs === 2 &&
        expired.p95GapMs === 16 && expired.p95RenderMs === 1 && expired.maxCpuMs === 512 && expired.maxRenderMs === 1024 &&
        expired.gapsOver500Ms === 12,
        'Rolling percentiles replace old samples while whole-run maxima and long-gap counters remain intact');

    const laterStage = { ...rollingState, currentPhase: '03_EVOLUTION' as const };
    rolling.record(16, 7, laterStage, 23000, { setupMs: 1, simulationMs: 2, uiMs: 1, renderMs: 3 });
    const separated = rolling.snapshot();
    const stageSummary = separated.stages[laterStage.currentPhase + ':' + laterStage.singularityAct]!;
    stageSummary.maxVisualSignalsMs.injected = 1000;
    check(stageSummary.sampleWindowFrames === 1 && stageSummary.p95CpuMs === 7 && stageSummary.p95RenderMs === 3 &&
        !('injected' in rolling.snapshot().stages[laterStage.currentPhase + ':' + laterStage.singularityAct]!.maxVisualSignalsMs),
        'Each phase keeps its own bounded statistics and consumer snapshots cannot mutate retained diagnostics');
}
// КОНЕЦ ФУНКЦИИ runFrameDiagnosticsChecks
