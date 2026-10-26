// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/tests/parityAndSeams.test.ts
// НАЗНАЧЕНИЕ: Автоматический набор регрессионных проверок паритета, бинарного
//             протокола, шага времени Velocity Verlet, графа NEXUS (TS == Python),
//             геометрии линзы, таймлайна 5-й фазы, скорости одометра, ресурсов,
//             канонических типов, журнала событий, DPR и ввода линзы на разных экранах.
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. Функции модуля: assertCondition, runPipelineQualityChecks, runFinaleStoreChecks,
//      runStressInputChecks, runUniverseVerificationSuite.
//      runPipelineQualityChecks: getProfile, setTransform, set, getContext.
//      runFinaleStoreChecks: advanceTo.
//      runStressInputChecks: addEventListener, dispatchKeyboard, closest.
//   3. runUniverseVerificationSuite: check.
// ============================================================================


import {
    DeterministicPRNG,
    GOLDEN_SEED,
    GOLDEN_U32_VECTORS,
    verifyGoldenPrngParity,
} from '../core/prng';
import {
    SCENE_BUFFER_MAGIC,
    SCENE_SCHEMA_VERSION,
    SceneBufferSoA,
} from '../core/sceneBuffer';
import { EntityKindCode, type SingularityAct as CanonicalSingularityAct } from '../core/contracts';
import { resourceLedger } from '../core/resourceLedger';
import { qualityGovernor } from '../core/qualityGovernor';
import { RenderPipeline } from '../engine/pipeline';
import { WasmPhysicsBridge, wasmPhysicsBridge } from '../bridge/wasmBridge';
import {
    NexusGraphEngine,
    nexusGraphEngine,
    roundGraphDecimal,
    type GraphNodeInput,
} from '../bridge/simulationWorker';
import { pythonSocketClient } from '../bridge/pythonSocketClient';
import {
    CANONICAL_FINALE_LINES,
    cipherOdometerEngine,
    type OdometerGlyphCellState,
} from '../bridge/cipherOdometerEngine';
import { universeStore, type SingularityAct as StoreSingularityAct } from '../store/universeState';
import { stressStore, type StressStateData } from '../store/stressState';
import { VoidPhaseSimulation, type TopologyEdge } from '../phases/01_void';
import { smoothAudioEnvelope } from '../utils/audioSync';
import { runVisualSignalChecks } from './visualSignals.test';
import { runFinaleCompositionChecks } from './finaleComposition.test';
import { runButtonMotionChecks } from './buttonMotion.test';
import { runButtonSolidChecks } from './buttonSolid.test';
import { runWaterfallLifecycleChecks } from './waterfallLifecycle.test';
import nexusParity24 from './fixtures/nexusParity24.json';

export interface VerificationSuiteResult {
    passed: boolean;
    totalChecks: number;
    passedChecks: number;
    details: string[];
}

// --- НАЧАЛО ФУНКЦИИ assertCondition ---
function assertCondition(
    condition: boolean,
    description: string,
    details: string[]
): boolean {
    details.push(`${condition ? '[PASS]' : '[FAIL]'} ${description}`);
    return condition;
}
// --- КОНЕЦ ФУНКЦИИ assertCondition ---

// --- НАЧАЛО ФУНКЦИИ runPipelineQualityChecks ---
function runPipelineQualityChecks(check: (passed: boolean, description: string) => void): void {
    const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const savedGetProfile = Object.getOwnPropertyDescriptor(qualityGovernor, 'getProfile');
    const originalProfile = qualityGovernor.getProfile();
    let maxDpr = 2;
    let resizeWrites = 0;
    let lastTransform: readonly number[] = [];
    let pipeline: RenderPipeline | undefined;
    const context = {
        // --- НАЧАЛО ФУНКЦИИ setTransform (runPipelineQualityChecks) ---
        setTransform(...matrix: number[]): void { lastTransform = matrix; resizeWrites++; },
        // --- КОНЕЦ ФУНКЦИИ setTransform (runPipelineQualityChecks) ---
    };
    const style = new Proxy({ width: '', height: '' }, {
        // --- НАЧАЛО ФУНКЦИИ set (runPipelineQualityChecks: style) ---
        set(target, key, value): boolean { resizeWrites++; return Reflect.set(target, key, value); },
        // --- КОНЕЦ ФУНКЦИИ set (runPipelineQualityChecks: style) ---
    });
    const canvas = new Proxy({
        width: 0, height: 0, style,
        // --- НАЧАЛО ФУНКЦИИ getContext (runPipelineQualityChecks) ---
        getContext(): typeof context { return context; },
        // --- КОНЕЦ ФУНКЦИИ getContext (runPipelineQualityChecks) ---
    }, {
        // --- НАЧАЛО ФУНКЦИИ set (runPipelineQualityChecks: canvas) ---
        set(target, key, value): boolean { resizeWrites++; return Reflect.set(target, key, value); },
        // --- КОНЕЦ ФУНКЦИИ set (runPipelineQualityChecks: canvas) ---
    });
    try {
        Object.defineProperty(globalThis, 'window', {
            configurable: true, value: { innerWidth: 960, innerHeight: 540, devicePixelRatio: 2 },
        });
        // --- НАЧАЛО ФУНКЦИИ getProfile (runPipelineQualityChecks) ---
        qualityGovernor.getProfile = () => ({ ...originalProfile, tier: maxDpr === 2 ? 'HIGH' : 'LOW', maxDpr });
        // --- КОНЕЦ ФУНКЦИИ getProfile (runPipelineQualityChecks) ---
        pipeline = new RenderPipeline(canvas as unknown as HTMLCanvasElement);
        const highInitialized = pipeline.getCapabilities().dpr === 2 && canvas.width === 1920 && canvas.height === 1080;
        maxDpr = 1.25;
        const noImplicitResize = pipeline.getCapabilities().dpr === 2 && canvas.width === 1920;
        pipeline.syncQualityProfile();
        check(
            highInitialized && noImplicitResize && pipeline.getCapabilities().dpr === 1.25 &&
            canvas.width === 1200 && canvas.height === 675 && style.width === '960px' && style.height === '540px' &&
            lastTransform.join(',') === '1.25,0,0,1.25,0,0',
            'Quality downgrade applies the LOW 1.25 DPR cap to the backing canvas without a window resize or CSS size change'
        );
        const lowWrites = resizeWrites;
        for (let frame = 0; frame < 60; frame++) pipeline.syncQualityProfile();
        check(
            resizeWrites === lowWrites && pipeline.getCapabilities().dpr === 1.25,
            'Unchanged quality frames perform zero canvas size, CSS size or transform writes'
        );
        maxDpr = 2;
        pipeline.syncQualityProfile();
        check(
            pipeline.getCapabilities().dpr === 2 && canvas.width === 1920 && canvas.height === 1080 &&
            style.width === '960px' && style.height === '540px' && lastTransform.join(',') === '2,0,0,2,0,0',
            'Quality recovery restores the HIGH DPR backing resolution and transform while preserving CSS geometry'
        );
        pipeline.dispose();
        const disposedWrites = resizeWrites;
        maxDpr = 1.25;
        pipeline.syncQualityProfile();
        check(
            resizeWrites === disposedWrites && pipeline.getCapabilities().dpr === 2,
            'A disposed pipeline ignores subsequent quality changes without resizing its canvas'
        );
    } finally {
        pipeline?.dispose();
        if (savedGetProfile) Object.defineProperty(qualityGovernor, 'getProfile', savedGetProfile);
        else Reflect.deleteProperty(qualityGovernor, 'getProfile');
        if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    }
}
// --- КОНЕЦ ФУНКЦИИ runPipelineQualityChecks ---

