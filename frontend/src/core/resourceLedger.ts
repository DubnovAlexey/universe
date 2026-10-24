// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/resourceLedger.ts
// НАЗНАЧЕНИЕ: Книга учёта ресурсов ResourceLedger и контроль жизненного цикла
//             при перезапусках Вселенной (UNIVERSE v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. ResourceLedgerManager: getCounters, setBaseline, trackAllocation, trackPageLifetimeAllocation,
//      trackRelease, registerCycleDisposable, registerPageDisposable, getCycleAbortSignal,
//      disposeCycleResources, disposeAllPageResources.
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
    underflowCount: number;
    disposerErrors: number;
}

// ============================================================================
// РАЗДЕЛ. КЛАСС ResourceLedgerManager
// ============================================================================

class ResourceLedgerManager {
    private counters: ResourceCounters = {
        buffers: 1,
        textures: 0,
        audioNodes: 0,
        listeners: 0,
        workers: 0,
        restartCount: 0,
        underflowCount: 0,
        disposerErrors: 0,
    };

    private baseline: ResourceCounters = { ...this.counters };
    private cycleAbortController: AbortController = new AbortController();
    private cycleDisposables: Array<() => void> = [];
    private pageDisposables: Array<() => void> = [];

    // --- НАЧАЛО ФУНКЦИИ getCounters (ResourceLedgerManager) ---
    public getCounters(): Readonly<ResourceCounters> {
        return this.counters;
    }
    // --- КОНЕЦ ФУНКЦИИ getCounters (ResourceLedgerManager) ---

    // --- НАЧАЛО ФУНКЦИИ setBaseline (ResourceLedgerManager) ---
    public setBaseline(): void {
        this.counters.underflowCount = 0;
        this.counters.disposerErrors = 0;
        this.baseline = { ...this.counters };
    }
    // --- КОНЕЦ ФУНКЦИИ setBaseline (ResourceLedgerManager) ---

    /**
     * Учитывает аллокацию ресурса внутри текущего цикла.
     */
    // --- НАЧАЛО ФУНКЦИИ trackAllocation (ResourceLedgerManager) ---
    public trackAllocation(category: ResourceCategory, delta = 1): void {
        if (!Number.isFinite(delta) || delta <= 0) return;
        this.counters[category] += Math.floor(delta);
    }
    // --- КОНЕЦ ФУНКЦИИ trackAllocation (ResourceLedgerManager) ---

    /**
     * Учитывает однократную аллокацию ресурса уровня страницы (например, граф AudioContext
     * или постоянный паттерн дизеринга), синхронно поднимая baseline страницы.
     */
    // --- НАЧАЛО ФУНКЦИИ trackPageLifetimeAllocation (ResourceLedgerManager) ---
    public trackPageLifetimeAllocation(category: ResourceCategory, delta = 1): void {
        if (!Number.isFinite(delta) || delta <= 0) return;
        const amount = Math.floor(delta);
        this.counters[category] += amount;
        this.baseline[category] += amount;
    }
    // --- КОНЕЦ ФУНКЦИИ trackPageLifetimeAllocation (ResourceLedgerManager) ---

    // --- НАЧАЛО ФУНКЦИИ trackRelease (ResourceLedgerManager) ---
    public trackRelease(category: ResourceCategory, delta = 1): void {
        if (!Number.isFinite(delta) || delta <= 0) return;
        const amount = Math.floor(delta);
        const current = this.counters[category];
        if (amount > current) {
            this.counters.underflowCount += amount - current;
            this.counters[category] = 0;
        } else {
            this.counters[category] = current - amount;
        }
    }
    // --- КОНЕЦ ФУНКЦИИ trackRelease (ResourceLedgerManager) ---

    // --- НАЧАЛО ФУНКЦИИ registerCycleDisposable (ResourceLedgerManager) ---
    public registerCycleDisposable(disposeFn: () => void): void {
        this.cycleDisposables.push(disposeFn);
    }
    // --- КОНЕЦ ФУНКЦИИ registerCycleDisposable (ResourceLedgerManager) ---

    // --- НАЧАЛО ФУНКЦИИ registerPageDisposable (ResourceLedgerManager) ---
    public registerPageDisposable(disposeFn: () => void): void {
        this.pageDisposables.push(disposeFn);
    }
    // --- КОНЕЦ ФУНКЦИИ registerPageDisposable (ResourceLedgerManager) ---

    // --- НАЧАЛО ФУНКЦИИ getCycleAbortSignal (ResourceLedgerManager) ---
    public getCycleAbortSignal(): AbortSignal {
        return this.cycleAbortController.signal;
    }
    // --- КОНЕЦ ФУНКЦИИ getCycleAbortSignal (ResourceLedgerManager) ---

    // --- НАЧАЛО ФУНКЦИИ disposeCycleResources (ResourceLedgerManager) ---
    public disposeCycleResources(): { leakFree: boolean; report: string } {
        this.cycleAbortController.abort();
        this.cycleAbortController = new AbortController();

        for (let i = 0; i < this.cycleDisposables.length; i++) {
            try {
                this.cycleDisposables[i]();
            } catch {
                this.counters.disposerErrors += 1;
            }
        }
        this.cycleDisposables = [];
        this.counters.restartCount += 1;

        // Строгая проверка всех 5 категорий без скрытого допуска +3 на audioNodes
        const leakFree =
            this.counters.buffers <= this.baseline.buffers &&
            this.counters.textures <= this.baseline.textures &&
            this.counters.audioNodes <= this.baseline.audioNodes &&
            this.counters.listeners <= this.baseline.listeners &&
            this.counters.workers <= this.baseline.workers &&
            this.counters.underflowCount === this.baseline.underflowCount &&
            this.counters.disposerErrors === this.baseline.disposerErrors;

        const report = `Restart #${this.counters.restartCount}: buf=${this.counters.buffers}, tex=${this.counters.textures}, audio=${this.counters.audioNodes}, listeners=${this.counters.listeners}, workers=${this.counters.workers}, underflow=${this.counters.underflowCount}, err=${this.counters.disposerErrors} [${leakFree ? 'LEAK-FREE' : 'WARN'}]`;
        return { leakFree, report };
    }
    // --- КОНЕЦ ФУНКЦИИ disposeCycleResources (ResourceLedgerManager) ---

    // --- НАЧАЛО ФУНКЦИИ disposeAllPageResources (ResourceLedgerManager) ---
    public disposeAllPageResources(): void {
        this.disposeCycleResources();
        for (let i = 0; i < this.pageDisposables.length; i++) {
            try {
                this.pageDisposables[i]();
            } catch {
                this.counters.disposerErrors += 1;
            }
        }
        this.pageDisposables = [];
    }
    // --- КОНЕЦ ФУНКЦИИ disposeAllPageResources (ResourceLedgerManager) ---
}

export const resourceLedger = new ResourceLedgerManager();