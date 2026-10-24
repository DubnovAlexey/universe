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
import { GLYPH_FAMILIES, filterGlyphPool, getGlyphProfile, scrambleCanonicalText } from '../core/glyphGrammar';
import { calmGlyphHover } from '../core/glyphHover';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЙ DOM-КОНТРАКТ
class HoverElement extends EventTarget {
    public dataset: Record<string, string> = {};
    public textContent = '';
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
    // НАЧАЛО ФУНКЦИИ matches
    public matches(): boolean { return true; }
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

// НАЧАЛО РАЗДЕЛА 2. ПРОВЕРКИ CORE
// НАЧАЛО ФУНКЦИИ runVisualSignalChecks
export function runVisualSignalChecks(): { passed: boolean; description: string }[] {
    const checks: { passed: boolean; description: string }[] = [];
    const original = universeStore.getState();
    const audio = { ...audioSync.getSnapshot(0), isPlaying: true, low: 2, mid: -1, high: Number.NaN, pulse: 0.5, heartbeat: 0.4 };
    const state = { ...original, currentPhase: '03_EVOLUTION' as const, isPaused: false,
        reducedMotion: false, isTabHidden: false,
        telemetry: { ...original.telemetry, simulationTimeSec: 0, phaseProgress: 0.5, kuramotoOrderR: 0.8 } };
    const stress = { ...stressStore.getState(), globalStress: 2 };
    const snapshot = createVisualSignals(state, audio, stress);
    const silent = createVisualSignals(state, { ...audio, isPlaying: false }, stress);
    checks.push({ passed: Object.isFrozen(snapshot) && snapshot.low === 1 && snapshot.mid === 0 && snapshot.high === 0 &&
        snapshot.globalStress === 1 && snapshot.kuramotoR === 0.8 && silent.pulse === 0 && silent.heartbeat === 0,
        description: 'Visual signals freeze one normalized frame; muted audio is not reported as a musical signal' });

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

    const phases = ['01_VOID', '02_GENESIS', '03_EVOLUTION', '04_COLLAPSE', '05_SINGULARITY'] as const;
    checks.push({ passed: phases.every((phase) => {
        const profile = getGlyphProfile(phase);
        return profile.pool.length > 0 && profile.rollMs >= 150 && profile.rollMs <= 180 && profile.dwellMs >= 240 && profile.dwellMs <= 320;
    }) && filterGlyphPool(GLYPH_FAMILIES.historical, () => false) === GLYPH_FAMILIES.basic &&
        scrambleCanonicalText(canonical, '02_GENESIS', 2, 0.1) === scrambleCanonicalText(canonical, '02_GENESIS', 2, 0.1),
        description: 'Five phase profiles keep calm timing, deterministic selection and a safe unsupported-font fallback' });

    publishVisualSignals(state, audio, stress);
    const mock = new HoverElement();
    const element = mock as unknown as HTMLElement;
    calmGlyphHover.start(element, 'CALM HOVER BUTTON 𓂀');
    publishVisualSignals({ ...state, telemetry: { ...state.telemetry, simulationTimeSec: 0.05 } }, audio, stress);
    const stableName = mock.getAttribute('aria-label') === 'CALM HOVER BUTTON 𓂀';
    mock.dispatchEvent(new Event('pointerleave'));
    checks.push({ passed: stableName && mock.textContent === 'CALM HOVER BUTTON 𓂀' && !calmGlyphHover.isActive(element) && mock.styleValues.size === 0,
        description: 'Actual hover controller restores canonical text, stable accessible name and styles on pointer leave' });

    publishVisualSignals(state, audio, stress);
    calmGlyphHover.start(element, 'LATEST CANONICAL');
    for (let frame = 1; frame <= 12; frame++) {
        publishVisualSignals({ ...state, telemetry: { ...state.telemetry, simulationTimeSec: frame * 0.05 } }, audio, stress);
    }
    const canonicalDwell = mock.textContent === 'LATEST CANONICAL' && calmGlyphHover.isActive(element);
    publishVisualSignals({ ...state, isPaused: true, telemetry: { ...state.telemetry, simulationTimeSec: 0.6 } }, audio, stress);
    const pausedRestored = !calmGlyphHover.isActive(element) && mock.textContent === 'LATEST CANONICAL';
    publishVisualSignals({ ...state, reducedMotion: true }, audio, stress);
    calmGlyphHover.start(element, 'REDUCED MOTION');
    const reducedStatic = !calmGlyphHover.isActive(element) && mock.textContent === 'REDUCED MOTION';
    checks.push({ passed: canonicalDwell && pausedRestored && reducedStatic,
        description: 'Roll enters a readable canonical dwell; pause and reduced motion stop decorative motion' });

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
    calmGlyphHover.stop(element);
    publishVisualSignals(original, audioSync.getSnapshot(0), stressStore.getState());
    return checks;
}
// КОНЕЦ ФУНКЦИИ runVisualSignalChecks
// КОНЕЦ РАЗДЕЛА 2
