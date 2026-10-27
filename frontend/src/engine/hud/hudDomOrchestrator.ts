// ============================================================================
// ФАЙЛ: frontend/src/engine/hud/hudDomOrchestrator.ts
// НАЗНАЧЕНИЕ: Канонические подписи, безопасная область доков и синхронизация HUD.
// РАЗДЕЛЫ: 1. Подписи; 2. Размеры доков; 3. Состояние интерфейса.
// ============================================================================

import { type PhaseId, type UniverseState } from '../../store/universeState';
import { resourceLedger } from '../../core/resourceLedger';
import { calmGlyphHover } from '../../core/glyphHover';
import { setSolidButtonLabel } from '../../core/buttonSolid';

// НАЧАЛО РАЗДЕЛА 1. КАНОНИЧЕСКИЕ ПОДПИСИ
// --- НАЧАЛО ФУНКЦИИ setCanonicalElementText ---
/**
 * Передаёт канонический текст общему контроллеру с сохранением доступного имени.
 */
function setCanonicalElementText(el: HTMLElement | null, nextText: string): void {
    if (!el || setSolidButtonLabel(el, nextText)) return;
    calmGlyphHover.setCanonical(el, nextText);
}
// --- КОНЕЦ ФУНКЦИИ setCanonicalElementText ---
// КОНЕЦ РАЗДЕЛА 1. КАНОНИЧЕСКИЕ ПОДПИСИ

// НАЧАЛО РАЗДЕЛА 2. БЕЗОПАСНЫЕ РАЗМЕРЫ ДОКОВ
// --- НАЧАЛО ФУНКЦИИ bindHudDockLayout ---
/** Резервирует реальные размеры верхнего меню и дока при переносе кнопок. */
export function bindHudDockLayout(): void {
    const dock = document.querySelector<HTMLElement>('.hud-bottom-bar');
    if (!dock) return;
    const root = document.documentElement;
    const header = document.querySelector<HTMLElement>('.brand-card');
    const previousInset = root.style.getPropertyValue('--hud-bottom-inset');
    const previousTopInset = root.style.getPropertyValue('--hud-top-inset');
    let lastInset = '';
    let lastTopInset = '';
    // --- НАЧАЛО ФУНКЦИИ updateDockInset ---
    const updateDockInset = (): void => {
        const inset = `${Math.ceil(window.innerHeight - dock.getBoundingClientRect().top + 12)}px`;
        if (inset !== lastInset) root.style.setProperty('--hud-bottom-inset', inset);
        lastInset = inset;
        if (header) {
            const topInset = `${Math.ceil(header.getBoundingClientRect().bottom + 12)}px`;
            if (topInset !== lastTopInset) root.style.setProperty('--hud-top-inset', topInset);
            lastTopInset = topInset;
        }
    };
    // --- КОНЕЦ ФУНКЦИИ updateDockInset ---
    updateDockInset();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateDockInset);
    observer?.observe(dock);
    if (header) observer?.observe(header);
    resourceLedger.registerPageDisposable(() => {
        observer?.disconnect();
        if (previousInset) root.style.setProperty('--hud-bottom-inset', previousInset);
        else root.style.removeProperty('--hud-bottom-inset');
        if (previousTopInset) root.style.setProperty('--hud-top-inset', previousTopInset);
        else root.style.removeProperty('--hud-top-inset');
    });
}
// --- КОНЕЦ ФУНКЦИИ bindHudDockLayout ---
// КОНЕЦ РАЗДЕЛА 2. БЕЗОПАСНЫЕ РАЗМЕРЫ ДОКОВ

// НАЧАЛО РАЗДЕЛА 3. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ HUD
// --- НАЧАЛО ФУНКЦИИ syncHudDomWithState ---
/**
 * Синхронизирует DOM-элементы паспорта фазы, шкалы прогресса и кнопок управления
 * в index.astro с актуальным состоянием UniverseStore.
 */
