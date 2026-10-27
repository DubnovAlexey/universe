// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/integrationRegistry.ts
// НАЗНАЧЕНИЕ: Реестр полиглот-интеграций IntegrationRegistry (MASTER 00B v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. IntegrationRegistryManager: constructor, initDefaultModules, updateModuleStatus, recordModuleStep,
//      getModule, getAllModules.
// ============================================================================


import type { ComputeSourceTag } from './contracts';

export type PolyglotModuleId =
    | 'ts-core'
    | 'wasm-physics'
    | 'webgpu-render'
    | 'canvas2d-render'
    | 'pyodide-graph'
    | 'server-ws'
    | 'web-audio'
    | 'worker-physics';

export type ModuleRuntimeState =
    | 'inactive'
    | 'loading'
    | 'ready'
    | 'fallback'
    | 'error'
    | 'unsupported';

export interface PolyglotModuleRecord {
    readonly id: PolyglotModuleId;
    readonly language:
        | 'TypeScript'
        | 'Rust/WASM'
        | 'WGSL/WebGPU'
        | 'Canvas2D'
        | 'Python'
        | 'WebAudio';
    readonly sourceTag: ComputeSourceTag;
    readonly ownerFile: string;
    status: ModuleRuntimeState;
    version: string;
    loadMs: number;
    lastStepMs: number;
    stepP50Ms: number;
    stepP95Ms: number;
    bytesIn: number;
    bytesOut: number;
    lastError?: string;
}

// ============================================================================
// РАЗДЕЛ. КЛАСС IntegrationRegistryManager
// ============================================================================

class IntegrationRegistryManager {
    private modules: Map<PolyglotModuleId, PolyglotModuleRecord> = new Map();
    private stepHistory: Map<PolyglotModuleId, number[]> = new Map();
    private readonly maxHistorySamples = 30;

