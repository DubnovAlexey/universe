// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/02_genesis.ts
// НАЗНАЧЕНИЕ: MASTER 02 v2.0 — Галактика N-тел, 4 логарифмических рукава и Курамото (17–39 с)
// ЗАДАЧИ ФАЙЛА:
// 1. Закручивать дуги VOID в 4 логарифмических спиральных рукава r(θ) = a·exp(b·θ)
//    с углом закрутки pitch angle φ = atan(b) ≈ 18° на весь экран 16:9.
// 2. Вращать два массивных барицентра (Tier A) и строить между ними приливный световой мост.
// 3. На 32–39 с проводить волну фазовой синхронизации Курамото и формировать тройные узлы.
// ============================================================================

import type { MorphTargetPoint, QuantumParticle } from './01_void';

export function computeGenesisTarget(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    simTimeSec: number,
    phaseProgress: number
): MorphTargetPoint {
    const unfold = Math.min(1.0, 0.42 + phaseProgress * 0.65);
    const rotSpeed = simTimeSec * 0.34;

    // 1. Приливный световой мост между двумя массивными центрами Tier A (будущее мозолистое тело NEXUS)
    if (p.id % 8 === 0) {
        const coreSepX = width * 0.17 * unfold;
        const coreSepY = height * 0.105 * unfold;
        const c1x = centerX + Math.cos(rotSpeed) * coreSepX;
        const c1y = centerY + Math.sin(rotSpeed) * coreSepY;
        const c2x = centerX - Math.cos(rotSpeed) * coreSepX * 1.05;
        const c2y = centerY - Math.sin(rotSpeed) * coreSepY * 1.05;

        const t = (p.id % 23) / 22;
        const tidalLagrangeCurve = Math.sin(t * Math.PI * 2 + simTimeSec * 1.4) * 26;
        return {
            x: c1x + (c2x - c1x) * t,
            y: c1y + (c2y - c1y) * t + tidalLagrangeCurve,
            energy: 0.92,
        };
    }

    // 2. Четыре логарифмических спиральных рукава r(θ) = a · exp(b · θ), pitch angle φ ≈ 18° (b ≈ 0.325)
    const armIndex = p.id % 4;
    const armBaseAngle = (armIndex * Math.PI) / 2;
    const radialIndex = (p.id % 36) / 35;

    const pitchB = 0.325;
    const theta = radialIndex * 2.95;
    const logSpiralRadiusFrac = Math.min(1.0, 0.08 + 0.34 * Math.exp(pitchB * theta) - 0.32);

    // Асимметрия плотности между главными и вторичными рукавами
    const armSpread =
        Math.sin(p.phaseOffset * 3.0 + simTimeSec * 0.8) *
        (armIndex % 2 === 0 ? 0.11 : 0.16) *
        (1.1 - logSpiralRadiusFrac * 0.35);

    const totalAngle = armBaseAngle + theta - rotSpeed + armSpread;

    // 3. Волна синхронизации Курамото на 32–39 с (phaseProgress > 0.68):
    // часть звёзд организуется в компактные стабильные трёхчастные узлы (tripleGroupId)
    const syncWaveEnvelope = Math.max(0, Math.min(1, (phaseProgress - 0.65) / 0.35));
    const tripleSubIndex = p.id % 3;
    const tripleOffsetAngle = (tripleSubIndex * Math.PI * 2) / 3 + p.kuramotoPhase;
    const tripleTightening = syncWaveEnvelope * 9.5;

    const rx = width * 0.45 * logSpiralRadiusFrac * unfold;
    const ry = height * 0.39 * logSpiralRadiusFrac * unfold;

    const rawX = Math.cos(totalAngle) * rx + Math.cos(tripleOffsetAngle) * tripleTightening;
    const rawY = Math.sin(totalAngle) * ry + Math.sin(tripleOffsetAngle) * tripleTightening;

    // Перспективный 3D-наклон галактического диска
    const tiltAngle = -0.17;
    const x = centerX + rawX * Math.cos(tiltAngle) - rawY * Math.sin(tiltAngle);
    const y = centerY + rawX * Math.sin(tiltAngle) + rawY * Math.cos(tiltAngle);

    const kuramotoGlow = syncWaveEnvelope * (0.5 + 0.5 * Math.cos(p.kuramotoPhase - theta));
    const energy = Math.min(1.0, 0.40 + (1.0 - logSpiralRadiusFrac * 0.5) * 0.45 + kuramotoGlow * 0.25);

    return { x, y, energy };
}