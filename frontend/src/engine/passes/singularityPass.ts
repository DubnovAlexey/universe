// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/singularityPass.ts
// НАЗНАЧЕНИЕ: Отрисовка короны сингулярности, Точки Нуля и начального Canvas-одометра.
// РАЗДЕЛЫ: 1. КОРОНА NGC 6543 И ЧЁРНАЯ ДЫРА; 2. МИКРО-ТОЧКА ИМПУЛЬСА В АКТЕ C; 3. CANVAS-ОДОМЕТР И ПЕРЕДАЧА ТЕКСТА DOM-ВИЗИТКЕ.
// ФУНКЦИИ: renderSingularityCoronaAndBlackHole, renderZeroSilenceActC, drawFittedCipherGlyph, drawOdometerCell,
//          releaseOdometerShadowLayer, acquireOdometerShadowLayer, renderCipherOdometerStage.
// Порядок вызовов и общий жизненный цикл кадра задаёт UniverseRenderer.
// ============================================================================

import { smootherstep, universeStore, type SingularityAct, type UniverseState } from '../../store/universeState';
import { RenderPipeline } from '../pipeline';
import {
    cipherOdometerEngine, FINALE_HANDOFF_END, FINALE_HANDOFF_START, type OdometerGlyphCellState,
} from '../../bridge/cipherOdometerEngine';
import type { AudioModulationSnapshot } from '../../utils/audioSync';
import { getGlyphFontEpoch, GLYPH_FONT_STACK } from '../../core/glyphGrammar';
import { fitGlyphInk, type GlyphInkFit } from '../../core/glyphHover';
import { getSingularityPhotonRadii, PHOTON_BRIGHT_STOP, PHOTON_HALO_STOP } from '../../core/finaleComposition';
import { resourceLedger } from '../../core/resourceLedger';
import { TAU, clamp } from '../math/noise2d';

// НАЧАЛО РАЗДЕЛА 1. КОРОНА NGC 6543 И ЧЁРНАЯ ДЫРА
// НАЧАЛО ФУНКЦИИ renderSingularityCoronaAndBlackHole
/**
 * Отрисовывает 7-оболочечную корону туманности «Кошачьего глаза» (NGC 6543),
 * допплеровский аккреционный диск и тень горизонта событий Чёрной дыры в фазе 05_SINGULARITY.
 * В Акте A вырастает из Точки Нуля, а в Акте B непрерывно сжимается в яркую микро-точку.
 */
