// ============================================================================
// ФАЙЛ: frontend/src/core/glyphGrammar.ts
// НАЗНАЧЕНИЕ: Фазовый словарь Unicode code points и точное восстановление текста.
// РАЗДЕЛЫ: 1. Семейства/профили; 2. Проверка шрифтов; 3. Детерминированный выбор.
// ФУНКЦИИ: getGlyphProfile, filterGlyphPool, supportsGlyph, getRenderableGlyphPool,
// pickGlyph, isMutableGlyph, scrambleCanonicalText, prepareGlyphFonts,
// invalidateGlyphFontCache, getGlyphFontEpoch, splitGlyphText, getOrderedGlyphState,
// formatOrderedGlyphText. Все пулы — полные code points; канон делится на графемы.
// ============================================================================
import type { PhaseId } from './contracts';

// НАЧАЛО РАЗДЕЛА 1. СЕМЕЙСТВА И ПРОФИЛИ
export const GLYPH_FONT_STACK = '"Universe Glyphs", "JetBrains Mono", "Fira Code", Consolas, "Segoe UI Historic", "Noto Sans Egyptian Hieroglyphs", "Segoe UI Symbol", monospace';
export const GLYPH_FAMILIES = Object.freeze({
    basic: Object.freeze(Array.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')),
    geometry: Object.freeze(Array.from('·∘○◌◈◇⋄⌁∷')),
    mathematics: Object.freeze(Array.from('∑∆ΩΨΦΛΠΞΘ∇∂∫∮∯∰ℏℓℵℶ∀∃∄∅∈∉⊂⊃⊆⊇⊢⊨⨂⨁ℝℂℚℤ⊗∝≜≅≃≈≠≡⟂⦿𝛁𝛑𝚫')),
    connectivity: Object.freeze(Array.from('⊕⊗⊙⊥⊢⊣⟨⟩⟦⟧◊◈✶✴⟡')),
    historical: Object.freeze(Array.from('𓀀𓁹𓂀𓆣𓇳𓋹𓏏𓆓𓊽𓎛𓂻𓈖𓅓𓃭𓊹𓐍')),
    runic: Object.freeze(Array.from('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛋᛏᛒᛖᛗᛚᛜᛞᛟ')),
    mayanNumerals: Object.freeze(Array.from({ length: 20 }, (_, value) => String.fromCodePoint(0x1D2E0 + value))),
    alchemical: Object.freeze(Array.from('🜁🜂🜃🜄🜍🜎🜏🜔🜕🜚🜛🜞')),
    astral: Object.freeze(Array.from('⌬⌭⏣⏥⍟⎔⌘⍜⍝⍞⍠⍡⍢⋈⋉⋊⋋⋌⟐⟢⟣⧆⧈⧉⨀⨂⨷')),
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
    '01_VOID': { pool: pool(GLYPH_FAMILIES.geometry, GLYPH_FAMILIES.historical, GLYPH_FAMILIES.runic, GLYPH_FAMILIES.mayanNumerals), density: 0.22, rollMs: 300, dwellMs: 420 },
    '02_GENESIS': { pool: pool(GLYPH_FAMILIES.basic, GLYPH_FAMILIES.geometry, GLYPH_FAMILIES.historical, GLYPH_FAMILIES.alchemical, GLYPH_FAMILIES.mayanNumerals), density: 0.27, rollMs: 280, dwellMs: 400 },
    '03_EVOLUTION': { pool: pool(GLYPH_FAMILIES.mathematics, GLYPH_FAMILIES.astral, GLYPH_FAMILIES.historical, GLYPH_FAMILIES.runic), density: 0.30, rollMs: 270, dwellMs: 400 },
    '04_COLLAPSE': { pool: pool(GLYPH_FAMILIES.connectivity, GLYPH_FAMILIES.mathematics, GLYPH_FAMILIES.astral, GLYPH_FAMILIES.alchemical, GLYPH_FAMILIES.runic), density: 0.34, rollMs: 260, dwellMs: 380 },
    '05_SINGULARITY': { pool: pool(GLYPH_FAMILIES.mathematics, GLYPH_FAMILIES.geometry, GLYPH_FAMILIES.historical, GLYPH_FAMILIES.mayanNumerals), density: 0.18, rollMs: 300, dwellMs: 440 },
});
const protectedGlyphs = new Set([
    ...GLYPH_FAMILIES.geometry, ...GLYPH_FAMILIES.mathematics,
    ...GLYPH_FAMILIES.connectivity, ...GLYPH_FAMILIES.historical,
    ...GLYPH_FAMILIES.runic, ...GLYPH_FAMILIES.mayanNumerals,
    ...GLYPH_FAMILIES.alchemical, ...GLYPH_FAMILIES.astral,
]);
// НАЧАЛО ФУНКЦИИ getGlyphProfile
export function getGlyphProfile(phase: PhaseId): GlyphProfile { return profiles[phase]; }
// КОНЕЦ ФУНКЦИИ getGlyphProfile
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПРОВЕРКА ОТОБРАЖЕНИЯ И FALLBACK
const renderablePools = new Map<PhaseId, readonly string[]>();
const glyphSupport = new Map<string, boolean>();
let probe: CanvasRenderingContext2D | null | undefined;
let missingInk: Uint8ClampedArray[] = [];
let fontEpoch = 0;
let fontLoadRequested = false;

// НАЧАЛО ФУНКЦИИ invalidateGlyphFontCache
export function invalidateGlyphFontCache(): void {
    renderablePools.clear(); glyphSupport.clear();
    probe = undefined; missingInk = []; fontEpoch++;
}
// КОНЕЦ ФУНКЦИИ invalidateGlyphFontCache
// НАЧАЛО ФУНКЦИИ getGlyphFontEpoch
export function getGlyphFontEpoch(): number { return fontEpoch; }
// КОНЕЦ ФУНКЦИИ getGlyphFontEpoch
// НАЧАЛО ФУНКЦИИ prepareGlyphFonts
/** Начальный кадр не ждёт шрифты; после загрузки проверяется настоящее начертание. */
export function prepareGlyphFonts(): void {
    if (fontLoadRequested || typeof document === 'undefined' || !document.fonts) return;
    fontLoadRequested = true;
    const sample = 'ᚠ' + String.fromCodePoint(0x1D2E0) + '∮𓂀🜁⌬';
    void document.fonts.load('18px "Universe Glyphs"', sample)
        .then(invalidateGlyphFontCache, invalidateGlyphFontCache);
}
// КОНЕЦ ФУНКЦИИ prepareGlyphFonts

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
    prepareGlyphFonts();
    if (!renderablePools.has(phase)) renderablePools.set(phase, filterGlyphPool(profiles[phase].pool, supportsGlyph));
    return renderablePools.get(phase)!;
}
// КОНЕЦ ФУНКЦИИ getRenderableGlyphPool
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ВЫБОР И ВОССТАНОВЛЕНИЕ
const textSegmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
export const GLYPH_WAITING_SPACE = '\u00A0';