    // --- НАЧАЛО ФУНКЦИИ constructor (IntegrationRegistryManager) ---
    constructor() {
        this.initDefaultModules();
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (IntegrationRegistryManager) ---

    // --- НАЧАЛО ФУНКЦИИ initDefaultModules (IntegrationRegistryManager) ---
    private initDefaultModules(): void {
        const defaults: PolyglotModuleRecord[] = [
            {
                id: 'ts-core',
                language: 'TypeScript',
                sourceTag: 'TS_CORE',
                ownerFile: 'frontend/src/store/universeState.ts',
                status: 'ready',
                version: '2.5.0',
                loadMs: 0,
                lastStepMs: 0,
                stepP50Ms: 0,
                stepP95Ms: 0,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'wasm-physics',
                language: 'Rust/WASM',
                sourceTag: 'WASM',
                ownerFile: 'physics_engine/src/gravity.rs',
                status: 'fallback',
                version: '2.5.0',
                loadMs: 0,
                lastStepMs: 0,
                stepP50Ms: 0,
                stepP95Ms: 0,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'webgpu-render',
                language: 'WGSL/WebGPU',
                sourceTag: 'RENDERER',
                ownerFile: 'frontend/src/engine/webgpu/illusion.wgsl',
                status: 'fallback',
                version: '2.5.0',
                loadMs: 0,
                lastStepMs: 0,
                stepP50Ms: 0,
                stepP95Ms: 0,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'canvas2d-render',
                language: 'Canvas2D',
                sourceTag: 'RENDERER',
                ownerFile: 'frontend/src/engine/UniverseRenderer.ts',
                status: 'ready',
                version: '2.5.0',
                loadMs: 0,
                lastStepMs: 0,
                stepP50Ms: 0,
                stepP95Ms: 0,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'pyodide-graph',
                language: 'Python',
                sourceTag: 'PYODIDE',
                ownerFile: 'backend/core/graph_logic.py',
                status: 'fallback',
                version: '2.5.0',
                loadMs: 0,
                lastStepMs: 0,
                stepP50Ms: 0,
                stepP95Ms: 0,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'server-ws',
                language: 'Python',
                sourceTag: 'SERVER',
                ownerFile: 'backend/api/transport.py',
                status: 'inactive',
                version: '2.5.0',
                loadMs: 0,
                lastStepMs: 0,
                stepP50Ms: 0,
                stepP95Ms: 0,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'web-audio',
                language: 'WebAudio',
                sourceTag: 'AUDIO',
                ownerFile: 'frontend/src/utils/audioSync.ts',
                status: 'loading',
                version: '2.5.0',
                loadMs: 0,
                lastStepMs: 0,
                stepP50Ms: 0,
                stepP95Ms: 0,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'worker-physics',
                language: 'TypeScript',
                sourceTag: 'WORKER',
                ownerFile: 'frontend/src/bridge/simulationWorker.ts',
                status: 'fallback',
                version: '2.5.0',
                loadMs: 0,
                lastStepMs: 0,
                stepP50Ms: 0,
                stepP95Ms: 0,
                bytesIn: 0,
                bytesOut: 0,
            },
        ];

        for (let i = 0; i < defaults.length; i++) {
            const rec = defaults[i];
            this.modules.set(rec.id, rec);
            this.stepHistory.set(rec.id, []);
        }
    }
    // --- КОНЕЦ ФУНКЦИИ initDefaultModules (IntegrationRegistryManager) ---

    // --- НАЧАЛО ФУНКЦИИ updateModuleStatus (IntegrationRegistryManager) ---
    public updateModuleStatus(
        id: PolyglotModuleId,
        status: ModuleRuntimeState,
        loadMs?: number,
        lastError?: string
    ): void {
        const rec = this.modules.get(id);
        if (!rec) return;
        rec.status = status;
        if (loadMs !== undefined) rec.loadMs = Number(loadMs.toFixed(2));
        if (lastError !== undefined) rec.lastError = lastError;
    }
    // --- КОНЕЦ ФУНКЦИИ updateModuleStatus (IntegrationRegistryManager) ---

    // --- НАЧАЛО ФУНКЦИИ recordModuleStep (IntegrationRegistryManager) ---
    public recordModuleStep(
        id: PolyglotModuleId,
        stepDurationMs: number,
        bytesInDelta = 0,
        bytesOutDelta = 0
    ): void {
        const rec = this.modules.get(id);
        if (!rec) return;

        rec.lastStepMs = Number(stepDurationMs.toFixed(2));
        rec.bytesIn += bytesInDelta;
        rec.bytesOut += bytesOutDelta;

        const hist = this.stepHistory.get(id) ?? [];
        hist.push(stepDurationMs);
        if (hist.length > this.maxHistorySamples) {
            hist.shift();
        }
        this.stepHistory.set(id, hist);

        const sorted = [...hist].sort((a, b) => a - b);
        const p50Idx = Math.floor(sorted.length * 0.5);
        const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
        rec.stepP50Ms = Number(sorted[p50Idx].toFixed(2));
        rec.stepP95Ms = Number(sorted[p95Idx].toFixed(2));
    }
    // --- КОНЕЦ ФУНКЦИИ recordModuleStep (IntegrationRegistryManager) ---

    // --- НАЧАЛО ФУНКЦИИ getModule (IntegrationRegistryManager) ---
    public getModule(id: PolyglotModuleId): Readonly<PolyglotModuleRecord> | undefined {
        return this.modules.get(id);
    }
    // --- КОНЕЦ ФУНКЦИИ getModule (IntegrationRegistryManager) ---

    // --- НАЧАЛО ФУНКЦИИ getAllModules (IntegrationRegistryManager) ---
    public getAllModules(): ReadonlyArray<PolyglotModuleRecord> {
        return Array.from(this.modules.values());
    }
    // --- КОНЕЦ ФУНКЦИИ getAllModules (IntegrationRegistryManager) ---

}

export const integrationRegistry = new IntegrationRegistryManager();
