// ============================================================================
// ФАЙЛ: frontend/src/tests/finaleComposition.test.ts
// НАЗНАЧЕНИЕ: Регрессии размещения визитки над ярким фотонным ореолом.
// РАЗДЕЛЫ: 1. Общая оптическая геометрия; 2. Viewport/ограничения; 3. C²-подъём;
//          4. Постоянная Unicode-сетка декоративной квантовой строки.
// ФУНКЦИИ: makeLayout, makeQuantumLine, runFinaleCompositionChecks.
// ============================================================================
import {
    getFinaleCardPlacement, getSingularityPhotonRadii, PHOTON_BRIGHT_STOP, PHOTON_HALO_STOP,
    type FinaleCardLayout,
} from '../core/finaleComposition';
import {
    CAMERA_DRIFT_Y_AMPLITUDE, CAMERA_ZOOM_SWAY, UNIVERSE_PHASES, smootherstep,
} from '../store/universeState';
import { CANONICAL_FINALE_LINES, CipherOdometerEngine, formatFinaleStaticLine, getFinaleLineAssemblyProgress } from '../bridge/cipherOdometerEngine';
import { GLYPH_WAITING_SPACE, getOrderedGlyphState, splitGlyphText } from '../core/glyphGrammar';
import { bindFinaleQuantumCells, updateFinaleQuantumCells } from '../layers/Layer5_CipherFinale';

const PEAK_ZOOM = Math.max(...Object.values(UNIVERSE_PHASES).map((phase) => phase.targetZoom)) + CAMERA_ZOOM_SWAY;

// НАЧАЛО ФУНКЦИИ makeLayout
function makeLayout(width: number, height: number, cardHeight = 300): FinaleCardLayout {
    const compact = width <= 920;
    return {
        viewportWidth: width, viewportHeight: height, cardHeight,
        paddingTop: compact ? 57.6 : 16,
        paddingBottom: compact ? 104 : 72,
        headerBottom: compact ? 49.9 : 105,
        peakZoom: PEAK_ZOOM,
        cameraDriftYAmplitude: CAMERA_DRIFT_Y_AMPLITUDE,
    };
}
// КОНЕЦ ФУНКЦИИ makeLayout

// НАЧАЛО ФУНКЦИИ makeQuantumLine
function makeQuantumLine(): {
    line: HTMLElement;
    state: { children: HTMLElement[]; replacements: number; styles: Map<string, string> };
} {
    const state = { children: [] as HTMLElement[], replacements: 0, styles: new Map<string, string>() };
    const line = {
        ownerDocument: { createElement: () => ({ className: '', dataset: {}, textContent: '' }) },
        style: { setProperty: (name: string, value: string): void => { state.styles.set(name, value); } },
        replaceChildren: (...children: HTMLElement[]): void => { state.children = children; state.replacements++; },
    };
    return { line: line as unknown as HTMLElement, state };
}
// КОНЕЦ ФУНКЦИИ makeQuantumLine

