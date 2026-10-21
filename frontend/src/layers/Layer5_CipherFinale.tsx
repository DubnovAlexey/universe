// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer5_CipherFinale.tsx
// НАЗНАЧЕНИЕ: Видимый семантический DOM-слой финальной визитки DUBNOV ALEXEY,
//             живой квантовой строки с ограниченной скоростью и кнопок перехода
//             в профиль GitHub, репозиторий и перезапуска цикла (MASTER 05 v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ:
//   РАЗДЕЛ 1. Константы глифов и контроллер плавного квантового перебора при
//             наведении мыши (triggerLineOrButtonScramble).
//   РАЗДЕЛ 2. Контроллер 60-FPS анимации визитки (FinaleCardDomAnimator):
//     - Подраздел 2.1. Жизненный цикл RAF (запускается ТОЛЬКО в Акте D / Restart
//                      и гарантированно останавливается в фазах 01–04).
//     - Подраздел 2.2. Накопление фазы бесконечной строки через dtSec с жёстко
//                      ограниченной частотой (1.8–3.2 Гц независимо от uptime).
//   РАЗДЕЛ 3. Семантический компонент визитки (renderLayer5CipherFinaleView):
//             заголовок h1 ('DUBNOV ALEXEY'), подзаголовок, живая строка, стек
//             и 3 кнопки (Профиль GitHub, Репозиторий проекта, Перезапуск цикла).
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
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡⊕⊗⊙◊◈✶✴⟨∞⟩';

const activeScrambleTimers = new WeakMap<HTMLElement, number>();

