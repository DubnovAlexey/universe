// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/03_evolution.ts
// НАЗНАЧЕНИЕ: MASTER 03 v2.0 — 5 встречных колец + 2 полушария Мозга NEXUS (39–61 с)
// ЗАДАЧИ ФАЙЛА:
// 1. Воплотить архитектурное решение D-3: 5 встречных кеплеровских колец служат
//    внутренним кинематическим каркасом, а два объёмных полушария с бороздами извилин —
//    скульптурной оболочкой вокруг него.
// 2. Преобразовать световой мост GENESIS в центральное соединение полушарий.
// ============================================================================

import type { MorphTargetPoint, QuantumParticle } from './01_void';

// Пять концентрических оболочек кеплеровских колец по золотому сечению (Решение D-3)
const KEPLER_RING_RATIOS: ReadonlyArray<number> = [0.22, 0.36, 0.52, 0.70, 0.88];

export function computeEvolutionBrainTarget(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    simTimeSec: number,
    phaseProgress: number
): MorphTargetPoint {
    const hemisphereSign = p.homeNormX < 0 ? -1 : 1;
    const isCentralBridge = p.id % 9 === 0;

    // 1. Центральное межполушарное соединение, выросшее из приливного светового моста GENESIS
    if (isCentralBridge) {
        const bridgeT = ((p.id % 21) / 20) * 2.0 - 1.0; // -1 .. +1
        const archY = -Math.cos(bridgeT * Math.PI * 0.5) * (height * 0.105);
        const x = centerX + bridgeT * (width * 0.145);
        const y = centerY + archY + Math.sin(simTimeSec * 1.5 + p.id) * 9;
        return { x, y, energy: 0.88 };
    }

    // 2. Пять встречных кеплеровских колец как внутренний кинематический каркас (35% узлов)
    const ringIdx = p.ringIndex % 5;
    const ringRatio = KEPLER_RING_RATIOS[ringIdx];
    const ringDirection = ringIdx % 2 === 0 ? 1 : -1;
    const keplerOmega = (0.28 / Math.pow(ringRatio + 0.3, 1.5)) * ringDirection;
    const ringAngle = p.phaseOffset + simTimeSec * keplerOmega;

    const ringX = centerX + Math.cos(ringAngle) * (width * 0.42 * ringRatio);
    const ringY = centerY + Math.sin(ringAngle) * (height * 0.36 * ringRatio);

    // 3. Скульптурная SDF-оболочка двух полушарий с рельефными бороздами (гирусами и сулькусами)
    const localNormX = Math.abs(p.homeNormX) / 0.45;
    const localNormY = p.homeNormY / 0.42;
    const lobeAngle = Math.atan2(localNormY, localNormX);
    const radialShell = Math.min(1.0, Math.hypot(localNormX, localNormY));

    const ridgedSulci =
        1.0 +
        0.085 * Math.sin(lobeAngle * 4.0 + p.clusterId) -
        0.055 * Math.abs(Math.cos(lobeAngle * 7.0 - simTimeSec * 0.45));

    const hemisphereCenterX = centerX + hemisphereSign * (width * 0.19);
    const hemisphereRx = width * 0.235 * radialShell * ridgedSulci;
    const hemisphereRy = height * 0.375 * radialShell * ridgedSulci;

    const corticalFlow = simTimeSec * 0.12 * ringDirection;
    const shellX =
        hemisphereCenterX + Math.cos(lobeAngle + corticalFlow) * hemisphereRx * hemisphereSign;
    const shellY = centerY + Math.sin(lobeAngle + corticalFlow) * hemisphereRy;

    // Узлы колец служат опорным каркасом, а кортикальные узлы формируют объём полушарий вокруг них
    const isRingSkeletonNode = p.id % 3 === 0;
    const skeletonWeight = isRingSkeletonNode ? 0.58 : 0.18;

    const x = shellX * (1.0 - skeletonWeight) + ringX * skeletonWeight;
    const y = shellY * (1.0 - skeletonWeight) + ringY * skeletonWeight;

    const thoughtWave =
        0.5 +
        0.5 *
        Math.sin(
            simTimeSec * 2.4 - ((x - centerX) / Math.max(1, width)) * 6.2 - phaseProgress * Math.PI
        );

    const energy = Math.min(1.0, 0.38 + thoughtWave * 0.56);
    return { x, y, energy };
}