export function renderSingularityCoronaAndBlackHole(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scale: number,
    simTimeSec: number,
    act: SingularityAct,
    actProgress: number,
    audioSnap: AudioModulationSnapshot
): void {
    if (act === 'ACT_D_GITHUB_CARD') {
        return;
    }

    ctx.save();

    let volumeEnvelope = 1.0;
    let opacityEnvelope = 1.0;

    if (act === 'ACT_A_ACCRETION' || act === 'NONE' || act === 'INACTIVE') {
        const birthCurve = smootherstep(0.0, 0.44, actProgress);
        volumeEnvelope = 0.015 + 0.985 * birthCurve;
        opacityEnvelope = smootherstep(0.0, 0.24, actProgress);
    } else if (act === 'ACT_B_LOGIC') {
        const smoothCollapse = smootherstep(0.05, 0.98, actProgress);
        volumeEnvelope = Math.max(0.008, Math.pow(1.0 - smoothCollapse, 1.95));
        opacityEnvelope = 1.0 - smootherstep(0.82, 1.0, smoothCollapse) * 0.4;
    } else if (act === 'RESTART_COLLAPSE') {
        volumeEnvelope = Math.max(0.0, 0.16 * (1.0 - actProgress));
        opacityEnvelope = Math.max(0.0, 1.0 - actProgress);
    }

    if (opacityEnvelope <= 0.005 || volumeEnvelope <= 0.002) {
        ctx.restore();
        return;
    }

    const shells = 7;
    for (let l = 1; l <= shells; l++) {
        const shellBirthDelay = (l - 1) * 0.04;
        const shellScale =
            act === 'ACT_A_ACCRETION'
                ? smootherstep(
                    shellBirthDelay,
                    Math.min(1.0, shellBirthDelay + 0.48),
                    actProgress
                )
                : volumeEnvelope;

        const baseR = (0.09 + l * 0.055) * scale * shellScale;
        if (baseR < 0.8) continue;

        const lobes = 4 + (l % 3) * 2;
        const alpha = clamp(
            (0.24 - l * 0.024) *
            (0.85 + 0.25 * audioSnap.pulse) *
            opacityEnvelope,
            0.01,
            0.34
        );

        ctx.beginPath();
        const pts = 96;
        for (let s = 0; s <= pts; s++) {
            const phi = (s / pts) * TAU;
            const rShell =
                baseR *
                (1.0 +
                    0.11 * Math.cos(lobes * phi + simTimeSec * (0.48 - l * 0.04)) +
                    0.055 * Math.cos(2.0 * lobes * phi - simTimeSec * 0.28));
            const px = cx + Math.cos(phi) * rShell * 1.14;
            const py = cy + Math.sin(phi) * rShell * 0.84;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle =
            l % 2 === 0
                ? RenderPipeline.hexToRgba('#7dd3fc', alpha)
                : l === 3
                    ? RenderPipeline.hexToRgba('#bae6fd', alpha * 0.78)
                    : RenderPipeline.hexToRgba('#6366f1', alpha * 0.85);
        ctx.lineWidth = 1.05;
        ctx.stroke();
    }

    const photon = getSingularityPhotonRadii(scale, volumeEnvelope);
    const shadowR = photon.shadowRadius;
    const photonOuterR = photon.outerRadius;

    const photonGrad = ctx.createRadialGradient(
        cx - shadowR * 0.16,
        cy,
        photon.innerRadius,
        cx,
        cy,
        photonOuterR
    );
    photonGrad.addColorStop(0.0, `rgba(2, 3, 8, ${opacityEnvelope.toFixed(3)})`);
    photonGrad.addColorStop(
        0.36,
        `rgba(2, 3, 8, ${(0.98 * opacityEnvelope).toFixed(3)})`
    );
    photonGrad.addColorStop(
        PHOTON_BRIGHT_STOP,
        RenderPipeline.hexToRgba('#f8fafc', 0.94 * opacityEnvelope)
    );
    photonGrad.addColorStop(
        PHOTON_HALO_STOP,
        RenderPipeline.hexToRgba('#7dd3fc', 0.52 * opacityEnvelope)
    );
    photonGrad.addColorStop(
        0.86,
        RenderPipeline.hexToRgba('#6366f1', 0.24 * opacityEnvelope)
    );
    photonGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

    ctx.fillStyle = photonGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, photonOuterR, 0, TAU);
    ctx.fill();

    if (shadowR > 1.2) {
        ctx.fillStyle = `rgba(2, 3, 8, ${opacityEnvelope.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, shadowR * 0.9, 0, TAU);
        ctx.fill();
    } else {
        // В финале сжатия (когда shadowR <= 1.2 px) загорается яркая жемчужная Точка Нуля
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.6, 0, TAU);
        ctx.fill();
    }

    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderSingularityCoronaAndBlackHole
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. МИКРО-ТОЧКА ИМПУЛЬСА В АКТЕ C
// НАЧАЛО ФУНКЦИИ renderZeroSilenceActC
/**
 * Отрисовывает короткий 0.45-секундный импульс Точки Нуля (Акт C):
 * Чёрная дыра сжалась в яркую жемчужную точку, которая сразу же начинает
 * раскрывать волну рождения визитки DUBNOV ALEXEY без паузы.
 */
export function renderZeroSilenceActC(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    minSide: number,
    _simTimeSec: number
): void {
    const uState = universeStore.getState();
    const actProg = clamp(uState.singularityActProgress, 0, 1);

    const pulseArc = Math.sin(actProg * Math.PI);
    const dotR = 2.4 + 3.2 * pulseArc;
    const glowR = dotR * (7.0 + 6.0 * actProg);

    // Сходящееся и тут же расходящееся тонкое кольцо импульса возрождения
    const horizonR = minSide * (0.015 + 0.045 * actProg);
    ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', 0.36 * (1.0 - actProg * 0.5));
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2.0, horizonR), 0, TAU);
    ctx.stroke();

    const halo = ctx.createRadialGradient(cx, cy, 0.2, cx, cy, glowR);
    halo.addColorStop(0.0, RenderPipeline.hexToRgba('#f8fafc', 0.98));
    halo.addColorStop(0.35, RenderPipeline.hexToRgba('#7dd3fc', 0.54));
    halo.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, TAU);
    ctx.fill();
}
// КОНЕЦ ФУНКЦИИ renderZeroSilenceActC
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. CANVAS-ОДОМЕТР И ПЕРЕДАЧА ТЕКСТА DOM-ВИЗИТКЕ
const cipherInkFits = new Map<string, GlyphInkFit>();
let cipherFontEpoch = -1;
const GHOST_TONE_POOL = ['#64748b', '#475569', '#38bdf8', '#94a3b8'] as const;
/** Размытие слоя теней в пикселях холста: прежние shadowBlur знаков 8–15, то есть σ ≈ 4–7,5. */
const ODOMETER_SHADOW_SIGMA_PX = 6;
let odometerShadowLayer: HTMLCanvasElement | null = null;
let odometerShadowContext: CanvasRenderingContext2D | null = null;
let odometerShadowUnavailable = false;
let odometerShadowDisposerRegistered = false;
/** ?odometerShadow=glyph — прежний shadowBlur на каждом знаке: для сравнения двух путей в одном профиле. */
const FORCE_GLYPH_SHADOWS = typeof window !== 'undefined' &&
    new URLSearchParams(window.location?.search ?? '').get('odometerShadow') === 'glyph';

// НАЧАЛО ФУНКЦИИ drawFittedCipherGlyph
/** Полное начертание остаётся в своей ячейке и viewport, включая движущиеся ghost-знаки. */
export function drawFittedCipherGlyph(ctx: CanvasRenderingContext2D, glyph: string,
    cell: Pick<OdometerGlyphCellState, 'currentX' | 'currentY' | 'rollAxis' | 'rollScale' | 'fontSizePx' | 'stepWidthPx'>,
    width: number, height: number, offsetX = 0, offsetY = 0, fontKey?: string): void {
    if (/^\s*$/u.test(glyph)) return;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const epoch = getGlyphFontEpoch();
    if (epoch !== cipherFontEpoch || cipherInkFits.size >= 4096) {
        cipherInkFits.clear();
        cipherFontEpoch = epoch;
    }
    // Чтение ctx.font с веб-шрифтом дорого: вызывающий передаёт уже известную строку шрифта.
    const key = `${fontKey ?? ctx.font}:${cell.stepWidthPx.toFixed(3)}:${glyph}`;
    let fit = cipherInkFits.get(key);
    if (!fit) {
        const fontPx = Math.max(0.1, Number(cell.fontSizePx.toFixed(1)));
        fit = fitGlyphInk(ctx.measureText(glyph), cell.stepWidthPx, Math.max(2, fontPx * 1.5), fontPx);
        cipherInkFits.set(key, fit);
    }
    const halfWidth = (fit.inkRight - fit.inkLeft) * fit.scale / 2;
    const halfHeight = (fit.inkAscent + fit.inkDescent) * fit.scale / 2;
    const rollX = cell.rollAxis === 'x' ? cell.rollScale : 1;
    const rollY = cell.rollAxis === 'y' ? cell.rollScale : 1;
    const centerX = clamp(offsetX, (2 - cell.currentX) / rollX + halfWidth, (width - 2 - cell.currentX) / rollX - halfWidth);
    const centerY = clamp(offsetY, (2 - cell.currentY) / rollY + halfHeight, (height - 2 - cell.currentY) / rollY - halfHeight);
    ctx.translate(centerX - (fit.inkLeft + fit.inkRight) * fit.scale / 2,
        centerY + (fit.inkAscent - fit.inkDescent) * fit.scale / 2);
    ctx.scale(fit.scale, fit.scale);
    ctx.fillText(glyph, 0, 0);
    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ drawFittedCipherGlyph

// НАЧАЛО ФУНКЦИИ drawOdometerCell
/**
 * Знак ячейки и два «призрака» соседних знаков барабана. Проход 'shadow' рисует их цветом тени
 * со сдвигом тени (пиксели холста) в слой теней; 'ink' — сами знаки без тени; 'ink-with-shadow' —
 * прежний путь с shadowBlur на каждый знак, когда фильтры Canvas недоступны.
 */
function drawOdometerCell(target: CanvasRenderingContext2D, c: OdometerGlyphCellState, font: string,
    w: number, h: number, fade: number, pass: 'shadow' | 'ink' | 'ink-with-shadow', pixelScaleY: number): void {
    target.save();
    target.translate(c.currentX, c.currentY);
    // Наборные строки прокручивают знак по X слева направо, как и фронт сборки.
    const horizontalRoll = c.rollAxis === 'x';
    target.scale(horizontalRoll ? c.rollScale : 1.0, horizontalRoll ? 1.0 : c.rollScale);
    const breathAlpha = (c.glyphBreathAlpha ?? 0.92) * fade;
    // Сдвиг тени задан в пикселях холста, как shadowOffsetY: пересчёт в масштаб ячейки.
    const shadowShift = (offsetPx: number): number =>
        offsetPx / Math.max(1e-6, pixelScaleY * (horizontalRoll ? 1.0 : c.rollScale));

    if (!c.isLocked) {
        const ghostOffset = c.fontSizePx * 0.72;
        const ghostShadowY = pass === 'shadow' ? shadowShift(3) : 0;
        if (pass === 'ink-with-shadow') {
            target.shadowColor = 'rgba(2, 6, 23, 0.96)';
            target.shadowBlur = 12;
            target.shadowOffsetY = 3;
        }
        target.globalAlpha = 0.28 * breathAlpha;
        target.fillStyle = pass === 'shadow' ? 'rgba(2, 6, 23, 0.96)'
            : GHOST_TONE_POOL[(c.charIndex + c.lineIndex) % GHOST_TONE_POOL.length];
        drawFittedCipherGlyph(target, c.upperChar, c, w, h,
            horizontalRoll ? ghostOffset + c.wheelPhaseFrac * c.fontSizePx * 0.48 : 0,
            (horizontalRoll ? 0 : -ghostOffset - c.wheelPhaseFrac * c.fontSizePx * 0.48) + ghostShadowY, font);

        target.globalAlpha = 0.22 * breathAlpha;
        target.fillStyle = pass === 'shadow' ? 'rgba(2, 6, 23, 0.96)'
            : GHOST_TONE_POOL[(c.charIndex + c.lineIndex + 2) % GHOST_TONE_POOL.length];
        drawFittedCipherGlyph(target, c.lowerChar, c, w, h,
            horizontalRoll ? -ghostOffset + c.wheelPhaseFrac * c.fontSizePx * 0.48 : 0,
            (horizontalRoll ? 0 : ghostOffset - c.wheelPhaseFrac * c.fontSizePx * 0.48) + ghostShadowY, font);
    }

    const shadowColor = c.shadowColor || 'rgba(2, 6, 23, 0.95)';
    const shadowOffsetY = c.isLocked ? 2 : 3;
    if (pass === 'ink-with-shadow') {
        target.shadowColor = shadowColor;
        target.shadowBlur = c.shadowBlur ?? 11;
        target.shadowOffsetY = shadowOffsetY;
    }
    target.globalAlpha = (c.isLocked ? 0.97 : 1.0) * breathAlpha;
    if (pass === 'shadow') target.fillStyle = shadowColor;
    else if (c.lockFlash > 0.26) target.fillStyle = c.charIndex % 2 === 0 ? '#f8fafc' : '#bae6fd';
    else if (c.lockFlash > 0.08) target.fillStyle = c.charIndex % 3 === 0 ? '#7dd3fc' : '#cbd5e1';
    else target.fillStyle = c.colorHex;
    drawFittedCipherGlyph(target, c.primaryChar, c, w, h,
        horizontalRoll && !c.isLocked ? c.wheelPhaseFrac * c.fontSizePx * 0.44 : 0,
        (horizontalRoll || c.isLocked ? 0 : -c.wheelPhaseFrac * c.fontSizePx * 0.44) +
            (pass === 'shadow' ? shadowShift(shadowOffsetY) : 0), font);
    target.restore();
}
// КОНЕЦ ФУНКЦИИ drawOdometerCell

// НАЧАЛО ФУНКЦИИ releaseOdometerShadowLayer
/** Слой нужен только во время разлёта символов; после передачи визитке память возвращается. */
function releaseOdometerShadowLayer(): void {
    if (!odometerShadowLayer) return;
    odometerShadowLayer.width = odometerShadowLayer.height = 0;
    odometerShadowLayer = null;
    odometerShadowContext = null;
    resourceLedger.trackPageLifetimeRelease('textures', 1);
}
// КОНЕЦ ФУНКЦИИ releaseOdometerShadowLayer

// НАЧАЛО ФУНКЦИИ acquireOdometerShadowLayer
/**
 * Слой теней под рамку всех знаков кадра в пикселях холста. null — нет DOM, фильтров Canvas
 * или трансформация с поворотом: тогда знаки рисуются с собственным shadowBlur, как прежде.
 */
function acquireOdometerShadowLayer(ctx: CanvasRenderingContext2D, cells: readonly OdometerGlyphCellState[],
    transform: DOMMatrix): { context: CanvasRenderingContext2D; left: number; top: number; width: number; height: number } | null {
    if (odometerShadowUnavailable || !('filter' in ctx) || typeof ctx.getTransform !== 'function' ||
        transform.b !== 0 || transform.c !== 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cells) {
        if (c.primaryChar === ' ') continue;
        // Призраки сдвинуты не дальше ~1,2 кегля, начертание — до 1,5 кегля по высоте.
        const reach = c.fontSizePx * 2 + c.stepWidthPx;
        minX = Math.min(minX, c.currentX - reach); maxX = Math.max(maxX, c.currentX + reach);
        minY = Math.min(minY, c.currentY - reach); maxY = Math.max(maxY, c.currentY + reach);
    }
    if (!Number.isFinite(minX + minY + maxX + maxY)) return null;
    const margin = ODOMETER_SHADOW_SIGMA_PX * 3 + 4;
    const canvasWidth = ctx.canvas.width, canvasHeight = ctx.canvas.height;
    const left = Math.max(0, Math.floor(Math.min(transform.a * minX, transform.a * maxX) + transform.e - margin));
    const top = Math.max(0, Math.floor(Math.min(transform.d * minY, transform.d * maxY) + transform.f - margin));
    const right = Math.min(canvasWidth, Math.ceil(Math.max(transform.a * minX, transform.a * maxX) + transform.e + margin));
    const bottom = Math.min(canvasHeight, Math.ceil(Math.max(transform.d * minY, transform.d * maxY) + transform.f + margin));
    if (right <= left || bottom <= top) return null;
    try {
        if (!odometerShadowLayer) {
            // Без DOM (тест, worker) слоя нет в этом кадре; флаг недоступности ставит только настоящая ошибка.
            const owner = ctx.canvas.ownerDocument ?? (typeof document === 'undefined' ? null : document);
            if (!owner?.createElement) return null;
            odometerShadowLayer = owner.createElement('canvas');
            resourceLedger.trackPageLifetimeAllocation('textures', 1);
            if (!odometerShadowDisposerRegistered) {
                odometerShadowDisposerRegistered = true;
                resourceLedger.registerPageDisposable(releaseOdometerShadowLayer);
            }
        }
        // Слой только растёт до рамки разлёта: без пересоздания текстуры в каждом кадре.
        if (odometerShadowLayer.width < right - left || odometerShadowLayer.height < bottom - top) {
            odometerShadowLayer.width = Math.max(odometerShadowLayer.width, right - left);
            odometerShadowLayer.height = Math.max(odometerShadowLayer.height, bottom - top);
            odometerShadowContext = null;
        }
        odometerShadowContext ??= odometerShadowLayer.getContext('2d');
        if (!odometerShadowContext) throw new Error('Odometer shadow layer has no 2D context');
        return { context: odometerShadowContext, left, top, width: right - left, height: bottom - top };
    } catch {
        odometerShadowUnavailable = true;
        releaseOdometerShadowLayer();
        return null;
    }
}
// КОНЕЦ ФУНКЦИИ acquireOdometerShadowLayer

// НАЧАЛО ФУНКЦИИ renderCipherOdometerStage
/**
 * Отрисовывает атмосферную подложку и 3D-разлёт символов квантового одометра
 * из центральной Точки Нуля (cipherOdometerEngine).
 * По мере фиксации видимой семантической DOM-карточки (Layer5_CipherFinale.tsx)
 * плавно убирает дублирующие символы на Canvas, чтобы текст визитки оставался
 * идеально чётким и никогда не двоился.
 */
export function renderCipherOdometerStage(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: Readonly<UniverseState>
): void {
    const assemblyProgress = state.githubCardAssemblyProgress;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const backdropR = Math.min(w, h) * 0.46;
    const backdropGrad = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        16,
        w * 0.5,
        h * 0.5,
        backdropR
    );
    const veilAlpha = Math.min(1.0, assemblyProgress * 1.35);
    backdropGrad.addColorStop(0.0, `rgba(3, 7, 18, ${(0.76 * veilAlpha).toFixed(3)})`);
    backdropGrad.addColorStop(0.65, `rgba(2, 5, 14, ${(0.48 * veilAlpha).toFixed(3)})`);
    backdropGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
    ctx.fillStyle = backdropGrad;
    ctx.fillRect(0, 0, w, h);

    // Символы из Точки Нуля садятся в измеренные места букв DOM-визитки (setDomGlyphSlots), и в общем окне
    // FINALE_HANDOFF_START..END Canvas гаснет, а визитка (Layer5_CipherFinale.tsx) проявляется на тех же местах.
    const canvasParticlesFade = 1.0 - smootherstep(FINALE_HANDOFF_START, FINALE_HANDOFF_END, assemblyProgress);
    if (canvasParticlesFade <= 0.01) {
        releaseOdometerShadowLayer();
        ctx.restore();
        return;
    }

    const cells: OdometerGlyphCellState[] = cipherOdometerEngine.evaluateCells(
        w,
        h,
        assemblyProgress,
        state.reducedMotion
    );

    // Тени знаков — одно размытие на кадр. shadowBlur на каждом знаке заставлял Chrome строить размытую
    // маску заново для каждого знака в каждом кадре: масштаб «барабана» меняется непрерывно, и кэш масок
    // не срабатывал — сотни размытий в процессе GPU и кадры по 50–66 мс во время разлёта. Теперь тени
    // всех знаков рисуются без размытия в слой под рамку разлёта и один раз размываются фильтром.
    const transform = ctx.getTransform?.();
    const shadows = transform && !FORCE_GLYPH_SHADOWS ? acquireOdometerShadowLayer(ctx, cells, transform) : null;
    if (shadows && transform) {
        const layer = shadows.context;
        layer.setTransform(1, 0, 0, 1, 0, 0);
        layer.globalAlpha = 1;
        layer.clearRect(0, 0, shadows.width, shadows.height);
        layer.setTransform(transform.a, 0, 0, transform.d, transform.e - shadows.left, transform.f - shadows.top);
        layer.textAlign = 'center';
        layer.textBaseline = 'middle';
    }

    // Назначение ctx.font с веб-шрифтом стоит до ~0.5 мс: шрифт ставится до save() ячейки
    // и только при смене начертания, а restore() возвращает уже установленный шрифт.
    const passes: readonly ('shadow' | 'ink' | 'ink-with-shadow')[] = shadows ? ['shadow', 'ink'] : ['ink-with-shadow'];
    for (const pass of passes) {
        const target = pass === 'shadow' ? shadows!.context : ctx;
        if (pass === 'ink') {
            ctx.shadowColor = 'rgba(0, 0, 0, 0)';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
        }
        let activeFont = '';
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            if (c.primaryChar === ' ') continue;
            const font = `${c.fontWeight} ${c.fontSizePx.toFixed(1)}px ${GLYPH_FONT_STACK}`;
            if (font !== activeFont) {
                target.font = font;
                activeFont = font;
            }
            drawOdometerCell(target, c, font, w, h, canvasParticlesFade, pass, transform?.d ?? 1);
        }
        if (pass === 'shadow' && shadows) {
            // Размытие задано в пикселях холста, как shadowBlur (σ = shadowBlur / 2): единичная матрица.
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.filter = `blur(${ODOMETER_SHADOW_SIGMA_PX}px)`;
            ctx.drawImage(shadows.context.canvas, 0, 0, shadows.width, shadows.height,
                shadows.left, shadows.top, shadows.width, shadows.height);
            ctx.restore();
        }
    }

    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderCipherOdometerStage
// КОНЕЦ РАЗДЕЛА 3
