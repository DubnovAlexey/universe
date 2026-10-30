// ============================================================================
// ФАЙЛ: frontend/src/layers/ExplanationDialog.ts
// НАЗНАЧЕНИЕ: Общее доступное окно объяснений сцены и терминов финальной карточки.
// РАЗДЕЛЫ: 1. Контракт и безопасные DOM-узлы; 2. Содержимое; 3. Жизненный цикл окна.
// ФУНКЦИИ: element, renderSoundtrackCredit, setExplanationButtonText, setExplanationButtonBackText, createExplanationContour, appendMath, canRestoreFocus, mountExplanationDialog,
// syncLocaleLabels, revealTopicInNavigation, renderTopic, revealIntroduction,
// resizeExplanationContour, observeExplanationContour, restoreReadingState, close, open, handleClick, guardKeyboard,
// outsidePanel, handlePointerDown, handlePointerUp, handlePointerCancel,
// handleCancel, handleClose, dispose.
// ============================================================================

import {
    EXPLAINER_OVERVIEW_ID, EXPLAINER_TOPICS, getExplainerTopic, getExplainerTopics,
} from '../core/explainerTopics';
import { calmGlyphHover } from '../core/glyphHover';
import { setSolidButtonBackLabel, setSolidButtonLabel } from '../core/buttonSolid';
import { getLocale, subscribeLocale, translateUi } from '../core/locale';
import { resourceLedger } from '../core/resourceLedger';
import { sceneExplanationFocus } from '../core/sceneExplanationFocus';
import { getVisualSignals } from '../core/visualSignals';
import { buildLivingBreachContourPath, waterfallAnimator } from './Layer2_Metrics';
import { mountExplanationButtonMotion, type ExplanationButtonMotionBinding } from './explanationButtonMotion';
import { startExplanationTextReveal } from './explanationTextReveal';
import { EXPLANATION_ASSEMBLY_MS, playExplanationTrail } from './explanationTrail';
import { SOUNDTRACK_CREDIT } from '../utils/audioSync';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ И DOM-УЗЛЫ
export interface ExplanationDialogBinding {
    open(topicId?: string, trigger?: HTMLElement): void;
    dispose(): void;
}

type ExplanationMode = 'simple' | 'expert';
const MATH_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
const MATH_ELEMENTS = new Set([
    'math', 'mrow', 'mi', 'mn', 'mo', 'mtext', 'mfrac', 'msup', 'msub',
    'msubsup', 'msqrt', 'mroot', 'mover', 'munder', 'munderover', 'mspace',
]);

