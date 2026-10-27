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
    // Collapse завершается после конца обычного цикла: удерживаем ориентацию до reset часов.
    const cycleTime = state.currentPhase === '05_SINGULARITY' && state.singularityAct === 'RESTART_COLLAPSE'
        ? Math.min(CYCLE_DURATION_SEC, safeCycleTime) : safeCycleTime;
    const cycleIndex = Number.isFinite(state.cycleCount) ? Math.max(0, state.cycleCount - 1) : 0;
    const combinedTime = cycleTime + cycleIndex * CYCLE_DURATION_SEC;
    const timeSec = Number.isFinite(combinedTime) ? combinedTime : 0;
    if (state.singularityAct === 'ACT_C_ZERO_SILENCE') {
        return { opacity: 0, morph: 0, timeSec };
    }
    let opacity = 0;
    let morph = 0;
    if (preview) {
        const age = timeSec % 14;
        if (age < 9.5) {
            opacity = Math.max(0, 0.76 * smootherstep(0, 0.8, age) * (1 - smootherstep(8.5, 9.4, age)));
            morph = Math.max(0, smootherstep(0.5, 2.4, age) * (1 - smootherstep(6.2, 8.2, age)));
        }
    } else if (state.finaleReachedOnce && state.finaleRiseElapsedSec !== null &&
        Number.isFinite(state.finaleRiseElapsedSec) && state.finaleRiseElapsedSec >= 0) {
        if (state.currentPhase === '05_SINGULARITY' &&
            (state.singularityAct === 'ACT_D_GITHUB_CARD' || state.singularityAct === 'RESTART_COLLAPSE')) {
            const age = state.cycleCount === 1 ? state.finaleRiseElapsedSec : state.telemetry.phaseElapsedSec - 18.55;
            if (Number.isFinite(age) && age >= 0) {
                opacity = 0.76 * smootherstep(0, 0.8, age);
                morph = smootherstep(0, 4, age);
            }
        } else if (state.currentPhase === '01_VOID' && state.cycleCount > 1) {
            const age = state.telemetry.phaseElapsedSec;
            if (Number.isFinite(age) && age >= 0 && age < 5) {
                opacity = Math.max(0, 0.76 * (1 - smootherstep(3.8, 5, age)));
                morph = Math.max(0, 1 - smootherstep(0, 3.6, age));
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
/** Локальный образ располагается под поднятой визиткой, дальнее кольцо окружает его. */
export function getOuroborosLayout(width: number, height: number): OuroborosLayout {
    const w = Number.isFinite(width) ? Math.max(1, width) : 1;
    const h = Number.isFinite(height) ? Math.max(1, height) : 1;
    return { centerX: w * 0.5, centerY: h * (w <= 600 ? 0.59 : 0.58), scale: Math.min(w, h) * 0.205 };
}
// КОНЕЦ ФУНКЦИИ getOuroborosLayout
// КОНЕЦ РАЗДЕЛА 3
