// ============================================================================
// ФАЙЛ: frontend/src/phases/04_collapse.ts
// НАЗНАЧЕНИЕ: Астрофизическая модель Фазы 04 — «КОЛЛАПС (ENTROPIC COLLAPSE)»
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Генерирует блуждающие гравитационные разломы (аномалии), рвущие орбиты.
// 2. Создает турбулентные сдвиги и резкие скачки ускорения частиц.
// 3. Раскачивает 3D-глубину пространства, имитируя деформацию метрики времени.
// 4. Повышает кинетическую энергию узлов перед финальным схлопыванием.
// ============================================================================

import type { QuantumParticle } from './01_void';

// ----------------------------------------------------------------------------
// 1. РАСЧЕТ ТУРБУЛЕНТНОСТИ И ГРАВИТАЦИОННЫХ РАЗЛОМОВ ФАЗЫ 04
// ----------------------------------------------------------------------------
export function applyCollapsePhysics(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    dt: number,
    simTimeSec: number,
    effectiveGravity: number
): void {
    const dx = centerX - p.x;
    const dy = centerY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1.0;

    // 1. Координаты трех нестабильных вихревых аномалий вокруг центра
    const anomalyIndex = p.id % 3;
    const anomalyAngle = simTimeSec * 2.1 + (anomalyIndex * Math.PI * 2) / 3;
    const anomalyRadius = 210 + Math.sin(simTimeSec * 4.5 + anomalyIndex) * 85;

    const anomalyX = centerX + Math.cos(anomalyAngle) * anomalyRadius;
    const anomalyY = centerY + Math.sin(anomalyAngle) * anomalyRadius;

    const adx = anomalyX - p.x;
    const ady = anomalyY - p.y;
    const aDist = Math.sqrt(adx * adx + ady * ady) + 5.0;

    // 2. Чередование фаз сжатия и резкого гравитационного выброса (пульсар-нестабильность)
    const collapsePulse = Math.sin(simTimeSec * 5.2 + p.phaseOffset * 0.5);
    const centralPull = collapsePulse * 85 * effectiveGravity;

    // Сила затягивания в локальную воронку разлома
    const vortexForce = (120 * effectiveGravity) / Math.max(30, aDist * 0.45);
    const vortexTangentX = -ady / aDist;
    const vortexTangentY = adx / aDist;

    p.vx += ((dx / dist) * centralPull + (adx / aDist) * vortexForce + vortexTangentX * 65) * dt;
    p.vy += ((dy / dist) * centralPull + (ady / aDist) * vortexForce + vortexTangentY * 65) * dt;

    // 3. Экстремальное возбуждение энергии и дрожание глубины Z
    p.energy = 0.65 + 0.35 * Math.abs(Math.cos(simTimeSec * 8.0 + p.id));
    p.depthZ = 0.3 + 1.1 * Math.abs(Math.sin(simTimeSec * 3.5 + p.phaseOffset));
}