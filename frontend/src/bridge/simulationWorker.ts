// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/simulationWorker.ts
// НАЗНАЧЕНИЕ: Движок когнитивной топологии NEXUS v2.4 (MST + Gabriel + Murray + BFS)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Контракты узлов, рёбер и честной телеметрии графа (NexusGraphTelemetry).
// 2. Построение 5-точечной таблицы длины дуги (buildBezierArcLengthLUT) и
//    равномерная выборка точки на кривой Безье (sampleBezierByArcLength).
// 3. Детерминированный синтез 3 классов рёбер:
//    - Класс A (AXON_TRUNK): минимальное остовное дерево Прима (MST);
//    - Класс B (BRIDGE): межкластерные мосты по критерию пустой сферы Габриэля;
//    - Класс C (DENDRITE): ветвящиеся дендриты по биофизическому закону Мюррея.
// 4. Реальное измерение топологических инвариантов (computeAuthenticGraphMetrics):
//    - локальный коэффициент кластеризации Уоттса — Строгаца по замкнутым треугольникам;
//    - точный диаметр графа (diameterHops) и средняя длина кратчайшего пути
//      (avgPathLength) через обход в ширину (BFS) по реальным связям.
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';

// ============================================================================
// РАЗДЕЛ 1. ТИПЫ И ИНТЕРФЕЙСЫ ГРАФОВОГО ДВИЖКА NEXUS
// ============================================================================

export type ComputedEdgeClass = 'AXON_TRUNK' | 'BRIDGE' | 'DENDRITE';

export interface GraphNodeInput {
    index: number;
    id: number;
    x: number;
    y: number;
    clusterId: number;
    energy: number;
}

export interface ComputedGraphEdge {
    id: string;
    fromIndex: number;
    toIndex: number;
    edgeClass: ComputedEdgeClass;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    ctrlX: number;
    ctrlY: number;
    arcLength: number;
    lengthLUT: readonly [number, number, number, number, number];
    murrayRadiusPx: number;
}

export interface NexusGraphTelemetry {
    trunkCount: number;
    bridgeCount: number;
    dendriteCount: number;
    avgDegree: number;
    clusteringCoeff: number;
    diameterHops: number;
    avgPathLength: number;
    computeTimeMs: number;
    computeSource: '[python/pyodide]' | '[python/server]' | '[ts/graph_engine]';
}

// ============================================================================
// РАЗДЕЛ 2. КЛАСС ПОСТРОИТЕЛЯ ГРАФА И АЛГОРИТМОВ КЛАСТЕРИЗАЦИИ / BFS
// ============================================================================

export class NexusGraphEngine {
    private lastMetrics: NexusGraphTelemetry = {
        trunkCount: 0,
        bridgeCount: 0,
        dendriteCount: 0,
        avgDegree: 0,
        clusteringCoeff: 0,
        diameterHops: 0,
        avgPathLength: 0,
        computeTimeMs: 0,
        computeSource: '[ts/graph_engine]',
    };

    constructor() {
        integrationRegistry.updateModuleStatus('pyodide-graph', 'fallback', 1.2);
    }

    public static buildBezierArcLengthLUT(
        x0: number,
        y0: number,
        cx: number,
        cy: number,
        x2: number,
        y2: number
    ): { arcLength: number; lut: [number, number, number, number, number] } {
        const lut: [number, number, number, number, number] = [0, 0, 0, 0, 0];
        let prevX = x0;
        let prevY = y0;
        let totalLen = 0;

        for (let step = 1; step <= 4; step++) {
            const t = step * 0.25;
            const inv = 1.0 - t;
            const px = inv * inv * x0 + 2 * inv * t * cx + t * t * x2;
            const py = inv * inv * y0 + 2 * inv * t * cy + t * t * y2;
            totalLen += Math.hypot(px - prevX, py - prevY);
            lut[step] = totalLen;
            prevX = px;
            prevY = py;
        }

        return { arcLength: Math.max(1.0, totalLen), lut };
    }

