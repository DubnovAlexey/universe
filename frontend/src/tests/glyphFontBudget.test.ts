// ============================================================================
// ФАЙЛ: frontend/src/tests/glyphFontBudget.test.ts
// НАЗНАЧЕНИЕ: Ограничить проверки шрифта и повторную сегментацию неизменного канона.
// РАЗДЕЛЫ: 1. Растровая модель шрифта; 2. Бюджет, кеш, смена поколения и bounded prewarm;
//          3. Графемы канона.
// ФУНКЦИИ: runGlyphFontBudgetChecks.
// ============================================================================
import {
    CANONICAL_GLYPH_CACHE_LIMIT, CANONICAL_GLYPH_CACHE_MAX_LENGTH,
    GLYPH_FAMILIES, getCanonicalGlyphText, getGlyphFontEpoch, getGlyphProfile, getRenderableGlyphPool,
    invalidateGlyphFontCache, prewarmGlyphPool, splitGlyphText,
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

        // Прогрев использует настоящий rasterize/getImageData, а не счётчик вызовов экспортируемого wrapper.
        reads.length = 0; frameStart = 0; maximumReads = 0;
        invalidateGlyphFontCache(); nextFrame();
        let warmupLimit = true;
        for (let frame = 0; frame < 3; frame++) {
            if (frame) nextFrame();
            const before = reads.length;
            for (let repeat = 0; repeat < 20; repeat++) prewarmGlyphPool('05_SINGULARITY');
            warmupLimit &&= reads.length - before === 1;
        }
        check(warmupLimit && reads.length === 3 && reads.every(glyph => references.has(glyph)),
        'Cold prewarm spends exactly one shared readback per frame, completes its three references over three frames and never classifies a glyph before all references exist');

        const firstGlyphRead = reads.length;
        for (let frame = 0; frame < getGlyphProfile('05_SINGULARITY').pool.length + 2; frame++) {
            nextFrame();
            const before = reads.length;
            for (let repeat = 0; repeat < 20; repeat++) prewarmGlyphPool('05_SINGULARITY');
            warmupLimit &&= reads.length - before <= 1;
        }
        const beforeCompleted = reads.length;
        const prewarmed = getRenderableGlyphPool('05_SINGULARITY');
        check(warmupLimit && reads[firstGlyphRead] === getGlyphProfile('05_SINGULARITY').pool[0] &&
            reads.length === beforeCompleted && Object.isFrozen(prewarmed) &&
            JSON.stringify(prewarmed) === JSON.stringify(getGlyphProfile('05_SINGULARITY').pool),
        'One-read prewarm eventually completes every supported singularity glyph in the original order without starving the scan or leaving cold work for its first consumer');

        nextFrame();
        const beforeReuse = reads.length;
        for (let repeat = 0; repeat < 20; repeat++) prewarmGlyphPool('05_SINGULARITY');
        const completeCostsNothing = reads.length === beforeReuse && getRenderableGlyphPool('05_SINGULARITY') === prewarmed;
        // GENESIS содержит ещё не проверенные alchemical glyphs: им доступны все4 неиспользованных чтения.
        getRenderableGlyphPool('02_GENESIS');
        check(completeCostsNothing && reads.length - beforeReuse === 4 && getRenderableGlyphPool('05_SINGULARITY') === prewarmed,
        'A complete prewarmed pool reuses its immutable snapshot with zero reads and returns unused allowance to a different active consumer');

        invalidateGlyphFontCache(); nextFrame();
        const combinedStart = reads.length;
        for (let repeat = 0; repeat < 20; repeat++) prewarmGlyphPool('05_SINGULARITY');
        const warmupReads = reads.length - combinedStart;
        getRenderableGlyphPool('02_GENESIS');
        for (let repeat = 0; repeat < 20; repeat++) {
            prewarmGlyphPool('05_SINGULARITY'); getRenderableGlyphPool('05_SINGULARITY');
        }
        check(warmupReads === 1 && reads.length - combinedStart === 4,
        'Prewarm and ordinary consumers share one four-read frame quota: warming uses one, the consumer can finish reference bootstrap and use the remaining three');

        const invalidatedAt = reads.length;
        invalidateGlyphFontCache();
        for (let repeat = 0; repeat < 20; repeat++) prewarmGlyphPool('05_SINGULARITY');
        const invalidationDoesNotRefill = reads.length === invalidatedAt;
        for (let frame = 0; frame < 3; frame++) {
            nextFrame(); prewarmGlyphPool('05_SINGULARITY');
        }
        check(invalidationDoesNotRefill && reads.length - invalidatedAt === 3 &&
            reads.slice(invalidatedAt).every(glyph => references.has(glyph)),
        'Font invalidation discards partial references without refilling either same-frame budget, then prewarm rebuilds fresh references over the following three frames');

        let unavailableFallback = true;
        for (const throws of [false, true]) {
            let unavailableContexts = 0;
            Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => {
                unavailableContexts++;
                if (throws) throw new Error('Canvas unavailable');
                return { getContext: () => null };
            } } });
            invalidateGlyphFontCache(); nextFrame();
            const unavailableStart = reads.length;
            prewarmGlyphPool('05_SINGULARITY');
            const fallback = getRenderableGlyphPool('05_SINGULARITY');
            prewarmGlyphPool('05_SINGULARITY');
            unavailableFallback &&= fallback === GLYPH_FAMILIES.basic && Object.isFrozen(fallback) &&
                reads.length === unavailableStart && unavailableContexts === 1;
        }
        check(unavailableFallback,
        'Prewarm without a working Canvas keeps the existing frozen ASCII fallback, performs no readbacks and does not retry context creation in a completed pool');
    } finally {
        if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument);
        else Reflect.deleteProperty(globalThis, 'document');
        invalidateGlyphFontCache();
        publishVisualSignals(state, audio, stress);
    }
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ГРАФЕМЫ КАНОНА
    const unicodeCanon = 'Canonical cache / שָׁלוֹם · A\u0301 · 𓂀 · 👩🏽‍🚀 · 🇮🇱';
    const canonical = getCanonicalGlyphText(unicodeCanon);
    check(Object.isFrozen(canonical) && !Reflect.set(canonical, '0', '!') &&
        canonical === getCanonicalGlyphText(unicodeCanon) &&
        canonical.join('') === unicodeCanon && canonical.includes('שָׁ') && canonical.includes('A\u0301') &&
        canonical.includes('👩🏽‍🚀') && canonical.includes('🇮🇱'),
    'Canonical segmentation reuses one frozen snapshot without splitting Hebrew marks, combining letters, emoji or flags');

    const dynamic = splitGlyphText(unicodeCanon);
    dynamic[0] = '!';
    check(splitGlyphText(unicodeCanon) !== dynamic && getCanonicalGlyphText(unicodeCanon) === canonical &&
        canonical.join('') === unicodeCanon,
    'Dynamic segmentation stays fresh and mutable without changing cached canonical graphemes');
    check(getCanonicalGlyphText('Canonical exact / é').join('') === 'Canonical exact / é' &&
        getCanonicalGlyphText('Canonical exact / e\u0301').join('') === 'Canonical exact / e\u0301' &&
        getCanonicalGlyphText('Canonical exact / é') !== getCanonicalGlyphText('Canonical exact / e\u0301'),
    'Cache keys preserve exact text rather than normalizing visually equivalent spellings');

    const oldestText = 'Canonical FIFO oldest';
    const oldest = getCanonicalGlyphText(oldestText);
    for (let index = 0; index < CANONICAL_GLYPH_CACHE_LIMIT; index++) {
        getCanonicalGlyphText('Canonical FIFO entry ' + index);
    }
    const newest = getCanonicalGlyphText('Canonical FIFO entry ' + (CANONICAL_GLYPH_CACHE_LIMIT - 1));
    check(getCanonicalGlyphText(oldestText) !== oldest &&
        newest === getCanonicalGlyphText('Canonical FIFO entry ' + (CANONICAL_GLYPH_CACHE_LIMIT - 1)),
    'The bounded canonical cache evicts the oldest entry while retaining a recent snapshot');
    const longText = 'X'.repeat(CANONICAL_GLYPH_CACHE_MAX_LENGTH + 1);
    const longSnapshot = getCanonicalGlyphText(longText);
    check(Object.isFrozen(longSnapshot) && longSnapshot.join('') === longText &&
        longSnapshot !== getCanonicalGlyphText(longText) &&
        newest === getCanonicalGlyphText('Canonical FIFO entry ' + (CANONICAL_GLYPH_CACHE_LIMIT - 1)),
    'Long canonical strings keep exact frozen graphemes but bypass retained storage without evicting useful labels');
    invalidateGlyphFontCache();
    check(newest === getCanonicalGlyphText('Canonical FIFO entry ' + (CANONICAL_GLYPH_CACHE_LIMIT - 1)),
    'A font generation change does not repeat language segmentation of unchanged canonical text');

    const originalSegment = Intl.Segmenter.prototype.segment;
    let segmentationCalls = 0;
    try {
        Intl.Segmenter.prototype.segment = function (this: Intl.Segmenter, text: string) {
            segmentationCalls++;
            return originalSegment.call(this, text);
        };
        const countedCanon = 'Canonical operation budget / שָׁ𓂀👩🏽‍🚀';
        getCanonicalGlyphText(countedCanon);
        for (let repeat = 0; repeat < 20; repeat++) getCanonicalGlyphText(countedCanon);
        splitGlyphText(countedCanon);
        check(segmentationCalls === 2,
        'Repeated canonical reads skip the real Segmenter while a dynamic split still performs its own segmentation');
    } finally {
        Intl.Segmenter.prototype.segment = originalSegment;
    }
    // КОНЕЦ РАЗДЕЛА 3
}
// КОНЕЦ ФУНКЦИИ runGlyphFontBudgetChecks
