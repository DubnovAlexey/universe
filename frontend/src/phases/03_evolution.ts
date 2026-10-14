// ============================================================================
// ФАЙЛ: frontend/src/phases/03_evolution.ts
// НАЗНАЧЕНИЕ: Образ 03 — «ЖИВОЙ КОСМИЧЕСКИЙ МОЗГ И СИНАПТИЧЕСКАЯ СЕТЬ (NEXUS)»
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Выстраивает строго по центру экрана узнаваемую 3D-архитектуру Головного Мозга:
//    левое и правое полушария с рельефными извилинами (гирусами), центральную
//    межполушарную борозду и светящийся мост мозолистого тела (Corpus Callosum).
// 2. Пропускает через кору головного мозга видимые волны когнитивного возбуждения.
// ============================================================================

import type { MorphTargetPoint, QuantumParticle } from './01_void';

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
    const isCallosumBridge = p.id % 10 === 0;

    // Угол и радиус внутри соответствующего полушария мозга
    const localNormX = Math.abs(p.homeNormX) / 0.45;
    const localNormY = p.homeNormY / 0.42;
    const lobeAngle = Math.atan2(localNormY, localNormX);
    const radialShell = Math.min(1.0, Math.hypot(localNormX, localNormY));

    // Органическая скульптура извилин коры головного мозга (гармоники извилин)
    const gyriContour =
        1.0 +
        0.09 * Math.sin(lobeAngle * 4.0 + p.clusterId) +
        0.06 * Math.cos(lobeAngle * 7.0 - simTimeSec * 0.5);

    const breathing = 1.0 + Math.sin(simTimeSec * 1.1 + p.clusterId * 0.5) * 0.025;

    let x = centerX;
    let y = centerY;

    if (isCallosumBridge) {
        // Центральный межполушарный мост (Corpus Callosum) и таламус, связывающие оба полушария
        const bridgeT = ((p.id % 21) / 20) * 2.0 - 1.0; // -1 .. +1
        const archY = -Math.cos(bridgeT * Math.PI * 0.5) * (height * 0.11);
        x = centerX + bridgeT * (width * 0.14);
        y = centerY + archY + Math.sin(simTimeSec * 1.6 + p.id) * 10;
    } else {
        // Левое и правое полушария мозга на 86% ширины и 82% высоты экрана
        const hemisphereCenterX = centerX + hemisphereSign * (width * 0.19);
        const hemisphereRadiusX = width * 0.23 * radialShell * gyriContour * breathing;
        const hemisphereRadiusY = height * 0.37 * radialShell * gyriContour * breathing;

        // Извилистый поток нейронов вдоль кортикальных складок
        const corticalDrift = simTimeSec * 0.14 * (p.id % 2 === 0 ? 1 : -1);
        x = hemisphereCenterX + Math.cos(lobeAngle + corticalDrift) * hemisphereRadiusX * hemisphereSign;
        y = centerY + Math.sin(lobeAngle + corticalDrift) * hemisphereRadiusY;
    }

    // Бегущая по полушариям волна мысли
    const thoughtWave =
        0.5 +
        0.5 *
        Math.sin(
            simTimeSec * 2.6 - ((x - centerX) / Math.max(1, width)) * 6.5 - phaseProgress * Math.PI
        );

    const energy = Math.min(1.0, 0.38 + thoughtWave * 0.58);
    return { x, y, energy };
}