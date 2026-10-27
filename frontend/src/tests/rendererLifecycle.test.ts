// ============================================================================
// ФАЙЛ: frontend/src/tests/rendererLifecycle.test.ts
// НАЗНАЧЕНИЕ: Проверить часы настоящего RAF-цикла и срок жизни текстуры дизеринга.
// РАЗДЕЛЫ: 1. Изоляция объектов; 2. Управляемый RAF; 3. Restart/пауза/видимость;
//          4. Страничная текстура и восстановление окружения.
// ФУНКЦИИ: restoreDescriptors, restartSnapshot, runRendererLifecycleChecks,
//          setTransform, createPattern, createImageData, putImageData, pumpFrames.
// ============================================================================
import { UniverseRenderer } from '../engine/UniverseRenderer';
import { RenderPipeline } from '../engine/pipeline';
import { universeStore } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { resourceLedger } from '../core/resourceLedger';
import { qualityGovernor } from '../core/qualityGovernor';
import { integrationRegistry } from '../core/integrationRegistry';
import { publishVisualSignals } from '../core/visualSignals';
import { audioSync, type AudioModulationSnapshot } from '../utils/audioSync';
import { wasmPhysicsBridge } from '../bridge/wasmBridge';
import { nexusGraphEngine } from '../bridge/simulationWorker';

// НАЧАЛО РАЗДЕЛА 1. ИЗОЛЯЦИЯ НАСТОЯЩИХ ОБЪЕКТОВ
// НАЧАЛО ФУНКЦИИ restoreDescriptors
/** Возвращает прежние ссылки, дескрипторы и отсутствие временных свойств. */
function restoreDescriptors(target: object, descriptors: PropertyDescriptorMap): void {
    Reflect.ownKeys(target).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(descriptors, key)) Reflect.deleteProperty(target, key);
    });
    Object.defineProperties(target, descriptors);
}
// КОНЕЦ ФУНКЦИИ restoreDescriptors

