// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer4_Terminal.tsx
// НАЗНАЧЕНИЕ: Нижний каскад правой колонки телеметрии (LAYER_04 // TERMINAL & LEDGER)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ:
// 1. Вывод полной матрицы всех 8 модулей IntegrationRegistry (включая web-audio и
//    worker-physics) с реальными перцентилями времени шага p50/p95 мс.
// 2. Отображение счётчиков ресурсов ResourceLedger и потока архитектурных логов.
// 3. Mount-once монтировщик (mountLayer4Terminal) без пересоздания DOM-дерева.
// ============================================================================

import {
    React,
    setHudText,
    renderWaterfallMembraneDecor,
    waterfallAnimator,
} from './Layer2_Metrics';
import {
    integrationRegistry,
    type PolyglotModuleRecord,
} from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { universeStore, type UniverseState } from '../store/universeState';

// --- НАЧАЛО ФУНКЦИИ renderLayer4TerminalView ---
// ============================================================================
// РАЗДЕЛ 2. ФУНКЦИЯ renderLayer4TerminalView
// ============================================================================

export function renderLayer4TerminalView(state: Readonly<UniverseState>): Element {
    const isVisible =
        state.layers.layer4_architectTerminal ||
        state.layers.layer5_truthXRayMode ||
        state.inspectionLevel === 'TERMINAL';
    const hiddenClass = isVisible ? '' : ' layer-hidden';

    // Выводим все 8 зарегистрированных модулей (включая web-audio и worker-physics)
    const modules = integrationRegistry.getAllModules();
    const ledger = resourceLedger.getCounters();
    const digest = state.telemetry.stateDigestHex;
    const recentLogs = [
        state.terminalLogs[0] ?? '',
        state.terminalLogs[1] ?? '',
        state.terminalLogs[2] ?? '',
    ];
    const decor = renderWaterfallMembraneDecor(4);

    return (
        <section
            className={`hud-panel terminal-inspector-v2${hiddenClass}`}
            data-ui-panel="true"
            aria-label="Инженерный терминал и реестр полиглот-модулей"
        >
            {decor}

            <div className="waterfall-panel-content">
                <div className="inspector-header">
                    <span className="phase-codename">
                        LAYER_04 // TERMINAL &amp; REGISTRY
                    </span>
                    <span className="digest-badge" data-bind="l4-digest">
                        ILLUSION==NEXUS==X-RAY [{digest}]
                    </span>
                </div>

                <div className="registry-mini-table">
                    {modules.map((m: PolyglotModuleRecord, idx: number) => (
                        <div key={m.id} className="registry-row">
                            <span className="mod-id">{m.id}</span>
                            <span className="mod-lang">[{m.language}]</span>
                            <span
                                className={`mod-status status-${m.status}`}
                                data-bind={`l4-status-${idx}`}
                            >
                                {m.status.toUpperCase()}
                            </span>
                            <span
                                className="mod-perf"
                                data-bind={`l4-perf-${idx}`}
                                data-breath-slot={idx < 3 ? `l4_mod${idx}` : undefined}
                                data-breath-seed={idx < 3 ? String(idx * 0.9) : undefined}
                                style={
                                    idx < 3
                                        ? waterfallAnimator.getBreathingSlotStyle(
                                            `l4_mod${idx}`,
                                            idx * 0.9
                                        )
                                        : undefined
                                }
                            >
                                {m.stepP50Ms}ms / {m.stepP95Ms}ms
                            </span>
                        </div>
                    ))}
                </div>

                <div
                    className="ledger-bar"
                    data-breath-slot="l4_ledger"
                    data-breath-seed="3.5"
                    style={waterfallAnimator.getBreathingSlotStyle('l4_ledger', 3.5)}
                >
                    <span data-bind="l4-ledger">
                        LEDGER: buf={ledger.buffers} | tex={ledger.textures} | audio=
                        {ledger.audioNodes} | listeners={ledger.listeners} | restarts=
                        {ledger.restartCount}
                    </span>
                </div>

                <div className="terminal-log-box">
                    {recentLogs.map((line: string, idx: number) => (
                        <div
                            key={`log_${idx}`}
                            className="terminal-log-line"
                            data-bind={`l4-log-${idx}`}
                            data-breath-slot={idx === 0 ? 'l4_log0' : undefined}
                            data-breath-seed={idx === 0 ? '4.4' : undefined}
                            style={
                                idx === 0
                                    ? waterfallAnimator.getBreathingSlotStyle('l4_log0', 4.4)
                                    : undefined
                            }
                        >
                            {line}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
// --- КОНЕЦ ФУНКЦИИ renderLayer4TerminalView ---

// --- НАЧАЛО ФУНКЦИИ mountLayer4Terminal ---
// ============================================================================
// РАЗДЕЛ 3. ФУНКЦИЯ mountLayer4Terminal
// ============================================================================

export function mountLayer4Terminal(container: HTMLElement | null): () => void {
    if (!container) return () => {};

    let rootEl: HTMLElement | null = null;
    let elDigest: HTMLElement | null = null;
    let elLedger: HTMLElement | null = null;
    const statusEls: Array<HTMLElement | null> = [];
    const perfEls: Array<HTMLElement | null> = [];
    const logEls: Array<HTMLElement | null> = [];

    // --- НАЧАЛО ФУНКЦИИ update (mountLayer4Terminal) ---
    const update = (state: Readonly<UniverseState>): void => {
        const modules = integrationRegistry.getAllModules();

        if (!rootEl || !container.contains(rootEl)) {
            rootEl = renderLayer4TerminalView(state) as HTMLElement;
            container.replaceChildren(rootEl);
            waterfallAnimator.bindCascade(4, rootEl);
            elDigest = rootEl.querySelector<HTMLElement>('[data-bind="l4-digest"]');
            elLedger = rootEl.querySelector<HTMLElement>('[data-bind="l4-ledger"]');
            statusEls.length = 0;
            perfEls.length = 0;
            logEls.length = 0;
            for (let i = 0; i < modules.length; i++) {
                statusEls.push(
                    rootEl.querySelector<HTMLElement>(`[data-bind="l4-status-${i}"]`)
                );
                perfEls.push(
                    rootEl.querySelector<HTMLElement>(`[data-bind="l4-perf-${i}"]`)
                );
            }
            for (let i = 0; i < 3; i++) {
                logEls.push(
                    rootEl.querySelector<HTMLElement>(`[data-bind="l4-log-${i}"]`)
                );
            }
            return;
        }

        const isVisible =
            state.layers.layer4_architectTerminal ||
            state.layers.layer5_truthXRayMode ||
            state.inspectionLevel === 'TERMINAL';
        rootEl.classList.toggle('layer-hidden', !isVisible);

        setHudText(elDigest, `ILLUSION==NEXUS==X-RAY [${state.telemetry.stateDigestHex}]`);

        for (let i = 0; i < modules.length; i++) {
            const m = modules[i];
            const sEl = statusEls[i];
            if (sEl) {
                const statusClass = `mod-status status-${m.status}`;
                if (sEl.className !== statusClass) sEl.className = statusClass;
                setHudText(sEl, m.status.toUpperCase());
            }
            const pEl = perfEls[i];
            if (pEl) {
                setHudText(pEl, `${m.stepP50Ms}ms / ${m.stepP95Ms}ms`);
            }
        }

        const ledger = resourceLedger.getCounters();
        setHudText(elLedger, `LEDGER: buf=${ledger.buffers} | tex=${ledger.textures} | audio=${ledger.audioNodes} | listeners=${ledger.listeners} | restarts=${ledger.restartCount}`);

        for (let i = 0; i < 3; i++) {
            const lEl = logEls[i];
            if (lEl) {
                setHudText(lEl, state.terminalLogs[i] ?? '');
            }
        }
    };
    // --- КОНЕЦ ФУНКЦИИ update (mountLayer4Terminal) ---

    const unsubscribe = universeStore.subscribe(update);
    return () => {
        unsubscribe();
        waterfallAnimator.releaseCascade(4, rootEl);
    };
}
// --- КОНЕЦ ФУНКЦИИ mountLayer4Terminal ---

export default renderLayer4TerminalView;