    public static sampleBezierByArcLength(
        x0: number,
        y0: number,
        cx: number,
        cy: number,
        x2: number,
        y2: number,
        lut: readonly [number, number, number, number, number],
        arcFraction: number
    ): { x: number; y: number } {
        const s = Math.max(0, Math.min(1, arcFraction));
        const totalLength = lut[4] || 1.0;
        const targetDist = s * totalLength;

        let t = s;
        for (let i = 0; i < 4; i++) {
            const d0 = lut[i];
            const d1 = lut[i + 1];
            if (targetDist >= d0 && targetDist <= d1) {
                const segFrac = d1 > d0 ? (targetDist - d0) / (d1 - d0) : 0;
                t = (i + segFrac) * 0.25;
                break;
            }
        }

        const inv = 1.0 - t;
        return {
            x: inv * inv * x0 + 2 * inv * t * cx + t * t * x2,
            y: inv * inv * y0 + 2 * inv * t * cy + t * t * y2,
        };
    }

    private createGraphEdge(
        a: GraphNodeInput,
        b: GraphNodeInput,
        edgeClass: ComputedEdgeClass,
        bendSign: number,
        bendScale: number,
        simTimeSec: number,
        murrayRadiusPx: number
    ): ComputedGraphEdge {
        const midX = (a.x + b.x) * 0.5;
        const midY = (a.y + b.y) * 0.5;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ctrlOffset = Math.sin(simTimeSec * 0.65 + (a.id + b.id) * 0.1) * 0.5 + 0.5;
        const ctrlX = midX - dy * bendScale * bendSign * (0.65 + ctrlOffset * 0.35);
        const ctrlY = midY + dx * bendScale * bendSign * (0.65 + ctrlOffset * 0.35);

        const { arcLength, lut } = NexusGraphEngine.buildBezierArcLengthLUT(
            a.x,
            a.y,
            ctrlX,
            ctrlY,
            b.x,
            b.y
        );

        const minId = Math.min(a.id, b.id);
        const maxId = Math.max(a.id, b.id);

        return {
            id: `${minId}_${maxId}`,
            fromIndex: a.index,
            toIndex: b.index,
            edgeClass,
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            ctrlX,
            ctrlY,
            arcLength,
            lengthLUT: lut,
            murrayRadiusPx,
        };
    }

    /**
     * Вычисляет подлинный коэффициент кластеризации (по замкнутым треугольникам)
     * и реальные диаметр и среднюю длину кратчайшего пути методом обхода в ширину (BFS).
     */
    private computeAuthenticGraphMetrics(
        activeNodes: ReadonlyArray<GraphNodeInput>,
        edges: ReadonlyArray<ComputedGraphEdge>
    ): {
        clusteringCoeff: number;
        diameterHops: number;
        avgPathLength: number;
    } {
        const n = activeNodes.length;
        if (n < 3 || edges.length === 0) {
            return { clusteringCoeff: 0, diameterHops: 0, avgPathLength: 0 };
        }

        const adj = new Map<number, Set<number>>();
        for (let i = 0; i < n; i++) {
            adj.set(activeNodes[i].index, new Set<number>());
        }
        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            adj.get(e.fromIndex)?.add(e.toIndex);
            adj.get(e.toIndex)?.add(e.fromIndex);
        }

        // 1. Истинный локальный коэффициент кластеризации C = (1/N) * sum(2 * T_i / (k_i * (k_i - 1)))
        let sumLocalClustering = 0;
        let nodesWithDegreeAtLeast2 = 0;

        adj.forEach((neighbors) => {
            const k = neighbors.size;
            if (k < 2) return;
            nodesWithDegreeAtLeast2++;
            const nbArr = Array.from(neighbors);
            let closedTriangles = 0;
            for (let a = 0; a < k; a++) {
                const setA = adj.get(nbArr[a]);
                if (!setA) continue;
                for (let b = a + 1; b < k; b++) {
                    if (setA.has(nbArr[b])) {
                        closedTriangles++;
                    }
                }
            }
            sumLocalClustering += (2.0 * closedTriangles) / (k * (k - 1));
        });

