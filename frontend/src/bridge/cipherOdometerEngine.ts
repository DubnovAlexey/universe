// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/cipherOdometerEngine.ts
// НАЗНАЧЕНИЕ: Движок квантового одометра и персональной визитки v2.5 (MASTER 05)
// ============================================================================

import { DeterministicPRNG } from '../core/prng';
import { smootherstep, universeStore } from '../store/universeState';
import { audioSync } from '../utils/audioSync';

export const CANONICAL_FINALE_LINES: readonly [string, string, string, string, string] = [
    'DUBNOV ALEXEY',
    'POLYGLOT ARCHITECTURE : FROM ZERO TO ZERO (108 SEC)',
    '∑ ∆ Ω Ψ Φ Λ Π Ξ Θ ∇ ∂ ∫ ≈ ≠ ≡ ⊕ ⊗ ⊙ ◊ ◈ ✶ ✴ ⟨ ∞ ⟩',
    'ASTRO · TYPESCRIPT · CUSTOM JSX DOM · CANVAS2D/WGSL · RUST/WASM · PYTHON',
    'SYMPLECTIC PHYSICS · KURAMOTO SYNC · GABRIEL-MURRAY NEXUS',
];

const ENDLESS_SPIN_LINE_INDEX = 2;

const QUANTUM_STREAM_GLYPHS =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡⊕⊗⊙⊥⊢⊣⟨⟩⟦⟧◊◈✶✴⟡∷';

const MONOCHROME_NEBULA_PALETTE: ReadonlyArray<{
    colorHex: string;
    shadowColor: string;
    shadowBlur: number;
}> = [
    {
        colorHex: '#f8fafc',
        shadowColor: 'rgba(186, 230, 253, 0.62)',
        shadowBlur: 15,
    },
    {
        colorHex: '#e0f2fe',
        shadowColor: 'rgba(125, 211, 252, 0.54)',
        shadowBlur: 14,
    },
    {
        colorHex: '#bae6fd',
        shadowColor: 'rgba(56, 189, 248, 0.48)',
        shadowBlur: 15,
    },
    {
        colorHex: '#7dd3fc',
        shadowColor: 'rgba(14, 165, 233, 0.52)',
        shadowBlur: 14,
    },
    {
        colorHex: '#38bdf8',
        shadowColor: 'rgba(2, 132, 199, 0.46)',
        shadowBlur: 13,
    },
    {
        colorHex: '#e2e8f0',
        shadowColor: 'rgba(15, 23, 42, 0.94)',
        shadowBlur: 11,
    },
    {
        colorHex: '#cbd5e1',
        shadowColor: 'rgba(15, 23, 42, 0.96)',
        shadowBlur: 10,
    },
    {
        colorHex: '#94a3b8',
        shadowColor: 'rgba(2, 6, 23, 0.96)',
        shadowBlur: 11,
    },
    {
        colorHex: '#64748b',
        shadowColor: 'rgba(1, 3, 10, 0.98)',
        shadowBlur: 9,
    },
    {
        colorHex: '#475569',
        shadowColor: 'rgba(1, 2, 8, 0.99)',
        shadowBlur: 8,
    },
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
    shadowColor: string;
    shadowBlur: number;
    glyphBreathAlpha: number;
}

export class CipherOdometerEngine {
    private pointerX = -9999;
    private pointerY = -9999;
    private readonly hoverExcitedUntilMs: Map<number, number> = new Map();
    private accumulatedSpinPhase = 0;
    private lfoClockSec = 0;
    private lastEvalTimeSec = -1;

    public notifyPointerHover(clientX: number, clientY: number): void {
        this.pointerX = clientX;
        this.pointerY = clientY;
    }

    public resetClockForTest(startSec = 0): void {
        this.accumulatedSpinPhase = 0;
        this.lfoClockSec = 0;
        this.lastEvalTimeSec = startSec;
    }

    public getAccumulatedSpinPhase(): number {
        return this.accumulatedSpinPhase;
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
        const safeWidth = Math.max(296, viewportWidth - 36);

        let idealFontPx = 15.0;
        let idealStepRatio = 0.68;
        let colorHex = '#cbd5e1';
        let fontWeight = '500';

        if (lineIndex === 0) {
            idealFontPx = 25.5;
            idealStepRatio = 0.78;
            colorHex = '#f8fafc';
            fontWeight = '700';
        } else if (lineIndex === 1) {
            idealFontPx = 14.5;
            idealStepRatio = 0.68;
            colorHex = '#bae6fd';
            fontWeight = '500';
        } else if (lineIndex === 2) {
            idealFontPx = 19.0;
            idealStepRatio = 0.68;
            colorHex = '#cbd5e1';
            fontWeight = '600';
        } else if (lineIndex === 3) {
            idealFontPx = 14.2;
            idealStepRatio = 0.66;
            colorHex = '#e2e8f0';
            fontWeight = '600';
        } else {
            idealFontPx = 13.5;
            idealStepRatio = 0.67;
            colorHex = '#94a3b8';
            fontWeight = '500';
        }

        const maxStepAllowed = safeWidth / Math.max(1, charCount);
        const idealStep = idealFontPx * idealStepRatio;
        const stepWidthPx = Math.min(idealStep, maxStepAllowed);
        const fontSizePx = Math.max(
            8.5,
            Math.min(idealFontPx, stepWidthPx / Math.min(0.64, idealStepRatio))
        );

        return { fontSizePx, stepWidthPx, colorHex, fontWeight };
    }

