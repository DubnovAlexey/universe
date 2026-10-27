// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/nodeCallout.ts
// НАЗНАЧЕНИЕ: Отрисовка бесконтурной инженерной выноски узла без собственного состояния.
// РАЗДЕЛЫ:
//   1. Выноска узла: идентификатор и ссылка на модуль.
// ФУНКЦИИ: renderBorderlessNodeCallout.
// ============================================================================
import type { QuantumParticle } from '../../phases/01_void';
import { clamp } from '../math/noise2d';

// НАЧАЛО РАЗДЕЛА 1. БЕСКОНТУРНАЯ ВЫНОСКА УЗЛА
// --- НАЧАЛО ФУНКЦИИ renderBorderlessNodeCallout ---
/**
 * Отрисовывает парящую инженерную выноску узла (ID + ссылка на модуль) без прямоугольной рамки.
 */
export function renderBorderlessNodeCallout(
    ctx: CanvasRenderingContext2D,
    nx: number,
    ny: number,
    pt: QuantumParticle,
    simTimeSec: number,
    alphaWeight: number
): void {
    if (alphaWeight < 0.05) return;
    const floatOffset = Math.sin(simTimeSec * 2.1 + pt.id) * 2.2;
    const labelX = nx + 14;
    const labelY = ny - 10 + floatOffset;

    ctx.save();
    ctx.globalAlpha = clamp(alphaWeight, 0, 0.95);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.quadraticCurveTo(nx + 7, ny - 8 + floatOffset, labelX - 3, labelY - 3);
    ctx.stroke();

    ctx.font = '10.5px "JetBrains Mono", "Fira Code", monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(2, 3, 8, 0.96)';
    ctx.shadowBlur = 8;
    ctx.fillText(
        `ID#${String(pt.id).padStart(3, '0')} [ref:${pt.moduleTag}]`,
        labelX,
        labelY
    );

    ctx.restore();
}
// --- КОНЕЦ ФУНКЦИИ renderBorderlessNodeCallout ---
// КОНЕЦ РАЗДЕЛА 1. БЕСКОНТУРНАЯ ВЫНОСКА УЗЛА