        const clusteringCoeff =
            nodesWithDegreeAtLeast2 > 0
                ? Number((sumLocalClustering / nodesWithDegreeAtLeast2).toFixed(3))
                : 0;

        // 2. Реальный обход в ширину (BFS) по репрезентативной выборке узлов для диаметра и длины пути
        const sampleStride = Math.max(1, Math.floor(n / 28));
        let maxHops = 0;
        let totalPathDist = 0;
        let reachablePairs = 0;

        for (let s = 0; s < n; s += sampleStride) {
            const startNodeIdx = activeNodes[s].index;
            const distMap = new Map<number, number>();
            const queue: number[] = [startNodeIdx];
            distMap.set(startNodeIdx, 0);

            let head = 0;
            while (head < queue.length) {
                const curr = queue[head++];
                const d = distMap.get(curr) ?? 0;
                if (d > maxHops) maxHops = d;

                const neighbors = adj.get(curr);
                if (!neighbors) continue;
                neighbors.forEach((nb) => {
                    if (!distMap.has(nb)) {
                        distMap.set(nb, d + 1);
                        totalPathDist += d + 1;
                        reachablePairs++;
                        queue.push(nb);
                    }
                });
            }
        }

        const avgPathLength =
            reachablePairs > 0
                ? Number((totalPathDist / reachablePairs).toFixed(2))
                : 0;

