// ============================================================================
// ФАЙЛ: frontend/src/engine/hud/localeController.ts
// НАЗНАЧЕНИЕ: Выбор языка и обновление подписей HUD с сохранением DOM и геометрии.
// РАЗДЕЛЫ: 1. Исходные строки; 2. Локализация узлов; 3. Привязка управления.
// ============================================================================

import {
    LOCALES, getLocale, hasUiTranslation, setLocale, subscribeLocale,
    translateLog, translateUi, type Locale,
} from '../../core/locale';
import { setSolidButtonBackLabel, setSolidButtonLabel } from '../../core/buttonSolid';
import { calmGlyphHover } from '../../core/glyphHover';
import { resourceLedger } from '../../core/resourceLedger';
import { universeStore } from '../../store/universeState';
import { syncHudDomWithState } from './hudDomOrchestrator';

// НАЧАЛО РАЗДЕЛА 1. ИСХОДНЫЕ СТРОКИ
const textSources = new WeakMap<Text, string>();
const dynamicSources = new WeakMap<HTMLElement, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();
const hostSources = new WeakMap<HTMLElement, string>();
const ATTRIBUTE_NAMES = ['title', 'aria-label', 'aria-description'] as const;
const EXCLUDED_CONTENT = 'script, style, canvas, svg, #explanation-dialog, [data-button-solid], ' +
    '[data-glyph-visual], [data-glyph-canonical], .starfall-drops-layer, .waterfall-stream-overlay';
let activeDisposer: (() => void) | null = null;

// НАЧАЛО ФУНКЦИИ translateHudText
/** Имена модулей, числа и технические коды проходят через словари без подмены. */
export function translateHudText(source: string, locale: Locale = getLocale()): string {
    const text = translateUi(source, locale);
    return text !== source || !/[\u0400-\u04FF]/u.test(source) ? text : translateLog(source, locale);
}
// КОНЕЦ ФУНКЦИИ translateHudText

// НАЧАЛО ФУНКЦИИ getLocalizedControlLabels
export function getLocalizedControlLabels(
    source: string, locale: Locale = getLocale(), languageControl = false,
): { front: string; back: string } {
    return languageControl
        ? {
            front: translateUi('LANGUAGE', locale) + ': ' + locale.toUpperCase(),
            back: translateUi('LANGUAGE', 'en') + ': ' + locale.toUpperCase(),
        }
        : { front: translateUi(source, locale), back: translateUi(source, 'en') };
}
// КОНЕЦ ФУНКЦИИ getLocalizedControlLabels

// НАЧАЛО ФУНКЦИИ rememberLocaleTextNode
/** JSX сохраняет источник до перевода, включая панели, смонтированные позднее. */
export function rememberLocaleTextNode(node: Text, source: string): void {
    textSources.set(node, source);
}
// КОНЕЦ ФУНКЦИИ rememberLocaleTextNode

// НАЧАЛО ФУНКЦИИ rememberLocaleElementText
/** Телеметрия хранит последнее исходное значение без дополнительных DOM-записей. */
export function rememberLocaleElementText(node: HTMLElement, source: string): void {
    dynamicSources.set(node, source);
}
// КОНЕЦ ФУНКЦИИ rememberLocaleElementText
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ЛОКАЛИЗАЦИЯ УЗЛОВ
// НАЧАЛО ФУНКЦИИ rememberLocaleAttributes
export function rememberLocaleAttributes(node: Element, locale: Locale = getLocale()): void {
    let sources = attributeSources.get(node);
    if (!sources) {
        sources = new Map();
        attributeSources.set(node, sources);
    }
    for (const name of ATTRIBUTE_NAMES) {
        if (!sources.has(name)) {
            const source = node.getAttribute(name);
            if (typeof source === 'string') sources.set(name, source);
        }
        const source = sources.get(name);
        if (source === undefined) continue;
        const translated = translateHudText(source, locale);
        if (node.getAttribute(name) !== translated) node.setAttribute(name, translated);
    }
}
// КОНЕЦ ФУНКЦИИ rememberLocaleAttributes

// НАЧАЛО ФУНКЦИИ setExistingText
/** Сохраняет текстовые узлы и вложенные элементы вместо замены дерева. */
function setExistingText(node: HTMLElement, value: string): boolean {
    const children = Array.from(node.childNodes);
    if (!children.length || children.some((child) => child.nodeType !== 3)) return false;
    children.forEach((child, index) => {
        const next = index === 0 ? value : '';
        if (child.nodeValue !== next) child.nodeValue = next;
    });
    return true;
}
// КОНЕЦ ФУНКЦИИ setExistingText

