// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer3_Topology.tsx
// НАЗНАЧЕНИЕ: Средний каскад правой колонки телеметрии (LAYER_03 // NEXUS GRAPH TOPOLOGY)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Импорт нативной DOM/SVG фабрики React и декоратора мембраны Водопада
//    из верхнего каскада Layer2_Metrics.tsx.
// 2. Отображение 3 классов рёбер графа NEXUS из nexusGraphEngine:
//    - Class A (MST Trunks): магистральные аксоны минимального остовного дерева;
//    - Class B (Gabriel Bridges): межкластерные синаптические мосты Габриэля;
//    - Class C (Murray Dendrites): ветвящиеся дендриты по закону Мюррея r_p^3 = sum r_c^3.
// 3. Вывод топологических инвариантов (средняя степень узлов, кластеризация,
//    диаметр в хопах, длина пути и активные синаптические импульсы в полёте)
//    с плавным дыханием цифр и 60-FPS «Звездопадом / Каплями».
// 4. Реактивный монтировщик (mountLayer3Topology) без лишних таймеров перерисовки.
// ============================================================================

import {
    React,
    renderWaterfallMembraneDecor,
    waterfallAnimator,
} from './Layer2_Metrics';
import {
    nexusGraphEngine,
    type NexusGraphTelemetry,
} from '../bridge/simulationWorker';
import { universeStore, type UniverseState } from '../store/universeState';

export function renderLayer3TopologyView(
    state: Readonly<UniverseState>,
    metrics: Readonly<NexusGraphTelemetry>
): Element {
    const isVisible =
        state.layers.layer3_topologyGraph ||
        state.layers.layer2_metricsHud ||
        state.layers.layer5_truthXRayMode ||
        state.inspectionLevel === 'TOPOLOGY' ||
        state.debugMode;
    const hiddenClass = isVisible ? '' : ' layer-hidden';
    const decor = renderWaterfallMembraneDecor(3);

    return (
        <section
            className={`hud-panel topology-inspector-v2${hiddenClass}`}
            data-ui-panel="true"
            aria-label="Инспектор топологии графа NEXUS"
        >
            {decor}

            <div className="waterfall-panel-content">
                <div className="inspector-header">
                    <span className="phase-codename">LAYER_03 // NEXUS GRAPH TOPOLOGY</span>
                    <span className="source-tag">{metrics.computeSource}</span>
                </div>

                <div className="topology-stats-row">
                    <div className="topology-stat-line">
                        <span className="label">CLASS A (MST TRUNKS):</span>
                        <strong
                            style={waterfallAnimator.getBreathingSlotStyle('l3_trunks', 0.8)}
                        >
                            {metrics.trunkCount} [MST]
                        </strong>
                    </div>
                    <div className="topology-stat-line">
                        <span className="label">CLASS B (GABRIEL BRIDGES):</span>
                        <strong
                            style={waterfallAnimator.getBreathingSlotStyle('l3_bridges', 1.6)}
                        >
                            {metrics.bridgeCount} [GABRIEL]
                        </strong>
                    </div>
                    <div className="topology-stat-line">
                        <span className="label">CLASS C (MURRAY DENDRITES):</span>
                        <strong
                            style={waterfallAnimator.getBreathingSlotStyle('l3_dendrites', 2.4)}
                        >
                            {metrics.dendriteCount} [r_p³=∑r_c³]
                        </strong>
                    </div>
                </div>

                <div className="topology-stats-row">
                    <div className="topology-stat-line">
                        <span className="label">AVG DEGREE / CLUSTERING:</span>
                        <strong
                            style={waterfallAnimator.getBreathingSlotStyle('l3_deg', 3.2)}
                        >
                            {metrics.avgDegree} / {metrics.clusteringCoeff}
                        </strong>
                    </div>
                    <div className="topology-stat-line">
                        <span className="label">DIAMETER / PATH:</span>
                        <strong
                            style={waterfallAnimator.getBreathingSlotStyle('l3_diam', 4.0)}
                        >
                            {metrics.diameterHops} hops / {metrics.avgPathLength}
                        </strong>
                    </div>
                    <div className="topology-stat-line">
                        <span className="label">PULSES IN FLIGHT:</span>
                        <strong
                            style={waterfallAnimator.getBreathingSlotStyle('l3_pulses', 4.8)}
                        >
                            {state.telemetry.activePulses}
                        </strong>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function mountLayer3Topology(container: HTMLElement | null): () => void {
    if (!container) return () => {};
    waterfallAnimator.ensureRunning();

    const update = (state: Readonly<UniverseState>): void => {
        const metrics = nexusGraphEngine.getLastTelemetry();
        container.replaceChildren(renderLayer3TopologyView(state, metrics));
    };

    return universeStore.subscribe(update);
}

export default renderLayer3TopologyView;