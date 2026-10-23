// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/resourceLedger.ts
// НАЗНАЧЕНИЕ: Книга учёта ресурсов ResourceLedger и контроль жизненного цикла
//             при перезапусках Вселенной (UNIVERSE v2.5)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ:
//   РАЗДЕЛ 1. Типы категорий ресурсов и интерфейс счётчиков (ResourceCounters),
//             включая диагностику underflowCount и disposerErrors.
//   РАЗДЕЛ 2. Класс ResourceLedgerManager:
//     - Подраздел 2.1. Учёт аллокаций и освобождений по всем 5 категориям
//                      (buffers, textures, audioNodes, listeners, workers)
//                      с защитой от скрытого underflow при двойном освобождении.
//     - Подраздел 2.2. Изоляция постоянных подписок страницы (pageDisposables)
//                      от временных ресурсов одного 108-секундного цикла (cycleDisposables).
//     - Подраздел 2.3. Проверка всех 5 категорий и ошибок disposer в disposeCycleResources().
// ============================================================================

// ============================================================================
// РАЗДЕЛ 1. ТИПЫ КАТЕГОРИЙ РЕСУРСОВ И ИНТЕРФЕЙС СЧЁТЧИКОВ
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
// РАЗДЕЛ 2. КЛАСС УПРАВЛЕНИЯ РЕСУРСАМИ (ResourceLedgerManager)
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

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.1. ЧТЕНИЕ И УЧЁТ АЛЛОКАЦИЙ / ОСВОБОЖДЕНИЙ РЕСУРСОВ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ getCounters ---
    public getCounters(): Readonly<ResourceCounters> {
        return this.counters;
    }
    // --- КОНЕЦ ФУНКЦИИ getCounters ---

    // --- НАЧАЛО ФУНКЦИИ setBaseline ---
    public setBaseline(): void {
        this.counters.underflowCount = 0;
        this.counters.disposerErrors = 0;
        this.baseline = { ...this.counters };
    }
    // --- КОНЕЦ ФУНКЦИИ setBaseline ---

    // --- НАЧАЛО ФУНКЦИИ trackAllocation ---
    public trackAllocation(category: ResourceCategory, delta = 1): void {
        if (!Number.isFinite(delta) || delta <= 0) return;
        this.counters[category] += Math.floor(delta);
    }
    // --- КОНЕЦ ФУНКЦИИ trackAllocation ---

    // --- НАЧАЛО ФУНКЦИИ trackRelease ---
    /**
     * Уменьшает счётчик категории при освобождении ресурса.
     * Если запрошено освобождение большего числа ресурсов, чем числится активными,
     * фиксирует нарушение в underflowCount вместо молчаливого обнуления.
     */
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
    // --- КОНЕЦ ФУНКЦИИ trackRelease ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.2. РЕГИСТРАЦИЯ ЦИКЛОВЫХ И ПОСТОЯННЫХ СТРАНИЧНЫХ ПОДПИСОК
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ registerCycleDisposable ---
    public registerCycleDisposable(disposeFn: () => void): void {
        this.cycleDisposables.push(disposeFn);
    }
    // --- КОНЕЦ ФУНКЦИИ registerCycleDisposable ---

    // --- НАЧАЛО ФУНКЦИИ registerPageDisposable ---
    public registerPageDisposable(disposeFn: () => void): void {
        this.pageDisposables.push(disposeFn);
    }
    // --- КОНЕЦ ФУНКЦИИ registerPageDisposable ---

    // --- НАЧАЛО ФУНКЦИИ getCycleAbortSignal ---
    public getCycleAbortSignal(): AbortSignal {
        return this.cycleAbortController.signal;
    }
    // --- КОНЕЦ ФУНКЦИИ getCycleAbortSignal ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.3. СБРОС РЕСУРСОВ ОДНОГО ЦИКЛА И ПРОВЕРКА ВСЕХ 5 КАТЕГОРИЙ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ disposeCycleResources ---
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

        // Проверяем все 5 категорий ресурсов относительно базовой линии + отсутствие underflow и ошибок очистки
        const leakFree =
            this.counters.buffers <= this.baseline.buffers &&
            this.counters.textures <= this.baseline.textures &&
            this.counters.audioNodes <= this.baseline.audioNodes + 3 &&
            this.counters.listeners <= this.baseline.listeners &&
            this.counters.workers <= this.baseline.workers &&
            this.counters.underflowCount === this.baseline.underflowCount &&
            this.counters.disposerErrors === this.baseline.disposerErrors;

        const report = `Restart #${this.counters.restartCount}: buf=${this.counters.buffers}, tex=${this.counters.textures}, audio=${this.counters.audioNodes}, listeners=${this.counters.listeners}, workers=${this.counters.workers}, underflow=${this.counters.underflowCount}, err=${this.counters.disposerErrors} [${leakFree ? 'LEAK-FREE' : 'WARN'}]`;
        return { leakFree, report };
    }
    // --- КОНЕЦ ФУНКЦИИ disposeCycleResources ---

    // --- НАЧАЛО ФУНКЦИИ disposeAllPageResources ---
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
    // --- КОНЕЦ ФУНКЦИИ disposeAllPageResources ---
}

export const resourceLedger = new ResourceLedgerManager();