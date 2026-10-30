// ============================================================================
// ФАЙЛ: frontend/src/layers/explanationTextReveal.ts
// НАЗНАЧЕНИЕ: Ограниченная сборка вводных абзацев без изменения их наборной геометрии.
// РАЗДЕЛЫ: 1. Физический порядок и поворот; 2. Нативная мера и глифы; 3. Общий кадр.
// ФУНКЦИИ: getExplanationPhysicalOrder, getExplanationRevealTurns, getExplanationNativeOpacity, span,
// prepareParagraph, startExplanationTextReveal, cleanup, handleVisibilityChange, tick.
// ============================================================================

import { getGlyphFontEpoch, getOrderedGlyphState, getRenderableGlyphPool, isMutableGlyph, splitGlyphText } from '../core/glyphGrammar';
import { prepareFittedGlyph, setFittedGlyph } from '../core/glyphHover';
import { resourceLedger } from '../core/resourceLedger';
import { getVisualSignals, subscribeVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';

// НАЧАЛО РАЗДЕЛА 1. ФИЗИЧЕСКИЙ ПОРЯДОК, НЕ ЗАВИСЯЩИЙ ОТ ЯЗЫКА
export const EXPLANATION_TEXT_REVEAL_MS = 1000;
export const EXPLANATION_TEXT_HANDOFF_MS = 200;
export const EXPLANATION_TEXT_REVEAL_LIMIT = 240;
interface PhysicalGlyphBox { readonly left: number; readonly top: number; }

// НАЧАЛО ФУНКЦИИ getExplanationPhysicalOrder
/** Строки идут сверху вниз, а глифы каждой строки — физически слева направо, включая RTL. */
export function getExplanationPhysicalOrder(boxes: readonly PhysicalGlyphBox[]): number[] {
    const sorted = boxes.map((_, index) => index).sort((a, b) => boxes[a].top - boxes[b].top || boxes[a].left - boxes[b].left);
    const result: number[] = [];
    let line: number[] = [];
    let lineTop = -Infinity;
    for (const index of sorted) {
        if (line.length && boxes[index].top - lineTop > 4) {
            result.push(...line.sort((a, b) => boxes[a].left - boxes[b].left || a - b));
            line = [];
        }
        if (!line.length) lineTop = boxes[index].top;
        line.push(index);
    }
    result.push(...line.sort((a, b) => boxes[a].left - boxes[b].left || a - b));
    return result;
}
// КОНЕЦ ФУНКЦИИ getExplanationPhysicalOrder

// НАЧАЛО ФУНКЦИИ getExplanationRevealTurns
/** Знак поворота тот же, что у барабанов карточки; направление текста его не меняет. */
export function getExplanationRevealTurns(progress: number): { outgoing: number; incoming: number } {
    const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    return { outgoing: Math.min(90, p * 180), incoming: Math.max(-90, (p - 1) * 180) };
}
// КОНЕЦ ФУНКЦИИ getExplanationRevealTurns

// НАЧАЛО ФУНКЦИИ getExplanationNativeOpacity
/** Полное нативное начертание возвращается после набора, без скачка ink-масштаба. */
export function getExplanationNativeOpacity(elapsedMs: number): number {
    const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
    const t = Math.max(0, Math.min(1, (elapsed - EXPLANATION_TEXT_REVEAL_MS) / EXPLANATION_TEXT_HANDOFF_MS));
    return t * t * t * (t * (t * 6 - 15) + 10);
}
// КОНЕЦ ФУНКЦИИ getExplanationNativeOpacity
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. КАНОНИЧЕСКАЯ МЕРА И НЕПОДВИЖНЫЕ ОКНА
interface RevealCell {
    readonly canonical: string;
    readonly node: HTMLElement;
    readonly outgoing: HTMLElement;
    readonly incoming: HTMLElement;
    readonly outgoingInk: HTMLElement;
    readonly incomingInk: HTMLElement;
    readonly layoutKey: string;
    rank: number;
    prepared: boolean;
    state: 'waiting' | 'rolling' | 'locked';
}
interface RevealParagraph {
    readonly element: HTMLElement;
    readonly originalChildren: Node[];
    readonly originalPosition: string;
    readonly originalPositionPriority: string;
    readonly originalMarker: string | undefined;
    readonly overlay: HTMLElement;
    readonly prefix: HTMLElement;
    readonly tail: HTMLElement;
    readonly cells: readonly RevealCell[];
}

// НАЧАЛО ФУНКЦИИ span
function span(className: string): HTMLSpanElement {
    const node = document.createElement('span');
    node.className = className;
    return node;
}
// КОНЕЦ ФУНКЦИИ span

// НАЧАЛО ФУНКЦИИ prepareParagraph
/** Полная нативная строка сохраняет переносы, bidi и диакритику; окна не участвуют в layout. */
function prepareParagraph(element: HTMLElement): RevealParagraph | null {
    const text = element.textContent ?? '';
    if (!text.trim() || !element.isConnected) return null;
    const characters = splitGlyphText(text);
    const prefixText = characters.slice(0, EXPLANATION_TEXT_REVEAL_LIMIT).join('');
    const originalChildren = Array.from(element.childNodes);
    const originalPosition = element.style.getPropertyValue('position');
    const originalPositionPriority = element.style.getPropertyPriority('position');
    const originalMarker = element.dataset.explanationRevealing;
    const native = span('explanation-text-measure');
    native.setAttribute('aria-hidden', 'true');
    const prefix = span('explanation-text-prefix');
    prefix.style.setProperty('visibility', 'hidden');
    prefix.textContent = prefixText;
    const tail = span('explanation-text-tail');
    tail.style.setProperty('visibility', 'hidden');
    tail.textContent = characters.slice(EXPLANATION_TEXT_REVEAL_LIMIT).join('');
    native.append(prefix, tail);
    const canonical = span('glyph-canonical-text');
    canonical.textContent = text;
    const overlay = span('explanation-text-overlay');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.dir = 'ltr';
    for (const [property, value] of Object.entries({ position: 'absolute', inset: '0', 'pointer-events': 'none' })) {
        overlay.style.setProperty(property, value);
    }
    if (window.getComputedStyle(element).position === 'static') element.style.setProperty('position', 'relative');
    element.replaceChildren(canonical, native, overlay);
    element.dataset.explanationRevealing = 'true';

    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const scaleX = bounds.width / (Number.parseFloat(style.width) || element.offsetWidth || bounds.width) || 1;
    const scaleY = bounds.height / (Number.parseFloat(style.height) || element.offsetHeight || bounds.height) || 1;
    const range = document.createRange();
    const boxes: { canonical: string; left: number; top: number; width: number; height: number }[] = [];
    let offset = 0;
    for (const character of characters.slice(0, EXPLANATION_TEXT_REVEAL_LIMIT)) {
        const end = offset + character.length;
        if (!/^\s+$/u.test(character)) {
            range.setStart(prefix.firstChild!, offset);
            range.setEnd(prefix.firstChild!, end);
            const rect = range.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) boxes.push({
                canonical: character, left: (rect.left - bounds.left) / scaleX,
                top: (rect.top - bounds.top) / scaleY, width: rect.width / scaleX, height: rect.height / scaleY,
            });
        }
        offset = end;
    }
    const ranks = getExplanationPhysicalOrder(boxes);
    const cells: RevealCell[] = boxes.map((box) => {
        const node = span('explanation-text-cell');
        for (const [property, value] of Object.entries({
            position: 'absolute', left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`,
            height: `${box.height}px`, visibility: 'hidden', perspective: '400px',
        })) node.style.setProperty(property, value);
        const outgoing = span('explanation-text-face');
        const incoming = span('explanation-text-face');
        for (const face of [outgoing, incoming]) {
            for (const [property, value] of Object.entries({
                position: 'absolute', inset: '0', 'backface-visibility': 'hidden', 'transform-origin': 'center',
            })) face.style.setProperty(property, value);
        }
        const outgoingInk = span('glyph-reel-ink');
        const incomingInk = span('glyph-reel-ink');
        outgoing.append(outgoingInk); incoming.append(incomingInk);
        node.append(outgoing, incoming);
        overlay.append(node);
        return { canonical: box.canonical, node, outgoing, incoming, outgoingInk, incomingInk,
            layoutKey: `explanation:${box.width.toFixed(3)}:${box.height.toFixed(3)}`,
            rank: 0, prepared: false, state: 'waiting' };
    });
    ranks.forEach((index, rank) => { cells[index].rank = rank; });
    return { element, originalChildren, originalPosition, originalPositionPriority, originalMarker, overlay, prefix, tail, cells };
}
// КОНЕЦ ФУНКЦИИ prepareParagraph
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ОДНА ОГРАНИЧЕННАЯ ПОДПИСКА ОБЩЕГО КАДРА
// НАЧАЛО ФУНКЦИИ startExplanationTextReveal
export function startExplanationTextReveal(
    elements: readonly HTMLElement[], reducedMotion: boolean, delayMs = 0,
    clock: () => number = () => performance.now(),
): () => void {
    const noop = (): void => {};
    if (reducedMotion || getVisualSignals().isPaused || typeof document === 'undefined' || typeof window === 'undefined' || document.hidden ||
        typeof document.createRange !== 'function') return noop;
    const probe = document.createRange();
    if (typeof probe.setStart !== 'function' || typeof probe.setEnd !== 'function' || typeof probe.getBoundingClientRect !== 'function') return noop;
    const startedAt = clock();
    if (!Number.isFinite(startedAt)) return noop;
    const paragraphs = Array.from(new Set(elements)).map(prepareParagraph).filter((item): item is RevealParagraph => item !== null);
    if (!paragraphs.length) return noop;
    let disposed = false;
    const initialDelay = Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
    let elapsedMs = -initialDelay;
    const fontEpoch = getGlyphFontEpoch();
    let unsubscribe = noop;

    // НАЧАЛО ФУНКЦИИ cleanup
    function cleanup(): void {
        if (disposed) return;
        disposed = true;
        unsubscribe();
        window.removeEventListener('resize', cleanup);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        for (const record of paragraphs) {
            if (record.overlay.parentElement === record.element) record.element.replaceChildren(...record.originalChildren);
            if (record.originalPosition) record.element.style.setProperty('position', record.originalPosition, record.originalPositionPriority);
            else record.element.style.removeProperty('position');
            if (record.originalMarker === undefined) delete record.element.dataset.explanationRevealing;
            else record.element.dataset.explanationRevealing = record.originalMarker;
        }
        resourceLedger.trackPageLifetimeRelease('listeners', 3);
    }
    // КОНЕЦ ФУНКЦИИ cleanup

    // НАЧАЛО ФУНКЦИИ handleVisibilityChange
    function handleVisibilityChange(): void { if (document.hidden) cleanup(); }
    // КОНЕЦ ФУНКЦИИ handleVisibilityChange

    // НАЧАЛО ФУНКЦИИ tick
    function tick(signals: Readonly<VisualSignalSnapshot>): void {
        if (disposed) return;
        if (signals.reducedMotion || getGlyphFontEpoch() !== fontEpoch || paragraphs.some(({ element }) => !element.isConnected)) { cleanup(); return; }
        // Пауза сцены не оставляет читаемые абзацы скрытыми на середине набора.
        if (signals.isPaused) { cleanup(); return; }
        // Декоративная сборка использует те же монотонные миллисекунды, что и пыль;
        // ограниченный шаг физики не растягивает задержку текста при низком FPS.
        const now = clock();
        if (!Number.isFinite(now)) { cleanup(); return; }
        elapsedMs = Math.max(elapsedMs, now - startedAt - initialDelay);
        if (elapsedMs < 0) return;
        if (elapsedMs >= EXPLANATION_TEXT_REVEAL_MS + EXPLANATION_TEXT_HANDOFF_MS) { cleanup(); return; }
        const progress = Math.min(1, elapsedMs / EXPLANATION_TEXT_REVEAL_MS);
        // Набор уже завершён: fitted-чернила плавно передают место исходному тексту.
        const nativeOpacity = getExplanationNativeOpacity(elapsedMs);
        const pool = getRenderableGlyphPool(signals.phase);
        const writes: (() => void)[] = [];
        for (const paragraph of paragraphs) {
            if (elapsedMs >= EXPLANATION_TEXT_REVEAL_MS) writes.push(() => {
                paragraph.prefix.style.setProperty('visibility', 'visible');
                paragraph.prefix.style.setProperty('opacity', nativeOpacity.toFixed(5));
                paragraph.tail.style.setProperty('visibility', 'visible');
                paragraph.tail.style.setProperty('opacity', nativeOpacity.toFixed(5));
                paragraph.overlay.style.setProperty('opacity', (1 - nativeOpacity).toFixed(5));
            });
            const count = paragraph.cells.length;
            for (const cell of paragraph.cells) {
                const state = getOrderedGlyphState(cell.rank, count, progress, Math.min(0.22, 8 / Math.max(1, count)));
                if (state.state === 'waiting' || (state.state === 'locked' && cell.state === 'locked')) continue;
                if (!cell.prepared) {
                    const glyph = isMutableGlyph(cell.canonical) && pool.length ? pool[(cell.rank * 19 + (signals.seed >>> 0)) % pool.length] : cell.canonical;
                    const outgoingFit = prepareFittedGlyph(cell.outgoingInk, glyph, cell.canonical, cell.layoutKey);
                    const incomingFit = prepareFittedGlyph(cell.incomingInk, cell.canonical, cell.canonical, cell.layoutKey);
                    writes.push(() => {
                        setFittedGlyph(cell.outgoingInk, glyph, cell.canonical, outgoingFit);
                        setFittedGlyph(cell.incomingInk, cell.canonical, cell.canonical, incomingFit);
                    });
                    cell.prepared = true;
                }
                const p = state.state === 'locked' ? 1 : state.progress * state.progress * (3 - 2 * state.progress);
                const turns = getExplanationRevealTurns(p);
                cell.state = state.state;
                writes.push(() => {
                    cell.node.style.setProperty('visibility', 'visible');
                    cell.outgoing.style.setProperty('transform', `rotateY(${turns.outgoing.toFixed(3)}deg)`);
                    cell.incoming.style.setProperty('transform', `rotateY(${turns.incoming.toFixed(3)}deg)`);
                    cell.outgoing.style.setProperty('visibility', p < 0.5 ? 'visible' : 'hidden');
                    cell.incoming.style.setProperty('visibility', p >= 0.5 ? 'visible' : 'hidden');
                });
            }
        }
        writes.forEach((write) => write());
    }
    // КОНЕЦ ФУНКЦИИ tick

    unsubscribe = subscribeVisualSignals(tick, 'explanation-text-reveal');
    window.addEventListener('resize', cleanup, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    resourceLedger.trackPageLifetimeAllocation('listeners', 3);
    return cleanup;
}
// КОНЕЦ ФУНКЦИИ startExplanationTextReveal
// КОНЕЦ РАЗДЕЛА 3
