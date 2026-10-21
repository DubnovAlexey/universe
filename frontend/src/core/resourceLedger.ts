// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/resourceLedger.ts
// НАЗНАЧЕНИЕ: Книга учёта ресурсов ResourceLedger и контроль жизненного цикла
//             при перезапусках Вселенной (UNIVERSE v2.5)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ:
//   РАЗДЕЛ 1. Типы категорий ресурсов и интерфейс счётчиков (ResourceCounters).
//   РАЗДЕЛ 2. Класс ResourceLedgerManager:
//     - Подраздел 2.1. Учёт аллокаций и освобождений (buffers, textures, audioNodes,
//                      listeners, workers).
//     - Подраздел 2.2. Изоляция постоянных подписок страницы (pageDisposables)
//                      от временных ресурсов одного 108-секундного цикла (cycleDisposables).
//     - Подраздел 2.3. Безопасный сброс цикла disposeCycleResources() без поломки UI.
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
        this.baseline = { ...this.counters };
    }
    // --- КОНЕЦ ФУНКЦИИ setBaseline ---

    // --- НАЧАЛО ФУНКЦИИ trackAllocation ---
    public trackAllocation(category: ResourceCategory, delta = 1): void {
        this.counters[category] = Math.max(0, this.counters[category] + delta);
    }
    // --- КОНЕЦ ФУНКЦИИ trackAllocation ---

    // --- НАЧАЛО ФУНКЦИИ trackRelease ---
    public trackRelease(category: ResourceCategory, delta = 1): void {
        this.counters[category] = Math.max(0, this.counters[category] - delta);
    }
    // --- КОНЕЦ ФУНКЦИИ trackRelease ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.2. РЕГИСТРАЦИЯ ЦИКЛОВЫХ И ПОСТОЯННЫХ СТРАНИЧНЫХ ПОДПИСОК
    // ------------------------------------------------------------------------

    /**
     * Регистрирует ресурс, который должен очищаться при каждом перезапуске
     * 108-секундного цикла (например, временные таймеры фазы).
     * Постоянные подписки DOM-панелей сюда НЕ передаются.
     */
    // --- НАЧАЛО ФУНКЦИИ registerCycleDisposable ---
    public registerCycleDisposable(disposeFn: () => void): void {
        this.cycleDisposables.push(disposeFn);
    }
    // --- КОНЕЦ ФУНКЦИИ registerCycleDisposable ---

    /**
     * Регистрирует постоянную подписку уровня страницы (HUD, слои телеметрии),
     * которая должна жить на протяжении всех циклов вплоть до выгрузки вкладки.
     */
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
    // ПОДРАЗДЕЛ 2.3. СБРОС РЕСУРСОВ ОДНОГО ЦИКЛА И ПРОВЕРКА ОТСУТСТВИЯ УТЕЧЕК
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ disposeCycleResources ---
    public disposeCycleResources(): { leakFree: boolean; report: string } {
        this.cycleAbortController.abort();
        this.cycleAbortController = new AbortController();

        for (let i = 0; i < this.cycleDisposables.length; i++) {
            try {
                this.cycleDisposables[i]();
            } catch {
                // Игнорируем локальные ошибки отдельных очистителей цикла
            }
        }
        this.cycleDisposables = [];
        this.counters.restartCount += 1;

        const leakFree =
            this.counters.buffers <= this.baseline.buffers + 1 &&
            this.counters.textures <= this.baseline.textures + 1 &&
            this.counters.workers <= this.baseline.workers;

        const report = `Restart #${this.counters.restartCount}: buf=${this.counters.buffers}, tex=${this.counters.textures}, audio=${this.counters.audioNodes}, listeners=${this.counters.listeners} [${leakFree ? 'LEAK-FREE' : 'WARN'}]`;
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
                // Игнорируем ошибки при закрытии страницы
            }
        }
        this.pageDisposables = [];
    }
    // --- КОНЕЦ ФУНКЦИИ disposeAllPageResources ---
}

export const resourceLedger = new ResourceLedgerManager();