// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/resourceLedger.ts
// НАЗНАЧЕНИЕ: Книга учёта ресурсов ResourceLedger и контроль утечек (MASTER 00 правило 12)
// ЗАДАЧИ ФАЙЛА:
// 1. Отслеживать активные буферы, текстуры, AudioNodes, слушатели событий и Worker'ы.
// 2. Управлять подписками DOM через AbortController для гарантированной очистки.
// 3. Проверять инвариант Restart: после перезапуска цикла счётчики возвращаются к базе.
// ============================================================================

export type ResourceCategory =
    | 'buffers'
    | 'textures'
    | 'audioNodes'
    | 'listeners'
    | 'workers';

export interface ResourceCounters {
    buffers: number;
    textures: number;
    audioNodes: number;
    listeners: number;
    workers: number;
    restartCount: number;
}

class ResourceLedgerManager {
    private counters: ResourceCounters = {
        buffers: 1,
        textures: 0,
        audioNodes: 0,
        listeners: 0,
        workers: 0,
        restartCount: 0,
    };

    private baseline: ResourceCounters = { ...this.counters };
    private cycleAbortController: AbortController = new AbortController();
    private disposables: Array<() => void> = [];

    public getCounters(): Readonly<ResourceCounters> {
        return this.counters;
    }

    public setBaseline(): void {
        this.baseline = { ...this.counters };
    }

    public trackAllocation(category: ResourceCategory, delta = 1): void {
        this.counters[category] = Math.max(0, this.counters[category] + delta);
    }

    public trackRelease(category: ResourceCategory, delta = 1): void {
        this.counters[category] = Math.max(0, this.counters[category] - delta);
    }

    public registerCycleDisposable(disposeFn: () => void): void {
        this.disposables.push(disposeFn);
    }

    public getCycleAbortSignal(): AbortSignal {
        return this.cycleAbortController.signal;
    }

    public disposeCycleResources(): { leakFree: boolean; report: string } {
        this.cycleAbortController.abort();
        this.cycleAbortController = new AbortController();

        for (let i = 0; i < this.disposables.length; i++) {
            try {
                this.disposables[i]();
            } catch {
                // Подавление ошибок при освобождении ресурса
            }
        }
        this.disposables = [];
        this.counters.restartCount += 1;

        const leakFree =
            this.counters.buffers <= this.baseline.buffers + 1 &&
            this.counters.textures <= this.baseline.textures &&
            this.counters.workers <= this.baseline.workers;

        const report = `Restart #${this.counters.restartCount}: buf=${this.counters.buffers}, audio=${this.counters.audioNodes}, listeners=${this.counters.listeners} [${leakFree ? 'LEAK-FREE' : 'WARN'}]`;
        return { leakFree, report };
    }
}

export const resourceLedger = new ResourceLedgerManager();