// --- НАЧАЛО ФУНКЦИИ element ---
function element<K extends keyof HTMLElementTagNameMap>(
    tag: K, className: string, text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
// --- КОНЕЦ ФУНКЦИИ element ---

// --- НАЧАЛО ФУНКЦИИ renderSoundtrackCredit ---
/** Закрытая по умолчанию карточка сохраняет основной экран свободным. */
function renderSoundtrackCredit(): HTMLDetailsElement {
    const details = element('details', 'explanation-soundtrack');
    details.append(element('summary', '', translateUi('О музыке')));
    const list = element('dl', '');
    const entries = [
        ['Композиция', SOUNDTRACK_CREDIT.title],
        ['Исполнитель', SOUNDTRACK_CREDIT.artist],
        ['Альбом', SOUNDTRACK_CREDIT.album],
    ] as const;
    for (const [label, value] of entries) {
        const field = element('dd', '', value);
        field.dir = 'ltr';
        list.append(element('dt', '', translateUi(label)), field);
    }
    details.append(list);
    return details;
}
// --- КОНЕЦ ФУНКЦИИ renderSoundtrackCredit ---

// --- НАЧАЛО ФУНКЦИИ setExplanationButtonText ---
/** Перевод меняет подписи существующих граней, сохраняя кнопку, фокус и её объёмное тело. */
function setExplanationButtonText(button: HTMLButtonElement, text: string): void {
    if (!setSolidButtonLabel(button, text) && button.textContent !== text) button.textContent = text;
}
// --- КОНЕЦ ФУНКЦИИ setExplanationButtonText ---

// --- НАЧАЛО ФУНКЦИИ setExplanationButtonBackText ---
/** Обратная грань остаётся английской; измеритель общего кубоида учитывает обе подписи. */
function setExplanationButtonBackText(button: HTMLButtonElement, text: string): void {
    if (!setSolidButtonBackLabel(button, text)) button.dataset.solidBackLabel = text;
}
// --- КОНЕЦ ФУНКЦИИ setExplanationButtonBackText ---

// --- НАЧАЛО ФУНКЦИИ createExplanationContour ---
/** Та же SVG-мембрана обновляется общим контроллером каскадов без отдельного кадра. */
function createExplanationContour(): SVGSVGElement {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'waterfall-contour-svg');
    svg.setAttribute('viewBox', '0 0 418 280');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('data-breach-contour', '5');
    path.setAttribute('d', buildLivingBreachContourPath(418, 280, waterfallAnimator.getTimeSec(), 3.75, 0.2));
    path.setAttribute('fill', 'rgba(3, 8, 20, 0.94)');
    path.setAttribute('stroke', 'rgba(125, 211, 252, 0.35)');
    path.setAttribute('stroke-width', '1.45');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(path);
    return svg;
}
// --- КОНЕЦ ФУНКЦИИ createExplanationContour ---

// --- НАЧАЛО ФУНКЦИИ createModeDivider ---
/** Общий каскад двигает разделитель теми же часами, что и линии телеметрии. */
function createModeDivider(): SVGSVGElement {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'explanation-mode-divider');
    svg.setAttribute('viewBox', '0 0 418 12');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('data-breach-wave-line', 'true');
    path.setAttribute('data-wave-y', '6');
    path.setAttribute('data-wave-amp', '1.6');
    path.setAttribute('d', 'M 12 6 L 406 6');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(125, 211, 252, 0.65)');
    path.setAttribute('stroke-width', '1.1');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(path);
    return svg;
}
// --- КОНЕЦ ФУНКЦИИ createModeDivider ---

// --- НАЧАЛО ФУНКЦИИ appendMath ---
/** Разбираются только константы каталога; текст формулы остаётся видимым и доступным. */
function appendMath(container: HTMLElement, source: string | undefined): void {
    if (!source || typeof DOMParser === 'undefined') return;
    const parsed = new DOMParser().parseFromString(source, 'application/xml');
    const math = parsed.documentElement;
    if (math.localName !== 'math' || math.namespaceURI !== MATH_NAMESPACE) return;
    const nodes = [math, ...Array.from(math.querySelectorAll('*'))];
    if (nodes.some((node) => node.namespaceURI !== MATH_NAMESPACE || !MATH_ELEMENTS.has(node.localName) ||
        Array.from(node.attributes).some((attribute) => !['xmlns', 'display'].includes(attribute.name) &&
            !(node.localName === 'mspace' && attribute.name === 'width' && /^\d+(\.\d+)?(em|ex|px)$/.test(attribute.value))))) return;
    const visual = element('div', 'explanation-math');
    visual.setAttribute('aria-hidden', 'true');
    visual.dir = 'ltr';
    visual.append(document.importNode(math, true));
    container.append(visual);
}
// --- КОНЕЦ ФУНКЦИИ appendMath ---

