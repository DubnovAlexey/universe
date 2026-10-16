// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/04_collapse.ts
// НАЗНАЧЕНИЕ: MASTER 04 v2.0 — TENSION / BREACH: 3 аномалии и натяжение колец (61–79 с)
// ЗАДАЧИ ФАЙЛА:
// 1. Сохранять 5 встречных колец и полушария мозга в центре экрана как носители натяжения (D-3).
// 2. На 61–66 с по очереди проводить три разных жеста пространства:
//    - Аномалия 1 изгибает дальние филаменты (Z2/Z3);
//    - Аномалия 2 упруго натягивает аксонные магистрали (Z1);
//    - Аномалия 3 преломляет ближние звёзды (Z0/Z1).
// 3. Выстраивать часть дуг в будущую геометрию аккреционного диска SINGULARITY.
// ============================================================================

import type { MorphTargetPoint, QuantumParticle } from './01_void';

export function computeCollapseStormTarget(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    simTimeSec: number,
    phaseProgress: number
): MorphTargetPoint {
    // 1. Каркас из 5 наклонных колец и полушарий мозга (решение D-3: кольца — носители натяжения)
    const ringGroup = p.ringIndex % 5;
    const tiltAngles = [-0.46, -0.22, 0.0, 0.22, 0.46];
    const tilt = tiltAngles[ringGroup];
    const spinDir = ringGroup % 2 === 0 ? 1 : -1;

    const baseAngle =
        ((p.id * 1.6180339) % (Math.PI * 2)) + simTimeSec * (0.42 + ringGroup * 0.08) * spinDir;

    // 2. Три последовательные аномалии на 61–66 с (phaseProgress 0.00 .. 0.35):
    // у каждой есть приближение, пик и упругое затухание
    const env1 = Math.exp(-Math.pow((phaseProgress - 0.08) / 0.09, 2)); // Дальние филаменты
    const env2 = Math.exp(-Math.pow((phaseProgress - 0.19) / 0.10, 2)); // Аксонные магистрали
    const env3 = Math.exp(-Math.pow((phaseProgress - 0.31) / 0.10, 2)); // Ближние звёзды

    let anomalyDisplacement = 0;
    if (p.depthTier === 'BACKGROUND' || p.depthTier === 'DEEP_LAYER') {
        anomalyDisplacement = Math.sin(baseAngle * 2.0 - simTimeSec * 3.0) * 0.15 * env1;
    } else if (p.id % 3 === 0) {
        anomalyDisplacement = Math.cos(baseAngle * 3.0 + simTimeSec * 3.8) * 0.18 * env2;
    } else {
        anomalyDisplacement = Math.sin(baseAngle * 5.0 - simTimeSec * 4.5) * 0.14 * env3;
    }

    // Постоянная упругая волна натяжения в течение всей фазы TENSION / BREACH
    const persistentTension =
        Math.sin(baseAngle * 3.0 - simTimeSec * 2.8 + ringGroup) * 0.085 + anomalyDisplacement;

    const bandScale = 0.28 + ((p.id % 16) / 15) * 0.66;
    const rx = width * 0.43 * bandScale * (1.0 + persistentTension);
    const ry = height * (ringGroup === 2 ? 0.37 : 0.25) * bandScale * (1.0 + persistentTension);

    const localX = Math.cos(baseAngle) * rx;
    const localY = Math.sin(baseAngle) * ry;

    const x = centerX + localX * Math.cos(tilt) - localY * Math.sin(tilt);
    const y = centerY + localX * Math.sin(tilt) + localY * Math.cos(tilt);

    const stressPeak = Math.max(env1, env2, env3, 0.5 + 0.5 * Math.sin(baseAngle * 3.0 - simTimeSec * 4.0));
    const energy = Math.min(1.0, 0.44 + stressPeak * 0.54);

    return { x, y, energy };
}