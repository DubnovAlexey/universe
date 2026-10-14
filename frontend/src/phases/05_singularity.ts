// ============================================================================
// ФАЙЛ: frontend/src/phases/05_singularity.ts
// НАЗНАЧЕНИЕ: Образ 05 — «ЧЕРНАЯ ДЫРА ГАРГАНТЮА -> МАНДАЛА LOGIC -> СХЛОПЫВАНИЕ В НОЛЬ»
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. В Акте A строит наклонный многослойный аккреционный диск Черной дыры и 2 полярных джета.
// 2. В первой половине Акта B (LOGIC) выстраивает кристаллическую геодезическую мандалу
//    слияния Космоса, Мозга и Кода во весь экран 16:9.
// 3. Во второй половине Акта B плавно стягивает всю панораму по спирали в Точку Нуля.
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

    // 1. АКТ A: Аккреционный диск Гаргантюа + гравитационная дуга линзирования + полярные джеты
    if (act === 'ACT_A_ACCRETION' || act === 'NONE') {
        // 8% узлов образуют 2 узких вертикальных релятивистских джета из полюсов черной дыры
        if (p.id % 14 === 0) {
            const jetSign = p.id % 28 === 0 ? -1 : 1;
            const jetFlow = ((simTimeSec * 1.4 + (p.id % 11) / 11) % 1.0);
            const jetDistY = (36 + jetFlow * (height * 0.44)) * jetSign;
            const jetWidth = (4 + jetFlow * 26) * Math.sin(p.id * 2.3 + simTimeSec * 6.0);
            return {
                x: centerX + jetWidth,
                y: centerY + jetDistY,
                energy: 1.0 - jetFlow * 0.35,
            };
        }

        const ringLayer = (p.id % 20) / 19;
        const spinAngle = (p.id * 2.39996) + simTimeSec * (1.8 - ringLayer * 0.9);
        const diskRx = width * (0.07 + ringLayer * 0.38);
        // Часть узлов огибает черную дыру сверху и снизу как гравитационно-линзированное гало Гаргантюа
        const isLensedHalo = p.id % 5 === 0;
        const diskRy = isLensedHalo
            ? height * (0.09 + ringLayer * 0.28)
            : height * (0.03 + ringLayer * 0.13);

        const tilt = -0.14;
        const lx = Math.cos(spinAngle) * diskRx;
        const ly = Math.sin(spinAngle) * diskRy;

        return {
            x: centerX + lx * Math.cos(tilt) - ly * Math.sin(tilt),
            y: centerY + lx * Math.sin(tilt) + ly * Math.cos(tilt),
            energy: Math.min(1.0, 0.55 + (1.0 - ringLayer) * 0.45),
        };
    }

    // 2. АКТ B: Кристаллическая гармония LOGIC (0..0.58) -> Спиральное схлопывание в Точку Нуля (0.58..1.0)
    if (act === 'ACT_B_LOGIC') {
        const collapseT = actProgress < 0.58 ? 0.0 : (actProgress - 0.58) / 0.42;
        const collapseEase = 1.0 - Math.pow(collapseT, 2.4);

        // 12-лучевая сакрально-геометрическая нейро-решетка LOGIC на весь экран
        const spokeIndex = p.id % 12;
        const ringTier = (Math.floor(p.id / 12) % 8) / 7;
        const baseAngle =
            (spokeIndex / 12) * Math.PI * 2 +
            ringTier * 0.35 +
            simTimeSec * 0.25 +
            (1.0 - collapseEase) * 4.2;

        const rx = width * (0.06 + ringTier * 0.39) * collapseEase;
        const ry = height * (0.06 + ringTier * 0.37) * collapseEase;

        return {
            x: centerX + Math.cos(baseAngle) * rx,
            y: centerY + Math.sin(baseAngle) * ry,
            energy: Math.max(0.05, collapseEase),
        };
    }

    // 3. АКТ C (ZERO_SILENCE) и АКТ D (GITHUB_CARD): Абсолютная Точка Нуля в центре
    return {
        x: centerX,
        y: centerY,
        energy: 0.0,
    };
}