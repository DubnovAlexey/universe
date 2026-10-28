// ============================================================================
// ФАЙЛ: frontend/src/tests/ouroborosEpisode.test.ts
// НАЗНАЧЕНИЕ: Проверить подъём, медленную сборку и непрерывные ручные переходы формы.
// РАЗДЕЛЫ: 1. Изолированное состояние; 2. Огибающие; 3. Реальные переходы store.
// ФУНКЦИИ: makeState, advance, runOuroborosEpisodeChecks.
// ============================================================================
import { evaluateOuroborosEpisode, getOuroborosLayout } from '../core/ouroborosEpisode';
import { fillOuroborosPoints } from '../core/ouroborosModel';
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
    const heldTurn = evaluateOuroborosEpisode(makeState(7.6, voidState, 7.6));
    const releaseHalf = evaluateOuroborosEpisode(makeState(11.2, voidState, 11.2));
    const dust = evaluateOuroborosEpisode(makeState(14.8, voidState, 14.8));
    const fade = evaluateOuroborosEpisode(makeState(15.9, voidState, 15.9));
    const end = evaluateOuroborosEpisode(makeState(16.8, voidState, 16.8));
    check(releaseStart.morph === 1 && heldTurn.morph === 1 && Math.abs(releaseHalf.morph - 0.5) < 1e-12 &&
        dust.morph === 0 && dust.opacity === 0.76 && fade.morph === 0 && fade.opacity > 0 && fade.opacity < 0.76 && end.opacity === 0,
        'Phase01 first holds the full turn, disperses for7.2 seconds and fades returned dust during15–16.8 seconds');

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
    advance(automatic, 29.725);
    const midway = evaluateOuroborosEpisode(automatic.getState());
    advance(automatic, 30.45);
    const next = evaluateOuroborosEpisode(automatic.getState());
    check(automatic.getState().cycleCount === 2 && automatic.getState().currentPhase === '01_VOID' &&
        held.morph === 1 && next.morph === 1 && held.timeSec === 108 &&
        Math.abs(midway.timeSec - held.timeSec - 0.725) < 1e-10 && Math.abs(next.timeSec - held.timeSec - 1.45) < 1e-10,
        'Automatic restart keeps turning for its whole1.45 seconds and hands the current orientation to cycle2');

    const noStall = new Store(); noStall.setPhase('05_SINGULARITY');
    advance(noStall, 18.55); advance(noStall, 29);
    const pose = new Float32Array(6 * 8);
    let previousTime = evaluateOuroborosEpisode(noStall.getState()).timeSec;
    fillOuroborosPoints(pose, 104729, 6, previousTime, 1, 0.5);
    let previousHead = Array.from(pose.subarray(0, 3));
    let movingThroughRestart = true;
    for (let frame = 1; frame <= 29; frame++) {
        advance(noStall, 29 + frame * 0.05);
        const episode = evaluateOuroborosEpisode(noStall.getState());
        fillOuroborosPoints(pose, 104729, 6, episode.timeSec, 1, 0.5);
        movingThroughRestart &&= Math.abs(episode.timeSec - previousTime - 0.05) < 1e-10 &&
            Math.hypot(pose[0] - previousHead[0], pose[1] - previousHead[1], pose[2] - previousHead[2]) > 1e-5;
        previousTime = episode.timeSec;
        previousHead = Array.from(pose.subarray(0, 3));
    }
    check(movingThroughRestart && noStall.getState().currentPhase === '01_VOID',
        'The visible head moves on every50ms step through restart and its VOID handoff instead of freezing for1.45 seconds');

    const restartingState = makeState(29.8, { singularityAct: 'RESTART_COLLAPSE', restartElapsedSec: 0.8,
        ouroborosRelease: { ageSec: 10.45, timeSec: 108 } });
    const restartPose = evaluateOuroborosEpisode(restartingState);
    check([{ ...restartingState, isPaused: true }, { ...restartingState, isTabHidden: true }]
        .every(stoppedState => JSON.stringify(evaluateOuroborosEpisode(stoppedState)) === JSON.stringify(restartPose)),
        'Pause and hidden-tab states retain restart orientation when the shared active clock is unchanged');

    const delayed = new Store();
    let delayedContinuous = true;
    for (let cycle = 1; cycle <= 2; cycle++) {
        delayed.setPhase('05_SINGULARITY'); advance(delayed, 18.55); advance(delayed, 24.05);
        delayed.setFinaleCardHovered(true); advance(delayed, 34.25);
        const shown = evaluateOuroborosEpisode(delayed.getState());
        delayed.setFinaleCardHovered(false); advance(delayed, 34.25);
        const restart = evaluateOuroborosEpisode(delayed.getState());
        advance(delayed, 34.975);
        const collapsing = evaluateOuroborosEpisode(delayed.getState());
        advance(delayed, 35.7);
        const released = evaluateOuroborosEpisode(delayed.getState());
        delayedContinuous &&= shown.timeSec === 113.25 + (cycle - 1) * 108 &&
            JSON.stringify(shown) === JSON.stringify(restart) &&
            Math.abs(collapsing.timeSec - shown.timeSec - 0.725) < 1e-10 &&
            Math.abs(released.timeSec - shown.timeSec - 1.45) < 1e-10 &&
            released.morph === shown.morph && released.opacity === shown.opacity && delayed.getState().currentPhase === '01_VOID' &&
            delayed.getState().cycleCount === cycle + 1;
        advance(delayed, 0.25);
        delayedContinuous &&= Math.abs(evaluateOuroborosEpisode(delayed.getState()).timeSec - released.timeSec - 0.25) < 1e-10;
    }
    check(delayedContinuous,
        'Hover-delayed restarts keep the actual time beyond108 seconds moving through collapse and VOID without a cycle-offset jump');

    const earlyRestart = new Store(); earlyRestart.toggleAutoCycle(); earlyRestart.setPhase('05_SINGULARITY');
    advance(earlyRestart, 18.55); advance(earlyRestart, 21.3);
    const partialBefore = evaluateOuroborosEpisode(earlyRestart.getState());
    earlyRestart.triggerUniverseRestart();
    const partialStart = evaluateOuroborosEpisode(earlyRestart.getState());
    advance(earlyRestart, 22.025);
    const partialCollapse = evaluateOuroborosEpisode(earlyRestart.getState());
    advance(earlyRestart, 22.75);
    const partialRelease = evaluateOuroborosEpisode(earlyRestart.getState());
    check(partialBefore.morph > 0 && partialBefore.morph < 1 &&
        [partialStart, partialCollapse, partialRelease].every(e => e.morph === partialBefore.morph && e.opacity === partialBefore.opacity) &&
        partialStart.timeSec === partialBefore.timeSec && Math.abs(partialCollapse.timeSec - partialBefore.timeSec - 0.725) < 1e-10 &&
        Math.abs(partialRelease.timeSec - partialBefore.timeSec - 1.45) < 1e-10,
        'Manual Restart retains partial gathering while rotation continues smoothly through collapse into VOID');

    const staticGather = evaluateOuroborosEpisode(makeState(21, { reducedMotion: true }));
    const staticRelease = evaluateOuroborosEpisode(makeState(2, { ...voidState, reducedMotion: true }));
    check(staticGather.opacity === 0.42 && staticGather.morph === 1 && staticGather.timeSec === 0 &&
        JSON.stringify(staticGather) === JSON.stringify(staticRelease) &&
        evaluateOuroborosEpisode(makeState(16.8, { ...voidState, reducedMotion: true })).opacity === 0,
        'Reduced motion holds one stationary form with the same episode end boundary');

    const previews = [6, 36, 66].map(time => evaluateOuroborosEpisode(makeState(0,
        { currentPhase: '01_VOID', finaleReachedOnce: false, finaleRiseElapsedSec: null, singularityAct: 'INACTIVE' }, time), true));
    check(previews.every((e, i) => e.morph === 1 && e.opacity === 0.76 && e.timeSec === [6, 36, 66][i]) &&
        evaluateOuroborosEpisode(makeState(0, {}, 29), true).opacity === 0,
        'Preview preserves the shared clock and gives a full turn before its slow dispersion on a30-second envelope');

    check([NaN, Infinity, -1].every(rise => evaluateOuroborosEpisode(makeState(24, { finaleRiseElapsedSec: rise })).opacity === 0) &&
        [NaN, Infinity, -1].every(time => evaluateOuroborosEpisode(makeState(24, {}, time), true).timeSec === 0) &&
        Number.isFinite(evaluateOuroborosEpisode(makeState(24, { cycleCount: Number.MAX_VALUE })).timeSec),
        'Malformed rise and clock values stay safe without publishing invalid geometry times');
    check([[320, 568], [390, 844], [1920, 1080], [0, -1], [NaN, Infinity]].every(([w, h]) => {
        const layout = getOuroborosLayout(w, h);
        return Object.values(layout).every(Number.isFinite) && layout.scale > 0;
    }) && getOuroborosLayout(1920, 1080).scale > 1080 * 0.205,
    'The larger composition keeps finite layout on phones, desktop and malformed viewports');
    check([[320, 568], [390, 844], [768, 1024], [1920, 1080]].every(([width, height]) =>
        [[0, 0], [-10.5, 8], [10.5, -8]].every(([driftX, driftY]) => {
            const layout = getOuroborosLayout(width, height, driftX, driftY);
            return layout.centerX === width / 2 + driftX && layout.centerY === height / 2 + driftY;
        })) && getOuroborosLayout(390, 844, NaN, Infinity).centerY === 422,
    'Ouroboros shares the exact field-camera center on phones and desktop, including drift, without an independent lower offset');
}
// КОНЕЦ ФУНКЦИИ runOuroborosEpisodeChecks