// НАЧАЛО ФУНКЦИИ localizeNode
function localizeNode(node: Node, locale: Locale): void {
    if (node.nodeType === 3) {
        const text = node as Text;
        const source = textSources.get(text) ?? text.nodeValue ?? '';
        if (!textSources.has(text)) textSources.set(text, source);
        const translated = translateHudText(source, locale);
        if (text.nodeValue !== translated) text.nodeValue = translated;
        return;
    }
    if (node.nodeType !== 1) return;
    const element = node as HTMLElement;
    rememberLocaleAttributes(element, locale);
    if (element.matches(EXCLUDED_CONTENT)) return;
    const source = dynamicSources.get(element);
    if (source !== undefined && setExistingText(element, translateHudText(source, locale))) {
        if (hasUiTranslation(source) || /[\u0590-\u05FF]/u.test(element.textContent ?? '')) element.dir = 'auto';
        return;
    }
    for (const child of Array.from(element.childNodes)) localizeNode(child, locale);
    if (element.childNodes.length && !element.children.length &&
        (hasUiTranslation((element.textContent ?? '').trim()) || /[\u0590-\u05FF]/u.test(element.textContent ?? ''))) {
        element.dir = 'auto';
    }
}
// КОНЕЦ ФУНКЦИИ localizeNode

// НАЧАЛО ФУНКЦИИ localizeRotatingHost
function localizeRotatingHost(host: HTMLElement, locale: Locale): void {
    const source = host.dataset.localeSource ?? hostSources.get(host) ??
        host.dataset.canonicalText ?? host.textContent?.trim() ?? '';
    hostSources.set(host, source);
    const { front, back } = getLocalizedControlLabels(source, locale, host.id === 'btn-language');
    setSolidButtonBackLabel(host, back);
    setSolidButtonLabel(host, front);
    host.querySelector<HTMLElement>('.solid-button-label:not(.solid-button-label--back)')?.setAttribute('dir', 'auto');
    host.querySelector<HTMLElement>('.solid-button-label--back')?.setAttribute('dir', 'ltr');
}
// КОНЕЦ ФУНКЦИИ localizeRotatingHost
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ВЫБОР ЯЗЫКА И ЖИЗНЕННЫЙ ЦИКЛ
// НАЧАЛО ФУНКЦИИ mountLocaleControls
/** Монтируется после CSS-тел кнопок; подписка действует только на события языка. */
export function mountLocaleControls(): () => void {
    if (typeof document === 'undefined') return () => {};
    activeDisposer?.();
    const root = document.documentElement;
    const previousLang = root.getAttribute('lang');
    const previousDir = root.getAttribute('dir');
    const button = document.getElementById('btn-language');
    let disposed = false;

    // НАЧАЛО ФУНКЦИИ refreshLocale
    function refreshLocale(locale: Locale): void {
        if (disposed) return;
        calmGlyphHover.stopAll();
        root.lang = locale;
        root.dir = locale === 'he' ? 'rtl' : 'ltr';
        for (const node of document.querySelectorAll<HTMLElement>('#hud-overlay-root, #ui-audio-unlock-banner')) {
            localizeNode(node, locale);
        }
        // Холст и финал имеют отдельные визуальные контроллеры; здесь меняются лишь их подписи доступности.
        for (const node of document.querySelectorAll<HTMLElement>('#universe-canvas, #layer5-finale-root [aria-label], #layer5-finale-root [title]')) {
            rememberLocaleAttributes(node, locale);
        }
        // Панель пояснений переводит собственные кубоиды своим контроллером.
        for (const host of document.querySelectorAll<HTMLElement>('#hud-overlay-root [data-button-solid="1"]')) {
            localizeRotatingHost(host, locale);
        }
        syncHudDomWithState(universeStore.getState());
    }
    // КОНЕЦ ФУНКЦИИ refreshLocale

    // НАЧАЛО ФУНКЦИИ cycleLocale
    function cycleLocale(): void {
        const next = (LOCALES.indexOf(getLocale()) + 1) % LOCALES.length;
        setLocale(LOCALES[next]);
    }
    // КОНЕЦ ФУНКЦИИ cycleLocale
    button?.addEventListener('click', cycleLocale);
    const unsubscribe = subscribeLocale(refreshLocale);
    const listenerCount = button ? 2 : 1;
    resourceLedger.trackPageLifetimeAllocation('listeners', listenerCount);
    refreshLocale(getLocale());

    // НАЧАЛО ФУНКЦИИ disposeLocaleControls
    function disposeLocaleControls(): void {
        if (disposed) return;
        disposed = true;
        unsubscribe();
        button?.removeEventListener('click', cycleLocale);
        if (previousLang === null) root.removeAttribute('lang');
        else root.setAttribute('lang', previousLang);
        if (previousDir === null) root.removeAttribute('dir');
        else root.setAttribute('dir', previousDir);
        resourceLedger.trackPageLifetimeRelease('listeners', listenerCount);
        if (activeDisposer === disposeLocaleControls) activeDisposer = null;
    }
    // КОНЕЦ ФУНКЦИИ disposeLocaleControls
    activeDisposer = disposeLocaleControls;
    return disposeLocaleControls;
}
// КОНЕЦ ФУНКЦИИ mountLocaleControls
// КОНЕЦ РАЗДЕЛА 3