// --- НАЧАЛО ФУНКЦИИ triggerLineOrButtonScramble ---
/**
 * Запускает плавный, комфортный для глаз квантовый перебор символов на строке
 * визитки или кнопке при наведении мыши (шаг 72 мс, без мельтешения).
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
                if ((idx + step) % 3 !== 0) {
                    return ch;
                }
                return SCRAMBLE_GLYPHS[(idx * 7 + step * 3) % SCRAMBLE_GLYPHS.length];
            })
            .join('');
    }, 72);

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
    // ПОДРАЗДЕЛ 2.2. ОГРАНИЧЕННАЯ АНИМАЦИЯ СБОРКИ И БЕСКОНЕЧНОЙ СТРОКИ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ formatOdometerLineForProgress ---
    /**
     * Формирует строку с эффектом барабана одометра во время начальной сборки (p < 0.82),
     * защёлкивая символы слева направо с комфортной ограниченной скоростью.
     */
    private formatOdometerLineForProgress(
        canonical: string,
        lineIndex: number,
        progress: number,
        assemblyWheelStep: number
    ): string {
        if (progress >= 0.82) return canonical;
        const len = canonical.length;
        let out = '';
        for (let i = 0; i < len; i++) {
            const ch = canonical[i];
            const lockThreshold = 0.24 + lineIndex * 0.08 + (i / Math.max(1, len)) * 0.38;
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
                    (assemblyWheelStep + i * 3 + lineIndex * 7) % SCRAMBLE_GLYPHS.length;
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

        // Если мы не в финальном акте — полностью останавливаем RAF-цикл визитки
        if (!isActD && !isCollapsing) {
            return;
        }

        const dtSec = Math.max(
            0.0,
            Math.min(0.05, (nowMs - this.lastFrameMs) * 0.001)
        );
        this.lastFrameMs = nowMs;

        if (this.cardBoxEl) {
            const p = Math.max(0, Math.min(1, state.githubCardAssemblyProgress));
            const isSimActive = !state.isPaused && !state.isTabHidden;

            if (isSimActive) {
                this.lfoClockSec += dtSec;
            }

            const audioSnap = audioSync.getSnapshot(this.lfoClockSec);

            // Плавный C2-выход всей визитки прямо из центральной Точки Нуля (масштаб от 0.04 до 1.0)
            const emergeScale = state.reducedMotion
                ? 1.0
                : isCollapsing
                    ? Math.max(0.02, Math.pow(p, 1.5))
                    : 0.04 + 0.96 * smootherstep(0.0, 0.48, p);
            const emergeOpacity = state.reducedMotion
                ? 1.0
                : isCollapsing
                    ? smootherstep(0.0, 0.85, p)
                    : smootherstep(0.0, 0.28, p);

            // Спокойное дыхание зафиксированной визитки в такт низкочастотной огибающей музыки
            const breathEnv =
                state.reducedMotion || !isSimActive ? 0 : smootherstep(0.52, 0.92, p);
            const musicPulse = 1.0 + audioSnap.heartbeat * 0.4;
            const heartbeatScale =
                1.0 +
                breathEnv *
                (0.009 * musicPulse * Math.sin(this.lfoClockSec * 1.3) +
                    0.003 * Math.cos(this.lfoClockSec * 2.5));
            const floatY = breathEnv * Math.cos(this.lfoClockSec * 1.05) * 2.0;

            const finalScale = emergeScale * heartbeatScale;
            this.cardBoxEl.style.opacity = emergeOpacity.toFixed(3);
            this.cardBoxEl.style.transform = `translate3d(0, ${floatY.toFixed(
                1
            )}px, 0) scale(${finalScale.toFixed(4)})`;

            // Накопление фазы сборки со строго ограниченной частотой 4.2 шага/с
            if (isSimActive && !state.reducedMotion) {
                this.accumulatedAssemblyPhase += dtSec * 4.2;
            }
            const assemblyStep = Math.floor(this.accumulatedAssemblyPhase);

            if (p < 0.82 && !state.reducedMotion) {
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

            // Фаза бесконечной центральной строки накапливается
            // через dtSec * boundedRateHz (строго в диапазоне 1.8..3.2 шага/с).
            // Скорость всегда положительна, комфортна для глаз и не растёт со временем страницы.
            if (isSimActive && !state.reducedMotion) {
                const lfoWave =
                    0.45 * Math.sin(this.lfoClockSec * 0.65) +
                    0.25 * Math.cos(this.lfoClockSec * 1.4);
                const boundedRateHz = Math.max(
                    5.5,
                    Math.min(9.5, 7.2 + lfoWave * 2.0 + audioSnap.heartbeat * 0.8)
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
                    for (let i = 0; i < chars.length; i++) {
                        if (chars[i] !== ' ' && (i + qStep) % 3 === 0) {
                            const gIdx =
                                (i * 11 + qStep * 3) % SCRAMBLE_GLYPHS.length;
                            chars[i] = SCRAMBLE_GLYPHS[gIdx];
                        }
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
    const isActDOrCollapse =
        state.singularityAct === 'ACT_D_GITHUB_CARD' ||
        state.singularityAct === 'RESTART_COLLAPSE';
    const isInteractive =
        state.singularityAct === 'ACT_D_GITHUB_CARD' &&
        state.githubCardAssemblyProgress >= 0.3;
    const isCollapsing = state.singularityAct === 'RESTART_COLLAPSE';

    const stageVisibleClass = isActDOrCollapse ? ' visible' : '';
    const actionsVisibleClass = isInteractive && !isCollapsing ? ' visible' : '';

    const profileLabel = '[ ↗ GITHUB PROFILE : DUBNOV ALEXEY ]';
    const repoLabel = '[ ↗ PROJECT REPOSITORY ]';
    const restartLabel = '[ ↻ RESTART UNIVERSE CYCLE ]';

    return (
        <section
            className={`finale-stage-container${stageVisibleClass}`}
            data-github-card="true"
            role="region"
            aria-label="Финальная визитка автора — Dubnov Alexey"
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
                className="finale-manifesto-card"
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
                        tabIndex={isInteractive && !isCollapsing ? 0 : -1}
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
                        tabIndex={isInteractive && !isCollapsing ? 0 : -1}
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
                        disabled={!isInteractive || isCollapsing}
                        tabIndex={isInteractive && !isCollapsing ? 0 : -1}
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
    let manifestoEl: HTMLElement | null = null;
    let actionsEl: HTMLElement | null = null;
    let profileLinkEl: HTMLAnchorElement | null = null;
    let repoLinkEl: HTMLAnchorElement | null = null;
    let restartBtn: HTMLButtonElement | null = null;

    const update = (state: Readonly<UniverseState>): void => {
        if (!rootEl || !container.contains(rootEl)) {
            rootEl = renderLayer5CipherFinaleView(state) as HTMLElement;
            container.replaceChildren(rootEl);
            manifestoEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-manifesto"]');
            actionsEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-actions"]');
            profileLinkEl = rootEl.querySelector<HTMLAnchorElement>('#link-open-profile');
            repoLinkEl = rootEl.querySelector<HTMLAnchorElement>('#link-open-repo');
            restartBtn = rootEl.querySelector<HTMLButtonElement>('#btn-restart-universe');
            finaleCardAnimator.bindElements(rootEl);
        }

        const isActDOrCollapse =
            state.singularityAct === 'ACT_D_GITHUB_CARD' ||
            state.singularityAct === 'RESTART_COLLAPSE';
        const isInteractive =
            state.singularityAct === 'ACT_D_GITHUB_CARD' &&
            state.githubCardAssemblyProgress >= 0.3;
        const isCollapsing = state.singularityAct === 'RESTART_COLLAPSE';
        const showActions = isInteractive && !isCollapsing;

        rootEl.classList.toggle('visible', isActDOrCollapse);
        actionsEl?.classList.toggle('visible', showActions);

        if (isActDOrCollapse) {
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

    const unsubscribe = universeStore.subscribe(update);
    return () => {
        finaleCardAnimator.stop();
        unsubscribe();
    };
}
// --- КОНЕЦ ФУНКЦИИ mountLayer5CipherFinale ---

export default renderLayer5CipherFinaleView;