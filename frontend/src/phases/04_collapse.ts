// ============================================================================
// ФАЙЛ: frontend/src/phases/04_collapse.ts
// НАЗНАЧЕНИЕ: Образ 04 — «ТЕКТОНИЧЕСКИЙ ШТОРМ СОЗНАНИЯ И РАЗРЫВ ВРЕМЕНИ (BREACH)»
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Строго удерживает композицию в центре экрана (centerX, centerY) без ухода вверх.
// 2. Формирует 3 пересекающихся гироскопических кольца напряжения вокруг коры мозга.
// 3. Создает упругие волны деформации пространства, вскрывающие матрицу X-RAY.
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
    // 3 пересекающихся гироскопических кольца шторма под углами -28°, 0° и +28° строго вокруг центра экрана
    const ringGroup = p.id % 3;
    const tiltAngles = [-0.48, 0.0, 0.48];
    const tilt = tiltAngles[ringGroup];
    const spinDir = ringGroup === 1 ? -1 : 1;

    const baseAngle =
        ((p.id * 1.6180339) % (Math.PI * 2)) + simTimeSec * (0.52 + ringGroup * 0.12) * spinDir;

    // Тектоническая волна деформации вдоль колец
    const stormHarmonic =
        Math.sin(baseAngle * 3.0 - simTimeSec * 3.2 + ringGroup) * 0.12 +
        Math.cos(baseAngle * 5.0 + simTimeSec * 2.4) * 0.06;

    const bandScale = 0.35 + ((p.id % 15) / 14) * 0.62;
    const rx = width * 0.43 * bandScale * (1.0 + stormHarmonic);
    const ry = height * (ringGroup === 1 ? 0.38 : 0.24) * bandScale * (1.0 + stormHarmonic);

    const localX = Math.cos(baseAngle) * rx;
    const localY = Math.sin(baseAngle) * ry;

    // Поворот гироскопической плоскости строго вокруг центра монитора (centerX, centerY)
    const x = centerX + localX * Math.cos(tilt) - localY * Math.sin(tilt);
    const y = centerY + localX * Math.sin(tilt) + localY * Math.cos(tilt);

    const pulsePeak = 0.5 + 0.5 * Math.sin(baseAngle * 3.0 - simTimeSec * 4.5 + phaseProgress * 6.0);
    const energy = Math.min(1.0, 0.45 + pulsePeak * 0.55);
    return { x, y, energy };
}