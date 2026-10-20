// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer4_Terminal.tsx
// НАЗНАЧЕНИЕ: Нижний каскад правой колонки телеметрии (LAYER_04 // TERMINAL & LEDGER)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Импорт нативной DOM/SVG фабрики React и волнового контура мембраны
//    из модуля Layer2_Metrics.tsx.
// 2. Вывод живой матрицы модулей IntegrationRegistry (язык, статус, перцентили
//    времени шага p50/p95 мс) и подтверждение эквивалентности трёх оптик
//    (ILLUSION == NEXUS == X-RAY [StateDigest]).
// 3. Отображение счётчиков ресурсов ResourceLedger (buf, tex, audio, listeners,
//    restarts) и потока архитектурных логов с эффектом «Звездопада / Капель».
// 4. Реактивный монтировщик (mountLayer4Terminal) для слота #layer4-terminal-root.
// ============================================================================

import {
    React,
    renderWaterfallMembraneDecor,
    waterfallAnimator,
} from './Layer2_Metrics';
import {
    integrationRegistry,
    type PolyglotModuleRecord,
} from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { universeStore, type UniverseState } from '../store/universeState';

export function renderLayer4TerminalView(state: Readonly<UniverseState>): Element {
    const isVisible =
        state.layers.layer4_architectTerminal ||
        state.layers.layer5_truthXRayMode ||
        state.inspectionLevel === 'TERMINAL' ||
        state.debugMode;
    const hiddenClass = isVisible ? '' : ' layer-hidden';

    const modules = integrationRegistry.getAllModules().slice(0, 6);
    const ledger = resourceLedger.getCounters();
    const digest = state.telemetry.stateDigestHex;
    const recentLogs = state.terminalLogs.slice(0, 3);
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
                    <span className="digest-badge">
                        ILLUSION==NEXUS==X-RAY [{digest}]
                    </span>
                </div>

                <div className="registry-mini-table">
                    {modules.map((m: PolyglotModuleRecord, idx: number) => (
                        <div key={m.id} className="registry-row">
                            <span className="mod-id">{m.id}</span>
                            <span className="mod-lang">[{m.language}]</span>
                            <span className={`mod-status status-${m.status}`}>
                                {m.status.toUpperCase()}
                            </span>
                            <span
                                className="mod-perf"
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
                    style={waterfallAnimator.getBreathingSlotStyle('l4_ledger', 3.5)}
                >
                    <span>
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

export function mountLayer4Terminal(container: HTMLElement | null): () => void {
    if (!container) return () => {};
    waterfallAnimator.ensureRunning();

    const update = (state: Readonly<UniverseState>): void => {
        container.replaceChildren(renderLayer4TerminalView(state));
    };

    const unsub = universeStore.subscribe(update);
    const refreshTimer =
        typeof window !== 'undefined'
            ? window.setInterval(() => {
                update(universeStore.getState());
            }, 160)
            : 0;

    return () => {
        if (refreshTimer && typeof window !== 'undefined') {
            window.clearInterval(refreshTimer);
        }
        unsub();
    };
}

export default renderLayer4TerminalView;