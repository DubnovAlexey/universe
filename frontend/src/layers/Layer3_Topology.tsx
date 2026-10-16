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

import React, { useEffect, useState } from 'react';
import { nexusGraphEngine, type NexusGraphTelemetry } from '../bridge/simulationWorker';
import { universeStore } from '../store/universeState';

export const Layer3_Topology: React.FC = () => {
    const [visible, setVisible] = useState<boolean>(false);
    const [metrics, setMetrics] = useState<Readonly<NexusGraphTelemetry>>(() =>
        nexusGraphEngine.getLastTelemetry()
    );

    useEffect(() => {
        return universeStore.subscribe((state) => {
            setVisible(state.inspectionLevel === 'TOPOLOGY' || state.debugMode);
            setMetrics({ ...nexusGraphEngine.getLastTelemetry() });
        });
    }, []);

    if (!visible) {
        return null;
    }

    return (
        <section
            className="hud-panel topology-inspector-v2"
            data-ui-panel="true"
            aria-label="Инспектор топологии графа NEXUS"
        >
            <div className="inspector-header">
                <span className="phase-codename">LAYER_03 // NEXUS GRAPH TOPOLOGY</span>
                <span className="source-tag">{metrics.computeSource}</span>
            </div>

            <div className="topology-stats-row">
                <div>
                    <span className="label">КЛАСС A (MST МАГИСТРАЛИ):</span>{' '}
                    <strong>{metrics.trunkCount}</strong>
                </div>
                <div>
                    <span className="label">КЛАСС B (МОСТЫ ГАБРИЭЛЯ):</span>{' '}
                    <strong>{metrics.bridgeCount}</strong>
                </div>
                <div>
                    <span className="label">КЛАСС C (ДЕНДРИТЫ МЮРРЕЯ):</span>{' '}
                    <strong>{metrics.dendriteCount}</strong>
                </div>
            </div>

            <div className="topology-stats-row">
                <div>
                    <span className="label">DEGREE / CLUSTERING:</span>{' '}
                    <strong>
                        {metrics.avgDegree} / {metrics.clusteringCoeff}
                    </strong>
                </div>
                <div>
                    <span className="label">DIAMETER / AVG PATH:</span>{' '}
                    <strong>
                        {metrics.diameterHops} hops / {metrics.avgPathLength}
                    </strong>
                </div>
                <div>
                    <span className="label">STEP TIME:</span>{' '}
                    <strong>{metrics.computeTimeMs} ms</strong>
                </div>
            </div>
        </section>
    );
};

export default Layer3_Topology;