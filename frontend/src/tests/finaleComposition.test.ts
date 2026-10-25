// ============================================================================
// ФАЙЛ: frontend/src/tests/finaleComposition.test.ts
// НАЗНАЧЕНИЕ: Регрессии размещения визитки над полным ярким фотонным кольцом.
// РАЗДЕЛЫ: 1. Общая оптическая геометрия; 2. Viewport/ограничения; 3. C²-подъём;
//          4. Постоянная Unicode-сетка декоративной квантовой строки.
// ФУНКЦИИ: makeLayout, makeQuantumLine, runFinaleCompositionChecks.
// ============================================================================
import {
    getFinaleCardPlacement, getSingularityPhotonRadii, PHOTON_BRIGHT_STOP,
    type FinaleCardLayout,
} from '../core/finaleComposition';
import {
    CAMERA_DRIFT_Y_AMPLITUDE, CAMERA_ZOOM_SWAY, UNIVERSE_PHASES, smootherstep,
} from '../store/universeState';
import { CANONICAL_FINALE_LINES } from '../bridge/cipherOdometerEngine';
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
        radii.brightRadius === radii.innerRadius + (radii.outerRadius - radii.innerRadius) * PHOTON_BRIGHT_STOP,
        'Card clearance uses the actual white gradient band between both photon circles, not the Zero Point or a fixed center gap');

    const desktopLayouts = [makeLayout(1440, 900), makeLayout(1920, 900), makeLayout(2400, 1125)];
    check(desktopLayouts.every((layout) => {
        const placement = getFinaleCardPlacement(layout);
        return placement.clearsBrightRing && placement.risePx > 0 &&
            placement.settledTopPx >= layout.paddingTop + 8 - 1e-9 &&
            placement.settledBottomPx <= placement.protectedTopPx;
    }), 'Full-size and zoomed-out desktop viewports keep the settled card above the bright ring while preserving the top safe area');

    check(desktopLayouts.every((layout) => {
        const protectedTop = getFinaleCardPlacement(layout).protectedTopPx;
        const scale = Math.min(layout.viewportWidth, layout.viewportHeight);
        return [-CAMERA_DRIFT_Y_AMPLITUDE, 0, CAMERA_DRIFT_Y_AMPLITUDE].every((driftY) =>
            [0.99, 1, PEAK_ZOOM].every((zoom) => [0.015, 0.3, 1].every((volume) => {
                const currentRing = getSingularityPhotonRadii(scale * zoom, volume);
                return layout.viewportHeight / 2 + driftY - currentRing.brightRadius > protectedTop;
            })));
    }), 'The reserved peak ring contains camera drift, zoom and accretion/collapse envelopes without sending the card downward after collapse');

    const constrained = [makeLayout(1280, 720), makeLayout(507, 684, 256), makeLayout(320, 568, 297)];
    check(constrained.every((layout) => {
        const placement = getFinaleCardPlacement(layout);
        const topLimit = layout.viewportWidth <= 920
            ? Math.max(48, layout.paddingTop - 8, layout.headerBottom + 4)
            : layout.paddingTop + 8;
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