// НАЧАЛО ФУНКЦИИ splitGlyphText
/** Не разделяет составные emoji, диакритику и символы за пределами BMP. */
export function splitGlyphText(text: string): string[] {
    return Array.from(textSegmenter.segment(text), (part) => part.segment);
}
// КОНЕЦ ФУНКЦИИ splitGlyphText

// НАЧАЛО ФУНКЦИИ getOrderedGlyphState
/** Один фронт: слева закреплённый текст, затем барабаны, справа пустые окна. */
export function getOrderedGlyphState(index: number, count: number, progress: number, rollingSpan = 0.28): {
    state: 'waiting' | 'rolling' | 'locked'; progress: number;
} {
    const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    const span = Math.max(0.01, Math.min(1, rollingSpan));
    const start = count > 1 ? index / (count - 1) * (1 - span) : 0;
    const local = (p - start) / span;
    if (p >= 1 || local >= 1 - 1e-9) return { state: 'locked', progress: 1 };
    if (local < -1e-9) return { state: 'waiting', progress: 0 };
    return { state: 'rolling', progress: Math.max(0, local) };
}
// КОНЕЦ ФУНКЦИИ getOrderedGlyphState

// НАЧАЛО ФУНКЦИИ formatOrderedGlyphText
/** Общая сборка статических строк DOM/Canvas; бесконечная строка сюда не входит. */
export function formatOrderedGlyphText(canonical: string, progress: number, step: number, glyphPool: readonly string[], offset = 0): string {
    const characters = splitGlyphText(canonical);
    return characters.map((character, index) => {
        const cell = getOrderedGlyphState(index, characters.length, progress);
        if (cell.state === 'waiting') return GLYPH_WAITING_SPACE;
        if (cell.state === 'locked' || !isMutableGlyph(character) || !glyphPool.length) return character;
        return glyphPool[((step + index * 5 + offset * 9) % glyphPool.length + glyphPool.length) % glyphPool.length];
    }).join('');
}
// КОНЕЦ ФУНКЦИИ formatOrderedGlyphText

// НАЧАЛО ФУНКЦИИ isMutableGlyph
export function isMutableGlyph(character: string, nextCharacter = ''): boolean {
    return !protectedGlyphs.has(character) && !/\p{Script=Egyptian_Hieroglyphs}/u.test(character) &&
        !/\p{M}/u.test(nextCharacter) && nextCharacter !== '\uFE0F' && nextCharacter !== '\u20E3' &&
        /^[\p{L}\p{N}]$/u.test(character);
}
// КОНЕЦ ФУНКЦИИ isMutableGlyph
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
        // Египетские письмена входят в Unicode Letter, но остаются частью канона.
        // Знаки грамматики и цифры emoji-keycap также нельзя разрывать заменой.
        if (index < lock || !isMutableGlyph(character, characters[index + 1]) || (index + offset) % stride !== 0) return character;
        return pickGlyph(phase, index + offset, step);
    }).join('');
}
// КОНЕЦ ФУНКЦИИ scrambleCanonicalText
// КОНЕЦ РАЗДЕЛА 3
