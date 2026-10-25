// ============================================================================
// ФАЙЛ: frontend/src/core/finaleComposition.ts
// НАЗНАЧЕНИЕ: Общая геометрия яркого кольца и безопасного подъёма DOM-визитки.
// РАЗДЕЛЫ: 1. Радиусы оптики; 2. Верхняя композиционная область и границы карточки.
// ФУНКЦИИ: getSingularityPhotonRadii, getFinaleCardPlacement.
// Размеры задаются в CSS-пикселях: DPR применяется только в Canvas pipeline.
// ============================================================================

// НАЧАЛО РАЗДЕЛА 1. ГЕОМЕТРИЯ ФОТОННОГО КОЛЬЦА
export const PHOTON_BRIGHT_STOP = 0.48;
export interface SingularityPhotonRadii {
    readonly shadowRadius: number;
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly brightRadius: number;
}

// НАЧАЛО ФУНКЦИИ getSingularityPhotonRadii
/** Радиус белой полосы совпадает с интерполированным кругом stop градиента. */
export function getSingularityPhotonRadii(scale: number, volumeEnvelope = 1): SingularityPhotonRadii {
    const safeScale = Number.isFinite(scale) ? Math.max(0, scale) : 0;
    const volume = Number.isFinite(volumeEnvelope) ? Math.max(0, Math.min(1, volumeEnvelope)) : 0;
    const shadowRadius = safeScale * 0.068 * volume;
    const innerRadius = Math.max(0.2, shadowRadius * 0.65);
    const outerRadius = Math.max(2.4, shadowRadius * 2.45);
    return {
        shadowRadius, innerRadius, outerRadius,
        brightRadius: innerRadius + (outerRadius - innerRadius) * PHOTON_BRIGHT_STOP,
    };
}
// КОНЕЦ ФУНКЦИИ getSingularityPhotonRadii
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. КОМПОЗИЦИЯ ВИЗИТКИ
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
 * Резервирует полное яркое кольцо, а не текущую сжавшуюся Точку Нуля.
 * Поэтому визитка не опускается вслед за сжатием кольца и сменой фазы.
 * На низком экране верхняя безопасная граница сохраняет доступность карточки.
 */
export function getFinaleCardPlacement(layout: FinaleCardLayout): FinaleCardPlacement {
    const w = Math.max(0, layout.viewportWidth);
    const h = Math.max(0, layout.viewportHeight);
    const cardHeight = Math.max(0, layout.cardHeight);
    const minSide = Math.min(w, h);
    const ring = getSingularityPhotonRadii(minSide * Math.max(0, layout.peakZoom));
    const feather = Math.max(4, Math.min(8, minSide * 0.006));
    const protectedTopPx = h / 2 - Math.abs(layout.cameraDriftYAmplitude) - ring.brightRadius - feather;
    const compact = w <= 920;
    const breathMargin = Math.ceil(2 + cardHeight * 0.0075);
    const centerY = (layout.paddingTop + h - layout.paddingBottom) / 2;
    const centeredTop = centerY - cardHeight / 2;
    const centeredBottom = centerY + cardHeight / 2;
    const topClearance = compact
        ? Math.max(48, layout.paddingTop - 8, layout.headerBottom + 4)
        : layout.paddingTop + 8;
    const desiredBottom = protectedTopPx - (compact ? 10 : 12);
    const desiredRise = Math.max(0, centeredBottom + breathMargin - desiredBottom);
    const maximumRise = Math.max(0, centeredTop - topClearance - breathMargin);
    const risePx = Math.min(desiredRise, maximumRise);
    const settledTopPx = centeredTop - risePx - breathMargin;
    const settledBottomPx = centeredBottom - risePx + breathMargin;
    return {
        risePx, protectedTopPx, settledTopPx, settledBottomPx,
        clearsBrightRing: settledBottomPx <= protectedTopPx,
    };
}
// КОНЕЦ ФУНКЦИИ getFinaleCardPlacement
// КОНЕЦ РАЗДЕЛА 2
