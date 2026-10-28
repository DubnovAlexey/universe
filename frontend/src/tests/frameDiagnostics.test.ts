// ============================================================================
// ФАЙЛ: frontend/src/tests/frameDiagnostics.test.ts
// НАЗНАЧЕНИЕ: Проверить обнаружение длинных кадров без маскировки паузой/клипом dt.
// РАЗДЕЛЫ: 1. Активный кадр; 2. Пауза/скрытие и opt-in.
// ФУНКЦИИ: runFrameDiagnosticsChecks.
// ============================================================================
import { FrameDiagnostics, getDiagnosticDpr } from '../core/frameDiagnostics';
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
}
// КОНЕЦ ФУНКЦИИ runFrameDiagnosticsChecks
