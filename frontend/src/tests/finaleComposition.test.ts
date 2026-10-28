// ============================================================================
// ФАЙЛ: frontend/src/tests/finaleComposition.test.ts
// НАЗНАЧЕНИЕ: Регрессии размещения визитки над ярким фотонным ореолом.
// РАЗДЕЛЫ: 1. Общая оптическая геометрия; 2. Viewport/ограничения; 3. C²-подъём;
//          4. Постоянная Unicode-сетка декоративной квантовой строки.
// ФУНКЦИИ: makeLayout, makeQuantumLine, runFinaleRiseClockChecks, runFinaleCompositionChecks.
// ============================================================================
import {
    getFinaleCardPlacement, getFinaleCardScale, getSingularityPhotonRadii, PHOTON_BRIGHT_STOP, PHOTON_HALO_STOP,
    type FinaleCardLayout,
} from '../core/finaleComposition';
import {
    CAMERA_DRIFT_Y_AMPLITUDE, CAMERA_ZOOM_SWAY, UNIVERSE_PHASES, smootherstep, universeStore,
} from '../store/universeState';
import { CANONICAL_FINALE_LINES, CipherOdometerEngine, formatFinaleStaticLine, getFinaleLineAssemblyProgress } from '../bridge/cipherOdometerEngine';
import { GLYPH_WAITING_SPACE, getOrderedGlyphState, invalidateGlyphFontCache, splitGlyphText } from '../core/glyphGrammar';
import { bindFinaleQuantumCells, updateFinaleQuantumCells } from '../layers/Layer5_CipherFinale';
import { drawFittedCipherGlyph } from '../engine/passes/singularityPass';
import { getOuroborosLayout } from '../core/ouroborosEpisode';
import { fillOuroborosPoints, OUROBOROS_CAPACITY, OUROBOROS_STRIDE } from '../core/ouroborosModel';

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
    state: { children: HTMLElement[]; replacements: number; inkWrites: number; styles: Map<string, string> };
} {
    const state = { children: [] as HTMLElement[], replacements: 0, inkWrites: 0, styles: new Map<string, string>() };
    const makeNode = (): HTMLElement => {
        let text = '';
        const children: HTMLElement[] = [];
        const styles = new Map<string, string>();
        const node = { className: '', dataset: {}, parentElement: null as HTMLElement | null,
            clientWidth: 13, clientHeight: 24,
            style: { setProperty: (name: string, value: string): void => { styles.set(name, value); state.inkWrites++; },
                getPropertyValue: (name: string): string => styles.get(name) ?? '' },
            get textContent(): string { return children.length ? children.map(child => child.textContent ?? '').join('') : text; },
            set textContent(value: string) { children.length = 0; text = value; },
            replaceChildren: (...next: HTMLElement[]): void => {
                children.splice(0, children.length, ...next);
                next.forEach(child => { Object.defineProperty(child, 'parentElement', { value: node, writable: true }); });
            },
        };
        return node as unknown as HTMLElement;
    };
    const line = {
        ownerDocument: { createElement: makeNode },
        style: { setProperty: (name: string, value: string): void => { state.styles.set(name, value); } },
        replaceChildren: (...children: HTMLElement[]): void => { state.children = children; state.replacements++; },
    };
    return { line: line as unknown as HTMLElement, state };
}
// КОНЕЦ ФУНКЦИИ makeQuantumLine

