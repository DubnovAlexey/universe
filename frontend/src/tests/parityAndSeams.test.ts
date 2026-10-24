// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/tests/parityAndSeams.test.ts
// НАЗНАЧЕНИЕ: Автоматический набор регрессионных проверок паритета, бинарного
//             протокола, шага времени Velocity Verlet, графа NEXUS (TS == Python),
//             таймлайна 5-й фазы, скорости одометра и ресурсов (15 инвариантов)
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
import { EntityKindCode } from '../core/contracts';
import { resourceLedger } from '../core/resourceLedger';
import { WasmPhysicsBridge, wasmPhysicsBridge } from '../bridge/wasmBridge';
import {
    NexusGraphEngine,
    nexusGraphEngine,
    type GraphNodeInput,
} from '../bridge/simulationWorker';
import { pythonSocketClient } from '../bridge/pythonSocketClient';
import {
    CANONICAL_FINALE_LINES,
    cipherOdometerEngine,
    type OdometerGlyphCellState,
} from '../bridge/cipherOdometerEngine';
import { universeStore } from '../store/universeState';

export interface VerificationSuiteResult {
    passed: boolean;
    totalChecks: number;
    passedChecks: number;
    details: string[];
}

function assertCondition(
    condition: boolean,
    description: string,
    details: string[]
): boolean {
    details.push(`${condition ? '[PASS]' : '[FAIL]'} ${description}`);
    return condition;
}

export function runUniverseVerificationSuite(): VerificationSuiteResult {
    const details: string[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    const check = (cond: boolean, desc: string): void => {
        totalChecks++;
        if (assertCondition(cond, desc, details)) {
            passedChecks++;
        }
    };

    // ------------------------------------------------------------------------
    // 1. ПРОВЕРКА GOLDEN-ВЕКТОРОВ PRNG (TS <-> RUST <-> PYTHON)
    // ------------------------------------------------------------------------
    check(
        verifyGoldenPrngParity(),
        `Golden PRNG Parity (seed=${GOLDEN_SEED}, vectors=[${GOLDEN_U32_VECTORS.join(', ')}])`
    );

    // ------------------------------------------------------------------------
    // 2–4. ПРОВЕРКА SCENEBUFFERSOA ('UNVS', STATE DIGEST, 8-FIELD NAN-GUARD)
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
    // 5. ПРОВЕРКА ЧЕСТНОГО ДРЕЙФА ЭНЕРГИИ ΔE/E₀ И КОНТРАКТА C-ABI WASM
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
    // 6. ПРОВЕРКА ОТСУТСТВИЯ ПОТЕРИ ВРЕМЕНИ ШАГА (2x8ms == 1x16ms == 4x4ms)
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
    // 7. ТОЧНЫЙ КРОСС-ЯЗЫКОВОЙ ПАРИТЕТ ГРАФА NEXUS С PYTHON (6-NODE FIXTURE)
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

    // ------------------------------------------------------------------------
    // 8–11. ПРОВЕРКА БИНАРНОГО ПРОТОКОЛА PYTHONSOCKETCLIENT
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
    // 12–13. ПРОВЕРКА CIPHERODOMETERENGINE (ВЁРСТКА 320..1920 PX, СКОРОСТЬ 18..26 ГЦ И ПАУЗА)
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
                c.primaryChar.length === 1
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
    // 14. РЕГРЕССИОННЫЙ ТЕСТ 5-Й ФАЗЫ (БЕЗ ЗАВИСАНИЯ И С СОХРАНЕНИЕМ ВИЗИТКИ)
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
    // 15. RESOURCELEDGER (ZERO-ALLOWANCE LEAK CHECK, UNDERFLOW & 10X RESTART)
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

    return {
        passed: passedChecks === totalChecks,
        totalChecks,
        passedChecks,
        details,
    };
}