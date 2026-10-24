// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer5_CipherFinale.tsx
// НАЗНАЧЕНИЕ: Видимый семантический DOM-слой финальной визитки DUBNOV ALEXEY,
//             быстрой парящей в воздухе квантовой строки (~3.5x быстрее) и
//             постоянного полупрозрачного режима на фоне цикла (MASTER 05 v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ:
//   РАЗДЕЛ 1. Расширенный пул квантовых глифов и контроллер перебора при
//             наведении мыши (triggerLineOrButtonScramble).
//   РАЗДЕЛ 2. Контроллер 60-FPS анимации визитки (FinaleCardDomAnimator):
//     - Подраздел 2.1. Жизненный цикл RAF (активен в Акте D и в постоянном
//                      полупрозрачном фоновом режиме после первого цикла).
//     - Подраздел 2.2. Ускоренная в ~3.5 раза квантовая строка (18–26 Гц,
//                      индивидуальное вращение каждого знака без рамок) и
//                      гарантированная 100%-ная фиксация строк 0, 1, 3, 4.
//   РАЗДЕЛ 3. Семантический компонент визитки (renderLayer5CipherFinaleView)
//             с поддержкой полупрозрачного режима .ambient-loop и защитой
//             aria-hidden / tabIndex при скрытом состоянии.
//   РАЗДЕЛ 4. Mount-once монтировщик (mountLayer5CipherFinale).
// ============================================================================

import { React } from './Layer2_Metrics';
import { CANONICAL_FINALE_LINES } from '../bridge/cipherOdometerEngine';
import { smootherstep, universeStore, type UniverseState } from '../store/universeState';
import { audioSync } from '../utils/audioSync';

// ============================================================================
// РАЗДЕЛ 1. КОНСТАНТЫ ГЛИФОВ И КОНТРОЛЛЕР ПЛАВНОГО КВАНТОВОГО ПЕРЕБОРА
// ============================================================================

const SCRAMBLE_GLYPHS =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡⊕⊗⊙⊥⊢⊣⟨⟩⟦⟧◊◈✶✴⟡∷';

const activeScrambleTimers = new WeakMap<HTMLElement, number>();

// --- НАЧАЛО ФУНКЦИИ triggerLineOrButtonScramble ---
/**
 * Запускает плавный квантовый перебор символов на статической строке визитки
 * или кнопке при наведении мыши (шаг 52 мс) с гарантированным возвратом
 * точного канонического текста.
 */
function triggerLineOrButtonScramble(el: HTMLElement, canonicalText: string): void {
    if (universeStore.getState().reducedMotion) {
        el.textContent = canonicalText;
        return;
    }

    const prevTimer = activeScrambleTimers.get(el);
    if (prevTimer !== undefined) {
        window.clearInterval(prevTimer);
        activeScrambleTimers.delete(el);
    }

    let step = 0;
    const totalSteps = 10;

    const timer = window.setInterval(() => {
        step++;
        if (step >= totalSteps) {
            el.textContent = canonicalText;
            window.clearInterval(timer);
            activeScrambleTimers.delete(el);
            return;
        }

        const lockBoundary = Math.floor((step / totalSteps) * canonicalText.length);
        el.textContent = canonicalText
            .split('')
            .map((ch: string, idx: number): string => {
                if (
                    ch === ' ' ||
                    ch === '[' ||
                    ch === ']' ||
                    ch === '·' ||
                    ch === ':' ||
                    ch === '(' ||
                    ch === ')' ||
                    ch === '↗' ||
                    ch === '↻' ||
                    idx < lockBoundary
                ) {
                    return ch;
                }
                if ((idx + step) % 2 !== 0) {
                    return ch;
                }
                return SCRAMBLE_GLYPHS[(idx * 11 + step * 5) % SCRAMBLE_GLYPHS.length];
            })
            .join('');
    }, 52);

    activeScrambleTimers.set(el, timer);
}
// --- КОНЕЦ ФУНКЦИИ triggerLineOrButtonScramble ---

