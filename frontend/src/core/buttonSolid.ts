// ============================================================================
// ФАЙЛ: frontend/src/core/buttonSolid.ts
// НАЗНАЧЕНИЕ: CSS-кубоиды с двумя читаемыми гранями внутри семантических элементов HUD.
// РАЗДЕЛЫ: 1. Контракты и исходный DOM; 2. Грани и размеры; 3. Пакетный жизненный цикл.
// ФУНКЦИИ: cloneMeasuringNode, makeSpan, copySolidLabels, measureSolid, setSolidButtonLabel,
//          setSolidButtonBackLabel;
//          ButtonSolidManager: constructor, mount, dispose.
// Размеры берутся из layout box; измеритель не зависит от вращения тела.
// ============================================================================

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТЫ И ИСХОДНЫЙ DOM
const SOLID_PROPERTIES = ['--solid-width', '--solid-height', '--solid-depth'] as const;
const SOLID_FACES = ['front', 'back', 'top', 'bottom', 'left', 'right'] as const;
interface SolidSizeObserver {
    observe(target: Element, options?: ResizeObserverOptions): void;
    disconnect(): void;
}
type SolidObserverFactory = (update: () => void) => SolidSizeObserver | null;
interface SolidRecord {
    readonly host: HTMLElement;
    readonly originalChildren: Node[];
    readonly restoredContainers: { node: HTMLElement; children: Node[] }[];
    readonly originalAria: string | null;
    readonly originalCanonical: string | undefined;
    readonly originalMarker: string | undefined;
    readonly originalKind: string | undefined;
    readonly originalBackLabel: string | undefined;
    readonly originalStyles: { property: string; value: string; priority: string }[];
    readonly canonicalNode: HTMLElement | null;
    readonly label: HTMLElement;
    readonly backLabel: HTMLElement;
    configuredBackLabel: string | undefined;
    readonly visual: HTMLElement;
    readonly measurer: HTMLElement;
    readonly kind: 'status' | 'control';
    readonly measure: () => void;
    text: string;
    dimensions: string;
}
export interface ButtonSolidBinding { dispose(): void; }
const mountedSolids = new WeakMap<HTMLElement, SolidRecord>();

// НАЧАЛО ФУНКЦИИ cloneMeasuringNode
/** Копия сохраняет типографику, но не дублирует идентификаторы и DOM-привязки. */
function cloneMeasuringNode(original: Node): Node {
    const clone = original.cloneNode(false);
    if (clone.nodeType === 1) {
        const element = clone as Element;
        ['id', 'data-bind', 'data-glyph-visual', 'data-glyph-canonical', 'autofocus'].forEach((name) => element.removeAttribute(name));
    }
    Array.from(original.childNodes).forEach((child) => clone.appendChild(cloneMeasuringNode(child)));
    return clone;
}
// КОНЕЦ ФУНКЦИИ cloneMeasuringNode

// НАЧАЛО ФУНКЦИИ makeSpan
function makeSpan(host: HTMLElement, className: string): HTMLSpanElement {
    const element = host.ownerDocument.createElement('span');
    element.className = className;
    return element;
}
// КОНЕЦ ФУНКЦИИ makeSpan
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ШЕСТЬ ГРАНЕЙ, ПОДПИСИ И LAYOUT-РАЗМЕРЫ
// НАЧАЛО ФУНКЦИИ copySolidLabels
/** Сохраняет отдельный перевод сзади; наложенные измерители резервируют большую из двух подписей. */
function copySolidLabels(record: SolidRecord): void {
    if (record.configuredBackLabel === undefined) {
        record.backLabel.replaceChildren(...Array.from(record.label.childNodes).map(cloneMeasuringNode));
        record.measurer.replaceChildren(...Array.from(record.label.childNodes).map(cloneMeasuringNode));
        return;
    }
    if (record.measurer.style.getPropertyValue('display') !== 'inline-grid') {
        record.measurer.style.setProperty('display', 'inline-grid');
        record.measurer.style.setProperty('grid-template-columns', 'max-content');
    }
    record.backLabel.textContent = record.configuredBackLabel;
    const front = makeSpan(record.host, 'solid-button-measure-label');
    const back = makeSpan(record.host, 'solid-button-measure-label');
    front.dataset.solidMeasureFace = 'front';
    back.dataset.solidMeasureFace = 'back';
    for (const node of [front, back]) node.style.setProperty('grid-area', '1 / 1');
    front.append(...Array.from(record.label.childNodes).map(cloneMeasuringNode));
    back.append(...Array.from(record.backLabel.childNodes).map(cloneMeasuringNode));
    record.measurer.replaceChildren(front, back);
}
// КОНЕЦ ФУНКЦИИ copySolidLabels