    /**
     * Монотонно накапливает базовую фазу квантового барабана через приращение dtSec
     * в едином диапазоне [18.0 .. 26.0] Гц (в полном паритете с Layer5_CipherFinale.tsx).
     */
    public advanceBoundedSpinPhase(
        liveTimeSec: number,
        reducedMotion: boolean,
        isSimActive: boolean,
        heartbeat: number
    ): number {
        if (this.lastEvalTimeSec < 0 || liveTimeSec < this.lastEvalTimeSec) {
            this.lastEvalTimeSec = liveTimeSec;
        }
        const rawDt = liveTimeSec - this.lastEvalTimeSec;
        this.lastEvalTimeSec = liveTimeSec;

        if (!isSimActive) {
            return this.accumulatedSpinPhase;
        }

        const clampedDt = Math.max(0, Math.min(0.05, rawDt));
        this.lfoClockSec += clampedDt;

        if (reducedMotion) {
            this.accumulatedSpinPhase += clampedDt * 0.85;
            return this.accumulatedSpinPhase;
        }

        const lfoMod =
            3.2 * Math.sin(this.lfoClockSec * 0.85) +
            1.8 * Math.cos(this.lfoClockSec * 1.75);
        const boundedRateHz = Math.max(
            18.0,
            Math.min(26.0, 21.5 + lfoMod + heartbeat * 2.5)
        );
        this.accumulatedSpinPhase += clampedDt * boundedRateHz;
        return this.accumulatedSpinPhase;
    }