// ============================================================================
// РАЗДЕЛ 2. КОНТРОЛЛЕР 60-FPS ВЫХОДА ИЗ ТОЧКИ, ОДОМЕТРА И ДЫХАНИЯ ВИЗИТКИ
// ============================================================================

class FinaleCardDomAnimator {
    private rafId = 0;
    private lastFrameMs = 0;
    private accumulatedQuantumPhase = 0;
    private accumulatedAssemblyPhase = 0;
    private lfoClockSec = 0;
    private lastQuantumStep = -1;

    private cardBoxEl: HTMLElement | null = null;
    private line0El: HTMLElement | null = null;
    private line1El: HTMLElement | null = null;
    private line2QuantumEl: HTMLElement | null = null;
    private line3El: HTMLElement | null = null;
    private line4El: HTMLElement | null = null;

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.1. ПРИВЯЗКА DOM-УЗЛОВ И УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ RAF
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ bindElements ---
    public bindElements(root: HTMLElement): void {
        this.cardBoxEl = root.querySelector<HTMLElement>('[data-bind="l5-card-box"]');
        this.line0El = root.querySelector<HTMLElement>('[data-bind="l5-line-0"]');
        this.line1El = root.querySelector<HTMLElement>('[data-bind="l5-line-1"]');
        this.line2QuantumEl = root.querySelector<HTMLElement>('[data-bind="l5-line-2"]');
        this.line3El = root.querySelector<HTMLElement>('[data-bind="l5-line-3"]');
        this.line4El = root.querySelector<HTMLElement>('[data-bind="l5-line-4"]');
    }
    // --- КОНЕЦ ФУНКЦИИ bindElements ---

    // --- НАЧАЛО ФУНКЦИИ startIfNeeded ---
    public startIfNeeded(): void {
        if (this.rafId !== 0 || typeof window === 'undefined') return;
        this.lastFrameMs = performance.now();
        this.rafId = window.requestAnimationFrame(this.tick);
    }
    // --- КОНЕЦ ФУНКЦИИ startIfNeeded ---

    // --- НАЧАЛО ФУНКЦИИ stop ---
    public stop(): void {
        if (this.rafId !== 0 && typeof window !== 'undefined') {
            window.cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }
    }
    // --- КОНЕЦ ФУНКЦИИ stop ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.2. АНИМАЦИЯ СБОРКИ И УСКОРЕННОЙ В ~3.5 РАЗА КВАНТОВОЙ СТРОКИ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ formatOdometerLineForProgress ---
    /**
     * Формирует строку с эффектом барабана одометра во время начальной сборки (p < 0.76).
     * ИСПРАВЛЕНО: порог lockThreshold уложен в [0.14 .. 0.72], чтобы правый край
     * 3-й и 4-й строк гарантированно фиксировался в канонический текст без остатков глифов.
     */
    private formatOdometerLineForProgress(
        canonical: string,
        lineIndex: number,
        progress: number,
        assemblyWheelStep: number
    ): string {
        if (progress >= 0.76) return canonical;
        const len = canonical.length;
        let out = '';
        for (let i = 0; i < len; i++) {
            const ch = canonical[i];
            const lockThreshold =
                0.14 + lineIndex * 0.055 + (i / Math.max(1, len)) * 0.34;
            if (
                progress >= lockThreshold ||
                ch === ' ' ||
                ch === '·' ||
                ch === ':' ||
                ch === '(' ||
                ch === ')'
            ) {
                out += ch;
            } else {
                const wheelIdx =
                    (assemblyWheelStep + i * 5 + lineIndex * 9) % SCRAMBLE_GLYPHS.length;
                out += SCRAMBLE_GLYPHS[wheelIdx];
            }
        }
        return out;
    }
    // --- КОНЕЦ ФУНКЦИИ formatOdometerLineForProgress ---

