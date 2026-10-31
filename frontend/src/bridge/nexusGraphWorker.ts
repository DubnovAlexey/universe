// ============================================================================
// ФАЙЛ: frontend/src/bridge/nexusGraphWorker.ts
// НАЗНАЧЕНИЕ: Фоновый поток (Web Worker), в котором пересобирается граф NEXUS:
//             MST Прима + критерий Габриэля + ветвление Мюррея + BFS-метрики.
// РАЗДЕЛЫ: 1. Протокол сообщений; 2. Обработчик запросов.
// ФУНКЦИИ: handleRequest.
// Тот же детерминированный NexusGraphEngine, что и в синхронном резервном пути, поэтому
// рёбра и метрики совпадают бит в бит; результат уходит плоскими буферами (Transferable),
// и главный поток только применяет готовые числа.
// ============================================================================

import { NexusGraphEngine, type GraphNodeInput, type NexusGraphTelemetry } from './simulationWorker';
import { packComputedGraph } from './nexusGraphPacking';

// НАЧАЛО РАЗДЕЛА 1. ПРОТОКОЛ СООБЩЕНИЙ
export interface NexusGraphRequest {
    readonly id: number;
    readonly generation: number;
    readonly nodes: readonly GraphNodeInput[];
    readonly maxConnectDist: number;
    readonly seed: number;
    readonly simTimeSec: number;
}
export type NexusGraphResponse =
    | {
        readonly id: number;
        readonly generation: number;
        /** Упакованные рёбра и степени (nexusGraphPacking.ts); буферы передаются без копирования. */
        readonly edges: Float64Array;
        readonly degrees: Int32Array;
        readonly telemetry: NexusGraphTelemetry;
        readonly computeMs: number;
    }
    | { readonly id: number; readonly generation: number; readonly error: string };
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ОБРАБОТЧИК ЗАПРОСОВ
const engine = new NexusGraphEngine();
const scope = self as unknown as {
    addEventListener(type: 'message', listener: (event: MessageEvent<NexusGraphRequest>) => void): void;
    postMessage(message: NexusGraphResponse, transfer?: Transferable[]): void;
};

// НАЧАЛО ФУНКЦИИ handleRequest
function handleRequest(event: MessageEvent<NexusGraphRequest>): void {
    const { id, generation, nodes, maxConnectDist, seed, simTimeSec } = event.data;
    try {
        const started = performance.now();
        const { edges, degreeByIndex } = engine.buildDeterministicGraph(nodes, maxConnectDist, seed, simTimeSec);
        const packed = packComputedGraph(edges, degreeByIndex);
        scope.postMessage({ id, generation, edges: packed.edges, degrees: packed.degrees, telemetry: engine.getLastTelemetry(),
            computeMs: performance.now() - started }, [packed.edges.buffer, packed.degrees.buffer]);
    } catch (error) {
        scope.postMessage({ id, generation, error: error instanceof Error ? error.message : String(error) });
    }
}
// КОНЕЦ ФУНКЦИИ handleRequest

scope.addEventListener('message', handleRequest);
// КОНЕЦ РАЗДЕЛА 2
