// ============================================================================
// ФАЙЛ: frontend/src/tests/explanationDialog.test.ts
// НАЗНАЧЕНИЕ: Проверить каталог, связи терминов и настоящий жизненный цикл окна.
// РАЗДЕЛЫ: 1. Минимальное дерево DOM; 2. Каталог; 3. Живая сцена, ввод и освобождение;
//          4. Геометрия и временные ресурсы звёздного следа.
// ФУНКЦИИ: descendants, dispatch, runExplanationDialogChecks, runExplanationTrailChecks;
//          методы DialogNode.
// ============================================================================
import { EXPLAINER_OVERVIEW_ID, EXPLAINER_TOPICS, getExplainerTopic } from '../core/explainerTopics';
import { resourceLedger } from '../core/resourceLedger';
import { CANONICAL_FINALE_LINES } from '../bridge/cipherOdometerEngine';
import { FINALE_TOPIC_TERMS, renderLayer5CipherFinaleView } from '../layers/Layer5_CipherFinale';
import { mountExplanationDialog, type ExplanationDialogBinding } from '../layers/ExplanationDialog';
import {
    buildExplanationTrailPath, sampleExplanationTrailPath, playExplanationTrail, EXPLANATION_TRAIL_DURATION_MS,
} from '../layers/explanationTrail';
import { universeStore } from '../store/universeState';
import { bindUniverseKeyboardShortcuts } from '../engine/hud/keyboardShortcuts';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНОЕ ДЕРЕВО DOM
// EventTarget сохраняет настоящую семантику preventDefault/stopImmediatePropagation.
class ListenerTarget extends EventTarget {
    private registered = new Map<string, Set<EventListenerOrEventListenerObject>>();
    public get listenerCount(): number { return [...this.registered.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
    public override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions): void {
        super.addEventListener(type, callback, options);
        if (!callback) return;
        if (!this.registered.has(type)) this.registered.set(type, new Set());
        this.registered.get(type)!.add(callback);
    }
    public override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions): void {
        super.removeEventListener(type, callback, options);
        if (callback) this.registered.get(type)?.delete(callback);
    }
}

class DialogNode extends ListenerTarget {
    public children: DialogNode[] = [];
    public parentElement: DialogNode | null = null;
    public dataset: Record<string, string> = {};
    public attributes = new Map<string, string>();
    public id = '';
    public className = '';
    private text = '';
    public open = false;
    public showCount = 0;
    public scrollTop = 0;
    public hidden = false;
    private styles = new Map<string, { value: string; priority: string }>();
    public style = {
        getPropertyValue: (key: string): string => this.styles.get(key)?.value ?? '',
        getPropertyPriority: (key: string): string => this.styles.get(key)?.priority ?? '',
        setProperty: (key: string, value: string, priority = ''): void => { this.styles.set(key, { value, priority }); },
        removeProperty: (key: string): void => { this.styles.delete(key); },
    };

    public constructor(public readonly tagName: string, public readonly ownerDocument: DialogDocument) { super(); }
    public get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
    public set textContent(value: string) { this.replaceChildren(); this.text = value; }
    public get isConnected(): boolean { return this === this.ownerDocument.body || Boolean(this.parentElement?.isConnected); }
    public append(...nodes: DialogNode[]): void {
        for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); }
    }
    public replaceChildren(...nodes: DialogNode[]): void {
        this.children.forEach(node => { node.parentElement = null; }); this.children = []; this.text = ''; this.append(...nodes);
    }
    public appendChild(node: DialogNode): DialogNode { this.append(node); return node; }
    public remove(): void {
        if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
        this.parentElement = null;
    }
    public setAttribute(name: string, value: string): void {
        if (name === 'id') this.id = value;
        else if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/gu, (_, c: string) => c.toUpperCase())] = value;
        else this.attributes.set(name, value);
    }
    public getAttribute(name: string): string | null {
        if (name === 'id') return this.id || null;
        if (name === 'hidden') return this.hidden ? '' : null;
        if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/gu, (_, c: string) => c.toUpperCase())] ?? null;
        return this.attributes.get(name) ?? null;
    }
    public removeAttribute(name: string): void { this.attributes.delete(name); }
    public matches(selector: string): boolean {
        return selector.split(',').some(part => {
            const key = part.trim();
            if (key.startsWith('.')) return this.className.split(/\s/u).includes(key.slice(1));
            if (key.startsWith('#')) return this.id === key.slice(1);
            const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/u.exec(key);
            if (attribute) return attribute[2] === undefined ? this.getAttribute(attribute[1]) !== null : this.getAttribute(attribute[1]) === attribute[2];
            return this.tagName === key.toUpperCase();
        });
    }
    public closest(selector: string): DialogNode | null { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
    public contains(node: DialogNode): boolean { return node === this || this.children.some(child => child.contains(node)); }
    public querySelectorAll(selector: string): DialogNode[] { return descendants(this).filter(node => node.matches(selector)); }
    public querySelector(selector: string): DialogNode | null { return this.querySelectorAll(selector)[0] ?? null; }
    public focus(): void { this.ownerDocument.activeElement = this; }
    public getClientRects(): object[] { return this.hidden ? [] : [{}]; }
    public getBoundingClientRect(): { left: number; right: number; top: number; bottom: number; width: number; height: number } {
        return { left: 100, right: 700, top: 100, bottom: 600, width: 600, height: 500 };
    }
    public show(): void { this.open = true; this.showCount++; }
    public close(): void { if (this.open) { this.open = false; this.dispatchEvent(new Event('close')); } }
}

