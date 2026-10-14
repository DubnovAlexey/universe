// ============================================================================
// ФАЙЛ: frontend/src/phases/05_singularity.ts
// НАЗНАЧЕНИЕ: Астрофизическая модель Фазы 05 — «СИНГУЛЯРНОСТЬ (ABSOLUTE SINGULARITY)»
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Формирует Горизонт событий сверхмассивной черной дыры в центре экрана.
// 2. Разгоняет материю в раскаленном аккреционном диске до релятивистских скоростей.
// 3. Выбрасывает частицы, достигшие критического сжатия, в вертикальные джеты (квазар).
// 4. Сводит мир Иллюзии и мир Истины в единую математическую точку бесконечной плотности.
// ============================================================================

import type { QuantumParticle } from './01_void';

// ----------------------------------------------------------------------------
// 1. ПАРАМЕТРЫ ГОРИЗОНТА СОБЫТИЙ И РЕЛЯТИВИСТСКИХ ДЖЕТОВ
// ----------------------------------------------------------------------------
const EVENT_HORIZON_RADIUS = 38; // Радиус Шварцшильда (горизонт событий в пикселях)
const ACCRETION_DISK_RADIUS = 240;

// ----------------------------------------------------------------------------
// 2. РАСЧЕТ ГРАВИТАЦИОННОГО КОЛЛАПСА И АККРЕЦИИ ФАЗЫ 05
// ----------------------------------------------------------------------------
export function applySingularityPhysics(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    dt: number,
    simTimeSec: number,
    effectiveGravity: number
): void {
    const dx = centerX - p.x;
    const dy = centerY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.5;

    // 1. Если частица пересекла Горизонт событий — выбрасываем её в полярный джет квазара!
    if (dist < EVENT_HORIZON_RADIUS) {
        const jetDirection = p.id % 2 === 0 ? -1 : 1; // Верхний или нижний релятивистский луч
        const spread = (Math.random() - 0.5) * 35;

        p.x = centerX + spread * 0.3;
        p.y = centerY + jetDirection * (EVENT_HORIZON_RADIUS + 4);
        p.vx = spread * 2.2;
        p.vy = jetDirection * (240 + Math.random() * 180);
        p.energy = 1.0;
        p.depthZ = 1.45;
        return;
    }

    // 2. Неумолимое гравитационное притяжение к сингулярности + вращение аккреционного диска
    const radialX = dx / dist;
    const radialY = dy / dist;
    const tangentX = -radialY;
    const tangentY = radialX;

    // Сила тяготения растет обратно пропорционально расстоянию до горизонта событий
    const gravityPull = (290 * effectiveGravity) / Math.max(18, dist * 0.22);
    // Внутри аккреционного диска вращение достигает максимума
    const diskSpin = dist < ACCRETION_DISK_RADIUS ? 195 * effectiveGravity : 85 * effectiveGravity;

    // Сплющиваем траекторию к экваториальной плоскости (эффект диска Гаргантюа из Interstellar)
    const diskFlattenForce = (centerY - p.y) * 0.85 * effectiveGravity;

    p.vx += (radialX * gravityPull + tangentX * diskSpin) * dt;
    p.vy += (radialY * gravityPull + tangentY * diskSpin + diskFlattenForce) * dt;

    // 3. Максимальное свечение вблизи кольца фотонов
    const photonRingProximity = Math.max(0, 1.0 - Math.abs(dist - EVENT_HORIZON_RADIUS * 1.8) / 140);
    p.energy = Math.min(1.0, 0.55 + photonRingProximity * 0.45 + 0.1 * Math.sin(simTimeSec * 10));
    p.depthZ = 0.35 + photonRingProximity * 1.1;
}