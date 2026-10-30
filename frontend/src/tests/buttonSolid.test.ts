// ============================================================================
// ФАЙЛ: frontend/src/tests/buttonSolid.test.ts
// НАЗНАЧЕНИЕ: Шесть граней, две читаемые подписи, доступность и восстановление DOM HUD.
// РАЗДЕЛЫ: 1. Минимальный layout/DOM/RO; 2. Геометрия и подписи; 3. Освобождение.
// ФУНКЦИИ: descendants, makeHarness, runButtonSolidChecks; методы SolidNode.
// ============================================================================
import { ButtonSolidManager, setSolidButtonLabel, setSolidButtonBackLabel } from '../core/buttonSolid';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЙ DOM И НАБЛЮДАТЕЛЬ LAYOUT
class SolidNode {
    public readonly nodeType: number;
    public readonly tagName: string;
    public childNodes: SolidNode[] = [];
    public parentNode: SolidNode | null = null;
    public dataset: Record<string, string> = {};
    public className = '';
    public attributes = new Map<string, string>();
    public values = new Map<string, string>();
    public priorities = new Map<string, string>();
    public writes = 0;
    public replacements = 0;
    public layoutWidth = 120;
    public layoutHeight = 40;
    public inBrand = false;
    private text = '';
    public ownerDocument = { createElement: (tag: string): SolidNode => new SolidNode(tag) };
    public style = {
        getPropertyValue: (property: string): string => this.values.get(property) ?? '',
        getPropertyPriority: (property: string): string => this.priorities.get(property) ?? '',
        setProperty: (property: string, value: string, priority = ''): void => {
            this.writes++;
            this.values.set(property, value);
            this.priorities.set(property, priority);
        },
        removeProperty: (property: string): void => {
            this.writes++; this.values.delete(property); this.priorities.delete(property);
        },
    };