    // --- НАЧАЛО ФУНКЦИИ tick ---
    private tick = (nowMs: number): void => {
        this.rafId = 0;
        const state = universeStore.getState();
        const isActD = state.singularityAct === 'ACT_D_GITHUB_CARD';
        const isCollapsing = state.singularityAct === 'RESTART_COLLAPSE';
        const isPersistentCard = state.finaleReachedOnce;

        // Если визитка ещё ни разу не открывалась и сейчас не Акт D — останавливаем RAF
        if (!isActD && !isCollapsing && !isPersistentCard) {
            return;
        }

        const dtSec = Math.max(
            0.0,
            Math.min(0.05, (nowMs - this.lastFrameMs) * 0.001)
        );
        this.lastFrameMs = nowMs;

        if (this.cardBoxEl) {
            const p = isPersistentCard && state.cycleCount > 1
                ? 1.0
                : Math.max(0, Math.min(1, state.githubCardAssemblyProgress));
            const isSimActive = !state.isPaused && !state.isTabHidden;

            if (isSimActive) {
                this.lfoClockSec += dtSec;
            }

            const audioSnap = audioSync.getSnapshot(this.lfoClockSec);

            // Плавный C2-выход всей визитки из центральной Точки Нуля при первом появлении
            const emergeScale =
                state.reducedMotion || (isPersistentCard && state.cycleCount > 1)
                    ? 1.0
                    : 0.04 + 0.96 * smootherstep(0.0, 0.46, p);

            // Спокойное дыхание зафиксированной визитки в такт низкочастотной огибающей музыки
            const breathEnv =
                state.reducedMotion || !isSimActive ? 0 : smootherstep(0.48, 0.88, p);
            const musicPulse = 1.0 + audioSnap.heartbeat * 0.42;
            const heartbeatScale =
                1.0 +
                breathEnv *
                (0.008 * musicPulse * Math.sin(this.lfoClockSec * 1.3) +
                    0.003 * Math.cos(this.lfoClockSec * 2.5));
            const floatY = breathEnv * Math.cos(this.lfoClockSec * 1.05) * 2.0;

            const finalScale = emergeScale * heartbeatScale;
            this.cardBoxEl.style.transform = `translate3d(0, ${floatY.toFixed(
                1
            )}px, 0) scale(${finalScale.toFixed(4)})`;

            // Накопление фазы начальной сборки
            if (isSimActive && !state.reducedMotion) {
                this.accumulatedAssemblyPhase += dtSec * 9.5;
            }
            const assemblyStep = Math.floor(this.accumulatedAssemblyPhase);

            if (p < 0.76 && !state.reducedMotion) {
                if (this.line0El && !activeScrambleTimers.has(this.line0El)) {
                    this.line0El.textContent = this.formatOdometerLineForProgress(
                        CANONICAL_FINALE_LINES[0],
                        0,
                        p,
                        assemblyStep
                    );
                }
                if (this.line1El && !activeScrambleTimers.has(this.line1El)) {
                    this.line1El.textContent = this.formatOdometerLineForProgress(
                        CANONICAL_FINALE_LINES[1],
                        1,
                        p,
                        assemblyStep
                    );
                }
                if (this.line3El && !activeScrambleTimers.has(this.line3El)) {
                    this.line3El.textContent = this.formatOdometerLineForProgress(
                        CANONICAL_FINALE_LINES[3],
                        3,
                        p,
                        assemblyStep
                    );
                }
                if (this.line4El && !activeScrambleTimers.has(this.line4El)) {
                    this.line4El.textContent = this.formatOdometerLineForProgress(
                        CANONICAL_FINALE_LINES[4],
                        4,
                        p,
                        assemblyStep
                    );
                }
            } else {
                if (this.line0El && !activeScrambleTimers.has(this.line0El)) {
                    this.line0El.textContent = CANONICAL_FINALE_LINES[0];
                }
                if (this.line1El && !activeScrambleTimers.has(this.line1El)) {
                    this.line1El.textContent = CANONICAL_FINALE_LINES[1];
                }
                if (this.line3El && !activeScrambleTimers.has(this.line3El)) {
                    this.line3El.textContent = CANONICAL_FINALE_LINES[3];
                }
                if (this.line4El && !activeScrambleTimers.has(this.line4El)) {
                    this.line4El.textContent = CANONICAL_FINALE_LINES[4];
                }
            }

            // Накопительный такт квантовой строки с ограниченной частотой:
            // Фаза накапливается через dtSec * boundedRateHz в диапазоне [18.0 .. 26.0] шагов/с.
            // При этом каждый не-пробельный символ вращается по индивидуальной скорости,
            // обеспечивая ~8–11 живых смен в секунду на каждый знак без зависимости от uptime.
            if (isSimActive && !state.reducedMotion) {
                const lfoWave =
                    3.2 * Math.sin(this.lfoClockSec * 0.85) +
                    1.8 * Math.cos(this.lfoClockSec * 1.75);
                const boundedRateHz = Math.max(
                    18.0,
                    Math.min(26.0, 21.5 + lfoWave + audioSnap.heartbeat * 2.5)
                );
                this.accumulatedQuantumPhase += dtSec * boundedRateHz;
            }

            const qStep = Math.floor(this.accumulatedQuantumPhase);
            if (this.line2QuantumEl && qStep !== this.lastQuantumStep) {
                this.lastQuantumStep = qStep;
                if (state.reducedMotion) {
                    this.line2QuantumEl.textContent = CANONICAL_FINALE_LINES[2];
                } else {
                    const baseLine = CANONICAL_FINALE_LINES[2];
                    const chars = baseLine.split('');
                    const nGlyphs = SCRAMBLE_GLYPHS.length;
                    for (let i = 0; i < chars.length; i++) {
                        if (chars[i] === ' ') continue;
                        // Индивидуальный делитель темпа (1 или 2) для каждого слота,
                        // чтобы все знаки строки активно и разнообразно перебирались в воздухе
                        const slotStride = (i % 3 === 0) ? 1 : 2;
                        const charTick = Math.floor((qStep + i * 7) / slotStride);
                        const gIdx =
                            (i * 19 + charTick * 7 + (i % 5) * 13) % nGlyphs;
                        chars[i] = SCRAMBLE_GLYPHS[gIdx];
                    }
                    this.line2QuantumEl.textContent = chars.join('');
                }
            }
        }

        this.rafId = window.requestAnimationFrame(this.tick);
    };
    // --- КОНЕЦ ФУНКЦИИ tick ---
}

