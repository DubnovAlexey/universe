// ============================================================================
// ФАЙЛ: frontend/src/core/ouroborosEpisode.ts
// НАЗНАЧЕНИЕ: Время появления Уробороса и безопасная область его композиции.
// РАЗДЕЛЫ: 1. Контракты; 2. Эпизод; 3. Размещение.
// ФУНКЦИИ: evaluateOuroborosEpisode, getOuroborosLayout.
// ============================================================================
import { smootherstep, UNIVERSE_PHASES, type UniverseState } from '../store/universeState';
const CYCLE_DURATION_SEC = Object.values(UNIVERSE_PHASES).reduce((sum, phase) => sum + phase.durationSec, 0);

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТЫ
export interface OuroborosEpisode {
    readonly opacity: number;
    readonly morph: number;
    readonly timeSec: number;
}
export interface OuroborosLayout {
    readonly centerX: number;
    readonly centerY: number;
    readonly scale: number;
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ЭПИЗОД НА ОБЩИХ ЧАСАХ
// НАЧАЛО ФУНКЦИИ evaluateOuroborosEpisode
/** Подъём открывает сборку; первая фаза возвращает собранную форму в то же поле. */
export function evaluateOuroborosEpisode(state: Readonly<UniverseState>, preview = false): OuroborosEpisode {
    const safeCycleTime = Number.isFinite(state.telemetry.simulationTimeSec) ? Math.max(0, state.telemetry.simulationTimeSec) : 0;
    // Restart продолжает вращение от фактически показанной позы, даже после задержки финала наведением.
    const restart = state.currentPhase === '05_SINGULARITY' && state.singularityAct === 'RESTART_COLLAPSE'
        ? state.ouroborosRelease : null;
    const restartAge = Number.isFinite(state.restartElapsedSec) ? Math.max(0, state.restartElapsedSec) : 0;
    const cycleIndex = Number.isFinite(state.cycleCount) ? Math.max(0, state.cycleCount - 1) : 0;
    const combinedTime = restart !== null ? restart.timeSec + restartAge : safeCycleTime + cycleIndex * CYCLE_DURATION_SEC;
    let timeSec = Number.isFinite(combinedTime) ? combinedTime : 0;
    if (state.singularityAct === 'ACT_C_ZERO_SILENCE') {
        return { opacity: 0, morph: 0, timeSec };
    }
    let opacity = 0;
    let morph = 0;
    if (preview) {
        const age = timeSec % 30;
        if (age < 27.5) {
            opacity = Math.max(0, 0.76 * smootherstep(0, 0.8, age) * (1 - smootherstep(25.7, 27.5, age)));
            morph = Math.max(0, smootherstep(0, 5.5, age) * (1 - smootherstep(18.3, 25.5, age)));
        }
    } else if (state.finaleReachedOnce && state.finaleRiseElapsedSec !== null &&
        Number.isFinite(state.finaleRiseElapsedSec) && state.finaleRiseElapsedSec >= 0) {
        if (state.currentPhase === '05_SINGULARITY' &&
            (state.singularityAct === 'ACT_D_GITHUB_CARD' || state.singularityAct === 'RESTART_COLLAPSE')) {
            const age = restart !== null ? restart.ageSec : Math.min(state.finaleRiseElapsedSec, state.telemetry.phaseElapsedSec - 18.55);
            if (Number.isFinite(age) && age >= 0) {
                opacity = 0.76 * smootherstep(0, 0.8, age);
                morph = smootherstep(0, 5.5, age);
            }
        } else if (state.currentPhase === '01_VOID' && state.ouroborosRelease !== null) {
            const age = state.telemetry.phaseElapsedSec;
            const release = state.ouroborosRelease;
            if (Number.isFinite(age) && age >= 0 && age < 16.8 &&
                Number.isFinite(release.ageSec) && release.ageSec >= 0 &&
                Number.isFinite(release.timeSec) && release.timeSec >= 0) {
                const fullness = smootherstep(0, 5.5, release.ageSec);
                // Полная форма завершает оборот в начале VOID; ручной ранний выход не досбирает её насильно.
                const hold = fullness === 1 ? 7.6 : 0;
                opacity = Math.max(0, 0.76 * smootherstep(0, 0.8, release.ageSec) * (1 - smootherstep(hold + 7.4, hold + 9.2, age)));
                morph = Math.max(0, fullness * (1 - smootherstep(hold, hold + 7.2, age)));
                timeSec = release.timeSec + age;
            }
        }
    }
    // Защита от погрешности smootherstep около единицы сохраняет контракт geometry/morph.
    opacity = Math.max(0, Math.min(0.76, opacity));
    morph = Math.max(0, Math.min(1, morph));
    if (state.reducedMotion && opacity > 0) return { opacity: 0.42, morph: 1, timeSec: 0 };
    return { opacity, morph, timeSec };
}
// КОНЕЦ ФУНКЦИИ evaluateOuroborosEpisode
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. КОМПОЗИЦИОННАЯ ОБЛАСТЬ
// НАЧАЛО ФУНКЦИИ getOuroborosLayout
/** Форма использует центр общего поля вместе с дрейфом камеры; визитка освобождает эту область. */
export function getOuroborosLayout(width: number, height: number, driftX = 0, driftY = 0): OuroborosLayout {
    const w = Number.isFinite(width) ? Math.max(1, width) : 1;
    const h = Number.isFinite(height) ? Math.max(1, height) : 1;
    const dx = Number.isFinite(driftX) ? driftX : 0;
    const dy = Number.isFinite(driftY) ? driftY : 0;
    return { centerX: w * 0.5 + dx, centerY: h * 0.5 + dy, scale: Math.min(w, h) * 0.232 };
}
// КОНЕЦ ФУНКЦИИ getOuroborosLayout
// КОНЕЦ РАЗДЕЛА 3