// --- НАЧАЛО ФУНКЦИИ runFinaleStoreChecks ---
function runFinaleStoreChecks(check: (passed: boolean, description: string) => void): void {
    const UniverseStore = universeStore.constructor as new () => typeof universeStore;
    const store = new UniverseStore();
    store.setPhase('05_SINGULARITY');
    // --- НАЧАЛО ФУНКЦИИ advanceTo (runFinaleStoreChecks) ---
    const advanceTo = (phaseElapsedSec: number): void => store.updateTelemetry({
        frameTimeMs: 16,
        simulationTimeSec: store.getState().phaseMeta.startSec + phaseElapsedSec,
        phaseElapsedSec,
    });
    // --- КОНЕЦ ФУНКЦИИ advanceTo (runFinaleStoreChecks) ---
    const timeline: ReadonlyArray<readonly [number, CanonicalSingularityAct]> = [
        [0, 'ACT_A_ACCRETION'], [8.499, 'ACT_A_ACCRETION'], [8.5, 'ACT_B_LOGIC'],
        [13.599, 'ACT_B_LOGIC'], [13.6, 'ACT_C_ZERO_SILENCE'], [13.825, 'ACT_C_ZERO_SILENCE'],
        [14.049, 'ACT_C_ZERO_SILENCE'], [14.05, 'ACT_D_GITHUB_CARD'],
    ];
    let timelinePreserved = true;
    let silenceMidpointMs = -1;
    for (const [elapsedSec, act] of timeline) {
        advanceTo(elapsedSec);
        timelinePreserved &&= store.getState().singularityAct === act;
        if (elapsedSec === 13.825) silenceMidpointMs = store.getState().zeroSilenceElapsedMs;
    }
    check(
        timelinePreserved && silenceMidpointMs === 225 && store.getState().zeroSilenceElapsedMs === 450,
        'Original A/B/C/D boundaries remain fixed; zero-silence telemetry reports 225ms halfway and 450ms after ACT_C'
    );
    const firstDStartsAtZero = store.getState().githubCardAssemblyProgress === 0 && store.getState().finaleReachedOnce;
    advanceTo(16.3);
    const firstDReachesHalf = Math.abs(store.getState().githubCardAssemblyProgress - 0.5) < 1e-12;
    advanceTo(18.55);
    check(
        firstDStartsAtZero && firstDReachesHalf && store.getState().githubCardAssemblyProgress === 1 &&
        store.getState().singularityActProgress === 1 && store.getState().cycleCount === 1,
        'First ACT_D assembles continuously from zero through half to one despite its early finaleReachedOnce flag'
    );
    store.setPhase('01_VOID');
    advanceTo(0.1);
    const ambientCardRetained = store.getState().githubCardAssemblyProgress === 1;
    store.setPhase('05_SINGULARITY');
    advanceTo(14.05);
    const repeatedDStartsAssembled = store.getState().githubCardAssemblyProgress === 1;
    advanceTo(14.1);
    check(
        ambientCardRetained && repeatedDStartsAssembled && store.getState().githubCardAssemblyProgress === 1 &&
        store.getState().singularityAct === 'ACT_D_GITHUB_CARD' && store.getState().cycleCount === 1,
        'Manual phase 01→05 return during cycle one retains the assembled ambient card and avoids replaying ACT_D assembly'
    );
}
// --- КОНЕЦ ФУНКЦИИ runFinaleStoreChecks ---

