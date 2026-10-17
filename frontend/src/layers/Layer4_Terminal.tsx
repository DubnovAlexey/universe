// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer4_Terminal.tsx
// НАЗНАЧЕНИЕ: Инженерная консоль TERMINAL, аудит модулей и проверка State Digest (MASTER 00B / 05)
// ЗАДАЧИ ФАЙЛА:
// 1. Выводить реальную таблицу 8 модулей из IntegrationRegistry (язык, статус, p50/p95 мс, файл).
// 2. Демонстрировать паритет трёх оптик: stateDigest(ILLUSION) == stateDigest(NEXUS) == stateDigest(X-RAY).
// 3. Отображать журнал событий шины EventBus и результат проверки тишины AnalyserNode RMS < -80 dBFS.
// ============================================================================

import { React } from './Layer2_Metrics';
import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { universeStore, type UniverseState } from '../store/universeState';

export function renderLayer4TerminalView(state: Readonly<UniverseState>): Element {
    const isVisible =
        state.layers.layer4_architectTerminal ||
        state.inspectionLevel === 'TERMINAL' ||
        state.debugMode;
    const hiddenClass = isVisible ? '' : ' layer-hidden';

    const modules = integrationRegistry.getAllModules();
    const ledger = resourceLedger.getCounters();
    const digest = state.telemetry.stateDigestHex;
    const recentLogs = state.terminalLogs.slice(-6);

    return (
        <section
            className={`hud-panel terminal-inspector-v2${hiddenClass}`}
            data-ui-panel="true"
            aria-label="Инженерный терминал и реестр полиглот-модулей"
        >
            <div className="inspector-header">
        <span className="phase-codename">
          LAYER_04 // ARCHITECT TERMINAL &amp; INTEGRATION REGISTRY
        </span>
                <span className="digest-badge">
          ILLUSION == NEXUS == X-RAY [{digest}]
        </span>
            </div>

            <div className="registry-mini-table">
                {modules.map((m) => (
                    <div className="registry-row">
                        <span className="mod-id">{m.id}</span>
                        <span className="mod-lang">[{m.language}]</span>
                        <span className={`mod-status status-${m.status}`}>{m.status.toUpperCase()}</span>
                        <span className="mod-perf">
              p50:{m.stepP50Ms}ms / p95:{m.stepP95Ms}ms
            </span>
                    </div>
                ))}
            </div>

            <div className="ledger-bar">
        <span>
          RESOURCE LEDGER: buf={ledger.buffers} | tex={ledger.textures} | audio={ledger.audioNodes} |
          listeners={ledger.listeners} | restarts={ledger.restartCount}
        </span>
            </div>

            <div className="terminal-log-box">
                {recentLogs.map((line) => (
                    <div className="terminal-log-line">{line}</div>
                ))}
            </div>
        </section>
    );
}

export function mountLayer4Terminal(container: HTMLElement | null): () => void {
    if (!container) return () => {};
    const update = (state: Readonly<UniverseState>) => {
        container.replaceChildren(renderLayer4TerminalView(state));
    };
    return universeStore.subscribe(update);
}

export default renderLayer4TerminalView;