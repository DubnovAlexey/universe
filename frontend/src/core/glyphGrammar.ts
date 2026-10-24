// ============================================================================
// ФАЙЛ: frontend/src/core/glyphGrammar.ts
// НАЗНАЧЕНИЕ: Фазовый словарь Unicode code points и точное восстановление текста.
// РАЗДЕЛЫ: 1. Семейства/профили; 2. Проверка шрифтов; 3. Детерминированный выбор.
// ФУНКЦИИ: getGlyphProfile, filterGlyphPool, supportsGlyph, getRenderableGlyphPool,
// pickGlyph, scrambleCanonicalText. Все пулы — массивы полных code points.
// ============================================================================
import type { PhaseId } from '../store/universeState';

// НАЧАЛО РАЗДЕЛА 1. СЕМЕЙСТВА И ПРОФИЛИ
export const GLYPH_FONT_STACK = '"JetBrains Mono", "Fira Code", Consolas, "Segoe UI Historic", "Noto Sans Egyptian Hieroglyphs", "Segoe UI Symbol", monospace';
export const GLYPH_FAMILIES = Object.freeze({
    basic: Object.freeze(Array.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')),
    geometry: Object.freeze(Array.from('·∘○◌◈◇⋄⌁∷')),
    mathematics: Object.freeze(Array.from('∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡𝛁𝛑𝚫')),
    connectivity: Object.freeze(Array.from('⊕⊗⊙⊥⊢⊣⟨⟩⟦⟧◊◈✶✴⟡')),
    historical: Object.freeze(Array.from('𓀀𓂀𓆣𓇳𓋹𓏏')),
});
export interface GlyphProfile {
    readonly pool: readonly string[];
    readonly density: number;
    readonly rollMs: number;
    readonly dwellMs: number;
}
// НАЧАЛО ФУНКЦИИ pool
const pool = (...families: (readonly string[])[]): readonly string[] => Object.freeze([...new Set(families.flat())]);
// КОНЕЦ ФУНКЦИИ pool
const profiles: Readonly<Record<PhaseId, GlyphProfile>> = Object.freeze({
    '01_VOID': { pool: pool(GLYPH_FAMILIES.geometry, GLYPH_FAMILIES.basic.slice(0, 10), GLYPH_FAMILIES.historical), density: 0.22, rollMs: 180, dwellMs: 300 },
    '02_GENESIS': { pool: pool(GLYPH_FAMILIES.basic, GLYPH_FAMILIES.geometry, GLYPH_FAMILIES.historical), density: 0.27, rollMs: 170, dwellMs: 280 },
    '03_EVOLUTION': { pool: pool(GLYPH_FAMILIES.mathematics, GLYPH_FAMILIES.basic, GLYPH_FAMILIES.historical), density: 0.30, rollMs: 160, dwellMs: 280 },
    '04_COLLAPSE': { pool: pool(GLYPH_FAMILIES.connectivity, GLYPH_FAMILIES.mathematics, GLYPH_FAMILIES.historical), density: 0.34, rollMs: 160, dwellMs: 300 },
    '05_SINGULARITY': { pool: pool(GLYPH_FAMILIES.mathematics, GLYPH_FAMILIES.geometry, GLYPH_FAMILIES.basic.slice(0, 16), GLYPH_FAMILIES.historical), density: 0.18, rollMs: 180, dwellMs: 320 },
});
// НАЧАЛО ФУНКЦИИ getGlyphProfile
export function getGlyphProfile(phase: PhaseId): GlyphProfile { return profiles[phase]; }
// КОНЕЦ ФУНКЦИИ getGlyphProfile
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПРОВЕРКА ОТОБРАЖЕНИЯ И FALLBACK
const renderablePools = new Map<PhaseId, readonly string[]>();
const glyphSupport = new Map<string, boolean>();
let probe: CanvasRenderingContext2D | null | undefined;
let missingInk: Uint8ClampedArray[] = [];

// НАЧАЛО ФУНКЦИИ filterGlyphPool
export function filterGlyphPool(candidates: readonly string[], supported: (glyph: string) => boolean): readonly string[] {
    const accepted = candidates.filter(supported);
    return accepted.length ? Object.freeze(accepted) : GLYPH_FAMILIES.basic;
}
// КОНЕЦ ФУНКЦИИ filterGlyphPool

// НАЧАЛО ФУНКЦИИ rasterize
function rasterize(context: CanvasRenderingContext2D, glyph: string): Uint8ClampedArray {
    context.clearRect(0, 0, 48, 40);
    context.fillText(glyph, 4, 28);
    return context.getImageData(0, 0, 48, 40).data;
}
// КОНЕЦ ФУНКЦИИ rasterize

// НАЧАЛО ФУНКЦИИ supportsGlyph
function supportsGlyph(glyph: string): boolean {
    if ((glyph.codePointAt(0) ?? 0) < 128) return true;
    if (glyphSupport.has(glyph)) return glyphSupport.get(glyph)!;
    if (probe === undefined) {
        try {
            probe = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d', { willReadFrequently: true });
            if (probe) {
                probe.canvas.width = 48; probe.canvas.height = 40;
                probe.font = `22px ${GLYPH_FONT_STACK}`;
                probe.fillStyle = '#fff';
                missingInk = ['\u{10FFFF}', '\uFFFF', '\uFFFD'].map((ch) => rasterize(probe!, ch));
            }
        } catch { probe = null; }
    }
    if (!probe) return false;
    let ink: Uint8ClampedArray;
    try { ink = rasterize(probe, glyph); } catch {
        glyphSupport.set(glyph, false);
        return false;
    }
    let hasInk = false;
    const resemblesMissing = missingInk.some((missing) => {
        let union = 0, intersection = 0;
        for (let i = 3; i < ink.length; i += 4) {
            const a = ink[i] > 64, b = missing[i] > 64;
            if (a) hasInk = true;
            if (a || b) union++;
            if (a && b) intersection++;
        }
        return union > 0 && intersection / union > 0.72;
    });
    const supported = hasInk && !resemblesMissing;
    glyphSupport.set(glyph, supported);
    return supported;
}
// КОНЕЦ ФУНКЦИИ supportsGlyph

// НАЧАЛО ФУНКЦИИ getRenderableGlyphPool
export function getRenderableGlyphPool(phase: PhaseId): readonly string[] {
    if (!renderablePools.has(phase)) renderablePools.set(phase, filterGlyphPool(profiles[phase].pool, supportsGlyph));
    return renderablePools.get(phase)!;
}
// КОНЕЦ ФУНКЦИИ getRenderableGlyphPool
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ВЫБОР И ВОССТАНОВЛЕНИЕ
// НАЧАЛО ФУНКЦИИ pickGlyph
export function pickGlyph(phase: PhaseId, index: number, step: number, seed = 104729): string {
    const candidates = getRenderableGlyphPool(phase);
    const slot = ((Math.floor(index) * 19 + Math.floor(step) * 7 + (seed >>> 0)) % candidates.length + candidates.length) % candidates.length;
    return candidates[slot];
}
// КОНЕЦ ФУНКЦИИ pickGlyph

// НАЧАЛО ФУНКЦИИ scrambleCanonicalText
export function scrambleCanonicalText(canonical: string, phase: PhaseId, step: number, progress: number, offset = 0): string {
    if (progress >= 1) return canonical;
    const characters = Array.from(canonical);
    const lock = Math.floor(Math.max(0, progress) * characters.length);
    const stride = Math.max(3, Math.round(1 / profiles[phase].density));
    return characters.map((character, index) => {
        if (index < lock || !/^[A-Za-z0-9]$/u.test(character) || (index + offset) % stride !== 0) return character;
        return pickGlyph(phase, index + offset, step);
    }).join('');
}
// КОНЕЦ ФУНКЦИИ scrambleCanonicalText
// КОНЕЦ РАЗДЕЛА 3
