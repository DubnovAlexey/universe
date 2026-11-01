// ============================================================================
// ФАЙЛ: frontend/src/tests/hudDom.test.ts
// НАЗНАЧЕНИЕ: Регрессии HUD: место визитки при скрытом доке (BUG-15), состояния переключателей
//             для экранного диктора (BUG-10), выбор панелей при пересечении 920 px (BUG-13)
//             и честные подписи реестра модулей (BUG-08).
// РАЗДЕЛЫ: 1. Минимальные элементы; 2. Отступы доков; 3. aria-pressed и aria-current; 4. Выбор панелей;
//          5. Подписи реестра.
// ФУНКЦИИ: makeElement, withGlobals, runHudDomChecks.
// ============================================================================
import { bindHudDockLayout, syncHudDomWithState } from '../engine/hud/hudDomOrchestrator';
import { universeStore, type PhaseId } from '../store/universeState';
import {
    getModuleDisplayStatus, integrationRegistry, type ModuleRuntimeState, type PolyglotModuleId,
} from '../core/integrationRegistry';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЕ ЭЛЕМЕНТЫ
interface MockElement {
    rect: { top: number; bottom: number; width: number; height: number };
    readonly attributes: Map<string, string>;
    readonly classes: Set<string>;
    writes: number;
    readonly dataset: Record<string, string>;
    readonly classList: { toggle: (name: string, on: boolean) => void };
    getBoundingClientRect(): { top: number; bottom: number; left: number; right: number; width: number; height: number };
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
}

// НАЧАЛО ФУНКЦИИ makeElement
function makeElement(attributes: Record<string, string> = {}): MockElement {
    const element: MockElement = {
        rect: { top: 0, bottom: 0, width: 0, height: 0 },
        attributes: new Map(Object.entries(attributes)),
        classes: new Set<string>(),
        writes: 0,
        dataset: {},
        classList: { toggle: (name, on) => { if (on) element.classes.add(name); else element.classes.delete(name); } },
        getBoundingClientRect: () => ({ ...element.rect, left: 0, right: element.rect.width }),
        getAttribute: (name) => element.attributes.get(name) ?? null,
        hasAttribute: (name) => element.attributes.has(name),
        setAttribute: (name, value) => { element.attributes.set(name, value); element.writes++; },
        removeAttribute: (name) => { element.attributes.delete(name); element.writes++; },
    };
    return element;
}
// КОНЕЦ ФУНКЦИИ makeElement