const finaleCardAnimator = new FinaleCardDomAnimator();

// ============================================================================
// РАЗДЕЛ 3. СЕМАНТИЧЕСКИЙ КОМПОНЕНТ ВИДИМОЙ ВИЗИТКИ (renderLayer5CipherFinaleView)
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ renderLayer5CipherFinaleView ---
export function renderLayer5CipherFinaleView(state: Readonly<UniverseState>): Element {
    const isActD = state.singularityAct === 'ACT_D_GITHUB_CARD';
    const isPersistentAmbient = state.finaleReachedOnce && !isActD;
    const isCardVisible = isActD || state.finaleReachedOnce;
    const isInteractive =
        isPersistentAmbient ||
        (isActD && state.githubCardAssemblyProgress >= 0.25);

    const stageVisibleClass = isCardVisible ? ' visible' : '';
    const ambientLoopClass = isPersistentAmbient ? ' ambient-loop' : '';
    const actionsVisibleClass = isInteractive ? ' visible' : '';

    const profileLabel = '[ ↗ GITHUB PROFILE : DUBNOV ALEXEY ]';
    const repoLabel = '[ ↗ PROJECT REPOSITORY ]';
    const restartLabel = '[ ↻ RESTART UNIVERSE CYCLE ]';

    return (
        <section
            className={`finale-stage-container${stageVisibleClass}`}
            data-github-card="true"
            role="region"
            aria-label="Финальная визитка автора — Dubnov Alexey"
            aria-hidden={isCardVisible ? 'false' : 'true'}
        >
            <div
                className="sr-only-manifesto"
                data-bind="l5-manifesto"
                aria-live="polite"
                aria-atomic="true"
            >
                {isInteractive ? CANONICAL_FINALE_LINES.join(' — ') : ''}
            </div>

            <article
                className={`finale-manifesto-card${ambientLoopClass}`}
                data-bind="l5-card-box"
                onMouseEnter={(): void => {
                    universeStore.setFinaleCardHovered(true);
                }}
                onMouseLeave={(): void => {
                    universeStore.setFinaleCardHovered(false);
                }}
            >
                <h1
                    className="finale-line-author"
                    data-bind="l5-line-0"
                    onMouseEnter={(e: MouseEvent): void => {
                        if (e.currentTarget instanceof HTMLElement) {
                            triggerLineOrButtonScramble(
                                e.currentTarget,
                                CANONICAL_FINALE_LINES[0]
                            );
                        }
                    }}
                >
                    {CANONICAL_FINALE_LINES[0]}
                </h1>

                <p
                    className="finale-line-subtitle"
                    data-bind="l5-line-1"
                    onMouseEnter={(e: MouseEvent): void => {
                        if (e.currentTarget instanceof HTMLElement) {
                            triggerLineOrButtonScramble(
                                e.currentTarget,
                                CANONICAL_FINALE_LINES[1]
                            );
                        }
                    }}
                >
                    {CANONICAL_FINALE_LINES[1]}
                </p>

                <div
                    className="finale-line-quantum-stream"
                    data-bind="l5-line-2"
                    aria-hidden="true"
                >
                    {CANONICAL_FINALE_LINES[2]}
                </div>

                <p
                    className="finale-line-stack"
                    data-bind="l5-line-3"
                    onMouseEnter={(e: MouseEvent): void => {
                        if (e.currentTarget instanceof HTMLElement) {
                            triggerLineOrButtonScramble(
                                e.currentTarget,
                                CANONICAL_FINALE_LINES[3]
                            );
                        }
                    }}
                >
                    {CANONICAL_FINALE_LINES[3]}
                </p>

                <p
                    className="finale-line-math"
                    data-bind="l5-line-4"
                    onMouseEnter={(e: MouseEvent): void => {
                        if (e.currentTarget instanceof HTMLElement) {
                            triggerLineOrButtonScramble(
                                e.currentTarget,
                                CANONICAL_FINALE_LINES[4]
                            );
                        }
                    }}
                >
                    {CANONICAL_FINALE_LINES[4]}
                </p>

                <div
                    className={`finale-counter-actions${actionsVisibleClass}`}
                    data-bind="l5-actions"
                >
                    <a
                        className="btn-cipher-action"
                        id="link-open-profile"
                        href="https://github.com/DubnovAlexey"
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={isInteractive ? 0 : -1}
                        onMouseEnter={(e: MouseEvent): void => {
                            if (e.currentTarget instanceof HTMLElement) {
                                triggerLineOrButtonScramble(
                                    e.currentTarget,
                                    profileLabel
                                );
                            }
                        }}
                    >
                        {profileLabel}
                    </a>

                    <a
                        className="btn-cipher-action"
                        id="link-open-repo"
                        href="https://github.com/DubnovAlexey/universe"
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={isInteractive ? 0 : -1}
                        onMouseEnter={(e: MouseEvent): void => {
                            if (e.currentTarget instanceof HTMLElement) {
                                triggerLineOrButtonScramble(
                                    e.currentTarget,
                                    repoLabel
                                );
                            }
                        }}
                    >
                        {repoLabel}
                    </a>

                    <button
                        type="button"
                        className="btn-cipher-action"
                        id="btn-restart-universe"
                        disabled={!isInteractive}
                        tabIndex={isInteractive ? 0 : -1}
                        onMouseEnter={(e: MouseEvent): void => {
                            if (e.currentTarget instanceof HTMLElement) {
                                triggerLineOrButtonScramble(
                                    e.currentTarget,
                                    restartLabel
                                );
                            }
                        }}
                        onClick={(): void => {
                            universeStore.triggerUniverseRestart();
                        }}
                    >
                        {restartLabel}
                    </button>
                </div>
            </article>
        </section>
    );
}
// --- КОНЕЦ ФУНКЦИИ renderLayer5CipherFinaleView ---

