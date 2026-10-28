// ============================================================================
// ФАЙЛ: frontend/src/core/finaleComposition.ts
// НАЗНАЧЕНИЕ: Общая геометрия яркого кольца и безопасного подъёма DOM-визитки.
// РАЗДЕЛЫ: 1. Радиусы оптики; 2. Верхняя композиционная область и границы карточки.
// ФУНКЦИИ: getSingularityPhotonRadii, getFinaleCardScale, getFinaleCardPlacement.
// Размеры задаются в CSS-пикселях: DPR применяется только в Canvas pipeline.
// ============================================================================

// НАЧАЛО РАЗДЕЛА 1. ГЕОМЕТРИЯ ФОТОННОГО КОЛЬЦА
export const PHOTON_BRIGHT_STOP = 0.48;
export const PHOTON_HALO_STOP = 0.68;
export interface SingularityPhotonRadii {
    readonly shadowRadius: number;
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly brightRadius: number;
    readonly haloRadius: number;
}

// НАЧАЛО ФУНКЦИИ getSingularityPhotonRadii
/** Белая полоса и яркий голубой ореол совпадают с кругами stops градиента. */
export function getSingularityPhotonRadii(scale: number, volumeEnvelope = 1): SingularityPhotonRadii {
    const safeScale = Number.isFinite(scale) ? Math.max(0, scale) : 0;
    const volume = Number.isFinite(volumeEnvelope) ? Math.max(0, Math.min(1, volumeEnvelope)) : 0;
    const shadowRadius = safeScale * 0.068 * volume;
    const innerRadius = Math.max(0.2, shadowRadius * 0.65);
    const outerRadius = Math.max(2.4, shadowRadius * 2.45);
    return {
        shadowRadius, innerRadius, outerRadius,
        brightRadius: innerRadius + (outerRadius - innerRadius) * PHOTON_BRIGHT_STOP,
        haloRadius: innerRadius + (outerRadius - innerRadius) * PHOTON_HALO_STOP,
    };
}
// КОНЕЦ ФУНКЦИИ getSingularityPhotonRadii
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. КОМПОЗИЦИЯ ВИЗИТКИ
// НАЧАЛО ФУНКЦИИ getFinaleCardScale
/** Только телефон: завершение подъёма плавно освобождает центр, не меняя настольную типографику. */
export function getFinaleCardScale(viewportWidth: number, riseElapsedSec: number, reducedMotion = false): number {
    if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || viewportWidth > 600) return 1;
    const elapsed = Number.isFinite(riseElapsedSec) ? Math.max(0, Math.min(12, riseElapsedSec)) : 0;
    const t = reducedMotion ? 1 : Math.max(0, Math.min(1, (elapsed - 6) / 6));
    return 1 - 0.18 * t * t * t * (t * (t * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ getFinaleCardScale

export interface FinaleCardLayout {
    readonly viewportWidth: number;
    readonly viewportHeight: number;
    readonly cardHeight: number;
    readonly paddingTop: number;
    readonly paddingBottom: number;
    readonly headerBottom: number;
    readonly peakZoom: number;
    readonly cameraDriftYAmplitude: number;
}
export interface FinaleCardPlacement {
    readonly risePx: number;
    readonly protectedTopPx: number;
    readonly settledTopPx: number;
    readonly settledBottomPx: number;
    readonly clearsBrightRing: boolean;
}

// НАЧАЛО ФУНКЦИИ getFinaleCardPlacement
/**
 * Резервирует яркий голубой ореол с мягким краем и дополнительным зазором.
 * Поэтому визитка не опускается вслед за сжатием кольца и сменой фазы.
 * Карточка занимает верхнюю безопасную область, освобождая центр для объёмной формы.
 * На низком экране верхняя безопасная граница сохраняет доступность карточки.
 */
export function getFinaleCardPlacement(layout: FinaleCardLayout, renderScale = getFinaleCardScale(layout.viewportWidth, 12)): FinaleCardPlacement {
    const w = Math.max(0, layout.viewportWidth);
    const h = Math.max(0, layout.viewportHeight);
    const scale = Number.isFinite(renderScale) ? Math.max(0.5, Math.min(1, renderScale)) : 1;
    const cardHeight = Math.max(0, layout.cardHeight) * scale;
    const minSide = Math.min(w, h);
    const ring = getSingularityPhotonRadii(minSide * Math.max(0, layout.peakZoom));
    const feather = Math.max(4, Math.min(8, minSide * 0.006));
    const protectedTopPx = h / 2 - Math.abs(layout.cameraDriftYAmplitude) - ring.haloRadius - feather;
    const compact = w <= 920;
    // Верхняя огибающая текущего дыхания: float ±2px и scale с heartbeat ≤1.
    const breathMargin = 2 + cardHeight * 0.5 * (0.008 * (1 + 0.42) + 0.003);
    const centerY = (layout.paddingTop + h - layout.paddingBottom) / 2;
    const centeredTop = centerY - cardHeight / 2;
    const centeredBottom = centerY + cardHeight / 2;
    const topClearance = compact
        ? Math.max(48, layout.paddingTop - 8, layout.headerBottom + 4)
        : 8;
    const maximumRise = Math.max(0, centeredTop - topClearance - breathMargin);
    const risePx = maximumRise;
    const settledTopPx = centeredTop - risePx - breathMargin;
    const settledBottomPx = centeredBottom - risePx + breathMargin;
    return {
        risePx, protectedTopPx, settledTopPx, settledBottomPx,
        clearsBrightRing: settledBottomPx <= protectedTopPx,
    };
}
// КОНЕЦ ФУНКЦИИ getFinaleCardPlacement
// КОНЕЦ РАЗДЕЛА 2
