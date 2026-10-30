// ============================================================================
// ФАЙЛ: frontend/src/engine/bootstrap.ts
// НАЗНАЧЕНИЕ: Активный экземпляр, монтирование слоёв и обработчики страницы.
// РАЗДЕЛЫ: 1. Экземпляр и доступ; 2. Инициализация и подписки.
// ФУНКЦИИ: getUniverseRenderer, createUniverseResizeHandler, bootstrapUniverseV2.
// ============================================================================

import { PHASE_ORDER, universeStore, type PhaseId, type UniverseState } from '../store/universeState';
import { UniverseRenderer } from './UniverseRenderer';
import { audioSync } from '../utils/audioSync';
import { resourceLedger } from '../core/resourceLedger';
import { calmGlyphHover } from '../core/glyphHover';
import { buttonMotionController } from '../core/buttonMotion';
import { buttonSolidManager } from '../core/buttonSolid';
import { mountLayer2Metrics } from '../layers/Layer2_Metrics';
import { mountLayer3Topology } from '../layers/Layer3_Topology';
import { mountLayer4Terminal } from '../layers/Layer4_Terminal';
import { mountLayer5CipherFinale } from '../layers/Layer5_CipherFinale';
import { mountExplanationDialog } from '../layers/ExplanationDialog';
import { bindHudDockLayout, syncHudDomWithState } from './hud/hudDomOrchestrator';
import { bindUniverseKeyboardShortcuts } from './hud/keyboardShortcuts';
import { mountLocaleControls } from './hud/localeController';

// НАЧАЛО РАЗДЕЛА 1. АКТИВНЫЙ ЭКЗЕМПЛЯР
export let activeRenderer: UniverseRenderer | null = null;

// --- НАЧАЛО ФУНКЦИИ getUniverseRenderer ---
/**
 * Возвращает активный экземпляр рендерера Вселенной.
 */
export function getUniverseRenderer(): UniverseRenderer | null {
    return activeRenderer;
}
// --- КОНЕЦ ФУНКЦИИ getUniverseRenderer ---

// --- НАЧАЛО ФУНКЦИИ createUniverseResizeHandler ---
/** Завершает перебор до пересчёта viewport: старые ink-метрики не попадают в новые ячейки. */
export function createUniverseResizeHandler(renderer: Pick<UniverseRenderer, 'handleResize'>): () => void {
    // --- НАЧАЛО ФУНКЦИИ handleUniverseResize ---
    return function handleUniverseResize(): void {
        calmGlyphHover.stopAll();
        renderer.handleResize();
    };
    // --- КОНЕЦ ФУНКЦИИ handleUniverseResize ---
}
// --- КОНЕЦ ФУНКЦИИ createUniverseResizeHandler ---
// КОНЕЦ РАЗДЕЛА 1. АКТИВНЫЙ ЭКЗЕМПЛЯР

// НАЧАЛО РАЗДЕЛА 2. ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
// --- НАЧАЛО ФУНКЦИИ bootstrapUniverseV2 ---
/**
 * Точка входа клиентской графической подсистемы: инициализирует холст #universe-canvas,
 * монтирует реактивные острова телеметрии Layer 2–5, привязывает кнопки управления,
 * связывает объёмные кнопки с общей сценой и запускает цикл симуляции.
 * Подписки UI регистрируются как страничные (registerPageDisposable), чтобы оставаться
 * активными после любого числа перезапусков Restart Universe.
 */