// --- НАЧАЛО ФУНКЦИИ canRestoreFocus ---
function canRestoreFocus(node: HTMLElement | null): node is HTMLElement {
    if (!node?.isConnected || node.closest('[hidden], [inert]') || node.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(node);
    return style.visibility !== 'hidden' && style.visibility !== 'collapse' && style.display !== 'none';
}
// --- КОНЕЦ ФУНКЦИИ canRestoreFocus ---
// КОНЕЦ РАЗДЕЛА 1

// --- НАЧАЛО ФУНКЦИИ mountExplanationDialog ---
/** Один экземпляр на страницу; монтировщик регистрирует dispose в registerPageDisposable. */
export function mountExplanationDialog(): ExplanationDialogBinding {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return { open: () => {}, dispose: () => {} };
    }

    const dialog = element('dialog', 'explanation-dialog');
    dialog.id = 'explanation-dialog';
    dialog.dataset.uiPanel = 'true';
    dialog.setAttribute('aria-labelledby', 'explanation-title');
    dialog.setAttribute('aria-describedby', 'explanation-summary');
    const symbolAnchor = element('div', 'explanation-symbol-anchor');
    const symbolField = element('div', 'starfall-drops-layer explanation-symbol-field');
    symbolField.dataset.cascadeDrops = '5';
    symbolField.setAttribute('aria-hidden', 'true');
    const contourSvg = createExplanationContour();
    symbolAnchor.append(contourSvg, symbolField);
    const panel = element('div', 'explanation-panel');
    const header = element('header', 'explanation-header');
    const headingGroup = element('div', 'explanation-heading');
    const kicker = element('p', 'explanation-kicker', translateUi('UNIVERSE / ПУТЕВОДИТЕЛЬ'));
    kicker.dataset.breathSlot = 'l5_explain_kicker';
    kicker.dataset.breathSeed = '0.4';
    const title = element('h2', 'explanation-title');
    title.id = 'explanation-title';
    title.tabIndex = -1;
    title.dataset.breathSlot = 'l5_explain_title';
    title.dataset.breathSeed = '1.1';
    headingGroup.append(kicker, title);
    const closeButton = element('button', 'explanation-close', translateUi('Закрыть ×'));
    closeButton.type = 'button';
    closeButton.dataset.explanationClose = 'true';
    header.append(headingGroup, closeButton);
    const summary = element('p', 'explanation-summary');
    summary.id = 'explanation-summary';
    const controls = element('div', 'explanation-controls');
    const modeGroup = element('div', 'explanation-mode');
    modeGroup.setAttribute('role', 'group');
    modeGroup.setAttribute('aria-label', translateUi('Глубина объяснения'));
    const modeButtons = (['simple', 'expert'] as const).map((value) => {
        const button = element('button', 'explanation-mode-button', translateUi(value === 'simple' ? 'Просто' : 'Технически'));
        button.type = 'button';
        button.dataset.explanationMode = value;
        modeGroup.append(button);
        return button;
    });
    controls.append(modeGroup);
    const navigation = element('nav', 'explanation-nav');
    navigation.setAttribute('aria-label', translateUi('Темы объяснения'));
    const content = element('div', 'explanation-content');
    const sceneNote = element('p', 'explanation-pause-note', translateUi('Наблюдайте за сценой и управляйте звуком, пока изучаете объяснения.'));
    panel.append(header, summary, controls, createModeDivider(), navigation, content, sceneNote);
    dialog.append(symbolAnchor, panel);
    document.body.append(dialog);

    let disposed = false;
    let reading = false;
    let mode: ExplanationMode = 'simple';
    let currentTopicId = EXPLAINER_OVERVIEW_ID;
    let returnTrigger: HTMLElement | null = null;
    let backdropPointerId: number | null = null;
    let previousBodyMarker: string | undefined;
    let disposeTrail: (() => void) | null = null;
    let disposeTextReveal: (() => void) | null = null;
    let buttonMotion: ExplanationButtonMotionBinding | null = null;
    let revealTargets: HTMLElement[] = [];
    let cascadeBound = false;
    let contourResizeObserver: ResizeObserver | null = null;
    let contourSize = '';
    const topicButtons = new Map<string, HTMLButtonElement>();

    // НАЧАЛО РАЗДЕЛА 2. СОДЕРЖИМОЕ ПО ЗАПРОСУ
    // --- НАЧАЛО ФУНКЦИИ syncLocaleLabels ---
    /** Переводит стабильные элементы управления, сохраняя фокус и привязки общего каскада. */
    function syncLocaleLabels(): void {
        dialog.lang = getLocale();
        dialog.dir = getLocale() === 'he' ? 'rtl' : 'ltr';
        kicker.textContent = translateUi('UNIVERSE / ПУТЕВОДИТЕЛЬ');
        setExplanationButtonText(closeButton, translateUi('Закрыть ×'));
        setExplanationButtonBackText(closeButton, translateUi('Закрыть ×', 'en'));
        modeGroup.setAttribute('aria-label', translateUi('Глубина объяснения'));
        for (const button of modeButtons) {
            const source = button.dataset.explanationMode === 'simple' ? 'Просто' : 'Технически';
            setExplanationButtonText(button, translateUi(source));
            setExplanationButtonBackText(button, translateUi(source, 'en'));
        }
        for (const topic of getExplainerTopics()) {
            const button = topicButtons.get(topic.id);
            if (button) {
                setExplanationButtonText(button, topic.label);
                setExplanationButtonBackText(button, getExplainerTopic(topic.id, 'en')?.label ?? topic.label);
            }
        }
        navigation.setAttribute('aria-label', translateUi('Темы объяснения'));
        sceneNote.textContent = translateUi('Наблюдайте за сценой и управляйте звуком, пока изучаете объяснения.');
    }
    // --- КОНЕЦ ФУНКЦИИ syncLocaleLabels ---

    // --- НАЧАЛО ФУНКЦИИ revealTopicInNavigation ---
    /** Прокручивает только список тем, сохраняя положение окна и страницы. */
    function revealTopicInNavigation(): void {
        if (currentTopicId === EXPLAINER_OVERVIEW_ID) {
            navigation.scrollTop = 0;
            return;
        }
        const button = topicButtons.get(currentTopicId);
        if (!button) return;
        const list = navigation.getBoundingClientRect();
        const chip = button.getBoundingClientRect();
        if (chip.top < list.top) navigation.scrollTop += chip.top - list.top;
        else if (chip.bottom > list.bottom) navigation.scrollTop += chip.bottom - list.bottom;
    }
    // --- КОНЕЦ ФУНКЦИИ revealTopicInNavigation ---

    // --- НАЧАЛО ФУНКЦИИ renderTopic ---
    function renderTopic(topicId: string): void {
        const topic = getExplainerTopic(topicId) ?? getExplainerTopic(EXPLAINER_OVERVIEW_ID);
        if (!topic) return;
        disposeTextReveal?.();
        disposeTextReveal = null;
        syncLocaleLabels();
        const localizedTopics = new Map(getExplainerTopics().map((item) => [item.id, item]));
        currentTopicId = topic.id;
        sceneExplanationFocus.selectTopic(topic.id);
        dialog.dataset.topic = topic.id;
        dialog.dataset.mode = mode;
        title.textContent = topic.title;
        summary.textContent = topic.summary;
        if (topicButtons.size === 0) {
            for (const item of EXPLAINER_TOPICS) {
                const button = element('button', 'explanation-topic', localizedTopics.get(item.id)?.label ?? item.label);
                button.type = 'button';
                button.dataset.explainTopic = item.id;
                navigation.append(button);
                topicButtons.set(item.id, button);
            }
        }
        for (const [id, button] of topicButtons) {
            setExplanationButtonText(button, localizedTopics.get(id)?.label ?? button.dataset.canonicalText ?? button.textContent ?? '');
            setExplanationButtonBackText(button, getExplainerTopic(id, 'en')?.label ?? button.dataset.canonicalText ?? '');
            if (id === topic.id) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        }
        revealTopicInNavigation();
        for (const button of modeButtons) {
            button.setAttribute('aria-pressed', String(button.dataset.explanationMode === mode));
        }

        const experience = element('section', 'explanation-section');
        const experienceParagraph = element('p', '', topic.experience);
        experience.append(element('h3', '', translateUi('Что видно в сцене')), experienceParagraph);
        const intuition = element('section', 'explanation-section');
        const intuitionParagraph = element('p', '', topic.intuition);
        intuition.append(element('h3', '', translateUi('Простая идея')), intuitionParagraph);
        revealTargets = [summary, experienceParagraph, intuitionParagraph];
        const sections: HTMLElement[] = [experience, intuition];
        if (topic.id === EXPLAINER_OVERVIEW_ID) sections.push(renderSoundtrackCredit());

        if (mode === 'expert') {
            const technical = element('section', 'explanation-section');
            technical.append(element('h3', '', translateUi('Как это реализовано')));
            const details = element('ul', 'explanation-technical');
            for (const text of topic.technical) details.append(element('li', '', text));
            technical.append(details);
            sections.push(technical);
            if (topic.formulas.length > 0) {
                const formulas = element('section', 'explanation-section explanation-formulas');
                formulas.append(element('h3', '', translateUi('Формулы и обозначения')));
                for (const formula of topic.formulas) {
                    const figure = element('figure', 'explanation-formula');
                    figure.append(element('figcaption', '', formula.label));
                    appendMath(figure, formula.mathml);
                    const formulaText = element('p', 'explanation-formula-text', formula.text);
                    formulaText.dir = 'ltr';
                    figure.append(formulaText);
                    formulas.append(figure);
                }
                sections.push(formulas);
            }
        }

        if (topic.sources.length > 0) {
            const sources = element('section', 'explanation-section');
            sources.append(element('h3', '', translateUi('Посмотреть исходный код')));
            const links = element('ul', 'explanation-sources');
            for (const source of topic.sources) {
                const item = element('li', '');
                const link = element('a', '', source.label);
                link.href = `https://github.com/DubnovAlexey/universe/blob/main/${source.path.split('/').map(encodeURIComponent).join('/')}`;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                item.append(link);
                links.append(item);
            }
            sources.append(links);
            sections.push(sources);
        }
        content.replaceChildren(...sections);
    }
    // --- КОНЕЦ ФУНКЦИИ renderTopic ---

    // --- НАЧАЛО ФУНКЦИИ revealIntroduction ---
    function revealIntroduction(delayMs: number): void {
        disposeTextReveal?.();
        let reducedMotion = getVisualSignals().reducedMotion;
        try { reducedMotion ||= typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
        catch { /* Среда без MediaQueryList сохраняет режим общего кадра. */ }
        disposeTextReveal = startExplanationTextReveal(revealTargets, reducedMotion, delayMs);
    }
    // --- КОНЕЦ ФУНКЦИИ revealIntroduction ---
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ЖИЗНЕННЫЙ ЦИКЛ И СОБЫТИЯ
    // --- НАЧАЛО ФУНКЦИИ resizeExplanationContour ---
    /** Физические CSS-пиксели сохраняют амплитуду стенки при любой высоте левой панели. */
    function resizeExplanationContour(width: number, height: number): void {
        if (!cascadeBound || !dialog.open || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
        const size = `${width}:${height}`;
        if (size === contourSize) return;
        waterfallAnimator.resizeCascadeContour(5, width, height);
        const viewBox = `0 0 ${width} ${height}`;
        if (contourSvg.getAttribute('viewBox') !== viewBox) contourSvg.setAttribute('viewBox', viewBox);
        contourSize = size;
    }
    // --- КОНЕЦ ФУНКЦИИ resizeExplanationContour ---

    // --- НАЧАЛО ФУНКЦИИ observeExplanationContour ---
    /** Размер читается при открытии и из ResizeObserver, а не из общего анимационного кадра. */
    function observeExplanationContour(): void {
        resizeExplanationContour(contourSvg.clientWidth, contourSvg.clientHeight);
        if (contourResizeObserver || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver((entries) => {
            if (contourResizeObserver !== observer) return;
            for (const entry of entries) {
                if (entry.target !== contourSvg) continue;
                resizeExplanationContour(entry.contentRect.width, entry.contentRect.height);
            }
        });
        contourResizeObserver = observer;
        observer.observe(contourSvg);
    }
    // --- КОНЕЦ ФУНКЦИИ observeExplanationContour ---

    // --- НАЧАЛО ФУНКЦИИ restoreReadingState ---
    function restoreReadingState(): void {
        sceneExplanationFocus.selectTopic(null);
        contourResizeObserver?.disconnect();
        contourResizeObserver = null;
        contourSize = '';
        buttonMotion?.dispose();
        buttonMotion = null;
        syncLocaleLabels();
        disposeTextReveal?.();
        disposeTextReveal = null;
        disposeTrail?.();
        disposeTrail = null;
        if (cascadeBound) {
            waterfallAnimator.releaseCascade(5, dialog);
            cascadeBound = false;
            symbolField.replaceChildren();
        }
        if (!reading) return;
        reading = false;
        backdropPointerId = null;
        if (previousBodyMarker === undefined) delete document.body.dataset.explanationOpen;
        else document.body.dataset.explanationOpen = previousBodyMarker;
        const fallback = document.getElementById('btn-explanation-overview');
        const target = canRestoreFocus(returnTrigger) ? returnTrigger : canRestoreFocus(fallback) ? fallback : null;
        target?.focus({ preventScroll: true });
        returnTrigger = null;
    }
    // --- КОНЕЦ ФУНКЦИИ restoreReadingState ---

    // --- НАЧАЛО ФУНКЦИИ close ---
    function close(): void {
        if (dialog.open) dialog.close();
        restoreReadingState();
    }
    // --- КОНЕЦ ФУНКЦИИ close ---

    // --- НАЧАЛО ФУНКЦИИ open ---
    function open(topicId = EXPLAINER_OVERVIEW_ID, trigger?: HTMLElement): void {
        if (disposed) return;
        // close-событие нативного dialog может ожидать следующей задачи браузера.
        if (!dialog.open && reading) restoreReadingState();
        const externalTrigger = trigger && !dialog.contains(trigger) ? trigger : null;
        if (externalTrigger) {
            disposeTrail?.();
            disposeTrail = null;
            delete dialog.dataset.entryAnimation;
            returnTrigger = externalTrigger;
        }
        renderTopic(topicId);
        calmGlyphHover.stopAll();
        if (!dialog.open) {
            returnTrigger = externalTrigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
            dialog.show();
            reading = true;
            previousBodyMarker = document.body.dataset.explanationOpen;
            document.body.dataset.explanationOpen = 'true';
            symbolField.replaceChildren();
            waterfallAnimator.bindCascade(5, dialog);
            cascadeBound = true;
            observeExplanationContour();
        }
        if (!buttonMotion) buttonMotion = mountExplanationButtonMotion([closeButton, ...modeButtons, ...topicButtons.values()]);
        dialog.scrollTop = panel.scrollTop = content.scrollTop = 0;
        revealTopicInNavigation();
        revealIntroduction(externalTrigger ? EXPLANATION_ASSEMBLY_MS + 1000 : 0);
        if (externalTrigger) disposeTrail = playExplanationTrail(externalTrigger, dialog);
        title.focus({ preventScroll: true });
    }
    // --- КОНЕЦ ФУНКЦИИ open ---

    // --- НАЧАЛО ФУНКЦИИ handleClick ---
    function handleClick(event: MouseEvent): void {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest('[data-explanation-close]') && dialog.contains(target)) {
            close();
            return;
        }
        const modeButton = target.closest<HTMLElement>('[data-explanation-mode]');
        if (modeButton && dialog.contains(modeButton)) {
            const nextMode = modeButton.dataset.explanationMode;
            if (nextMode === 'simple' || nextMode === 'expert') {
                mode = nextMode;
                renderTopic(currentTopicId);
            }
            return;
        }
        const trigger = target.closest<HTMLElement>('[data-explain-topic]');
        if (!trigger) return;
        event.preventDefault();
        open(trigger.dataset.explainTopic, trigger);
    }
    // --- КОНЕЦ ФУНКЦИИ handleClick ---

    // --- НАЧАЛО ФУНКЦИИ guardKeyboard ---
    /** Клавиши внутри панели управляют чтением; снаружи команды сцены остаются доступными. */
    function guardKeyboard(event: KeyboardEvent): void {
        const target = event.target instanceof Element ? event.target : null;
        if (!dialog.open || !target || !dialog.contains(target)) return;
        if (event.type === 'keydown' && event.key === 'Escape') {
            event.preventDefault();
            close();
        }
        event.stopImmediatePropagation();
    }
    // --- КОНЕЦ ФУНКЦИИ guardKeyboard ---

    // --- НАЧАЛО ФУНКЦИИ outsidePanel ---
    function outsidePanel(event: PointerEvent): boolean {
        const bounds = panel.getBoundingClientRect();
        return event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom;
    }
    // --- КОНЕЦ ФУНКЦИИ outsidePanel ---

    // --- НАЧАЛО ФУНКЦИИ handlePointerDown ---
    function handlePointerDown(event: PointerEvent): void {
        backdropPointerId = event.button === 0 && outsidePanel(event) ? event.pointerId : null;
    }
    // --- КОНЕЦ ФУНКЦИИ handlePointerDown ---

    // --- НАЧАЛО ФУНКЦИИ handlePointerUp ---
    function handlePointerUp(event: PointerEvent): void {
        const dismiss = backdropPointerId === event.pointerId && outsidePanel(event);
        backdropPointerId = null;
        if (dismiss) close();
    }
    // --- КОНЕЦ ФУНКЦИИ handlePointerUp ---

    // --- НАЧАЛО ФУНКЦИИ handlePointerCancel ---
    function handlePointerCancel(): void { backdropPointerId = null; }
    // --- КОНЕЦ ФУНКЦИИ handlePointerCancel ---

    // --- НАЧАЛО ФУНКЦИИ handleCancel ---
    function handleCancel(): void { close(); }
    // --- КОНЕЦ ФУНКЦИИ handleCancel ---

    // --- НАЧАЛО ФУНКЦИИ handleClose ---
    function handleClose(): void { if (!dialog.open) restoreReadingState(); }
    // --- КОНЕЦ ФУНКЦИИ handleClose ---

    document.addEventListener('click', handleClick);
    window.addEventListener('keydown', guardKeyboard, true);
    window.addEventListener('keyup', guardKeyboard, true);
    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    dialog.addEventListener('pointercancel', handlePointerCancel);
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);
    const unsubscribeLocale = subscribeLocale(() => {
        if (!disposed && dialog.open) {
            renderTopic(currentTopicId);
            revealIntroduction(0);
        }
    });
    resourceLedger.trackPageLifetimeAllocation('listeners', 9);
    syncLocaleLabels();

    // --- НАЧАЛО ФУНКЦИИ dispose ---
    function dispose(): void {
        if (disposed) return;
        disposed = true;
        unsubscribeLocale();
        close();
        document.removeEventListener('click', handleClick);
        window.removeEventListener('keydown', guardKeyboard, true);
        window.removeEventListener('keyup', guardKeyboard, true);
        dialog.removeEventListener('pointerdown', handlePointerDown);
        dialog.removeEventListener('pointerup', handlePointerUp);
        dialog.removeEventListener('pointercancel', handlePointerCancel);
        dialog.removeEventListener('cancel', handleCancel);
        dialog.removeEventListener('close', handleClose);
        resourceLedger.trackPageLifetimeRelease('listeners', 9);
        dialog.remove();
    }
    // --- КОНЕЦ ФУНКЦИИ dispose ---
    // КОНЕЦ РАЗДЕЛА 3
    return { open, dispose };
}
// --- КОНЕЦ ФУНКЦИИ mountExplanationDialog ---
