// ============================================================================
// ФАЙЛ: frontend/src/tests/ouroborosEpisode.test.ts
// НАЗНАЧЕНИЕ: Проверить подъём, медленную сборку и непрерывные ручные переходы формы.
// РАЗДЕЛЫ: 1. Изолированное состояние; 2. Огибающие; 3. Реальные переходы store.
// ФУНКЦИИ: makeState, advance, runOuroborosEpisodeChecks.
// ============================================================================
import { evaluateOuroborosEpisode, getOuroborosLayout } from '../core/ouroborosEpisode';
import { UNIVERSE_PHASES, universeStore, type UniverseState } from '../store/universeState';

// НАЧАЛО ФУНКЦИИ makeState
function makeState(elapsed = 24.05, changes: Partial<UniverseState> = {}, time = 103.05): UniverseState {
    const base = universeStore.getState();
    return { ...base, currentPhase: '05_SINGULARITY', phaseMeta: UNIVERSE_PHASES['05_SINGULARITY'],
        cycleCount: 1, finaleReachedOnce: true, finaleRiseElapsedSec: 5.5, ouroborosRelease: null,
        singularityAct: 'ACT_D_GITHUB_CARD', reducedMotion: false, ...changes,
        telemetry: { ...base.telemetry, phaseElapsedSec: elapsed, simulationTimeSec: time } };
}
// КОНЕЦ ФУНКЦИИ makeState

// НАЧАЛО ФУНКЦИИ advance
function advance(store: typeof universeStore, elapsed: number): void {
    store.updateTelemetry({ phaseElapsedSec: elapsed, simulationTimeSec: store.getState().phaseMeta.startSec + elapsed, frameTimeMs: 16 });
}
// КОНЕЦ ФУНКЦИИ advance

