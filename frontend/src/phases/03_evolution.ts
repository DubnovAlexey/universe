// ============================================================================
// ФАЙЛ: frontend/src/phases/03_evolution.ts
// НАЗНАЧЕНИЕ: Астрофизическая модель Фазы 03 — «ЭВОЛЮЦИЯ (HARMONIC EVOLUTION)»
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Распределяет материю по дискретным гармоническим орбитам (правило золотого сечения).
// 2. Поддерживает идеальный баланс центробежной силы и гравитации (законы Кеплера).
// 3. Создает эффект «небесной механики» с разнонаправленными кольцами вращения.
// 4. Стабилизирует скорость частиц для формирования четких созвездий в слое Топологии.
// ============================================================================

import type { QuantumParticle } from './01_void';

// ----------------------------------------------------------------------------
// 1. КОНСТАНТЫ ЗОЛОТОГО СЕЧЕНИЯ И ОРБИТАЛЬНЫХ КОЛЕЦ
// ----------------------------------------------------------------------------
const GOLDEN_RATIO = 1.61803398875;
const ORBITAL_SHELLS = [95, 165, 255, 360, 480]; // Радиусы 5 устойчивых орбитальных колец (в пикселях)

// ----------------------------------------------------------------------------
// 2. РАСЧЕТ ГАРМОНИЧЕСКИХ ОРБИТ ФАЗЫ 03
// ----------------------------------------------------------------------------
export function applyEvolutionPhysics(
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

    // 1. Определяем целевую орбитальную оболочку для конкретной частицы
    const shellIndex = p.id % ORBITAL_SHELLS.length;
    const baseShellRadius = ORBITAL_SHELLS[shellIndex];

    // Добавляем тонкую волну резонанса (орбиты слегка «дышат» как живые струны)
    const harmonicWave = Math.sin(simTimeSec * 1.2 + p.id * GOLDEN_RATIO) * 14;
    const targetRadius = baseShellRadius + harmonicWave;

    // 2. Вычисляем силу возврата частицы на её идеальную орбиту
    const radialError = dist - targetRadius;
    const radialDirX = dx / dist;
    const radialDirY = dy / dist;

    // Четные кольца вращаются по часовой стрелке, нечетные — против (эффект астролябии)
    const ringDirection = shellIndex % 2 === 0 ? 1 : -1;
    const tangentX = -radialDirY * ringDirection;
    const tangentY = radialDirX * ringDirection;

    // По третьему закону Кеплера внутренние орбиты движутся быстрее внешних
    const keplerSpeed = (82 / Math.sqrt( Math.max(60, targetRadius) / 100 )) * effectiveGravity;
    const springToOrbit = radialError * 2.4 * effectiveGravity;

    p.vx += (radialDirX * springToOrbit + tangentX * keplerSpeed) * dt;
    p.vy += (radialDirY * springToOrbit + tangentY * keplerSpeed) * dt;

    // 3. Плавная калибровка 3D-глубины по номеру орбитального кольца
    p.depthZ = 0.45 + (1.0 - shellIndex / ORBITAL_SHELLS.length) * 0.85;
    p.energy = 0.5 + 0.5 * Math.sin(simTimeSec * 2.0 + p.phaseOffset);
}