    // НАЧАЛО ФУНКЦИИ constructor
    public constructor(tag: string, text = '') {
        this.nodeType = tag === '#text' ? 3 : 1;
        this.tagName = tag.toUpperCase();
        this.text = text;
    }
    // КОНЕЦ ФУНКЦИИ constructor
    // НАЧАЛО ФУНКЦИИ textContent
    public get textContent(): string { return this.nodeType === 3 ? this.text : this.childNodes.map((node) => node.textContent).join(''); }
    public set textContent(text: string) {
        if (this.nodeType === 3) this.text = text;
        else this.replaceChildren(...(text ? [new SolidNode('#text', text)] : []));
    }
    // КОНЕЦ ФУНКЦИИ textContent
    // НАЧАЛО ФУНКЦИИ offsetWidth
    public get offsetWidth(): number { return this.layoutWidth; }
    // КОНЕЦ ФУНКЦИИ offsetWidth
    // НАЧАЛО ФУНКЦИИ offsetHeight
    public get offsetHeight(): number { return this.layoutHeight; }
    // КОНЕЦ ФУНКЦИИ offsetHeight
    // НАЧАЛО ФУНКЦИИ getBoundingClientRect
    public getBoundingClientRect(): never { throw new Error('Solid geometry must not read a transformed rectangle'); }
    // КОНЕЦ ФУНКЦИИ getBoundingClientRect
    // НАЧАЛО ФУНКЦИИ matches
    public matches(selector: string): boolean { return selector.split(',').some((tag) => tag.trim().toUpperCase() === this.tagName); }
    // КОНЕЦ ФУНКЦИИ matches
    // НАЧАЛО ФУНКЦИИ closest
    public closest(selector: string): SolidNode | null { return selector === '.brand-card' && this.inBrand ? this : null; }
    // КОНЕЦ ФУНКЦИИ closest
    // НАЧАЛО ФУНКЦИИ getAttribute
    public getAttribute(name: string): string | null {
        if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/gu, (_match, letter: string) => letter.toUpperCase())] ?? null;
        return this.attributes.get(name) ?? null;
    }
    // КОНЕЦ ФУНКЦИИ getAttribute
    // НАЧАЛО ФУНКЦИИ hasAttribute
    public hasAttribute(name: string): boolean { return this.getAttribute(name) !== null; }
    // КОНЕЦ ФУНКЦИИ hasAttribute
    // НАЧАЛО ФУНКЦИИ setAttribute
    public setAttribute(name: string, value: string): void {
        if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/gu, (_match, letter: string) => letter.toUpperCase())] = value;
        else this.attributes.set(name, value);
    }
    // КОНЕЦ ФУНКЦИИ setAttribute
    // НАЧАЛО ФУНКЦИИ removeAttribute
    public removeAttribute(name: string): void {
        if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/gu, (_match, letter: string) => letter.toUpperCase())];
        else this.attributes.delete(name);
    }
    // КОНЕЦ ФУНКЦИИ removeAttribute
    // НАЧАЛО ФУНКЦИИ appendChild
    public appendChild(node: SolidNode): SolidNode {
        if (node.parentNode) node.parentNode.childNodes = node.parentNode.childNodes.filter((child) => child !== node);
        this.childNodes.push(node); node.parentNode = this;
        return node;
    }
    // КОНЕЦ ФУНКЦИИ appendChild
    // НАЧАЛО ФУНКЦИИ append
    public append(...nodes: SolidNode[]): void { nodes.forEach((node) => this.appendChild(node)); }
    // КОНЕЦ ФУНКЦИИ append
    // НАЧАЛО ФУНКЦИИ replaceChildren
    public replaceChildren(...nodes: SolidNode[]): void {
        this.replacements++;
        this.childNodes.forEach((node) => { node.parentNode = null; }); this.childNodes = [];
        this.append(...nodes);
    }
    // КОНЕЦ ФУНКЦИИ replaceChildren
    // НАЧАЛО ФУНКЦИИ cloneNode
    public cloneNode(deep: boolean): SolidNode {
        const clone = new SolidNode(this.nodeType === 3 ? '#text' : this.tagName, this.text);
        clone.className = this.className;
        clone.dataset = { ...this.dataset };
        clone.attributes = new Map(this.attributes);
        if (deep) clone.append(...this.childNodes.map((node) => node.cloneNode(true)));
        return clone;
    }
    // КОНЕЦ ФУНКЦИИ cloneNode
}

// НАЧАЛО ФУНКЦИИ descendants
function descendants(node: SolidNode): SolidNode[] {
    return node.childNodes.flatMap((child) => [child, ...descendants(child)]);
}
// КОНЕЦ ФУНКЦИИ descendants

