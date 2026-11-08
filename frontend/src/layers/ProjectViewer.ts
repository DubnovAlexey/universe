// ============================================================================
// ФАЙЛ: frontend/src/layers/ProjectViewer.ts
// НАЗНАЧЕНИЕ: Полноэкранный просмотрщик проекта портфолио (ветка site).
// РАЗДЕЛЫ: 1. Контракт, тексты и холст; 2. Разметка; 3. Открытие и закрытие; 4. Язык и освобождение.
// ФУНКЦИИ: isProjectDocumentReady, pageCanvasColor, mountProjectViewer, watchCanvas, open, close, dispose.
// Проект открывается живой страницей своего сайта в iframe внутри модального <dialog>: браузер сам держит фокус
// внутри окна, делает сцену под ним недоступной и закрывает окно по Escape. Сверху — ссылка на код проекта на GitHub. На время просмотра сцена UNIVERSE
// стоит (hooks.onCover): не считает физику, не рисует кадры и молчит. Закрытие удаляет iframe целиком —
// вместе с ним гаснут звук, таймеры и потоки проекта, — затем сцена продолжает с того же места, а фокус
// возвращается на планету, с которой проект открыли.
// ============================================================================
import { getLocale, subscribeLocale, translateUi } from '../core/locale';
import { projectName, projectRepoUrl, projectUrl, type PortfolioProject } from '../core/projectCatalog';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ И ТЕКСТЫ
export interface ProjectViewerHooks {
    /** true — проект накрыл сцену, false — сцена снова видна. */
    readonly onCover: (covered: boolean) => void;
}
export interface ProjectViewerBinding {
    open(project: PortfolioProject, opener?: HTMLElement | null): void;
    close(): void;
    isOpen(): boolean;
    dispose(): void;
}
/** Сайты проектов на GitHub Pages обычно отвечают за 1–3 с; дольше — подсказываем открыть отдельно. */
export const PROJECT_LOAD_TIMEOUT_MS = 15000;
const TEXT_LOADING = 'Загружаю проект…';
const TEXT_SLOW = 'Проект долго не отвечает. Его можно открыть отдельно.';
/** Холст обычной вкладки браузера: белый при светлой схеме страницы, #121212 при тёмной (так рисует Chrome). */
export const PAGE_CANVAS_LIGHT = '#ffffff';
export const PAGE_CANVAS_DARK = '#121212';
/** Как часто проверять, появился ли документ проекта: событие load ждёт все картинки и приходит поздно. */
const CANVAS_POLL_MS = 50;

/** Минимум документа, нужный для выбора холста: так функции проверяются и без браузера. */
export interface CanvasProbeDocument {
    readonly URL: string;
    readonly body: object | null;
    readonly documentElement: Element | null;
    readonly defaultView: { getComputedStyle(element: Element): { readonly colorScheme: string } } | null;
}

/** Документ проекта уже появился: это не пустой about:blank до перехода, и у него есть body. */
export function isProjectDocumentReady(doc: CanvasProbeDocument | null): boolean {
    return doc !== null && doc.URL !== 'about:blank' && doc.body !== null;
}

// --- НАЧАЛО ФУНКЦИИ pageCanvasColor ---
/**
 * Цвет холста под страницей проекта — тот же, что браузер кладёт в отдельной вкладке. Страница без своего фона
 * в обычной вкладке лежит на белом холсте, а на тёмном — только если сама просит тёмную схему. В окне просмотра
 * под iframe тёмная сцена: без холста тёмный текст такой страницы стал бы нечитаемым (Cosmo Market, 08.11).
 * null — документ не виден (другой адрес при локальной разработке): тогда, как во вкладке, холст светлый.
 */
