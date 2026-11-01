// ============================================================================
// ФАЙЛ: frontend/src/tests/explanationDialog.test.ts
// НАЗНАЧЕНИЕ: Проверить каталог, связи терминов и настоящий жизненный цикл окна.
// РАЗДЕЛЫ: 1. Минимальное дерево DOM; 2. Каталог; 3. Живая сцена, ввод и освобождение;
//          4. Читаемый текст на паузе и часы появления; 5. Сборка окна из пыли: геометрия, шкала, Canvas и ресурсы окна.
// ФУНКЦИИ: descendants, dispatch, runExplanationDialogChecks, runExplanationTextRevealPauseChecks, runExplanationTrailChecks;
//          методы DialogNode.
// ============================================================================
import { EXPLAINER_OVERVIEW_ID, EXPLAINER_TOPICS, getExplainerTopic } from '../core/explainerTopics';
import { resourceLedger } from '../core/resourceLedger';
import { CANONICAL_FINALE_LINES } from '../bridge/cipherOdometerEngine';
import { FINALE_TOPIC_TERMS, renderLayer5CipherFinaleView } from '../layers/Layer5_CipherFinale';
import { mountExplanationDialog, type ExplanationDialogBinding } from '../layers/ExplanationDialog';
import { playExplanationTrail } from '../layers/explanationTrail';
import {
    EXPLANATION_ASSEMBLY_MS, EXPLANATION_DUST_COUNT, EXPLANATION_DUST_COUNT_COMPACT, EXPLANATION_FLIGHT_MS,
    EXPLANATION_REVEAL_MS, EXPLANATION_REVEAL_START_MS, EXPLANATION_SCATTER_MS, EXPLANATION_SWIRL_TURNS,
    EXPLANATION_TEXT_DELAY_MS, EXPLANATION_TRAIL_DURATION_MS, DUST_KIND_TRIGGER,
    ExplanationAssemblyState, explanationAssembly, buildExplanationDustField,
    getExplanationAssemblyFrame, sampleExplanationDustGrain, sampleExplanationDustScatter, type ExplanationDustField,
} from '../core/explanationAssembly';
import { renderExplanationAssemblyPass } from '../engine/passes/explanationAssemblyPass';
import { universeStore } from '../store/universeState';
import { bindUniverseKeyboardShortcuts } from '../engine/hud/keyboardShortcuts';
import { getVisualSignals, publishVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';
import { startExplanationTextReveal, EXPLANATION_TEXT_REVEAL_LIMIT } from '../layers/explanationTextReveal';
import { stressStore } from '../store/stressState';
import { audioSync } from '../utils/audioSync';

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
    public get childNodes(): DialogNode[] { return this.children; }
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
    public createElementNS(_namespace: string, tag: string): DialogNode { return this.createElement(tag); }
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
    runExplanationTextRevealPauseChecks(check);
    runExplanationTrailChecks(check);
}
// КОНЕЦ ФУНКЦИИ runExplanationDialogChecks

