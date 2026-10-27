// ============================================================================
// ФАЙЛ: frontend/src/core/glyphHover.ts
// НАЗНАЧЕНИЕ: Отчётливые символьные барабаны на общем кадре без дрожания вёрстки.
// РАЗДЕЛЫ: 1. Контракты/метрики; 2. Канонический текст; 3. Барабаны;
//          4. Жизненный цикл общего кадра.
// ФУНКЦИИ: ease, fitGlyphInk, symbolFit, setFittedGlyph, setTurn, ensureTextNodes, setCanonical, setVisualText,
// getVisualText, isActive, createReels, updateReels, start, stop, stopAll, update.
// ============================================================================

import { getVisualSignals, subscribeVisualSignals, type VisualSignalSnapshot } from './visualSignals';
import { GLYPH_FONT_STACK, GLYPH_WAITING_SPACE, getGlyphFontEpoch, getGlyphProfile, getOrderedGlyphState,
    isMutableGlyph, pickGlyph, splitGlyphText } from './glyphGrammar';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТЫ И МЕТРИКИ
interface GlyphTextNodes { canonical: HTMLElement | null; visual: HTMLElement; }
interface FittedTextLine {
    readonly canonical: string;
    readonly visual: HTMLElement;
    readonly cells: { readonly node: HTMLElement; readonly ink: HTMLElement; glyph: string }[];
    text: string;
    fitKey: string;
}
interface GlyphReelCell {
    index: number;
    canonical: string;
    node: HTMLElement;
    track: HTMLElement;
    outgoing: HTMLElement;
    incoming: HTMLElement;
    outgoingInk: HTMLElement;
    incomingInk: HTMLElement;
    turn: number;
    progress: number;
    fitEpoch: number;
    state: 'waiting' | 'rolling' | 'locked';
}
interface HoverSession {
    canonical: string;
    logicalText: string;
    cells: GlyphReelCell[];
    elapsedMs: number;
    delayMs: number;
    rollMs: number;
    dwellMs: number;
    offset: number;
    waveMs: number;
    cleanup: () => void;
}
const REEL_TURNS = 2;
const REEL_HOLD_MS = 120;
const SLOT_WAVE_MS = 90;
const MAX_WAVE_MS = 1700;
let metricsContext: CanvasRenderingContext2D | null | undefined;
export interface GlyphInkFit {
    readonly scale: number;
    readonly left: number;
    readonly top: number;
    readonly baseline: number;
    readonly inkLeft: number;
    readonly inkRight: number;
    readonly inkAscent: number;
    readonly inkDescent: number;
}
const fitCache = new Map<string, GlyphInkFit>();
let fitCacheEpoch = -1;