export function syncHudDomWithState(state: Readonly<UniverseState>): void {
    const codenameEl = document.getElementById('ui-phase-codename');
    const titleEl = document.getElementById('ui-phase-title');
    const subtitleEl = document.getElementById('ui-phase-subtitle');
    const philosophyEl = document.getElementById('ui-phase-philosophy');
    const progressEl = document.getElementById('ui-phase-progress');
    const overlayRoot = document.getElementById('hud-overlay-root');

    setCanonicalElementText(codenameEl, state.phaseMeta.codeName);
    setCanonicalElementText(titleEl, state.phaseMeta.titleRu);
    setCanonicalElementText(subtitleEl, state.phaseMeta.subtitleRu);
    setCanonicalElementText(philosophyEl, state.phaseMeta.philosophyRu);

    if (progressEl) {
        progressEl.style.width = `${(state.telemetry.phaseProgress * 100).toFixed(1)}%`;
    }

    if (overlayRoot) {
        overlayRoot.classList.toggle(
            'act-silence-hidden',
            state.singularityAct === 'ACT_C_ZERO_SILENCE'
        );
    }

    const phaseButtons = document.querySelectorAll<HTMLButtonElement>(
        '#ui-phase-buttons button[data-phase-id]'
    );
    phaseButtons.forEach((btn) => {
        const phaseId = btn.getAttribute('data-phase-id') as PhaseId | null;
        btn.classList.toggle('active', phaseId === state.currentPhase);
    });

    const btnPause = document.getElementById('btn-toggle-pause');
    if (btnPause) {
        setCanonicalElementText(btnPause, state.isPaused ? '▶ RESUME' : '⏸ PAUSE');
        btnPause.classList.toggle('active-toggle', state.isPaused);
    }

    const btnAuto = document.getElementById('btn-toggle-autocycle');
    if (btnAuto) {
        setCanonicalElementText(
            btnAuto,
            state.autoCyclePhases ? '🔄 AUTO: ON' : '🔄 AUTO: OFF'
        );
        btnAuto.classList.toggle('active-toggle', state.autoCyclePhases);
    }

    const btnAudio = document.getElementById('btn-toggle-audio');
    const unlockBanner = document.getElementById('ui-audio-unlock-banner');
    if (unlockBanner) {
        const isWaitingGesture =
            state.audioEnabled && state.telemetry.audioStatus === 'AWAITING_GESTURE';
        unlockBanner.classList.toggle('hidden', !isWaitingGesture);
    }
    if (btnAudio) {
        const aStatus = state.telemetry.audioStatus;
        const audioLabel =
            !state.audioEnabled || aStatus === 'MUTED'
                ? '🔇 AUDIO: MUTED'
                : aStatus === 'PLAYING_MP3' || aStatus === 'PLAYING_SYNTH'
                    ? '🔊 AUDIO: ON'
                    : '🔊 AUDIO: WAIT';
        setCanonicalElementText(btnAudio, audioLabel);
        btnAudio.classList.toggle(
            'active-toggle',
            state.audioEnabled && aStatus !== 'MUTED'
        );
    }

    const btnMetrics = document.getElementById('btn-toggle-metrics');
    if (btnMetrics) {
        btnMetrics.classList.toggle('active-toggle', state.layers.layer2_metricsHud);
    }

    const btnTopology = document.getElementById('btn-toggle-topology');
    if (btnTopology) {
        btnTopology.classList.toggle('active-toggle', state.layers.layer3_topologyGraph);
    }

    const btnTerminal = document.getElementById('btn-toggle-terminal');
    if (btnTerminal) {
        btnTerminal.classList.toggle(
            'active-toggle',
            state.layers.layer4_architectTerminal
        );
    }

    const btnXRay = document.getElementById('btn-toggle-xray');
    if (btnXRay) {
        btnXRay.classList.toggle('active-toggle', state.layers.layer5_truthXRayMode);
    }
}
// --- КОНЕЦ ФУНКЦИИ syncHudDomWithState ---
// КОНЕЦ РАЗДЕЛА 3. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ HUD
