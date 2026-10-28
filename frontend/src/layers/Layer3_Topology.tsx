// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer3_Topology.tsx
// НАЗНАЧЕНИЕ: Средний каскад правой колонки телеметрии (LAYER_03 // NEXUS GRAPH TOPOLOGY)
// АРХИТЕКТУРНЫЕ РАЗДЕЛОВ МОДУЛЯ:
// 1. Импорт нативной DOM/SVG фабрики React и декоратора мембраны Водопада
//    из верхнего каскада Layer2_Metrics.tsx.
// 2. Отображение 3 классов рёбер графа NEXUS (Class A MST Trunks, Class B
//    Gabriel Bridges, Class C Murray Dendrites) и выборочных BFS-метрик
//    (EST. DIAMETER / PATH (BFS)).
// 3. Mount-once монтировщик (mountLayer3Topology): однократное создание DOM
//    и плавное обновление значений без сброса анимации дыхания и Звездопада.
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. Функции модуля: renderLayer3TopologyView, mountLayer3Topology.
//   3. mountLayer3Topology: update.
// ============================================================================


import {
    React,
    setHudText,
    renderWaterfallMembraneDecor,
    waterfallAnimator,
} from './Layer2_Metrics';
import {
    nexusGraphEngine,
    type NexusGraphTelemetry,
} from '../bridge/simulationWorker';
import { universeStore, type UniverseState } from '../store/universeState';

// --- НАЧАЛО ФУНКЦИИ renderLayer3TopologyView ---
// ============================================================================
// РАЗДЕЛ 2. ФУНКЦИЯ renderLayer3TopologyView
// ============================================================================