// НАЧАЛО РАЗДЕЛА 4. ЧИТАЕМЫЙ ТЕКСТ НА ПАУЗЕ И ЧАСЫ ПОЯВЛЕНИЯ
function runExplanationTextRevealPauseChecks(check: (passed: boolean, description: string) => void): void {
    const names = ['window', 'document'] as const;
    const savedGlobals = names.map(name => ({ name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name) }));
    const savedSignals = getVisualSignals();
    const state = universeStore.getState(), audio = audioSync.getSnapshot(0), stress = stressStore.getState();
    const document = new DialogDocument();
    const window = Object.assign(new ListenerTarget(), { getComputedStyle: () =>
        ({ position: 'static', width: '600px', height: '500px' }) });
    const paragraph = document.createElement('p');
    const originalText = document.createTextNode('The explanation remains readable while the scene is paused.');
    paragraph.append(originalText); document.body.append(paragraph);
    const baseline = { ...resourceLedger.getCounters() };
    let rangeReads = 0;
    Object.defineProperty(document, 'createRange', { value: () => {
        rangeReads++;
        return { setStart: (): void => {}, setEnd: (): void => {},
            getBoundingClientRect: () => ({ left: 100, top: 100, width: 8, height: 12 }) };
    } });
    const publishFrame = (changes: Partial<VisualSignalSnapshot> = {}): void => {
        const frame = { ...savedSignals, ...changes };
        publishVisualSignals({ ...state, currentPhase: frame.phase, isPaused: frame.isPaused, isTabHidden: false,
            reducedMotion: frame.reducedMotion, seed: frame.seed, telemetry: { ...state.telemetry, tick: frame.tick,
                simulationTimeSec: frame.simTimeSec, frameTimeMs: frame.frameDtSec * 1000,
                phaseProgress: frame.phaseProgress, kuramotoOrderR: frame.kuramotoR } },
        { ...audio, isPlaying: true, low: frame.low, mid: frame.mid, high: frame.high,
            pulse: frame.pulse, heartbeat: frame.heartbeat }, { ...stress, globalStress: frame.globalStress });
    };
    let disposeReveal: (() => void) | undefined;
    try {
        Object.defineProperties(globalThis, {
            document: { configurable: true, value: document }, window: { configurable: true, value: window },
        });
        publishFrame({ isPaused: true, reducedMotion: false });
        disposeReveal = startExplanationTextReveal([paragraph as unknown as HTMLElement], false);
        disposeReveal();
        check(rangeReads === 0 && paragraph.children.length === 1 && paragraph.children[0] === originalText &&
            paragraph.dataset.explanationRevealing === undefined && document.listenerCount === 0 && window.listenerCount === 0 &&
            resourceLedger.getCounters().listeners === baseline.listeners,
        'Starting an explanation reveal while paused skips available Range measurement and preserves the complete native text without masking or listeners');

        publishFrame({ isPaused: false, reducedMotion: false });
        disposeReveal = startExplanationTextReveal([paragraph as unknown as HTMLElement], false, 1300);
        const prepared = rangeReads > 0 && paragraph.querySelector('.explanation-text-prefix')?.style.getPropertyValue('visibility') === 'hidden' &&
            resourceLedger.getCounters().listeners === baseline.listeners + 3;
        publishFrame({ isPaused: true, reducedMotion: false });
        const restoredOnPause = paragraph.children.length === 1 && paragraph.children[0] === originalText &&
            paragraph.dataset.explanationRevealing === undefined && document.listenerCount === 0 && window.listenerCount === 0 &&
            resourceLedger.getCounters().listeners === baseline.listeners;
        disposeReveal(); disposeReveal();
        check(prepared && restoredOnPause && paragraph.children.length === 1 && paragraph.children[0] === originalText &&
            paragraph.textContent === originalText.textContent && paragraph.dataset.explanationRevealing === undefined &&
            paragraph.style.getPropertyValue('position') === '' && document.listenerCount === 0 && window.listenerCount === 0 &&
            resourceLedger.getCounters().listeners === baseline.listeners &&
            resourceLedger.getCounters().underflowCount === baseline.underflowCount,
        'Pausing a prepared explanation reveal immediately restores the original native text and releases its subscription and listeners exactly once');

        const longCopy = 'The complete explanation must wait for the assembled window before it becomes visible. '.repeat(8);
        const longText = document.createTextNode(longCopy);
        paragraph.replaceChildren(longText);
        publishFrame({ isPaused: false, reducedMotion: false, frameDtSec: 0.05 });
        let nowMs = 1000;
        disposeReveal = startExplanationTextReveal([paragraph as unknown as HTMLElement], false, 4000, () => nowMs);
        const prefix = paragraph.querySelector('.explanation-text-prefix');
        const tail = paragraph.querySelector('.explanation-text-tail');
        const maskedAtStart = prefix?.style.getPropertyValue('visibility') === 'hidden' && tail?.style.getPropertyValue('visibility') === 'hidden';
        nowMs = 4999;
        publishFrame({ isPaused: false, reducedMotion: false, frameDtSec: 0.05 });
        check(longCopy.length > EXPLANATION_TEXT_REVEAL_LIMIT && maskedAtStart &&
            prefix?.textContent === longCopy.slice(0, EXPLANATION_TEXT_REVEAL_LIMIT) &&
            tail?.textContent === longCopy.slice(EXPLANATION_TEXT_REVEAL_LIMIT) &&
            prefix?.style.getPropertyValue('visibility') === 'hidden' && tail?.style.getPropertyValue('visibility') === 'hidden' &&
            paragraph.dataset.explanationRevealing === 'true' && resourceLedger.getCounters().listeners === baseline.listeners + 3,
        'Long explanations hide both the animated prefix and the remaining native tail throughout the four-second window assembly wait');

        nowMs = 6200;
        publishFrame({ isPaused: false, reducedMotion: false, frameDtSec: 0.05 });
        const completedOnClock = paragraph.children.length === 1 && paragraph.children[0] === longText &&
            paragraph.textContent === longCopy && paragraph.dataset.explanationRevealing === undefined &&
            paragraph.style.getPropertyValue('position') === '' && document.listenerCount === 0 && window.listenerCount === 0 &&
            resourceLedger.getCounters().listeners === baseline.listeners;
        disposeReveal(); disposeReveal();
        check(completedOnClock && resourceLedger.getCounters().underflowCount === baseline.underflowCount,
        'A 5200ms clock advance completes the wait, reveal and native handoff after only two 50ms visual frames, restoring text and releasing all temporary listeners');
    } finally {
        disposeReveal?.();
        for (const { name, descriptor } of savedGlobals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
        publishFrame();
    }
}
// КОНЕЦ РАЗДЕЛА 4

