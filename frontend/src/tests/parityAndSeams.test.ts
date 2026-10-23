// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/tests/parityAndSeams.test.ts
// НАЗНАЧЕНИЕ: Автоматический набор регрессионных проверок паритета, бинарного
//             протокола, таймлайна 5-й фазы, одометра и ресурсов (UNIVERSE v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ:
//   РАЗДЕЛ 1. Контракт результата верификации (VerificationSuiteResult) и
//             утилита фиксации проверок (assertCondition).
//   РАЗДЕЛ 2. Главная тестовая функция runUniverseVerificationSuite() (11 инвариантов):
//     - Подраздел 2.1. Паритет детерминированного ГПСЧ (GOLDEN_U32_VECTORS).
//     - Подраздел 2.2. Валидация SceneBufferSoA ('UNVS', State Digest, NaN-guard).
//     - Подраздел 2.3. Защита бинарного протокола PythonSocketClient (обрезка,
//                      неверный magic, NaN в координатах, монотонность tick).
//     - Подраздел 2.4. Вёрстка одометра (320..1920 px) без клиппинга.
//     - Подраздел 2.5. Регрессионный тест 5-й фазы (05_SINGULARITY): переход
//                      ACT_A -> ACT_B -> ACT_C -> ACT_D, сброс logicConvergence=0
//                      и сохранение флага постоянной визитки finaleReachedOnce.
//     - Подраздел 2.6. Честный прогон 10 перезапусков цикла через пошаговое
//                      приращение времени в updateTelemetry() и ResourceLedger.
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
import { pythonSocketClient } from '../bridge/pythonSocketClient';
import {
    CANONICAL_FINALE_LINES,
    cipherOdometerEngine,
    type OdometerGlyphCellState,
} from '../bridge/cipherOdometerEngine';
import { universeStore } from '../store/universeState';

// ============================================================================
// РАЗДЕЛ 1. КОНТРАКТ РЕЗУЛЬТАТА ВЕРИФИКАЦИИ И УТИЛИТА ПРОВЕРКИ
// ============================================================================

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

// ============================================================================
// РАЗДЕЛ 2. ГЛАВНАЯ ФУНКЦИЯ ПРОГОНА ВСЕХ ИНВАРИАНТОВ (runUniverseVerificationSuite)
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ runUniverseVerificationSuite ---
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
    // ПОДРАЗДЕЛ 2.1. ПРОВЕРКА GOLDEN-ВЕКТОРОВ PRNG (TS <-> RUST <-> PYTHON)
    // ------------------------------------------------------------------------
    check(
        verifyGoldenPrngParity(),
        `Golden PRNG Parity (seed=${GOLDEN_SEED}, vectors=[${GOLDEN_U32_VECTORS.join(', ')}])`
    );

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.2. ПРОВЕРКА SCENEBUFFERSOA ('UNVS', STATE DIGEST, NAN-GUARD)
    // ------------------------------------------------------------------------
    const bufA = new SceneBufferSoA(64, GOLDEN_SEED);
    const bufB = new SceneBufferSoA(64, GOLDEN_SEED);
    const rng = new DeterministicPRNG(GOLDEN_SEED);

    for (let i = 0; i < 16; i++) {
        const x = rng.nextRange(-200, 200);
        const y = rng.nextRange(-200, 200);
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

    bufA.syncEntityFromParticle(
        0,
        0,
        EntityKindCode.STAR,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        1,
        0,
        0,
        0,
        1,
        1,
        0
    );
    check(
        Number.isFinite(bufA.pos[0]) &&
        Number.isFinite(bufA.pos[1]) &&
        bufA.getNanGuardTriggers() > 0,
        'SceneBufferSoA NaN/Infinity Guard sanitizes corrupted coordinates'
    );

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.3. ПРОВЕРКА БИНАРНОГО ПРОТОКОЛА PYTHONSOCKETCLIENT
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
    // ПОДРАЗДЕЛ 2.4. ПРОВЕРКА CIPHERODOMETERENGINE (ВЁРСТКА 320..1920 PX)
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

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.5. РЕГРЕССИОННЫЙ ТЕСТ 5-Й ФАЗЫ (БЕЗ ЗАВИСАНИЯ И С СОХРАНЕНИЕМ ВИЗИТКИ)
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
    // ПОДРАЗДЕЛ 2.6. 10 РЕАЛЬНЫХ ЦИКЛОВ RESTART И СИММЕТРИЯ RESOURCELEDGER
    // ------------------------------------------------------------------------
    resourceLedger.setBaseline();
    let allRestartsValid = true;

    for (let r = 0; r < 10; r++) {
        resourceLedger.trackAllocation('listeners', 2);
        resourceLedger.trackAllocation('textures', 1);
        universeStore.triggerUniverseRestart();

        // Шагаем с реальным приращением dt = 0.16 с от текущего phaseElapsedSec хранилища,
        // останавливаясь ровно в момент завершения RESTART_COLLAPSE и входа в 01_VOID
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

        resourceLedger.trackRelease('listeners', 2);
        resourceLedger.trackRelease('textures', 1);
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
        allRestartsValid && finalCounters.restartCount >= 10,
        '10x Full Restart Universe transitions complete via updateTelemetry with symmetrical ResourceLedger and persistent Finale Card'
    );

    // Восстанавливаем чистое стартовое состояние хранилища
    universeStore.setPhase('01_VOID');

    return {
        passed: passedChecks === totalChecks,
        totalChecks,
        passedChecks,
        details,
    };
}
// --- КОНЕЦ ФУНКЦИИ runUniverseVerificationSuite ---