// НАЧАЛО ФУНКЦИИ ease
function ease(value: number): number {
    const t = Math.max(0, Math.min(1, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ ease

// НАЧАЛО ФУНКЦИИ fitGlyphInk
/** Вписывает полное начертание вместе с выносами, сохраняя пропорции и базовую линию. */
export function fitGlyphInk(metrics: Partial<TextMetrics>, width: number, height: number,
    fontPx: number, tracking = 0): GlyphInkFit {
    const font = Number.isFinite(fontPx) && fontPx > 0 ? fontPx : 16;
    const w = Number.isFinite(width) && width > 0 ? width : font;
    const h = Number.isFinite(height) && height > 0 ? height : font * 1.3;
    const advance = Number.isFinite(metrics.width) && metrics.width! > 0 ? metrics.width! : font;
    const hasHorizontalInk = Number.isFinite(metrics.actualBoundingBoxLeft) &&
        Number.isFinite(metrics.actualBoundingBoxRight) &&
        metrics.actualBoundingBoxLeft! + metrics.actualBoundingBoxRight! > 0;
    const hasVerticalInk = Number.isFinite(metrics.actualBoundingBoxAscent) &&
        Number.isFinite(metrics.actualBoundingBoxDescent) &&
        metrics.actualBoundingBoxAscent! + metrics.actualBoundingBoxDescent! > 0;
    const inkLeft = hasHorizontalInk ? -metrics.actualBoundingBoxLeft! : 0;
    const inkRight = hasHorizontalInk ? metrics.actualBoundingBoxRight! : advance;
    const inkAscent = hasVerticalInk ? metrics.actualBoundingBoxAscent! : font * 0.9;
    const inkDescent = hasVerticalInk ? metrics.actualBoundingBoxDescent! : font * 0.3;
    const fontAscent = Number.isFinite(metrics.fontBoundingBoxAscent) ? metrics.fontBoundingBoxAscent! : font * 0.8;
    const fontDescent = Number.isFinite(metrics.fontBoundingBoxDescent) ? metrics.fontBoundingBoxDescent! : font * 0.2;
    const baseline = (font - fontAscent - fontDescent) / 2 + fontAscent;
    // Запас масштабируется вместе с узкой ячейкой: фиксированные 3px съедали почти весь знак.
    const inset = Math.min(1, w * 0.12, h * 0.12);
    const spacing = Number.isFinite(tracking) ? Math.abs(tracking) : 0;
    const scale = Math.min(1, (w - inset * 2) / Math.max(advance + spacing, inkRight - inkLeft + spacing),
        (h - inset * 2) / (inkAscent + inkDescent));
    return {
        scale, baseline, inkLeft, inkRight, inkAscent, inkDescent,
        left: w / 2 - (inkLeft + inkRight) * scale / 2,
        top: h / 2 + ((inkAscent - inkDescent) / 2 - baseline) * scale,
    };
}
// КОНЕЦ ФУНКЦИИ fitGlyphInk

// НАЧАЛО ФУНКЦИИ symbolFit
/** CSS-размеры локального окна не зависят от внешнего 3D-поворота всей кнопки. */
function symbolFit(element: HTMLElement, glyph: string): GlyphInkFit {
    if (typeof window === 'undefined' || typeof document === 'undefined') return fitGlyphInk({}, 16, 20.8, 16);
    const fontEpoch = getGlyphFontEpoch();
    if (fontEpoch !== fitCacheEpoch) {
        // Новые начертания не оставляют в памяти измерения прежнего поколения шрифтов.
        fitCache.clear();
        fitCacheEpoch = fontEpoch;
    }
    const style = window.getComputedStyle(element);
    const fontPx = Number.parseFloat(style.fontSize) || 16;
    const slotStyle = window.getComputedStyle(element.parentElement!);
    const availableWidth = Number.parseFloat(slotStyle.width) || fontPx;
    const availableHeight = Number.parseFloat(slotStyle.height) || fontPx * 1.3;
    const tracking = Number.parseFloat(style.letterSpacing) || 0;
    const font = style.fontStyle + ' ' + style.fontWeight + ' ' + fontPx + 'px ' + style.fontFamily;
    const key = fontEpoch + ':' + font + ':' + availableWidth.toFixed(3) + ':' +
        availableHeight.toFixed(3) + ':' + tracking + ':' + glyph;
    const cached = fitCache.get(key);
    if (cached !== undefined) return cached;
    if (metricsContext === undefined) {
        try { metricsContext = document.createElement('canvas').getContext('2d'); }
        catch { metricsContext = null; }
    }
    let metrics: Partial<TextMetrics> = {};
    if (metricsContext) {
        metricsContext.font = font;
        metricsContext.textBaseline = 'alphabetic';
        metricsContext.textAlign = 'left';
        metricsContext.direction = 'ltr';
        metrics = metricsContext.measureText(glyph);
    }
    const fit = fitGlyphInk(metrics, availableWidth, availableHeight, fontPx, tracking);
    fitCache.set(key, fit);
    return fit;
}
// КОНЕЦ ФУНКЦИИ symbolFit

// НАЧАЛО ФУНКЦИИ setFittedGlyph
/** Отдельный ink-слой центрируется по начертанию; слой поворота остаётся размером с ячейку. */
export function setFittedGlyph(ink: HTMLElement, glyph: string, canonical: string): void {
    ink.textContent = glyph;
    const isCanonical = glyph === canonical;
    ink.style.setProperty('font-family', isCanonical ? 'inherit' : GLYPH_FONT_STACK);
    ink.style.setProperty('font-size', isCanonical ? 'inherit' : 'max(1em, 13px)');
    ink.style.setProperty('letter-spacing', isCanonical ? 'inherit' : '0px');
    const fit = symbolFit(ink, glyph);
    ink.style.setProperty('left', fit.left.toFixed(5) + 'px');
    ink.style.setProperty('top', fit.top.toFixed(5) + 'px');
    ink.style.setProperty('transform', 'scale(' + fit.scale.toFixed(6) + ')');
}
// КОНЕЦ ФУНКЦИИ setFittedGlyph

// НАЧАЛО ФУНКЦИИ setTurn
/** Поворот слева направо показывает только одну целую грань, без сдвига и среза знака. */
function setTurn(cell: GlyphReelCell, progress: number): void {
    const outgoingVisible = progress < 0.5;
    const incomingVisible = progress > 0.5;
    cell.outgoing.style.setProperty('transform', 'rotateY(' + Math.min(90, progress * 180).toFixed(3) + 'deg)');
    cell.incoming.style.setProperty('transform', 'rotateY(' + Math.max(-90, (progress - 1) * 180).toFixed(3) + 'deg)');
    cell.outgoing.style.setProperty('visibility', outgoingVisible ? 'visible' : 'hidden');
    cell.incoming.style.setProperty('visibility', incomingVisible ? 'visible' : 'hidden');
    cell.outgoing.style.setProperty('opacity', outgoingVisible ? '1' : '0');
    cell.incoming.style.setProperty('opacity', incomingVisible ? '1' : '0');
}
// КОНЕЦ ФУНКЦИИ setTurn
// КОНЕЦ РАЗДЕЛА 1

class CalmGlyphHover {
    private sessions = new Map<HTMLElement, HoverSession>();
    private textNodes = new WeakMap<HTMLElement, GlyphTextNodes>();
    private fittedLines = new WeakMap<HTMLElement, FittedTextLine>();
    private unsubscribe: (() => void) | null = null;

    // НАЧАЛО РАЗДЕЛА 2. КАНОНИЧЕСКИЙ И ВИДИМЫЙ ТЕКСТ
    // НАЧАЛО ФУНКЦИИ ensureTextNodes
    /** Native-имя задаётся aria-label; generic/paragraph хранят доступный канон отдельно. */
    private ensureTextNodes(element: HTMLElement): GlyphTextNodes {
        let nodes = this.textNodes.get(element);
        if (!nodes || nodes.visual.parentElement !== element ||
            (nodes.canonical !== null && nodes.canonical.parentElement !== element)) {
            const nativeName = element.matches('button, a, h1, h2, h3, h4, h5, h6');
            const canonical = nativeName ? null : element.ownerDocument.createElement('span');
            const visual = element.ownerDocument.createElement('span');
            const text = element.dataset.canonicalText ?? element.textContent ?? '';
            if (canonical) {
                canonical.className = 'glyph-canonical-text';
                canonical.dataset.glyphCanonical = '1';
                canonical.textContent = text;
            }
            visual.setAttribute('aria-hidden', 'true');
            visual.dataset.glyphVisual = '1';
            visual.textContent = text;
            if (canonical) element.replaceChildren(canonical, visual);
            else element.replaceChildren(visual);
            nodes = { canonical, visual };
            this.textNodes.set(element, nodes);
        }
        return nodes;
    }
    // КОНЕЦ ФУНКЦИИ ensureTextNodes

    // НАЧАЛО ФУНКЦИИ setCanonical
    public setCanonical(element: HTMLElement | null, text: string): void {
        if (!element) return;
        const changed = element.dataset.canonicalText !== text;
        if (changed && this.isActive(element)) this.stop(element);
        if (changed) element.dataset.canonicalText = text;
        const nodes = this.ensureTextNodes(element);
        if (nodes.canonical) {
            if (nodes.canonical.textContent !== text) nodes.canonical.textContent = text;
        } else if (!element.hasAttribute('aria-label') || element.dataset.glyphAria === 'canonical') {
            if (element.getAttribute('aria-label') !== text) element.setAttribute('aria-label', text);
            if (element.dataset.glyphAria !== 'canonical') element.dataset.glyphAria = 'canonical';
        }
        if (changed || !this.isActive(element)) this.setVisualText(element, text);
    }
    // КОНЕЦ ФУНКЦИИ setCanonical

    // НАЧАЛО ФУНКЦИИ setVisualText
    /** Внешняя сборка сохраняет метрики канона: широкие знаки вписываются в его ячейки. */
    public setVisualText(element: HTMLElement | null, text: string): void {
        if (!element) return;
        const visual = this.ensureTextNodes(element).visual;
        const canonical = element.dataset.canonicalText ?? text;
        const source = splitGlyphText(canonical);
        const glyphs = splitGlyphText(text);
        if (text === canonical || source.length !== glyphs.length) {
            this.fittedLines.delete(element);
            if (visual.textContent !== text) visual.textContent = text;
            return;
        }
        let line = this.fittedLines.get(element);
        if (!line || line.visual !== visual || line.canonical !== canonical) {
            const cells = source.map((character) => {
                const node = element.ownerDocument.createElement('span');
                const measure = element.ownerDocument.createElement('span');
                const window = element.ownerDocument.createElement('span');
                const ink = element.ownerDocument.createElement('span');
                node.className = 'glyph-fitted-cell';
                measure.className = 'glyph-reel-measure';
                measure.textContent = character;
                window.className = 'glyph-reel-window';
                ink.className = 'glyph-reel-ink';
                window.replaceChildren(ink);
                node.replaceChildren(measure, window);
                return { node, ink, glyph: '' };
            });
            visual.replaceChildren(...cells.map((cell) => cell.node));
            line = { canonical, visual, cells, text, fitKey: '' };
            this.fittedLines.set(element, line);
        }
        // Появление шрифта и новая ширина строки обновляют fit даже при том же наборе знаков.
        const fitKey = `${getGlyphFontEpoch()}:${element.offsetWidth}:${element.offsetHeight}`;
        const layoutChanged = fitKey !== line.fitKey;
        line.fitKey = fitKey;
        line.text = text;
        line.cells.forEach((cell, index) => {
            const glyph = glyphs[index];
            if (glyph === cell.glyph && !layoutChanged) return;
            cell.glyph = glyph;
            const canonicalGlyph = glyph === source[index];
            const waiting = glyph === GLYPH_WAITING_SPACE || /^\s+$/u.test(glyph);
            cell.node.dataset.glyphStatic = canonicalGlyph ? 'canonical' : waiting ? 'waiting' : 'rolling';
            if (!canonicalGlyph && !waiting) setFittedGlyph(cell.ink, glyph, source[index]);
        });
    }
    // КОНЕЦ ФУНКЦИИ setVisualText

    // НАЧАЛО ФУНКЦИИ getVisualText
    public getVisualText(element: HTMLElement): string {
        const session = this.sessions.get(element);
        if (session) return session.logicalText;
        const fitted = this.fittedLines.get(element);
        if (fitted?.visual.parentElement === element) return fitted.text;
        const visual = this.textNodes.get(element)?.visual;
        return visual?.parentElement === element ? visual.textContent ?? '' : element.textContent ?? '';
    }
    // КОНЕЦ ФУНКЦИИ getVisualText

    // НАЧАЛО ФУНКЦИИ isActive
    public isActive(element: HTMLElement): boolean { return this.sessions.has(element); }
    // КОНЕЦ ФУНКЦИИ isActive
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. НЕПОДВИЖНЫЕ ЯЧЕЙКИ И ПЕРЕЛИСТЫВАНИЕ СЛЕВА НАПРАВО
    // НАЧАЛО ФУНКЦИИ createReels
    private createReels(element: HTMLElement, canonical: string): GlyphReelCell[] {
        const characters = splitGlyphText(canonical);
        const nodes: HTMLElement[] = [];
        const cells: GlyphReelCell[] = [];
        const document = element.ownerDocument;
        for (let index = 0; index < characters.length; index++) {
            const cell = document.createElement('span');
            const measure = document.createElement('span');
            const windowEl = document.createElement('span');
            const track = document.createElement('span');
            const outgoing = document.createElement('span');
            const incoming = document.createElement('span');
            const outgoingInk = document.createElement('span');
            const incomingInk = document.createElement('span');
            cell.className = 'glyph-reel-cell';
            cell.dataset.glyphReel = String(index);
            measure.className = 'glyph-reel-measure';
            measure.textContent = characters[index];
            windowEl.className = 'glyph-reel-window';
            track.className = 'glyph-reel-track';
            outgoing.className = incoming.className = 'glyph-reel-symbol';
            outgoingInk.className = incomingInk.className = 'glyph-reel-ink';
            outgoingInk.textContent = incomingInk.textContent = GLYPH_WAITING_SPACE;
            outgoing.replaceChildren(outgoingInk);
            incoming.replaceChildren(incomingInk);
            track.replaceChildren(outgoing, incoming);
            windowEl.replaceChildren(track);
            cell.replaceChildren(measure, windowEl);
            nodes.push(cell);
            cell.dataset.glyphState = 'waiting';
            cells.push({ index, canonical: characters[index], node: cell, track, outgoing, incoming, outgoingInk, incomingInk,
                turn: -1, progress: -1, fitEpoch: -1, state: 'waiting' });
        }
        this.ensureTextNodes(element).visual.replaceChildren(...nodes);
        return cells;
    }
    // КОНЕЦ ФУНКЦИИ createReels

    // НАЧАЛО ФУНКЦИИ updateReels
    private updateReels(session: HoverSession, signals: Readonly<VisualSignalSnapshot>): void {
        const characters: string[] = [];
        const rollDuration = session.rollMs * REEL_TURNS + REEL_HOLD_MS * (REEL_TURNS - 1);
        const totalMs = session.waveMs + rollDuration;
        const elapsed = session.elapsedMs - session.delayMs;
        for (const cell of session.cells) {
            const front = elapsed < 0 ? { state: 'waiting' as const, progress: 0 } :
                getOrderedGlyphState(cell.index, session.cells.length, elapsed / totalMs, rollDuration / totalMs);
            if (front.state !== cell.state) {
                cell.state = front.state;
                cell.node.dataset.glyphState = front.state;
            }
            if (front.state === 'waiting') {
                characters[cell.index] = GLYPH_WAITING_SPACE;
                if (cell.progress !== 0) {
                    cell.track.style.setProperty('transform', 'none');
                    setTurn(cell, 0.5);
                    cell.progress = 0;
                }
                continue;
            }
            if (front.state === 'locked') {
                // Закрепление меняет настоящий DOM, а не только логическую строку.
                if (cell.turn !== REEL_TURNS) {
                    cell.outgoingInk.textContent = cell.canonical;
                    cell.incomingInk.textContent = '';
                    cell.track.style.setProperty('transform', 'none');
                    setTurn(cell, 0);
                    cell.turn = REEL_TURNS;
                }
                characters[cell.index] = cell.canonical;
                continue;
            }
            const localMs = front.progress * rollDuration;
            const turn = Math.min(REEL_TURNS - 1, Math.floor(localMs / (session.rollMs + REEL_HOLD_MS)));
            const mutable = isMutableGlyph(cell.canonical);
            const from = mutable ? pickGlyph(signals.phase, cell.index + session.offset, turn, signals.seed) : cell.canonical;
            const to = !mutable || turn === REEL_TURNS - 1 ? cell.canonical :
                pickGlyph(signals.phase, cell.index + session.offset, turn + 1, signals.seed);
            const fitEpoch = getGlyphFontEpoch();
            const refreshSymbols = turn !== cell.turn || fitEpoch !== cell.fitEpoch;
            if (refreshSymbols) {
                cell.turn = turn;
                cell.fitEpoch = fitEpoch;
                setFittedGlyph(cell.outgoingInk, from, cell.canonical);
                setFittedGlyph(cell.incomingInk, to, cell.canonical);
            }
            const rollMs = localMs - turn * (session.rollMs + REEL_HOLD_MS);
            const progress = ease(rollMs / session.rollMs);
            if (progress !== cell.progress || refreshSymbols) {
                cell.progress = progress;
                cell.track.style.setProperty('transform', 'none');
                setTurn(cell, progress);
            }
            characters[cell.index] = progress > 0.5 ? to : from;
        }
        session.logicalText = characters.join('');
    }
    // КОНЕЦ ФУНКЦИИ updateReels
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. ЖИЗНЕННЫЙ ЦИКЛ И ОБЩИЙ КАДР
    // НАЧАЛО ФУНКЦИИ start
    public start(element: HTMLElement, canonical: string, offset = 0): void {
        if (this.sessions.get(element)?.canonical === canonical) return;
        this.stop(element);
        this.setCanonical(element, canonical);
        const signals = getVisualSignals();
        if (!canonical || signals.isPaused || signals.reducedMotion) return;
        const cells = this.createReels(element, canonical);
        if (!cells.length) return;
        const restore = (): void => this.stop(element);
        element.addEventListener('pointerleave', restore);
        element.addEventListener('blur', restore);
        const profile = getGlyphProfile(signals.phase);
        this.sessions.set(element, {
            canonical, logicalText: canonical, cells,
            elapsedMs: 0, delayMs: Math.max(0, Math.min(240, offset * 60)),
            rollMs: profile.rollMs, dwellMs: profile.dwellMs, offset,
            waveMs: Math.min(MAX_WAVE_MS, Math.max(0, cells.length - 1) * SLOT_WAVE_MS),
            cleanup: () => { element.removeEventListener('pointerleave', restore); element.removeEventListener('blur', restore); },
        });
        this.updateReels(this.sessions.get(element)!, signals);
        element.dataset.glyphActive = '1';
        element.dataset.scrambling = '1';
        if (!this.unsubscribe) this.unsubscribe = subscribeVisualSignals((snapshot) => this.update(snapshot));
    }
    // КОНЕЦ ФУНКЦИИ start

    // НАЧАЛО ФУНКЦИИ stop
    public stop(element: HTMLElement): void {
        const session = this.sessions.get(element);
        session?.cleanup();
        this.sessions.delete(element);
        if (session) this.setCanonical(element, element.dataset.canonicalText ?? session.canonical);
        delete element.dataset.glyphActive;
        element.dataset.scrambling = '0';
        element.style.removeProperty('--glyph-depth-shift');
        element.style.removeProperty('--glyph-depth-glow');
        if (!this.sessions.size && this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
    }
    // КОНЕЦ ФУНКЦИИ stop

    // НАЧАЛО ФУНКЦИИ stopAll
    public stopAll(): void { this.sessions.forEach((_session, element) => this.stop(element)); }
    // КОНЕЦ ФУНКЦИИ stopAll

    // НАЧАЛО ФУНКЦИИ update
    private update(signals: Readonly<VisualSignalSnapshot>): void {
        this.sessions.forEach((session, element) => {
            if (!element.isConnected || signals.isPaused || signals.reducedMotion) { this.stop(element); return; }
            session.elapsedMs += signals.frameDtSec * 1000;
            const rollDuration = (session.rollMs + REEL_HOLD_MS) * (REEL_TURNS - 1) + session.rollMs;
            const duration = session.delayMs + session.waveMs + rollDuration + session.dwellMs;
            if (session.elapsedMs >= duration) { this.stop(element); return; }
            this.updateReels(session, signals);
            const depth = Math.sin(Math.min(1, Math.max(0, session.elapsedMs - session.delayMs) / (duration - session.delayMs)) * Math.PI);
            element.style.setProperty('--glyph-depth-shift', (-0.65 * depth).toFixed(2) + 'px');
            element.style.setProperty('--glyph-depth-glow', (0.3 + depth * 0.3 + signals.pulse * 0.1).toFixed(3));
        });
    }
    // КОНЕЦ ФУНКЦИИ update
    // КОНЕЦ РАЗДЕЛА 4
}
export const calmGlyphHover = new CalmGlyphHover();