// ============================================================================
// РАЗДЕЛ 4. MOUNT-ONCE МОНТИРОВЩИК СЛОЯ 5 (mountLayer5CipherFinale)
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ mountLayer5CipherFinale ---
export function mountLayer5CipherFinale(container: HTMLElement | null): () => void {
    if (!container) return () => {};

    let rootEl: HTMLElement | null = null;
    let cardBoxEl: HTMLElement | null = null;
    let manifestoEl: HTMLElement | null = null;
    let actionsEl: HTMLElement | null = null;
    let profileLinkEl: HTMLAnchorElement | null = null;
    let repoLinkEl: HTMLAnchorElement | null = null;
    let restartBtn: HTMLButtonElement | null = null;

    // --- НАЧАЛО ФУНКЦИИ update (mountLayer5CipherFinale) ---
    const update = (state: Readonly<UniverseState>): void => {
        if (!rootEl || !container.contains(rootEl)) {
            rootEl = renderLayer5CipherFinaleView(state) as HTMLElement;
            container.replaceChildren(rootEl);
            cardBoxEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-card-box"]');
            manifestoEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-manifesto"]');
            actionsEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-actions"]');
            profileLinkEl = rootEl.querySelector<HTMLAnchorElement>('#link-open-profile');
            repoLinkEl = rootEl.querySelector<HTMLAnchorElement>('#link-open-repo');
            restartBtn = rootEl.querySelector<HTMLButtonElement>('#btn-restart-universe');
            finaleCardAnimator.bindElements(rootEl);
        }

        const isActD = state.singularityAct === 'ACT_D_GITHUB_CARD';
        const isPersistentAmbient = state.finaleReachedOnce && !isActD;
        const isCardVisible = isActD || state.finaleReachedOnce;
        const showActions =
            isPersistentAmbient ||
            (isActD && state.githubCardAssemblyProgress >= 0.25);

        rootEl.classList.toggle('visible', isCardVisible);
        rootEl.setAttribute('aria-hidden', isCardVisible ? 'false' : 'true');
        cardBoxEl?.classList.toggle('ambient-loop', isPersistentAmbient);
        actionsEl?.classList.toggle('visible', showActions);

        if (isCardVisible) {
            finaleCardAnimator.startIfNeeded();
        } else {
            finaleCardAnimator.stop();
        }

        if (manifestoEl) {
            manifestoEl.textContent = showActions
                ? CANONICAL_FINALE_LINES.join(' — ')
                : '';
        }
        if (profileLinkEl) {
            profileLinkEl.tabIndex = showActions ? 0 : -1;
        }
        if (repoLinkEl) {
            repoLinkEl.tabIndex = showActions ? 0 : -1;
        }
        if (restartBtn) {
            restartBtn.disabled = !showActions;
            restartBtn.tabIndex = showActions ? 0 : -1;
        }
    };
    // --- КОНЕЦ ФУНКЦИИ update (mountLayer5CipherFinale) ---

    const unsubscribe = universeStore.subscribe(update);
    return () => {
        finaleCardAnimator.stop();
        unsubscribe();
    };
}
// --- КОНЕЦ ФУНКЦИИ mountLayer5CipherFinale ---

export default renderLayer5CipherFinaleView;
