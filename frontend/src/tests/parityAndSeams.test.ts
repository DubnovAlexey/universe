// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/tests/parityAndSeams.test.ts
// НАЗНАЧЕНИЕ: Автоматический набор проверок паритета, бинарных пакетов и швов (MASTER 00B / 99)
// ЗАДАЧИ ФАЙЛА:
// 1. Проверять побитовый паритет детерминированного PRNG по GOLDEN_U32_VECTORS.
// 2. Валидировать заголовок SceneBufferSoA ('UNVS', little-endian, NaN/Inf-guard, State Digest).
// 3. Тестировать защиту PythonSocketClient от обрезанных, повреждённых и устаревших пакетов.
// 4. Проверять 100%-ную точность сборки 5 каноничных строк в CipherOdometerEngine
//    на всех контрольных ширинах экрана (320, 360, 390, 768, 1280, 1920 px) без клиппинга.
// 5. Выполнять 10 перезапусков Restart Universe подряд, подтверждая отсутствие утечек в ResourceLedger.
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

// ----------------------------------------------------------------------------
// ГЛАВНАЯ ФУНКЦИЯ ПРОГОНА ВСЕХ АВТОМАТИЧЕСКИХ ИНВАРИАНТОВ MASTER 00B & MASTER 99
// ----------------------------------------------------------------------------
export function runUniverseVerificationSuite(): VerificationSuiteResult {
    const details: string[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    const check = (cond: boolean, desc: string) => {
        totalChecks++;
        if (assertCondition(cond, desc, details)) {
            passedChecks++;
        }
    };

    // 1. Проверка Golden-векторов PRNG (паритет TypeScript <-> Rust <-> Python)
    check(
        verifyGoldenPrngParity(),
        `Golden PRNG Parity (seed=${GOLDEN_SEED}, vectors=[${GOLDEN_U32_VECTORS.join(', ')}])`
    );

    // 2. Проверка SceneBufferSoA ('UNVS' little-endian, NaN/Inf-guard и детерминизма State Digest)
    const bufA = new SceneBufferSoA(64, GOLDEN_SEED);
    const bufB = new SceneBufferSoA(64, GOLDEN_SEED);
    const rng = new DeterministicPRNG(GOLDEN_SEED);

    for (let i = 0; i < 16; i++) {
        const x = rng.nextRange(-200, 200);
        const y = rng.nextRange(-200, 200);
        const vx = rng.nextRange(-15, 15);
        const vy = rng.nextRange(-15, 15);
        bufA.syncEntityFromParticle(i, i, EntityKindCode.STAR, x, y, 1.0, vx, vy, 0, 1.0, 0.8, 0);
        bufB.syncEntityFromParticle(i, i, EntityKindCode.STAR, x, y, 1.0, vx, vy, 0, 1.0, 0.8, 0);
    }

    const digestA = bufA.commitTickAndComputeDigest(10, 16, GOLDEN_SEED);
    const digestB = bufB.commitTickAndComputeDigest(10, 16, GOLDEN_SEED);
    const headerA = bufA.readHeader();

    check(
        headerA.magic === SCENE_BUFFER_MAGIC && headerA.schemaVersion === SCENE_SCHEMA_VERSION,
        `SceneBufferSoA Little-Endian Header ('UNVS' = 0x${SCENE_BUFFER_MAGIC.toString(16).toUpperCase()}, v${SCENE_SCHEMA_VERSION})`
    );
    check(
        digestA === digestB && digestA !== 0,
        `Deterministic State Digest Parity across buffers (${bufA.getDigestHex()})`
    );

    // Проверка NaN/Inf-guard в SceneBufferSoA
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

    // 3. Проверка валидации бинарных пакетов в PythonSocketClient
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

    check(
        pythonSocketClient.handleBinaryFramePacket(validPacket),
        'Binary Protocol Guard accepts valid little-endian packet (tick=50)'
    );

    view.setUint32(8, 42, true);
    check(
        !pythonSocketClient.handleBinaryFramePacket(validPacket),
        'Binary Protocol Guard rejects stale out-of-order packet (tick=42 < 50)'
    );

    // 4. Проверка 3D-Odometer на всех контрольных ширинах экрана (320..1920 px)
    const testWidths = [320, 360, 390, 768, 1280, 1920];
    let allWidthsValid = true;
    for (let wIdx = 0; wIdx < testWidths.length; wIdx++) {
        const w = testWidths[wIdx];
        const lockedOk = cipherOdometerEngine.verifyFinalLockedText(w, 840);
        const cells = cipherOdometerEngine.evaluateCells(w, 840, 1.0, false);
        const noClipping = cells.every(
            (c: OdometerGlyphCellState) => c.targetX >= 8 && c.targetX <= w - 8
        );
        if (!lockedOk || !noClipping) {
            allWidthsValid = false;
        }
    }
    check(
        allWidthsValid && CANONICAL_FINALE_LINES.length === 5,
        'CipherOdometerEngine locks 100% of 5 canonical lines without clipping across 320px..1920px'
    );

    // 5. Проверка 10 последовательных перезапусков Restart Universe без утечек ресурсов
    resourceLedger.setBaseline();
    let allRestartsLeakFree = true;
    for (let r = 0; r < 10; r++) {
        universeStore.triggerUniverseRestart();
        universeStore.completeRestartToVoid();
        const checkRes = resourceLedger.disposeCycleResources();
        if (!checkRes.leakFree) {
            allRestartsLeakFree = false;
        }
    }
    check(
        allRestartsLeakFree && universeStore.getState().currentPhase === '01_VOID',
        '10x Consecutive Restart Universe cycles complete with 0 leaks in ResourceLedger'
    );

    return {
        passed: passedChecks === totalChecks,
        totalChecks,
        passedChecks,
        details,
    };
}