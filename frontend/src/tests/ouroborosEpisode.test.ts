// ============================================================================
// ФАЙЛ: frontend/src/tests/ouroborosEpisode.test.ts
// НАЗНАЧЕНИЕ: Проверить общие часы подъёма, сборку формы и возврат в поле без DOM.
// РАЗДЕЛЫ: 1. Изолированное состояние; 2. Подъём и переход фаз; 3. Часы и границы.
// ФУНКЦИИ: makeState, runOuroborosEpisodeChecks.
// ============================================================================
import { evaluateOuroborosEpisode, getOuroborosLayout } from '../core/ouroborosEpisode';
import { UNIVERSE_PHASES, universeStore, type UniverseState } from '../store/universeState';

// НАЧАЛО РАЗДЕЛА 1. ИЗОЛИРОВАННОЕ СОСТОЯНИЕ
// НАЧАЛО ФУНКЦИИ makeState
function makeState(phaseElapsedSec = 23, changes: Partial<UniverseState> = {}, simulationTimeSec = 100): UniverseState {
    const base = universeStore.getState();
    return {
        ...base, currentPhase: '05_SINGULARITY', phaseMeta: UNIVERSE_PHASES['05_SINGULARITY'],
        cycleCount: 1, finaleReachedOnce: true, finaleRiseElapsedSec: 4,
        singularityAct: 'ACT_D_GITHUB_CARD', reducedMotion: false,
        ...changes, telemetry: { ...base.telemetry, phaseElapsedSec, simulationTimeSec },
    };
}
// КОНЕЦ ФУНКЦИИ makeState
// КОНЕЦ РАЗДЕЛА 1. ИЗОЛИРОВАННОЕ СОСТОЯНИЕ

