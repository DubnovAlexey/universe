// ============================================================================
// ФАЙЛ: frontend/src/tests/glyphFontBudget.test.ts
// НАЗНАЧЕНИЕ: Ограничить синхронные проверки шрифта на общем кадре без потери словаря.
// РАЗДЕЛЫ: 1. Растровая модель шрифта; 2. Бюджет, кеш и смена поколения.
// ФУНКЦИИ: runGlyphFontBudgetChecks.
// ============================================================================
import {
    GLYPH_FAMILIES, getGlyphFontEpoch, getGlyphProfile, getRenderableGlyphPool, invalidateGlyphFontCache,
} from '../core/glyphGrammar';
import { publishVisualSignals } from '../core/visualSignals';
import { universeStore } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { audioSync } from '../utils/audioSync';

// НАЧАЛО ФУНКЦИИ runGlyphFontBudgetChecks
export function runGlyphFontBudgetChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 1. РАСТРОВАЯ МОДЕЛЬ ШРИФТА
    const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const state = universeStore.getState();
    const audio = audioSync.getSnapshot(0);
    const stress = stressStore.getState();
    const phases = ['01_VOID', '02_GENESIS', '03_EVOLUTION', '04_COLLAPSE', '05_SINGULARITY'] as const;
    const references = new Set(['\u{10FFFF}', '\uFFFF', '\uFFFD']);
    const missing = new Set(['∮']);
    const empty = new Set(['∑']);
    const reads: string[] = [];
    let paintedGlyph = '';
    const context = {
        canvas: { width: 0, height: 0 }, font: '', fillStyle: '',
        clearRect: (): void => {},
        fillText: (glyph: string): void => { paintedGlyph = glyph; },
        getImageData: (): { data: Uint8ClampedArray } => {
            reads.push(paintedGlyph);
            const data = new Uint8ClampedArray(48 * 40 * 4);
            if (!empty.has(paintedGlyph)) {
                const pixel = references.has(paintedGlyph) || missing.has(paintedGlyph)
                    ? 0 : 100 + (paintedGlyph.codePointAt(0) ?? 0) % 1000;
                data[pixel * 4 + 3] = 255;
            }
            return { data };
        },
    };
    const document = { createElement: (): { getContext: () => typeof context } => ({ getContext: () => context }) };
    let frameStart = 0, maximumReads = 0;
    const nextFrame = (): void => {
        maximumReads = Math.max(maximumReads, reads.length - frameStart);
        frameStart = reads.length;
        publishVisualSignals(state, audio, stress);
    };
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. БЮДЖЕТ, КЕШ И СМЕНА ПОКОЛЕНИЯ
    try {
        Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
        invalidateGlyphFontCache(); nextFrame();
        const cold = getRenderableGlyphPool('05_SINGULARITY');
        check(reads.length === 4 && reads.filter(glyph => references.has(glyph)).length === 3 &&
            cold === GLYPH_FAMILIES.basic && Object.isFrozen(cold),
        'A cold font pool spends at most4 raster reads, including3 missing-glyph references, and returns a frozen usable fallback');

        for (let repeat = 0; repeat < 30; repeat++) phases.forEach(phase => getRenderableGlyphPool(phase));
        const ascii = getRenderableGlyphPool('02_GENESIS');
        check(reads.length === 4 && GLYPH_FAMILIES.basic.every(glyph => ascii.includes(glyph)) && Object.isFrozen(ascii),
        'Repeated pool and per-cell calls share one frame budget while ASCII and cached checks remain free');

        for (let frame = 0; frame < 80; frame++) {
            nextFrame(); phases.forEach(phase => getRenderableGlyphPool(phase));
        }
        check(phases.every(phase => {
            const actual = getRenderableGlyphPool(phase);
            const expected = getGlyphProfile(phase).pool.filter(glyph => !missing.has(glyph) && !empty.has(glyph));
            return Object.isFrozen(actual) && JSON.stringify(actual) === JSON.stringify(expected);
        }),
        'Incremental probing eventually restores every supported phase glyph in order and rejects missing or empty ink');

        const warm = phases.map(phase => getRenderableGlyphPool(phase));
        const warmReadCount = reads.length;
        for (let repeat = 0; repeat < 20; repeat++) {
            nextFrame(); phases.forEach(phase => getRenderableGlyphPool(phase));
        }
        check(reads.length === warmReadCount && phases.every((phase, index) => getRenderableGlyphPool(phase) === warm[index]),
        'Complete phase pools retain immutable identity and perform no further raster readbacks on later frames');

        nextFrame();
        const oldEpoch = getGlyphFontEpoch();
        invalidateGlyphFontCache();
        const epochReadStart = reads.length;
        getRenderableGlyphPool('05_SINGULARITY');
        invalidateGlyphFontCache();
        for (let repeat = 0; repeat < 30; repeat++) getRenderableGlyphPool('05_SINGULARITY');
        check(getGlyphFontEpoch() === oldEpoch + 2 && reads.length - epochReadStart === 4 &&
            getRenderableGlyphPool('05_SINGULARITY') === GLYPH_FAMILIES.basic,
        'Repeated font invalidation in one visual frame clears stale support without replenishing its raster budget');

        missing.clear(); empty.clear();
        for (let frame = 0; frame < 80; frame++) {
            nextFrame(); phases.forEach(phase => getRenderableGlyphPool(phase));
        }
        maximumReads = Math.max(maximumReads, reads.length - frameStart);
        check(maximumReads <= 4 && phases.every(phase => JSON.stringify(getRenderableGlyphPool(phase)) === JSON.stringify(getGlyphProfile(phase).pool)),
        'New font generations recheck formerly missing glyphs and converge to full pools without any frame exceeding4 readbacks');
    } finally {
        if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument);
        else Reflect.deleteProperty(globalThis, 'document');
        invalidateGlyphFontCache();
        publishVisualSignals(state, audio, stress);
    }
    // КОНЕЦ РАЗДЕЛА 2
}
// КОНЕЦ ФУНКЦИИ runGlyphFontBudgetChecks