class DialogDocument extends ListenerTarget {
    public body = new DialogNode('BODY', this);
    public hidden = false;
    public activeElement: DialogNode | null = null;
    public createElement(tag: string): DialogNode { return new DialogNode(tag.toUpperCase(), this); }
    public createTextNode(text: string): DialogNode { const node = this.createElement('#text'); node.textContent = text; return node; }
    public getElementById(id: string): DialogNode | null { return this.body.querySelector(`#${id}`); }
}

function descendants(node: DialogNode): DialogNode[] { return node.children.flatMap(child => [child, ...descendants(child)]); }
function dispatch(target: EventTarget, type: string, properties: Record<string, unknown> = {}): Event {
    const event = new Event(type, { cancelable: true });
    Object.entries(properties).forEach(([name, value]) => Object.defineProperty(event, name, { value }));
    target.dispatchEvent(event);
    return event;
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ runExplanationDialogChecks
export function runExplanationDialogChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. КАТАЛОГ И СЕМАНТИЧЕСКИЕ СВЯЗИ
    const requiredTopics = ['overview', 'polyglot', 'astro', 'typescript', 'jsx-dom', 'canvas-wgsl', 'rust-wasm',
        'python', 'symplectic', 'kuramoto', 'nexus', 'prng', 'fbm', 'plummer', 'ouroboros'];
    check(requiredTopics.every(id => EXPLAINER_TOPICS.filter(topic => topic.id === id).length === 1) &&
        new Set(EXPLAINER_TOPICS.map(topic => topic.id)).size === EXPLAINER_TOPICS.length &&
        EXPLAINER_TOPICS.every(topic => getExplainerTopic(topic.id) === topic) &&
        getExplainerTopic('__unknown__') === undefined && EXPLAINER_OVERVIEW_ID === 'overview',
    'The explainer covers every technology and mathematical model with unique stable topic IDs and an explicit unknown-topic result');
    check(EXPLAINER_TOPICS.every(topic => [topic.label, topic.title, topic.summary, topic.experience, topic.intuition,
        ...topic.technical].every(text => text.trim().length > 0) && topic.technical.length > 0 &&
        topic.sources.length > 0 && topic.sources.every(source => source.label.trim().length > 0 &&
            /^(frontend|backend|physics_engine|docs)\//u.test(source.path) && !source.path.split('/').includes('..')) &&
        topic.formulas.every(formula => formula.label.trim().length > 0 && formula.text.trim().length > 0)),
    'Each topic provides a readable scene connection, intuition, technical explanation and repository sources; formulas always have text alternatives');
    check(['symplectic', 'kuramoto', 'nexus', 'prng', 'fbm', 'plummer', 'ouroboros'].every(id =>
        (getExplainerTopic(id)?.formulas.length ?? 0) > 0),
    'Every mathematical model includes at least one explicit formula rather than only a title');
    const expectedTerms = [['SCRAMBLER', 'prng'], ['KURAMOTO', 'kuramoto'], ['fBm', 'fbm'],
        ['VERLET', 'symplectic'], ['PLUMMER', 'plummer']];
    check(FINALE_TOPIC_TERMS.length === expectedTerms.length && expectedTerms.every(([label, topicId]) =>
        FINALE_TOPIC_TERMS.filter(term => term.label === label && term.topicId === topicId).length === 1) && FINALE_TOPIC_TERMS.every(term =>
        term.lineIndex === 3 && getExplainerTopic(term.topicId) !== undefined && CANONICAL_FINALE_LINES[term.lineIndex].includes(term.label)),
    'Exactly five mathematical terms resolve to their specific catalog topics in the dedicated card row above the technology stack');
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. НЕПРЕРЫВНАЯ СЦЕНА И НЕЗАВИСИМОЕ ОКНО
    const names = ['window', 'document', 'HTMLElement', 'Element', 'Node'] as const;
    const savedGlobals = names.map(name => ({ name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name) }));
    const savedStore = Object.getOwnPropertyDescriptors(universeStore);
    const document = new DialogDocument();
    const window = Object.assign(new ListenerTarget(), { getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) });
    const baseline = { ...resourceLedger.getCounters() };
    let binding: ExplanationDialogBinding | undefined;
    let releaseShortcuts: (() => void) | undefined;
    const overview = document.createElement('button'); overview.id = 'btn-explanation-overview';
    const trigger = document.createElement('button'); trigger.dataset.explainTopic = 'kuramoto';
    const triggerChild = document.createElement('span'); trigger.append(triggerChild);
    document.body.append(overview, trigger);
    const click = (target: DialogNode): Event => dispatch(document, 'click', { target });

    try {
        Object.defineProperties(universeStore, {
            state: { ...savedStore.state, value: { ...structuredClone(universeStore.getState()), isPaused: false,
                autoCyclePhases: true, isFinaleCardHovered: false } },
            listeners: { ...savedStore.listeners, value: new Set() },
            emittedEventKeys: { ...savedStore.emittedEventKeys, value: new Set() },
        });
        Object.defineProperties(globalThis, {
            document: { configurable: true, value: document }, window: { configurable: true, value: window },
            HTMLElement: { configurable: true, value: DialogNode }, Element: { configurable: true, value: DialogNode },
            Node: { configurable: true, value: DialogNode },
        });
        const card = renderLayer5CipherFinaleView({ ...universeStore.getState(), singularityAct: 'ACT_D_GITHUB_CARD',
            githubCardAssemblyProgress: 1 }) as unknown as DialogNode;
        const mathRow = card.querySelector('.finale-line-math')!;
        const stackRow = card.querySelector('.finale-line-stack')!;
        const mathButtons = mathRow.querySelectorAll('button');
        check(mathRow.textContent === CANONICAL_FINALE_LINES[3] && stackRow.textContent === CANONICAL_FINALE_LINES[4] &&
            mathButtons.length === 5 && expectedTerms.every(([label, topicId], index) =>
                mathButtons[index].textContent === label && mathButtons[index].dataset.explainTopic === topicId &&
                mathButtons[index].getAttribute('aria-haspopup') === 'dialog') &&
            stackRow.querySelectorAll('button, a, [data-explain-topic]').length === 0 &&
            mathRow.parentElement === stackRow.parentElement &&
            mathRow.parentElement!.children.indexOf(mathRow) < mathRow.parentElement!.children.indexOf(stackRow),
        'The actual finale view renders five accessible mathematical buttons above a separate nonclickable technology row');
        document.body.style.setProperty('overflow', 'auto', 'important');
        binding = mountExplanationDialog();
        const dialog = document.getElementById('explanation-dialog')!;
        const title = document.getElementById('explanation-title')!;
        const content = dialog.querySelector('.explanation-content')!;
        const mountedListeners = resourceLedger.getCounters().listeners;
        check(!dialog.open && !universeStore.getState().isPaused && document.body.dataset.explanationOpen === undefined,
            'Mounting the shared explanation dialog leaves the running scene and focus untouched');

        const launch = click(triggerChild);
        const audioEnabled = universeStore.getState().audioEnabled;
        check(launch.defaultPrevented && dialog.open && dialog.dataset.topic === 'kuramoto' &&
            !universeStore.getState().isPaused && document.activeElement === title &&
            dialog.getAttribute('aria-modal') !== 'true' && document.body.getAttribute('inert') === null &&
            document.body.style.getPropertyValue('overflow') === 'auto' &&
            document.body.style.getPropertyPriority('overflow') === 'important' &&
            content.querySelectorAll('.explanation-formula-text').length === 0,
        'A nested term click opens a nonmodal explanation in simple mode without pausing the scene, making the page inert or locking scroll');
        binding.open('symplectic');
        binding.open('plummer');
        const expert = dialog.querySelector('[data-explanation-mode="expert"]')!;
        click(expert);
        check(dialog.showCount === 1 && document.body.querySelectorAll('dialog').length === 1 &&
            dialog.dataset.topic === 'plummer' && dialog.dataset.mode === 'expert' &&
            resourceLedger.getCounters().listeners === mountedListeners && !universeStore.getState().isPaused &&
            content.querySelectorAll('.explanation-formula-text').length === getExplainerTopic('plummer')!.formulas.length &&
            content.querySelectorAll('a').every(link => /^https:\/\/github\.com\/DubnovAlexey\/universe\/blob\/main\//u.test(
                (link as unknown as HTMLAnchorElement).href)),
        'Topic and reading-mode changes reuse one panel and listener set while expert mode exposes formulas and direct source links');

        universeStore.setPhase('01_VOID');
        const phaseDuration = universeStore.getState().phaseMeta.durationSec;
        universeStore.updateTelemetry({ frameTimeMs: 16, phaseElapsedSec: phaseDuration, simulationTimeSec: phaseDuration });
        check(dialog.open && !universeStore.getState().isPaused && universeStore.getState().currentPhase === '02_GENESIS' &&
            universeStore.getState().telemetry.simulationTimeSec >= phaseDuration && universeStore.getState().audioEnabled === audioEnabled,
        'The real scene clock and automatic phase transition continue while the explanation remains open, with audio state unchanged');

        let sceneKeys = 0;
        const sceneKey = (): void => { sceneKeys++; };
        releaseShortcuts = bindUniverseKeyboardShortcuts(window as unknown as Window);
        window.addEventListener('keydown', sceneKey);
        window.addEventListener('keyup', sceneKey);
        const keyboard = [['KeyP', 'p'], ['Digit2', '2'], ['Space', ' '], ['ArrowLeft', 'ArrowLeft'], ['Tab', 'Tab']].flatMap(([code, key]) =>
            ['keydown', 'keyup'].map(type => dispatch(window, type, { code, key, target: title })));
        check(sceneKeys === 0 && keyboard.every(event => !event.defaultPrevented) && dialog.open && !universeStore.getState().isPaused,
            'Only keys originating inside the panel bypass scene shortcuts; native Tab and control activation remain uncancelled');
        dispatch(window, 'keydown', { key: 'p', code: 'KeyP', target: trigger });
        const userPaused = universeStore.getState().isPaused;
        dispatch(window, 'keydown', { key: 'p', code: 'KeyP', target: trigger });
        const previousLayer = universeStore.getState().layers.layer2_metricsHud;
        dispatch(window, 'keydown', { key: '2', code: 'Digit2', target: trigger });
        const outsideEscape = dispatch(window, 'keydown', { key: 'Escape', code: 'Escape', target: trigger });
        check(sceneKeys === 4 && userPaused && !universeStore.getState().isPaused && dialog.open && !outsideEscape.defaultPrevented &&
            universeStore.getState().layers.layer2_metricsHud !== previousLayer,
        'Outside controls retain the real pause and layer shortcuts while an outside Escape leaves the explanation open');
        releaseShortcuts(); releaseShortcuts = undefined;

        const escape = dispatch(window, 'keydown', { key: 'Escape', code: 'Escape', target: title });
        check(escape.defaultPrevented && !dialog.open && !universeStore.getState().isPaused && document.activeElement === trigger &&
            resourceLedger.getCounters().listeners === mountedListeners &&
            document.body.style.getPropertyValue('overflow') === 'auto' &&
            document.body.style.getPropertyPriority('overflow') === 'important',
        'Escape inside the panel closes it and restores its trigger without changing playback or page scroll styling');
        const navigation = dialog.querySelector('.explanation-nav')!;
        const lastTopic = navigation.querySelector('[data-explain-topic="ouroboros"]')!;
        Object.defineProperty(navigation, 'getBoundingClientRect', { value: () =>
            ({ left: 100, right: 700, top: 100, bottom: 200, width: 600, height: 100 }) });
        Object.defineProperty(lastTopic, 'getBoundingClientRect', { value: () =>
            ({ left: 100, right: 200, top: 260 - navigation.scrollTop, bottom: 290 - navigation.scrollTop, width: 100, height: 30 }) });
        document.body.scrollTop = 37;
        binding.open('ouroboros', trigger as unknown as HTMLElement);
        const lastTopicVisible = lastTopic.getBoundingClientRect().bottom <= navigation.getBoundingClientRect().bottom;
        dialog.close();
        navigation.scrollTop = 219;
        binding.open(EXPLAINER_OVERVIEW_ID, trigger as unknown as HTMLElement);
        check(lastTopicVisible && navigation.scrollTop === 0 && dialog.scrollTop === 0 && document.body.scrollTop === 37 &&
            navigation.querySelector('[data-explain-topic="overview"]')!.getAttribute('aria-current') === 'page',
        'Selecting a lower topic reveals its chip within the list; reopening the overview resets only navigation scroll and preserves page position');
        dispatch(dialog, 'cancel'); document.body.scrollTop = 0;
        universeStore.togglePause();
        binding.open('typescript', trigger as unknown as HTMLElement);
        dialog.close();
        check(universeStore.getState().isPaused && document.activeElement === trigger,
            'Closing a dialog opened from an already paused scene preserves the user pause');

        universeStore.togglePause();
        binding.open('nexus', trigger as unknown as HTMLElement);
        universeStore.togglePause();
        dialog.close();
        const pausedByUserWhileOpen = universeStore.getState().isPaused;
        binding.open('nexus', trigger as unknown as HTMLElement);
        universeStore.togglePause();
        dialog.close();
        check(pausedByUserWhileOpen && !universeStore.getState().isPaused,
            'Manual pause and resume remain authoritative across panel opens and closes');
        binding.open('__unknown__', trigger as unknown as HTMLElement);
        check(dialog.dataset.topic === EXPLAINER_OVERVIEW_ID && title.textContent === getExplainerTopic(EXPLAINER_OVERVIEW_ID)!.title,
            'An unknown explanation request gracefully opens the overview with a valid title');
        trigger.remove(); dialog.close();
        check(document.activeElement === overview && !universeStore.getState().isPaused,
            'A removed card trigger returns focus to the persistent overview control');

        binding.open('kuramoto', overview as unknown as HTMLElement);
        const pointer = (type: string, x: number, y: number, pointerId = 1): void => {
            dispatch(dialog, type, { clientX: x, clientY: y, pointerId, button: 0 });
        };
        pointer('pointerdown', 150, 150); pointer('pointerup', 20, 20);
        const draggedSelection = dialog.open;
        pointer('pointerdown', 20, 20); pointer('pointercancel', 20, 20); pointer('pointerup', 20, 20);
        const cancelledPointer = dialog.open;
        pointer('pointerdown', 20, 20, 1); pointer('pointerup', 20, 20, 2);
        const otherPointer = dialog.open;
        pointer('pointerdown', 20, 20); pointer('pointerup', 20, 20);
        check(draggedSelection && cancelledPointer && otherPointer && !dialog.open &&
            !universeStore.getState().isPaused && document.activeElement === overview,
        'Panel-edge dismissal requires the same uncancelled pointer to start and end outside; selection drags preserve the panel');

        binding.open('fbm', overview as unknown as HTMLElement);
        binding.dispose(); binding.dispose();
        const beforeKeys = sceneKeys;
        dispatch(window, 'keydown', { code: 'KeyP' }); dispatch(window, 'keyup', { code: 'KeyP' });
        binding.open('kuramoto');
        click(overview);
        const counters = resourceLedger.getCounters();
        check(!dialog.isConnected && !dialog.open && document.body.querySelectorAll('dialog').length === 0 &&
            !universeStore.getState().isPaused && sceneKeys === beforeKeys + 2 &&
            document.listenerCount === 0 && dialog.listenerCount === 0 && window.listenerCount === 2 &&
            counters.listeners === baseline.listeners && counters.underflowCount === baseline.underflowCount &&
            document.body.dataset.explanationOpen === undefined,
        'Idempotent disposal preserves playback, removes the panel and keyboard guard, releases all listeners and prevents reopening');
        window.removeEventListener('keydown', sceneKey); window.removeEventListener('keyup', sceneKey);
    } finally {
        binding?.dispose();
        releaseShortcuts?.();
        Object.defineProperties(universeStore, savedStore);
        for (const { name, descriptor } of savedGlobals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    }
    // КОНЕЦ РАЗДЕЛА 3
    runExplanationTrailChecks(check);
}
// КОНЕЦ ФУНКЦИИ runExplanationDialogChecks

