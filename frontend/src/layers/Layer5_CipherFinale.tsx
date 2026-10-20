// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer5_CipherFinale.tsx
// НАЗНАЧЕНИЕ: Доступный семантический DOM-слой финальной визитки GitHub и Restart (MASTER 05 v2.4)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Замедленный и плавный квантовый перебор символов при наведении (triggerButtonScramble)
//    с защитой от наложения интервалов (WeakMap<HTMLElement, number>) и холодной
//    полутоновой подсветкой с тенью.
// 2. Семантический компонент финала (renderLayer5CipherFinaleView): рендеринг
//    невидимого блока aria-live="polite" с 5 каноническими строками визитки
//    ('DUBNOV ALEXEY'), ссылки на репозиторий DubnovAlexey/universe и кнопки
//    запуска обратной хореографии Restart Universe.
// 3. Mount-once монтировщик (mountLayer5CipherFinale): обновление атрибутов
//    видимости и блокировки кнопок без пересоздания DOM-узлов.
// ============================================================================

import { React } from './Layer2_Metrics';
import { CANONICAL_FINALE_LINES } from '../bridge/cipherOdometerEngine';
import { universeStore, type UniverseState } from '../store/universeState';

const SCRAMBLE_GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆Ωλ∞';
const activeButtonTimers = new WeakMap<HTMLElement, number>();

/**
 * Плавно и неспешно перебирает буквы на кнопке финала (шаг 62 мс вместо 24 мс)
 * с гарантированной отменой предыдущего таймера при повторном входе курсора.
 */
function triggerButtonScramble(el: HTMLElement, originalLabel: string): void {
    const prevTimer = activeButtonTimers.get(el);
    if (prevTimer !== undefined) {
        window.clearInterval(prevTimer);
        activeButtonTimers.delete(el);
    }

    let step = 0;
    const totalSteps = 14;

    const timer = window.setInterval(() => {
        step++;
        if (step >= totalSteps) {
            el.textContent = originalLabel;
            window.clearInterval(timer);
            activeButtonTimers.delete(el);
            return;
        }

        const lockBoundary = Math.floor((step / totalSteps) * originalLabel.length);
        el.textContent = originalLabel
            .split('')
            .map((ch: string, idx: number): string => {
                if (
                    ch === ' ' ||
                    ch === '[' ||
                    ch === ']' ||
                    ch === '↗' ||
                    ch === '↻' ||
                    idx < lockBoundary
                ) {
                    return ch;
                }
                if ((idx + step) % 3 !== 0) {
                    return ch;
                }
                return SCRAMBLE_GLYPHS[(idx * 5 + step * 3) % SCRAMBLE_GLYPHS.length];
            })
            .join('');
    }, 62);

    activeButtonTimers.set(el, timer);
}

export function renderLayer5CipherFinaleView(state: Readonly<UniverseState>): Element {
    const isLockedAndVisible =
        state.singularityAct === 'ACT_D_GITHUB_CARD' &&
        state.githubCardAssemblyProgress >= 0.84;
    const isCollapsing = state.singularityAct === 'RESTART_COLLAPSE';
    const visibleClass = isLockedAndVisible && !isCollapsing ? ' visible' : '';

    const repoLabel = '[ OPEN GITHUB REPOSITORY ↗ ]';
    const restartLabel = '[ ↻ RESTART UNIVERSE CYCLE ]';

    return (
        <div
            className={`finale-counter-actions${visibleClass}`}
            data-github-card="true"
            role="region"
            aria-label="Финальная визитка — Dubnov Alexey"
        >
            <div
                className="sr-only-manifesto"
                data-bind="l5-manifesto"
                aria-live="polite"
                aria-atomic="true"
            >
                {isLockedAndVisible ? CANONICAL_FINALE_LINES.join(' — ') : ''}
            </div>

            <a
                className="btn-cipher-action"
                id="link-open-repo"
                href="https://github.com/DubnovAlexey/universe"
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={isLockedAndVisible ? 0 : -1}
                onMouseEnter={(e: MouseEvent): void => {
                    if (e.currentTarget instanceof HTMLElement) {
                        triggerButtonScramble(e.currentTarget, repoLabel);
                    }
                }}
            >
                {repoLabel}
            </a>

            <button
                type="button"
                className="btn-cipher-action"
                id="btn-restart-universe"
                disabled={!isLockedAndVisible || isCollapsing}
                tabIndex={isLockedAndVisible ? 0 : -1}
                onMouseEnter={(e: MouseEvent): void => {
                    if (e.currentTarget instanceof HTMLElement) {
                        triggerButtonScramble(e.currentTarget, restartLabel);
                    }
                }}
                onClick={(): void => {
                    universeStore.triggerUniverseRestart();
                }}
            >
                {restartLabel}
            </button>
        </div>
    );
}

export function mountLayer5CipherFinale(container: HTMLElement | null): () => void {
    if (!container) return () => {};

    let rootEl: HTMLElement | null = null;
    let manifestoEl: HTMLElement | null = null;
    let linkEl: HTMLAnchorElement | null = null;
    let restartBtn: HTMLButtonElement | null = null;

    const update = (state: Readonly<UniverseState>): void => {
        if (!rootEl || !container.contains(rootEl)) {
            rootEl = renderLayer5CipherFinaleView(state) as HTMLElement;
            container.replaceChildren(rootEl);
            manifestoEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-manifesto"]');
            linkEl = rootEl.querySelector<HTMLAnchorElement>('#link-open-repo');
            restartBtn = rootEl.querySelector<HTMLButtonElement>('#btn-restart-universe');
            return;
        }

        const isLockedAndVisible =
            state.singularityAct === 'ACT_D_GITHUB_CARD' &&
            state.githubCardAssemblyProgress >= 0.84;
        const isCollapsing = state.singularityAct === 'RESTART_COLLAPSE';
        const showActions = isLockedAndVisible && !isCollapsing;

        rootEl.classList.toggle('visible', showActions);

        if (manifestoEl) {
            manifestoEl.textContent = showActions
                ? CANONICAL_FINALE_LINES.join(' — ')
                : '';
        }
        if (linkEl) {
            linkEl.tabIndex = showActions ? 0 : -1;
        }
        if (restartBtn) {
            restartBtn.disabled = !showActions;
            restartBtn.tabIndex = showActions ? 0 : -1;
        }
    };

    return universeStore.subscribe(update);
}

export default renderLayer5CipherFinaleView;