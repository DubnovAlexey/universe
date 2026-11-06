// ============================================================================
// ФАЙЛ: frontend/src/tests/nexusGraphWorker.test.ts
// НАЗНАЧЕНИЕ: Проверить клиент фонового потока NEXUS: один запрос в полёте, совпадение
//             с синхронной сборкой, поколения/метрики, холодную сборку симуляции и fallback.
// РАЗДЕЛЫ: 1. Поддельный Worker; 2. Проверки клиента; 3. Первая сборка симуляции.
// ФУНКЦИИ: FakeWorker (postMessage, terminate, reply, fail), metricsOf, runNexusGraphWorkerChecks.
// ============================================================================

import { NexusGraphWorkerClient, nexusGraphWorkerClient } from '../bridge/nexusGraphWorkerClient';
import { NexusGraphEngine, nexusGraphEngine, type GraphNodeInput, type NexusGraphTelemetry } from '../bridge/simulationWorker';
import type { NexusGraphRequest, NexusGraphResponse } from '../bridge/nexusGraphWorker';
import { packComputedGraph } from '../bridge/nexusGraphPacking';
import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { VoidPhaseSimulation, type TopologyEdge } from '../phases/01_void';
import { wasmPhysicsBridge } from '../bridge/wasmBridge';

// НАЧАЛО РАЗДЕЛА 1. ПОДДЕЛЬНЫЙ WORKER: ТОТ ЖЕ ДВИЖОК, НО ОТВЕТ ПО КОМАНДЕ ТЕСТА
class FakeWorker extends EventTarget {
    public readonly posted: NexusGraphRequest[] = [];
    public terminated = false;
    private readonly engine = new NexusGraphEngine();
    public postMessage(message: NexusGraphRequest): void { this.posted.push(structuredClone(message)); }
    public terminate(): void { this.terminated = true; }
    // НАЧАЛО ФУНКЦИИ reply
    /** Отвечает так же, как настоящий поток: тот же движок, structured clone в обе стороны. */
    public reply(override: { id?: number; generation?: number; error?: string } = {}): void {
        const request = this.posted[this.posted.length - 1];
        const id = override.id ?? request.id;
        const generation = override.generation ?? request.generation;
        let response: NexusGraphResponse;
        if (override.error) response = { id, generation, error: override.error };
        else {
            const { edges, degreeByIndex } = this.engine.buildDeterministicGraph(request.nodes, request.maxConnectDist,
                request.seed, request.simTimeSec);
            const packed = packComputedGraph(edges, degreeByIndex);
            response = { id, generation, edges: packed.edges, degrees: packed.degrees,
                telemetry: this.engine.getLastTelemetry(), computeMs: 1.25 };
        }
        this.dispatchEvent(new MessageEvent('message', { data: structuredClone(response) }));
    }
    // КОНЕЦ ФУНКЦИИ reply
    // НАЧАЛО ФУНКЦИИ fail
    public fail(): void { this.dispatchEvent(new Event('error')); }
    // КОНЕЦ ФУНКЦИИ fail
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ metricsOf
/** Метрики без времени вычисления: оно у потока и главного потока разное. */
function metricsOf(telemetry: Readonly<NexusGraphTelemetry>): string {
    const { computeTimeMs: _ignored, ...rest } = telemetry;
    return JSON.stringify(rest);
}
// КОНЕЦ ФУНКЦИИ metricsOf

// НАЧАЛО ФУНКЦИИ runNexusGraphWorkerChecks
export function runNexusGraphWorkerChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. ПРОВЕРКИ КЛИЕНТА
    const nodes: GraphNodeInput[] = Array.from({ length: 180 }, (_, index) => ({
        index, id: 1000 + index, x: 80 + (index * 97) % 1600, y: 60 + (index * 53) % 820,
        clusterId: index % 6, energy: 0.3 + (index % 7) / 10,
    }));
    const registry = integrationRegistry.getModule('worker-physics');
    const savedRegistry = registry ? { ...registry } : undefined;
    const savedTelemetry = { ...nexusGraphEngine.getLastTelemetry() };
    const baseline = { ...resourceLedger.getCounters() };
    // performance.now в Node живёт на прототипе: подмена — собственное свойство, восстановление — его удаление.
    const ownNow = Object.getOwnPropertyDescriptor(performance, 'now');
    const realNow = performance.now.bind(performance);
    const restoreNow = (): void => {
        if (ownNow) Object.defineProperty(performance, 'now', ownNow);
        else Reflect.deleteProperty(performance, 'now');
    };
    const workers: FakeWorker[] = [];
    const extraClients: NexusGraphWorkerClient[] = [];
    const factory = (): Worker => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; };
    const status = (): string | undefined => integrationRegistry.getModule('worker-physics')?.status;
    const requestDescriptor = Object.getOwnPropertyDescriptor(nexusGraphWorkerClient, 'request');
    const resultDescriptor = Object.getOwnPropertyDescriptor(nexusGraphWorkerClient, 'takeResult');
    const buildDescriptor = Object.getOwnPropertyDescriptor(nexusGraphEngine, 'buildDeterministicGraph');
    const initDescriptor = Object.getOwnPropertyDescriptor(wasmPhysicsBridge, 'initKuramotoOscillators');
    const originalBuild = nexusGraphEngine.buildDeterministicGraph;
    const restoreMethod = (target: object, name: string, descriptor: PropertyDescriptor | undefined): void => {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else Reflect.deleteProperty(target, name);
    };
    try {
        const offline = new NexusGraphWorkerClient(null);
        check(!offline.isAvailable() && offline.request(1, nodes, 185, 104729, 1) === 'unavailable' && offline.takeResult(1) === null,
            'Without Worker support the NEXUS client reports unavailable so the simulation keeps its synchronous graph path');

        // Эталон считается заранее: конструктор движка сам пишет статус реестра.
        const referenceEngine = new NexusGraphEngine();
        const built = referenceEngine.buildDeterministicGraph(nodes, 185, 104729, 2.5);
        const reference = packComputedGraph(built.edges, built.degreeByIndex);
        const client = new NexusGraphWorkerClient(factory);
        const first = client.request(7, nodes, 185, 104729, 2.5);
        const busy = client.request(7, nodes, 185, 104729, 2.62);
        const loading = status() === 'loading';
        const worker = workers[0];
        const beforeReply = JSON.stringify(nexusGraphEngine.getLastTelemetry());
        worker.reply();
        const readyAfterReply = status() === 'ready' && integrationRegistry.getModule('worker-physics')?.lastStepMs === 1.25;
        const telemetryWaitsForApplication = JSON.stringify(nexusGraphEngine.getLastTelemetry()) === beforeReply;
        const result = client.takeResult(7);
        check(first === 'sent' && busy === 'busy' && workers.length === 1 && worker.posted.length === 1 && loading &&
            result !== null && result.packed.edges.length === built.edges.length * 16 && built.edges.length > 100 &&
            result.packed.edges.every((value, index) => Object.is(value, reference.edges[index])) &&
            result.packed.degrees.every((value, index) => value === reference.degrees[index]) && result.maxConnectDist === 185 &&
            client.takeResult(7) === null && readyAfterReply && telemetryWaitsForApplication &&
            metricsOf(nexusGraphEngine.getLastTelemetry()) === metricsOf(referenceEngine.getLastTelemetry()) &&
            resourceLedger.getCounters().listeners === baseline.listeners + 3 &&
            resourceLedger.getCounters().workers === baseline.workers + 1,
        'One request at a time goes to the worker; its edges, degrees and metrics match the synchronous engine exactly and are taken once');

        nexusGraphEngine.adoptTelemetry({ ...savedTelemetry, trunkCount: 123456 });
        const beforeStale = JSON.stringify(nexusGraphEngine.getLastTelemetry());
        client.request(8, nodes, 185, 104729, 3);
        worker.reply({ id: 999_999 });
        const foreignIgnored = client.takeResult(8) === null && client.request(8, nodes, 185, 104729, 3.2) === 'busy';
        worker.reply({ generation: 999_999 });
        const foreignGenerationIgnored = client.takeResult(8) === null && client.request(8, nodes, 185, 104729, 3.2) === 'busy';
        worker.reply();
        const staleDropped = client.takeResult(9) === null && client.takeResult(8) === null &&
            JSON.stringify(nexusGraphEngine.getLastTelemetry()) === beforeStale;
        check(foreignIgnored && foreignGenerationIgnored && staleDropped && client.request(9, nodes, 185, 104729, 3.4) === 'sent',
            'Foreign ids/generations are ignored and respawn drops old graph and telemetry without adopting either');

        Object.defineProperty(performance, 'now', { configurable: true, writable: true, value: () => realNow() + 5000 });
        const watchdog = client.request(9, nodes, 185, 104729, 3.6);
        restoreNow();
        check(watchdog === 'unavailable' && worker.terminated && !client.isAvailable() && status() === 'fallback' &&
            client.request(10, nodes, 185, 104729, 4) === 'unavailable' && workers.length === 1 &&
            resourceLedger.getCounters().listeners === baseline.listeners && resourceLedger.getCounters().workers === baseline.workers,
        'A worker that stays silent past the watchdog is terminated once and the graph permanently returns to the synchronous path');

        const crashing = new NexusGraphWorkerClient(factory);
        crashing.request(1, nodes, 185, 104729, 1);
        workers[workers.length - 1].fail();
        const crashed = !crashing.isAvailable() && workers[workers.length - 1].terminated && status() === 'fallback';
        const erroring = new NexusGraphWorkerClient(factory);
        erroring.request(1, nodes, 185, 104729, 1);
        workers[workers.length - 1].reply({ error: 'boom' });
        check(crashed && !erroring.isAvailable() && workers[workers.length - 1].terminated &&
            integrationRegistry.getModule('worker-physics')?.lastError === 'boom' && erroring.takeResult(1) === null &&
            resourceLedger.getCounters().listeners === baseline.listeners &&
            resourceLedger.getCounters().workers === baseline.workers &&
            resourceLedger.getCounters().underflowCount === baseline.underflowCount,
        'Worker error events and error replies switch to the fallback status, terminate the thread and release its listeners exactly once');

        const disposed = new NexusGraphWorkerClient(factory);
        const failedReady = new NexusGraphWorkerClient(factory);
        extraClients.push(disposed, failedReady);
        disposed.request(1, nodes, 185, 104729, 1);
        workers[workers.length - 1].reply();
        disposed.dispose();
        disposed.dispose();
        failedReady.request(1, nodes, 185, 104729, 1);
        workers[workers.length - 1].reply();
        workers[workers.length - 1].fail();
        check(disposed.takeResult(1) === null && failedReady.takeResult(1) === null &&
            JSON.stringify(nexusGraphEngine.getLastTelemetry()) === beforeStale &&
            resourceLedger.getCounters().listeners === baseline.listeners && resourceLedger.getCounters().workers === baseline.workers &&
            resourceLedger.getCounters().underflowCount === baseline.underflowCount,
            'Dispose and failure discard an unapplied ready graph with its telemetry and repeated disposal releases no extra resources');

        // НАЧАЛО РАЗДЕЛА 3. РЕАЛЬНАЯ ХОЛОДНАЯ ВЕТВЬ СИМУЛЯЦИИ БЕЗ КОНСТРУКТОРА/WASM
        const fixture: GraphNodeInput[] = [
            { index: 0, id: 0, x: 0, y: 0, clusterId: 0, energy: 0.9 },
            { index: 1, id: 1, x: 80, y: 0, clusterId: 0, energy: 0.8 },
            { index: 2, id: 2, x: 40, y: 80, clusterId: 0, energy: 0.85 },
            { index: 3, id: 3, x: 160, y: 0, clusterId: 1, energy: 0.75 },
            { index: 4, id: 4, x: 240, y: 0, clusterId: 1, energy: 0.7 },
            { index: 5, id: 5, x: 200, y: 80, clusterId: 1, energy: 0.8 },
        ];
        type TopologyProbe = {
            particles: Array<GraphNodeInput & { depthTier: 'MIDGROUND'; degree: number }>;
            edges: TopologyEdge[];
            topologyGeneration: number;
            lastTopologyBuildSimSec: number;
            respawnParticles(count: number): void;
            updateTopologyAndEdgeCurves(dt: number, phase: '01_VOID', simTimeSec: number, seed: number): void;
        };
        const probe = (): TopologyProbe => Object.assign(Object.create(VoidPhaseSimulation.prototype), {
            particles: fixture.map(node => ({ ...node, depthTier: 'MIDGROUND', degree: 0 })),
            edges: [], afterglowMap: new Map(), width: 920, height: 920,
            topologyGeneration: 7, lastTopologyBuildSimSec: -10,
        });
        const expected = referenceEngine.buildDeterministicGraph(fixture, 185, 104729, 2.5);
        const expectedMetrics = metricsOf(referenceEngine.getLastTelemetry());
        const matchesGraph = (simulation: TopologyProbe): boolean => simulation.edges.length === expected.edges.length &&
            simulation.particles.every(particle => particle.degree === expected.degreeByIndex.get(particle.index)) &&
            simulation.edges.every((edge, index) => {
                const target = expected.edges[index];
                return edge.id === target.id && edge.edgeClass === target.edgeClass &&
                    edge.fromIndex === target.fromIndex && edge.toIndex === target.toIndex &&
                    edge.x1 === target.x1 && edge.y1 === target.y1 && edge.x2 === target.x2 && edge.y2 === target.y2 &&
                    Math.abs(edge.ctrlX - target.ctrlX) <= 0.0051 && Math.abs(edge.ctrlY - target.ctrlY) <= 0.0051 &&
                    edge.arcLength === target.arcLength && edge.murrayRadiusPx === target.murrayRadiusPx &&
                    edge.lengthLUT.every((value, lutIndex) => value === target.lengthLUT[lutIndex]);
            });
        const simulationClient = new NexusGraphWorkerClient(factory);
        extraClients.push(simulationClient);
        Object.defineProperty(nexusGraphWorkerClient, 'request', { configurable: true,
            value: (...args: Parameters<NexusGraphWorkerClient['request']>) => simulationClient.request(...args) });
        Object.defineProperty(nexusGraphWorkerClient, 'takeResult', { configurable: true,
            value: (generation: number) => simulationClient.takeResult(generation) });
        let synchronousBuilds = 0;
        Object.defineProperty(nexusGraphEngine, 'buildDeterministicGraph', { configurable: true,
            value: (...args: Parameters<NexusGraphEngine['buildDeterministicGraph']>) => {
                synchronousBuilds++;
                return originalBuild.apply(nexusGraphEngine, args);
            } });
        const cold = probe();
        cold.updateTopologyAndEdgeCurves(0, '01_VOID', 2.5, 104729);
        const simulationWorker = workers[workers.length - 1];
        check(simulationWorker.posted.length === 1 && synchronousBuilds === 0 && cold.edges.length === 0 &&
            cold.particles.every(particle => particle.degree === 0) && cold.lastTopologyBuildSimSec === 2.5,
            'The real simulation sends its first empty-graph rebuild to the worker and leaves particles available without a synchronous graph');
        cold.updateTopologyAndEdgeCurves(0, '01_VOID', 2.5, 104729);
        check(simulationWorker.posted.length === 1 && synchronousBuilds === 0 && cold.edges.length === 0,
            'Pending first-graph work stays busy without queueing another message or synchronously building on the next frame');
        simulationWorker.reply();
        cold.updateTopologyAndEdgeCurves(0, '01_VOID', 2.5, 104729);
        check(synchronousBuilds === 0 && matchesGraph(cold) && new Set(cold.edges.map(edge => edge.edgeClass)).size === 3 &&
            metricsOf(nexusGraphEngine.getLastTelemetry()) === expectedMetrics,
            'The first worker reply uses the real apply path with matching degrees, all edge classes, controls, arc LUTs, radii and graph metrics');
        cold.lastTopologyBuildSimSec = -10;
        cold.updateTopologyAndEdgeCurves(0, '01_VOID', 2.6, 104729);
        // Реальный respawn без изменения состояния провайдера физики, которым пользуются другие проверки.
        Object.defineProperty(wasmPhysicsBridge, 'initKuramotoOscillators', { configurable: true, value: (): void => {} });
        cold.respawnParticles(6);
        const emptyGraphMetrics = JSON.stringify(nexusGraphEngine.getLastTelemetry());
        const emptyMetricsAreZero = Object.entries(nexusGraphEngine.getLastTelemetry()).every(([key, value]) =>
            key === 'computeSource' ? value === '[ts/graph_engine]' : value === 0);
        simulationWorker.reply();
        cold.updateTopologyAndEdgeCurves(0, '01_VOID', 2.6, 104729);
        check(cold.topologyGeneration === 8 && cold.edges.length === 0 && synchronousBuilds === 0 &&
            simulationWorker.posted.length === 3 && simulationWorker.posted.at(-1)!.generation === 8 &&
            cold.particles.every(particle => particle.degree === 0) && emptyMetricsAreZero &&
            JSON.stringify(nexusGraphEngine.getLastTelemetry()) === emptyGraphMetrics,
            'Real respawn clears graph metrics and rejects a late old-generation graph and telemetry before sending the first new-generation request');
        simulationWorker.reply();
        cold.updateTopologyAndEdgeCurves(0, '01_VOID', 2.6, 104729);
        const restartedMetrics = nexusGraphEngine.getLastTelemetry();
        check(cold.edges.length > 0 && synchronousBuilds === 0 &&
            restartedMetrics.trunkCount + restartedMetrics.bridgeCount + restartedMetrics.dendriteCount === cold.edges.length,
            'Only an accepted new-generation reply replaces the empty restart graph and its zero metrics');
        simulationClient.dispose();
        Object.defineProperty(nexusGraphWorkerClient, 'request', { configurable: true,
            value: (...args: Parameters<NexusGraphWorkerClient['request']>) => offline.request(...args) });
        Object.defineProperty(nexusGraphWorkerClient, 'takeResult', { configurable: true,
            value: (generation: number) => offline.takeResult(generation) });
        const fallback = probe();
        fallback.updateTopologyAndEdgeCurves(0, '01_VOID', 2.5, 104729);
        check(synchronousBuilds === 1 && matchesGraph(fallback) && fallback.edges.every((edge, index) =>
            edge.ctrlX === expected.edges[index].ctrlX && edge.ctrlY === expected.edges[index].ctrlY) &&
            metricsOf(nexusGraphEngine.getLastTelemetry()) === expectedMetrics,
            'An unavailable worker still builds and applies the identical graph synchronously in that same simulation callback');
    } catch (error) {
        check(false, `NEXUS worker client threw: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        restoreNow();
        for (const client of extraClients) client.dispose();
        restoreMethod(nexusGraphWorkerClient, 'request', requestDescriptor);
        restoreMethod(nexusGraphWorkerClient, 'takeResult', resultDescriptor);
        restoreMethod(nexusGraphEngine, 'buildDeterministicGraph', buildDescriptor);
        restoreMethod(wasmPhysicsBridge, 'initKuramotoOscillators', initDescriptor);
        if (registry && savedRegistry) Object.assign(registry, savedRegistry);
        nexusGraphEngine.adoptTelemetry(savedTelemetry);
    }
    // КОНЕЦ РАЗДЕЛА 2
}
// КОНЕЦ ФУНКЦИИ runNexusGraphWorkerChecks
