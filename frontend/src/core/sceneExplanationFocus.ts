// ============================================================================
// ФАЙЛ: frontend/src/core/sceneExplanationFocus.ts
// НАЗНАЧЕНИЕ: Плавный контекст выбранного пояснения без изменения сценария и физики.
// РАЗДЕЛЫ: 1. Карта тем и контракт; 2. Ограниченное состояние общего кадра.
// ФУНКЦИИ: getSceneExplanationChannel, selectTopic, advance, getSnapshot, reset.
// Собственного RAF, таймеров, DOM-подписок и записи в universeStore здесь нет.
// ============================================================================
import type { VisualSignalSnapshot } from './visualSignals';

// НАЧАЛО РАЗДЕЛА 1. СЕМАНТИЧЕСКАЯ КАРТА И КОНТРАКТ
export type SceneExplanationChannel = 'field' | 'synchrony' | 'connections' | 'dust' | 'ouroboros';
type TopicChannel = SceneExplanationChannel | null;

/** Темы оболочки и независимого Python-эталона не изображаются выдуманной физикой. */
export const SCENE_EXPLANATION_CHANNELS: Readonly<Record<string, TopicChannel>> = Object.freeze({
    overview: null,
    polyglot: 'field',
    astro: null,
    typescript: 'field',
    'jsx-dom': null,
    'canvas-wgsl': 'field',
    'rust-wasm': 'field',
    python: null,
    symplectic: 'field',
    kuramoto: 'synchrony',
    nexus: 'connections',
    prng: 'field',
    fbm: 'dust',
    plummer: 'field',
    ouroboros: 'ouroboros',
});
const CHANNELS = ['field', 'synchrony', 'connections', 'dust', 'ouroboros'] as const;
const FADE_TIME_SEC = 0.55;

export interface SceneExplanationFocusSnapshot {
    readonly topicId: string | null;
    readonly field: number;
    readonly synchrony: number;
    readonly connections: number;
    readonly dust: number;
    readonly ouroboros: number;
}
type MutableFocus = { -readonly [K in keyof SceneExplanationFocusSnapshot]: SceneExplanationFocusSnapshot[K] };

// НАЧАЛО ФУНКЦИИ getSceneExplanationChannel
/** Неизвестный идентификатор всегда означает отсутствие дополнительного акцента. */
export function getSceneExplanationChannel(topicId: string | null): TopicChannel {
    return topicId !== null && Object.prototype.hasOwnProperty.call(SCENE_EXPLANATION_CHANNELS, topicId)
        ? SCENE_EXPLANATION_CHANNELS[topicId] : null;
}
// КОНЕЦ ФУНКЦИИ getSceneExplanationChannel
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ОДНО ПОВТОРНО ИСПОЛЬЗУЕМОЕ СОСТОЯНИЕ НА СТРАНИЦУ
export class SceneExplanationFocus {
    private target: TopicChannel = null;
    private readonly snapshot: MutableFocus = {
        topicId: null, field: 0, synchrony: 0, connections: 0, dust: 0, ouroboros: 0,
    };

    // НАЧАЛО ФУНКЦИИ selectTopic
    /** Меняет только цель перехода: переключение темы не сбрасывает текущую яркость. */
    public selectTopic(topicId: string | null): void {
        this.snapshot.topicId = topicId !== null && Object.prototype.hasOwnProperty.call(SCENE_EXPLANATION_CHANNELS, topicId)
            ? topicId : null;
        this.target = getSceneExplanationChannel(this.snapshot.topicId);
    }
    // КОНЕЦ ФУНКЦИИ selectTopic

    // НАЧАЛО ФУНКЦИИ advance
    /**
     * Общий кадр ведёт экспоненциальный переход. На паузе и при reduced motion
     * выбор сразу даёт неподвижный акцент, поэтому пояснение остаётся полезным.
     * Малые хвосты обнуляются, чтобы закрытая панель не оставляла постоянный проход.
     */
    public advance(signals: Pick<VisualSignalSnapshot, 'frameDtSec' | 'isPaused' | 'reducedMotion'>): Readonly<SceneExplanationFocusSnapshot> {
        const immediate = signals.isPaused || signals.reducedMotion;
        const dt = Number.isFinite(signals.frameDtSec) ? Math.max(0, Math.min(0.05, signals.frameDtSec)) : 0;
        const blend = immediate ? 1 : -Math.expm1(-dt / FADE_TIME_SEC);
        for (const channel of CHANNELS) {
            const target = channel === this.target ? 1 : 0;
            const next = this.snapshot[channel] + (target - this.snapshot[channel]) * blend;
            this.snapshot[channel] = Math.abs(next - target) < 0.0001 ? target : next;
        }
        return this.snapshot;
    }
    // КОНЕЦ ФУНКЦИИ advance

    // НАЧАЛО ФУНКЦИИ getSnapshot
    /** Представление переиспользуется; потребитель не должен хранить его как историю. */
    public getSnapshot(): Readonly<SceneExplanationFocusSnapshot> { return this.snapshot; }
    // КОНЕЦ ФУНКЦИИ getSnapshot

    // НАЧАЛО ФУНКЦИИ reset
    /** Полный сброс нужен только при освобождении всей страницы, а не при закрытии окна. */
    public reset(): void {
        this.selectTopic(null);
        for (const channel of CHANNELS) this.snapshot[channel] = 0;
    }
    // КОНЕЦ ФУНКЦИИ reset
}
export const sceneExplanationFocus = new SceneExplanationFocus();
// КОНЕЦ РАЗДЕЛА 2
