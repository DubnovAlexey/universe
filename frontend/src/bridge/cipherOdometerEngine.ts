// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/cipherOdometerEngine.ts
// НАЗНАЧЕНИЕ: Движок квантового одометра v2.2 (1 бесконечная строка + 4 фиксируемые + Hover)
// ЗАДАЧИ ФАЙЛА:
// 1. Фиксировать строки 0, 1, 3, 4 (авторство DUBNOV ALEXEY и полный полиглот-стек
//    фреймворков/языков) после короткой прокрутки.
// 2. Вращать бесконечно ТОЛЬКО центральную строку (индекс 2) с перебором символов,
//    знаков и динамической сменой космических оттенков.
// 3. При наведении курсора мыши на любую зафиксированную букву мягко прокручивать
//    её на 0.85 с и снова останавливать на месте.
// ============================================================================

import { DeterministicPRNG } from '../core/prng';
import { universeStore } from '../store/universeState';

export const CANONICAL_FINALE_LINES: readonly [string, string, string, string, string] = [
    'DUBNOV ALEXEY // UNIVERSE — NEURO-COSMIC INSTALLATION',
    'POLYGLOT ARCHITECTURE : FROM ZERO TO ZERO (108 SEC)',
    '∑ ∆ Ω Ψ Φ Λ Π Ξ Θ ∇ ∂ ∫ ≈ ≠ ≡ ⊕ ⊗ ⊙ ◊ ◈ ✶ ✴ ⟨ ∞ ⟩',
    'ASTRO · TYPESCRIPT · REACT · WEBGPU/WGSL · RUST/WASM · PYTHON',
    'SYMPLECTIC PHYSICS · KURAMOTO SYNC · GABRIEL-MURRAY NEXUS',
];

// Индекс единственной строки, которая крутится бесконечно
const ENDLESS_SPIN_LINE_INDEX = 2;

const QUANTUM_STREAM_GLYPHS =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡⊕⊗⊙⊥⊢⊣⟨⟩⟦⟧◊◈✶✴⟡∷';

const DYNAMIC_SPECTRUM_COLORS: ReadonlyArray<string> = [
    '#f8fafc',
    '#7dd3fc',
    '#38bdf8',
    '#6366f1',
    '#8b5cf6',
    '#f59e0b',
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
    private pointerX = -9999;
    private pointerY = -9999;
    private hoverExcitedUntilMs: Map<number, number> = new Map();

    public notifyPointerHover(clientX: number, clientY: number): void {
        this.pointerX = clientX;
        this.pointerY = clientY;
    }

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
        const safeWidth = Math.max(290, viewportWidth - 36);

        let idealFontPx = 15;
        let colorHex = '#7dd3fc';
        let fontWeight = '500';

        if (lineIndex === 0) {
            idealFontPx = 18;
            colorHex = '#f8fafc';
            fontWeight = '700';
        } else if (lineIndex === 1) {
            idealFontPx = 14.5;
            colorHex = '#7dd3fc';
            fontWeight = '500';
        } else if (lineIndex === 2) {
            idealFontPx = 19;
            colorHex = '#38bdf8';
            fontWeight = '600';
        } else if (lineIndex === 3) {
            idealFontPx = 15.5;
            colorHex = '#f8fafc';
            fontWeight = '600';
        } else {
            idealFontPx = 13.5;
            colorHex = '#38bdf8';
            fontWeight = '500';
        }

        const maxStepAllowed = safeWidth / Math.max(1, charCount);
        const idealStep = idealFontPx * 0.68;
        const stepWidthPx = Math.min(idealStep, maxStepAllowed);
        const fontSizePx = Math.max(8.5, Math.min(idealFontPx, stepWidthPx / 0.62));

        return { fontSizePx, stepWidthPx, colorHex, fontWeight };
    }

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
        const nowMs = typeof performance !== 'undefined' ? performance.now() : p * 10000;
        const liveTimeSec = nowMs * 0.001;

        const lineOffsetsY = [-94, -50, -4, 42, 82];
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

                // Проверка наведения курсора мыши для короткой прокрутки (0.85 сек)
                const distToPointer = Math.hypot(this.pointerX - targetX, this.pointerY - targetY);
                if (distToPointer < 32 && p > 0.5) {
                    this.hoverExcitedUntilMs.set(globalIdx, nowMs + 850);
                }
                const excitedUntil = this.hoverExcitedUntilMs.get(globalIdx) ?? 0;
                const isHoverSpinning = nowMs < excitedUntil;

                const isEndlessLine = lineIdx === ENDLESS_SPIN_LINE_INDEX;
                const lockThreshold = 0.42 + (lineIdx * 0.08) + (cIdx / Math.max(1, len)) * 0.22;
                const isLocked = !isEndlessLine && !isHoverSpinning && p >= Math.min(0.82, lockThreshold);

                const speedMultiplier = reducedMotion ? 1.4 : 3.4 + r1 * 4.2;
                const waveOffset = lineIdx * 0.75 + cIdx * 0.22 + Math.sin(liveTimeSec * 0.9 + lineIdx) * 1.3;
                const continuousWheelPos = liveTimeSec * speedMultiplier + waveOffset + r2 * 14.0;

                const baseGlyphIdx = Math.floor(continuousWheelPos) % nGlyphs;
                const wheelPhaseFrac = isLocked ? 0 : (continuousWheelPos % 1.0) - 0.5;
                const verticalScale = isLocked ? 1.0 : Math.max(0.48, Math.cos(wheelPhaseFrac * 1.15));

                const primaryChar = isLocked
                    ? targetChar
                    : QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs) % nGlyphs];
                const upperChar = QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs - 1) % nGlyphs];
                const lowerChar = QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + 1) % nGlyphs];

                let cellColor = typo.colorHex;
                if (isEndlessLine || isHoverSpinning) {
                    const colorWave =
                        Math.floor(liveTimeSec * 2.2 + lineIdx * 1.3 + cIdx * 0.35 + r1 * 3.0) % nColors;
                    cellColor = DYNAMIC_SPECTRUM_COLORS[(colorWave + nColors) % nColors];
                }

                let lockFlash = 0;
                if (!isEndlessLine && p >= lockThreshold && p <= lockThreshold + 0.12) {
                    lockFlash = 1.0 - (p - lockThreshold) / 0.12;
                } else if (isHoverSpinning) {
                    lockFlash = 0.45;
                }

                cells.push({
                    lineIndex: lineIdx,
                    charIndex: cIdx,
                    targetChar,
                    upperChar,
                    primaryChar,
                    lowerChar,
                    wheelPhaseFrac,
                    verticalScale,
                    isLocked,
                    lockFlash,
                    currentX,
                    currentY,
                    targetX,
                    targetY,
                    fontSizePx: typo.fontSizePx,
                    stepWidthPx: typo.stepWidthPx,
                    colorHex: cellColor,
                    fontWeight: typo.fontWeight,
                });

                globalIdx++;
            }
        }

        return cells;
    }

    public verifyFinalLockedText(viewportWidth = 1280, viewportHeight = 720): boolean {
        const cells = this.evaluateCells(viewportWidth, viewportHeight, 1.0, false);
        if (cells.length === 0) return false;
        return cells.every(
            (c) =>
                (c.lineIndex === ENDLESS_SPIN_LINE_INDEX || c.isLocked) &&
                c.targetX >= 4 &&
                c.targetX <= viewportWidth - 4
        );
    }
}

export const cipherOdometerEngine = new CipherOdometerEngine();