// НАЧАЛО ФУНКЦИИ runOuroborosEpisodeChecks
export function runOuroborosEpisodeChecks(check: (passed: boolean, description: string) => void): void {
    const start = evaluateOuroborosEpisode(makeState(18.55, { finaleRiseElapsedSec: 0 }));
    const half = evaluateOuroborosEpisode(makeState(21.3, { finaleRiseElapsedSec: 2.75 }));
    const full = evaluateOuroborosEpisode(makeState());
    let monotonic = true, previousMorph = 0;
    for (let i = 0; i <= 110; i++) {
        const age = i * 0.05;
        const e = evaluateOuroborosEpisode(makeState(18.55 + age, { finaleRiseElapsedSec: age }));
        monotonic &&= e.morph >= previousMorph - 1e-12 && e.morph >= 0 && e.morph <= 1;
        previousMorph = e.morph;
    }
    check(start.opacity === 0 && start.morph === 0 && Math.abs(half.morph - 0.5) < 1e-12 &&
        full.opacity === 0.76 && full.morph === 1 && monotonic,
        'Card-rise and gather start together; the full shape assembles monotonically over5.5 active seconds');

    const excluded = [makeState(24, { finaleRiseElapsedSec: null }), makeState(24, { finaleReachedOnce: false }),
        makeState(24, { currentPhase: '03_EVOLUTION' }), makeState(12, { singularityAct: 'ACT_B_LOGIC' })];
    check(excluded.every(s => evaluateOuroborosEpisode(s).opacity === 0) &&
        [false, true].every(preview => evaluateOuroborosEpisode(makeState(14, { singularityAct: 'ACT_C_ZERO_SILENCE' }), preview).opacity === 0),
        'The episode excludes unreleased cards, other phases and Zero Silence, including preview');

    const repeated = [1, 2].every(cycleCount =>
        evaluateOuroborosEpisode(makeState(14.05, { cycleCount, finaleRiseElapsedSec: 12 })).opacity === 0 &&
        evaluateOuroborosEpisode(makeState(18.55, { cycleCount, finaleRiseElapsedSec: 12 })).morph === 0 &&
        evaluateOuroborosEpisode(makeState(24.05, { cycleCount, finaleRiseElapsedSec: 12 })).morph === 1);
    check(repeated && Object.values(UNIVERSE_PHASES).reduce((n, p) => n + p.durationSec, 0) === 108,
        'Returning to the finale cannot reuse old rise time to skip gathering; five phase durations still sum to108 seconds');

    const voidState = { currentPhase: '01_VOID' as const, singularityAct: 'INACTIVE' as const,
        ouroborosRelease: { ageSec: 12, timeSec: 108 }, finaleRiseElapsedSec: 12, cycleCount: 2 };
    const releaseStart = evaluateOuroborosEpisode(makeState(0, voidState, 0));
    const releaseHalf = evaluateOuroborosEpisode(makeState(2.6, voidState, 2.6));
    const dust = evaluateOuroborosEpisode(makeState(5.2, voidState, 5.2));
    const fade = evaluateOuroborosEpisode(makeState(6.1, voidState, 6.1));
    const end = evaluateOuroborosEpisode(makeState(6.8, voidState, 6.8));
    check(releaseStart.morph === 1 && Math.abs(releaseHalf.morph - 0.5) < 1e-12 &&
        dust.morph === 0 && dust.opacity === 0.76 && fade.morph === 0 && fade.opacity > 0 && fade.opacity < 0.76 && end.opacity === 0,
        'Phase01 disperses the shape for5.2 seconds before fading the returned dust during5.4–6.8 seconds');

    const Store = universeStore.constructor as new () => typeof universeStore;
    const manual = new Store();
    manual.setPhase('05_SINGULARITY'); advance(manual, 18.55); advance(manual, 21.3);
    const before = evaluateOuroborosEpisode(manual.getState());
    manual.setPhase('01_VOID');
    const after = evaluateOuroborosEpisode(manual.getState());
    advance(manual, 2.6);
    const later = evaluateOuroborosEpisode(manual.getState());
    check(manual.getState().cycleCount === 1 && before.morph > 0 && before.morph < 1 &&
        before.morph === after.morph && before.opacity === after.opacity && before.timeSec === after.timeSec &&
        later.morph < after.morph && Math.abs(later.timeSec - after.timeSec - 2.6) < 1e-12,
        'A real manual first-cycle05→01 transition preserves partially gathered fullness and orientation, then dissolves it');

    manual.setPhase('05_SINGULARITY'); advance(manual, 14.05);
    const returning = evaluateOuroborosEpisode(manual.getState());
    advance(manual, 18.55);
    const returningStart = evaluateOuroborosEpisode(manual.getState());
    advance(manual, 21.3);
    check(returning.opacity === 0 && returningStart.morph === 0 &&
        Math.abs(evaluateOuroborosEpisode(manual.getState()).morph - 0.5) < 1e-12,
        'Real first-cycle re-entry waits for its local gather window instead of materializing fully at ACT_D');
    manual.setPhase('02_GENESIS'); manual.setPhase('01_VOID');
    check(evaluateOuroborosEpisode(manual.getState()).opacity === 0,
        'Entering VOID from an unrelated phase never invents an Ouroboros release');

    const automatic = new Store(); automatic.setPhase('05_SINGULARITY');
    advance(automatic, 18.55); advance(automatic, 29);
    const held = evaluateOuroborosEpisode(automatic.getState());
    advance(automatic, 30.45);
    const next = evaluateOuroborosEpisode(automatic.getState());
    check(automatic.getState().cycleCount === 2 && automatic.getState().currentPhase === '01_VOID' &&
        held.morph === 1 && next.morph === 1 && held.timeSec === next.timeSec && next.timeSec === 108,
        'Automatic restart captures the visible form and enters cycle2 with the same orientation and fullness');

    const staticGather = evaluateOuroborosEpisode(makeState(21, { reducedMotion: true }));
    const staticRelease = evaluateOuroborosEpisode(makeState(2, { ...voidState, reducedMotion: true }));
    check(staticGather.opacity === 0.42 && staticGather.morph === 1 && staticGather.timeSec === 0 &&
        JSON.stringify(staticGather) === JSON.stringify(staticRelease) &&
        evaluateOuroborosEpisode(makeState(6.8, { ...voidState, reducedMotion: true })).opacity === 0,
        'Reduced motion holds one stationary form with the same episode end boundary');

    const previews = [6, 26, 46].map(time => evaluateOuroborosEpisode(makeState(0,
        { currentPhase: '01_VOID', finaleReachedOnce: false, finaleRiseElapsedSec: null, singularityAct: 'INACTIVE' }, time), true));
    check(previews.every((e, i) => e.morph === 1 && e.opacity === 0.76 && e.timeSec === [6, 26, 46][i]) &&
        evaluateOuroborosEpisode(makeState(0, {}, 19), true).opacity === 0,
        'Preview preserves the shared clock and repeats its slower gather/dispersion envelope every20 seconds');

    check([NaN, Infinity, -1].every(rise => evaluateOuroborosEpisode(makeState(24, { finaleRiseElapsedSec: rise })).opacity === 0) &&
        [NaN, Infinity, -1].every(time => evaluateOuroborosEpisode(makeState(24, {}, time), true).timeSec === 0) &&
        Number.isFinite(evaluateOuroborosEpisode(makeState(24, { cycleCount: Number.MAX_VALUE })).timeSec),
        'Malformed rise and clock values stay safe without publishing invalid geometry times');
    check([[320, 568], [390, 844], [1920, 1080], [0, -1], [NaN, Infinity]].every(([w, h]) => {
        const layout = getOuroborosLayout(w, h);
        return Object.values(layout).every(Number.isFinite) && layout.scale > 0;
    }) && getOuroborosLayout(1920, 1080).scale > 1080 * 0.205,
    'The larger composition keeps finite layout on phones, desktop and malformed viewports');
}
// КОНЕЦ ФУНКЦИИ runOuroborosEpisodeChecks