// НАЧАЛО ФУНКЦИИ runFinaleCompositionChecks
export function runFinaleCompositionChecks(check: (passed: boolean, description: string) => void): void {
    const initialEngine = new CipherOdometerEngine();
    const halfwayCells = initialEngine.evaluateCells(1920, 1080, 0.4, false, 0);
    check(halfwayCells.every((cell) =>
        cell.rollAxis === (cell.lineIndex === 2 ? 'y' : 'x') && Number.isFinite(cell.rollScale)),
        'Initial static Canvas glyphs roll on X; the independent endless stream retains its original axis');
    check([0, 1, 3, 4].every((lineIndex) => {
        const canonical = CANONICAL_FINALE_LINES[lineIndex];
        const characters = splitGlyphText(canonical);
        const text = splitGlyphText(formatFinaleStaticLine(canonical, lineIndex, 0.4, 4, ['∇']));
        const lineCells = halfwayCells.filter((cell) => cell.lineIndex === lineIndex);
        const states = characters.map((_character, index) =>
            getOrderedGlyphState(index, characters.length, getFinaleLineAssemblyProgress(0.4, lineIndex)).state);
        return states.includes('locked') && states.includes('rolling') && states.includes('waiting') &&
            states.every((state, index) => state === 'locked'
                ? text[index] === characters[index] && lineCells[index].isLocked && lineCells[index].primaryChar === characters[index]
                : state !== 'waiting' || (text[index] === GLYPH_WAITING_SPACE &&
                    lineCells[index].primaryChar === GLYPH_WAITING_SPACE && lineCells[index].glyphBreathAlpha === 0)) &&
            formatFinaleStaticLine(canonical, lineIndex, 1, 100, ['∇']) === canonical;
    }), 'Initial Canvas and DOM static lines share a locked left prefix, rolling front and invisible waiting suffix, then restore every canonical character');
    const endlessBefore = halfwayCells.filter((cell) => cell.lineIndex === 2);
    const endlessAfter = initialEngine.evaluateCells(1920, 1080, 1, false, 0).filter((cell) => cell.lineIndex === 2);
    check(endlessBefore.length > 0 && endlessBefore.every((cell, index) => !cell.isLocked && !endlessAfter[index].isLocked &&
        cell.primaryChar === endlessAfter[index].primaryChar && cell.wheelPhaseFrac === endlessAfter[index].wheelPhaseFrac),
        'The endless Canvas quantum row never joins the static locking front or changes its wheel phase with assembly progress');

    const quantum = makeQuantumLine();
    const cells = bindFinaleQuantumCells(quantum.line);
    const mountedNodes = quantum.state.children.slice();
    let unicodeSafe = true;
    for (let step = 0; step < 140; step++) {
        updateFinaleQuantumCells(cells, ['𓂀', '𝋳', '∇', 'A'], step, false);
        unicodeSafe &&= quantum.state.children.every((node) => Array.from(node.textContent ?? '').length === 1);
    }
    updateFinaleQuantumCells(cells, [], 141, true);
    const supplementary = makeQuantumLine();
    const supplementaryCells = bindFinaleQuantumCells(supplementary.line, 'A 𓂀 𝋳 ∇');
    check(cells.length === 25 && quantum.state.styles.get('--quantum-columns') === '25' &&
        quantum.state.styles.get('--quantum-compact-columns') === '13' && unicodeSafe &&
        quantum.state.replacements === 1 && mountedNodes.every((node, index) => node === quantum.state.children[index]) &&
        quantum.state.children.map((node) => node.textContent).join('') === CANONICAL_FINALE_LINES[2].replace(/\s/gu, '') &&
        supplementaryCells.length === 4 && supplementaryCells.map((cell) => cell.node.dataset.quantumIndex).join(',') === '0,2,4,6' &&
        supplementary.state.children.map((node) => node.textContent).join('') === 'A𓂀𝋳∇',
        'Quantum glyph changes preserve 25 mounted grid cells and fixed column counts; supplementary signs remain whole and reduced motion restores canonical cells');

    const radii = getSingularityPhotonRadii(900);
    check(Math.abs(radii.shadowRadius - 61.2) < 1e-10 &&
        Math.abs(radii.innerRadius - 39.78) < 1e-10 &&
        Math.abs(radii.outerRadius - 149.94) < 1e-10 &&
        Math.abs(radii.brightRadius - 92.6568) < 1e-10 &&
        Math.abs(radii.haloRadius - 114.6888) < 1e-10 &&
        radii.brightRadius === radii.innerRadius + (radii.outerRadius - radii.innerRadius) * PHOTON_BRIGHT_STOP &&
        radii.haloRadius === radii.innerRadius + (radii.outerRadius - radii.innerRadius) * PHOTON_HALO_STOP,
        'Shared photon geometry distinguishes the white band from the larger bright blue halo between both gradient circles');

    const desktopLayouts = [makeLayout(1440, 900, 250), makeLayout(1920, 900, 250),
        makeLayout(1440, 1080, 306), makeLayout(1920, 1080, 306), makeLayout(2400, 1125)];
    check(desktopLayouts.every((layout) => {
        const placement = getFinaleCardPlacement(layout);
        return placement.clearsBrightRing && placement.risePx > 0 &&
            placement.settledTopPx >= 8 - 1e-9 &&
            placement.settledBottomPx <= placement.protectedTopPx - 28 + 1e-9;
    }), 'Desktop layouts with sufficient room reserve the entire bright blue halo, its soft edge and a 28px breathing gap at normal and zoomed-out sizes');

    const measuredLayouts = [
        { layout: makeLayout(1920, 880, 280), previousRise: 235.21449728, minimumExtra: 24 },
        { layout: makeLayout(1440, 900, 280), previousRise: 237.4511904, minimumExtra: 28 },
        { layout: makeLayout(1920, 900, 280), previousRise: 237.4511904, minimumExtra: 28 },
    ];
    check(measuredLayouts.every(({ layout, previousRise, minimumExtra }) => {
        const placement = getFinaleCardPlacement(layout);
        return placement.risePx - previousRise >= minimumExtra && placement.settledTopPx >= 8 - 1e-9 &&
            placement.settledBottomPx < placement.protectedTopPx;
    }), 'Typical 280px cards rise another 24–33px on 880–900px desktop viewports without the previous 24px top cap absorbing the requested movement');

    check([1440, 1920].every((width) => [900, 1080].every((height) =>
        [250, 280, 306].every((cardHeight) => [1, PEAK_ZOOM].every((peakZoom) => {
            const layout = { ...makeLayout(width, height, cardHeight), peakZoom };
            const placement = getFinaleCardPlacement(layout);
            const whiteTop = height / 2 - CAMERA_DRIFT_Y_AMPLITUDE -
                getSingularityPhotonRadii(Math.min(width, height) * peakZoom).brightRadius;
            return placement.settledTopPx >= 8 - 1e-9 &&
                placement.settledBottomPx <= height - layout.paddingBottom &&
                placement.settledBottomPx < whiteTop;
        })))), '250–306px desktop cards stay fully visible above the white band at normal and peak zoom; a short viewport may limit the larger halo gap');

    check(desktopLayouts.every((layout) => {
        const protectedTop = getFinaleCardPlacement(layout).protectedTopPx;
        const scale = Math.min(layout.viewportWidth, layout.viewportHeight);
        return [-CAMERA_DRIFT_Y_AMPLITUDE, 0, CAMERA_DRIFT_Y_AMPLITUDE].every((driftY) =>
            [0.99, 1, PEAK_ZOOM].every((zoom) => [0.015, 0.3, 1].every((volume) => {
                const currentRing = getSingularityPhotonRadii(scale * zoom, volume);
                return layout.viewportHeight / 2 + driftY - currentRing.haloRadius > protectedTop;
            })));
    }), 'The reserved peak halo contains camera drift, zoom and accretion/collapse envelopes without sending the card downward after collapse');

    const constrained = [makeLayout(1280, 720), makeLayout(507, 684, 256), makeLayout(320, 568, 297)];
    check(constrained.every((layout) => {
        const placement = getFinaleCardPlacement(layout);
        const topLimit = layout.viewportWidth <= 920
            ? Math.max(48, layout.paddingTop - 8, layout.headerBottom + 4)
            : 8;
        return !placement.clearsBrightRing && Number.isFinite(placement.risePx) &&
            placement.settledTopPx >= topLimit - 1e-9 &&
            placement.settledBottomPx <= layout.viewportHeight - layout.paddingBottom;
    }), 'Height-constrained screens retain the entire card and actions below the HUD instead of clipping content to force ring clearance');

    const target = getFinaleCardPlacement(makeLayout(1440, 900)).risePx;
    const samples = [0, 0.001, 1, 3, 6, 9, 11.999, 12].map((seconds) => target * smootherstep(0, 12, seconds));
    const epsilon = 0.001;
    const startVelocity = target * smootherstep(0, 12, epsilon) / epsilon;
    const endVelocity = target * (1 - smootherstep(0, 12, 12 - epsilon)) / epsilon;
    check(samples[0] === 0 && samples.at(-1) === target &&
        samples.every((value, index) => index === 0 || value >= samples[index - 1]) &&
        Math.abs(startVelocity) < 1e-5 && Math.abs(endVelocity) < 1e-5,
        'The existing 12-second C2 lift starts at the original center, rises monotonically and settles with zero endpoint velocity');
}
// КОНЕЦ ФУНКЦИИ runFinaleCompositionChecks
