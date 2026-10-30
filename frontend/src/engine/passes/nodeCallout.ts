// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/nodeCallout.ts
// НАЗНАЧЕНИЕ: Отрисовка бесконтурной инженерной выноски узла без собственного состояния.
// РАЗДЕЛЫ:
//   1. Выноска узла: идентификатор и ссылка на модуль.
// ФУНКЦИИ: getNodeCalloutLayout, renderBorderlessNodeCallout.
// ============================================================================
import type { QuantumParticle } from '../../phases/01_void';
import { clamp } from '../math/noise2d';

export interface NodeCalloutLayout {
    readonly x: number;
    readonly y: number;
    readonly maxWidth: number;
    readonly side: -1 | 1;
    readonly leaderX: number;
}

// --- НАЧАЛО ФУНКЦИИ getNodeCalloutLayout ---
/** Выбирает свободную сторону узла и удерживает текст с ореолом в CSS-размере Canvas. */
export function getNodeCalloutLayout(width: number, height: number, nx: number, ny: number,
    textWidth: number, ascent: number, descent: number, floatOffset: number): NodeCalloutLayout {
    const margin = 10;
    const maxWidth = Math.max(1, Math.min(textWidth, width - margin * 2));
    const side: -1 | 1 = nx + 14 + maxWidth <= width - margin ? 1 : -1;
    const desiredX = side === 1 ? nx + 14 : nx - 14 - maxWidth;
    const x = clamp(desiredX, margin, Math.max(margin, width - margin - maxWidth));
    const minY = margin + ascent;
    const y = clamp(ny - 10 + floatOffset, minY, Math.max(minY, height - margin - descent));
    return { x, y, maxWidth, side, leaderX: side === 1 ? x - 3 : x + maxWidth + 3 };
}
// --- КОНЕЦ ФУНКЦИИ getNodeCalloutLayout ---

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
    if (alphaWeight < 0.05 || !Number.isFinite(nx + ny)) return;
    const floatOffset = Math.sin(simTimeSec * 2.1 + pt.id) * 2.2;

    ctx.save();
    ctx.globalAlpha = clamp(alphaWeight, 0, 0.95);
    // Canvas не разрешает CSS var() в font: используется доступная часть общего mono-стека.
    ctx.font = '10.5px "Universe Glyphs", Consolas, "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const label = `ID#${String(pt.id).padStart(3, '0')} [ref:${pt.moduleTag}]`;
    const metrics = ctx.measureText(label);
    const transform = ctx.getTransform();
    // Backing store умножен на DPR; подпись и её координаты заданы в CSSpx.
    const scaleX = Math.max(0.001, Math.hypot(transform.a, transform.b));
    const scaleY = Math.max(0.001, Math.hypot(transform.c, transform.d));
    const layout = getNodeCalloutLayout(ctx.canvas.width / scaleX, ctx.canvas.height / scaleY,
        nx, ny, metrics.width, metrics.actualBoundingBoxAscent || 9,
        metrics.actualBoundingBoxDescent || 3, floatOffset);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.quadraticCurveTo(nx + 7 * layout.side, ny - 8 + floatOffset, layout.leaderX, layout.y - 3);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = 'rgba(2, 3, 8, 0.96)';
    ctx.shadowBlur = 8;
    ctx.fillText(label, layout.x, layout.y, layout.maxWidth);

    ctx.restore();
}
// --- КОНЕЦ ФУНКЦИИ renderBorderlessNodeCallout ---
// КОНЕЦ РАЗДЕЛА 1. БЕСКОНТУРНАЯ ВЫНОСКА УЗЛА