// НАЧАЛО ФУНКЦИИ makeHarness
function makeHarness() {
    const observer = { callbacks: [] as (() => void)[], observed: [] as { node: Element; box: string | undefined }[], disconnects: 0 };
    const manager = new ButtonSolidManager((callback) => {
        observer.callbacks.push(callback);
        return { observe: (node, options): void => { observer.observed.push({ node, box: options?.box }); },
            disconnect: (): void => { observer.disconnects++; } };
    });
    return { observer, manager };
}
// КОНЕЦ ФУНКЦИИ makeHarness
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. РЕАЛЬНЫЙ КОНТРОЛЛЕР ГРАНЕЙ И ПОДПИСЕЙ
// НАЧАЛО ФУНКЦИИ runButtonSolidChecks
export function runButtonSolidChecks(check: (passed: boolean, description: string) => void): void {
    const { manager, observer } = makeHarness();
    const button = new SolidNode('button');
    button.setAttribute('aria-label', 'ORIGINAL ACCESSIBLE NAME');
    button.dataset.canonicalText = 'AUDIO: ON';
    button.dataset.buttonSolid = 'previous-marker';
    button.values.set('--solid-depth', '7px');
    button.priorities.set('--solid-depth', 'important');
    const visual = new SolidNode('span');
    visual.dataset.glyphVisual = '1';
    visual.setAttribute('id', 'original-visual-id');
    visual.textContent = 'AUDIO: ON';
    const originalText = visual.childNodes[0];
    button.appendChild(visual);
    const generic = new SolidNode('p');
    generic.inBrand = true;
    generic.dataset.canonicalText = 'НАЧАЛЬНАЯ ФАЗА';
    const canonical = new SolidNode('span');
    canonical.className = 'glyph-canonical-text';
    canonical.dataset.glyphCanonical = '1';
    canonical.textContent = 'НАЧАЛЬНАЯ ФАЗА';
    const genericVisual = new SolidNode('span');
    genericVisual.dataset.glyphVisual = '1';
    genericVisual.textContent = 'НАЧАЛЬНАЯ ФАЗА';
    generic.append(canonical, genericVisual);
    const phase = new SolidNode('button');
    phase.setAttribute('aria-label', '01.VOID');
    const number = new SolidNode('span'); number.className = 'phase-number'; number.textContent = '01.';
    const name = new SolidNode('span'); name.className = 'phase-name'; name.textContent = 'VOID';
    phase.append(number, name);
    const binding = manager.mount([button, generic, phase, button] as unknown as HTMLElement[]);
    const body = button.childNodes.find((node) => node.className === 'solid-button-body')!;
    const faces = body.childNodes;
    const backFace = faces.find((node) => node.dataset.solidFace === 'back')!;
    const backLabel = backFace.childNodes[0];
    check(faces.length === 6 && new Set(faces.map((face) => face.dataset.solidFace)).size === 6 &&
        ['front', 'back', 'top', 'bottom', 'left', 'right'].every((faceName) => faces.some((face) => face.dataset.solidFace === faceName)) &&
        body.getAttribute('aria-hidden') === 'true' && descendants(faces[0]).includes(visual) &&
        button.getAttribute('aria-label') === 'AUDIO: ON' && button.getAttribute('role') === null &&
        descendants(button).filter((node) => node.getAttribute('id') === 'original-visual-id').length === 1,
        'Closed button bodies contain six distinct faces, reuse the original front visual and retain one native accessible name without duplicate IDs');

    check(backLabel.textContent === 'AUDIO: ON' && backLabel.hasAttribute('inert') && !descendants(backFace).includes(visual) &&
        descendants(backFace).every(node => node.getAttribute('id') === null && !node.hasAttribute('data-glyph-visual') &&
            !node.hasAttribute('data-glyph-canonical') && !node.hasAttribute('tabindex') && !node.matches('button, a')),
        'The back face carries a separate canonical label without duplicate IDs, glyph bindings or interactive descendants');

    const phaseBody = phase.childNodes.find((node) => node.className === 'solid-button-body')!;
    const phaseBack = phaseBody.childNodes.find((node) => node.dataset.solidFace === 'back')!;
    setSolidButtonLabel(phase as unknown as HTMLElement, '01.VOID');
    check(descendants(phaseBody).includes(number) && descendants(phaseBody).includes(name) &&
        number.textContent === '01.' && name.textContent === 'VOID' && phase.getAttribute('aria-label') === '01.VOID' &&
        descendants(phaseBack).some(node => node.className === 'phase-number' && node.textContent === '01.') &&
        descendants(phaseBack).some(node => node.className === 'phase-name' && node.textContent === 'VOID'),
        'Both faces preserve phase number/name structure and responsive typography while the original front nodes remain intact');

    setSolidButtonLabel(generic as unknown as HTMLElement, 'НОВАЯ ФАЗА 𓂀');
    const genericBody = generic.childNodes.find((node) => node.className === 'solid-button-body')!;
    const genericBack = genericBody.childNodes.find((node) => node.dataset.solidFace === 'back')!;
    check(canonical.parentNode === generic && canonical.textContent === 'НОВАЯ ФАЗА 𓂀' &&
        genericVisual.textContent === canonical.textContent && generic.dataset.buttonSolidKind === 'status' &&
        generic.getAttribute('aria-label') === null && generic.getAttribute('role') === null &&
        genericBack.textContent === canonical.textContent,
        'Generic status retains one accessible canonical span while front/back Unicode labels update together');

    const replaceCount = button.replacements;
    const sameFaces = faces.slice();
    button.layoutWidth = 156;
    setSolidButtonLabel(button as unknown as HTMLElement, 'AUDIO: MUTED 𓂀');
    const measurer = button.childNodes.find((node) => node.className === 'solid-button-measurer')!;
    check(button.replacements === replaceCount && body.childNodes.every((face, index) => face === sameFaces[index]) &&
        descendants(body).includes(visual) && measurer.textContent === 'AUDIO: MUTED 𓂀' &&
        measurer.getAttribute('aria-hidden') === 'true' && measurer.hasAttribute('inert') &&
        button.values.get('--solid-width') === '156px' && button.getAttribute('aria-label') === 'AUDIO: MUTED 𓂀' &&
        backLabel.textContent === 'AUDIO: MUTED 𓂀',
        'Dynamic labels update both readable faces and the normal-flow measurer without replacing host, body or faces');

    const writesBeforeStableResize = button.writes + generic.writes + phase.writes;
    observer.callbacks[0]();
    check(observer.callbacks.length === 1 && observer.observed.length === 3 && observer.observed.every(({ box }) => box === 'border-box') &&
        button.values.get('--solid-depth') === '18px' && generic.values.get('--solid-depth') === '16px' &&
        button.writes + generic.writes + phase.writes === writesBeforeStableResize,
        'One border-box ResizeObserver serves the batch; unchanged layout boxes cause no CSS writes or feedback loop');

    generic.layoutWidth = 40; generic.layoutHeight = 12;
    observer.callbacks[0]();
    check(generic.values.get('--solid-width') === '40px' && generic.values.get('--solid-height') === '12px' &&
        generic.values.get('--solid-depth') === '6px',
        'Resizing clamps real cuboid depth to the available control dimensions');

    button.layoutWidth = 208;
    check(setSolidButtonBackLabel(button as unknown as HTMLElement, 'הצליל מושתק') &&
        backLabel.textContent === 'הצליל מושתק' && visual.textContent === 'AUDIO: MUTED 𓂀' &&
        button.getAttribute('aria-label') === 'AUDIO: MUTED 𓂀' && button.dataset.solidBackLabel === 'הצליל מושתק' &&
        measurer.values.get('display') === 'inline-grid' && measurer.childNodes.length === 2 &&
        button.values.get('--solid-width') === '208px' && body.childNodes.every((face, index) => face === sameFaces[index]),
        'An event can add a localized back to an existing solid and remeasure its wider face without changing its front, accessible name or six faces');

    binding.dispose();
    const restored = button.childNodes.length === 1 && button.childNodes[0] === visual && visual.childNodes[0] === originalText &&
        visual.textContent === 'AUDIO: ON' && button.getAttribute('aria-label') === 'ORIGINAL ACCESSIBLE NAME' &&
        button.dataset.canonicalText === 'AUDIO: ON' && button.dataset.buttonSolid === 'previous-marker' &&
        button.dataset.solidBackLabel === undefined &&
        button.dataset.buttonSolidKind === undefined && button.values.get('--solid-depth') === '7px' &&
        button.priorities.get('--solid-depth') === 'important' && !button.values.has('--solid-width') &&
        generic.childNodes[0] === canonical && generic.childNodes[1] === genericVisual && canonical.textContent === 'НАЧАЛЬНАЯ ФАЗА' &&
        phase.childNodes[0] === number && phase.childNodes[1] === name;
    const writesAfterDispose = button.writes;
    observer.callbacks[0]();
    binding.dispose();
    check(restored && observer.disconnects === 1 && button.writes === writesAfterDispose &&
        !setSolidButtonLabel(button as unknown as HTMLElement, 'MUST NOT APPLY') &&
        !setSolidButtonBackLabel(button as unknown as HTMLElement, 'MUST NOT APPLY'),
        'Disposal disconnects layout observation and restores original nodes, text, ARIA, dataset and inline CSS priorities exactly once');

    const current = manager.mount([button] as unknown as HTMLElement[]);
    binding.dispose();
    const remountedBody = button.childNodes.some((node) => node.className === 'solid-button-body');
    current.dispose();
    check(remountedBody && observer.disconnects === 2 && button.childNodes[0] === visual,
        'An old binding cannot dispose a newer mount; the current binding restores the original DOM');

    const bilingualHarness = makeHarness();
    const bilingual = new SolidNode('button');
    bilingual.textContent = 'HOW IT WORKS';
    const bilingualOriginal = bilingual.childNodes[0];
    bilingual.dataset.solidBackLabel = 'КАК ЭТО УСТРОЕНО';
    bilingual.layoutWidth = 224;
    bilingual.values.set('--solid-width', '99px');
    bilingual.priorities.set('--solid-width', 'important');
    const bilingualBinding = bilingualHarness.manager.mount([bilingual] as unknown as HTMLElement[]);
    const bilingualBody = bilingual.childNodes.find(node => node.className === 'solid-button-body')!;
    const bilingualFaces = bilingualBody.childNodes.slice();
    const bilingualFront = bilingualFaces.find(node => node.dataset.solidFace === 'front')!.childNodes[0];
    const bilingualBack = bilingualFaces.find(node => node.dataset.solidFace === 'back')!.childNodes[0];
    const bilingualMeasurer = bilingual.childNodes.find(node => node.className === 'solid-button-measurer')!;
    const measuredCaptions = (): string[] => bilingualMeasurer.childNodes.map(node => node.textContent);
    check(bilingualFront.textContent === 'HOW IT WORKS' && bilingualBack.textContent === 'КАК ЭТО УСТРОЕНО' &&
        bilingual.getAttribute('aria-label') === 'HOW IT WORKS' && bilingualBack.hasAttribute('inert') &&
        bilingual.dataset.solidBackLabel === 'КАК ЭТО УСТРОЕНО' &&
        bilingualMeasurer.getAttribute('aria-hidden') === 'true' && bilingualMeasurer.hasAttribute('inert'),
        'An optional translated back caption retains the canonical front accessible name and creates no additional interactive or spoken label');
    check(bilingualMeasurer.values.get('display') === 'inline-grid' &&
        bilingualMeasurer.values.get('grid-template-columns') === 'max-content' &&
        measuredCaptions().join('|') === 'HOW IT WORKS|КАК ЭТО УСТРОЕНО' &&
        bilingualMeasurer.childNodes.every(node => node.values.get('grid-area') === '1 / 1') &&
        bilingual.values.get('--solid-width') === '224px',
        'Both bilingual captions share one normal-flow max-content grid cell so the wider face reserves host layout and cuboid geometry without doubling height');

    bilingual.layoutWidth = 308;
    setSolidButtonLabel(bilingual as unknown as HTMLElement, 'HOW THIS UNIVERSE WORKS');
    check(bilingualFront.textContent === 'HOW THIS UNIVERSE WORKS' && bilingualBack.textContent === 'КАК ЭТО УСТРОЕНО' &&
        bilingual.getAttribute('aria-label') === 'HOW THIS UNIVERSE WORKS' &&
        measuredCaptions().join('|') === 'HOW THIS UNIVERSE WORKS|КАК ЭТО УСТРОЕНО' &&
        bilingualBody.childNodes.every((face, index) => face === bilingualFaces[index]) &&
        bilingual.values.get('--solid-width') === '308px',
        'A front label change updates its accessible name and width reservation while preserving the configured Russian back and all six existing faces');
    const bilingualWrites = bilingual.writes;
    const bilingualMeasureNodes = bilingualMeasurer.childNodes.slice();
    setSolidButtonLabel(bilingual as unknown as HTMLElement, 'HOW THIS UNIVERSE WORKS');
    bilingualHarness.observer.callbacks[0]();
    check(bilingual.writes === bilingualWrites &&
        bilingualMeasurer.childNodes.every((node, index) => node === bilingualMeasureNodes[index]),
        'Unchanged bilingual text and layout retain their measuring nodes without CSS writes or resize feedback');

    bilingual.setAttribute('dir', 'rtl');
    bilingual.values.set('--button-spin-angle', '-37deg');
    bilingual.values.set('--button-axis-y', '0.7');
    bilingual.layoutWidth = 340;
    check(setSolidButtonBackLabel(bilingual as unknown as HTMLElement, 'איך היקום הזה פועל') &&
        bilingualFront.textContent === 'HOW THIS UNIVERSE WORKS' && bilingualBack.textContent === 'איך היקום הזה פועל' &&
        bilingual.getAttribute('aria-label') === 'HOW THIS UNIVERSE WORKS' &&
        measuredCaptions().join('|') === 'HOW THIS UNIVERSE WORKS|איך היקום הזה פועל' &&
        bilingual.dataset.solidBackLabel === 'איך היקום הזה פועל' && bilingual.values.get('--solid-width') === '340px' &&
        bilingualBody.childNodes.every((face, index) => face === bilingualFaces[index]) &&
        bilingual.values.get('--button-spin-angle') === '-37deg' && bilingual.values.get('--button-axis-y') === '0.7' &&
        bilingual.getAttribute('dir') === 'rtl',
        'Switching the back to Hebrew updates its caption and width while preserving front semantics, face identity and signed rotation');
    setSolidButtonLabel(bilingual as unknown as HTMLElement, 'THE UNIVERSE EXPLAINED');
    check(bilingualFront.textContent === 'THE UNIVERSE EXPLAINED' && bilingualBack.textContent === 'איך היקום הזה פועל' &&
        bilingual.getAttribute('aria-label') === 'THE UNIVERSE EXPLAINED' &&
        measuredCaptions().join('|') === 'THE UNIVERSE EXPLAINED|איך היקום הזה פועל',
        'Later front updates retain the latest localized back and refresh both measurement captions');
    const localizedMeasureNodes = bilingualMeasurer.childNodes.slice();
    const localizedWrites = bilingual.writes;
    setSolidButtonBackLabel(bilingual as unknown as HTMLElement, 'איך היקום הזה פועל');
    bilingualHarness.observer.callbacks[0]();
    check(bilingual.writes === localizedWrites &&
        bilingualMeasurer.childNodes.every((node, index) => node === localizedMeasureNodes[index]),
        'Repeating the current localized back retains measuring nodes and produces no layout feedback or CSS writes');

    bilingualBinding.dispose();
    check(bilingual.childNodes.length === 1 && bilingual.childNodes[0] === bilingualOriginal &&
        bilingual.textContent === 'HOW IT WORKS' && bilingual.getAttribute('aria-label') === null &&
        bilingual.dataset.solidBackLabel === 'КАК ЭТО УСТРОЕНО' && bilingual.dataset.canonicalText === undefined &&
        bilingual.values.get('--solid-width') === '99px' && bilingual.priorities.get('--solid-width') === 'important' &&
        bilingualHarness.observer.disconnects === 1,
        'Disposing a localized solid restores its original front nodes, accessible state, CSS and caller-provided translation attribute');
}
// КОНЕЦ ФУНКЦИИ runButtonSolidChecks
// КОНЕЦ РАЗДЕЛА 2
