// ============================================================================
// ФАЙЛ: frontend/src/core/glyphHover.ts
// НАЗНАЧЕНИЕ: Общий спокойный Roll/Dwell для DOM, ведомый публикацией кадра.
// РАЗДЕЛЫ: 1. Контракт сеанса; 2. Канонический/видимый текст; 3. Жизненный цикл/кадр.
// ФУНКЦИИ: ensureTextNodes, setCanonical, setVisualText, getVisualText, start, stop,
// stopAll, isActive, update. Новых RAF/таймеров нет.
// ============================================================================
import { getVisualSignals, subscribeVisualSignals, type VisualSignalSnapshot } from './visualSignals';
import { getGlyphProfile, scrambleCanonicalText } from './glyphGrammar';

// НАЧАЛО РАЗДЕЛА 1. СЕАНС
interface HoverSession { canonical: string; offset: number; elapsedMs: number; cleanup: () => void; }
interface GlyphTextNodes { canonical: HTMLElement; visual: HTMLElement; }
class CalmGlyphHover {
    private sessions = new Map<HTMLElement, HoverSession>();
    private textNodes = new WeakMap<HTMLElement, GlyphTextNodes>();
    private unsubscribe: (() => void) | null = null;
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. КАНОНИЧЕСКИЙ ТЕКСТ
    // НАЧАЛО ФУНКЦИИ ensureTextNodes
    /** Generic/paragraph не допускают aria-label: канон остаётся доступным текстом. */
    private ensureTextNodes(element: HTMLElement): GlyphTextNodes | null {
        if (element.matches('button, a, h1, h2, h3, h4, h5, h6')) return null;
        let nodes = this.textNodes.get(element);
        if (!nodes || nodes.canonical.parentElement !== element || nodes.visual.parentElement !== element) {
            const canonical = element.ownerDocument.createElement('span');
            const visual = element.ownerDocument.createElement('span');
            canonical.className = 'glyph-canonical-text';
            canonical.dataset.glyphCanonical = '1';
            visual.setAttribute('aria-hidden', 'true');
            visual.dataset.glyphVisual = '1';
            canonical.textContent = element.dataset.canonicalText ?? element.textContent ?? '';
            visual.textContent = canonical.textContent;
            nodes = { canonical, visual };
            element.replaceChildren(canonical, visual);
            this.textNodes.set(element, nodes);
        }
        return nodes;
    }
    // КОНЕЦ ФУНКЦИИ ensureTextNodes

    // НАЧАЛО ФУНКЦИИ setCanonical
    public setCanonical(element: HTMLElement | null, text: string): void {
        if (!element) return;
        const changed = element.dataset.canonicalText !== text;
        if (changed) element.dataset.canonicalText = text;
        const nodes = this.ensureTextNodes(element);
        if (nodes) {
            if (nodes.canonical.textContent !== text) nodes.canonical.textContent = text;
        } else if (!element.hasAttribute('aria-label') || element.dataset.glyphAria === 'canonical') {
            if (element.getAttribute('aria-label') !== text) element.setAttribute('aria-label', text);
            if (element.dataset.glyphAria !== 'canonical') element.dataset.glyphAria = 'canonical';
        }
        if (changed || !this.isActive(element)) this.setVisualText(element, text);
    }
    // КОНЕЦ ФУНКЦИИ setCanonical

    // НАЧАЛО ФУНКЦИИ setVisualText
    /** Меняет только декоративный слой, сохраняя канон для средств доступности. */
    public setVisualText(element: HTMLElement | null, text: string): void {
        if (!element) return;
        const visual = this.ensureTextNodes(element)?.visual ?? element;
        if (visual.textContent !== text) visual.textContent = text;
    }
    // КОНЕЦ ФУНКЦИИ setVisualText

    // НАЧАЛО ФУНКЦИИ getVisualText
    public getVisualText(element: HTMLElement): string {
        const nodes = this.textNodes.get(element);
        return nodes?.visual.parentElement === element ? nodes.visual.textContent ?? '' : element.textContent ?? '';
    }
    // КОНЕЦ ФУНКЦИИ getVisualText

    // НАЧАЛО ФУНКЦИИ isActive
    public isActive(element: HTMLElement): boolean { return this.sessions.has(element); }
    // КОНЕЦ ФУНКЦИИ isActive
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ЖИЗНЕННЫЙ ЦИКЛ И КАДР
    // НАЧАЛО ФУНКЦИИ start
    public start(element: HTMLElement, canonical: string, offset = 0): void {
        this.stop(element);
        this.setCanonical(element, canonical);
        const signals = getVisualSignals();
        if (!canonical || signals.isPaused || signals.reducedMotion) return;
        const restore = (): void => this.stop(element);
        element.addEventListener('pointerleave', restore);
        element.addEventListener('blur', restore);
        this.sessions.set(element, {
            canonical, offset, elapsedMs: 0,
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
    /** Синхронная очистка при скрытии страницы, когда следующий RAF не гарантирован. */
    public stopAll(): void {
        this.sessions.forEach((_session, element) => this.stop(element));
    }
    // КОНЕЦ ФУНКЦИИ stopAll

    // НАЧАЛО ФУНКЦИИ update
    private update(signals: Readonly<VisualSignalSnapshot>): void {
        this.sessions.forEach((session, element) => {
            if (!element.isConnected || signals.isPaused || signals.reducedMotion) { this.stop(element); return; }
            session.elapsedMs += signals.frameDtSec * 1000;
            const profile = getGlyphProfile(signals.phase);
            const rollMs = Math.min(180, profile.rollMs + signals.low * 8);
            const rollDuration = rollMs * 3;
            const duration = rollDuration + profile.dwellMs;
            if (session.elapsedMs >= duration) { this.stop(element); return; }
            const step = Math.min(2, Math.floor(session.elapsedMs / rollMs));
            const canonical = element.dataset.canonicalText ?? session.canonical;
            const text = scrambleCanonicalText(canonical, signals.phase, step,
                Math.min(1, session.elapsedMs / rollDuration), session.offset);
            this.setVisualText(element, text);
            const depth = Math.sin(Math.min(1, session.elapsedMs / duration) * Math.PI);
            element.style.setProperty('--glyph-depth-shift', `${(-1.4 * depth).toFixed(2)}px`);
            element.style.setProperty('--glyph-depth-glow', (0.2 + depth * 0.2 + signals.pulse * 0.1 + signals.kuramotoR * 0.05).toFixed(3));
        });
    }
    // КОНЕЦ ФУНКЦИИ update
    // КОНЕЦ РАЗДЕЛА 3
}
export const calmGlyphHover = new CalmGlyphHover();
