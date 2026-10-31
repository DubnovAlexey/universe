// ============================================================================
// ФАЙЛ: frontend/src/bridge/nexusGraphWorkerClient.ts
// НАЗНАЧЕНИЕ: Главный поток ↔ фоновый поток NEXUS: один запрос в полёте, поколения
//             частиц, сторож зависания и честный синхронный fallback.
// РАЗДЕЛЫ: 1. Контракт; 2. Клиент; 3. Экземпляр страницы.
// ФУНКЦИИ: NexusGraphWorkerClient: request, takeResult, isAvailable, dispose, ensureWorker,
// handleMessage, handleFailure.
// Пересборка графа (O(n²) пар узлов + BFS) больше не занимает кадр главного потока:
// рёбра приходят через 1–2 кадра и применяются к текущим координатам частиц.
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { nexusGraphEngine, type GraphNodeInput } from './simulationWorker';
import type { NexusGraphRequest, NexusGraphResponse } from './nexusGraphWorker';
import type { PackedNexusGraph } from './nexusGraphPacking';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ
export type NexusGraphRequestStatus = 'sent' | 'busy' | 'unavailable';
export interface NexusGraphResult {
    readonly generation: number;
    readonly packed: PackedNexusGraph;
    readonly maxConnectDist: number;
}
type WorkerFactory = () => Worker;
/** Если ответ не пришёл за это время, поток считается зависшим и граф считается синхронно. */
const WATCHDOG_MS = 2000;
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. КЛИЕНТ ФОНОВОГО ПОТОКА
export class NexusGraphWorkerClient {
    private worker: Worker | null = null;
    private failed = false;
    private nextId = 1;
    private pending: { id: number; generation: number; maxConnectDist: number; sentAt: number } | null = null;
    private ready: NexusGraphResult | null = null;
    private createdAt = 0;
    private answered = false;
    private readonly onMessage = (event: MessageEvent<NexusGraphResponse>): void => this.handleMessage(event.data);
    private readonly onError = (event: Event): void =>
        this.handleFailure(typeof (event as ErrorEvent).message === 'string' && (event as ErrorEvent).message
            ? (event as ErrorEvent).message : event.type);

    // НАЧАЛО ФУНКЦИИ constructor
    public constructor(private readonly createWorker: WorkerFactory | null = typeof Worker === 'undefined' || typeof window === 'undefined'
        ? null
        : () => new Worker(new URL('./nexusGraphWorker.ts', import.meta.url), { type: 'module', name: 'nexus-graph' })) {}
    // КОНЕЦ ФУНКЦИИ constructor

    // НАЧАЛО ФУНКЦИИ isAvailable
    public isAvailable(): boolean { return this.createWorker !== null && !this.failed; }
    // КОНЕЦ ФУНКЦИИ isAvailable

    // НАЧАЛО ФУНКЦИИ ensureWorker
    /** Поток создаётся при первой асинхронной пересборке, а не при импорте модуля. */
    private ensureWorker(): Worker | null {
        if (this.worker || !this.isAvailable()) return this.worker;
        try {
            this.worker = this.createWorker!();
            this.worker.addEventListener('message', this.onMessage);
            this.worker.addEventListener('error', this.onError);
            this.worker.addEventListener('messageerror', this.onError);
            this.createdAt = performance.now();
            integrationRegistry.updateModuleStatus('worker-physics', 'loading');
            resourceLedger.trackPageLifetimeAllocation('workers', 1);
            resourceLedger.trackPageLifetimeAllocation('listeners', 3);
            resourceLedger.registerPageDisposable(() => this.dispose());
        } catch (error) {
            this.worker = null;
            this.handleFailure(error instanceof Error ? error.message : String(error));
        }
        return this.worker;
    }
    // КОНЕЦ ФУНКЦИИ ensureWorker

    // НАЧАЛО ФУНКЦИИ request
    /**
     * 'sent' — запрос ушёл в поток; 'busy' — предыдущий ещё считается, пропускаем пересборку;
     * 'unavailable' — потока нет (тесты, старый браузер, сбой): вызывающий считает синхронно.
     */
    public request(generation: number, nodes: readonly GraphNodeInput[], maxConnectDist: number,
        seed: number, simTimeSec: number): NexusGraphRequestStatus {
        if (this.pending) {
            if (performance.now() - this.pending.sentAt < WATCHDOG_MS) return 'busy';
            this.handleFailure(`no reply within ${WATCHDOG_MS} ms`);
        }
        const worker = this.ensureWorker();
        if (!worker) return 'unavailable';
        const id = this.nextId++;
        const message: NexusGraphRequest = { id, generation, nodes, maxConnectDist, seed, simTimeSec };
        try {
            worker.postMessage(message);
        } catch (error) {
            this.handleFailure(error instanceof Error ? error.message : String(error));
            return 'unavailable';
        }
        this.pending = { id, generation, maxConnectDist, sentAt: performance.now() };
        return 'sent';
    }
    // КОНЕЦ ФУНКЦИИ request

    // НАЧАЛО ФУНКЦИИ takeResult
    /** Отдаёт готовый результат один раз; результат прошлого поколения частиц отбрасывается. */
    public takeResult(generation: number): NexusGraphResult | null {
        const result = this.ready;
        this.ready = null;
        return result && result.generation === generation ? result : null;
    }
    // КОНЕЦ ФУНКЦИИ takeResult

    // НАЧАЛО ФУНКЦИИ handleMessage
    private handleMessage(response: NexusGraphResponse): void {
        if (!this.pending || response.id !== this.pending.id) return;
        const { maxConnectDist } = this.pending;
        this.pending = null;
        if ('error' in response) {
            this.handleFailure(response.error);
            return;
        }
        if (!this.answered) {
            this.answered = true;
            integrationRegistry.updateModuleStatus('worker-physics', 'ready', performance.now() - this.createdAt, '');
        }
        integrationRegistry.recordModuleStep('worker-physics', response.computeMs);
        nexusGraphEngine.adoptTelemetry(response.telemetry);
        this.ready = { generation: response.generation, packed: { edges: response.edges, degrees: response.degrees }, maxConnectDist };
    }
    // КОНЕЦ ФУНКЦИИ handleMessage

    // НАЧАЛО ФУНКЦИИ handleFailure
    /** Любой сбой переводит граф на синхронный путь до перезагрузки страницы. */
    private handleFailure(message: string): void {
        this.failed = true;
        this.pending = null;
        this.ready = null;
        this.dispose();
        integrationRegistry.updateModuleStatus('worker-physics', 'fallback', undefined, message);
    }
    // КОНЕЦ ФУНКЦИИ handleFailure

    // НАЧАЛО ФУНКЦИИ dispose
    public dispose(): void {
        if (!this.worker) return;
        this.worker.removeEventListener('message', this.onMessage);
        this.worker.removeEventListener('error', this.onError);
        this.worker.removeEventListener('messageerror', this.onError);
        this.worker.terminate();
        this.worker = null;
        this.pending = null;
        resourceLedger.trackPageLifetimeRelease('workers', 1);
        resourceLedger.trackPageLifetimeRelease('listeners', 3);
    }
    // КОНЕЦ ФУНКЦИИ dispose
}
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ЭКЗЕМПЛЯР СТРАНИЦЫ
export const nexusGraphWorkerClient = new NexusGraphWorkerClient();
// КОНЕЦ РАЗДЕЛА 3
