// ============================================================================
// ФАЙЛ: frontend/src/tests/visualSignals.test.ts
// НАЗНАЧЕНИЕ: Проверить общий снимок, Unicode-пулы и жизненный цикл Roll/Dwell.
// РАЗДЕЛЫ: 1. Минимальный DOM-контракт; 2. Проверки реальных core-модулей.
// ФУНКЦИИ: runVisualSignalChecks; HoverElement предоставляет EventTarget/атрибуты.
// ============================================================================
import { universeStore } from '../store/universeState';
import { stressStore } from '../store/stressState';
import { audioSync } from '../utils/audioSync';
import { createVisualSignals, publishVisualSignals } from '../core/visualSignals';
import { GLYPH_FAMILIES, GLYPH_WAITING_SPACE, filterGlyphPool, getGlyphFontEpoch, getGlyphProfile,
    getOrderedGlyphState, formatOrderedGlyphText, invalidateGlyphFontCache, scrambleCanonicalText, splitGlyphText } from '../core/glyphGrammar';
import { calmGlyphHover, fitGlyphInk } from '../core/glyphHover';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЙ DOM-КОНТРАКТ
class HoverElement extends EventTarget {
    public constructor(public readonly tagName = 'button') { super(); }
    public dataset: Record<string, string> = {};
    public className = '';
    public parentElement: HoverElement | null = null;
    public children: HoverElement[] = [];
    public ownerDocument = { createElement: (tagName: string): HoverElement => new HoverElement(tagName) };
    private text = '';
    public isConnected = true;
    public readonly styleValues = new Map<string, string>();
    private attributes = new Map<string, string>();
    public style = {
        // НАЧАЛО ФУНКЦИИ setProperty
        setProperty: (name: string, value: string): void => { this.styleValues.set(name, value); },
        // КОНЕЦ ФУНКЦИИ setProperty
        // НАЧАЛО ФУНКЦИИ removeProperty
        removeProperty: (name: string): void => { this.styleValues.delete(name); },
        // КОНЕЦ ФУНКЦИИ removeProperty
    };
    // НАЧАЛО ФУНКЦИИ textContent
    public get textContent(): string { return this.children.length ? this.children.map((child) => child.textContent).join('') : this.text; }
    public set textContent(text: string) {
        this.children.forEach((child) => { child.parentElement = null; });
        this.children = [];
        this.text = text;
    }
    // КОНЕЦ ФУНКЦИИ textContent
    // НАЧАЛО ФУНКЦИИ replaceChildren
    public replaceChildren(...children: HoverElement[]): void {
        this.children.forEach((child) => { child.parentElement = null; });
        this.children = children;
        children.forEach((child) => { child.parentElement = this; });
    }
    // КОНЕЦ ФУНКЦИИ replaceChildren
    // НАЧАЛО ФУНКЦИИ matches
    public matches(selector: string): boolean { return selector.split(',').some((tag) => tag.trim() === this.tagName); }
    // КОНЕЦ ФУНКЦИИ matches
    // НАЧАЛО ФУНКЦИИ hasAttribute
    public hasAttribute(name: string): boolean { return this.attributes.has(name); }
    // КОНЕЦ ФУНКЦИИ hasAttribute
    // НАЧАЛО ФУНКЦИИ setAttribute
    public setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
    // КОНЕЦ ФУНКЦИИ setAttribute
    // НАЧАЛО ФУНКЦИИ getAttribute
    public getAttribute(name: string): string | undefined { return this.attributes.get(name); }
    // КОНЕЦ ФУНКЦИИ getAttribute
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ descendants
function descendants(element: HoverElement, className: string): HoverElement[] {
    return element.children.flatMap((child) => [
        ...(child.className === className ? [child] : []),
        ...descendants(child, className),
    ]);
}
// КОНЕЦ ФУНКЦИИ descendants

// НАЧАЛО ФУНКЦИИ symbolAngle
function symbolAngle(symbol: HoverElement): number {
    return Number(/^rotateY\((-?[\d.]+)deg\)$/.exec(symbol.styleValues.get('transform') ?? '')?.[1]);
}
// КОНЕЦ ФУНКЦИИ symbolAngle

// НАЧАЛО ФУНКЦИИ visibleSymbols
function visibleSymbols(track: HoverElement): HoverElement[] {
    return descendants(track, 'glyph-reel-symbol').filter((node) =>
        node.styleValues.get('visibility') === 'visible' && node.styleValues.get('opacity') === '1');
}
// КОНЕЦ ФУНКЦИИ visibleSymbols

// НАЧАЛО РАЗДЕЛА 2. ПРОВЕРКИ CORE
// НАЧАЛО ФУНКЦИИ runVisualSignalChecks
export function runVisualSignalChecks(): { passed: boolean; description: string }[] {
    const checks: { passed: boolean; description: string }[] = [];
    const original = universeStore.getState();
    const audio = { ...audioSync.getSnapshot(0), isPlaying: true, low: 2, mid: -1, high: Number.NaN, pulse: 0.5, heartbeat: 0.4 };
    const state = { ...original, currentPhase: '03_EVOLUTION' as const, isPaused: false,
        reducedMotion: false, isTabHidden: false,
        telemetry: { ...original.telemetry, frameTimeMs: 50, simulationTimeSec: 0, phaseProgress: 0.5, kuramotoOrderR: 0.8 } };
    const stress = { ...stressStore.getState(), globalStress: 2 };
    const snapshot = createVisualSignals(state, audio, stress);
    const silent = createVisualSignals(state, { ...audio, isPlaying: false }, stress);
    checks.push({ passed: Object.isFrozen(snapshot) && snapshot.low === 1 && snapshot.mid === 0 && snapshot.high === 0 &&
        snapshot.globalStress === 1 && snapshot.kuramotoR === 0.8 && silent.pulse === 0 && silent.heartbeat === 0,
        description: 'Visual signals freeze one normalized frame; muted audio is not reported as a musical signal' });

    checks.push({ passed: snapshot.frameDtSec === 0.05 &&
        createVisualSignals({ ...state, telemetry: { ...state.telemetry, frameTimeMs: 16 } }, audio, stress).frameDtSec === 0.016 &&
        [Number.NaN, Number.POSITIVE_INFINITY, -5].every((frameTimeMs) =>
            createVisualSignals({ ...state, telemetry: { ...state.telemetry, frameTimeMs } }, audio, stress).frameDtSec === 0) &&
        createVisualSignals({ ...state, telemetry: { ...state.telemetry, frameTimeMs: 900 } }, audio, stress).frameDtSec === 0.05 &&
        createVisualSignals({ ...state, isPaused: true }, audio, stress).frameDtSec === 0 &&
        createVisualSignals({ ...state, isTabHidden: true }, audio, stress).frameDtSec === 0,
        description: 'Shared active frame delta is finite, bounded to 50ms and zero while paused or hidden' });

    const canonical = 'DUBNOV ALEXEY 🔬 𓂀 · 𝛁';
    const all = Object.values(GLYPH_FAMILIES).flat();
    const noLoneSurrogates = (value: string): boolean => Array.from(value).every((character) => {
        const point = character.codePointAt(0)!;
        return point < 0xD800 || point > 0xDFFF;
    });
    const scrambled = scrambleCanonicalText(canonical, '03_EVOLUTION', 2, 0.25);
    checks.push({ passed: all.every((glyph) => Array.from(glyph).length === 1 && noLoneSurrogates(glyph)) &&
        GLYPH_FAMILIES.historical.some((glyph) => glyph.codePointAt(0)! > 0xFFFF) &&
        noLoneSurrogates(scrambled) && Array.from(scrambled).length === Array.from(canonical).length &&
        scrambled.includes('🔬') && scrambled.includes('𓂀') &&
        scrambleCanonicalText(canonical, '03_EVOLUTION', 99, 1) === canonical,
        description: 'Glyph grammar preserves supplementary code points, protected symbols and exact canonical text' });

    const russianCanonical = 'РОЖДЕНИЕ КРАСОТЫ 𓂀 🔬 1️⃣ · 𝛑';
    const russianScrambled = scrambleCanonicalText(russianCanonical, '03_EVOLUTION', 0, 0);
    const protectedCanonical = '𓂀𝛑🔬1️⃣ ·∑';
    checks.push({ passed: russianScrambled !== russianCanonical && noLoneSurrogates(russianScrambled) &&
        Array.from(russianScrambled).length === Array.from(russianCanonical).length &&
        russianScrambled.includes('𓂀') && russianScrambled.includes('🔬') && russianScrambled.includes('1️⃣') && russianScrambled.includes('𝛑') &&
        scrambleCanonicalText(protectedCanonical, '03_EVOLUTION', 0, 0) === protectedCanonical &&
        scrambleCanonicalText(russianCanonical, '03_EVOLUTION', 9, 1) === russianCanonical,
        description: 'Cyrillic letters participate in hover roll while Egyptian, mathematical and emoji sequences remain intact' });

    const phases = ['01_VOID', '02_GENESIS', '03_EVOLUTION', '04_COLLAPSE', '05_SINGULARITY'] as const;
    checks.push({ passed: phases.every((phase) => {
        const profile = getGlyphProfile(phase);
        return profile.pool.length > 0 && profile.rollMs >= 260 && profile.rollMs <= 300 && profile.dwellMs >= 380 && profile.dwellMs <= 440;
    }) && filterGlyphPool(GLYPH_FAMILIES.historical, () => false) === GLYPH_FAMILIES.basic &&
        scrambleCanonicalText(canonical, '02_GENESIS', 2, 0.1) === scrambleCanonicalText(canonical, '02_GENESIS', 2, 0.1),
        description: 'Five phase profiles keep deliberate 260–300ms turns, deterministic selection and a safe unsupported-font fallback' });

    const previousFontEpoch = getGlyphFontEpoch();
    invalidateGlyphFontCache();
    checks.push({ passed: GLYPH_FAMILIES.mayanNumerals.length === 20 &&
        GLYPH_FAMILIES.mayanNumerals.every((glyph, value) => glyph.codePointAt(0) === 0x1D2E0 + value) &&
        GLYPH_FAMILIES.runic.includes('ᚠ') && GLYPH_FAMILIES.runic.includes('ᛟ') &&
        GLYPH_FAMILIES.mathematics.includes('ℏ') && GLYPH_FAMILIES.mathematics.includes('∮') &&
        GLYPH_FAMILIES.alchemical.includes('🜁') && getGlyphFontEpoch() === previousFontEpoch + 1,
        description: 'Curated runes, Egyptian signs, all 20 Mayan numerals and physical operators stay code-point safe; font arrival invalidates cached fallback' });

    // Проверяем именно выносы начертания, а не только advanceWidth: египетские,
    // наклонные и надстрочные знаки могут быть шире или выше своей наборной ячейки.
    const inkSamples: Partial<TextMetrics>[] = [
        { width: 16, actualBoundingBoxLeft: 4, actualBoundingBoxRight: 25,
            actualBoundingBoxAscent: 21, actualBoundingBoxDescent: 7, fontBoundingBoxAscent: 15, fontBoundingBoxDescent: 4 },
        { width: 9, actualBoundingBoxLeft: -2, actualBoundingBoxRight: 14,
            actualBoundingBoxAscent: 4, actualBoundingBoxDescent: 12, fontBoundingBoxAscent: 11, fontBoundingBoxDescent: 3 },
        { width: 8, actualBoundingBoxLeft: 3, actualBoundingBoxRight: 10,
            actualBoundingBoxAscent: 24, actualBoundingBoxDescent: -3 },
        { width: 22 }, {}, { width: Number.NaN, actualBoundingBoxAscent: Number.NaN },
    ];
    const slots = [{ width: 4, height: 16, font: 9 }, { width: 8, height: 17, font: 13 },
        { width: 18, height: 26, font: 20 }];
    checks.push({ passed: inkSamples.every((metrics) => slots.every(({ width, height, font }) =>
        [0, 1.5, -1].every((tracking) => {
            const fit = fitGlyphInk(metrics, width, height, font, tracking);
            const left = fit.left + fit.inkLeft * fit.scale;
            const right = fit.left + fit.inkRight * fit.scale;
            const top = fit.top + (fit.baseline - fit.inkAscent) * fit.scale;
            const bottom = fit.top + (fit.baseline + fit.inkDescent) * fit.scale;
            return Number.isFinite(fit.scale) && fit.scale > 0 && fit.scale <= 1 &&
                left >= 1 - 1e-8 && right <= width - 1 + 1e-8 &&
                top >= 1 - 1e-8 && bottom <= height - 1 + 1e-8 &&
                Math.abs((left + right) / 2 - width / 2) < 1e-8 &&
                Math.abs((top + bottom) / 2 - height / 2) < 1e-8 &&
                [0, 15, 45, 75, 90].every((degrees) => {
                    const cosine = Math.cos(degrees * Math.PI / 180);
                    return width / 2 + (left - width / 2) * cosine >= 0 &&
                        width / 2 + (right - width / 2) * cosine <= width;
                });
        }))),
        description: 'Uniform ink fitting contains wide, tall, negative-bearing and fallback glyphs with an inset at phone/desktop sizes; centered Y turns never cross neighboring cells' });

    publishVisualSignals(state, audio, stress);
    const mock = new HoverElement();
    const element = mock as unknown as HTMLElement;
    calmGlyphHover.start(element, 'ORDERED TEXT');
    const orderedCells = descendants(mock, 'glyph-reel-cell');
    const startsAtLeft = orderedCells.length === Array.from('ORDERED TEXT').length &&
        orderedCells[0]?.dataset.glyphState === 'rolling' &&
        orderedCells.slice(1).every((cell) => cell.dataset.glyphState === 'waiting');
    for (let frame = 0; frame < 16; frame++) publishVisualSignals(state, audio, stress);
    const lockedPrefix = orderedCells.filter((cell) => cell.dataset.glyphState === 'locked');
    const waitsAtRight = orderedCells.at(-1)?.dataset.glyphState === 'waiting';
    checks.push({ passed: startsAtLeft && lockedPrefix.length > 0 && waitsAtRight &&
        lockedPrefix.every((cell, index) => cell === orderedCells[index] &&
            descendants(cell, 'glyph-reel-symbol').map((node) => node.textContent).join('') === Array.from('ORDERED TEXT')[index]),
        description: 'Ordered hover rolls from the left, locks a real canonical DOM prefix and leaves the unreached suffix blank' });
    calmGlyphHover.stop(element);
    calmGlyphHover.start(element, '01.VOID');
    const shortCells = descendants(mock, 'glyph-reel-cell');
    const firstTrack = descendants(mock, 'glyph-reel-track')[0];
    const firstMeasure = descendants(mock, 'glyph-reel-measure')[0];
    const canonicalMeasure = firstMeasure.textContent;
    publishVisualSignals(state, audio, stress);
    const firstSymbols = descendants(firstTrack, 'glyph-reel-symbol');
    const motionAt50 = symbolAngle(firstSymbols[0]);
    publishVisualSignals(state, audio, stress);
    const motionAt100 = symbolAngle(firstSymbols[0]);
    checks.push({ passed: shortCells.length === Array.from('01.VOID').length &&
        shortCells.every((cell, index) => Number(cell.dataset.glyphReel) === index) &&
        motionAt50 > 0 && motionAt100 > motionAt50 && motionAt100 < 90 &&
        firstTrack.styleValues.get('transform') === 'none' &&
        visibleSymbols(firstTrack).length === 1 && visibleSymbols(firstTrack)[0] === firstSymbols[0] &&
        shortCells.filter((cell) => cell.dataset.glyphState === 'rolling').every((cell) =>
            descendants(cell, 'glyph-reel-ink').every((ink) => /^scale\([\d.]+\)$/.test(ink.styleValues.get('transform') ?? ''))) &&
        firstMeasure.textContent === canonicalMeasure && firstMeasure.styleValues.size === 0 &&
        shortCells.every((cell) => cell.styleValues.size === 0) && mock.getAttribute('aria-label') === '01.VOID',
        description: 'A whole outgoing glyph turns right on its own Y axis with zero X/Y translation; uniform ink scale, canonical measures and accessible names stay fixed' });
    const trackBeforeRestart = descendants(mock, 'glyph-reel-track')[0];
    calmGlyphHover.start(element, '01.VOID', 999);
    publishVisualSignals(state, audio, stress);
    checks.push({ passed: descendants(mock, 'glyph-reel-track')[0] === trackBeforeRestart &&
        symbolAngle(firstSymbols[0]) !== motionAt100,
        description: 'Repeated neighbor activation preserves the existing reel nodes and elapsed motion instead of restarting jitter' });
    calmGlyphHover.stop(element);

    calmGlyphHover.start(element, 'SLOW SYMBOLS');
    const holdTrack = descendants(mock, 'glyph-reel-track')[0];
    for (let frame = 0; frame < 6; frame++) publishVisualSignals(state, audio, stress);
    const heldSymbol = visibleSymbols(holdTrack)[0];
    const heldPosition = symbolAngle(heldSymbol);
    const heldSymbols = holdTrack.textContent;
    publishVisualSignals(state, audio, stress);
    const holdsReadableGlyph = heldPosition === 0 && visibleSymbols(holdTrack).length === 1 &&
        visibleSymbols(holdTrack)[0] === heldSymbol && symbolAngle(heldSymbol) === heldPosition && holdTrack.textContent === heldSymbols;
    calmGlyphHover.stop(element);
    const delayedMock = new HoverElement();
    const delayedElement = delayedMock as unknown as HTMLElement;
    calmGlyphHover.start(element, 'VISIBLE NEIGHBOR');
    calmGlyphHover.start(delayedElement, 'DELAYED NEIGHBOR', 4);
    publishVisualSignals(state, audio, stress);
    checks.push({ passed: holdsReadableGlyph &&
        visibleSymbols(descendants(mock, 'glyph-reel-track')[0]).length === 1 &&
        visibleSymbols(descendants(delayedMock, 'glyph-reel-track')[0]).length === 0,
        description: 'Each slow Y turn holds one whole incoming glyph face-on; neighboring labels wait blank and enter in a staggered wave' });
    calmGlyphHover.stop(element);
    calmGlyphHover.stop(delayedElement);

    publishVisualSignals(state, audio, stress);
    calmGlyphHover.start(element, 'Ж');
    const fullTurnTrack = descendants(mock, 'glyph-reel-track')[0];
    const fullTurnSymbols = descendants(fullTurnTrack, 'glyph-reel-symbol');
    let wholeGlyphAtEveryFrame = true;
    let edgeIsBlank = false;
    let incomingTurnsRight = false;
    for (let frame = 1; frame <= 20; frame++) {
        publishVisualSignals({ ...state, telemetry: { ...state.telemetry, frameTimeMs: 45 } }, audio, stress);
        const visible = visibleSymbols(fullTurnTrack);
        const outgoingAngle = symbolAngle(fullTurnSymbols[0]);
        const incomingAngle = symbolAngle(fullTurnSymbols[1]);
        wholeGlyphAtEveryFrame &&= visible.length <= 1 && outgoingAngle >= 0 && outgoingAngle <= 90 &&
            incomingAngle >= -90 && incomingAngle <= 0 &&
            fullTurnTrack.styleValues.get('transform') === 'none' &&
            (visible[0] !== fullTurnSymbols[0] || outgoingAngle < 90) &&
            (visible[0] !== fullTurnSymbols[1] || incomingAngle > -90);
        if (frame === 3) edgeIsBlank = visible.length === 0 && outgoingAngle === 90 && incomingAngle === -90;
        if (frame === 4) incomingTurnsRight = visible[0] === fullTurnSymbols[1] && incomingAngle > -90 && incomingAngle < 0;
    }
    checks.push({ passed: wholeGlyphAtEveryFrame && edgeIsBlank && incomingTurnsRight &&
        descendants(mock, 'glyph-reel-cell')[0].dataset.glyphState === 'locked' &&
        descendants(mock, 'glyph-reel-measure')[0].textContent === 'Ж' && calmGlyphHover.getVisualText(element) === 'Ж',
        description: 'Both full turns expose at most one complete glyph, meet edge-on without two clipped halves, enter from the left and restore the unmodified canonical measure' });
    calmGlyphHover.stop(element);

    calmGlyphHover.start(element, 'CALM HOVER BUTTON 𓂀');
    publishVisualSignals({ ...state, telemetry: { ...state.telemetry, simulationTimeSec: 0.05 } }, audio, stress);
    const stableName = mock.getAttribute('aria-label') === 'CALM HOVER BUTTON 𓂀';
    mock.dispatchEvent(new Event('pointerleave'));
    checks.push({ passed: stableName && mock.textContent === 'CALM HOVER BUTTON 𓂀' && !calmGlyphHover.isActive(element) && mock.styleValues.size === 0,
        description: 'Actual hover controller restores canonical text, stable accessible name and styles on pointer leave' });

    publishVisualSignals(state, audio, stress);
    calmGlyphHover.start(element, 'LATEST CANONICAL');
    const dwellCells = descendants(mock, 'glyph-reel-cell');
    for (let frame = 1; frame <= 41; frame++) {
        publishVisualSignals({ ...state, telemetry: { ...state.telemetry, simulationTimeSec: frame * 0.05 } }, audio, stress);
    }
    const canonicalDwell = calmGlyphHover.getVisualText(element) === 'LATEST CANONICAL' && calmGlyphHover.isActive(element) &&
        dwellCells.every((cell, index) => cell.dataset.glyphState === 'locked' &&
            descendants(cell, 'glyph-reel-track')[0].styleValues.get('transform') === 'none' &&
            descendants(cell, 'glyph-reel-symbol').map((node) => node.textContent).join('') === Array.from('LATEST CANONICAL')[index]);
    publishVisualSignals({ ...state, isPaused: true, telemetry: { ...state.telemetry, simulationTimeSec: 1.6 } }, audio, stress);
    const pausedRestored = !calmGlyphHover.isActive(element) && mock.textContent === 'LATEST CANONICAL';
    publishVisualSignals({ ...state, reducedMotion: true }, audio, stress);
    calmGlyphHover.start(element, 'REDUCED MOTION');
    const reducedStatic = !calmGlyphHover.isActive(element) && mock.textContent === 'REDUCED MOTION';
    checks.push({ passed: canonicalDwell && pausedRestored && reducedStatic,
        description: 'Every reel physically locks its canonical DOM text during dwell; pause and reduced motion stop decorative motion' });

    // Скрытие страницы не обязано сопровождаться кадром: очищаем сразу два сеанса.
    publishVisualSignals(state, audio, stress);
    const secondMock = new HoverElement();
    const secondElement = secondMock as unknown as HTMLElement;
    calmGlyphHover.start(element, 'FIRST CANONICAL');
    calmGlyphHover.start(secondElement, 'SECOND CANONICAL');
    publishVisualSignals({ ...state, telemetry: { ...state.telemetry, simulationTimeSec: 0.05 } }, audio, stress);
    const hadActiveGlyphs = mock.textContent !== 'FIRST CANONICAL' && secondMock.textContent !== 'SECOND CANONICAL';
    calmGlyphHover.setCanonical(secondElement, 'LATEST SECOND CANONICAL');
    // Между этим вызовом и проверкой намеренно нет publishVisualSignals/RAF.
    calmGlyphHover.stopAll();
    checks.push({ passed: hadActiveGlyphs && !calmGlyphHover.isActive(element) && !calmGlyphHover.isActive(secondElement) &&
        mock.textContent === 'FIRST CANONICAL' && secondMock.textContent === 'LATEST SECOND CANONICAL' &&
        mock.styleValues.size === 0 && secondMock.styleValues.size === 0,
        description: 'Hide/disposal cleanup restores all active glyph sessions and latest text without waiting for another frame' });

    // Один и тот же набор активных кадров должен дать одинаковый Roll/Dwell,
    // даже когда часы симуляции прыгают вперёд/назад при переключении фаз.
    // НАЧАЛО ФУНКЦИИ recordHoverAcrossPhaseChanges
    const recordHoverAcrossPhaseChanges = (jumpTime: boolean): string[] => {
        publishVisualSignals(state, audio, stress);
        const node = new HoverElement();
        const target = node as unknown as HTMLElement;
        calmGlyphHover.start(target, 'ПЛАВНЫЙ ПЕРЕБОР ТЕКСТА');
        const frames: string[] = [];
        for (let frame = 1; frame <= 150; frame++) {
            const phase = frame < 8 ? '03_EVOLUTION' : frame < 16 ? '05_SINGULARITY' : frame < 24 ? '01_VOID' : '03_EVOLUTION';
            publishVisualSignals({ ...state, currentPhase: phase, telemetry: { ...state.telemetry, frameTimeMs: 20,
                simulationTimeSec: jumpTime ? (frame % 2 ? 1000 + frame : -1000 - frame) : frame * 0.02 } }, audio, stress);
            frames.push(`${node.textContent}|${node.styleValues.get('--glyph-depth-shift')}|${calmGlyphHover.isActive(target)}`);
        }
        calmGlyphHover.stop(target);
        return frames;
    };
    // КОНЕЦ ФУНКЦИИ recordHoverAcrossPhaseChanges
    const continuousFrames = recordHoverAcrossPhaseChanges(false);
    const jumpedFrames = recordHoverAcrossPhaseChanges(true);
    checks.push({ passed: continuousFrames.every((frame, index) => frame === jumpedFrames[index]) &&
        continuousFrames[10].endsWith('|true') && continuousFrames[149].endsWith('|false'),
        description: 'Hover timing and canonical dwell follow active frame time across forward/backward phase-clock jumps' });

    const unicodeLabel = 'A\u0301 𓂀 👩‍🔬 1️⃣ Ж';
    const unicodeCells = splitGlyphText(unicodeLabel);
    checks.push({ passed: unicodeCells.join('') === unicodeLabel && unicodeCells.includes('A\u0301') &&
        unicodeCells.includes('👩‍🔬') && unicodeCells.includes('1️⃣') &&
        formatOrderedGlyphText(unicodeLabel, 0, 0, ['∇']).endsWith(GLYPH_WAITING_SPACE) &&
        formatOrderedGlyphText(unicodeLabel, 1, 0, ['∇']) === unicodeLabel &&
        [0, 0.1, 0.25, 0.5, 0.75, 1].every((progress) => {
            const states = unicodeCells.map((_cell, index) => getOrderedGlyphState(index, unicodeCells.length, progress).state);
            const ranks = states.map((value) => value === 'locked' ? 0 : value === 'rolling' ? 1 : 2);
            return ranks.every((rank, index) => !index || rank >= ranks[index - 1]);
        }), description: 'Ordered fronts preserve combining marks, supplementary signs and whole emoji clusters, with one locked/rolling/waiting progression' });

    publishVisualSignals(state, audio, stress);
    calmGlyphHover.start(element, unicodeLabel);
    const unicodeHoverCells = descendants(mock, 'glyph-reel-cell');
    for (let frame = 0; frame < 55; frame++) publishVisualSignals(state, audio, stress);
    checks.push({ passed: unicodeHoverCells.length === unicodeCells.length && mock.textContent === unicodeLabel &&
        calmGlyphHover.getVisualText(element) === unicodeLabel && !calmGlyphHover.isActive(element),
        description: 'Unicode hover completes within three seconds and restores the exact original visible DOM text automatically' });

    publishVisualSignals(state, audio, stress);
    const paragraph = new HoverElement('p');
    const paragraphElement = paragraph as unknown as HTMLElement;
    calmGlyphHover.setCanonical(paragraphElement, 'КАНОНИЧЕСКИЙ ТЕКСТ');
    const canonicalNode = paragraph.children[0];
    const visualNode = paragraph.children[1];
    let semanticTextStable = true;
    for (let repeat = 0; repeat < 8; repeat++) {
        calmGlyphHover.start(paragraphElement, 'КАНОНИЧЕСКИЙ ТЕКСТ');
        publishVisualSignals(state, audio, stress);
        semanticTextStable &&= canonicalNode.textContent === 'КАНОНИЧЕСКИЙ ТЕКСТ' &&
            visualNode.textContent !== canonicalNode.textContent && visualNode.getAttribute('aria-hidden') === 'true';
        calmGlyphHover.stop(paragraphElement);
    }
    calmGlyphHover.setCanonical(paragraphElement, 'ОБНОВЛЁННЫЙ КАНОН');
    calmGlyphHover.setVisualText(paragraphElement, 'ДЕКОРАТИВНАЯ СБОРКА');
    const heading = new HoverElement('h1');
    calmGlyphHover.setCanonical(heading as unknown as HTMLElement, 'AUTHOR HEADER');
    const genericSpan = new HoverElement('span');
    const spanElement = genericSpan as unknown as HTMLElement;
    calmGlyphHover.start(spanElement, 'НАЗВАНИЕ ФАЗЫ');
    publishVisualSignals(state, audio, stress);
    const genericSpanStable = !genericSpan.hasAttribute('aria-label') && !genericSpan.hasAttribute('role') &&
        genericSpan.children[0].textContent === 'НАЗВАНИЕ ФАЗЫ' && genericSpan.children[1].getAttribute('aria-hidden') === 'true' &&
        calmGlyphHover.getVisualText(spanElement) !== 'НАЗВАНИЕ ФАЗЫ';
    calmGlyphHover.stop(spanElement);
    checks.push({ passed: semanticTextStable && !paragraph.hasAttribute('aria-label') &&
        paragraph.children.length === 2 && paragraph.children[0] === canonicalNode && paragraph.children[1] === visualNode &&
        canonicalNode.className === 'glyph-canonical-text' && canonicalNode.textContent === 'ОБНОВЛЁННЫЙ КАНОН' &&
        calmGlyphHover.getVisualText(paragraphElement) === 'ДЕКОРАТИВНАЯ СБОРКА' &&
        genericSpanStable && heading.getAttribute('aria-label') === 'AUTHOR HEADER' && heading.children.length === 1 &&
        heading.children[0].getAttribute('aria-hidden') === 'true',
        description: 'Paragraph/span canon stays accessible beside aria-hidden decorative text; wrappers are reused and native heading semantics remain intact' });
    calmGlyphHover.stop(element);
    publishVisualSignals(original, audioSync.getSnapshot(0), stressStore.getState());
    return checks;
}
// КОНЕЦ ФУНКЦИИ runVisualSignalChecks
// КОНЕЦ РАЗДЕЛА 2
