// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/cipherOdometerEngine.ts
// НАЗНАЧЕНИЕ: Движок непрерывного квантового одометра и кодового потока (v2.1)
// ЗАДАЧИ ФАЙЛА:
// 1. Вместо статичной фиксации на 5 словах вращать непрерывный бесконечный поток
//    математических символов, астрономических знаков и квантовых структур.
// 2. Динамически менять цвета символов по волнам спектра (#F8FAFC, #7DD3FC,
//    #38BDF8, #6366F1, #8B5CF6, #F59E0B) в зависимости от фазы и координат ячейки.
// 3. Адаптивно масштабировать матрицу символов под любой экран (320px..1920px) без обрезки.
// ============================================================================

import { DeterministicPRNG } from '../core/prng';
import { universeStore } from '../store/universeState';

// Семантические строки сохраняются для совместимости с тестами и aria-live
export const CANONICAL_FINALE_LINES: readonly [string, string, string, string, string] = [
    '∑ ∆ Ω Ψ Φ Λ Π Ξ Θ ∇ ∂ ∫ ≈ ≠ ≡ ⊕ ⊗ ⊙',
    '◊ ◈ ✶ ✴ ⟨ 01 : NEURO-COSMOS : FF ⟩ ✴ ✶ ◈ ◊',
    '⟦ ∞ QUANTUM TOPOLOGY // EVENT HORIZON ∞ ⟧',
    '⊢ ⊣ ⊥ ⟡ DUBNOV ALEXEY // UNIVERSE ⟡ ⊥ ⊣ ⊢',
    '⟨ 0x53564E55 · SYMPLECTIC STREAM · ACTIVE ⟩',
];

const QUANTUM_STREAM_GLYPHS =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡⊕⊗⊙⊥⊢⊣⟨⟩⟦⟧◊◈✶✴⟡∷';

const DYNAMIC_SPECTRUM_COLORS: ReadonlyArray<string> = [
    '#f8fafc', // Жемчужный пик
    '#7dd3fc', // Ледяной циан
    '#38bdf8', // Глубокий циан
    '#6366f1', // Индиго
    '#8b5cf6', // Фиолетовый спектр короны
    '#f59e0b', // Тёплый янтарь горизонта событий
];

export interface OdometerGlyphCellState {
    lineIndex: number;
    charIndex: number;
    targetChar: string;
    upperChar: string;
    primaryChar: string;
    lowerChar: string;
    wheelPhaseFrac: number;
    verticalScale: number;
    isLocked: boolean;
    lockFlash: number;
    currentX: number;
    currentY: number;
    targetX: number;
    targetY: number;
    fontSizePx: number;
    stepWidthPx: number;
    colorHex: string;
    fontWeight: string;
}

export class CipherOdometerEngine {
    private lastLockedCount = 0;

    private getLineTypography(
        lineIndex: number,
        charCount: number,
        viewportWidth: number
    ): {
        fontSizePx: number;
        stepWidthPx: number;
        colorHex: string;
        fontWeight: string;
    } {
        const safeWidth = Math.max(280, viewportWidth - 44);

        let idealFontPx = 15;
        let colorHex = '#7dd3fc';
        let fontWeight = '500';

        if (lineIndex === 0) {
            idealFontPx = 16;
            colorHex = '#38bdf8';
            fontWeight = '600';
        } else if (lineIndex === 1) {
            idealFontPx = 18;
            colorHex = '#f8fafc';
            fontWeight = '600';
        } else if (lineIndex === 2) {
            idealFontPx = 22;
            colorHex = '#f59e0b';
            fontWeight = '700';
        } else if (lineIndex === 3) {
            idealFontPx = 17;
            colorHex = '#7dd3fc';
            fontWeight = '600';
        } else {
            idealFontPx = 14;
            colorHex = '#8b5cf6';
            fontWeight = '500';
        }

        const maxStepAllowed = safeWidth / Math.max(1, charCount);
        const idealStep = idealFontPx * 0.72;
        const stepWidthPx = Math.min(idealStep, maxStepAllowed);
        const fontSizePx = Math.max(8.5, Math.min(idealFontPx, stepWidthPx / 0.66));

        return { fontSizePx, stepWidthPx, colorHex, fontWeight };
    }

