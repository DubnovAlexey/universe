// ============================================================================
// ФАЙЛ: frontend/src/core/visualSignals.ts
// НАЗНАЧЕНИЕ: Один снимок сигналов и opt-in пакет DOM-записей в том же кадре.
// РАЗДЕЛЫ: 1. Контракт; 2. Нормализация; 3. Публикация и подписки.
// ФУНКЦИИ: createVisualSignals, runSignalWork, publishVisualSignals, getVisualSignals,
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
/** Опциональные записи принимаются только во время собственного callback.
 * FIFO flush идёт после всех callbacks до возврата publish; поздний write — no-op. */
export interface VisualSignalFrame {
    write(commit: () => void): void;
}
export type VisualSignalListener = (signals: Readonly<VisualSignalSnapshot>, frame?: VisualSignalFrame) => void;
interface SignalSubscription { readonly listener: VisualSignalListener; readonly label: string; }
interface SignalWrite { readonly owner: SignalSubscription; readonly commit: () => void; }
let latest: Readonly<VisualSignalSnapshot> = Object.freeze({
    tick: 0, simTimeSec: 0, frameDtSec: 0, phase: '01_VOID', phaseProgress: 0,
    isPaused: false, reducedMotion: false, seed: 104729,
    low: 0, mid: 0, high: 0, pulse: 0, heartbeat: 0, kuramotoR: 0, globalStress: 0,
});
const listeners = new Map<VisualSignalListener, SignalSubscription>();
let publishing = false;
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
// НАЧАЛО ФУНКЦИИ runSignalWork
/** Label включает и вычислительную часть, и собственный отложенный commit, даже при ошибке. */
function runSignalWork(task: () => void, label: string, timings: Record<string, number> | undefined): void {
    if (!timings) { task(); return; }
    const start = performance.now();
    try { task(); }
    finally { timings[label] = (timings[label] ?? 0) + performance.now() - start; }
}
// КОНЕЦ ФУНКЦИИ runSignalWork

// НАЧАЛО ФУНКЦИИ publishVisualSignals
/** Legacy callbacks сохраняют порядок и немедленные действия. Только frame.write откладывает DOM.
 * Live Map add/delete semantics сохранены. Вложенный publish отклоняется до замены latest.
 * При ошибке вычисления уже подготовленные valid jobs завершаются; первая ошибка передаётся renderer. */
export function publishVisualSignals(
    state: Readonly<UniverseState>, audio: Readonly<AudioModulationSnapshot>, stress: Readonly<StressStateData>,
    profile = false, beforeDomWrite?: () => void
): Record<string, number> | undefined {
    if (publishing) throw new Error('Reentrant visual signal publication is not supported');
    const snapshot = createVisualSignals(state, audio, stress);
    latest = snapshot;
    publishing = true;
    const timings: Record<string, number> | undefined = profile ? {} : undefined;
    const writes: SignalWrite[] = [];
    let failed = false;
    let failure: unknown;
    try {
        listeners.forEach((subscription, listener) => {
            let enqueue: ((commit: () => void) => void) | null = commit => {
                if (listeners.get(listener) === subscription) writes.push({ owner: subscription, commit });
            };
            const frame: VisualSignalFrame = { write: commit => enqueue?.(commit) };
            try { runSignalWork(() => listener(snapshot, frame), subscription.label, timings); }
            finally { enqueue = null; } // Stale context не удерживает доступ к очереди следующего кадра.
        });
        // Canvas-текст тоже обращается к computed style. Его измерения/отрисовка
        // завершаются до DOM-записей, но остаются внутри того же синхронного кадра.
        beforeDomWrite?.();
    } catch (error) {
        failed = true;
        failure = error;
    } finally {
        try {
            for (const job of writes) {
                if (listeners.get(job.owner.listener) !== job.owner) continue;
                try { runSignalWork(job.commit, job.owner.label, timings); }
                catch (error) { if (!failed) { failed = true; failure = error; } }
            }
        } finally {
            writes.length = 0;
            publishing = false;
        }
    }
    if (failed) throw failure;
    return timings;
}
// КОНЕЦ ФУНКЦИИ publishVisualSignals
// НАЧАЛО ФУНКЦИИ getVisualSignals
export function getVisualSignals(): Readonly<VisualSignalSnapshot> { return latest; }
// КОНЕЦ ФУНКЦИИ getVisualSignals
// НАЧАЛО ФУНКЦИИ subscribeVisualSignals
export function subscribeVisualSignals(listener: VisualSignalListener, label = 'unlabelled'): () => void {
    const subscription = { listener, label };
    listeners.set(listener, subscription);
    return () => { if (listeners.get(listener) === subscription) listeners.delete(listener); };
}
// КОНЕЦ ФУНКЦИИ subscribeVisualSignals
// КОНЕЦ РАЗДЕЛА 3
