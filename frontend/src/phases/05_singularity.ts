// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/05_singularity.ts
// НАЗНАЧЕНИЕ: MASTER 05 v2.4 — Рождение из Точки Нуля, кеплеровская аккреция,
//             линзирование и тягучее спиральное схлопывание LOGIC (79–108 с)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Акт A (ACT_A_ACCRETION, 79.0–87.5 с): плавное развёртывание аккреционного
//    диска и релятивистских джетов строго из микроскопической Точки Нуля
//    по огибающей smootherstep(0.0, 0.44, actProgress) синхронно с ростом
//    тени Чёрной дыры в renderer.ts; закон Кеплера Ω ∝ r^(-3/2) и допплер.
// 2. Акт B (ACT_B_LOGIC, 87.5–93.0 с): выравнивание трёх оптик в решётку LOGIC
//    и более медленное, тягучее спиральное схлопывание (с actProgress = 0.36
//    до 1.0) с сохранением момента импульса L = m*v*r строго к 93.0 с.
// 3. Акт C (2.5 с живой тишины) и Акт D (Одометр): удержание частиц в Нуле.
// ============================================================================

import type { MorphTargetPoint, QuantumParticle } from './01_void';
import { smootherstep, universeStore } from '../store/universeState';

export function computeSingularityTarget(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    simTimeSec: number
): MorphTargetPoint {
    const uState = universeStore.getState();
    const act = uState.singularityAct;
    const actProgress = uState.singularityActProgress;

    // 1. АКТ A (79.0–87.5 с): Плавное рождение диска и джетов из Точки Нуля
    if (act === 'ACT_A_ACCRETION' || act === 'NONE' || act === 'INACTIVE') {
        const unfoldFromZero = 0.02 + 0.98 * smootherstep(0.0, 0.44, actProgress);

        // Два узких полярных джета со светлым ядром и лёгкой прецессией
        if (p.id % 14 === 0) {
            const jetSign = p.id % 28 === 0 ? -1 : 1;
            const jetFlow = (simTimeSec * 1.45 + (p.id % 11) / 11) % 1.0;
            const precessionAngle = Math.sin(simTimeSec * 0.9) * 0.045;
            const jetDist =
                (18 + jetFlow * (height * 0.44)) * unfoldFromZero * jetSign;
            const isCoreJet = p.id % 28 === 0;
            const spread =
                (isCoreJet ? 3 : 16) *
                (0.3 + jetFlow) *
                unfoldFromZero *
                Math.sin(p.id * 2.3 + simTimeSec * 5.5);

            const x = centerX + spread - jetDist * Math.sin(precessionAngle);
            const y = centerY + jetDist * Math.cos(precessionAngle);
            return {
                x,
                y,
                energy:
                    Math.max(0.25, (isCoreJet ? 1.0 : 0.72) - jetFlow * 0.35) *
                    unfoldFromZero,
            };
        }

        const radialFraction = 0.08 + ((p.id % 24) / 23) * 0.86;
        // Кеплеровская угловая скорость Ω ∝ r^(-3/2)
        const keplerOmega = 0.42 / Math.pow(radialFraction + 0.18, 1.5);
        const spinAngle = p.id * 2.39996 + simTimeSec * keplerOmega;

        const diskRx = width * (0.06 + radialFraction * 0.39) * unfoldFromZero;
        const isLensedPhotonArch = p.id % 5 === 0;
        const impactParamB = Math.max(0.12, radialFraction);
        const einsteinDeflection = 0.045 / impactParamB;

        const diskRy =
            (isLensedPhotonArch
                ? height * (0.08 + radialFraction * 0.25 + einsteinDeflection)
                : height * (0.028 + radialFraction * 0.125)) * unfoldFromZero;

        const tilt = -0.14;
        const lx = Math.cos(spinAngle) * diskRx;
        const ly = Math.sin(spinAngle) * diskRy;

        // Релятивистское допплеровское усиление набегающего левого крыла диска
        const dopplerFactor = -Math.cos(spinAngle) * 0.28;
        const innerHeat = (1.0 - radialFraction) * 0.45;
        const energy = Math.max(
            0.18,
            Math.min(1.0, (0.52 + innerHeat + dopplerFactor) * unfoldFromZero)
        );

        return {
            x: centerX + lx * Math.cos(tilt) - ly * Math.sin(tilt),
            y: centerY + lx * Math.sin(tilt) + ly * Math.cos(tilt),
            energy,
            dopplerBoost: dopplerFactor,
        };
    }

    // 2. АКТ B (87.5–93.0 с): Кристаллическая решётка LOGIC и тягучее сжатие в Точку Нуля
    if (act === 'ACT_B_LOGIC') {
        const collapseWindow =
            actProgress < 0.36 ? 0.0 : (actProgress - 0.36) / 0.64;
        const smoothCollapse = smootherstep(0.0, 1.0, collapseWindow);
        const radiusEnvelope = Math.pow(1.0 - smoothCollapse, 1.75);

        const spokeIndex = p.id % 12;
        const ringTier = (Math.floor(p.id / 12) % 8) / 7;

        // Сохранение момента импульса L = m*v*r = const при уменьшении радиуса
        const angularMomentumSpin =
            (1.0 - radiusEnvelope) * (3.2 + (1.0 - ringTier) * 2.1);
        const baseAngle =
            (spokeIndex / 12) * Math.PI * 2 +
            ringTier * 0.35 +
            simTimeSec * 0.24 +
            angularMomentumSpin;

        const rx = width * (0.05 + ringTier * 0.39) * radiusEnvelope;
        const ry = height * (0.05 + ringTier * 0.37) * radiusEnvelope;

        return {
            x: centerX + Math.cos(baseAngle) * rx,
            y: centerY + Math.sin(baseAngle) * ry,
            energy: Math.max(0.02, radiusEnvelope * 0.95),
        };
    }

    // 3. АКТ C (2.5 с живой тишины) и АКТ D (Одометр): частицы покоятся в Точке Нуля
    return {
        x: centerX,
        y: centerY,
        energy: 0.0,
    };
}