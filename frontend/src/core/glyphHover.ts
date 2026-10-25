// ============================================================================
// ФАЙЛ: frontend/src/core/glyphHover.ts
// НАЗНАЧЕНИЕ: Отчётливые символьные барабаны на общем кадре без дрожания вёрстки.
// РАЗДЕЛЫ: 1. Контракты/метрики; 2. Канонический текст; 3. Барабаны;
//          4. Жизненный цикл общего кадра.
// ФУНКЦИИ: ease, symbolFit, ensureTextNodes, setCanonical, setVisualText,
// getVisualText, isActive, createReels, updateReels, start, stop, stopAll, update.
// ============================================================================

import { getVisualSignals, subscribeVisualSignals, type VisualSignalSnapshot } from './visualSignals';
import { GLYPH_FONT_STACK, getGlyphFontEpoch, getGlyphProfile, isMutableGlyph, pickGlyph } from './glyphGrammar';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТЫ И МЕТРИКИ
interface GlyphTextNodes { canonical: HTMLElement | null; visual: HTMLElement; }
interface GlyphReelCell {
    index: number;
    canonical: string;
    track: HTMLElement;
    outgoing: HTMLElement;
    incoming: HTMLElement;
    delayMs: number;
    turn: number;
    progress: number;
}
interface HoverSession {
    canonical: string;
    characters: string[];
    logicalText: string;
    cells: GlyphReelCell[];
    elapsedMs: number;
    delayMs: number;
    rollMs: number;
    dwellMs: number;
    offset: number;
    cleanup: () => void;
}
const REEL_TURNS = 4;
const REEL_HOLD_MS = 120;
const SLOT_WAVE_MS = 24;
let metricsContext: CanvasRenderingContext2D | null | undefined;
const fitCache = new Map<string, number>();

