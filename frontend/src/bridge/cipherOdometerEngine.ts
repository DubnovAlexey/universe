// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/cipherOdometerEngine.ts
// НАЗНАЧЕНИЕ: Движок квантового одометра v2.4 (монохромно-теневая гамма без рыжего цвета,
//             хаотичная скорость центральной строки и C∞-гладкое кардио-дыхание визитки)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Канонический манифест (CANONICAL_FINALE_LINES) и палитра полутонов
//    (MONOCHROME_NEBULA_PALETTE): серо-чёрно-бело-голубоватые оттенки с тенями
//    (полностью исключен ржаво-рыжий цвет).
// 2. Контракт ячейки барабана (OdometerGlyphCellState): геометрия, фаза колеса,
//    параметры свечения, теней и дыхания.
// 3. Стохастический интегратор скорости (Ornstein-Uhlenbeck / хаотичные гармоники)
//    и устранение скачков через гладкую суперпозицию синусоид C∞.
// 4. Интерактивный отклик при наведении (notifyPointerHover) и плавное
//    кардио-дыхание зафиксированных строк в такт музыкальной теме.
// ============================================================================

import { DeterministicPRNG } from '../core/prng';
import { universeStore } from '../store/universeState';

// ============================================================================
// РАЗДЕЛ 1. КАНОНИЧЕСКИЕ СТРОКИ МАНИФЕСТА И МОНОХРОМНО-ТЕНЕВАЯ ПАЛИТРА
// ============================================================================

export const CANONICAL_FINALE_LINES: readonly [string, string, string, string, string] = [
    'DUBNOV ALEXEY // UNIVERSE — NEURO-COSMIC INSTALLATION',
    'POLYGLOT ARCHITECTURE : FROM ZERO TO ZERO (108 SEC)',
    '∑ ∆ Ω Ψ Φ Λ Π Ξ Θ ∇ ∂ ∫ ≈ ≠ ≡ ⊕ ⊗ ⊙ ◊ ◈ ✶ ✴ ⟨ ∞ ⟩',
    'ASTRO · TYPESCRIPT · REACT · WEBGPU/WGSL · RUST/WASM · PYTHON',
    'SYMPLECTIC PHYSICS · KURAMOTO SYNC · GABRIEL-MURRAY NEXUS',
];

// Индекс единственной центральной строки, которая вращается бесконечно
const ENDLESS_SPIN_LINE_INDEX = 2;

const QUANTUM_STREAM_GLYPHS =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡⊕⊗⊙⊥⊢⊣⟨⟩⟦⟧◊◈✶✴⟡∷';

/**
 * Благородная серо-чёрно-бело-голубоватая палитра с полутонами и глубокими тенями
 * (полностью заменен ржаво-рыжий цвет на холодные стальные и жемчужные полутона).
 */
const MONOCHROME_NEBULA_PALETTE: ReadonlyArray<{
    colorHex: string;
    shadowColor: string;
    shadowBlur: number;
}> = [
    {
        colorHex: '#f8fafc',
        shadowColor: 'rgba(186, 230, 253, 0.58)',
        shadowBlur: 14,
    },
    {
        colorHex: '#cbd5e1',
        shadowColor: 'rgba(15, 23, 42, 0.95)',
        shadowBlur: 10,
    },
    {
        colorHex: '#94a3b8',
        shadowColor: 'rgba(2, 6, 23, 0.96)',
        shadowBlur: 11,
    },
    {
        colorHex: '#bae6fd',
        shadowColor: 'rgba(125, 211, 252, 0.45)',
        shadowBlur: 15,
    },
    {
        colorHex: '#64748b',
        shadowColor: 'rgba(1, 3, 10, 0.98)',
        shadowBlur: 8,
    },
    {
        colorHex: '#38bdf8',
        shadowColor: 'rgba(56, 189, 248, 0.42)',
        shadowBlur: 13,
    },
    {
        colorHex: '#7dd3fc',
        shadowColor: 'rgba(125, 211, 252, 0.48)',
        shadowBlur: 14,
    },
    {
        colorHex: '#e2e8f0',
        shadowColor: 'rgba(30, 41, 59, 0.92)',
        shadowBlur: 11,
    },
];

