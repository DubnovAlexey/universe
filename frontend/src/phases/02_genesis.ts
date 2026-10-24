// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/02_genesis.ts
// НАЗНАЧЕНИЕ: MASTER 02 v2.3 — Галактика N-тел, 4 непрерывных логарифмических рукава
//             и синхронизация Курамото (17–39 с) без дискретных колец.
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Плавный непрерывный закон спирали: замена дискретных индексов modulo на
//    детерминированный хэш (DeterministicPRNG.hashFloat), полностью убирающая
//    эффект «концентрических колец» и выстраивающая гладкие логарифмические
//    рукава r(θ) = a * exp(b * θ) с углом закрутки pitch angle φ ≈ 18°.
// 2. Двухцентровый барицентр (Tier A) и приливный световой мост между ними.
// 3. Волна фазовой синхронизации Курамото (на 32–39 с) и формирование стабильных
//    тройных узлов — будущих сом нейронов для фазы EVOLUTION.
// ============================================================================

import type { MorphTargetPoint, QuantumParticle } from './01_void';
import { DeterministicPRNG } from '../core/prng';

// --- НАЧАЛО ФУНКЦИИ computeGenesisTarget ---
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

    // 1. Приливный световой мост между двумя массивными центрами Tier A
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

    // 2. Непрерывные логарифмические рукава (устранен баг дискретных колец за счет хэша)
    const armIndex = p.id % 4;
    const armBaseAngle = (armIndex * Math.PI) / 2;

    // Детерминированный хэш вместо дискретного modulo, дающий непрерывное заполнение рукавов
    const radialRand = DeterministicPRNG.hashFloat(p.id + 104729, 31);
    const radialIndex = Math.pow(radialRand, 0.75);

    const pitchB = 0.325;
    const theta = radialIndex * 3.15;
    const logSpiralRadiusFrac = Math.min(1.0, 0.06 + 0.38 * Math.exp(pitchB * theta) - 0.28);

    const armSpread =
        Math.sin(p.phaseOffset * 3.0 + simTimeSec * 0.8) *
        (armIndex % 2 === 0 ? 0.12 : 0.18) *
        (1.1 - logSpiralRadiusFrac * 0.35);

    const totalAngle = armBaseAngle + theta - rotSpeed + armSpread;

    // 3. Волна синхронизации Курамото на 32–39 с (phaseProgress > 0.68)
    const syncWaveEnvelope = Math.max(0, Math.min(1, (phaseProgress - 0.65) / 0.35));
    const tripleSubIndex = p.id % 3;
    const tripleOffsetAngle = (tripleSubIndex * Math.PI * 2) / 3 + p.kuramotoPhase;
    const tripleTightening = syncWaveEnvelope * 9.5;

    const rx = width * 0.46 * logSpiralRadiusFrac * unfold;
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
// --- КОНЕЦ ФУНКЦИИ computeGenesisTarget ---