// --- НАЧАЛО ФУНКЦИИ runStressInputChecks ---
function runStressInputChecks(check: (passed: boolean, description: string) => void): void {
    const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const handlers = new Map<string, Array<(event: KeyboardEvent) => void>>();
    const testWindow = {
        innerWidth: 390,
        innerHeight: 844,
        // --- НАЧАЛО ФУНКЦИИ addEventListener (runStressInputChecks) ---
        addEventListener(type: string, handler: (event: KeyboardEvent) => void): void {
            handlers.set(type, [...(handlers.get(type) ?? []), handler]);
        },
        // --- КОНЕЦ ФУНКЦИИ addEventListener (runStressInputChecks) ---
    };
    const sceneState = universeStore.getState();
    const savedPhase = sceneState.currentPhase;
    const savedSimTime = sceneState.telemetry.simulationTimeSec;

    // --- НАЧАЛО ФУНКЦИИ dispatchKeyboard (runStressInputChecks) ---
    const dispatchKeyboard = (
        type: 'keydown' | 'keyup',
        key: string,
        target: unknown = null,
        options: Partial<Pick<KeyboardEvent, 'repeat' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing' | 'defaultPrevented'>> = {}
    ): KeyboardEvent => {
        const event = new Event(type, { cancelable: true }) as KeyboardEvent;
        const { defaultPrevented, ...properties } = options;
        Object.defineProperties(event, Object.fromEntries(Object.entries({
            key, target, repeat: false, altKey: false, ctrlKey: false, metaKey: false,
            shiftKey: false, isComposing: false, ...properties,
        }).map(([name, value]) => [name, { value }])));
        if (defaultPrevented) event.preventDefault();
        handlers.get(type)?.forEach((handler) => handler(event));
        return event;
    };
    // --- КОНЕЦ ФУНКЦИИ dispatchKeyboard (runStressInputChecks) ---

    try {
        Object.defineProperty(globalThis, 'window', { configurable: true, value: testWindow });
        const StressController = stressStore.constructor as new () => typeof stressStore;
        const controller = new StressController();
        const initial = controller.getState();
        check(
            initial.lensX === 195 && initial.lensY === 422 &&
            initial.pointerX === 195 && initial.pointerY === 422 &&
            initial.baseBreachRadius === 47 && initial.maxBreachRadius === 86 &&
            !initial.hasUserInteracted && !initial.isPointerInside &&
            [...handlers.keys()].join(',') === 'keydown,keyup',
            'Stress controller initializes mobile lens geometry before input and adds no resize listener'
        );

        Object.assign(sceneState, { currentPhase: '04_COLLAPSE' });
        sceneState.telemetry.simulationTimeSec = 66;
        controller.stepPhysics(0.016);
        const mobileDirectorVisible = controller.getState().currentBreachRadius > 0 &&
            Math.abs(controller.getState().lensX - 195) <= 120 &&
            Math.abs(controller.getState().lensY - 422) <= 70;
        controller.syncViewportSize(600, 360);
        controller.stepPhysics(0.016);
        const resizedDirectorVisible = Math.abs(controller.getState().lensX - 300) <= 120 &&
            Math.abs(controller.getState().lensY - 180) <= 70 &&
            controller.getState().baseBreachRadius === 43 && controller.getState().maxBreachRadius === 79;
        controller.syncViewportSize(Number.NaN, Number.POSITIVE_INFINITY);
        controller.syncViewportSize(-1, 0);
        check(
            mobileDirectorVisible && resizedDirectorVisible &&
            controller.getState().lensX === 300 && controller.getState().lensY === 180 &&
            !controller.getState().isPointerInside && !controller.getState().hasUserInteracted,
            'No-pointer director breach stays on the mobile viewport after resize; invalid dimensions preserve finite geometry'
        );

        controller.syncViewportSize(390, 844);
        const uiTargets = ['button', 'a', 'input', 'textarea', 'select', 'summary',
            '[role="button"]', '[role="slider"]', '[data-ui-panel]', '[data-github-card]'].map((match) => ({
            // --- НАЧАЛО ФУНКЦИИ closest (runStressInputChecks) ---
            closest(selectors: string): object | null {
                return selectors.split(',').some((selector) => selector.trim() === match) ? this : null;
            },
            // --- КОНЕЦ ФУНКЦИИ closest (runStressInputChecks) ---
        }));
        const blockedTargets = [...uiTargets, { isContentEditable: true }];
        const blockedOptions = [{ defaultPrevented: true }, { altKey: true }, { ctrlKey: true },
            { metaKey: true }, { shiftKey: true }, { isComposing: true }];
        let ignoredKeysPreserved = true;
        for (const key of [' ', 'ArrowLeft', 'Escape']) {
            for (const target of blockedTargets) {
                ignoredKeysPreserved &&= !dispatchKeyboard('keydown', key, target).defaultPrevented;
            }
            for (const options of blockedOptions) {
                ignoredKeysPreserved &&= dispatchKeyboard('keydown', key, null, options).defaultPrevented ===
                    ('defaultPrevented' in options);
            }
        }
        check(
            ignoredKeysPreserved && !dispatchKeyboard('keydown', 'Tab').defaultPrevented &&
            !controller.getState().isPointerInside && !controller.getState().isBreaching &&
            !controller.getState().hasUserInteracted && controller.getState().lensX === 195,
            'UI, editable, prevented, composing and modified keyboard events keep native behavior without interacting with the lens'
        );

        const arrowHandled = dispatchKeyboard('keydown', 'ArrowRight').defaultPrevented &&
            controller.getState().pointerX === 223 && controller.getState().pointerY === 422;
        const spaceHandled = dispatchKeyboard('keydown', ' ').defaultPrevented && controller.getState().isBreaching;
        const shockwaveCount = controller.getState().shockwaves.length;
        const repeatHandled = dispatchKeyboard('keydown', ' ', null, { repeat: true }).defaultPrevented &&
            controller.getState().shockwaves.length === shockwaveCount;
        dispatchKeyboard('keyup', ' ', uiTargets[0], { ctrlKey: true, defaultPrevented: true });
        check(
            arrowHandled && spaceHandled && repeatHandled && !controller.getState().isBreaching,
            'Scene arrows and Space prevent scrolling; repeated Space opens once and releases after focus moves to a control'
        );

        controller.setBreaching(true, false);
        dispatchKeyboard('keyup', ' ', uiTargets[0]);
        const pointerBreachPreserved = controller.getState().isBreaching;
        const uiEscapePreserved = !dispatchKeyboard('keydown', 'Escape', uiTargets[0]).defaultPrevented &&
            controller.getState().isBreaching;
        const sceneEscapeHandled = dispatchKeyboard('keydown', 'Escape').defaultPrevented &&
            !controller.getState().isBreaching && !controller.getState().isPointerInside;
        controller.updatePointer(580, 340, 600, 360);
        controller.syncViewportSize(320, 240);
        controller.updatePointer(Number.NaN, Number.POSITIVE_INFINITY, 320, 240);
        check(
            pointerBreachPreserved && uiEscapePreserved && sceneEscapeHandled &&
            controller.getState().pointerX === 320 && controller.getState().lensX === 320 &&
            controller.getState().pointerY === 240 && controller.getState().lensY === 240 &&
            controller.getState().normX === 1 && controller.getState().normY === 1 &&
            controller.getState().baseBreachRadius === 29 && controller.getState().maxBreachRadius === 53,
            'Unowned Space release and UI Escape preserve pointer breach; scene Escape closes it and resize clamps active lens geometry'
        );
    } finally {
        Object.assign(sceneState, { currentPhase: savedPhase });
        sceneState.telemetry.simulationTimeSec = savedSimTime;
        if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    }
}
// --- КОНЕЦ ФУНКЦИИ runStressInputChecks ---