// НАЧАЛО ФУНКЦИИ runFinaleRiseClockChecks
/** Проверяет общий старт композиции и часы подъёма через паузы и сбросы фаз. */
function runFinaleRiseClockChecks(check: (passed: boolean, description: string) => void): void {
    const Store = universeStore.constructor as new () => typeof universeStore;
    const store = new Store();
    store.toggleAutoCycle();
    store.setPhase('05_SINGULARITY');
    const advance = (elapsed: number): void => store.updateTelemetry({ frameTimeMs: 16,
        phaseElapsedSec: elapsed, simulationTimeSec: store.getState().phaseMeta.startSec + elapsed });
    advance(18.549);
    const assembling = store.getState().githubCardAssemblyProgress < 1 && store.getState().finaleRiseElapsedSec === null;
    advance(18.55);
    const exactStart = store.getState().githubCardAssemblyProgress === 1 && store.getState().finaleRiseElapsedSec === 0;
    advance(18.55);
    const zeroStep = store.getState().finaleRiseElapsedSec === 0;
    advance(19.05);
    check(assembling && exactStart && zeroStep && Math.abs((store.getState().finaleRiseElapsedSec ?? -1) - 0.5) < 1e-10,
        'The shared rise clock starts at zero exactly when first ACT_D assembly completes, then advances only by the active telemetry delta');

    store.togglePause(); advance(19.55); store.togglePause();
    const paused = store.getState().finaleRiseElapsedSec;
    store.setTabHidden(true); advance(20.05); store.setTabHidden(false);
    const hidden = store.getState().finaleRiseElapsedSec;
    advance(20.55);
    const resumed = store.getState().finaleRiseElapsedSec;
    store.setPhase('01_VOID');
    advance(0.25);
    store.completeRestartToVoid();
    advance(0.25);
    check(Math.abs((paused ?? -1) - 0.5) < 1e-10 && paused === hidden &&
        Math.abs((resumed ?? -1) - 1) < 1e-10 && Math.abs((store.getState().finaleRiseElapsedSec ?? -1) - 1.5) < 1e-10,
        'Pause and hidden frames freeze the shared rise clock; manual phase rewind and cycle reset preserve its progress');

    const manual = new Store();
    manual.toggleAutoCycle(); manual.setPhase('05_SINGULARITY');
    manual.updateTelemetry({ phaseElapsedSec: 16.3, simulationTimeSec: 95.3 });
    const partial = manual.getState().finaleReachedOnce && manual.getState().finaleRiseElapsedSec === null;
    manual.setPhase('01_VOID');
    const manualStart = manual.getState().finaleRiseElapsedSec === 0;
    manual.updateTelemetry({ phaseElapsedSec: 0.1, simulationTimeSec: 0.1 });
    manual.setPhase('05_SINGULARITY');
    const retained = manual.getState().finaleRiseElapsedSec === 0.1;
    manual.updateTelemetry({ phaseElapsedSec: 20, simulationTimeSec: 99 });
    check(partial && manualStart && retained && manual.getState().finaleRiseElapsedSec === 12,
        'Leaving a partially assembled first card starts the same rise clock once; re-entry retains it and elapsed time caps at twelve seconds');
}
// КОНЕЦ ФУНКЦИИ runFinaleRiseClockChecks