// НАЧАЛО ФУНКЦИИ ease
function ease(value: number): number {
    const t = Math.max(0, Math.min(1, value));
    return t * t * t * (t * (t * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ ease

// НАЧАЛО ФУНКЦИИ symbolFit
/** Широкий исторический знак вписывается в локальное окно, не растягивая кнопку. */
function symbolFit(element: HTMLElement, glyph: string): number {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 1;
    const style = window.getComputedStyle(element);
    const fontPx = Number.parseFloat(style.fontSize) || 16;
    const rowWidth = Number.parseFloat(style.width);
    const availableWidth = Number.isFinite(rowWidth) && rowWidth > 0 ? rowWidth : fontPx * 1.15;
    const font = style.fontStyle + ' ' + style.fontWeight + ' ' + fontPx + 'px ' + GLYPH_FONT_STACK;
    const key = getGlyphFontEpoch() + ':' + font + ':' + availableWidth.toFixed(3) + ':' + glyph;
    const cached = fitCache.get(key);
    if (cached !== undefined) return cached;
    if (metricsContext === undefined) {
        try { metricsContext = document.createElement('canvas').getContext('2d'); }
        catch { metricsContext = null; }
    }
    if (!metricsContext) return 1;
    metricsContext.font = font;
    const width = metricsContext.measureText(glyph).width;
    const fit = width > 0 ? Math.min(1, availableWidth / width) : 1;
    fitCache.set(key, fit);
    return fit;
}
// КОНЕЦ ФУНКЦИИ symbolFit
// КОНЕЦ РАЗДЕЛА 1

class CalmGlyphHover {
    private sessions = new Map<HTMLElement, HoverSession>();
    private textNodes = new WeakMap<HTMLElement, GlyphTextNodes>();
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
    /** Внешняя сборка текста сохраняет тот же доступный канон и visual-контейнер. */
    public setVisualText(element: HTMLElement | null, text: string): void {
        if (!element) return;
        const visual = this.ensureTextNodes(element).visual;
        if (visual.textContent !== text) visual.textContent = text;
    }
    // КОНЕЦ ФУНКЦИИ setVisualText

    // НАЧАЛО ФУНКЦИИ getVisualText
    public getVisualText(element: HTMLElement): string {
        const session = this.sessions.get(element);
        if (session) return session.logicalText;
        const visual = this.textNodes.get(element)?.visual;
        return visual?.parentElement === element ? visual.textContent ?? '' : element.textContent ?? '';
    }
    // КОНЕЦ ФУНКЦИИ getVisualText

    // НАЧАЛО ФУНКЦИИ isActive
    public isActive(element: HTMLElement): boolean { return this.sessions.has(element); }
    // КОНЕЦ ФУНКЦИИ isActive
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. НЕПОДВИЖНЫЕ ОКНА И ВЕРТИКАЛЬНЫЕ ЛЕНТЫ
    // НАЧАЛО ФУНКЦИИ createReels
    private createReels(element: HTMLElement, canonical: string): GlyphReelCell[] {
        const characters = Array.from(canonical);
        const eligible = characters.flatMap((character, index) =>
            isMutableGlyph(character, characters[index + 1]) ? [index] : []);
        const wanted = Math.min(5, Math.max(2, Math.ceil(eligible.length * 0.42)));
        const selected: number[] = [];
        for (let slot = 0; slot < eligible.length && selected.length < wanted; slot++) {
            const rank = Math.floor(slot * eligible.length / wanted) % Math.max(1, eligible.length);
            const index = eligible[rank];
            if (!selected.some((prior) => Math.abs(prior - index) < 2)) selected.push(index);
        }
        if (!selected.length && eligible.length) selected.push(eligible[0]);
        selected.sort((a, b) => a - b);

        const nodes: HTMLElement[] = [];
        const cells: GlyphReelCell[] = [];
        const document = element.ownerDocument;
        let staticText = '';
        for (let index = 0; index < characters.length; index++) {
            if (!selected.includes(index)) { staticText += characters[index]; continue; }
            if (staticText) {
                const span = document.createElement('span');
                span.className = 'glyph-reel-static';
                span.textContent = staticText;
                nodes.push(span);
                staticText = '';
            }
            const cell = document.createElement('span');
            const measure = document.createElement('span');
            const windowEl = document.createElement('span');
            const track = document.createElement('span');
            const outgoing = document.createElement('span');
            const incoming = document.createElement('span');
            cell.className = 'glyph-reel-cell';
            cell.dataset.glyphReel = String(index);
            measure.className = 'glyph-reel-measure';
            measure.textContent = characters[index];
            windowEl.className = 'glyph-reel-window';
            track.className = 'glyph-reel-track';
            outgoing.className = incoming.className = 'glyph-reel-symbol';
            outgoing.textContent = incoming.textContent = characters[index];
            track.replaceChildren(outgoing, incoming);
            windowEl.replaceChildren(track);
            cell.replaceChildren(measure, windowEl);
            nodes.push(cell);
            cells.push({ index, canonical: characters[index], track, outgoing, incoming,
                delayMs: (cells.length % 5) * SLOT_WAVE_MS, turn: -1, progress: -1 });
        }
        if (staticText) {
            const span = document.createElement('span');
            span.className = 'glyph-reel-static';
            span.textContent = staticText;
            nodes.push(span);
        }
        this.ensureTextNodes(element).visual.replaceChildren(...nodes);
        return cells;
    }
    // КОНЕЦ ФУНКЦИИ createReels

    // НАЧАЛО ФУНКЦИИ updateReels
    private updateReels(session: HoverSession, signals: Readonly<VisualSignalSnapshot>): void {
        const characters = [...session.characters];
        for (const cell of session.cells) {
            const localMs = Math.max(0, session.elapsedMs - session.delayMs - cell.delayMs);
            const turn = Math.min(REEL_TURNS, Math.floor(localMs / (session.rollMs + REEL_HOLD_MS)));
            if (turn === REEL_TURNS) { characters[cell.index] = cell.canonical; continue; }
            const from = turn === 0 ? cell.canonical :
                pickGlyph(signals.phase, cell.index + session.offset, turn - 1, signals.seed);
            const to = turn === REEL_TURNS - 1 ? cell.canonical :
                pickGlyph(signals.phase, cell.index + session.offset, turn, signals.seed);
            if (turn !== cell.turn) {
                cell.turn = turn;
                cell.outgoing.textContent = from;
                cell.incoming.textContent = to;
                cell.outgoing.style.setProperty('font-family', from === cell.canonical ? 'inherit' : GLYPH_FONT_STACK);
                cell.incoming.style.setProperty('font-family', to === cell.canonical ? 'inherit' : GLYPH_FONT_STACK);
                if (from === cell.canonical) cell.outgoing.style.setProperty('font-size', 'inherit');
                else cell.outgoing.style.removeProperty('font-size');
                if (to === cell.canonical) cell.incoming.style.setProperty('font-size', 'inherit');
                else cell.incoming.style.removeProperty('font-size');
                cell.outgoing.style.setProperty('transform', 'scaleX(' + (from === cell.canonical ? 1 : symbolFit(cell.outgoing, from)).toFixed(3) + ')');
                cell.incoming.style.setProperty('transform', 'scaleX(' + (to === cell.canonical ? 1 : symbolFit(cell.incoming, to)).toFixed(3) + ')');
            }
            const rollMs = localMs - turn * (session.rollMs + REEL_HOLD_MS);
            const progress = ease(rollMs / session.rollMs);
            if (progress !== cell.progress) {
                cell.progress = progress;
                cell.track.style.setProperty('transform', 'translate3d(0, ' + (-100 * progress).toFixed(3) + '%, 0)');
            }
            characters[cell.index] = progress > 0 ? to : from;
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
            canonical, characters: Array.from(canonical), logicalText: canonical, cells,
            elapsedMs: 0, delayMs: Math.max(0, Math.min(240, offset * 60)),
            rollMs: profile.rollMs, dwellMs: profile.dwellMs, offset,
            cleanup: () => { element.removeEventListener('pointerleave', restore); element.removeEventListener('blur', restore); },
        });
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
            const lastDelay = session.cells[session.cells.length - 1]?.delayMs ?? 0;
            const rollDuration = (session.rollMs + REEL_HOLD_MS) * (REEL_TURNS - 1) + session.rollMs;
            const duration = session.delayMs + lastDelay + rollDuration + session.dwellMs;
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