export function renderLayer3TopologyView(
    state: Readonly<UniverseState>,
    metrics: Readonly<NexusGraphTelemetry>
): Element {
    const isVisible =
        state.layers.layer3_topologyGraph ||
        state.layers.layer5_truthXRayMode ||
        state.inspectionLevel === 'TOPOLOGY';
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
                    <span className="source-tag" data-bind="l3-source">
                        {metrics.computeSource}
                    </span>
                </div>

                <div className="topology-stats-row">
                    <div className="topology-stat-line">
                        <span className="label">CLASS A (MST TRUNKS):</span>
                        <strong
                            data-bind="l3-trunks"
                            data-breath-slot="l3_trunks"
                            data-breath-seed="0.8"
                            style={waterfallAnimator.getBreathingSlotStyle('l3_trunks', 0.8)}
                        >
                            {metrics.trunkCount} [MST]
                        </strong>
                    </div>
                    <div className="topology-stat-line">
                        <span className="label">CLASS B (GABRIEL BRIDGES):</span>
                        <strong
                            data-bind="l3-bridges"
                            data-breath-slot="l3_bridges"
                            data-breath-seed="1.6"
                            style={waterfallAnimator.getBreathingSlotStyle('l3_bridges', 1.6)}
                        >
                            {metrics.bridgeCount} [GABRIEL]
                        </strong>
                    </div>
                    <div className="topology-stat-line">
                        <span className="label">CLASS C (MURRAY DENDRITES):</span>
                        <strong
                            data-bind="l3-dendrites"
                            data-breath-slot="l3_dendrites"
                            data-breath-seed="2.4"
                            style={waterfallAnimator.getBreathingSlotStyle(
                                'l3_dendrites',
                                2.4
                            )}
                        >
                            {metrics.dendriteCount} [r_p³=∑r_c³]
                        </strong>
                    </div>
                </div>

                <div className="topology-stats-row">
                    <div className="topology-stat-line">
                        <span className="label">AVG DEGREE / CLUSTERING:</span>
                        <strong
                            data-bind="l3-deg"
                            data-breath-slot="l3_deg"
                            data-breath-seed="3.2"
                            style={waterfallAnimator.getBreathingSlotStyle('l3_deg', 3.2)}
                        >
                            {metrics.avgDegree} / {metrics.clusteringCoeff}
                        </strong>
                    </div>
                    <div className="topology-stat-line">
                        <span
                            className="label"
                            title="Выборочная оценка диаметра и средней длины пути методом BFS (до 28 стартовых вершин)"
                        >
                            EST. DIAMETER / PATH (BFS):
                        </span>
                        <strong
                            data-bind="l3-diam"
                            data-breath-slot="l3_diam"
                            data-breath-seed="4.0"
                            style={waterfallAnimator.getBreathingSlotStyle('l3_diam', 4.0)}
                        >
                            {metrics.diameterHops} hops / {metrics.avgPathLength}
                        </strong>
                    </div>
                    <div className="topology-stat-line">
                        <span className="label">PULSES IN FLIGHT:</span>
                        <strong
                            data-bind="l3-pulses"
                            data-breath-slot="l3_pulses"
                            data-breath-seed="4.8"
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
// --- КОНЕЦ ФУНКЦИИ renderLayer3TopologyView ---

// --- НАЧАЛО ФУНКЦИИ mountLayer3Topology ---
// ============================================================================
// РАЗДЕЛ 3. ФУНКЦИЯ mountLayer3Topology
// ============================================================================

export function mountLayer3Topology(container: HTMLElement | null): () => void {
    if (!container) return () => {};

    let rootEl: HTMLElement | null = null;
    let elSource: HTMLElement | null = null;
    let elTrunks: HTMLElement | null = null;
    let elBridges: HTMLElement | null = null;
    let elDendrites: HTMLElement | null = null;
    let elDeg: HTMLElement | null = null;
    let elDiam: HTMLElement | null = null;
    let elPulses: HTMLElement | null = null;

    // --- НАЧАЛО ФУНКЦИИ update (mountLayer3Topology) ---
    const update = (state: Readonly<UniverseState>): void => {
        const metrics = nexusGraphEngine.getLastTelemetry();

        if (!rootEl || !container.contains(rootEl)) {
            rootEl = renderLayer3TopologyView(state, metrics) as HTMLElement;
            container.replaceChildren(rootEl);
            waterfallAnimator.bindCascade(3, rootEl);
            elSource = rootEl.querySelector<HTMLElement>('[data-bind="l3-source"]');
            elTrunks = rootEl.querySelector<HTMLElement>('[data-bind="l3-trunks"]');
            elBridges = rootEl.querySelector<HTMLElement>('[data-bind="l3-bridges"]');
            elDendrites = rootEl.querySelector<HTMLElement>('[data-bind="l3-dendrites"]');
            elDeg = rootEl.querySelector<HTMLElement>('[data-bind="l3-deg"]');
            elDiam = rootEl.querySelector<HTMLElement>('[data-bind="l3-diam"]');
            elPulses = rootEl.querySelector<HTMLElement>('[data-bind="l3-pulses"]');
            return;
        }

        const isVisible =
            state.layers.layer3_topologyGraph ||
            state.layers.layer5_truthXRayMode ||
            state.inspectionLevel === 'TOPOLOGY';
        rootEl.classList.toggle('layer-hidden', !isVisible);

        setHudText(elSource, metrics.computeSource);
        setHudText(elTrunks, `${metrics.trunkCount} [MST]`);
        setHudText(elBridges, `${metrics.bridgeCount} [GABRIEL]`);
        setHudText(elDendrites, `${metrics.dendriteCount} [r_p³=∑r_c³]`);
        setHudText(elDeg, `${metrics.avgDegree} / ${metrics.clusteringCoeff}`);
        setHudText(elDiam, `${metrics.diameterHops} hops / ${metrics.avgPathLength}`);
        setHudText(elPulses, String(state.telemetry.activePulses));
    };
    // --- КОНЕЦ ФУНКЦИИ update (mountLayer3Topology) ---

    const unsubscribe = universeStore.subscribe(update);
    return () => {
        unsubscribe();
        waterfallAnimator.releaseCascade(3, rootEl);
    };
}
// --- КОНЕЦ ФУНКЦИИ mountLayer3Topology ---

export default renderLayer3TopologyView;