// НАЧАЛО ФУНКЦИИ runFinaleCompositionChecks
export function runFinaleCompositionChecks(check: (passed: boolean, description: string) => void): void {
    runFinaleRiseClockChecks(check);
    // Проверяем тот же draw helper, который рисует основную букву и два ghost-знака.
    const canvasMetrics = [
        { width: 22, actualBoundingBoxLeft: 5, actualBoundingBoxRight: 25, actualBoundingBoxAscent: 29, actualBoundingBoxDescent: 8 },
        { width: 11, actualBoundingBoxLeft: -3, actualBoundingBoxRight: 17, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 16 },
    ];
    let wholeCanvasGlyphs = true;
    for (const [metricIndex, metrics] of canvasMetrics.entries()) {
        for (const [width, height] of [[320, 568], [1920, 1080]]) {
            for (const rollAxis of ['x', 'y'] as const) for (const rollScale of [0.12, 0.65, 1.1]) {
                for (const stepWidthPx of [4, 8, 18]) for (const edge of [3, width / 2, width - 3]) {
                    for (const offset of [-40, 0, 40]) {
                        let x = 0, y = 0, scaleX = 1, scaleY = 1, drawn = '';
                        const context = { font: `700 13px Fixture-${metricIndex}`,
                            save(): void {}, restore(): void {}, measureText: (): Partial<TextMetrics> => metrics,
                            translate: (dx: number, dy: number): void => { x = dx; y = dy; },
                            scale: (sx: number, sy: number): void => { scaleX = sx; scaleY = sy; },
                            fillText: (glyph: string): void => { drawn = glyph; },
                        } as unknown as CanvasRenderingContext2D;
                        const cell = { currentX: edge, currentY: edge === 3 ? 3 : height - 3,
                            rollAxis, rollScale, fontSizePx: 13, stepWidthPx };
                        drawFittedCipherGlyph(context, '𓅓', cell, width, height, offset, offset);
                        const rx = rollAxis === 'x' ? rollScale : 1, ry = rollAxis === 'y' ? rollScale : 1;
                        const left = cell.currentX + rx * (x - metrics.actualBoundingBoxLeft * scaleX);
                        const right = cell.currentX + rx * (x + metrics.actualBoundingBoxRight * scaleX);
                        const top = cell.currentY + ry * (y - metrics.actualBoundingBoxAscent * scaleY);
                        const bottom = cell.currentY + ry * (y + metrics.actualBoundingBoxDescent * scaleY);
                        wholeCanvasGlyphs &&= drawn === '𓅓' && scaleX > 0 && scaleX <= 1 && scaleX === scaleY &&
                            left >= 2 - 1e-8 && right <= width - 2 + 1e-8 && top >= 2 - 1e-8 && bottom <= height - 2 + 1e-8;
                    }
                }
            }
        }
    }
    check(wholeCanvasGlyphs,
        'The actual Canvas primary/ghost draw uniformly fits wide and tall historical signs and retains their complete ink inside phone/desktop edges throughout X/Y turns');
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
        supplementary.state.children.map((node) => node.textContent).join('') === 'A𓂀𝋳∇' &&
        cells.every(cell => cell.ink.parentElement === cell.node && /^scale\([\d.]+\)$/.test(cell.ink.style.getPropertyValue('transform'))),
        'Quantum glyph changes preserve 25 mounted grid cells and fixed column counts; supplementary signs remain whole and reduced motion restores canonical cells');

    const beforeStill = quantum.state.inkWrites;
    updateFinaleQuantumCells(cells, [], 141, true);
    const unchangedDoesNotWrite = quantum.state.inkWrites === beforeStill;
    Object.defineProperty(cells[0].node, 'clientWidth', { value: 8, writable: true });
    updateFinaleQuantumCells(cells, [], 141, true);
    const afterResize = quantum.state.inkWrites;
    invalidateGlyphFontCache();
    updateFinaleQuantumCells(cells, [], 141, true);
    check(unchangedDoesNotWrite && afterResize > beforeStill && quantum.state.inkWrites > afterResize &&
        mountedNodes.every((node, index) => node === quantum.state.children[index]),
        'Stationary quantum cells refit after a viewport/font change without advancing the symbol clock, remounting nodes or writing unchanged ink');

    // Реальный helper проходит через computed style, чтобы тест заметил чтение после записи.
    const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const access: string[] = [];
    let computedReads = 0;
    const probeWindow = { innerWidth: 390, innerHeight: 844,
        getComputedStyle: (): Partial<CSSStyleDeclaration> => {
            computedReads++; access.push('read');
            return { fontSize: '13px', height: '24px', width: '13px', fontStyle: 'normal',
                fontWeight: '400', fontFamily: 'monospace', letterSpacing: '0px' };
        } };
    try {
        Object.defineProperty(globalThis, 'window', { value: probeWindow, configurable: true });
        Object.defineProperty(globalThis, 'document', { configurable: true, value: {
            createElement: (): { getContext: () => object } => ({ getContext: () => ({
                measureText: (): Partial<TextMetrics> => ({ width: 20, actualBoundingBoxLeft: 2,
                    actualBoundingBoxRight: 22, actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 5 }),
            }) }),
        } });
        cells.forEach(({ node, ink }) => {
            Object.defineProperty(node, 'clientWidth', { configurable: true, get: () => { access.push('read'); return 13; } });
            Object.defineProperty(node, 'clientHeight', { configurable: true, get: () => { access.push('read'); return 24; } });
            const write = ink.style.setProperty.bind(ink.style);
            ink.style.setProperty = (name: string, value: string): void => { access.push('write'); write(name, value); };
        });
        invalidateGlyphFontCache();
        updateFinaleQuantumCells(cells, ['∇'], 142, false);
        const firstWrite = access.indexOf('write');
        const batched = firstWrite > 0 && !access.slice(firstWrite).includes('read') && computedReads === cells.length;
        access.length = 0; computedReads = 0;
        updateFinaleQuantumCells(cells, ['𓂀'], 143, false);
        const cachedWrite = access.indexOf('write');
        check(batched && cachedWrite > 0 && !access.slice(cachedWrite).includes('read') && computedReads === 0,
            'All 25 quantum cells finish geometry/style reads before ink writes, then reuse slot metrics when only glyphs change');
        probeWindow.innerWidth = 400;
        updateFinaleQuantumCells(cells, ['∑'], 144, false);
        const resizedReads = computedReads;
        computedReads = 0; invalidateGlyphFontCache();
        updateFinaleQuantumCells(cells, ['∑'], 144, false);
        check(resizedReads === cells.length && computedReads === cells.length,
            'Viewport and font generations invalidate cached slot styles without changing quantum node identity or symbol timing');
    } finally {
        if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow);
        else Reflect.deleteProperty(globalThis, 'window');
        if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument);
        else Reflect.deleteProperty(globalThis, 'document');
    }

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

    const scaleTimes = [0, 3, 6, 6.001, 8, 10, 11.999, 12];
    check([320, 390, 430, 600].every(width => {
        const scales = scaleTimes.map(time => getFinaleCardScale(width, time));
        return scales[0] === 1 && scales[2] === 1 && Math.abs(scales.at(-1)! - 0.82) < 1e-12 &&
            scales.every((scale, index) => scale >= 0.82 && scale <= 1 && (index === 0 || scale <= scales[index - 1])) &&
            Math.abs((1 - getFinaleCardScale(width, 6.001)) / 0.001) < 1e-6 &&
            Math.abs((getFinaleCardScale(width, 11.999) - 0.82) / 0.001) < 1e-6;
    }) && [601, 768, 920, 1920].every(width => scaleTimes.every(time => getFinaleCardScale(width, time) === 1)),
    'Only phones shrink the card by18% during the last six rise seconds, monotonically with zero endpoint velocity; tablets and desktop keep their original scale');

    check([0, 6, 12].every(time => Math.abs(getFinaleCardScale(390, time, true) - 0.82) < 1e-12) &&
        getFinaleCardScale(390, NaN) === 1 && getFinaleCardScale(NaN, 12) === 1 &&
        getFinaleCardScale(390, -10) === 1 && Math.abs(getFinaleCardScale(390, 20) - 0.82) < 1e-12,
    'Reduced motion selects the settled phone size immediately, while malformed or clamped inputs never publish an invalid scale');

    const phoneLayouts = [[390, 844, 296], [430, 932, 294]].map(([width, height, cardHeight]) => ({
        ...makeLayout(width, height, cardHeight), paddingBottom: 166, headerBottom: 62,
    }));
    check(phoneLayouts.every(layout => {
        const settled = getFinaleCardPlacement(layout);
        const phoneCenterY = (layout.paddingTop + layout.viewportHeight - layout.paddingBottom) / 2;
        const topLimit = Math.max(48, layout.paddingTop - 8, layout.headerBottom + 4);
        let pathIsSafe = true;
        for (let frame = 0; frame <= 240; frame++) {
            const seconds = frame * 0.05;
            const scale = getFinaleCardScale(layout.viewportWidth, seconds);
            const limit = getFinaleCardPlacement(layout, scale).risePx;
            const rise = Math.min(settled.risePx * smootherstep(0, 12, seconds), limit);
            const scaledHeight = layout.cardHeight * scale;
            const breath = 2 + scaledHeight / 2 * (0.008 * 1.42 + 0.003);
            pathIsSafe &&= phoneCenterY - rise - scaledHeight / 2 - breath >= topLimit - 1e-9;
        }
        // Максимальная наблюдаемая верхняя граница тела при этих двух viewport — около0.5h−0.232w.
        const bodyTop = layout.viewportHeight * 0.5 - layout.viewportWidth * 0.232;
        return pathIsSafe && Math.abs(settled.settledTopPx - topLimit) < 1e-9 &&
            settled.settledBottomPx + 3 < bodyTop;
    }), 'Typical390px and430px phones keep every shrinking rise frame below the header and settle above the centered body instead of retaining the old unscaled bottom edge');

    // Высоты соответствуют компактной строке действий desktop и однострочному25-ячеечному tablet.
    const centeredBodyLayouts = [makeLayout(1280, 720, 155), makeLayout(1920, 1080, 236),
        { ...makeLayout(768, 1024, 234), headerBottom: 62 }];
    const bodyPoints = new Float32Array(OUROBOROS_CAPACITY * OUROBOROS_STRIDE);
    let focalClearance = true;
    for (const seed of [0, 104729, 0xffffffff]) for (let cycle = 0; cycle < 3; cycle++) {
        for (const time of [103.05, 105, 108, 110, 112, 115, 117.05, 117.6]) {
            fillOuroborosPoints(bodyPoints, seed, OUROBOROS_CAPACITY, time + cycle * 108, 1, 0.5);
            for (const layout of centeredBodyLayouts) {
                const placement = getFinaleCardPlacement(layout);
                const focal = getOuroborosLayout(layout.viewportWidth, layout.viewportHeight, 0, -CAMERA_DRIFT_Y_AMPLITUDE);
                let bodyTop = Infinity;
                for (let offset = 0; offset < bodyPoints.length; offset += OUROBOROS_STRIDE) {
                    if (bodyPoints[offset + 7] !== 0) continue;
                    const perspective = 3 / (3 + bodyPoints[offset + 2]);
                    bodyTop = Math.min(bodyTop, focal.centerY - bodyPoints[offset + 1] * focal.scale * perspective);
                }
                const topLimit = layout.viewportWidth <= 920 ? Math.max(48, layout.headerBottom + 4, layout.paddingTop - 8) : 8;
                focalClearance &&= getFinaleCardScale(layout.viewportWidth, 12) === 1 &&
                    Math.abs(placement.settledTopPx - topLimit) < 1e-9 && placement.settledBottomPx + 2 < bodyTop;
            }
        }
    }
    check(focalClearance,
        'Compact1280×720, full1920×1080 and tablet768×1024 cards keep their original scale and clear the actual centered3D body across sampled head orientations, seeds, cycles and worst upward camera drift');

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