// НАЧАЛО ФУНКЦИИ measureSolid
/** Только offset box: CSS-повороты потомков не меняют геометрию и область клика. */
function measureSolid(record: SolidRecord): void {
    const width = record.host.offsetWidth;
    const height = record.host.offsetHeight;
    if (width <= 0 || height <= 0) return;
    const depth = Number(Math.max(2, Math.min(record.kind === 'status' ? 16 : 18, width * 0.25, height * 0.5)).toFixed(2));
    const dimensions = `${width}:${height}:${depth}`;
    if (dimensions === record.dimensions) return;
    record.dimensions = dimensions;
    [width, height, depth].forEach((value, index) => {
        record.host.style.setProperty(SOLID_PROPERTIES[index], `${value}px`);
    });
}
// КОНЕЦ ФУНКЦИИ measureSolid

// НАЧАЛО ФУНКЦИИ setSolidButtonLabel
/** Сохраняет тело и шесть граней при обновлении канонического текста хранилищем. */
export function setSolidButtonLabel(host: HTMLElement, text: string): boolean {
    const record = mountedSolids.get(host);
    if (!record) return false;
    if (host.dataset.canonicalText !== text) host.dataset.canonicalText = text;
    if (record.canonicalNode) {
        if (record.canonicalNode.textContent !== text) record.canonicalNode.textContent = text;
    } else if (host.getAttribute('aria-label') !== text) host.setAttribute('aria-label', text);
    if (record.text !== text) {
        record.text = text;
        if (record.visual.textContent !== text) record.visual.textContent = text;
        copySolidLabels(record);
        record.measure();
    }
    return true;
}
// КОНЕЦ ФУНКЦИИ setSolidButtonLabel

// НАЧАЛО ФУНКЦИИ setSolidButtonBackLabel
/** Меняет перевод обратной грани по событию, сохраняя канон, доступное имя и вращение. */
export function setSolidButtonBackLabel(host: HTMLElement, text: string): boolean {
    const record = mountedSolids.get(host);
    if (!record) return false;
    if (host.dataset.solidBackLabel !== text) host.dataset.solidBackLabel = text;
    if (record.configuredBackLabel !== text) {
        record.configuredBackLabel = text;
        copySolidLabels(record);
        record.measure();
    }
    return true;
}
// КОНЕЦ ФУНКЦИИ setSolidButtonBackLabel
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ПАКЕТНОЕ МОНТИРОВАНИЕ И ОСВОБОЖДЕНИЕ
export class ButtonSolidManager {
    private records: SolidRecord[] = [];
    private observer: SolidSizeObserver | null = null;
    private generation = 0;