// НАЧАЛО ФУНКЦИИ withGlobals
/** Подменяет window/document/ResizeObserver на время проверки и всегда возвращает прежние. */
function withGlobals(values: Record<string, unknown>, run: () => void): void {
    const saved = Object.keys(values).map(name => ({ name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name) }));
    try {
        for (const [name, value] of Object.entries(values)) Object.defineProperty(globalThis, name, { configurable: true, value });
        run();
    } finally {
        for (const { name, descriptor } of saved) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    }
}
// КОНЕЦ ФУНКЦИИ withGlobals
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ runHudDomChecks
export function runHudDomChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. ОТСТУПЫ ДОКОВ (BUG-15)
    const dock = makeElement(), header = makeElement();
    const rootStyles = new Map<string, string>();
    const root = { style: {
        getPropertyValue: (name: string) => rootStyles.get(name) ?? '',
        setProperty: (name: string, value: string) => { rootStyles.set(name, value); },
        removeProperty: (name: string) => { rootStyles.delete(name); },
    } };
    let observed: (() => void) | null = null;
    class ResizeObserverMock {
        public constructor(callback: () => void) { observed = callback; }
        public observe(): void {}
        public disconnect(): void {}
    }
    const insets: string[] = [];
    withGlobals({
        window: { innerHeight: 800 },
        ResizeObserver: ResizeObserverMock,
        document: { documentElement: root, querySelector: (selector: string) =>
            selector === '.hud-bottom-bar' ? dock : selector === '.brand-card' ? header : null },
    }, () => {
        dock.rect = { top: 700, bottom: 760, width: 600, height: 60 };
        header.rect = { top: 8, bottom: 60, width: 400, height: 52 };
        bindHudDockLayout();
        insets.push(`${rootStyles.get('--hud-bottom-inset')}|${rootStyles.get('--hud-top-inset')}`);
        // Режим без HUD: display: none даёт нулевую рамку у дока и верхней плашки.
        dock.rect = { top: 0, bottom: 0, width: 0, height: 0 };
        header.rect = { top: 0, bottom: 0, width: 0, height: 0 };
        observed?.();
        insets.push(`${rootStyles.get('--hud-bottom-inset')}|${rootStyles.get('--hud-top-inset')}`);
        dock.rect = { top: 690, bottom: 760, width: 600, height: 70 };
        header.rect = { top: 8, bottom: 60, width: 400, height: 52 };
        observed?.();
        insets.push(`${rootStyles.get('--hud-bottom-inset')}|${rootStyles.get('--hud-top-inset')}`);
    });
    check(insets.join(',') === '112px|72px,env(safe-area-inset-bottom, 0px)|env(safe-area-inset-top, 0px),122px|72px',
        'A hidden bottom dock or header reserves only the device safe area instead of the whole viewport, so the finale card stays on screen');
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. aria-pressed И aria-current (BUG-10)
    const UniverseStore = universeStore.constructor as new () => typeof universeStore;
    const store = new UniverseStore();
    store.setPhase('02_GENESIS');
    const phases: PhaseId[] = ['01_VOID', '02_GENESIS', '03_EVOLUTION', '04_COLLAPSE', '05_SINGULARITY'];
    const phaseButtons = phases.map(id => makeElement({ 'data-phase-id': id }));
    const toggles: Record<string, MockElement> = {
        'btn-toggle-metrics': makeElement(), 'btn-toggle-topology': makeElement(),
        'btn-toggle-terminal': makeElement(), 'btn-toggle-xray': makeElement(),
    };
    let secondPassWrites = -1;
    withGlobals({
        document: {
            getElementById: (id: string) => toggles[id] ?? null,
            querySelectorAll: (selector: string) => selector.includes('data-phase-id') ? phaseButtons : [],
        },
    }, () => {
        syncHudDomWithState(store.getState());
        const writesBefore = [...phaseButtons, ...Object.values(toggles)].reduce((sum, element) => sum + element.writes, 0);
        syncHudDomWithState(store.getState());
        secondPassWrites = [...phaseButtons, ...Object.values(toggles)].reduce((sum, element) => sum + element.writes, 0) - writesBefore;
    });
    const layers = store.getState().layers;
    check(phaseButtons.every((button, index) => (button.getAttribute('aria-current') === 'step') === (phases[index] === '02_GENESIS') &&
            button.classes.has('active') === (phases[index] === '02_GENESIS')) &&
        toggles['btn-toggle-metrics'].getAttribute('aria-pressed') === String(layers.layer2_metricsHud) &&
        toggles['btn-toggle-topology'].getAttribute('aria-pressed') === String(layers.layer3_topologyGraph) &&
        toggles['btn-toggle-terminal'].getAttribute('aria-pressed') === String(layers.layer4_architectTerminal) &&
        toggles['btn-toggle-xray'].getAttribute('aria-pressed') === String(layers.layer5_truthXRayMode) &&
        Object.values(toggles).every(toggle => toggle.classes.has('active-toggle') === (toggle.getAttribute('aria-pressed') === 'true')) &&
        secondPassWrites === 0,
    'The current phase carries aria-current="step" and every panel toggle exposes aria-pressed matching its highlight; an unchanged state writes no attributes');
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. ВЫБОР ПАНЕЛЕЙ ПРИ ПЕРЕСЕЧЕНИИ 920 PX (BUG-13)
    const panels = (): string => {
        const { layer2_metricsHud, layer3_topologyGraph, layer4_architectTerminal } = store.getState().layers;
        return [layer2_metricsHud, layer3_topologyGraph, layer4_architectTerminal].map(Number).join('');
    };
    const wideDefault = panels();
    store.toggleLayer('layer3_topologyGraph');                // широкий режим: посетитель закрыл топологию
    store.syncViewportLayoutMode(390);
    const compactFirst = panels();                            // первый вход в узкий режим: значения по умолчанию
    store.toggleLayer('layer2_metricsHud');                   // узкий режим: посетитель открыл метрики
    store.syncViewportLayoutMode(1440);
    const wideAgain = panels();
    store.syncViewportLayoutMode(390);
    const compactAgain = panels();
    check(wideDefault === '111' && compactFirst === '000' && wideAgain === '101' && compactAgain === '100',
        'Crossing 920 px keeps the visitor panel choice separately for narrow and wide layouts; defaults apply only on the first entry');
    // КОНЕЦ РАЗДЕЛА 4

    // НАЧАЛО РАЗДЕЛА 5. ЧЕСТНЫЕ ПОДПИСИ РЕЕСТРА (BUG-08)
    const record = (id: PolyglotModuleId, status: ModuleRuntimeState) =>
        getModuleDisplayStatus({ ...integrationRegistry.getModule(id)!, status }).label;
    const modules = integrationRegistry.getAllModules();
    check(modules.length === 8 && modules.every(module => ['runtime', 'ci-only', 'local-only'].includes(module.availability)) &&
        record('pyodide-graph', 'fallback') === 'CI ✓' && record('server-ws', 'inactive') === 'LOCAL' &&
        record('server-ws', 'ready') === 'READY' && record('webgpu-render', 'inactive') === 'STANDBY' &&
        record('webgpu-render', 'fallback') === 'FALLBACK' && record('webgpu-render', 'ready') === 'READY' &&
        record('wasm-physics', 'fallback') === 'FALLBACK',
    'The registry table labels CI-only Python parity as CI ✓, the local Python server as LOCAL and pre-phase-05 WebGPU as STANDBY, while real fallbacks stay visible');
    // КОНЕЦ РАЗДЕЛА 5
}
// КОНЕЦ ФУНКЦИИ runHudDomChecks
