// ============================================================================
// ФАЙЛ: frontend/src/phases/02_genesis.ts
// НАЗНАЧЕНИЕ: Образ 02 — «ВЕЛИКАЯ ЧЕТЫРЕХРУКАВНАЯ СПИРАЛЬНАЯ ГАЛАКТИКА (GENESIS)»
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Формирует 4 изогнутых спиральных рукава галактики на 90% ширины и высоты экрана.
// 2. Создает два вращающихся солнечных ядра в центре и плазменный мост между ними.
// 3. Строго центрирует галактику относительно (centerX, centerY).
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
    const unfold = Math.min(1.0, 0.38 + phaseProgress * 0.72);
    const rotSpeed = simTimeSec * 0.36;

    // 12% частиц образуют пылающий бинарный мост между двумя ядрами в центре галактики
    if (p.id % 8 === 0) {
        const coreSepX = width * 0.16 * unfold;
        const coreSepY = height * 0.10 * unfold;
        const c1x = centerX + Math.cos(rotSpeed) * coreSepX;
        const c1y = centerY + Math.sin(rotSpeed) * coreSepY;
        const c2x = centerX - Math.cos(rotSpeed) * coreSepX;
        const c2y = centerY - Math.sin(rotSpeed) * coreSepY;

        const t = (p.id % 23) / 22;
        const sCurve = Math.sin(t * Math.PI * 2 + simTimeSec * 1.5) * 28;
        return {
            x: c1x + (c2x - c1x) * t,
            y: c1y + (c2y - c1y) * t + sCurve,
            energy: 0.92,
        };
    }

    // Четыре величественных спиральных рукава галактики во весь экран 16:9
    const armIndex = p.id % 4;
    const armBaseAngle = (armIndex * Math.PI) / 2;
    const radialFraction = 0.08 + ((p.id % 32) / 31) * 0.88;

    // Закрутка логарифмической спирали + естественная ширина рукава
    const spiralTwist = radialFraction * 2.85 - rotSpeed;
    const armThickness = (Math.sin(p.phaseOffset * 3.0 + simTimeSec) * 0.14) * (1.1 - radialFraction * 0.4);
    const totalAngle = armBaseAngle + spiralTwist + armThickness;

    const rx = width * 0.45 * radialFraction * unfold;
    const ry = height * 0.39 * radialFraction * unfold;

    // Кинематографический 3D-наклон галактической плоскости
    const rawX = Math.cos(totalAngle) * rx;
    const rawY = Math.sin(totalAngle) * ry;
    const tiltAngle = -0.16;

    const x = centerX + rawX * Math.cos(tiltAngle) - rawY * Math.sin(tiltAngle);
    const y = centerY + rawX * Math.sin(tiltAngle) + rawY * Math.cos(tiltAngle);

    const energy = Math.min(1.0, 0.42 + (1.0 - radialFraction * 0.55) * 0.55);
    return { x, y, energy };
}