// ============================================================================
// РАЗДЕЛ 2. СТРУКТУРА СОСТОЯНИЯ ЯЧЕЙКИ БАРАБАНА ОДОМЕТРА
// ============================================================================

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
    shadowColor: string;
    shadowBlur: number;
    glyphBreathAlpha: number;
}

// ============================================================================
// РАЗДЕЛ 3. КЛАСС ДВИЖКА ОДОМЕТРА (CipherOdometerEngine)
// ============================================================================

export class CipherOdometerEngine {
    private pointerX = -9999;
    private pointerY = -9999;
    private readonly hoverExcitedUntilMs: Map<number, number> = new Map();

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
        const safeWidth = Math.max(290, viewportWidth - 40);

        let idealFontPx = 15;
        let colorHex = '#cbd5e1';
        let fontWeight = '500';

        if (lineIndex === 0) {
            idealFontPx = 18.5;
            colorHex = '#f8fafc';
            fontWeight = '700';
        } else if (lineIndex === 1) {
            idealFontPx = 14.5;
            colorHex = '#bae6fd';
            fontWeight = '500';
        } else if (lineIndex === 2) {
            idealFontPx = 19.0;
            colorHex = '#cbd5e1';
            fontWeight = '600';
        } else if (lineIndex === 3) {
            idealFontPx = 15.5;
            colorHex = '#e2e8f0';
            fontWeight = '600';
        } else {
            idealFontPx = 13.5;
            colorHex = '#94a3b8';
            fontWeight = '500';
        }

        const maxStepAllowed = safeWidth / Math.max(1, charCount);
        const idealStep = idealFontPx * 0.68;
        const stepWidthPx = Math.min(idealStep, maxStepAllowed);
        const fontSizePx = Math.max(8.5, Math.min(idealFontPx, stepWidthPx / 0.62));