    public evaluateCells(
        viewportWidth: number,
        viewportHeight: number,
        assemblyProgress: number,
        reducedMotion: boolean,
        overrideLiveTimeSec?: number
    ): OdometerGlyphCellState[] {
        const p = Math.max(0, Math.min(1, assemblyProgress));
        const uState = universeStore.getState();
        const seed = uState.seed;
        const isSimActive = !uState.isPaused && !uState.isTabHidden;
        const cx = viewportWidth * 0.5;
        const cy = viewportHeight * 0.5;
        const nowMs =
            overrideLiveTimeSec !== undefined
                ? overrideLiveTimeSec * 1000
                : typeof performance !== 'undefined'
                    ? performance.now()
                    : p * 10000;
        const liveTimeSec = nowMs * 0.001;

        const audioSnap = audioSync.getSnapshot(this.lfoClockSec);
        const baseSpinPhase = this.advanceBoundedSpinPhase(
            liveTimeSec,
            reducedMotion,
            isSimActive,
            audioSnap.heartbeat
        );

        const breathEnvelope =
            reducedMotion || !isSimActive ? 0.0 : smootherstep(0.55, 0.92, p);
        const musicBreathBoost = 1.0 + audioSnap.heartbeat * 0.45;
        const cardHeartbeat =
            1.0 +
            breathEnvelope *
            (0.008 * musicBreathBoost * Math.sin(this.lfoClockSec * 1.3) +
                0.003 * Math.cos(this.lfoClockSec * 2.5));
        const cardFloatY = breathEnvelope * Math.cos(this.lfoClockSec * 1.05) * 1.6;
        const emergeScale = 0.12 + 0.88 * smootherstep(0.0, 0.32, p);

        const lineOffsetsY = [-98, -50, -4, 42, 82];
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
                const targetY = cy + (baseTargetY - cy) * cardHeartbeat + cardFloatY;

                const r1 = DeterministicPRNG.hashFloat(seed, globalIdx * 31 + 7);
                const r2 = DeterministicPRNG.hashFloat(seed, globalIdx * 31 + 13);

                const startAngle = r1 * Math.PI * 2;
                const pinpointRadius = r2 * 4.0;
                const originX = cx + Math.cos(startAngle) * pinpointRadius;
                const originY = cy + Math.sin(startAngle) * pinpointRadius;

                const gatherT = smootherstep(0.0, 0.44, p);
                const spiralArc =
                    Math.sin(gatherT * Math.PI) * (r1 - 0.5) * 26.0 * (1.0 - gatherT);

                const currentX =
                    originX + (targetX - originX) * gatherT + spiralArc;
                const currentY =
                    originY + (targetY - originY) * gatherT - spiralArc * 0.45;

                const distToPointer = Math.hypot(
                    this.pointerX - targetX,
                    this.pointerY - targetY
                );
                const hoverRadius = lineIdx === 0 ? 38 : 30;
                if (distToPointer < hoverRadius && p > 0.5 && isSimActive) {
                    this.hoverExcitedUntilMs.set(globalIdx, nowMs + 860);
                }
                const excitedUntil = this.hoverExcitedUntilMs.get(globalIdx) ?? 0;
                const hoverRemainingMs = Math.max(0, excitedUntil - nowMs);
                const isHoverSpinning = hoverRemainingMs > 0;

                const isEndlessLine = lineIdx === ENDLESS_SPIN_LINE_INDEX;
                const lockThreshold =
                    0.18 + lineIdx * 0.06 + (cIdx / Math.max(1, len)) * 0.32;
                const isLocked =
                    !isEndlessLine &&
                    !isHoverSpinning &&
                    p >= Math.min(0.76, lockThreshold);

                const hoverSpeedBoost = isHoverSpinning
                    ? smootherstep(0, 860, hoverRemainingMs) * 2.4
                    : 0.0;

                // Индивидуальный делитель слота (0.5 или 0.35), дающий ~8–11 видимых смен символа/с
                const slotFactor = cIdx % 3 === 0 ? 0.5 : 0.38;
                const cellWheelPos =
                    baseSpinPhase * slotFactor +
                    cIdx * 0.35 +
                    r2 * 12.0 +
                    hoverSpeedBoost;

                const baseGlyphIdx = Math.floor(cellWheelPos) % nGlyphs;
                const wheelPhaseFrac = isLocked ? 0 : (cellWheelPos % 1.0) - 0.5;

                const individualBreath = isEndlessLine
                    ? 0.92 +
                    0.1 *
                    musicBreathBoost *
                    Math.sin(this.lfoClockSec * 1.65 + cIdx * 0.44 + r1 * 5.0)
                    : 1.0;
                const verticalScale =
                    (isLocked
                        ? cardHeartbeat
                        : Math.max(0.54, Math.cos(wheelPhaseFrac * 1.05)) *
                        individualBreath) * emergeScale;

                const primaryChar = isLocked
                    ? targetChar
                    : QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs) % nGlyphs];
                const upperChar =
                    QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs - 1) % nGlyphs];
                const lowerChar =
                    QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + 1) % nGlyphs];

                let cellColor = typo.colorHex;
                let shadowColor =
                    lineIdx === 0
                        ? 'rgba(125, 211, 252, 0.46)'
                        : 'rgba(2, 6, 23, 0.94)';
                let shadowBlur = lineIdx === 0 ? 14 : 9;
                let glyphBreathAlpha = 0.95 * smootherstep(0.0, 0.18, p);

                if (isEndlessLine || isHoverSpinning || !isLocked) {
                    const shadeWave =
                        Math.floor(
                            baseSpinPhase * 0.45 +
                            cIdx * 0.7 +
                            lineIdx * 1.7 +
                            r1 * 5.0
                        ) % nShades;
                    const shade =
                        MONOCHROME_NEBULA_PALETTE[(shadeWave + nShades) % nShades];
                    cellColor = shade.colorHex;
                    shadowColor = shade.shadowColor;
                    shadowBlur = shade.shadowBlur;
                    glyphBreathAlpha =
                        (0.68 +
                            0.3 *
                            (0.5 +
                                0.5 *
                                Math.sin(
                                    this.lfoClockSec * 1.65 +
                                    cIdx * 0.55 +
                                    r2 * 4.0
                                ))) *
                        smootherstep(0.0, 0.18, p);
                }

                let lockFlash = 0;
                if (
                    !isEndlessLine &&
                    p >= lockThreshold &&
                    p <= lockThreshold + 0.12
                ) {
                    lockFlash = 1.0 - (p - lockThreshold) / 0.12;
                } else if (isHoverSpinning) {
                    lockFlash = Math.min(0.48, (hoverRemainingMs / 860) * 0.48);
                }

                const flashPalette = ['#f8fafc', '#e0f2fe', '#bae6fd', '#7dd3fc'];
                const resolvedColor =
                    lockFlash > 0.14
                        ? flashPalette[(cIdx + lineIdx) % flashPalette.length]
                        : cellColor;

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
                    fontSizePx: typo.fontSizePx * cardHeartbeat * emergeScale,
                    stepWidthPx: typo.stepWidthPx,
                    colorHex: resolvedColor,
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
        this.pointerX = -9999;
        this.pointerY = -9999;
        this.hoverExcitedUntilMs.clear();

        const cells = this.evaluateCells(viewportWidth, viewportHeight, 1.0, false);
        if (cells.length === 0) return false;
        return cells.every(
            (c: OdometerGlyphCellState) =>
                (c.lineIndex === ENDLESS_SPIN_LINE_INDEX || c.isLocked) &&
                c.targetX >= 8 &&
                c.targetX <= viewportWidth - 8
        );
    }
}

export const cipherOdometerEngine = new CipherOdometerEngine();