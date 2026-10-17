// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer2_Metrics.tsx
// НАЗНАЧЕНИЕ: Реактивная TSX-фабрика и инспекционная панель METRICS v2.0 (MASTER 00B / 02 / 04)
// ЗАДАЧИ ФАЙЛА:
// 1. Предоставлять автономную TSX/DOM фабрику React.createElement, возвращающую DOM Element.
// 2. Отображать реально измеренные метрики: FPS, frameTimeMs, p95, дрейф энергии ΔE/E₀,
//    параметр синхронизации Курамото r(t), уровень тишины RMS и 32-битный State Digest.
// 3. Помечать каждое значение точным языком и модулем-владельцем ([rust/gravity.rs],
//    [python/graph_logic.py], [wgsl/breach.wgsl], [web-audio]).
// ============================================================================

import { universeStore, type UniverseState } from '../store/universeState';

// ----------------------------------------------------------------------------
// 1. АВТОНОМНАЯ ФАБРИКА JSX -> DOM ELEMENT (БЕЗ ОШИБКИ TS2322)
// ----------------------------------------------------------------------------
function appendJsxChildren(parent: Node, children: unknown[]): void {
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (Array.isArray(child)) {
            appendJsxChildren(parent, child);
        } else if (child instanceof Node) {
            parent.appendChild(child);
        } else if (child !== null && child !== undefined && typeof child !== 'boolean') {
            parent.appendChild(document.createTextNode(String(child)));
        }
    }
}

export const React = {
    createElement(
        tag: string | ((props: Record<string, unknown>) => Element),
        props: Record<string, unknown> | null,
        ...children: unknown[]
    ): Element {
        if (typeof tag === 'function') {
            return tag({ ...(props ?? {}), children });
        }

        const el = document.createElement(tag);
        if (props) {
            const keys = Object.keys(props);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const val = props[key];
                if (val === undefined || val === null || val === false || key === 'children') continue;

                if (key === 'className') {
                    el.className = String(val);
                } else if (key.startsWith('on') && typeof val === 'function') {
                    const eventName = key.slice(2).toLowerCase();
                    el.addEventListener(eventName, val as EventListener);
                } else if (val === true) {
                    el.setAttribute(key, '');
                } else {
                    el.setAttribute(key, String(val));
                }
            }
        }

        appendJsxChildren(el, children);
        return el;
    },
};

// ----------------------------------------------------------------------------
// 2. JSX-КОМПОНЕНТ И МОНТИРОВЩИК СЛОЯ LAYER 2: METRICS (ПОДПИСКА <= 10 ГЦ)
// ----------------------------------------------------------------------------
export function renderLayer2MetricsView(snap: Readonly<UniverseState>): Element {
    const t = snap.telemetry;
    const hiddenClass = snap.layers.layer2_metricsHud ? '' : ' layer-hidden';

    return (
        <aside
            className={`hud-panel metrics-inspector-v2${hiddenClass}`}
            data-ui-panel="true"
            aria-label="Инженерная телеметрия полиглот-ядра"
        >
            <div className="inspector-header">
                <span className="phase-codename">LAYER_02 // POLYGLOT TELEMETRY</span>
                <span
                    className="digest-badge"
                    title="32-bit FNV-1a State Digest (ILLUSION == NEXUS == X-RAY)"
                >
          DIGEST: {t.stateDigestHex}
        </span>
            </div>

            <div className="metrics-grid">
                <div className="metric-box">
                    <span className="label">FPS / P95 [ts/renderer.ts]</span>
                    <span className="value">
            {t.fps} FPS <small>({t.frameTimeMs}/{t.frameTimeP95Ms}ms)</small>
          </span>
                </div>

                <div className="metric-box">
                    <span className="label">ΔE/E₀ [rust/gravity.rs]</span>
                    <span className="value">{t.energyDriftRatio.toExponential(2)}</span>
                </div>

                <div className="metric-box">
                    <span className="label">KURAMOTO r(t) [rust/gravity.rs]</span>
                    <span className="value">{t.kuramotoOrderR.toFixed(3)}</span>
                </div>

                <div className="metric-box">
                    <span className="label">NODES / EDGES [python/graph_logic.py]</span>
                    <span className="value">
            {t.activeParticles} / {t.activeConnections}
          </span>
                </div>

                <div className="metric-box">
                    <span className="label">CORE STATUS [IntegrationRegistry]</span>
                    <span className="value">
            {t.wasmStatus} · {t.pythonBackendStatus}
          </span>
                </div>

                <div className="metric-box">
                    <span className="label">AUDIO RMS [web-audio]</span>
                    <span className="value">
            {t.audioStatus} ({t.silenceRmsDb.toFixed(1)} dBFS)
          </span>
                </div>
            </div>
        </aside>
    );
}

export function mountLayer2Metrics(container: HTMLElement | null): () => void {
    if (!container) return () => {};
    const update = (state: Readonly<UniverseState>) => {
        container.replaceChildren(renderLayer2MetricsView(state));
    };
    return universeStore.subscribe(update);
}

export default renderLayer2MetricsView;