// НАЧАЛО РАЗДЕЛА 5. СБОРКА ОКНА ИЗ ПЫЛИ: ГЕОМЕТРИЯ, ШКАЛА, ПРОХОД CANVAS И РЕСУРСЫ ОКНА
function runExplanationTrailChecks(check: (passed: boolean, description: string) => void): void {
    // 5.1. Вихрь: пыль со всех сторон закручивается в окно в одну сторону; старты — всё облако сцены.
    const swirl = EXPLANATION_SWIRL_TURNS * 2 * Math.PI;
    const ring = buildExplanationDustField({ from: null, to: { left: 760, top: 300, width: 400, height: 300 },
        viewport: { width: 1920, height: 900 }, count: 240, sources: null });
    const angleAround = (x: number, y: number): number => Math.atan2(y - ring.center.y, x - ring.center.x);
    const sectors = new Set(Array.from({ length: ring.count }, (_, k) =>
        Math.floor((angleAround(ring.originX[k], ring.originY[k]) + Math.PI) / (Math.PI / 6)) % 12));
    const coherent = Array.from(ring.swirlAngle).filter(angle => Math.abs(angle - swirl) < 0.6).length;
    check(sectors.size === 12 && Array.from(ring.swirlAngle).every(angle => angle > 0) && coherent >= ring.count * 0.9 &&
        ring.center.x === 960 && ring.center.y === 450 && ring.halfWidth === 200 && ring.halfHeight === 150,
    'Dust arrives from every direction and every grain turns the same way by about the shared vortex angle around the panel');

    // Окно у края экрана: пыль отрывается поровну от всех частиц облака вне окна, а не из нескольких точек.
    let seed = 7;
    const random = (): number => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000;
    const sceneDust = Array.from({ length: 820 }, () => ({ x: random() * 1920, y: random() * 900 }));
    const docked = { left: 20, top: 130, width: 384, height: 690 };
    const dockedField = buildExplanationDustField({ from: { left: 870, top: 840, width: 180, height: 40 }, to: docked,
        viewport: { width: 1920, height: 900 }, count: EXPLANATION_DUST_COUNT, sources: sceneDust });
    const cloud = sceneDust.filter(point => !(point.x > docked.left - 24 && point.x < docked.left + docked.width + 24 &&
        point.y > docked.top - 24 && point.y < docked.top + docked.height + 24));
    const fed = new Map<number, number>();
    let sceneGrains = 0, nearParticle = true;
    for (let k = 0; k < dockedField.count; k++) {
        if ((dockedField.kind[k] & DUST_KIND_TRIGGER) !== 0) continue;
        sceneGrains++;
        let nearest = -1, nearestDistance = Infinity;
        cloud.forEach((point, index) => {
            const gap = Math.hypot(point.x - dockedField.originX[k], point.y - dockedField.originY[k]);
            if (gap < nearestDistance) { nearestDistance = gap; nearest = index; }
        });
        nearParticle &&= nearestDistance <= 10 + 1e-9;
        fed.set(nearest, (fed.get(nearest) ?? 0) + 1);
    }
    check(sceneGrains > 0 && nearParticle && fed.size >= cloud.length * 0.9 &&
        Math.max(...fed.values()) <= Math.ceil(sceneGrains / cloud.length) + 2,
    'A panel docked at the screen edge draws its dust evenly from the whole visible cloud, a few grains from each particle');

    // 5.2. Общая шкала: неторопливый вихрь, проявление окна на его месте; пыль впитывается в окно.
    const timeline = Array.from({ length: Math.ceil((EXPLANATION_TRAIL_DURATION_MS + 200) / 20) + 1 },
        (_, index) => getExplanationAssemblyFrame(index * 20));
    const first = timeline[0], last = timeline[timeline.length - 1];
    check(EXPLANATION_TEXT_DELAY_MS === EXPLANATION_REVEAL_START_MS + EXPLANATION_REVEAL_MS &&
        EXPLANATION_TRAIL_DURATION_MS === EXPLANATION_TEXT_DELAY_MS && EXPLANATION_FLIGHT_MS < EXPLANATION_ASSEMBLY_MS &&
        EXPLANATION_REVEAL_START_MS < EXPLANATION_ASSEMBLY_MS && EXPLANATION_ASSEMBLY_MS >= 3000 &&
        EXPLANATION_TEXT_DELAY_MS <= 4500 &&
        first.gather === 0 && first.nativeOpacity === 0 && first.dustOpacity === 1 &&
        last.gather === 1 && last.nativeOpacity === 1 && last.dustOpacity === 0 && last.yaw === 0 && last.scale === 1 &&
        timeline.every((frame, index) => Object.values(frame).every(Number.isFinite) &&
            frame.dustOpacity === 1 - frame.nativeOpacity &&
            (index * 20 > EXPLANATION_REVEAL_START_MS || frame.nativeOpacity === 0) &&
            (index * 20 < EXPLANATION_TEXT_DELAY_MS || frame.nativeOpacity === 1) &&
            (!index || (frame.gather >= timeline[index - 1].gather && frame.nativeOpacity >= timeline[index - 1].nativeOpacity))) &&
        JSON.stringify(getExplanationAssemblyFrame(Number.NaN)) === JSON.stringify(first),
    'The cloud swirls in for 3.6 s, the panel appears in place by 3.9 s and absorbs the dust, leaving no frame or dots; monotonic and NaN-safe');

    // 5.3. Детерминированное поле песчинок.
    const sources = Array.from({ length: 820 }, (_, index) => ({ x: 200 + (index * 37) % 1500, y: 120 + (index * 53) % 700 }));
    const scenarios = [
        { from: { left: 870, top: 840, width: 180, height: 40 }, to: { left: 20, top: 130, width: 384, height: 690 },
            viewport: { width: 1920, height: 900 }, count: EXPLANATION_DUST_COUNT, sources },
        { from: { left: 340, top: 760, width: 36, height: 28 }, to: { left: 7, top: 120, width: 376, height: 600 },
            viewport: { width: 390, height: 844 }, count: EXPLANATION_DUST_COUNT_COMPACT, sources: null },
        { from: { left: 270, top: 500, width: 36, height: 28 }, to: { left: 12, top: 58, width: 296, height: 420 },
            viewport: { width: 320, height: 568 }, count: EXPLANATION_DUST_COUNT_COMPACT, sources: [] },
        { from: null, to: { left: 4, top: 16, width: 20, height: 12 }, viewport: { width: 64, height: 48 }, count: 5 },
    ];
    const inputs = JSON.stringify(scenarios);
    const digest = (field: ExplanationDustField): string => JSON.stringify([field.count, field.frameCount, field.center, field.halfWidth,
        field.halfHeight, field.trigger, ...[field.originX, field.originY, field.targetX, field.targetY, field.startRadius,
            field.startAngle, field.endRadius, field.swirlAngle, field.delayMs, field.radius, field.kind].map(values => Array.from(values))]);
    const fields = scenarios.map(scenario => buildExplanationDustField(scenario));
    const outsidePanel = (point: { x: number; y: number }, bounds: { left: number; top: number; width: number; height: number }): boolean =>
        point.x <= bounds.left - 24 || point.x >= bounds.left + bounds.width + 24 ||
        point.y <= bounds.top - 24 || point.y >= bounds.top + bounds.height + 24;
    check(inputs === JSON.stringify(scenarios) && fields.every((field, index) => {
        const scenario = scenarios[index];
        const expected = Math.max(24, Math.min(2400, scenario.count));
        const bounds = scenario.to;
        const triggers = Array.from(field.kind).filter(kind => (kind & DUST_KIND_TRIGGER) !== 0).length;
        return field.count === expected && digest(field) === digest(buildExplanationDustField(scenario)) &&
            triggers === (scenario.from ? Math.round(expected * 0.1) : 0) &&
            Array.from({ length: field.count }, (_, k) => k).every(k =>
                field.targetX[k] >= bounds.left && field.targetX[k] <= bounds.left + bounds.width &&
                field.targetY[k] >= bounds.top && field.targetY[k] <= bounds.top + bounds.height &&
                Number.isFinite(field.originX[k] + field.originY[k]) && field.radius[k] > 0 && field.swirlAngle[k] > 0 &&
                field.delayMs[k] >= 0 && field.delayMs[k] + EXPLANATION_FLIGHT_MS <= EXPLANATION_ASSEMBLY_MS) &&
            (index !== 0 || Array.from({ length: field.count }, (_, k) => k)
                .filter(k => (field.kind[k] & DUST_KIND_TRIGGER) === 0)
                .every(k => sources.some(point => outsidePanel(point, bounds) &&
                    Math.hypot(point.x - field.originX[k], point.y - field.originY[k]) <= 10 + 1e-9)));
    }),
    'Desktop, phone, small and degenerate panels get deterministic grain fields: the panel frame and surface as targets, button grains and dust shed by scene particles outside the panel');

    // Рамка окна из пыли: без контура — прямоугольник с отступом волнистого края, с контуром — сам контур,
    // песчинки стоят на нём с равным шагом по длине.
    const onSegment = (point: { x: number; y: number }, polyline: readonly { x: number; y: number }[]): number =>
        Math.min(...polyline.map((a, i) => {
            const b = polyline[(i + 1) % polyline.length];
            const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy || 1;
            const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
            return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
        }));
    const rectFrame = (bounds: { left: number; top: number; width: number; height: number }): { x: number; y: number }[] => {
        const insetX = Math.min(14, bounds.width * 0.04), insetY = Math.min(16, bounds.height * 0.04);
        const left = bounds.left + insetX, top = bounds.top + insetY;
        const right = bounds.left + bounds.width - insetX, bottom = bounds.top + bounds.height - insetY;
        return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
    };
    const wavy = Array.from({ length: 160 }, (_, i) => {
        const angle = i / 160 * 2 * Math.PI;
        return { x: 212 + 180 * Math.cos(angle) + 6 * Math.sin(angle * 9), y: 475 + 330 * Math.sin(angle) };
    });
    const outlined = buildExplanationDustField({ ...scenarios[0], outline: wavy });
    const gaps = Array.from({ length: outlined.frameCount - 1 }, (_, k) =>
        Math.hypot(outlined.targetX[k + 1] - outlined.targetX[k], outlined.targetY[k + 1] - outlined.targetY[k]));
    check(fields.every((field, index) => field.frameCount === Math.round(field.count * 0.3) &&
            Array.from({ length: field.frameCount }, (_, k) => k).every(k =>
                onSegment({ x: field.targetX[k], y: field.targetY[k] }, rectFrame(scenarios[index].to)) < 1e-6)) &&
        Array.from({ length: outlined.frameCount }, (_, k) => k).every(k =>
            onSegment({ x: outlined.targetX[k], y: outlined.targetY[k] }, wavy) < 1e-6) &&
        Math.max(...gaps) < Math.min(...gaps) * 1.6 + 1e-9,
    'A third of the dust lands on the panel frame itself — the wavy SVG outline when known, else the inset rectangle — evenly spaced, the rest on its surface');

    // 5.4. Траектории: точный старт и финиш, плавные (C2) отрыв и посадка.
    const grain = { x: 0, y: 0, progress: 0 };
    const at = (field: ExplanationDustField, index: number, time: number): { x: number; y: number; progress: number } =>
        ({ ...sampleExplanationDustGrain(field, index, time, grain) });
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
    check(fields.every(field => Array.from({ length: field.count }, (_, index) => index).every(index => {
        const origin = { x: field.originX[index], y: field.originY[index] };
        const target = { x: field.targetX[index], y: field.targetY[index] };
        const delay = field.delayMs[index], landing = delay + EXPLANATION_FLIGHT_MS;
        const startPoint = at(field, index, delay), endPoint = at(field, index, EXPLANATION_ASSEMBLY_MS);
        const nearStart = (ms: number): number => distance(at(field, index, delay + ms), origin);
        const nearEnd = (ms: number): number => distance(at(field, index, landing - ms), target);
        return startPoint.progress === 0 && startPoint.x === origin.x && startPoint.y === origin.y &&
            endPoint.progress === 1 && endPoint.x === target.x && endPoint.y === target.y &&
            nearStart(4) <= nearStart(8) * 0.2 + 1e-9 && nearEnd(4) <= nearEnd(8) * 0.2 + 1e-9 &&
            Array.from({ length: 41 }, (_, step) => at(field, index, step * 100)).every(point =>
                Number.isFinite(point.x) && Number.isFinite(point.y) && point.progress >= 0 && point.progress <= 1);
    })),
    'Every grain leaves its origin and lands on its exact panel point with C2 easing and stays finite on every screen size');

    // 5.5. Вихрь в форме окна: угол вокруг центра (в нормированных координатах окна) у каждой песчинки только
    //      растёт — все крутятся в одну сторону; к середине пути пройдено меньше трети угла — главное вращение у окна.
    const flights = [fields[0], fields[1], ring, dockedField];
    const vortex = flights.every(field => Array.from({ length: field.count }, (_, index) => index).every(index => {
        const angleOf = (point: { x: number; y: number }): number =>
            Math.atan2((point.y - field.center.y) / field.halfHeight, (point.x - field.center.x) / field.halfWidth);
        const delay = field.delayMs[index];
        let unwrapped = field.startAngle[index], lastRaw = field.startAngle[index], halfway = 0;
        for (let step = 1; step <= 60; step++) {
            const point = at(field, index, delay + EXPLANATION_FLIGHT_MS * step / 60);
            const raw = angleOf(point);
            let delta = raw - lastRaw;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            if (delta < -Math.PI) delta += 2 * Math.PI;
            if (delta < -1e-9) return false;
            unwrapped += delta;
            lastRaw = raw;
            if (step === 30) halfway = unwrapped - field.startAngle[index];
        }
        return Math.abs(unwrapped - field.startAngle[index] - field.swirlAngle[index]) < 1e-6 &&
            halfway < field.swirlAngle[index] * 0.3;
    }));
    const meanDistance = (field: ExplanationDustField, time: number): number => Array.from({ length: field.count }, (_, index) => {
        const point = at(field, index, time);
        return Math.hypot(point.x - field.center.x, point.y - field.center.y);
    }).reduce((sum, value) => sum + value, 0) / field.count;
    const converges = flights.every(field => {
        const distances = [0, 900, 1800, 2700, 3600].map(time => meanDistance(field, time));
        return distances.every((value, index) => !index || value <= distances[index - 1] + 1e-9) &&
            distances[distances.length - 1] < distances[0] * 0.75;
    });
    check(vortex && converges,
    'Every grain spirals the same way around the panel, mostly at the end of its path, and the whole cloud converges on the panel');

    // 5.6. Проход основного Canvas: без сборки — ни одного вызова; полёт и рассыпание — пакеты без shadowBlur;
    //      после проявления окна холст пуст (пыль впиталась); буфер поля освобождается, когда пыль вернулась в облако.
    const calls = { save: 0, restore: 0, fill: 0, stroke: 0, drawImage: 0 };
    let shadowTouched = false, finiteDrawing = true;
    const track = (x: number, y: number): void => { finiteDrawing &&= Number.isFinite(x) && Number.isFinite(y); };
    const context = {
        canvas: undefined, globalAlpha: 1, globalCompositeOperation: 'source-over', lineCap: 'butt', lineWidth: 1,
        strokeStyle: '', fillStyle: '',
        set shadowBlur(_value: number) { shadowTouched = true; }, get shadowBlur() { return 0; },
        save: (): void => { calls.save++; }, restore: (): void => { calls.restore++; },
        beginPath: (): void => {}, closePath: (): void => {}, moveTo: track, lineTo: track,
        arc: (x: number, y: number, radius: number): void => { track(x, y); finiteDrawing &&= radius > 0; },
        rect: (x: number, y: number): void => { track(x, y); },
        fill: (): void => { calls.fill++; }, stroke: (): void => { calls.stroke++; },
        fillRect: (x: number, y: number): void => { track(x, y); calls.fill++; },
        drawImage: (): void => { calls.drawImage++; },
    } as unknown as CanvasRenderingContext2D;
    const state = new ExplanationAssemblyState();
    const ledger = { ...resourceLedger.getCounters() };
    const total = (): number => Object.values(calls).reduce((sum, value) => sum + value, 0);
    const idle = renderExplanationAssemblyPass(context, sources, 1000, state);
    const idleCalls = total();
    const token = state.begin({ ...scenarios[0], startMs: 1000 });
    const perFrame: { fill: number; stroke: number }[] = [];
    const frameAt = (nowMs: number): boolean => {
        const before = { ...calls };
        const result = renderExplanationAssemblyPass(context, sources, nowMs, state);
        perFrame.push({ fill: calls.fill - before.fill, stroke: calls.stroke - before.stroke });
        return result;
    };
    let drew = true;
    for (const time of [0, 400, 1200, 2000, 2800, 3500]) drew &&= frameAt(1000 + time);
    const callsBeforeAbsorbed = total();
    const absorbed = !frameAt(1000 + EXPLANATION_TEXT_DELAY_MS) && !frameAt(1000 + EXPLANATION_ASSEMBLY_MS + 60000) &&
        total() === callsBeforeAbsorbed && state.isActive();
    const buffersDuring = resourceLedger.getCounters().buffers;
    state.scatter(token, 90000);
    const scattering = state.getActive()?.scatterStartMs === 90000 && state.getRemainingTextDelayMs(90000) === 0 &&
        frameAt(90000) && frameAt(90000 + EXPLANATION_SCATTER_MS / 2);
    const scattered = !frameAt(90000 + EXPLANATION_SCATTER_MS);
    state.end(token);
    check(!idle && idleCalls === 0 && drew && absorbed && scattering && scattered && !shadowTouched && finiteDrawing &&
        calls.save === calls.restore && perFrame.every(frame => frame.fill <= 3 && frame.stroke <= 3) &&
        buffersDuring === ledger.buffers + 1 && resourceLedger.getCounters().buffers === ledger.buffers &&
        resourceLedger.getCounters().underflowCount === ledger.underflowCount && !state.isActive(),
    'The main-canvas pass costs nothing while idle, draws nothing once the panel has absorbed the dust, scatters it after closing and batches every frame without shadowBlur');

    // Рассыпание: песчинка раскручивается обратно к своей частице — из точки окна или с того места полёта,
    // где её застало закрытие.
    const desktopField = fields[0];
    const scatterPoint = { x: 0, y: 0, progress: 0 };
    const scatterAt = (index: number, ms: number, closedAtMs = EXPLANATION_ASSEMBLY_MS): { x: number; y: number; progress: number } =>
        ({ ...sampleExplanationDustScatter(desktopField, index, ms, closedAtMs, scatterPoint) });
    check(Array.from({ length: desktopField.count }, (_, index) => index).every(index => {
        const start = scatterAt(index, 0), end = scatterAt(index, EXPLANATION_SCATTER_MS);
        const midFlight = at(desktopField, index, 1500);
        const interrupted = scatterAt(index, 0, 1500), interruptedEnd = scatterAt(index, EXPLANATION_SCATTER_MS, 1500);
        return start.x === desktopField.targetX[index] && start.y === desktopField.targetY[index] && start.progress === 0 &&
            end.x === desktopField.originX[index] && end.y === desktopField.originY[index] && end.progress === 1 &&
            interrupted.x === midFlight.x && interrupted.y === midFlight.y &&
            interruptedEnd.x === desktopField.originX[index] && interruptedEnd.y === desktopField.originY[index] &&
            Array.from({ length: 17 }, (_, step) => [scatterAt(index, step * 100), scatterAt(index, step * 100, 1500)])
                .every(points => points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    }) && Number.isFinite(scatterAt(0, Number.NaN).x) && Number.isFinite(scatterAt(0, 100, Number.NaN).x),
    'Closing unwinds every grain back to its particle, starting exactly where the close found it, NaN-safe');

    // 5.7. Окно: проявление на месте, пыль остаётся при открытом окне и рассыпается при закрытии;
    //      прерывания, навигация и reduced motion.
    const savedGlobals = ['window', 'document', 'HTMLElement', 'Element'].map(name =>
        ({ name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name) }));
    const savedSignals = getVisualSignals();
    // Снимок сигналов восстанавливается полностью, как в разделе 4: последующие проверки видят прежний кадр.
    const publishSignals = (reduced: boolean): void => {
        const state = universeStore.getState(), audio = audioSync.getSnapshot(0), stress = stressStore.getState();
        publishVisualSignals({ ...state, currentPhase: savedSignals.phase, isPaused: savedSignals.isPaused, isTabHidden: false,
            reducedMotion: reduced, seed: savedSignals.seed, telemetry: { ...state.telemetry, tick: savedSignals.tick,
                simulationTimeSec: savedSignals.simTimeSec, frameTimeMs: savedSignals.frameDtSec * 1000,
                phaseProgress: savedSignals.phaseProgress, kuramotoOrderR: savedSignals.kuramotoR } },
        { ...audio, isPlaying: true, low: savedSignals.low, mid: savedSignals.mid, high: savedSignals.high,
            pulse: savedSignals.pulse, heartbeat: savedSignals.heartbeat }, { ...stress, globalStress: savedSignals.globalStress });
    };
    const baseline = { ...resourceLedger.getCounters() };
    const document = new DialogDocument();
    const pending = new Map<number, FrameRequestCallback>();
    let nextFrame = 0, reducedMotion = false, nowMs = 0;
    const window = Object.assign(new ListenerTarget(), {
        innerWidth: 1920, innerHeight: 900, devicePixelRatio: 1,
        getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
        matchMedia: () => ({ matches: reducedMotion }),
        requestAnimationFrame: (callback: FrameRequestCallback): number => { pending.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame: (id: number): void => { pending.delete(id); },
    });
    const trigger = document.createElement('button'), dialog = document.createElement('dialog');
    dialog.open = true; document.body.append(trigger, dialog);
    const trailState = new ExplanationAssemblyState();
    let dispose: (() => void) | undefined;
    let binding: ExplanationDialogBinding | undefined;
    const play = (): (() => void) => playExplanationTrail(trigger as unknown as HTMLElement, dialog as unknown as HTMLDialogElement,
        { state: trailState, clock: () => nowMs });
    const pump = (): void => {
        const frame = pending.entries().next().value;
        if (!frame) throw new Error('The active explanation assembly has no pending frame');
        pending.delete(frame[0]); frame[1](nowMs);
    };
    const released = (): boolean => pending.size === 0 && document.body.querySelectorAll('canvas').length === 0 &&
        window.listenerCount === 0 && document.listenerCount === 0 && dialog.dataset.entryAnimation === undefined &&
        dialog.dataset.entryStage === undefined && dialog.style.getPropertyValue('opacity') === '' &&
        dialog.style.getPropertyValue('transform') === '' && !trailState.isActive() && !explanationAssembly.isActive() &&
        resourceLedger.getCounters().buffers === baseline.buffers && resourceLedger.getCounters().listeners === baseline.listeners &&
        resourceLedger.getCounters().underflowCount === baseline.underflowCount;

    try {
        Object.defineProperties(globalThis, {
            document: { configurable: true, value: document }, window: { configurable: true, value: window },
            HTMLElement: { configurable: true, value: DialogNode }, Element: { configurable: true, value: DialogNode },
        });
        nowMs = 5000;
        dispose = play();
        const opened = trailState.isActive() && trailState.getActive()!.spec.startMs === 5000 && pending.size === 1 &&
            document.body.querySelectorAll('canvas').length === 0 && dialog.dataset.entryAnimation === 'true' &&
            dialog.dataset.entryStage === 'gathering' && dialog.style.getPropertyValue('opacity') === '0.0000' &&
            resourceLedger.getCounters().listeners === baseline.listeners + 3;
        nowMs = 6000; pump();
        const hiddenWhileGathering = dialog.style.getPropertyValue('opacity') === '0.0000' && dialog.dataset.entryStage === 'gathering';
        nowMs = 5000 + EXPLANATION_REVEAL_START_MS + EXPLANATION_REVEAL_MS / 2; pump();
        const revealingInPlace = dialog.style.getPropertyValue('opacity') === '0.5000' && dialog.dataset.entryStage === 'revealing' &&
            dialog.style.getPropertyValue('transform') === 'perspective(1000px) rotateY(-3.500deg) scale(0.99250)';
        nowMs = 5000 + EXPLANATION_TRAIL_DURATION_MS; pump();
        // Поза снята, окно полностью видно, а пыль остаётся частью открытого окна.
        const dustStays = pending.size === 0 && dialog.dataset.entryAnimation === undefined &&
            dialog.dataset.entryStage === undefined && dialog.style.getPropertyValue('opacity') === '' &&
            dialog.style.getPropertyValue('transform') === '' && trailState.isActive() &&
            trailState.getActive()!.scatterStartMs === null && resourceLedger.getCounters().listeners === baseline.listeners + 3;
        trailState.ensureField(null);
        nowMs += 700; dialog.close();
        const scatters = trailState.getActive()?.scatterStartMs === nowMs && trailState.getRemainingTextDelayMs(nowMs) === 0 &&
            resourceLedger.getCounters().listeners === baseline.listeners &&
            resourceLedger.getCounters().buffers === baseline.buffers + 1;
        trailState.reset();
        dispose(); dispose();
        dialog.open = true;
        check(opened && hiddenWhileGathering && revealingInPlace && dustStays && scatters && released(),
            'The panel stays transparent while dust gathers and turns into place, the grains stay with the open panel, closing scatters them and every listener and buffer is released');

        const interrupted: boolean[] = [];
        for (const reason of ['resize', 'hidden', 'closed', 'removed', 'dispose']) {
            nowMs = 9000; dispose = play(); nowMs = 9100; pump();
            if (reason === 'resize') dispatch(window, 'resize');
            else if (reason === 'hidden') { document.hidden = true; dispatch(document, 'visibilitychange'); }
            // Закрытие отменяет кадр позы само; без построенного поля рассыпать нечего — сборка завершается.
            else if (reason === 'closed') dialog.close();
            else if (reason === 'removed') { dialog.remove(); pump(); }
            else dispose();
            interrupted.push(released()); dispose();
            document.hidden = false; dialog.open = true;
            if (!dialog.isConnected) document.body.append(dialog);
        }
        check(interrupted.every(Boolean),
            'Resize, hidden page, native close, detached dialog and explicit disposal each stop the assembly with a fully visible panel and no leftovers');

        trigger.dataset.explainTopic = 'prng';
        const nextTrigger = document.createElement('button'); nextTrigger.dataset.explainTopic = 'fbm';
        document.body.append(nextTrigger);
        binding = mountExplanationDialog();
        const panel = document.getElementById('explanation-dialog')!;
        dispatch(document, 'click', { target: trigger });
        const firstToken = explanationAssembly.getActive()?.token;
        const firstFrame = [...pending.keys()][0];
        dispatch(document, 'click', { target: panel.querySelector('[data-explain-topic="kuramoto"]')! });
        dispatch(document, 'click', { target: panel.querySelector('[data-explanation-mode="expert"]')! });
        const internalNavigationKept = firstToken !== undefined && explanationAssembly.getActive()?.token === firstToken &&
            pending.has(firstFrame);
        dispatch(document, 'click', { target: nextTrigger });
        const externalReplayed = explanationAssembly.getActive() !== null && explanationAssembly.getActive()!.token !== firstToken &&
            !pending.has(firstFrame) && pending.size === 1 && panel.dataset.topic === 'fbm' && panel.showCount === 1;
        panel.close(); binding.dispose(); binding = undefined;
        check(internalNavigationKept && externalReplayed && document.activeElement === nextTrigger && released(),
            'External term clicks reassemble the existing panel and restore the latest trigger; internal topics and reading modes keep the current assembly');

        reducedMotion = true; play()();
        const systemReduced = released() && !trailState.isActive();
        reducedMotion = false;
        publishSignals(true);
        play()();
        const storeReduced = released();
        publishSignals(false);
        Object.defineProperty(dialog, 'getBoundingClientRect', { configurable: true,
            value: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }) });
        play()();
        check(systemReduced && storeReduced && released(),
            'System or in-app reduced motion and an unmeasurable panel skip the sand and show the window at once');
    } finally {
        binding?.dispose();
        dispose?.();
        for (const { name, descriptor } of savedGlobals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
        publishSignals(savedSignals.reducedMotion);
    }
}
// КОНЕЦ РАЗДЕЛА 5