// --- НАЧАЛО ФУНКЦИИ runUniverseVerificationSuite ---
export function runUniverseVerificationSuite(): VerificationSuiteResult {
    const details: string[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // --- НАЧАЛО ФУНКЦИИ check (runUniverseVerificationSuite) ---
    const check = (cond: boolean, desc: string): void => {
        totalChecks++;
        if (assertCondition(cond, desc, details)) {
            passedChecks++;
        }
    };
    // --- КОНЕЦ ФУНКЦИИ check (runUniverseVerificationSuite) ---

    // ------------------------------------------------------------------------
    // КАНОНИЧЕСКИЙ ПОДАКТ СИНГУЛЯРНОСТИ И ОГРАНИЧЕННЫЙ ЖУРНАЛ ТЕРМИНАЛА
    // ------------------------------------------------------------------------
    const inactiveAct: CanonicalSingularityAct = 'INACTIVE';
    const storeInactiveAct: StoreSingularityAct = inactiveAct;
    const canonicalStoreAct: CanonicalSingularityAct = universeStore.getState().singularityAct;
    check(
        canonicalStoreAct === storeInactiveAct,
        'Initial store state uses canonical INACTIVE singularity act through its public type re-export'
    );

    for (let index = 0; index < 30; index++) {
        universeStore.emitEvent('qa:terminal', `Terminal regression ${index}`);
    }
    const terminalLogs = universeStore.getState().terminalLogs;
    check(
        terminalLogs.length === 25 &&
        terminalLogs.every((line, index) =>
            /^\[\d{2}:\d{2}:\d{2}\] \[QA:TERMINAL\] Terminal regression \d+$/.test(line) &&
            line.endsWith(`Terminal regression ${29 - index}`)
        ),
        'Terminal log retains the latest 25 events in reverse order with timestamps and uppercase source tags'
    );
    runStressInputChecks(check);
    runPipelineQualityChecks(check);
    runFinaleStoreChecks(check);

    // ------------------------------------------------------------------------
    // ПРОВЕРКА GOLDEN-ВЕКТОРОВ PRNG И АУДИООГИБАЮЩИХ (TS <-> RUST <-> PYTHON)
    // ------------------------------------------------------------------------
    check(
        verifyGoldenPrngParity(),
        `Golden PRNG Parity (seed=${GOLDEN_SEED}, vectors=[${GOLDEN_U32_VECTORS.join(', ')}])`
    );

    let attackInSteps = 0;
    let releaseInSteps = 1;
    for (let step = 0; step < 10; step++) {
        attackInSteps = smoothAudioEnvelope(attackInSteps, 1, 0.01, 0.08, 0.24);
        releaseInSteps = smoothAudioEnvelope(releaseInSteps, 0, 0.01, 0.08, 0.24);
    }
    const attackInOneStep = smoothAudioEnvelope(0, 1, 0.1, 0.08, 0.24);
    const releaseInOneStep = smoothAudioEnvelope(1, 0, 0.1, 0.08, 0.24);
    check(
        Math.abs(attackInSteps - attackInOneStep) < 1e-9 &&
            Math.abs(releaseInSteps - releaseInOneStep) < 1e-9 &&
            attackInSteps > 0 && attackInSteps < 1 &&
            releaseInSteps > 0 && releaseInSteps < 1,
        'Audio envelopes use time-based attack/release smoothing independent of frame partitioning'
    );

    // ------------------------------------------------------------------------
    // ПРОВЕРКА SCENEBUFFERSOA ('UNVS', STATE DIGEST, 8-FIELD NAN-GUARD)
    // ------------------------------------------------------------------------
    const bufA = new SceneBufferSoA(64, GOLDEN_SEED);
    const bufB = new SceneBufferSoA(64, GOLDEN_SEED);
    const rng = new DeterministicPRNG(GOLDEN_SEED);

    for (let i = 0; i < 16; i++) {
        const x = rng.nextRange(-200, 200);
        const y = rng.nextRange(-240, 240);
        const vx = rng.nextRange(-15, 15);
        const vy = rng.nextRange(-15, 15);
        bufA.syncEntityFromParticle(
            i,
            i,
            EntityKindCode.STAR,
            x,
            y,
            1.0,
            vx,
            vy,
            0,
            1.0,
            0.8,
            0
        );
        bufB.syncEntityFromParticle(
            i,
            i,
            EntityKindCode.STAR,
            x,
            y,
            1.0,
            vx,
            vy,
            0,
            1.0,
            0.8,
            0
        );
    }

    const digestA = bufA.commitTickAndComputeDigest(10, 16, GOLDEN_SEED);
    const digestB = bufB.commitTickAndComputeDigest(10, 16, GOLDEN_SEED);
    const headerA = bufA.readHeader();

    check(
        headerA.magic === SCENE_BUFFER_MAGIC &&
        headerA.schemaVersion === SCENE_SCHEMA_VERSION,
        `SceneBufferSoA Little-Endian Header ('UNVS' = 0x${SCENE_BUFFER_MAGIC.toString(16).toUpperCase()}, v${SCENE_SCHEMA_VERSION})`
    );
    check(
        digestA === digestB && digestA !== 0,
        `Deterministic State Digest Parity across buffers (${bufA.getDigestHex()})`
    );

    bufA.resetNanGuardTriggers();
    bufA.syncEntityFromParticle(
        0,
        0,
        EntityKindCode.STAR,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        Number.NaN,
        Number.NaN,
        0
    );
    check(
        bufA.getNanGuardTriggers() === 8 &&
        Number.isFinite(bufA.pos[0]) &&
        Number.isFinite(bufA.pos[1]) &&
        Number.isFinite(bufA.pos[2]) &&
        Number.isFinite(bufA.vel[0]) &&
        Number.isFinite(bufA.vel[1]) &&
        Number.isFinite(bufA.vel[2]) &&
        Number.isFinite(bufA.depthZ[0]) &&
        Number.isFinite(bufA.energy[0]),
        'SceneBufferSoA NaN/Infinity Guard sanitizes and counts all 8 numeric fields (x,y,z,vx,vy,vz,depthZ,energy)'
    );

    // ------------------------------------------------------------------------
    // ПРОВЕРКА ЧЕСТНОГО ДРЕЙФА ЭНЕРГИИ ΔE/E₀ И КОНТРАКТА C-ABI WASM
    // ------------------------------------------------------------------------
    wasmPhysicsBridge.initKuramotoOscillators(GOLDEN_SEED);
    const zeroDtStep = wasmPhysicsBridge.stepSymplecticPhysics(
        bufA,
        16,
        0.0,
        0.0,
        960,
        540,
        1920,
        1080,
        1.0
    );
    const activeDtStep = wasmPhysicsBridge.stepSymplecticPhysics(
        bufA,
        16,
        0.016,
        0.016,
        960,
        540,
        1920,
        1080,
        1.0
    );
    const incompleteWasmRejected = !WasmPhysicsBridge.validateWasmExportsContract({
        memory: {} as WebAssembly.Memory,
    });
    check(
        zeroDtStep.energyDriftRatio === 0 &&
        activeDtStep.energyDriftRatio > 0 &&
        activeDtStep.energyDriftRatio < 0.01 &&
        activeDtStep.kuramotoOrderR > 0 &&
        activeDtStep.kuramotoOrderR <= 1.0 &&
        incompleteWasmRejected,
        `Symplectic Velocity Verlet reports true ΔE/E₀ (0.0 at dt=0, ${activeDtStep.energyDriftRatio.toExponential(2)} at dt=16ms) and validates full WASM ABI`
    );

    // ------------------------------------------------------------------------
    // ПРОВЕРКА ОТСУТСТВИЯ ПОТЕРИ ВРЕМЕНИ ШАГА (2x8ms == 1x16ms == 4x4ms)
    // ------------------------------------------------------------------------
    wasmPhysicsBridge.initKuramotoOscillators(GOLDEN_SEED);
    wasmPhysicsBridge.stepSymplecticPhysics(bufA, 16, 0.016, 0.016, 960, 540, 1920, 1080, 1.0);
    const posAfter1x16 = wasmPhysicsBridge.getOrbitPosition(0);
    const simSec1x16 = wasmPhysicsBridge.getIntegratedSimSec();

    wasmPhysicsBridge.initKuramotoOscillators(GOLDEN_SEED);
    wasmPhysicsBridge.stepSymplecticPhysics(bufA, 16, 0.008, 0.008, 960, 540, 1920, 1080, 1.0);
    wasmPhysicsBridge.stepSymplecticPhysics(bufA, 16, 0.008, 0.016, 960, 540, 1920, 1080, 1.0);
    const posAfter2x8 = wasmPhysicsBridge.getOrbitPosition(0);
    const simSec2x8 = wasmPhysicsBridge.getIntegratedSimSec();

    check(
        Math.abs(simSec1x16 - 0.016) < 1e-6 &&
        Math.abs(simSec2x8 - 0.016) < 1e-6 &&
        Math.abs(posAfter1x16[0] - posAfter2x8[0]) < 1e-5 &&
        Math.abs(posAfter1x16[1] - posAfter2x8[1]) < 1e-5,
        `Velocity Verlet multi-substep integrator preserves full dt without loss (1x16ms == 2x8ms, integrated=${simSec1x16.toFixed(3)}s)`
    );

    // ------------------------------------------------------------------------
    // КРОСС-ЯЗЫКОВОЙ ПАРИТЕТ NEXUS: МАЛАЯ И ТРАНСПОРТНАЯ ВЫБОРКИ
    // ------------------------------------------------------------------------
    const lutCheck = NexusGraphEngine.buildBezierArcLengthLUT(0, 0, 50, 30, 100, 0);
    const lutExactOk =
        lutCheck.arcLength === 105.39 &&
        lutCheck.lut[0] === 0 &&
        lutCheck.lut[1] === 27.41 &&
        lutCheck.lut[2] === 52.69 &&
        lutCheck.lut[3] === 77.97 &&
        lutCheck.lut[4] === 105.39;

    const fixture6: GraphNodeInput[] = [
        { index: 0, id: 0, x: 0.0, y: 0.0, clusterId: 0, energy: 0.9 },
        { index: 1, id: 1, x: 80.0, y: 0.0, clusterId: 0, energy: 0.8 },
        { index: 2, id: 2, x: 40.0, y: 80.0, clusterId: 0, energy: 0.85 },
        { index: 3, id: 3, x: 160.0, y: 0.0, clusterId: 1, energy: 0.75 },
        { index: 4, id: 4, x: 240.0, y: 0.0, clusterId: 1, energy: 0.7 },
        { index: 5, id: 5, x: 200.0, y: 80.0, clusterId: 1, energy: 0.8 },
    ];
    const graph6 = nexusGraphEngine.buildDeterministicGraph(
        fixture6,
        220.0,
        GOLDEN_SEED,
        0.0
    );
    const tel6 = nexusGraphEngine.getLastTelemetry();
    const expectedIds = ['0_1', '1_3', '3_4', '0_2', '3_5', '1_2', '2_5', '4_5'];
    const expectedClasses = [
        'AXON_TRUNK',
        'AXON_TRUNK',
        'AXON_TRUNK',
        'AXON_TRUNK',
        'AXON_TRUNK',
        'DENDRITE',
        'BRIDGE',
        'DENDRITE',
    ];
    const expectedRadii = [1.95, 1.95, 1.95, 1.95, 1.95, 1.14, 1.35, 1.31];

    const idsMatch =
        graph6.edges.length === expectedIds.length &&
        graph6.edges.every(
            (e, idx) =>
                e.id === expectedIds[idx] &&
                e.edgeClass === expectedClasses[idx] &&
                e.murrayRadiusPx === expectedRadii[idx]
        );
    const metricsMatchPython =
        tel6.trunkCount === 5 &&
        tel6.bridgeCount === 1 &&
        tel6.dendriteCount === 2 &&
        tel6.avgDegree === 2.67 &&
        tel6.clusteringCoeff === 0.556 &&
        tel6.diameterHops === 3 &&
        tel6.avgPathLength === 1.53;

    check(
        lutExactOk && idsMatch && metricsMatchPython,
        `Cross-Language NEXUS Graph Exact Parity with Python (edges=[${expectedIds.join(',')}], C=${tel6.clusteringCoeff}, D=${tel6.diameterHops})`
    );

    // --- НАЧАЛО РАЗДЕЛА: ОБЩАЯ ВЫБОРКА NEXUS И ГЕОМЕТРИЧЕСКИЕ РЕГРЕССИИ ---
    const roundingCases = [
        [1.125, 2, 1.13], [-1.125, 2, -1.12],
        [2.625, 2, 2.63], [-2.625, 2, -2.62],
        [1.0625, 3, 1.063], [-1.0625, 3, -1.062],
    ];
    const roundedEndpoints = nexusGraphEngine.buildDeterministicGraph([
        { index: 0, id: 0, x: -1.125, y: 1.125, clusterId: 0, energy: 1 },
        { index: 1, id: 1, x: 20.125, y: -2.625, clusterId: 0, energy: 1 },
        { index: 2, id: 2, x: 40, y: 20, clusterId: 1, energy: 1 },
    ], 220, GOLDEN_SEED, 0).edges[0];
    check(
        roundingCases.every(([value, digits, expected]) => roundGraphDecimal(value, digits) === expected) &&
            roundedEndpoints.x1 === -1.12 && roundedEndpoints.y1 === 1.13 &&
            roundedEndpoints.x2 === 20.13 && roundedEndpoints.y2 === -2.62,
        'NEXUS decimal publication uses floor(value * scale + 0.5) / scale, including negative ties toward +infinity'
    );

    const transportRng = new DeterministicPRNG(nexusParity24.inputs.seed);
    const transportNodes: GraphNodeInput[] = [];
    for (let index = 0; index < 24; index++) {
        const x = transportRng.nextRange(-320, 320);
        const y = transportRng.nextRange(-240, 240);
        transportRng.nextRange(0.1, 1.5);
        transportRng.nextRange(-18, 18);
        transportRng.nextRange(-18, 18);
        const energy = transportRng.nextRange(0.3, 0.95);
        transportNodes.push({ index, id: index, x, y, clusterId: index % 6, energy });
    }
    const graph24 = nexusGraphEngine.buildDeterministicGraph(
        nexusParity24.inputs.nodes,
        nexusParity24.inputs.maxConnectDist,
        nexusParity24.inputs.seed,
        nexusParity24.inputs.simTimeSec
    );
    const telemetry24 = nexusGraphEngine.getLastTelemetry();
    const metrics24Match = Object.entries(nexusParity24.expected.telemetry).every(
        ([key, expected]) => telemetry24[key as keyof typeof telemetry24] === expected
    );
    // 24 узла запускают BFS из каждого узла; выборочный BFS этой выборкой не покрывается.
    check(
        JSON.stringify(transportNodes) === JSON.stringify(nexusParity24.inputs.nodes) &&
            JSON.stringify(graph24.edges) === JSON.stringify(nexusParity24.expected.edges) &&
            nexusParity24.expected.degreeByIndex.every((degree, index) => graph24.degreeByIndex.get(index) === degree) &&
            metrics24Match,
        'Shared transport 24-node NEXUS fixture matches Python exactly: inputs, all 40 edges/controls/LUT/radii, degrees and metrics (complete BFS)'
    );

    const curvedEdges = graph24.edges.filter(
        (edge) => edge.arcLength > Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1) + 0.5
    );
    let curvedSamplingValid = curvedEdges.length > 0;
    let differsFromRawParameter = false;
    for (const edge of curvedEdges) {
        const start = NexusGraphEngine.sampleBezierByArcLength(
            edge.x1, edge.y1, edge.ctrlX, edge.ctrlY, edge.x2, edge.y2, edge.lengthLUT, 0
        );
        const end = NexusGraphEngine.sampleBezierByArcLength(
            edge.x1, edge.y1, edge.ctrlX, edge.ctrlY, edge.x2, edge.y2, edge.lengthLUT, 1
        );
        curvedSamplingValid &&= start.x === edge.x1 && start.y === edge.y1 && end.x === edge.x2 && end.y === edge.y2;
        for (let segment = 0; segment < 4; segment++) {
            const arcFraction = (edge.lengthLUT[segment] + edge.lengthLUT[segment + 1]) / (2 * edge.arcLength);
            const point = NexusGraphEngine.sampleBezierByArcLength(
                edge.x1, edge.y1, edge.ctrlX, edge.ctrlY, edge.x2, edge.y2, edge.lengthLUT, arcFraction
            );
            const t = (segment + 0.5) / 4;
            const expectedX = (1 - t) ** 2 * edge.x1 + 2 * (1 - t) * t * edge.ctrlX + t ** 2 * edge.x2;
            const expectedY = (1 - t) ** 2 * edge.y1 + 2 * (1 - t) * t * edge.ctrlY + t ** 2 * edge.y2;
            curvedSamplingValid &&= Math.hypot(point.x - expectedX, point.y - expectedY) < 1e-9;
            const rawX = (1 - arcFraction) ** 2 * edge.x1 + 2 * (1 - arcFraction) * arcFraction * edge.ctrlX + arcFraction ** 2 * edge.x2;
            const rawY = (1 - arcFraction) ** 2 * edge.y1 + 2 * (1 - arcFraction) * arcFraction * edge.ctrlY + arcFraction ** 2 * edge.y2;
            differsFromRawParameter ||= Math.hypot(point.x - rawX, point.y - rawY) > 0.05;
        }
    }
    check(
        curvedSamplingValid && differsFromRawParameter,
        'Curved-edge arc LUT sampling preserves endpoints and interpolates each length interval instead of using the raw Bezier parameter'
    );

    // Изолированный экземпляр выполняет обе реальные ветви обновления без загрузки WASM.
    const topologySimulation = Object.create(VoidPhaseSimulation.prototype) as {
        particles: Array<GraphNodeInput & { depthTier: 'MIDGROUND'; degree: number }>;
        edges: TopologyEdge[];
        afterglowMap: Map<string, number>;
        width: number;
        height: number;
        lastTopologyBuildSimSec: number;
        updateTopologyAndEdgeCurves(dt: number, phase: '03_EVOLUTION', simTimeSec: number, seed: number): void;
    };
    Object.assign(topologySimulation, {
        particles: fixture6.map((node) => ({ ...node, depthTier: 'MIDGROUND', degree: 0 })),
        edges: [], afterglowMap: new Map(), width: 920, height: 920, lastTopologyBuildSimSec: -10,
    });
    topologySimulation.updateTopologyAndEdgeCurves(0, '03_EVOLUTION', 1, GOLDEN_SEED);
    const builtEdges = topologySimulation.edges.map((edge) => ({ ...edge }));
    topologySimulation.updateTopologyAndEdgeCurves(0, '03_EVOLUTION', 1.001, GOLDEN_SEED);
    const fastEdges = topologySimulation.edges.map((edge) => ({ ...edge }));
    topologySimulation.lastTopologyBuildSimSec = -10;
    topologySimulation.updateTopologyAndEdgeCurves(0, '03_EVOLUTION', 1.001, GOLDEN_SEED);
    check(
        new Set(builtEdges.map((edge) => edge.edgeClass)).size === 3 &&
            fastEdges.every((edge, index) => {
                const before = builtEdges[index];
                const rebuilt = topologySimulation.edges[index];
                return edge.id === before.id && edge.id === rebuilt.id &&
                    Math.hypot(edge.ctrlX - before.ctrlX, edge.ctrlY - before.ctrlY) < 0.02 &&
                    Math.abs(edge.ctrlX - rebuilt.ctrlX) <= 0.0051 &&
                    Math.abs(edge.ctrlY - rebuilt.ctrlY) <= 0.0051;
            }),
        'All three edge classes keep the same bend through rebuild -> intermediate update -> rebuild with an odd seed'
    );

    const stressState = stressStore.getState() as StressStateData;
    const savedStress = { ...stressState };
    const lensUniverseState = universeStore.getState();
    const savedLensTime = lensUniverseState.telemetry.simulationTimeSec;
    const savedLogicConvergence = lensUniverseState.opticalWeights.logicConvergence;
    let lensTimeValid = true;
    const lensReveals: number[] = [];
    try {
        Object.assign(stressState, {
            lensX: 0, lensY: 0, currentBreachRadius: 100, globalStress: 1,
            revealIntensity: 1, shockwaves: [], spontaneousRifts: [],
        });
        lensUniverseState.opticalWeights.logicConvergence = 0;
        for (const time of [0, 2]) {
            lensUniverseState.telemetry.simulationTimeSec = time;
            const localRadius = stressStore.getDeformedLensRadiusAtAngle(0, time);
            const normalizedRadius = 100 / localRadius;
            const fade = (normalizedRadius - 0.55) / 0.45;
            const expectedReveal = normalizedRadius >= 1 ? 0 : 1 - fade * fade * (3 - 2 * fade);
            const reveal = stressStore.getTruthRevealFactorAt(100, 0);
            lensReveals.push(reveal);
            lensTimeValid &&= Math.abs(reveal - expectedReveal) < 1e-12;
        }
    } finally {
        Object.assign(stressState, savedStress);
        lensUniverseState.telemetry.simulationTimeSec = savedLensTime;
        lensUniverseState.opticalWeights.logicConvergence = savedLogicConvergence;
    }
    check(
        lensTimeValid && lensReveals[0] > 0.001 && lensReveals[1] === 0,
        'Truth reveal follows the deformed lens boundary at current simulation time as a fixed point crosses the animated rim'
    );
    // --- КОНЕЦ РАЗДЕЛА: ОБЩАЯ ВЫБОРКА NEXUS И ГЕОМЕТРИЧЕСКИЕ РЕГРЕССИИ ---

    // ------------------------------------------------------------------------
    // ПРОВЕРКА БИНАРНОГО ПРОТОКОЛА PYTHONSOCKETCLIENT
    // ------------------------------------------------------------------------
    pythonSocketClient.resetSession();

    const truncatedBuffer = new ArrayBuffer(12);
    check(
        !pythonSocketClient.handleBinaryFramePacket(truncatedBuffer),
        'Binary Protocol Guard rejects truncated packet (< 24 bytes)'
    );

    const validPacket = new ArrayBuffer(24 + 2 * 12);
    const view = new DataView(validPacket);
    view.setUint32(0, SCENE_BUFFER_MAGIC, true);
    view.setUint16(4, SCENE_SCHEMA_VERSION, true);
    view.setUint16(6, 1, true);
    view.setUint32(8, 50, true);
    view.setUint32(12, 2, true);
    view.setUint32(16, GOLDEN_SEED, true);
    view.setUint32(20, digestA, true);
    view.setFloat32(24, 120.5, true);
    view.setFloat32(28, -84.25, true);
    view.setFloat32(32, 1.0, true);
    view.setFloat32(36, -45.0, true);
    view.setFloat32(40, 62.0, true);
    view.setFloat32(44, 0.8, true);

    check(
        pythonSocketClient.handleBinaryFramePacket(validPacket),
        'Binary Protocol Guard accepts valid little-endian packet with finite payload (tick=50)'
    );

    view.setUint32(8, 42, true);
    check(
        !pythonSocketClient.handleBinaryFramePacket(validPacket),
        'Binary Protocol Guard rejects stale out-of-order packet (tick=42 < 50)'
    );

    view.setUint32(8, 55, true);
    view.setFloat32(24, Number.NaN, true);
    check(
        !pythonSocketClient.handleBinaryFramePacket(validPacket),
        'Binary Protocol Guard rejects packet containing NaN coordinate in payload'
    );

    // ------------------------------------------------------------------------
    // ПРОВЕРКА CIPHERODOMETERENGINE (ВЁРСТКА 320..1920 PX, СКОРОСТЬ 18..26 ГЦ И ПАУЗА)
    // ------------------------------------------------------------------------
    const testWidths = [320, 360, 390, 768, 1280, 1920];
    let allWidthsValid = true;
    for (let wIdx = 0; wIdx < testWidths.length; wIdx++) {
        const w = testWidths[wIdx];
        const lockedOk = cipherOdometerEngine.verifyFinalLockedText(w, 840);
        const cells = cipherOdometerEngine.evaluateCells(w, 840, 1.0, false);
        const noClipping = cells.every(
            (c: OdometerGlyphCellState) =>
                c.targetX >= 8 &&
                c.targetX <= w - 8 &&
                Array.from(c.primaryChar).length === 1
        );
        if (!lockedOk || !noClipping) {
            allWidthsValid = false;
        }
    }
    check(
        allWidthsValid &&
        CANONICAL_FINALE_LINES.length === 5 &&
        CANONICAL_FINALE_LINES[0] === 'DUBNOV ALEXEY',
        'CipherOdometerEngine locks all static lines and author header without clipping (320px..1920px)'
    );

    // Измеряем реальную скорость накопления фазы за 1.0 с (50 кадров по 20 мс)
    if (universeStore.getState().isPaused) {
        universeStore.togglePause();
    }
    cipherOdometerEngine.resetClockForTest(10.0);
    for (let step = 1; step <= 50; step++) {
        cipherOdometerEngine.evaluateCells(1280, 720, 1.0, false, 10.0 + step * 0.02);
    }
    const measuredHzOver1Sec = cipherOdometerEngine.getAccumulatedSpinPhase();

    universeStore.togglePause();
    const pausedCellsA = cipherOdometerEngine.evaluateCells(1280, 720, 1.0, false, 12.0);
    const pausedCellsB = cipherOdometerEngine.evaluateCells(1280, 720, 1.0, false, 12.5);
    const pauseFrozenOk =
        pausedCellsA.length > 0 &&
        pausedCellsA.every(
            (cell, idx) =>
                cell.wheelPhaseFrac === pausedCellsB[idx].wheelPhaseFrac &&
                cell.primaryChar === pausedCellsB[idx].primaryChar
        );
    universeStore.togglePause();

    check(
        measuredHzOver1Sec >= 18.0 &&
        measuredHzOver1Sec <= 26.0 &&
        pauseFrozenOk,
        `CipherOdometerEngine base spin rate is strictly within [18..26] Hz (measured=${measuredHzOver1Sec.toFixed(2)} Hz) and freezes on pause`
    );

    // ------------------------------------------------------------------------
    // РЕГРЕССИОННЫЙ ТЕСТ 5-Й ФАЗЫ (БЕЗ ЗАВИСАНИЯ И С СОХРАНЕНИЕМ ВИЗИТКИ)
    // ------------------------------------------------------------------------
    universeStore.setPhase('05_SINGULARITY');
    universeStore.updateTelemetry({
        frameTimeMs: 16.0,
        simulationTimeSec: 89.0,
        phaseElapsedSec: 10.0,
    });
    const actBState = universeStore.getState();
    const actBValid =
        actBState.singularityAct === 'ACT_B_LOGIC' &&
        actBState.opticalWeights.logicConvergence > 0;

    universeStore.updateTelemetry({
        frameTimeMs: 16.0,
        simulationTimeSec: 92.8,
        phaseElapsedSec: 13.8,
    });
    const actCState = universeStore.getState();
    const actCValid =
        actCState.singularityAct === 'ACT_C_ZERO_SILENCE' &&
        actCState.opticalWeights.logicConvergence === 0;

    universeStore.updateTelemetry({
        frameTimeMs: 16.0,
        simulationTimeSec: 99.0,
        phaseElapsedSec: 20.0,
    });
    const actDState = universeStore.getState();
    const actDValid =
        actDState.singularityAct === 'ACT_D_GITHUB_CARD' &&
        actDState.githubCardAssemblyProgress >= 0.99 &&
        actDState.opticalWeights.logicConvergence === 0 &&
        actDState.finaleReachedOnce;

    check(
        actBValid && actCValid && actDValid,
        'Phase 05 Singularity transitions ACT_B -> ACT_C -> ACT_D cleanly, resets logicConvergence=0, and locks card'
    );

    // ------------------------------------------------------------------------
    // RESOURCELEDGER (ZERO-ALLOWANCE LEAK CHECK, UNDERFLOW & 10X RESTART)
    // ------------------------------------------------------------------------
    resourceLedger.setBaseline();
    resourceLedger.trackRelease('workers', 1);
    resourceLedger.registerCycleDisposable(() => {
        throw new Error('Intentional test disposer failure');
    });
    const faultRes = resourceLedger.disposeCycleResources();
    const faultCounters = resourceLedger.getCounters();
    const faultDetectedOk =
        !faultRes.leakFree &&
        faultCounters.underflowCount === 1 &&
        faultCounters.disposerErrors === 1;

    resourceLedger.setBaseline();
    let allRestartsValid = true;
    let executedDisposersCount = 0;

    for (let r = 0; r < 10; r++) {
        resourceLedger.trackAllocation('listeners', 2);
        resourceLedger.trackAllocation('textures', 1);
        resourceLedger.trackAllocation('audioNodes', 1);
        resourceLedger.registerCycleDisposable(() => {
            executedDisposersCount += 1;
            resourceLedger.trackRelease('listeners', 2);
            resourceLedger.trackRelease('textures', 1);
            resourceLedger.trackRelease('audioNodes', 1);
        });

        universeStore.triggerUniverseRestart();

        let safetySteps = 0;
        while (
            universeStore.getState().singularityAct === 'RESTART_COLLAPSE' &&
            safetySteps < 15
            ) {
            safetySteps++;
            const cur = universeStore.getState().telemetry;
            universeStore.updateTelemetry({
                frameTimeMs: 16.0,
                simulationTimeSec: Number((cur.simulationTimeSec + 0.16).toFixed(3)),
                phaseElapsedSec: Number((cur.phaseElapsedSec + 0.16).toFixed(3)),
            });
        }

        const ledgerRes = resourceLedger.disposeCycleResources();
        const afterRestart = universeStore.getState();

        if (
            !ledgerRes.leakFree ||
            afterRestart.currentPhase !== '01_VOID' ||
            !afterRestart.finaleReachedOnce ||
            afterRestart.githubCardAssemblyProgress < 1.0
        ) {
            allRestartsValid = false;
        }
    }

    const finalCounters = resourceLedger.getCounters();
    check(
        faultDetectedOk &&
        allRestartsValid &&
        executedDisposersCount === 10 &&
        finalCounters.restartCount >= 10,
        'ResourceLedger enforces zero-tolerance cycle baseline across all 5 categories and completes 10x Restart cycles'
    );

    universeStore.setPhase('01_VOID');

    for (const result of runVisualSignalChecks()) check(result.passed, result.description);
    runWaterfallLifecycleChecks(check);
    runFinaleCompositionChecks(check);
    runButtonMotionChecks(check);
    runButtonSolidChecks(check);

    return {
        passed: passedChecks === totalChecks,
        totalChecks,
        passedChecks,
        details,
    };
}
// --- КОНЕЦ ФУНКЦИИ runUniverseVerificationSuite ---
