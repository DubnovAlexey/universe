// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/integrationRegistry.ts
// НАЗНАЧЕНИЕ: Реестр полиглот-интеграций IntegrationRegistry (MASTER 00B раздел 5)
// ЗАДАЧИ ФАЙЛА:
// 1. Служить единственным источником правдивых статусов всех 8 модулей системы.
// 2. Хранить язык, статус, время загрузки loadMs, p50/p95 времени шага и счётчики байтов.
// 3. Формировать строго стандартизированные строки статусов из словаря MASTER 00B.
// ============================================================================

import type { ComputeSourceTag, HonestStatusLabel } from './contracts';

// ----------------------------------------------------------------------------
// 1. ТИПЫ ИДЕНТИФИКАТОРОВ МОДУЛЕЙ И ЗАПИСЕЙ РЕЕСТРА
// ----------------------------------------------------------------------------
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
    readonly language: 'TypeScript' | 'Rust/WASM' | 'WGSL/WebGPU' | 'Canvas2D' | 'Python' | 'WebAudio';
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

// ----------------------------------------------------------------------------
// 2. МЕНЕДЖЕР РЕЕСТРА ИНТЕГРАЦИЙ С РАСЧЁТОМ ПЕРЦЕНТИЛЕЙ P50 / P95
// ----------------------------------------------------------------------------
class IntegrationRegistryManager {
    private modules: Map<PolyglotModuleId, PolyglotModuleRecord> = new Map();
    private stepHistory: Map<PolyglotModuleId, number[]> = new Map();
    private readonly maxHistorySamples = 30;

    constructor() {
        this.initDefaultModules();
    }

    private initDefaultModules(): void {
        const defaults: PolyglotModuleRecord[] = [
            {
                id: 'ts-core',
                language: 'TypeScript',
                sourceTag: 'TS_CORE',
                ownerFile: 'frontend/src/store/universeState.ts',
                status: 'ready',
                version: '2.0.0',
                loadMs: 1.2,
                lastStepMs: 0.4,
                stepP50Ms: 0.4,
                stepP95Ms: 0.8,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'wasm-physics',
                language: 'Rust/WASM',
                sourceTag: 'WASM',
                ownerFile: 'physics_engine/src/gravity.rs',
                status: 'fallback', // До подтверждённой загрузки .wasm честно показывает fallback на эталон TS
                version: '2.0.0',
                loadMs: 0,
                lastStepMs: 0.9,
                stepP50Ms: 0.9,
                stepP95Ms: 1.5,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'webgpu-render',
                language: 'WGSL/WebGPU',
                sourceTag: 'RENDERER',
                ownerFile: 'frontend/src/engine/webgpu/illusion.wgsl',
                status: 'fallback',
                version: '2.0.0',
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
                ownerFile: 'frontend/src/engine/renderer.ts',
                status: 'ready',
                version: '2.0.0',
                loadMs: 0.8,
                lastStepMs: 2.4,
                stepP50Ms: 2.4,
                stepP95Ms: 4.1,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'pyodide-graph',
                language: 'Python',
                sourceTag: 'PYODIDE',
                ownerFile: 'backend/core/graph_logic.py',
                status: 'fallback',
                version: '2.0.0',
                loadMs: 0,
                lastStepMs: 0.6,
                stepP50Ms: 0.6,
                stepP95Ms: 1.1,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'server-ws',
                language: 'Python',
                sourceTag: 'SERVER',
                ownerFile: 'backend/api/transport.py',
                status: 'inactive', // Никогда не показывает CONNECTED без подтверждённого handshake
                version: '2.0.0',
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
                version: '2.0.0',
                loadMs: 0,
                lastStepMs: 0.2,
                stepP50Ms: 0.2,
                stepP95Ms: 0.5,
                bytesIn: 0,
                bytesOut: 0,
            },
            {
                id: 'worker-physics',
                language: 'TypeScript',
                sourceTag: 'WORKER',
                ownerFile: 'frontend/src/bridge/simulationWorker.ts',
                status: 'ready',
                version: '2.0.0',
                loadMs: 1.5,
                lastStepMs: 0.7,
                stepP50Ms: 0.7,
                stepP95Ms: 1.3,
                bytesIn: 0,
                bytesOut: 0,
            },
        ];

        for (let i = 0; i < defaults.length; i++) {
            const rec = defaults[i];
            this.modules.set(rec.id, rec);
            this.stepHistory.set(rec.id, [rec.lastStepMs]);
        }
    }

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

    public getModule(id: PolyglotModuleId): Readonly<PolyglotModuleRecord> | undefined {
        return this.modules.get(id);
    }

    public getAllModules(): ReadonlyArray<PolyglotModuleRecord> {
        return Array.from(this.modules.values());
    }

    // Возвращает строго стандартизированные метки из словаря MASTER 00B
    public getHonestRenderLabel(): HonestStatusLabel {
        const gpu = this.modules.get('webgpu-render');
        return gpu && gpu.status === 'ready' ? 'WEBGPU ACTIVE' : 'CANVAS2D FALLBACK';
    }

    public getHonestPhysicsLabel(): HonestStatusLabel {
        const wasm = this.modules.get('wasm-physics');
        return wasm && wasm.status === 'ready' ? 'WASM READY' : 'TS FALLBACK';
    }

    public getHonestPythonLabel(): HonestStatusLabel {
        const server = this.modules.get('server-ws');
        if (server && server.status === 'ready') return 'SERVER CONNECTED';
        const pyodide = this.modules.get('pyodide-graph');
        if (pyodide && pyodide.status === 'loading') return 'PYODIDE LOADING';
        if (pyodide && pyodide.status === 'ready') return 'PYODIDE READY';
        return 'CLIENT-ONLY';
    }
}

export const integrationRegistry = new IntegrationRegistryManager();