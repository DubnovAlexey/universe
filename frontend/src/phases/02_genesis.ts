// ============================================================================
// ФАЙЛ: frontend/src/phases/02_genesis.ts
// НАЗНАЧЕНИЕ: Модель Фазы 02 — «ГЕНЕЗИС (IGNITION GENESIS)» по стандарту Bible v1.1
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Разворачивает пространство из Точки Нуля концентрическими волновыми фронтами.
// 2. Формирует два вращающихся центра масс с легкой природной асимметрией.
// 3. Закручивает материю в спиральные рукава разной плотности и строит световой мост между ядрами.
// 4. Модулирует светимость узлов для внутренней подсветки газовых туманностей.
// ============================================================================

import type { QuantumParticle } from './01_void';

// ----------------------------------------------------------------------------
// 1. КОНСТАНТЫ БИНАРНОГО ЯДРА, АСИММЕТРИИ РУКАВОВ И СВЕТОВОГО МОСТА
// ----------------------------------------------------------------------------
const SPIRAL_TIGHTNESS = 0.0115;
const MAX_BINARY_SEPARATION = 155;

// ----------------------------------------------------------------------------
// 2. РАСЧЕТ ФИЗИКИ РАЗВЕРТЫВАНИЯ ПРОСТРАНСТВА В ФАЗЕ 02 (GENESIS)
// ----------------------------------------------------------------------------
export function applyGenesisPhysics(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    dt: number,
    simTimeSec: number,
    effectiveGravity: number,
    phaseProgress = 0.5
): void {
    // 1. Плавное расхождение двух вращающихся центров масс из Точки Нуля
    const unfoldEnvelope = Math.min(1.0, phaseProgress * 1.65);
    const coreSeparation = MAX_BINARY_SEPARATION * unfoldEnvelope;
    const coreAngle = simTimeSec * 0.58;

    // Асимметрия: первое ядро массивнее и чуть ближе к центру, второе описывает более широкую дугу
    const core1X = centerX + Math.cos(coreAngle) * (coreSeparation * 0.85);
    const core1Y = centerY + Math.sin(coreAngle) * (coreSeparation * 0.85);
    const core2X = centerX - Math.cos(coreAngle + 0.18) * (coreSeparation * 1.15);
    const core2Y = centerY - Math.sin(coreAngle + 0.18) * (coreSeparation * 1.15);

    // 15% частиц формируют тонкий световой мост между двумя центрами масс
    const isBridgeParticle = p.id % 7 === 0;
    let targetX = p.id % 2 === 0 ? core1X : core2X;
    let targetY = p.id % 2 === 0 ? core1Y : core2Y;

    if (isBridgeParticle) {
        const bridgeT = (p.id % 19) / 18;
        targetX = core1X + (core2X - core1X) * bridgeT;
        targetY = core1Y + (core2Y - core1Y) * bridgeT;
    }

    const dx = targetX - p.x;
    const dy = targetY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1.0;

    const radialX = dx / dist;
    const radialY = dy / dist;
    const tangentX = -radialY * p.quantumSpin;
    const tangentY = radialX * p.quantumSpin;

    // 2. Концентрические фронты раскрытия пространства в начале GENESIS
    const distFromOrigin = Math.hypot(p.x - centerX, p.y - centerY) + 1.0;
    const waveFrontRadius = phaseProgress * 620;
    const distToFront = Math.abs(distFromOrigin - waveFrontRadius);
    const frontImpulse = distToFront < 75 ? (1.0 - distToFront / 75) * 34 * (1.0 - phaseProgress * 0.5) : 0;

    // 3. Асимметричное закручивание в логарифмические спиральные рукава
    const armOffset = p.id % 2 === 0 ? 0 : Math.PI * 1.08;
    const currentAngle = Math.atan2(p.y - centerY, p.x - centerX);
    const idealSpiralAngle = distFromOrigin * SPIRAL_TIGHTNESS - simTimeSec * 0.72 + armOffset;
    const spiralAlignment = Math.sin(idealSpiralAngle - currentAngle) * 44 * effectiveGravity;

    const pullStrength = (isBridgeParticle ? 54 : 34) * effectiveGravity;
    const swirlStrength = (48 + spiralAlignment) * effectiveGravity;

    p.vx += (radialX * (pullStrength - frontImpulse) + tangentX * swirlStrength) * dt;
    p.vy += (radialY * (pullStrength - frontImpulse) + tangentY * swirlStrength) * dt;

    // 4. Энергия узла: высокая вблизи двух ядер и светового моста, спокойнее на темной периферии
    const coreProximity = Math.max(0, 1.0 - dist / 380);
    p.energy = Math.min(
        1.0,
        (0.22 + coreProximity * 0.68 + (isBridgeParticle ? 0.18 : 0)) * Math.min(1.0, 0.35 + phaseProgress * 1.1)
    );
}