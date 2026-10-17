// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer3_Topology.tsx
// НАЗНАЧЕНИЕ: Инспектор когнитивной топологии NEXUS v2.0 (MASTER 03)
// ЗАДАЧИ ФАЙЛА:
// 1. Выводить реальные вычисленные метрики графа из nexusGraphEngine:
//    число магистралей (MST, класс A), мостов Габриэля (класс B), дендритов Мюррея (класс C).
// 2. Показывать среднюю степень узлов, коэффициент кластеризации, диаметр и длину пути.
// 3. Отображать честный источник расчёта графа ([python/pyodide], [python/server], [ts fallback]).
// ============================================================================

import { React } from './Layer2_Metrics';
import { nexusGraphEngine, type NexusGraphTelemetry } from '../bridge/simulationWorker';
import { universeStore, type UniverseState } from '../store/universeState';

export function renderLayer3TopologyView(
    state: Readonly<UniverseState>,
    metrics: Readonly<NexusGraphTelemetry>
): Element {
    const isVisible =
        state.inspectionLevel === 'TOPOLOGY' ||
        state.layers.layer2_metricsHud ||
        state.debugMode;
    const hiddenClass = isVisible ? '' : ' layer-hidden';

    return (
        <section
            className={`hud-panel topology-inspector-v2${hiddenClass}`}
            data-ui-panel="true"
            aria-label="Инспектор топологии графа NEXUS"
        >
            <div className="inspector-header">
                <span className="phase-codename">LAYER_03 // NEXUS GRAPH TOPOLOGY</span>
                <span className="source-tag">{metrics.computeSource}</span>
            </div>

            <div className="topology-stats-row">
                <div>
                    <span className="label">CLASS A (MST TRUNKS): </span>
                    <strong>{metrics.trunkCount}</strong>
                </div>
                <div>
                    <span className="label">CLASS B (GABRIEL BRIDGES): </span>
                    <strong>{metrics.bridgeCount}</strong>
                </div>
                <div>
                    <span className="label">CLASS C (MURRAY DENDRITES): </span>
                    <strong>{metrics.dendriteCount}</strong>
                </div>
            </div>

            <div className="topology-stats-row">
                <div>
                    <span className="label">AVG DEGREE / CLUSTERING: </span>
                    <strong>
                        {metrics.avgDegree} / {metrics.clusteringCoeff}
                    </strong>
                </div>
                <div>
                    <span className="label">DIAMETER / PATH: </span>
                    <strong>
                        {metrics.diameterHops} hops / {metrics.avgPathLength}
                    </strong>
                </div>
                <div>
                    <span className="label">PULSES IN FLIGHT: </span>
                    <strong>{state.telemetry.activePulses}</strong>
                </div>
            </div>
        </section>
    );
}

export function mountLayer3Topology(container: HTMLElement | null): () => void {
    if (!container) return () => {};
    const update = (state: Readonly<UniverseState>) => {
        const metrics = nexusGraphEngine.getLastTelemetry();
        container.replaceChildren(renderLayer3TopologyView(state, metrics));
    };
    return universeStore.subscribe(update);
}

export default renderLayer3TopologyView;