// НАЧАЛО РАЗДЕЛА 4. ГЕОМЕТРИЯ И РЕСУРСЫ ЗВЁЗДНОГО СЛЕДА
function runExplanationTrailChecks(check: (passed: boolean, description: string) => void): void {
    const from = { left: 820, top: 24, width: 120, height: 36 };
    const to = { left: 16, top: 122, width: 360, height: 460 };
    const path = buildExplanationTrailPath(from, to);
    const start = sampleExplanationTrailPath(path, 0), end = sampleExplanationTrailPath(path, 1);
    check(start.x === 880 && start.y === 42 && end.x === 196 && end.y === 352 &&
        sampleExplanationTrailPath(path, -1).x === start.x && sampleExplanationTrailPath(path, 2).y === end.y,
    'The star trail connects the actual button center to the left dialog center and clamps sampling to its endpoints');
    const phonePath = buildExplanationTrailPath({ left: 340, top: 18, width: 36, height: 28 },
        { left: 12, top: 58, width: 366, height: 680 });
    const stationaryPath = buildExplanationTrailPath(from, from);
    check(phonePath.start.x === 358 && phonePath.end.x === 195 &&
        [path, phonePath, stationaryPath].every(curve => Array.from({ length: 21 }, (_, index) =>
            sampleExplanationTrailPath(curve, index / 20)).every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) &&
        sampleExplanationTrailPath(stationaryPath, 0.5).x === path.start.x,
    'Off-center phone buttons and coincident centers produce finite continuous trail positions without depending on viewport symmetry');

    const savedGlobals = ['window', 'document', 'HTMLElement', 'Element'].map(name =>
        ({ name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name) }));
    const baseline = { ...resourceLedger.getCounters() };
    const document = new DialogDocument();
    const pending = new Map<number, FrameRequestCallback>();
    let nextFrame = 0, reducedMotion = false, contextAvailable = true, drawCount = 0;
    let finiteDrawing = true;
    let transform: number[] = [];
    const context = {
        setTransform: (...values: number[]): void => { transform = values; },
        clearRect: (): void => { drawCount++; }, beginPath: (): void => {}, fill: (): void => {}, stroke: (): void => {},
        moveTo: (x: number, y: number): void => { finiteDrawing &&= Number.isFinite(x) && Number.isFinite(y); },
        lineTo: (x: number, y: number): void => { finiteDrawing &&= Number.isFinite(x) && Number.isFinite(y); },
        arc: (x: number, y: number, radius: number): void => { finiteDrawing &&= [x, y, radius].every(Number.isFinite) && radius > 0; },
    };
    type TrailCanvas = DialogNode & { width: number; height: number };
    const createElement = document.createElement.bind(document);
    document.createElement = (tag: string): DialogNode => {
        const node = createElement(tag);
        if (tag === 'canvas') Object.assign(node, { width: 0, height: 0, getContext: () => contextAvailable ? context : null });
        return node;
    };
    const window = Object.assign(new ListenerTarget(), {
        innerWidth: 960, innerHeight: 600, devicePixelRatio: 3,
        getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
        matchMedia: () => ({ matches: reducedMotion }),
        requestAnimationFrame: (callback: FrameRequestCallback): number => { pending.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame: (id: number): void => { pending.delete(id); },
    });
    const trigger = document.createElement('button'), dialog = document.createElement('dialog');
    dialog.open = true; document.body.append(trigger, dialog);
    let dispose: (() => void) | undefined;
    let binding: ExplanationDialogBinding | undefined;
    const play = (): (() => void) => playExplanationTrail(trigger as unknown as HTMLElement, dialog as unknown as HTMLDialogElement);
    const pump = (timestamp: number): void => {
        const frame = pending.entries().next().value;
        if (!frame) throw new Error('The active explanation trail has no pending frame');
        pending.delete(frame[0]); frame[1](timestamp);
    };
    const released = (): boolean => pending.size === 0 && document.body.querySelectorAll('canvas').length === 0 &&
        window.listenerCount === 0 && document.listenerCount === 0 && dialog.dataset.entryAnimation === undefined &&
        resourceLedger.getCounters().buffers === baseline.buffers && resourceLedger.getCounters().listeners === baseline.listeners &&
        resourceLedger.getCounters().underflowCount === baseline.underflowCount;

    try {
        Object.defineProperties(globalThis, {
            document: { configurable: true, value: document }, window: { configurable: true, value: window },
            HTMLElement: { configurable: true, value: DialogNode }, Element: { configurable: true, value: DialogNode },
        });
        dispose = play();
        const canvas = document.body.querySelector('canvas') as TrailCanvas;
        check(pending.size === 1 && canvas.isConnected && canvas.width === 1440 && canvas.height === 900 &&
            canvas.getAttribute('aria-hidden') === 'true' && canvas.getAttribute('inert') === '' &&
            canvas.style.getPropertyValue('pointer-events') === 'none' && dialog.dataset.entryAnimation === 'true' &&
            transform.join(',') === '1.5,0,0,1.5,0,0',
        'Opening a trail creates one noninteractive decorative canvas with a bounded DPR and one temporary frame');
        [5000, 5100, 5350, 5750].forEach(pump);
        const animated = pending.size === 1 && drawCount >= 5 && finiteDrawing;
        pump(5000 + EXPLANATION_TRAIL_DURATION_MS);
        dispose(); dispose();
        check(animated && released() && canvas.width === 0 && canvas.height === 0 && !canvas.isConnected,
            'The trail advances using its own timestamps, draws finite stars and completely releases its canvas, frame and listeners after fading');

        const interrupted: boolean[] = [];
        for (const reason of ['resize', 'hidden', 'closed', 'removed', 'dispose']) {
            dispose = play(); pump(0);
            if (reason === 'resize') dispatch(window, 'resize');
            else if (reason === 'hidden') { document.hidden = true; dispatch(document, 'visibilitychange'); }
            else if (reason === 'closed') { dialog.close(); pump(100); }
            else if (reason === 'removed') { dialog.remove(); pump(100); }
            else dispose();
            interrupted.push(released()); dispose();
            document.hidden = false; dialog.open = true;
            if (!dialog.isConnected) document.body.append(dialog);
        }
        check(interrupted.every(Boolean),
            'Resize, hidden page, native close, detached dialog and explicit disposal each cancel the trail without leaving a frame, canvas or listener');

        trigger.dataset.explainTopic = 'prng';
        const nextTrigger = document.createElement('button'); nextTrigger.dataset.explainTopic = 'fbm';
        document.body.append(nextTrigger);
        binding = mountExplanationDialog();
        const panel = document.getElementById('explanation-dialog')!;
        dispatch(document, 'click', { target: trigger });
        const firstCanvas = document.body.querySelector('canvas')!;
        const firstFrame = [...pending.keys()][0];
        dispatch(document, 'click', { target: panel.querySelector('[data-explain-topic="kuramoto"]')! });
        dispatch(document, 'click', { target: panel.querySelector('[data-explanation-mode="expert"]')! });
        const internalNavigationKeptTrail = document.body.querySelector('canvas') === firstCanvas && pending.has(firstFrame);
        dispatch(document, 'click', { target: nextTrigger });
        const externalNavigationReplayed = !firstCanvas.isConnected && !pending.has(firstFrame) && pending.size === 1 &&
            document.body.querySelectorAll('canvas').length === 1 && panel.dataset.topic === 'fbm' && panel.showCount === 1;
        panel.close(); binding.dispose();
        check(internalNavigationKeptTrail && externalNavigationReplayed && document.activeElement === nextTrigger && released(),
            'External term clicks retrace to the existing panel and restore the latest trigger; internal navigation and reading modes preserve the current trail');

        reducedMotion = true; play()();
        const reduced = released();
        reducedMotion = false; contextAvailable = false; play()();
        check(reduced && released(),
            'Reduced motion and unavailable Canvas skip the effect immediately while retaining no animation resources');
    } finally {
        binding?.dispose();
        dispose?.();
        for (const { name, descriptor } of savedGlobals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    }
}
// КОНЕЦ РАЗДЕЛА 4
