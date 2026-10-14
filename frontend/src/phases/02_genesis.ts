// ============================================================================
// ФАЙЛ: frontend/src/phases/02_genesis.ts
// НАЗНАЧЕНИЕ: Астрофизическая модель Фазы 02 — «ГЕНЕЗИС (IGNITION GENESIS)»
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Формирует два вращающихся протогалактических центра масс (бинарное ядро).
// 2. Закручивает частицы в два логарифмических спиральных рукава туманности.
// 3. Генерирует вспышки первичного термоядерного зажигания звезд (Ignition Flares).
// 4. Вычисляет 3D-координату глубины (depthZ) для создания объемного параллакса.
// ============================================================================

import type { QuantumParticle } from './01_void';

// ----------------------------------------------------------------------------
// 1. ПАРАМЕТРЫ СПИРАЛЬНОЙ ПРОТОГАЛАКТИКИ ГЕНЕЗИСА
// ----------------------------------------------------------------------------
const SPIRAL_ARM_COUNT = 2;          // Количество главных спиральных рукавов
const SPIRAL_TIGHTNESS = 0.012;      // Коэффициент закрутки логарифмической спирали
const BINARY_CORE_SEPARATION = 140;  // Расстояние между двумя проходящими ядрами (в пикселях)

// ----------------------------------------------------------------------------
// 2. РАСЧЕТ ВЕКТОРОВ СИЛ ФАЗЫ 02 ДЛЯ КАЖДОЙ ЧАСТИЦЫ
// ----------------------------------------------------------------------------
export function applyGenesisPhysics(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    dt: number,
    simTimeSec: number,
    effectiveGravity: number
): void {
    // 1. Вычисляем координаты двух вращающихся центров масс (бинарная система)
    const coreAngle = simTimeSec * 0.65;
    const coreOffsetX = Math.cos(coreAngle) * BINARY_CORE_SEPARATION;
    const coreOffsetY = Math.sin(coreAngle) * BINARY_CORE_SEPARATION;

    // Четные частицы тяготеют к первому рукаву/ядру, нечетные — ко второму
    const targetCoreX = p.id % SPIRAL_ARM_COUNT === 0 ? centerX + coreOffsetX : centerX - coreOffsetX;
    const targetCoreY = p.id % SPIRAL_ARM_COUNT === 0 ? centerY + coreOffsetY : centerY - coreOffsetY;

    const dx = targetCoreX - p.x;
    const dy = targetCoreY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1.0;

    // Нормализованные векторы: радиальный (к ядру) и тангенциальный (по касательной)
    const radialX = dx / dist;
    const radialY = dy / dist;
    const tangentX = -radialY * p.quantumSpin;
    const tangentY = radialX * p.quantumSpin;

    // 2. Формирование спиральных рукавов за счет фазового притяжения
    const currentAngle = Math.atan2(p.y - centerY, p.x - centerX);
    const idealSpiralAngle = dist * SPIRAL_TIGHTNESS - simTimeSec * 0.8 + (p.id % SPIRAL_ARM_COUNT) * Math.PI;
    const spiralForce = Math.sin(idealSpiralAngle - currentAngle) * 48 * effectiveGravity;

    // 3. Суммируем гравитационный захват, вихревой момент и спиральное сжатие
    const pullStrength = 38 * effectiveGravity;
    const swirlStrength = (55 + spiralForce) * effectiveGravity;

    p.vx += (radialX * pullStrength + tangentX * swirlStrength) * dt;
    p.vy += (radialY * pullStrength + tangentY * swirlStrength) * dt;

    // 4. Модуляция энергии и 3D-глубины (вблизи ядер частицы вспыхивают ярче и ближе к зрителю)
    const coreProximity = Math.max(0, 1.0 - dist / 450);
    p.energy = Math.min(1.0, 0.35 + coreProximity * 0.65);
    p.depthZ = 0.5 + coreProximity * 0.9 + 0.2 * Math.sin(simTimeSec + p.phaseOffset);
}