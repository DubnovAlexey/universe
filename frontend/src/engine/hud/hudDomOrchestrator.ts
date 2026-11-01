// ============================================================================
// ФАЙЛ: frontend/src/engine/hud/hudDomOrchestrator.ts
// НАЗНАЧЕНИЕ: Канонические подписи, безопасная область доков и синхронизация HUD.
// РАЗДЕЛЫ: 1. Подписи и состояние переключателей; 2. Размеры доков; 3. Состояние интерфейса.
// ФУНКЦИИ: setCanonicalElementText, setToggleState, bindHudDockLayout, updateDockInset, syncHudDomWithState.
// ============================================================================

import { type PhaseId, type UniverseState } from '../../store/universeState';
import { resourceLedger } from '../../core/resourceLedger';
import { calmGlyphHover } from '../../core/glyphHover';
import { setSolidButtonBackLabel, setSolidButtonLabel } from '../../core/buttonSolid';
import { translateUi } from '../../core/locale';

// НАЧАЛО РАЗДЕЛА 1. КАНОНИЧЕСКИЕ ПОДПИСИ
// --- НАЧАЛО ФУНКЦИИ setCanonicalElementText ---
/**
 * Передаёт канонический текст общему контроллеру с сохранением доступного имени.
 */
function setCanonicalElementText(el: HTMLElement | null, nextText: string): void {
    if (!el) return;
    if (el.dataset.localeSource !== nextText) el.dataset.localeSource = nextText;
    const translated = translateUi(nextText);
    setSolidButtonBackLabel(el, translateUi(nextText, 'en'));
    if (setSolidButtonLabel(el, translated)) return;
    calmGlyphHover.setCanonical(el, translated);
}
// --- КОНЕЦ ФУНКЦИИ setCanonicalElementText ---

// --- НАЧАЛО ФУНКЦИИ setToggleState ---
/**
 * Подсветка переключателя и его состояние для экранного диктора (aria-pressed) идут вместе.
 * Атрибут пишется только при изменении: синхронизация HUD вызывается часто.
 */
function setToggleState(el: HTMLElement | null, active: boolean): void {
    if (!el) return;
    el.classList.toggle('active-toggle', active);
    const pressed = active ? 'true' : 'false';
    if (el.getAttribute('aria-pressed') !== pressed) el.setAttribute('aria-pressed', pressed);
}
// --- КОНЕЦ ФУНКЦИИ setToggleState ---
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
    /**
     * Скрытый док или плашка (display: none — режимы КИНО и трейлер) не имеют рамки: getBoundingClientRect
     * даёт нули, и отступ снизу стал бы высотой всего окна — визитка уехала бы за верхний край. Тогда
     * резервируется только безопасная зона устройства.
     */
    const updateDockInset = (): void => {
        const dockRect = dock.getBoundingClientRect();
        const inset = dockRect.width > 0 || dockRect.height > 0
            ? `${Math.ceil(window.innerHeight - dockRect.top + 12)}px` : 'env(safe-area-inset-bottom, 0px)';
        if (inset !== lastInset) root.style.setProperty('--hud-bottom-inset', inset);
        lastInset = inset;
        if (header) {
            const headerRect = header.getBoundingClientRect();
            const topInset = headerRect.width > 0 || headerRect.height > 0
                ? `${Math.ceil(headerRect.bottom + 12)}px` : 'env(safe-area-inset-top, 0px)';
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
    const progressEl = document.getElementById('ui-phase-progress');
    const overlayRoot = document.getElementById('hud-overlay-root');

    setCanonicalElementText(codenameEl, state.phaseMeta.codeName);
    setCanonicalElementText(titleEl, state.phaseMeta.titleRu);
    setCanonicalElementText(subtitleEl, state.phaseMeta.subtitleRu);

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
        const current = phaseId === state.currentPhase;
        btn.classList.toggle('active', current);
        // Текущий шаг 108-секундного сюжета для экранного диктора.
        if (current && btn.getAttribute('aria-current') !== 'step') btn.setAttribute('aria-current', 'step');
        else if (!current && btn.hasAttribute('aria-current')) btn.removeAttribute('aria-current');
    });

    const btnPause = document.getElementById('btn-toggle-pause');
    if (btnPause) {
        setCanonicalElementText(btnPause, state.isPaused ? '▶ RESUME' : '⏸ PAUSE');
        setToggleState(btnPause, state.isPaused);
    }

    const btnAuto = document.getElementById('btn-toggle-autocycle');
    if (btnAuto) {
        setCanonicalElementText(
            btnAuto,
            state.autoCyclePhases ? '🔄 AUTO: ON' : '🔄 AUTO: OFF'
        );
        setToggleState(btnAuto, state.autoCyclePhases);
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
        setToggleState(btnAudio, state.audioEnabled && aStatus !== 'MUTED');
    }

    setToggleState(document.getElementById('btn-toggle-metrics'), state.layers.layer2_metricsHud);
    setToggleState(document.getElementById('btn-toggle-topology'), state.layers.layer3_topologyGraph);
    setToggleState(document.getElementById('btn-toggle-terminal'), state.layers.layer4_architectTerminal);
    setToggleState(document.getElementById('btn-toggle-xray'), state.layers.layer5_truthXRayMode);
}
// --- КОНЕЦ ФУНКЦИИ syncHudDomWithState ---
// КОНЕЦ РАЗДЕЛА 3. СИНХРОНИЗАЦИЯ СОСТОЯНИЯ HUD