// НАЧАЛО ФУНКЦИИ runOuroborosEpisodeChecks
export function runOuroborosEpisodeChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. ПОДЪЁМ И ПЕРЕХОД ФАЗ
    const excluded = [makeState(23, { finaleRiseElapsedSec: null }), makeState(23, { finaleReachedOnce: false }),
        makeState(23, { currentPhase: '03_EVOLUTION' }), makeState(23, { singularityAct: 'ACT_A_ACCRETION' }),
        makeState(23, { singularityAct: 'ACT_B_LOGIC' })];
    const start = evaluateOuroborosEpisode(makeState(18.55, { finaleRiseElapsedSec: 0 }));
    const halfway = evaluateOuroborosEpisode(makeState(20.55, { finaleRiseElapsedSec: 2 }));
    const assembled = evaluateOuroborosEpisode(makeState(22.55, { finaleRiseElapsedSec: 4 }));
    let gatherMonotonic = true;
    let previousOpacity = 0;
    let previousMorph = 0;
    for (let sample = 0; sample <= 80; sample++) {
        const rise = sample * 0.05;
        const result = evaluateOuroborosEpisode(makeState(18.55 + rise, { finaleRiseElapsedSec: rise }));
        gatherMonotonic &&= result.opacity >= previousOpacity - 1e-12 && result.morph >= previousMorph - 1e-12 &&
            result.opacity >= 0 && result.opacity <= 0.76 && result.morph >= 0 && result.morph <= 1;
        previousOpacity = result.opacity;
        previousMorph = result.morph;
    }
    check(excluded.every((state) => evaluateOuroborosEpisode(state).opacity === 0) &&
        start.opacity === 0 && start.morph === 0 && halfway.opacity === 0.76 && Math.abs(halfway.morph - 0.5) < 1e-12 &&
        assembled.opacity === 0.76 && assembled.morph === 1 && gatherMonotonic,
        'The first ACT_D starts gathering exactly with the shared card-rise clock, assembles over four active seconds and excludes the unreleased card');

    const repeatStart = evaluateOuroborosEpisode(makeState(18.55, { cycleCount: 2 }));
    const repeatHalf = evaluateOuroborosEpisode(makeState(20.55, { cycleCount: 2 }));
    const repeatFull = evaluateOuroborosEpisode(makeState(22.55, { cycleCount: 2 }));
    const beforeRestart = evaluateOuroborosEpisode(makeState(29, { cycleCount: 2 }));
    check(repeatStart.opacity === 0 && repeatStart.morph === 0 && Math.abs(repeatHalf.morph - 0.5) < 1e-12 &&
        repeatFull.morph === 1 && beforeRestart.morph === 1 && beforeRestart.opacity === 0.76 &&
        UNIVERSE_PHASES['05_SINGULARITY'].durationSec === 29 &&
        Object.values(UNIVERSE_PHASES).reduce((total, phase) => total + phase.durationSec, 0) === 108,
        'Repeated ACT_D gathers from phase second18.55 and stays assembled through the29-second finale without changing the108-second cycle');

    const firstHold = evaluateOuroborosEpisode(makeState(30.45, { singularityAct: 'RESTART_COLLAPSE', finaleRiseElapsedSec: 12 }, 109.45));
    const repeatedHold = evaluateOuroborosEpisode(makeState(30.45, { cycleCount: 2, singularityAct: 'RESTART_COLLAPSE', finaleRiseElapsedSec: 12 }, 109.45));
    const quietActs = [false, true].every((preview) => [false, true].every((reducedMotion) => {
        const result = evaluateOuroborosEpisode(makeState(23, { singularityAct: 'ACT_C_ZERO_SILENCE', reducedMotion }), preview);
        return result.opacity === 0 && result.morph === 0;
    }));
    check(firstHold.opacity === 0.76 && firstHold.morph === 1 && repeatedHold.opacity === 0.76 && repeatedHold.morph === 1 && quietActs,
        'Restart Collapse retains the assembled form in both first and repeated cycles, while Zero Silence remains excluded even in preview');

    const voidState = { currentPhase: '01_VOID' as const, phaseMeta: UNIVERSE_PHASES['01_VOID'],
        singularityAct: 'INACTIVE' as const, cycleCount: 2 };
    const beginning = evaluateOuroborosEpisode(makeState(0, voidState, 0));
    const middle = evaluateOuroborosEpisode(makeState(1.8, voidState, 1.8));
    const dust = evaluateOuroborosEpisode(makeState(3.6, voidState, 3.6));
    const preFade = evaluateOuroborosEpisode(makeState(3.8, voidState, 3.8));
    const fading = evaluateOuroborosEpisode(makeState(4.4, voidState, 4.4));
    const ended = evaluateOuroborosEpisode(makeState(5, voidState, 5));
    let disperseMonotonic = true;
    previousOpacity = 0.76;
    previousMorph = 1;
    for (let sample = 0; sample <= 100; sample++) {
        const age = sample * 0.05;
        const result = evaluateOuroborosEpisode(makeState(age, voidState, age));
        disperseMonotonic &&= result.opacity <= previousOpacity + 1e-12 && result.morph <= previousMorph + 1e-12 &&
            result.opacity >= 0 && result.opacity <= 0.76 && result.morph >= 0 && result.morph <= 1;
        previousOpacity = result.opacity;
        previousMorph = result.morph;
    }
    check(beginning.opacity === 0.76 && beginning.morph === 1 && Math.abs(middle.morph - 0.5) < 1e-12 &&
        dust.morph === 0 && preFade.morph === 0 && preFade.opacity === 0.76 &&
        fading.morph === 0 && fading.opacity > 0 && fading.opacity < preFade.opacity &&
        ended.opacity === 0 && ended.morph === 0 && disperseMonotonic &&
        evaluateOuroborosEpisode(makeState(1, { ...voidState, cycleCount: 1 }, 1)).opacity === 0,
        'Switching to phase01 starts dispersion immediately; the form returns to field particles by3.6s before dust fades from3.8–5s');
    // КОНЕЦ РАЗДЕЛА 2. ПОДЪЁМ И ПЕРЕХОД ФАЗ

    // НАЧАЛО РАЗДЕЛА 3. ЧАСЫ И БЕЗОПАСНЫЕ ГРАНИЦЫ
    const reducedGather = evaluateOuroborosEpisode(makeState(20, { reducedMotion: true, finaleRiseElapsedSec: 1.45 }));
    const reducedDisperse = evaluateOuroborosEpisode(makeState(2, { ...voidState, reducedMotion: true }, 2));
    check(reducedGather.opacity === 0.42 && reducedGather.morph === 1 && reducedGather.timeSec === 0 &&
        JSON.stringify(reducedGather) === JSON.stringify(reducedDisperse) &&
        evaluateOuroborosEpisode(makeState(5, { ...voidState, reducedMotion: true }, 5)).opacity === 0 &&
        evaluateOuroborosEpisode(makeState(20, { reducedMotion: true, finaleRiseElapsedSec: null })).opacity === 0,
        'Reduced motion keeps eligible gathering and dispersion stationary while preserving card-release and end-of-episode exclusions');

    const previews = [2.8, 16.8, 30.8].map((time) => evaluateOuroborosEpisode(makeState(0,
        { currentPhase: '01_VOID', cycleCount: 1, finaleReachedOnce: false, finaleRiseElapsedSec: null, singularityAct: 'INACTIVE' }, time), true));
    const clockEnd = evaluateOuroborosEpisode(makeState(29, {}, 108));
    const clockCollapse = evaluateOuroborosEpisode(makeState(30.45, { singularityAct: 'RESTART_COLLAPSE' }, 109.45));
    const clockNext = evaluateOuroborosEpisode(makeState(0, voidState, 0));
    const clockNextStep = evaluateOuroborosEpisode(makeState(0.5, voidState, 0.5));
    const unheldClock = evaluateOuroborosEpisode(makeState(30.45, {}, 109.45));
    check(previews.every((result, index) => Math.abs(result.opacity - previews[0].opacity) < 1e-12 &&
        Math.abs(result.morph - previews[0].morph) < 1e-12 && result.timeSec === [2.8, 16.8, 30.8][index]) &&
        evaluateOuroborosEpisode(makeState(0, { cycleCount: 1 }, 13.9), true).opacity === 0 &&
        clockEnd.timeSec === 108 && clockCollapse.timeSec === 108 && clockNext.timeSec === 108 &&
        clockNextStep.timeSec === 108.5 && unheldClock.timeSec === 109.45,
        'Preview repeats modulo14; normal restart holds geometry at108s and enters cycle2 at108s without a backward orientation jump');

    const invalidRise = [NaN, Infinity, -1].flatMap((rise) => [1, 2].map((cycleCount) =>
        evaluateOuroborosEpisode(makeState(23, { finaleRiseElapsedSec: rise, cycleCount }))));
    const invalidClock = [NaN, Infinity, -17].map((time) => evaluateOuroborosEpisode(makeState(23, {}, time), true));
    const hugeCycle = evaluateOuroborosEpisode(makeState(23, { cycleCount: Number.MAX_VALUE }));
    const nearEndpoint = [3.99999999, 3.9999999999, 4].map((rise) => evaluateOuroborosEpisode(makeState(23, { finaleRiseElapsedSec: rise })));
    check(invalidRise.every((result) => result.opacity === 0 && result.morph === 0) &&
        invalidClock.every((result) => result.opacity === 0 && result.morph === 0 && result.timeSec === 0) &&
        Number.isFinite(hugeCycle.timeSec) && nearEndpoint.every((result) => result.morph >= 0 && result.morph <= 1 && result.opacity <= 0.76),
        'Malformed clocks and cycle overflow stay finite; smootherstep rounding never publishes morph beyond the geometry contract');

    const dimensions = [[390, 844], [1920, 1080], [1, 1], [0, -10], [NaN, Infinity], [Number.MAX_VALUE, Number.MAX_VALUE]];
    check(dimensions.every(([width, height]) => {
        const result = getOuroborosLayout(width, height);
        const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
        const safeHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
        return Number.isFinite(result.centerX) && Number.isFinite(result.centerY) && Number.isFinite(result.scale) &&
            result.centerX >= 0 && result.centerX <= safeWidth && result.centerY >= 0 && result.centerY <= safeHeight &&
            result.scale > 0 && result.scale <= Math.min(safeWidth, safeHeight);
    }), 'Portrait, desktop and malformed viewport dimensions retain finite positive layout within their normalized viewport');
    // КОНЕЦ РАЗДЕЛА 3. ЧАСЫ И БЕЗОПАСНЫЕ ГРАНИЦЫ
}
// КОНЕЦ ФУНКЦИИ runOuroborosEpisodeChecks
