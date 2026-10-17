// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer5_CipherFinale.tsx
// НАЗНАЧЕНИЕ: Доступный семантический DOM-слой финальной карточки GitHub и Restart (MASTER 05 v2.0)
// ЗАДАЧИ ФАЙЛА:
// 1. Рендерить интерактивные кнопки перехода в репозиторий DubnovAlexey/universe
//    и запуска обратной хореографии Restart Universe (с клавиатурным фокусом Tab / Enter / Space).
// 2. Содержать визуально скрытый блок aria-live="polite" с 5 каноничными строками финала,
//    который озвучивается скринридером ровно один раз после защёлкивания всех барабанов (p >= 0.84).
// 3. Немедленно отключать интерактивность кнопок при переходе в состояние RESTART_COLLAPSE.
// ============================================================================

import { React } from './Layer2_Metrics';
import { CANONICAL_FINALE_LINES } from '../bridge/cipherOdometerEngine';
import { universeStore, type UniverseState } from '../store/universeState';

const SCRAMBLE_GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆Ωλ∞';

function triggerButtonScramble(el: HTMLElement, originalLabel: string): void {
    let iter = 0;
    const timer = window.setInterval(() => {
        el.textContent = originalLabel
            .split('')
            .map((ch, idx) => {
                if (ch === ' ' || ch === '[' || ch === ']' || idx < iter) return ch;
                return SCRAMBLE_GLYPHS[(idx * 7 + Math.floor(iter * 3)) % SCRAMBLE_GLYPHS.length];
            })
            .join('');
        iter += 1.6;
        if (iter >= originalLabel.length) {
            el.textContent = originalLabel;
            window.clearInterval(timer);
        }
    }, 24);
}

export function renderLayer5CipherFinaleView(state: Readonly<UniverseState>): Element {
    const isLockedAndVisible =
        state.singularityAct === 'ACT_D_GITHUB_CARD' && state.githubCardAssemblyProgress >= 0.84;
    const isCollapsing = state.singularityAct === 'RESTART_COLLAPSE';
    const visibleClass = isLockedAndVisible && !isCollapsing ? ' visible' : '';

    const repoLabel = '[ OPEN GITHUB REPOSITORY ↗ ]';
    const restartLabel = '[ ↻ RESTART UNIVERSE CYCLE ]';

    return (
        <div
            className={`finale-counter-actions${visibleClass}`}
            data-github-card="true"
            role="region"
            aria-label="Финальная карточка проекта UNIVERSE — Alexey Dubnov"
        >
            <div className="sr-only-manifesto" aria-live="polite" aria-atomic="true">
                {isLockedAndVisible ? CANONICAL_FINALE_LINES.join(' — ') : ''}
            </div>

            <a
                className="btn-cipher-action"
                id="link-open-repo"
                href="https://github.com/DubnovAlexey/universe"
                target="_blank"
                rel="noopener noreferrer"
                tabIndex={isLockedAndVisible ? 0 : -1}
                onMouseEnter={(e: MouseEvent) => {
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
                onMouseEnter={(e: MouseEvent) => {
                    if (e.currentTarget instanceof HTMLElement) {
                        triggerButtonScramble(e.currentTarget, restartLabel);
                    }
                }}
                onClick={() => {
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
    let lastVisibleState = false;

    const update = (state: Readonly<UniverseState>) => {
        const nowVisible =
            state.singularityAct === 'ACT_D_GITHUB_CARD' && state.githubCardAssemblyProgress >= 0.84;
        if (nowVisible !== lastVisibleState || state.singularityAct === 'RESTART_COLLAPSE') {
            lastVisibleState = nowVisible;
            container.replaceChildren(renderLayer5CipherFinaleView(state));
        }
    };
    return universeStore.subscribe(update);
}

export default renderLayer5CipherFinaleView;