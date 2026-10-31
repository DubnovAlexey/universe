// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/nodeCallout.ts
// НАЗНАЧЕНИЕ: Отрисовка бесконтурной инженерной выноски узла без собственного состояния.
// РАЗДЕЛЫ:
//   1. Кэш готовых подписей с тенью.
//   2. Выноска узла: идентификатор и ссылка на модуль.
// ФУНКЦИИ: getNodeCalloutLayout, getCalloutLabelSprite, renderBorderlessNodeCallout.
// ============================================================================
import type { QuantumParticle } from '../../phases/01_void';
import { getGlyphFontEpoch } from '../../core/glyphGrammar';
import { clamp } from '../math/noise2d';

// НАЧАЛО РАЗДЕЛА 1. КЭШ ГОТОВЫХ ПОДПИСЕЙ С ТЕНЬЮ
// Canvas не разрешает CSS var() в font: используется доступная часть общего mono-стека.
const LABEL_FONT = '10.5px "Universe Glyphs", Consolas, "Courier New", monospace';
const LABEL_SHADOW_BLUR = 8;
const LABEL_PAD = 10;
const LABEL_CACHE_LIMIT = 96;
interface CalloutLabelSprite {
    readonly canvas: HTMLCanvasElement;
    readonly width: number;
    readonly ascent: number;
    readonly descent: number;
}
const labelSprites = new Map<string, CalloutLabelSprite | null>();

// НАЧАЛО ФУНКЦИИ getCalloutLabelSprite
/**
 * Текст с размытой тенью растеризуется один раз и дальше рисуется как картинка.
 * fillText + shadowBlur в каждом кадре был самой дорогой функцией JS во время BREACH/X-RAY.
 */
function getCalloutLabelSprite(ctx: CanvasRenderingContext2D, label: string, scale: number,
    measure: () => TextMetrics): CalloutLabelSprite | null {
    if (typeof document === 'undefined' || typeof ctx.drawImage !== 'function') return null;
    const key = `${getGlyphFontEpoch()}:${scale.toFixed(3)}:${label}`;
    const cached = labelSprites.get(key);
    if (cached !== undefined) {
        // Повторное использование поднимает запись: вытесняются давно не нужные подписи.
        labelSprites.delete(key);
        labelSprites.set(key, cached);
        return cached;
    }
    let sprite: CalloutLabelSprite | null = null;
    try {
        const metrics = measure();
        const ascent = metrics.actualBoundingBoxAscent || 9;
        const descent = metrics.actualBoundingBoxDescent || 3;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.ceil((metrics.width + LABEL_PAD * 2) * scale));
        canvas.height = Math.max(1, Math.ceil((ascent + descent + LABEL_PAD * 2) * scale));
        const context = canvas.getContext('2d');
        if (context) {
            context.scale(scale, scale);
            context.font = LABEL_FONT;
            context.textAlign = 'left';
            context.textBaseline = 'alphabetic';
            context.fillStyle = '#f8fafc';
            context.shadowColor = 'rgba(2, 3, 8, 0.96)';
            // shadowBlur не масштабируется матрицей — то же значение, что у прежнего прямого fillText.
            context.shadowBlur = LABEL_SHADOW_BLUR;
            context.fillText(label, LABEL_PAD, LABEL_PAD + ascent);
            sprite = { canvas, width: metrics.width, ascent, descent };
        } else canvas.width = canvas.height = 0;
    } catch { sprite = null; }
    labelSprites.set(key, sprite);
    if (labelSprites.size > LABEL_CACHE_LIMIT) {
        const oldest = labelSprites.keys().next().value as string;
        const evicted = labelSprites.get(oldest);
        if (evicted) evicted.canvas.width = evicted.canvas.height = 0;
        labelSprites.delete(oldest);
    }
    return sprite;
}
// КОНЕЦ ФУНКЦИИ getCalloutLabelSprite
// КОНЕЦ РАЗДЕЛА 1

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

// НАЧАЛО РАЗДЕЛА 2. БЕСКОНТУРНАЯ ВЫНОСКА УЗЛА
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
    // Назначение ctx.font с веб-шрифтом «Universe Glyphs» стоит до ~0.5 мс: шрифт ставится
    // только для замера новой подписи и для запасного fillText, но не для готового спрайта.
    const useLabelFont = (): void => {
        ctx.font = LABEL_FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    };
    const label = `ID#${String(pt.id).padStart(3, '0')} [ref:${pt.moduleTag}]`;
    const transform = ctx.getTransform();
    // Backing store умножен на DPR; подпись и её координаты заданы в CSSpx.
    const scaleX = Math.max(0.001, Math.hypot(transform.a, transform.b));
    const scaleY = Math.max(0.001, Math.hypot(transform.c, transform.d));
    const sprite = getCalloutLabelSprite(ctx, label, Math.max(scaleX, scaleY), () => { useLabelFont(); return ctx.measureText(label); });
    if (!sprite) useLabelFont();
    const metrics = sprite
        ? { width: sprite.width, actualBoundingBoxAscent: sprite.ascent, actualBoundingBoxDescent: sprite.descent }
        : ctx.measureText(label);
    const layout = getNodeCalloutLayout(ctx.canvas.width / scaleX, ctx.canvas.height / scaleY,
        nx, ny, metrics.width, metrics.actualBoundingBoxAscent || 9,
        metrics.actualBoundingBoxDescent || 3, floatOffset);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.quadraticCurveTo(nx + 7 * layout.side, ny - 8 + floatOffset, layout.leaderX, layout.y - 3);
    ctx.stroke();

    if (sprite) {
        // Длинная подпись сжимается по ширине так же, как fillText с maxWidth.
        const squeeze = sprite.width > layout.maxWidth ? layout.maxWidth / sprite.width : 1;
        ctx.drawImage(sprite.canvas, layout.x - LABEL_PAD * squeeze, layout.y - sprite.ascent - LABEL_PAD,
            (sprite.width + LABEL_PAD * 2) * squeeze, sprite.ascent + sprite.descent + LABEL_PAD * 2);
    } else {
        ctx.fillStyle = '#f8fafc';
        ctx.shadowColor = 'rgba(2, 3, 8, 0.96)';
        ctx.shadowBlur = LABEL_SHADOW_BLUR;
        ctx.fillText(label, layout.x, layout.y, layout.maxWidth);
    }

    ctx.restore();
}
// --- КОНЕЦ ФУНКЦИИ renderBorderlessNodeCallout ---
// КОНЕЦ РАЗДЕЛА 2. БЕСКОНТУРНАЯ ВЫНОСКА УЗЛА