// НАЧАЛО ФУНКЦИИ restartSnapshot
function restartSnapshot(): string {
    const state = universeStore.getState();
    return JSON.stringify({
        cycle: state.cycleCount, act: state.singularityAct, elapsed: state.restartElapsedSec,
        progress: state.singularityActProgress, card: state.githubCardAssemblyProgress,
        simulationTime: state.telemetry.simulationTimeSec, phaseTime: state.telemetry.phaseElapsedSec,
        phaseProgress: state.telemetry.phaseProgress, camera: state.camera,
    });
}
// КОНЕЦ ФУНКЦИИ restartSnapshot
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ runRendererLifecycleChecks
export function runRendererLifecycleChecks(check: (passed: boolean, description: string) => void): void {
    const Ledger = resourceLedger.constructor as new () => typeof resourceLedger;
    const lossLedger = new Ledger();
    lossLedger.trackPageLifetimeAllocation('buffers', 2);
    lossLedger.trackPageLifetimeAllocation('textures', 1);
    lossLedger.trackPageLifetimeRelease('buffers', 2);
    lossLedger.trackPageLifetimeRelease('textures', 1);
    const cleanAfterLoss = lossLedger.disposeCycleResources().leakFree;
    lossLedger.trackAllocation('buffers', 1);
    check(cleanAfterLoss && !lossLedger.disposeCycleResources().leakFree && lossLedger.getCounters().underflowCount === 0,
        'Releasing GPU page resources lowers their baseline, so a later unreleased cycle buffer remains detectable');
    const guardLedger = new Ledger();
    [Number.NaN, Infinity, -1, 0, 0.4].forEach((delta) => guardLedger.trackPageLifetimeRelease('textures', delta));
    const ignoredInvalidRelease = guardLedger.getCounters().underflowCount === 0 && guardLedger.getCounters().textures === 0;
    guardLedger.trackPageLifetimeAllocation('textures', 1);
    guardLedger.trackAllocation('textures', 1);
    guardLedger.trackPageLifetimeRelease('textures', 2);
    check(ignoredInvalidRelease && guardLedger.getCounters().textures === 0 && guardLedger.getCounters().underflowCount === 1 &&
        !guardLedger.disposeCycleResources().leakFree,
        'Page release ignores invalid amounts and reports baseline underflow even when a cycle allocation keeps the live count sufficient');
    const singletonTargets = [integrationRegistry, qualityGovernor, resourceLedger, universeStore,
        stressStore, audioSync, wasmPhysicsBridge, nexusGraphEngine];
    const savedSingletons = singletonTargets.map((target) => ({ target, descriptors: Object.getOwnPropertyDescriptors(target) }));
    const globalNames = ['window', 'document', 'navigator', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;
    const savedGlobals = new Map(globalNames.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    const originalAudio = Object.getOwnPropertyDescriptor(audioSync, 'cachedSnapshot')?.value as AudioModulationSnapshot;
    const pending = new Map<number, FrameRequestCallback>();
    let rafId = 0;
    let nowMs = 1000;
    let drawCalls = 0;
    let renderer: UniverseRenderer | undefined;
    let pipeline: RenderPipeline | undefined;

    // НАЧАЛО РАЗДЕЛА 2. УПРАВЛЯЕМЫЙ RAF И МИНИМАЛЬНЫЙ CANVAS
    const pattern = {} as CanvasPattern;
    const context = {
        // НАЧАЛО ФУНКЦИИ setTransform
        setTransform(): void {},
        // КОНЕЦ ФУНКЦИИ setTransform
        // НАЧАЛО ФУНКЦИИ createPattern
        createPattern(): CanvasPattern { return pattern; },
        // КОНЕЦ ФУНКЦИИ createPattern
    };
    const tileContext = {
        // НАЧАЛО ФУНКЦИИ createImageData
        createImageData(width: number, height: number): { data: Uint8ClampedArray } {
            return { data: new Uint8ClampedArray(width * height * 4) };
        },
        // КОНЕЦ ФУНКЦИИ createImageData
        // НАЧАЛО ФУНКЦИИ putImageData
        putImageData(): void {},
        // КОНЕЦ ФУНКЦИИ putImageData
    };
    const canvas = { width: 0, height: 0, style: { width: '', height: '' }, getContext: () => context };
    // НАЧАЛО ФУНКЦИИ pumpFrames
    const pumpFrames = (count: number): void => {
        for (let frame = 0; frame < count; frame++) {
            const next = pending.entries().next();
            if (next.done) throw new Error('The renderer stopped scheduling its shared frame');
            const [id, callback] = next.value;
            pending.delete(id);
            nowMs += 50;
            callback(nowMs);
        }
    };
    // КОНЕЦ ФУНКЦИИ pumpFrames
    // КОНЕЦ РАЗДЕЛА 2

    try {
        // Конструкторы без window не создают Audio/таймеры/слушатели страницы.
        Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
        for (const target of singletonTargets) {
            const Constructor = target.constructor as new () => object;
            restoreDescriptors(target, Object.getOwnPropertyDescriptors(new Constructor()));
        }
        Object.defineProperties(globalThis, {
            window: { configurable: true, value: { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1,
                location: { search: '?wasm=0' } } },
            document: { configurable: true, value: { createElement: () => ({ getContext: () => tileContext }) } },
            navigator: { configurable: true, value: {} },
            performance: { configurable: true, value: { now: () => nowMs } },
            requestAnimationFrame: { configurable: true, value: (callback: FrameRequestCallback): number => {
                pending.set(++rafId, callback);
                return rafId;
            } },
            cancelAnimationFrame: { configurable: true, value: (id: number): void => { pending.delete(id); } },
        });

        renderer = new UniverseRenderer(canvas as unknown as HTMLCanvasElement);
        // Проверяется реальный loop; только дорогая отрисовка пикселей заменена счётчиком.
        const probe = renderer as unknown as { renderFrame: () => void; pipeline: RenderPipeline };
        Object.defineProperty(renderer, 'renderFrame', { configurable: true, value: (): void => { drawCalls++; } });
        pipeline = probe.pipeline;
        universeStore.toggleAutoCycle();

        // НАЧАЛО РАЗДЕЛА 3. RESTART, ПАУЗА И ВИДИМОСТЬ
        universeStore.setPhase('05_SINGULARITY');
        universeStore.triggerUniverseRestart();
        const zeroStepElapsed = universeStore.getState().restartElapsedSec;
        const zeroStepProgress = universeStore.getState().singularityActProgress;
        for (let call = 0; call < 4; call++) {
            const state = universeStore.getState();
            universeStore.updateTelemetry({ frameTimeMs: 16,
                simulationTimeSec: state.telemetry.simulationTimeSec,
                phaseElapsedSec: state.telemetry.phaseElapsedSec });
        }
        check(universeStore.getState().restartElapsedSec === zeroStepElapsed &&
            universeStore.getState().singularityActProgress === zeroStepProgress,
            'Zero-delta restart telemetry preserves elapsed time and collapse progress instead of inventing a frame step');

        renderer.start();
        renderer.start();
        const singleRaf = pending.size === 1;
        for (const mode of ['pause', 'hidden'] as const) {
            universeStore.setPhase('05_SINGULARITY');
            universeStore.triggerUniverseRestart();
            pumpFrames(3);
            if (mode === 'pause') universeStore.togglePause();
            else universeStore.setTabHidden(true);
            const frozen = restartSnapshot();
            const frozenCycle = universeStore.getState().cycleCount;
            const drawsBefore = drawCalls;
            pumpFrames(100);
            const stayedFrozen = restartSnapshot() === frozen && drawCalls === drawsBefore + 100 &&
                pending.size === 1 && universeStore.getState().lastRendererError === null;
            if (mode === 'pause') universeStore.togglePause();
            else universeStore.setTabHidden(false);
            pumpFrames(32);
            const resumed = universeStore.getState();
            check(stayedFrozen && resumed.cycleCount === frozenCycle + 1 && resumed.currentPhase === '01_VOID' &&
                resumed.singularityAct === 'INACTIVE' && resumed.restartElapsedSec === 0 &&
                resumed.lastRendererError === null && pending.size === 1,
                `${mode === 'pause' ? 'Paused' : 'Hidden'} restart preserves clocks, camera and card, then resumes into exactly one new VOID cycle`);
        }
        renderer.stop();
        renderer.stop();
        const stoppedRaf = pending.size === 0;
        check(singleRaf && stoppedRaf, 'Repeated renderer start/stop owns and cancels exactly one shared RAF');
        // КОНЕЦ РАЗДЕЛА 3

        // НАЧАЛО РАЗДЕЛА 4. СТРАНИЧНАЯ ТЕКСТУРА И ОСВОБОЖДЕНИЕ
        let cleanRestarts = pipeline.getDitherPattern() === pattern && resourceLedger.getCounters().textures === 1;
        for (let restart = 0; restart < 4; restart++) {
            const result = resourceLedger.disposeCycleResources();
            cleanRestarts &&= result.leakFree && pipeline.getDitherPattern() === pattern &&
                resourceLedger.getCounters().textures === 1;
        }
        pipeline.dispose();
        pipeline.dispose();
        check(cleanRestarts && pipeline.getDitherPattern() === null && resourceLedger.getCounters().textures === 0 &&
            resourceLedger.getCounters().underflowCount === 0,
            'Persistent dither survives repeated cycles without false leak warnings and releases exactly once on pipeline disposal');
        // КОНЕЦ РАЗДЕЛА 4
    } finally {
        renderer?.stop();
        pipeline?.dispose();
        for (const { target, descriptors } of savedSingletons) restoreDescriptors(target, descriptors);
        for (const [name, descriptor] of savedGlobals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
        publishVisualSignals(universeStore.getState(), originalAudio, stressStore.getState());
    }
}
// КОНЕЦ ФУНКЦИИ runRendererLifecycleChecks