export function bootstrapUniverseV2(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (activeRenderer) return;

    let canvas = document.querySelector<HTMLCanvasElement>('#universe-canvas, canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'universe-canvas';
        document.body.prepend(canvas);
    }

    const renderer = new UniverseRenderer(canvas);
    activeRenderer = renderer;
    bindHudDockLayout();

    // 1. Монтируем штатные панели телеметрии (Layers 2, 3, 4) и финал (Layer 5)
    const unsubL2 = mountLayer2Metrics(document.getElementById('layer2-metrics-root'));
    const unsubL3 = mountLayer3Topology(document.getElementById('layer3-topology-root'));
    const unsubL4 = mountLayer4Terminal(document.getElementById('layer4-terminal-root'));
    const unsubL5 = mountLayer5CipherFinale(document.getElementById('layer5-finale-root'));
    const explanations = mountExplanationDialog();
    resourceLedger.registerPageDisposable(explanations.dispose);

    // 2. Подписываем обновление верхнего паспорта фазы и нижнего дока кнопок на UniverseStore
    const unsubHud = universeStore.subscribe((nextState: Readonly<UniverseState>) => {
        syncHudDomWithState(nextState);
    });
    syncHudDomWithState(universeStore.getState());

    const ledgerWithPage = resourceLedger as unknown as {
        registerPageDisposable?: (fn: () => void) => void;
    };
    if (ledgerWithPage.registerPageDisposable) {
        ledgerWithPage.registerPageDisposable(unsubL2);
        ledgerWithPage.registerPageDisposable(unsubL3);
        ledgerWithPage.registerPageDisposable(unsubL4);
        ledgerWithPage.registerPageDisposable(unsubL5);
        ledgerWithPage.registerPageDisposable(unsubHud);
    }

    // 3. Закрытые шестигранные тела вращаются внутри неподвижных областей нажатия.
    const cornerControls = Array.from(document.querySelectorAll<HTMLElement>(
        '.brand-card .phase-codename, .brand-card .phase-title, .brand-card .phase-subtitle, ' +
        '#ui-phase-buttons button.phase-pill, .controls-dock button.btn-cyber, .controls-dock a.btn-cyber, ' +
        '.explanation-dock button.btn-cyber'
    ));
    const buttonSolids = buttonSolidManager.mount(cornerControls);
    const buttonMotion = buttonMotionController.mount(cornerControls);
    resourceLedger.registerPageDisposable(mountLocaleControls());
    resourceLedger.trackPageLifetimeAllocation('listeners', buttonMotion.listenerCount);
    resourceLedger.registerPageDisposable(() => {
        buttonMotion.dispose();
        buttonSolids.dispose();
        resourceLedger.trackRelease('listeners', buttonMotion.listenerCount);
    });

    // 4. Обработчики кликов по кнопкам переключения 5 фаз
    const phaseButtonsContainer = document.getElementById('ui-phase-buttons');
    if (phaseButtonsContainer) {
        phaseButtonsContainer.addEventListener('click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(
                'button[data-phase-id]'
            );
            if (!target) return;
            const phaseId = target.getAttribute('data-phase-id') as PhaseId | null;
            if (phaseId && PHASE_ORDER.includes(phaseId)) {
                audioSync.startPlayback();
                universeStore.setPhase(phaseId);
            }
        });
    }

    // 5. Обработчики кликов по кнопкам управления нижней панели
    document.getElementById('btn-toggle-pause')?.addEventListener('click', () => {
        universeStore.togglePause();
    });
    document.getElementById('btn-toggle-autocycle')?.addEventListener('click', () => {
        universeStore.toggleAutoCycle();
    });
    document.getElementById('btn-toggle-audio')?.addEventListener('click', () => {
        audioSync.toggleMute();
    });
    document.getElementById('ui-audio-unlock-banner')?.addEventListener('click', () => {
        audioSync.startPlayback(true);
    });
    document.getElementById('btn-toggle-metrics')?.addEventListener('click', () => {
        universeStore.toggleLayer('layer2_metricsHud');
    });
    document.getElementById('btn-toggle-topology')?.addEventListener('click', () => {
        universeStore.toggleLayer('layer3_topologyGraph');
    });
    document.getElementById('btn-toggle-terminal')?.addEventListener('click', () => {
        universeStore.toggleLayer('layer4_architectTerminal');
    });
    document.getElementById('btn-toggle-xray')?.addEventListener('click', () => {
        universeStore.toggleLayer('layer5_truthXRayMode');
    });

    // 6. Постоянные слушатели страницы сохраняются между циклами и входят в baseline.
    const handleUniverseResize = createUniverseResizeHandler(renderer);
    window.addEventListener('resize', handleUniverseResize, { passive: true });
    resourceLedger.trackPageLifetimeAllocation('listeners', 1);

    window.addEventListener(
        'pointermove',
        (e: PointerEvent): void => {
            renderer.setPointerState(e.clientX, e.clientY, undefined, true);
        },
        { passive: true }
    );
    resourceLedger.trackPageLifetimeAllocation('listeners', 1);

    window.addEventListener(
        'pointerdown',
        (e: PointerEvent): void => {
            const isUiClick = Boolean(
                (e.target as HTMLElement | null)?.closest(
                    '[data-ui-panel], [data-github-card], button, a'
                )
            );
            audioSync.startPlayback();
            if (!isUiClick) {
                renderer.setPointerState(e.clientX, e.clientY, true, true);
            }
        },
        { passive: true }
    );
    resourceLedger.trackPageLifetimeAllocation('listeners', 1);

    window.addEventListener(
        'pointerup',
        (e: PointerEvent): void => {
            renderer.setPointerState(e.clientX, e.clientY, false, true);
        },
        { passive: true }
    );
    resourceLedger.trackPageLifetimeAllocation('listeners', 1);

    window.addEventListener(
        'pointerleave',
        (): void => {
            renderer.setPointerState(-9999, -9999, false, false);
        },
        { passive: true }
    );
    resourceLedger.trackPageLifetimeAllocation('listeners', 1);

    // --- НАЧАЛО ФУНКЦИИ handleVisibilityChange (bootstrapUniverseV2) ---
    const handleVisibilityChange = (): void => {
        // Браузер может приостановить RAF до публикации скрытого кадра.
        if (document.hidden) {
            calmGlyphHover.stopAll();
            renderer.resetFrameTimingContinuity();
        }
        universeStore.setTabHidden(document.hidden);
    };
    // --- КОНЕЦ ФУНКЦИИ handleVisibilityChange (bootstrapUniverseV2) ---
    document.addEventListener('visibilitychange', handleVisibilityChange);
    resourceLedger.trackPageLifetimeAllocation('listeners', 1);
    resourceLedger.registerPageDisposable(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        calmGlyphHover.stopAll();
        resourceLedger.trackRelease('listeners', 1);
    });

    const disposeKeyboardShortcuts = bindUniverseKeyboardShortcuts(window);
    resourceLedger.trackPageLifetimeAllocation('listeners', 1);
    resourceLedger.registerPageDisposable(() => {
        disposeKeyboardShortcuts();
        resourceLedger.trackRelease('listeners', 1);
    });

    renderer.start();
}
// --- КОНЕЦ ФУНКЦИИ bootstrapUniverseV2 ---
// КОНЕЦ РАЗДЕЛА 2. ИНИЦИАЛИЗАЦИЯ СТРАНИЦЫ