    // НАЧАЛО ФУНКЦИИ constructor
    public constructor(private readonly createObserver: SolidObserverFactory = (update) =>
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)) {}
    // КОНЕЦ ФУНКЦИИ constructor

    // НАЧАЛО ФУНКЦИИ mount
    public mount(elements: readonly HTMLElement[]): ButtonSolidBinding {
        this.dispose();
        const generation = ++this.generation;
        for (const host of new Set(elements)) {
            if (mountedSolids.has(host)) continue;
            const originalChildren = Array.from(host.childNodes);
            const directElement = (attribute: string): HTMLElement | null =>
                originalChildren.find((node) => node.nodeType === 1 && (node as Element).hasAttribute(attribute)) as HTMLElement | undefined ?? null;
            const originalVisual = directElement('data-glyph-visual');
            const originalCanonicalNode = directElement('data-glyph-canonical');
            const text = host.dataset.canonicalText ?? host.getAttribute('aria-label') ?? originalVisual?.textContent ?? host.textContent ?? '';
            const nativeName = host.matches('button, a, h1, h2, h3, h4, h5, h6');
            const canonicalNode = nativeName ? null : originalCanonicalNode ?? makeSpan(host, 'glyph-canonical-text');
            const kind = host.closest('.brand-card') ? 'status' : 'control';
            const label = makeSpan(host, 'solid-button-label');
            const backLabel = makeSpan(host, 'solid-button-label solid-button-label--back');
            backLabel.setAttribute('inert', '');
            const measurer = makeSpan(host, 'solid-button-measurer');
            measurer.setAttribute('aria-hidden', 'true');
            measurer.setAttribute('inert', '');
            const configuredBackLabel = host.dataset.solidBackLabel;
            const body = makeSpan(host, 'solid-button-body');
            body.setAttribute('aria-hidden', 'true');
            const restoredContainers = [originalVisual, originalCanonicalNode]
                .filter((node): node is HTMLElement => node !== null)
                .map((node) => ({ node, children: Array.from(node.childNodes) }));
            const record: SolidRecord = {
                host, originalChildren, restoredContainers,
                originalAria: host.getAttribute('aria-label'), originalCanonical: host.dataset.canonicalText,
                originalMarker: host.dataset.buttonSolid, originalKind: host.dataset.buttonSolidKind,
                originalBackLabel: configuredBackLabel,
                originalStyles: SOLID_PROPERTIES.map((property) => ({ property,
                    value: host.style.getPropertyValue(property), priority: host.style.getPropertyPriority(property) })),
                canonicalNode, label, backLabel, configuredBackLabel, visual: originalVisual ?? label, measurer, kind,
                text, dimensions: '', measure: () => measureSolid(record),
            };
            originalChildren.filter((node) => node !== originalCanonicalNode).forEach((node) => label.appendChild(node));
            if (canonicalNode) {
                canonicalNode.dataset.glyphCanonical = '1';
                canonicalNode.textContent = text;
            } else host.setAttribute('aria-label', text);
            host.dataset.canonicalText = text;
            // Обратная грань показывает канон, не копирует glyph-привязки и не создаёт второй tab stop.
            copySolidLabels(record);
            SOLID_FACES.forEach((faceName) => {
                const face = makeSpan(host, `solid-button-face solid-button-face--${faceName}`);
                face.dataset.solidFace = faceName;
                if (faceName === 'front') face.appendChild(label);
                else if (faceName === 'back') face.appendChild(backLabel);
                body.appendChild(face);
            });
            host.replaceChildren(...(canonicalNode ? [canonicalNode, measurer, body] : [measurer, body]));
            host.dataset.buttonSolid = '1';
            host.dataset.buttonSolidKind = kind;
            mountedSolids.set(host, record);
            this.records.push(record);
            record.measure();
        }
        if (this.records.length) {
            this.observer = this.createObserver(() => this.records.forEach(measureSolid));
            this.records.forEach(({ host }) => this.observer?.observe(host, { box: 'border-box' }));
        }
        return { dispose: () => { if (this.generation === generation) this.dispose(); } };
    }
    // КОНЕЦ ФУНКЦИИ mount

    // НАЧАЛО ФУНКЦИИ dispose
    public dispose(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.records.forEach((record) => {
            mountedSolids.delete(record.host);
            record.restoredContainers.forEach(({ node, children }) => node.replaceChildren(...children));
            record.host.replaceChildren(...record.originalChildren);
            if (record.originalAria === null) record.host.removeAttribute('aria-label');
            else record.host.setAttribute('aria-label', record.originalAria);
            (['canonicalText', 'buttonSolid', 'buttonSolidKind', 'solidBackLabel'] as const).forEach((key, index) => {
                const value = [record.originalCanonical, record.originalMarker, record.originalKind, record.originalBackLabel][index];
                if (value === undefined) delete record.host.dataset[key];
                else record.host.dataset[key] = value;
            });
            record.originalStyles.forEach(({ property, value, priority }) => {
                if (value) record.host.style.setProperty(property, value, priority);
                else record.host.style.removeProperty(property);
            });
        });
        this.records = [];
    }
    // КОНЕЦ ФУНКЦИИ dispose
}
export const buttonSolidManager = new ButtonSolidManager();
// КОНЕЦ РАЗДЕЛА 3