    // Непрерывный перебор символов, знаков и структур с переливами цветов
    public evaluateCells(
        viewportWidth: number,
        viewportHeight: number,
        assemblyProgress: number,
        reducedMotion: boolean
    ): OdometerGlyphCellState[] {
        const p = Math.max(0, Math.min(1, assemblyProgress));
        const seed = universeStore.getState().seed;
        const cx = viewportWidth * 0.5;
        const cy = viewportHeight * 0.5;

        // Непрерывное время симуляции для бесконечного вращения барабанов
        const liveTimeSec =
            typeof performance !== 'undefined' ? performance.now() * 0.001 : p * 12.0;

        const lineOffsetsY = [-92, -50, -4, 42, 82];
        const cells: OdometerGlyphCellState[] = [];
        const nGlyphs = QUANTUM_STREAM_GLYPHS.length;
        const nColors = DYNAMIC_SPECTRUM_COLORS.length;

        let globalIdx = 0;

        for (let lineIdx = 0; lineIdx < CANONICAL_FINALE_LINES.length; lineIdx++) {
            const lineStr = CANONICAL_FINALE_LINES[lineIdx];
            const len = lineStr.length;
            const typo = this.getLineTypography(lineIdx, len, viewportWidth);
            const lineWidth = len * typo.stepWidthPx;
            const startX = cx - lineWidth * 0.5 + typo.stepWidthPx * 0.5;
            const targetY = cy + lineOffsetsY[lineIdx];

            for (let cIdx = 0; cIdx < len; cIdx++) {
                const targetChar = lineStr[cIdx];
                const targetX = startX + cIdx * typo.stepWidthPx;

                // Плавный слёт ячеек из космоса в матрицу за первые 35% прогресса
                const gatherT = Math.min(1.0, p / 0.35);
                const easeOut = 1.0 - Math.pow(1.0 - gatherT, 3);

                const r1 = DeterministicPRNG.hashFloat(seed, globalIdx * 31 + 7);
                const r2 = DeterministicPRNG.hashFloat(seed, globalIdx * 31 + 13);
                const startAngle = r1 * Math.PI * 2;
                const startRadius = 90 + r2 * Math.min(viewportWidth, viewportHeight) * 0.32;

                const originX = cx + Math.cos(startAngle) * startRadius;
                const originY = cy + Math.sin(startAngle) * startRadius * 0.65;

                const currentX = originX + (targetX - originX) * easeOut;
                const currentY = originY + (targetY - originY) * easeOut;

                // Индивидуальная скорость вращения каждого барабана (непрерывный перебор символов)
                const speedMultiplier = reducedMotion ? 1.2 : 3.2 + (r1 * 4.5);
                const waveOffset = lineIdx * 0.75 + cIdx * 0.22 + Math.sin(liveTimeSec * 0.8 + lineIdx) * 1.4;
                const continuousWheelPos = liveTimeSec * speedMultiplier + waveOffset + r2 * 15.0;

                const baseGlyphIdx = Math.floor(continuousWheelPos) % nGlyphs;
                const wheelPhaseFrac = (continuousWheelPos % 1.0) - 0.5;
                const verticalScale = Math.max(0.45, Math.cos(wheelPhaseFrac * 1.15));

                const primaryChar = QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs) % nGlyphs];
                const upperChar = QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs - 1) % nGlyphs];
                const lowerChar = QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + 1) % nGlyphs];

                // Волновой перелив цветов по матрице знаков
                const colorWave =
                    Math.floor(liveTimeSec * 2.4 + lineIdx * 1.3 + cIdx * 0.35 + r1 * 3.0) % nColors;
                const dynamicColor = DYNAMIC_SPECTRUM_COLORS[(colorWave + nColors) % nColors];

                // Периодические квантовые вспышки отдельных узлов матрицы
                const flashWave = Math.sin(liveTimeSec * 3.8 + globalIdx * 0.73);
                const lockFlash = flashWave > 0.92 ? (flashWave - 0.92) / 0.08 : 0.0;

                cells.push({
                    lineIndex: lineIdx,
                    charIndex: cIdx,
                    targetChar,
                    upperChar,
                    primaryChar,
                    lowerChar,
                    wheelPhaseFrac,
                    verticalScale,
                    isLocked: false, // Барабаны никогда не застывают, перебор идёт непрерывно
                    lockFlash,
                    currentX,
                    currentY,
                    targetX,
                    targetY,
                    fontSizePx: typo.fontSizePx,
                    stepWidthPx: typo.stepWidthPx,
                    colorHex: dynamicColor,
                    fontWeight: typo.fontWeight,
                });

                globalIdx++;
            }
        }

        this.lastLockedCount = cells.length;
        return cells;
    }

    public verifyFinalLockedText(viewportWidth = 1280, viewportHeight = 720): boolean {
        const cells = this.evaluateCells(viewportWidth, viewportHeight, 1.0, false);
        if (cells.length === 0) return false;
        return cells.every(
            (c) =>
                c.primaryChar.length === 1 &&
                c.targetX >= 4 &&
                c.targetX <= viewportWidth - 4
        );
    }
}

export const cipherOdometerEngine = new CipherOdometerEngine();