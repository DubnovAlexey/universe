// ============================================================================
// ФАЙЛ: frontend/src/tests/nexusGraphWorker.test.ts
// НАЗНАЧЕНИЕ: Проверить клиент фонового потока NEXUS: один запрос в полёте, совпадение
//             с синхронной сборкой, поколения частиц, сбои, сторож и освобождение ресурсов.
// РАЗДЕЛЫ: 1. Поддельный Worker; 2. Проверки клиента.
// ФУНКЦИИ: FakeWorker (postMessage, terminate, reply, fail), metricsOf, runNexusGraphWorkerChecks.
// ============================================================================

import { NexusGraphWorkerClient } from '../bridge/nexusGraphWorkerClient';
import { NexusGraphEngine, nexusGraphEngine, type GraphNodeInput, type NexusGraphTelemetry } from '../bridge/simulationWorker';
import type { NexusGraphRequest, NexusGraphResponse } from '../bridge/nexusGraphWorker';
import { packComputedGraph } from '../bridge/nexusGraphPacking';
import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';

// НАЧАЛО РАЗДЕЛА 1. ПОДДЕЛЬНЫЙ WORKER: ТОТ ЖЕ ДВИЖОК, НО ОТВЕТ ПО КОМАНДЕ ТЕСТА
class FakeWorker extends EventTarget {
    public readonly posted: NexusGraphRequest[] = [];
    public terminated = false;
    private readonly engine = new NexusGraphEngine();
    public postMessage(message: NexusGraphRequest): void { this.posted.push(structuredClone(message)); }
    public terminate(): void { this.terminated = true; }
    // НАЧАЛО ФУНКЦИИ reply
    /** Отвечает так же, как настоящий поток: тот же движок, structured clone в обе стороны. */
    public reply(override: { id?: number; error?: string } = {}): void {
        const request = this.posted[this.posted.length - 1];
        const id = override.id ?? request.id;
        let response: NexusGraphResponse;
        if (override.error) response = { id, generation: request.generation, error: override.error };
        else {
            const { edges, degreeByIndex } = this.engine.buildDeterministicGraph(request.nodes, request.maxConnectDist,
                request.seed, request.simTimeSec);
            const packed = packComputedGraph(edges, degreeByIndex);
            response = { id, generation: request.generation, edges: packed.edges, degrees: packed.degrees,
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
    const factory = (): Worker => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; };
    const status = (): string | undefined => integrationRegistry.getModule('worker-physics')?.status;
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
        worker.reply();
        const readyAfterReply = status() === 'ready' && integrationRegistry.getModule('worker-physics')?.lastStepMs === 1.25;
        const result = client.takeResult(7);
        check(first === 'sent' && busy === 'busy' && workers.length === 1 && worker.posted.length === 1 && loading &&
            result !== null && result.packed.edges.length === built.edges.length * 16 && built.edges.length > 100 &&
            result.packed.edges.every((value, index) => Object.is(value, reference.edges[index])) &&
            result.packed.degrees.every((value, index) => value === reference.degrees[index]) && result.maxConnectDist === 185 &&
            client.takeResult(7) === null && readyAfterReply &&
            metricsOf(nexusGraphEngine.getLastTelemetry()) === metricsOf(referenceEngine.getLastTelemetry()) &&
            resourceLedger.getCounters().listeners === baseline.listeners + 3 &&
            resourceLedger.getCounters().workers === baseline.workers + 1,
        'One request at a time goes to the worker; its edges, degrees and metrics match the synchronous engine exactly and are taken once');

        client.request(8, nodes, 185, 104729, 3);
        worker.reply({ id: 999_999 });
        const foreignIgnored = client.takeResult(8) === null && client.request(8, nodes, 185, 104729, 3.2) === 'busy';
        worker.reply();
        const staleDropped = client.takeResult(9) === null;
        check(foreignIgnored && staleDropped && client.request(9, nodes, 185, 104729, 3.4) === 'sent',
            'Replies with a foreign id are ignored and a result for an old particle generation is dropped after respawn');

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
    } catch (error) {
        check(false, `NEXUS worker client threw: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        restoreNow();
        if (registry && savedRegistry) Object.assign(registry, savedRegistry);
        nexusGraphEngine.adoptTelemetry(savedTelemetry);
    }
    // КОНЕЦ РАЗДЕЛА 2
}
// КОНЕЦ ФУНКЦИИ runNexusGraphWorkerChecks
