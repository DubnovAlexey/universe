// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/cipherOdometerEngine.ts
// НАЗНАЧЕНИЕ: Движок квантового одометра и персональной визитки v2.5 (MASTER 05)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Канонические строки визитки (CANONICAL_FINALE_LINES) с выделенной первой
//    строкой имени и фамилии автора ('DUBNOV ALEXEY') и 10-тоновая холодная
//    палитра полутонов и глубоких теней (MONOCHROME_NEBULA_PALETTE).
// 2. Контракт состояния ячейки барабана (OdometerGlyphCellState).
// 3. Класс CipherOdometerEngine:
//    - развёртывание всех строк визитки строго из центральной Точки Нуля (cx, cy),
//      в которую перед этим схлопнулась Чёрная дыра;
//    - синхронизация дыхания карточки (cardHeartbeat) с реальной музыкальной
//      огибающей cosmic_ambient.mp3 через audioSync;
//    - интерактивный квантовый ре-спин символов при наведении курсора мыши.
// ============================================================================

import { DeterministicPRNG } from '../core/prng';
import { smootherstep, universeStore } from '../store/universeState';
import { audioSync } from '../utils/audioSync';

// ============================================================================
// РАЗДЕЛ 1. КАНОНИЧЕСКИЕ СТРОКИ ВИЗИТКИ И МНОГОСЛОЙНАЯ ТЕНЕВАЯ ПАЛИТРА
// ============================================================================

export const CANONICAL_FINALE_LINES: readonly [string, string, string, string, string] = [
    'DUBNOV ALEXEY',
    'POLYGLOT ARCHITECTURE : FROM ZERO TO ZERO (108 SEC)',
    '∑ ∆ Ω Ψ Φ Λ Π Ξ Θ ∇ ∂ ∫ ≈ ≠ ≡ ⊕ ⊗ ⊙ ◊ ◈ ✶ ✴ ⟨ ∞ ⟩',
    'ASTRO · TYPESCRIPT · REACT · WEBGPU/WGSL · RUST/WASM · PYTHON',
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
// РАЗДЕЛ 3. КЛАСС ДВИЖКА ОДОМЕТРА И ВИЗИТКИ (CipherOdometerEngine)
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
            idealFontPx = 15.2;
            idealStepRatio = 0.67;
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

    private computeChaoticWheelPosition(
        liveTimeSec: number,
        r1: number,
        r2: number,
        charIndex: number,
        reducedMotion: boolean
    ): number {
        if (reducedMotion) {
            return liveTimeSec * 1.1 + charIndex * 0.25 + r1 * 6.0;
        }

        const baseRate = 2.15 + r1 * 1.75;
        const slowWave = 1.38 * Math.sin(liveTimeSec * 0.78 + r2 * 6.28 + charIndex * 0.21);
        const midWave = 0.86 * Math.cos(liveTimeSec * 1.94 - r1 * 4.71 + charIndex * 0.35);
        const fineWave = 0.42 * Math.sin(liveTimeSec * 3.85 + (r1 + r2) * 5.1);

        return liveTimeSec * baseRate + slowWave + midWave + fineWave + r2 * 14.0;
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

        // Синхронизируем дыхание визитки с реальной музыкальной огибающей cosmic_ambient.mp3
        const audioSnap = audioSync.getSnapshot(liveTimeSec);
        const breathEnvelope = reducedMotion ? 0.0 : smootherstep(0.6, 0.95, p);
        const musicBreathBoost = 1.0 + audioSnap.heartbeat * 0.45;
        const cardHeartbeat =
            1.0 +
            breathEnvelope *
            (0.009 * musicBreathBoost * Math.sin(liveTimeSec * 1.35) +
                0.004 * Math.cos(liveTimeSec * 2.7));
        const cardFloatY = breathEnvelope * Math.cos(liveTimeSec * 1.1) * 1.6;

        // В самом начале выхода из центральной точки масштаб символов растёт от 0.15 до 1.0
        const emergeScale = 0.15 + 0.85 * smootherstep(0.0, 0.28, p);

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

                // Все символы визитки выходят строго из центральной Точки Нуля (cx, cy),
                // куда перед этим схлопнулась Чёрная дыра (радиус зарождения 0..5 px)
                const startAngle = r1 * Math.PI * 2;
                const pinpointRadius = r2 * 4.5;
                const originX = cx + Math.cos(startAngle) * pinpointRadius;
                const originY = cy + Math.sin(startAngle) * pinpointRadius;

                const gatherT = smootherstep(0.0, 0.46, p);
                const spiralArc =
                    Math.sin(gatherT * Math.PI) * (r1 - 0.5) * 28.0 * (1.0 - gatherT);

                const currentX =
                    originX + (targetX - originX) * gatherT + spiralArc;
                const currentY =
                    originY + (targetY - originY) * gatherT - spiralArc * 0.45;

                const distToPointer = Math.hypot(
                    this.pointerX - targetX,
                    this.pointerY - targetY
                );
                const hoverRadius = lineIdx === 0 ? 38 : 30;
                if (distToPointer < hoverRadius && p > 0.5) {
                    this.hoverExcitedUntilMs.set(globalIdx, nowMs + 860);
                }
                const excitedUntil = this.hoverExcitedUntilMs.get(globalIdx) ?? 0;
                const hoverRemainingMs = Math.max(0, excitedUntil - nowMs);
                const isHoverSpinning = hoverRemainingMs > 0;

                const isEndlessLine = lineIdx === ENDLESS_SPIN_LINE_INDEX;
                const lockThreshold =
                    0.42 + lineIdx * 0.08 + (cIdx / Math.max(1, len)) * 0.22;
                const isLocked =
                    !isEndlessLine &&
                    !isHoverSpinning &&
                    p >= Math.min(0.82, lockThreshold);

                const hoverSpeedBoost = isHoverSpinning
                    ? smootherstep(0, 860, hoverRemainingMs) * 1.85
                    : 0.0;

                const chaoticWheelPos =
                    this.computeChaoticWheelPosition(
                        liveTimeSec,
                        r1,
                        r2,
                        cIdx,
                        reducedMotion
                    ) + hoverSpeedBoost;

                const baseGlyphIdx = Math.floor(chaoticWheelPos) % nGlyphs;
                const wheelPhaseFrac = isLocked ? 0 : (chaoticWheelPos % 1.0) - 0.5;

                const individualBreath = isEndlessLine
                    ? 0.92 +
                    0.12 *
                    musicBreathBoost *
                    Math.sin(liveTimeSec * 1.85 + cIdx * 0.44 + r1 * 5.0)
                    : 1.0;
                const verticalScale =
                    (isLocked
                        ? cardHeartbeat
                        : Math.max(0.52, Math.cos(wheelPhaseFrac * 1.08)) *
                        individualBreath) * emergeScale;

                const primaryChar = isLocked
                    ? targetChar
                    : QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs) % nGlyphs];
                const upperChar =
                    QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + nGlyphs - 1) % nGlyphs];
                const lowerChar = QUANTUM_STREAM_GLYPHS[(baseGlyphIdx + 1) % nGlyphs];

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
                            liveTimeSec * 2.1 +
                            Math.sin(liveTimeSec * 1.1 + cIdx * 0.45) * 2.6 +
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
                        (0.66 +
                            0.32 *
                            (0.5 +
                                0.5 *
                                Math.sin(
                                    liveTimeSec * 1.85 + cIdx * 0.55 + r2 * 4.0
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