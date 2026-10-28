// ============================================================================
// ФАЙЛ: frontend/src/core/visualSignals.ts
// НАЗНАЧЕНИЕ: Один неизменяемый снимок фазовых и музыкальных сигналов на кадр.
// РАЗДЕЛЫ: 1. Контракт; 2. Нормализация; 3. Публикация и подписки.
// ФУНКЦИИ: createVisualSignals, publishVisualSignals, getVisualSignals,
// subscribeVisualSignals. Планировщики и анализаторы здесь не создаются.
// ============================================================================
import type { UniverseState, PhaseId } from '../store/universeState';
import type { AudioModulationSnapshot } from '../utils/audioSync';
import type { StressStateData } from '../store/stressState';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ
export interface VisualSignalSnapshot {
    readonly tick: number;
    readonly simTimeSec: number;
    readonly frameDtSec: number;
    readonly phase: PhaseId;
    readonly phaseProgress: number;
    readonly isPaused: boolean;
    readonly reducedMotion: boolean;
    readonly seed: number;
    readonly low: number;
    readonly mid: number;
    readonly high: number;
    readonly pulse: number;
    readonly heartbeat: number;
    readonly kuramotoR: number;
    readonly globalStress: number;
}
let latest: Readonly<VisualSignalSnapshot> = Object.freeze({
    tick: 0, simTimeSec: 0, frameDtSec: 0, phase: '01_VOID', phaseProgress: 0,
    isPaused: false, reducedMotion: false, seed: 104729,
    low: 0, mid: 0, high: 0, pulse: 0, heartbeat: 0, kuramotoR: 0, globalStress: 0,
});
const listeners = new Map<(signals: Readonly<VisualSignalSnapshot>) => void, string>();
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. НОРМАЛИЗАЦИЯ
// НАЧАЛО ФУНКЦИИ unit
function unit(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
// КОНЕЦ ФУНКЦИИ unit

// НАЧАЛО ФУНКЦИИ createVisualSignals
export function createVisualSignals(
    state: Readonly<UniverseState>, audio: Readonly<AudioModulationSnapshot>,
    stress: Readonly<StressStateData>
): Readonly<VisualSignalSnapshot> {
    const channel = (value: number): number => audio.isPlaying ? unit(value) : 0;
    const isPaused = state.isPaused || state.isTabHidden;
    const frameTimeMs = state.telemetry.frameTimeMs;
    return Object.freeze({
        tick: state.telemetry.tick,
        simTimeSec: Number.isFinite(state.telemetry.simulationTimeSec) ? state.telemetry.simulationTimeSec : 0,
        frameDtSec: isPaused || !Number.isFinite(frameTimeMs) ? 0 : Math.max(0, Math.min(0.05, frameTimeMs / 1000)),
        phase: state.currentPhase, phaseProgress: unit(state.telemetry.phaseProgress),
        isPaused, reducedMotion: state.reducedMotion,
        seed: state.seed >>> 0, low: channel(audio.low), mid: channel(audio.mid),
        high: channel(audio.high), pulse: channel(audio.pulse), heartbeat: channel(audio.heartbeat),
        kuramotoR: unit(state.telemetry.kuramotoOrderR), globalStress: unit(stress.globalStress),
    });
}
// КОНЕЦ ФУНКЦИИ createVisualSignals
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ПУБЛИКАЦИЯ И ПОДПИСКИ
// НАЧАЛО ФУНКЦИИ publishVisualSignals
export function publishVisualSignals(
    state: Readonly<UniverseState>, audio: Readonly<AudioModulationSnapshot>, stress: Readonly<StressStateData>,
    profile = false
): Record<string, number> | undefined {
    latest = createVisualSignals(state, audio, stress);
    const timings: Record<string, number> | undefined = profile ? {} : undefined;
    listeners.forEach((label, listener) => {
        if (!timings) { listener(latest); return; }
        const start = performance.now();
        listener(latest);
        timings[label] = (timings[label] ?? 0) + performance.now() - start;
    });
    return timings;
}
// КОНЕЦ ФУНКЦИИ publishVisualSignals
// НАЧАЛО ФУНКЦИИ getVisualSignals
export function getVisualSignals(): Readonly<VisualSignalSnapshot> { return latest; }
// КОНЕЦ ФУНКЦИИ getVisualSignals
// НАЧАЛО ФУНКЦИИ subscribeVisualSignals
export function subscribeVisualSignals(listener: (signals: Readonly<VisualSignalSnapshot>) => void, label = 'unlabelled'): () => void {
    listeners.set(listener, label);
    return () => { listeners.delete(listener); };
}
// КОНЕЦ ФУНКЦИИ subscribeVisualSignals
// КОНЕЦ РАЗДЕЛА 3