        return { fontSizePx, stepWidthPx, colorHex, fontWeight };
    }

    private computeChaoticWheelPosition(
        liveTimeSec: number,
        r1: number,
        r2: number,
        charIndex: number,
        reducedMotion: boolean
    ): number {
        if (reducedMotion) {
            return liveTimeSec * 1.15 + charIndex * 0.25 + r1 * 6.0;
        }

        const baseRate = 2.35 + r1 * 1.95;
        const slowChaos = 1.45 * Math.sin(liveTimeSec * 0.83 + r2 * 6.28 + charIndex * 0.19);
        const midChaos = 0.92 * Math.cos(liveTimeSec * 2.17 - r1 * 4.71 + charIndex * 0.37);
        const fastFlutter = 0.48 * Math.sin(liveTimeSec * 4.63 + (r1 + r2) * 5.1);

        return liveTimeSec * baseRate + slowChaos + midChaos + fastFlutter + r2 * 14.0;
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

        // C∞-гладкое кардио-дыхание визитки (устранены скачки и резкие пики систолы)
        const cardHeartbeat =
            p >= 0.82 && !reducedMotion
                ? 1.0 + 0.011 * Math.sin(liveTimeSec * 1.85) + 0.005 * Math.cos(liveTimeSec * 3.7)
                : 1.0;

        const lineOffsetsY = [-94, -50, -4, 42, 82];
        const cells: OdometerGlyphCellState[] = [];
        const nGlyphs = QUANTUM_STREAM_GLYPHS.length;
        const nShades = MONOCHROME_NEBULA_PALETTE.length;

        let globalIdx = 0;

        for (let lineIdx = 0; lineIdx < CANONICAL_FINALE_LINES.length; lineIdx++) {
            const lineStr = CANONICAL_FINALE_LINES[lineIdx];
            const len = lineStr.length;
            const typo = this.getLineTypography(lineIdx, len, viewportWidth);
            const lineWidth = len * typo.stepWidthPx;
            const startX = cx - lineWidth * 0.5 + typo.stepWidthPx * 0.5;
            const baseTargetY = cy + lineOffsetsY[lineIdx];

            for (let cIdx = 0; cIdx < len; cIdx++) {
                const targetChar = lineStr[cIdx];
                const baseTargetX = startX + cIdx * typo.stepWidthPx;

                const targetX = cx + (baseTargetX - cx) * cardHeartbeat;
                const targetY = cy + (baseTargetY - cy) * cardHeartbeat;

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

                const distToPointer = Math.hypot(this.pointerX - targetX, this.pointerY - targetY);
                if (distToPointer < 32 && p > 0.5) {
                    this.hoverExcitedUntilMs.set(globalIdx, nowMs + 850);
                }
                const excitedUntil = this.hoverExcitedUntilMs.get(globalIdx) ?? 0;
                const isHoverSpinning = nowMs < excitedUntil;

                const isEndlessLine = lineIdx === ENDLESS_SPIN_LINE_INDEX;
                const lockThreshold =
                    0.42 + lineIdx * 0.08 + (cIdx / Math.max(1, len)) * 0.22;
                const isLocked =
                    !isEndlessLine && !isHoverSpinning && p >= Math.min(0.82, lockThreshold);

                const chaoticWheelPos = this.computeChaoticWheelPosition(
                    liveTimeSec,
                    r1,
                    r2,
                    cIdx,
                    reducedMotion
                );

                const baseGlyphIdx = Math.floor(chaoticWheelPos) % nGlyphs;
                const wheelPhaseFrac = isLocked ? 0 : (chaoticWheelPos % 1.0) - 0.5;

                const individualBreath = isEndlessLine
                    ? 0.90 + 0.16 * Math.sin(liveTimeSec * 2.4 + cIdx * 0.48 + r1 * 5.0)
                    : 1.0;
                const verticalScale = isLocked
                    ? cardHeartbeat
                    : Math.max(0.46, Math.cos(wheelPhaseFrac * 1.15)) * individualBreath;

                const primaryChar = isLocked
                    ? targetChar
                    : QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs) % nGlyphs];
                const upperChar = QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs - 1) % nGlyphs];
                const lowerChar = QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + 1) % nGlyphs];

                let cellColor = typo.colorHex;
                let shadowColor = 'rgba(2, 6, 23, 0.92)';
                let shadowBlur = 8;
                let glyphBreathAlpha = 0.94;

                if (isEndlessLine || isHoverSpinning) {
                    const shadeWave =
                        Math.floor(
                            liveTimeSec * 1.65 +
                            Math.sin(liveTimeSec * 0.95 + cIdx * 0.4) * 2.2 +
                            cIdx * 0.55 +
                            r1 * 4.0
                        ) % nShades;
                    const shade = MONOCHROME_NEBULA_PALETTE[(shadeWave + nShades) % nShades];
                    cellColor = shade.colorHex;
                    shadowColor = shade.shadowColor;
                    shadowBlur = shade.shadowBlur;
                    glyphBreathAlpha =
                        0.62 + 0.36 * (0.5 + 0.5 * Math.sin(liveTimeSec * 2.1 + cIdx * 0.65 + r2 * 4.0));
                }

                // Исправлено: при переборе мыши используется чистый сине-белый акцент вместо ржаво-рыжего
                let lockFlash = 0;
                if (!isEndlessLine && p >= lockThreshold && p <= lockThreshold + 0.12) {
                    lockFlash = 1.0 - (p - lockThreshold) / 0.12;
                } else if (isHoverSpinning) {
                    lockFlash = 0.42;
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
                    fontSizePx: typo.fontSizePx * cardHeartbeat,
                    stepWidthPx: typo.stepWidthPx,
                    colorHex: lockFlash > 0.1 ? '#bae6fd' : cellColor,
                    fontWeight: typo.fontWeight,
                    shadowColor,
                    shadowBlur,
                    glyphBreathAlpha,
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
            (c: OdometerGlyphCellState) =>
                (c.lineIndex === ENDLESS_SPIN_LINE_INDEX || c.isLocked) &&
                c.targetX >= 4 &&
                c.targetX <= viewportWidth - 4
        );
    }
}

export const cipherOdometerEngine = new CipherOdometerEngine();