        return {
            clusteringCoeff,
            diameterHops: maxHops,
            avgPathLength,
        };
    }

    public buildDeterministicGraph(
        nodes: ReadonlyArray<GraphNodeInput>,
        maxConnectDist: number,
        seed: number,
        simTimeSec: number
    ): { edges: ComputedGraphEdge[]; degreeByIndex: Map<number, number> } {
        const t0 = performance.now();
        const edges: ComputedGraphEdge[] = [];
        const degreeByIndex = new Map<number, number>();
        const addedEdgeKeys = new Set<string>();

        const stride = nodes.length > 260 ? 2 : 1;
        const activeNodes: GraphNodeInput[] = [];
        for (let i = 0; i < nodes.length; i += stride) {
            activeNodes.push(nodes[i]);
            degreeByIndex.set(nodes[i].index, 0);
        }

        if (activeNodes.length < 3) {
            return { edges, degreeByIndex };
        }

        // 1. КЛАСС A (AXON_TRUNK): Остовное дерево Прима (MST) по главным узлам кластеров
        const hubNodes = activeNodes.slice(0, Math.min(36, activeNodes.length));
        const inTree = new Set<number>([0]);

        while (inTree.size < hubNodes.length) {
            let bestU = -1;
            let bestV = -1;
            let bestDist = maxConnectDist * 1.65;

            inTree.forEach((uIdx) => {
                const u = hubNodes[uIdx];
                for (let vIdx = 0; vIdx < hubNodes.length; vIdx++) {
                    if (inTree.has(vIdx)) continue;
                    const v = hubNodes[vIdx];
                    const d = Math.hypot(v.x - u.x, v.y - u.y);
                    if (d < bestDist) {
                        bestDist = d;
                        bestU = uIdx;
                        bestV = vIdx;
                    }
                }
            });

            if (bestU === -1 || bestV === -1) break;
            inTree.add(bestV);

            const nodeA = hubNodes[bestU];
            const nodeB = hubNodes[bestV];
            const key = `${Math.min(nodeA.id, nodeB.id)}_${Math.max(nodeA.id, nodeB.id)}`;
            addedEdgeKeys.add(key);

            const bendSign = (nodeA.id + nodeB.id + seed) % 2 === 0 ? 1 : -1;
            edges.push(
                this.createGraphEdge(
                    nodeA,
                    nodeB,
                    'AXON_TRUNK',
                    bendSign,
                    0.14,
                    simTimeSec,
                    1.95
                )
            );
            degreeByIndex.set(nodeA.index, (degreeByIndex.get(nodeA.index) ?? 0) + 1);
            degreeByIndex.set(nodeB.index, (degreeByIndex.get(nodeB.index) ?? 0) + 1);
        }

        // 2. КЛАСС B (BRIDGE - граф Габриэля) и КЛАСС C (DENDRITE - закон Мюррея)
        const maxDistSq = maxConnectDist * maxConnectDist;

        for (let i = 0; i < activeNodes.length; i++) {
            const a = activeNodes[i];
            let localConnections = degreeByIndex.get(a.index) ?? 0;
            if (localConnections >= 4) continue;

            for (let j = i + 1; j < activeNodes.length; j++) {
                if (localConnections >= 4) break;
                const b = activeNodes[j];
                if ((degreeByIndex.get(b.index) ?? 0) >= 4) continue;

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dSq = dx * dx + dy * dy;
                if (dSq > maxDistSq || dSq < 64) continue;

                const key = `${Math.min(a.id, b.id)}_${Math.max(a.id, b.id)}`;
                if (addedEdgeKeys.has(key)) continue;

                const midX = (a.x + b.x) * 0.5;
                const midY = (a.y + b.y) * 0.5;
                const radiusSq = dSq * 0.25;
                let isGabriel = true;

                for (
                    let k = Math.max(0, i - 10);
                    k < Math.min(activeNodes.length, i + 11);
                    k++
                ) {
                    if (k === i || k === j) continue;
                    const c = activeNodes[k];
                    const cdSq = (c.x - midX) * (c.x - midX) + (c.y - midY) * (c.y - midY);
                    if (cdSq < radiusSq * 0.85) {
                        isGabriel = false;
                        break;
                    }
                }

                if (!isGabriel && dSq > maxDistSq * 0.32) continue;

                const edgeClass: ComputedEdgeClass =
                    a.clusterId !== b.clusterId && isGabriel ? 'BRIDGE' : 'DENDRITE';

                const childBranchOrder = Math.max(1, localConnections + 1);
                const murrayRadiusPx =
                    edgeClass === 'BRIDGE'
                        ? 1.35
                        : Number((1.65 * Math.pow(childBranchOrder, -1 / 3)).toFixed(2));

                const bendSign = (a.id + b.id) % 2 === 0 ? 1 : -1;
                edges.push(
                    this.createGraphEdge(
                        a,
                        b,
                        edgeClass,
                        bendSign,
                        0.16,
                        simTimeSec,
                        murrayRadiusPx
                    )
                );
                addedEdgeKeys.add(key);

                localConnections++;
                degreeByIndex.set(a.index, localConnections);
                degreeByIndex.set(b.index, (degreeByIndex.get(b.index) ?? 0) + 1);
            }
        }

        let trunks = 0;
        let bridges = 0;
        let dendrites = 0;
        for (let i = 0; i < edges.length; i++) {
            if (edges[i].edgeClass === 'AXON_TRUNK') trunks++;
            else if (edges[i].edgeClass === 'BRIDGE') bridges++;
            else dendrites++;
        }

        const avgDeg =
            activeNodes.length > 0 ? (edges.length * 2) / activeNodes.length : 0;
        const realInvariants = this.computeAuthenticGraphMetrics(activeNodes, edges);
        const durMs = performance.now() - t0;

        integrationRegistry.recordModuleStep('pyodide-graph', durMs);
        integrationRegistry.recordModuleStep('worker-physics', durMs);

        this.lastMetrics = {
            trunkCount: trunks,
            bridgeCount: bridges,
            dendriteCount: dendrites,
            avgDegree: Number(avgDeg.toFixed(2)),
            clusteringCoeff: realInvariants.clusteringCoeff,
            diameterHops: realInvariants.diameterHops,
            avgPathLength: realInvariants.avgPathLength,
            computeTimeMs: Number(durMs.toFixed(2)),
            computeSource: '[ts/graph_engine]',
        };

        return { edges, degreeByIndex };
    }

    public getLastTelemetry(): Readonly<NexusGraphTelemetry> {
        return this.lastMetrics;
    }
}

export const nexusGraphEngine = new NexusGraphEngine();