export function pageCanvasColor(doc: CanvasProbeDocument | null, prefersDark: boolean): string {
    const root = doc?.documentElement ?? null;
    const scheme = root && doc?.defaultView ? doc.defaultView.getComputedStyle(root).colorScheme || '' : '';
    const dark = /\bdark\b/.test(scheme) && (!/\blight\b/.test(scheme) || prefersDark);
    return dark ? PAGE_CANVAS_DARK : PAGE_CANVAS_LIGHT;
}
// --- КОНЕЦ ФУНКЦИИ pageCanvasColor ---
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. РАЗМЕТКА
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО ФУНКЦИИ mountProjectViewer
export function mountProjectViewer(hooks: ProjectViewerHooks): ProjectViewerBinding {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return { open: () => {}, close: () => {}, isOpen: () => false, dispose: () => {} };
    }

    const dialog = element('dialog', 'project-viewer');
    dialog.id = 'project-viewer';
    // Клавиши сцены (пауза, звук, линза) не срабатывают, пока фокус внутри окна проекта.
    dialog.dataset.uiPanel = 'true';
    dialog.setAttribute('aria-labelledby', 'project-viewer-title');
    const bar = element('header', 'project-viewer__bar');
    const dot = element('span', 'project-viewer__dot');
    dot.setAttribute('aria-hidden', 'true');
    const title = element('h2', 'project-viewer__title');
    title.id = 'project-viewer-title';
    const code = element('a', 'project-viewer__external project-viewer__code', translateUi('Код на GitHub ↗'));
    code.target = '_blank';
    code.rel = 'noopener noreferrer';
    const external = element('a', 'project-viewer__external', translateUi('Открыть отдельно ↗'));
    external.target = '_blank';
    external.rel = 'noopener noreferrer';
    const closeButton = element('button', 'project-viewer__close', translateUi('Закрыть ×'));
    closeButton.type = 'button';
    bar.append(dot, title, code, external, closeButton);
    const stage = element('div', 'project-viewer__stage');
    const status = element('p', 'project-viewer__status');
    status.setAttribute('role', 'status');
    stage.append(status);
    dialog.append(bar, stage);
    document.body.append(dialog);

    let current: { project: PortfolioProject; opener: HTMLElement | null; frame: HTMLIFrameElement; timer: number } | null = null;
    let statusText = '';
    let canvasTimer = 0;

    const setStatus = (text: string): void => {
        statusText = text;
        status.textContent = text ? translateUi(text) : '';
        status.hidden = !text;
    };

    /** Документ проекта (сайт того же адреса) или null, если он с другого адреса и браузер его не показывает. */
    const readFrameDocument = (frame: HTMLIFrameElement): Document | null => {
        try { return frame.contentDocument; } catch { return null; }
    };
    const paintCanvas = (frame: HTMLIFrameElement, doc: Document | null): void => {
        const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
        frame.style.backgroundColor = pageCanvasColor(doc, prefersDark);
    };

    // --- НАЧАЛО ФУНКЦИИ watchCanvas ---
    /** Ждёт, пока появится документ проекта, и сразу подкладывает под него холст обычной вкладки. */
    const watchCanvas = (frame: HTMLIFrameElement): void => {
        window.clearTimeout(canvasTimer);
        if (current?.frame !== frame) return;
        const doc = readFrameDocument(frame);
        if (doc && isProjectDocumentReady(doc)) {
            paintCanvas(frame, doc);
            return;
        }
        canvasTimer = window.setTimeout(() => watchCanvas(frame), CANVAS_POLL_MS);
    };
    // --- КОНЕЦ ФУНКЦИИ watchCanvas ---

    // НАЧАЛО РАЗДЕЛА 3. ОТКРЫТИЕ И ЗАКРЫТИЕ
    // --- НАЧАЛО ФУНКЦИИ release ---
    /** Снимает проект: iframe удаляется (звук и таймеры проекта гаснут вместе с ним), сцена продолжает. */
    const release = (): void => {
        const closing = current;
        if (!closing) return;
        current = null;
        window.clearTimeout(closing.timer);
        window.clearTimeout(canvasTimer);
        try { closing.frame.src = 'about:blank'; } catch { /* iframe уже отсоединён */ }
        closing.frame.remove();
        setStatus('');
        document.body.classList.remove('project-viewer-open');
        hooks.onCover(false);
        if (closing.opener?.isConnected) closing.opener.focus({ preventScroll: true });
    };
    // --- КОНЕЦ ФУНКЦИИ release ---

    // --- НАЧАЛО ФУНКЦИИ close ---
    const close = (): void => {
        if (!current) return;
        if (dialog.open) dialog.close(); // событие close вызовет release
        else release();
    };
    // --- КОНЕЦ ФУНКЦИИ close ---

    // --- НАЧАЛО ФУНКЦИИ open ---
    const open = (project: PortfolioProject, opener: HTMLElement | null = null): void => {
        if (current) {
            // Другой проект поверх открытого: меняем содержимое, сцена остаётся на паузе.
            window.clearTimeout(current.timer);
            current.frame.remove();
        } else {
            hooks.onCover(true);
            document.body.classList.add('project-viewer-open');
        }
        const name = projectName(project, getLocale());
        const url = projectUrl(project);
        dialog.style.setProperty('--planet-color', project.color);
        title.textContent = name;
        external.href = url;
        code.href = projectRepoUrl(project);
        const frame = element('iframe', 'project-viewer__frame');
        frame.title = name;
        frame.allow = 'autoplay; fullscreen; clipboard-write';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.src = url;
        setStatus(TEXT_LOADING);
        const timer = window.setTimeout(() => {
            if (current?.frame === frame) setStatus(TEXT_SLOW);
        }, PROJECT_LOAD_TIMEOUT_MS);
        frame.addEventListener('load', () => {
            if (current?.frame !== frame || frame.src === 'about:blank') return;
            window.clearTimeout(timer);
            window.clearTimeout(canvasTimer);
            // Каждая загрузка внутри окна (и переход по страницам проекта) уточняет холст по готовой странице.
            const doc = readFrameDocument(frame);
            paintCanvas(frame, doc && isProjectDocumentReady(doc) ? doc : null);
            setStatus('');
        });
        stage.append(frame);
        current = { project, opener: opener ?? current?.opener ?? null, frame, timer };
        watchCanvas(frame);
        if (!dialog.open) {
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        }
        closeButton.focus({ preventScroll: true });
    };
    // --- КОНЕЦ ФУНКЦИИ open ---

    const handleCancel = (event: Event): void => {
        // Escape: закрываем сами, чтобы порядок «iframe → сцена → фокус» был всегда одинаковым.
        event.preventDefault();
        close();
    };
    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', release);
    closeButton.addEventListener('click', close);
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. ЯЗЫК И ОСВОБОЖДЕНИЕ
    const unsubscribeLocale = subscribeLocale((locale) => {
        external.textContent = translateUi('Открыть отдельно ↗', locale);
        code.textContent = translateUi('Код на GitHub ↗', locale);
        closeButton.textContent = translateUi('Закрыть ×', locale);
        if (statusText) status.textContent = translateUi(statusText, locale);
        if (current) {
            const name = projectName(current.project, locale);
            title.textContent = name;
            current.frame.title = name;
        }
    });

    return {
        open,
        close,
        isOpen: () => current !== null,
        dispose: () => {
            close();
            release();
            unsubscribeLocale();
            dialog.removeEventListener('cancel', handleCancel);
            dialog.removeEventListener('close', release);
            closeButton.removeEventListener('click', close);
            dialog.remove();
        },
    };
    // КОНЕЦ РАЗДЕЛА 4
}
// КОНЕЦ ФУНКЦИИ mountProjectViewer
