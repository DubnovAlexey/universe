// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/05_singularity.ts
// НАЗНАЧЕНИЕ: MASTER 05 v2.0 — Кеплеровская аккреция, допплер, линзирование и LOGIC (79–108 с)
// ЗАДАЧИ ФАЙЛА:
// 1. В Акте A (79–86 с) вращать диск по закону Кеплера Ω ∝ r^(-3/2) с допплеровским
//    усилением яркости (приближающийся край ярче), гравитационным линзированием α ≈ 4GM/(c²b)
//    и двумя прецессирующими полярными джетами.
// 2. В Акте B (86–93 с) выравнивать три оптики в кристаллическую решётку LOGIC, а затем
//    по спирали с сохранением момента импульса полностью схлопывать систему в Точку Нуля
//    строго до начала отсчёта 2,5 секунд тишины (93.0 с).
// ============================================================================

import type { MorphTargetPoint, QuantumParticle } from './01_void';
import { universeStore } from '../store/universeState';

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

    // 1. АКТ A (79–86 с): Аккреционный диск с законом Кеплера Ω ∝ r^(-3/2), допплером и линзированием
    if (act === 'ACT_A_ACCRETION' || act === 'NONE') {
        // Два узких полярных джета со светлым ядром, разреженной оболочкой и лёгкой прецессией
        if (p.id % 14 === 0) {
            const jetSign = p.id % 28 === 0 ? -1 : 1;
            const jetFlow = (simTimeSec * 1.45 + (p.id % 11) / 11) % 1.0;
            const precessionAngle = Math.sin(simTimeSec * 0.9) * 0.045;
            const jetDist = (34 + jetFlow * (height * 0.44)) * jetSign;
            const isCoreJet = p.id % 28 === 0;
            const spread = (isCoreJet ? 3 : 16) * (0.3 + jetFlow) * Math.sin(p.id * 2.3 + simTimeSec * 5.5);

            const x = centerX + spread - jetDist * Math.sin(precessionAngle);
            const y = centerY + jetDist * Math.cos(precessionAngle);
            return {
                x,
                y,
                energy: Math.max(0.25, (isCoreJet ? 1.0 : 0.72) - jetFlow * 0.35),
            };
        }

        const radialFraction = 0.08 + ((p.id % 24) / 23) * 0.86;
        // Кеплеровская угловая скорость Ω ∝ r^(-3/2): внутренние слои вращаются значительно быстрее внешних
        const keplerOmega = 0.42 / Math.pow(radialFraction + 0.18, 1.5);
        const spinAngle = p.id * 2.39996 + simTimeSec * keplerOmega;

        const diskRx = width * (0.06 + radialFraction * 0.39);
        // Гравитационное линзирование α ≈ 4GM/(c²b): задняя часть диска огибает чёрную сферу сверху и снизу
        const isLensedPhotonArch = p.id % 5 === 0;
        const impactParamB = Math.max(0.12, radialFraction);
        const einsteinDeflection = 0.045 / impactParamB;

        const diskRy = isLensedPhotonArch
            ? height * (0.08 + radialFraction * 0.25 + einsteinDeflection)
            : height * (0.028 + radialFraction * 0.125);

        const tilt = -0.14;
        const lx = Math.cos(spinAngle) * diskRx;
        const ly = Math.sin(spinAngle) * diskRy;

        // Релятивистское допплеровское усиление: левое приближающееся крыло (cos(spinAngle) < 0) ярче удаляющегося
        const dopplerFactor = -Math.cos(spinAngle) * 0.28;
        const innerHeat = (1.0 - radialFraction) * 0.45;
        const energy = Math.max(0.18, Math.min(1.0, 0.52 + innerHeat + dopplerFactor));

        return {
            x: centerX + lx * Math.cos(tilt) - ly * Math.sin(tilt),
            y: centerY + lx * Math.sin(tilt) + ly * Math.cos(tilt),
            energy,
            dopplerBoost: dopplerFactor,
        };
    }

    // 2. АКТ B (86–93 с): Ясность LOGIC (0..0.55) -> Спиральное схлопывание в Точку Нуля строго до 93.0 с
    if (act === 'ACT_B_LOGIC') {
        const collapseWindow = actProgress < 0.55 ? 0.0 : (actProgress - 0.55) / 0.45;
        const clampedCollapse = Math.max(0, Math.min(1, collapseWindow));
        // В конце Акта B (clampedCollapse -> 1.0) радиус сходится строго в 0 до старта тишины!
        const radiusEnvelope = Math.pow(1.0 - clampedCollapse, 2.6);

        const spokeIndex = p.id % 12;
        const ringTier = (Math.floor(p.id / 12) % 8) / 7;

        // При уменьшении радиуса угловая скорость растёт (сохранение момента импульса L = m·v·r = const)
        const angularMomentumSpin = (1.0 - radiusEnvelope) * (3.8 + (1.0 - ringTier) * 2.4);
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

    // 3. АКТ C (2,5 с живой тишины) и АКТ D (Odometer / Карточка): частицы неподвижны в Точке Нуля (D-1)
    return {
        x: centerX,
        y: centerY,
        energy: 0.0,
    };
}