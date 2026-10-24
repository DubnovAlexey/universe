// ============================================================================
// ФАЙЛ: frontend/src/core/glyphHover.ts
// НАЗНАЧЕНИЕ: Общий спокойный Roll/Dwell для DOM, ведомый публикацией кадра.
// РАЗДЕЛЫ: 1. Контракт сеанса; 2. Канонический текст; 3. Жизненный цикл/кадр.
// ФУНКЦИИ: setCanonical, start, stop, stopAll, isActive, update. Новых RAF/таймеров нет.
// ============================================================================
import { getVisualSignals, subscribeVisualSignals, type VisualSignalSnapshot } from './visualSignals';
import { getGlyphProfile, scrambleCanonicalText } from './glyphGrammar';

// НАЧАЛО РАЗДЕЛА 1. СЕАНС
interface HoverSession { canonical: string; offset: number; elapsedMs: number; lastSimSec: number; cleanup: () => void; }
class CalmGlyphHover {
    private sessions = new Map<HTMLElement, HoverSession>();
    private unsubscribe: (() => void) | null = null;
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. КАНОНИЧЕСКИЙ ТЕКСТ
    // НАЧАЛО ФУНКЦИИ setCanonical
    public setCanonical(element: HTMLElement | null, text: string): void {
        if (!element) return;
        const changed = element.dataset.canonicalText !== text;
        element.dataset.canonicalText = text;
        if ((element.matches('button, a, h1, h2, h3, h4') && !element.hasAttribute('aria-label')) || element.dataset.glyphAria === 'canonical') {
            element.setAttribute('aria-label', text);
            element.dataset.glyphAria = 'canonical';
        }
        if (changed || !this.isActive(element)) element.textContent = text;
    }
    // КОНЕЦ ФУНКЦИИ setCanonical
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
            canonical, offset, elapsedMs: 0, lastSimSec: signals.simTimeSec,
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
        if (session) element.textContent = element.dataset.canonicalText ?? session.canonical;
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
            const dt = Math.max(0, Math.min(0.05, signals.simTimeSec - session.lastSimSec));
            session.lastSimSec = signals.simTimeSec;
            session.elapsedMs += dt * 1000;
            const profile = getGlyphProfile(signals.phase);
            const rollMs = Math.min(180, profile.rollMs + signals.low * 8);
            const rollDuration = rollMs * 3;
            const duration = rollDuration + profile.dwellMs;
            if (session.elapsedMs >= duration) { this.stop(element); return; }
            const step = Math.min(2, Math.floor(session.elapsedMs / rollMs));
            const canonical = element.dataset.canonicalText ?? session.canonical;
            const text = scrambleCanonicalText(canonical, signals.phase, step,
                Math.min(1, session.elapsedMs / rollDuration), session.offset);
            if (element.textContent !== text) element.textContent = text;
            const depth = Math.sin(Math.min(1, session.elapsedMs / duration) * Math.PI);
            element.style.setProperty('--glyph-depth-shift', `${(-1.4 * depth).toFixed(2)}px`);
            element.style.setProperty('--glyph-depth-glow', (0.2 + depth * 0.2 + signals.pulse * 0.1 + signals.kuramotoR * 0.05).toFixed(3));
        });
    }
    // КОНЕЦ ФУНКЦИИ update
    // КОНЕЦ РАЗДЕЛА 3
}
export const calmGlyphHover = new CalmGlyphHover();
