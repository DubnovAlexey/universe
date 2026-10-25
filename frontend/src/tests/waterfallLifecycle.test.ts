// ============================================================================
// ФАЙЛ: frontend/src/tests/waterfallLifecycle.test.ts
// НАЗНАЧЕНИЕ: Проверить кеш DOM и остановку реального контроллера водопада.
// РАЗДЕЛЫ: 1. Минимальные DOM-привязки; 2. Общий кадр и жизненный цикл каскадов.
// ФУНКЦИИ: makeCascade, runWaterfallLifecycleChecks.
// ============================================================================
import { TelemetryWaterfallAnimator } from '../layers/Layer2_Metrics';
import { getVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЙ DOM-КОНТРАКТ
interface DomCounters { queries: number; reads: number; writes: number; }
class WaterfallNode {
    public isConnected = true;
    public hidden = false;
    public className = '';
    public parent: WaterfallNode | null = null;
    public attributes = new Map<string, string>();
    public selectors = new Map<string, WaterfallNode[]>();
    private text = '';
    public style: Record<string, string>;
    public classList = {
        contains: (_name: string): boolean => { this.counters.reads++; return this.hidden; },
    };
    public ownerDocument = {
        createElement: (_tag: string): WaterfallNode => {
            this.counters.writes++;
            return new WaterfallNode(this.counters);
        },
    };

    // НАЧАЛО ФУНКЦИИ constructor
    public constructor(public readonly counters: DomCounters) {
        this.style = new Proxy<Record<string, string>>({}, {
            set: (target, property: string, value: string): boolean => {
                this.counters.writes++;
                target[property] = value;
                return true;
            },
        });
    }
    // КОНЕЦ ФУНКЦИИ constructor
    // НАЧАЛО ФУНКЦИИ textContent
    public get textContent(): string { this.counters.reads++; return this.text; }
    public set textContent(value: string) { this.counters.writes++; this.text = value; }
    // КОНЕЦ ФУНКЦИИ textContent
    // НАЧАЛО ФУНКЦИИ querySelectorAll
    public querySelectorAll(selector: string): WaterfallNode[] {
        this.counters.queries++;
        return this.selectors.get(selector) ?? [];
    }
    // КОНЕЦ ФУНКЦИИ querySelectorAll
    // НАЧАЛО ФУНКЦИИ getAttribute
    public getAttribute(name: string): string | undefined {
        this.counters.reads++;
        return this.attributes.get(name);
    }
    // КОНЕЦ ФУНКЦИИ getAttribute
    // НАЧАЛО ФУНКЦИИ setAttribute
    public setAttribute(name: string, value: string): void {
        this.counters.writes++;
        this.attributes.set(name, value);
    }
    // КОНЕЦ ФУНКЦИИ setAttribute
    // НАЧАЛО ФУНКЦИИ appendChild
    public appendChild(child: WaterfallNode): void { this.counters.writes++; child.parent = this; }
    // КОНЕЦ ФУНКЦИИ appendChild
    // НАЧАЛО ФУНКЦИИ remove
    public remove(): void { this.counters.writes++; this.parent = null; }
    // КОНЕЦ ФУНКЦИИ remove
}

// НАЧАЛО ФУНКЦИИ makeCascade
function makeCascade(hidden = false): { node: WaterfallNode; root: HTMLElement; counters: DomCounters } {
    const counters = { queries: 0, reads: 0, writes: 0 };
    const node = new WaterfallNode(counters);
    node.hidden = hidden;
    ['path[data-breach-contour]', 'path[data-breach-wave-line]', '.waterfall-stream-overlay',
        '[data-breath-slot]', '.starfall-drops-layer[data-cascade-drops]'].forEach((selector) => {
        node.selectors.set(selector, [new WaterfallNode(counters)]);
    });
    return { node, root: node as unknown as HTMLElement, counters };
}
// КОНЕЦ ФУНКЦИИ makeCascade
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ОБЩИЙ КАДР И СНЯТИЕ КАСКАДОВ
// НАЧАЛО ФУНКЦИИ runWaterfallLifecycleChecks
export function runWaterfallLifecycleChecks(check: (passed: boolean, description: string) => void): void {
    const shared: { listener: ((snapshot: Readonly<VisualSignalSnapshot>) => void) | null;
        subscriptions: number; releases: number } = { listener: null, subscriptions: 0, releases: 0 };
    const animator = new TelemetryWaterfallAnimator((listener) => {
        shared.listener = listener;
        shared.subscriptions++;
        return () => { shared.listener = null; shared.releases++; };
    });
    const first = makeCascade();
    const second = makeCascade(true);
    const snapshot = { ...getVisualSignals(), simTimeSec: 2, frameDtSec: 0.016,
        isPaused: false, reducedMotion: false, pulse: 0.4, low: 0.3 };
    animator.bindCascade(2, first.root);
    animator.bindCascade(3, second.root);
    const boundQueries = first.counters.queries + second.counters.queries;
    check(shared.subscriptions === 1 && boundQueries > 0,
        'Waterfall cascades share one frame subscription and collect DOM bindings only on mount');

    shared.listener?.(snapshot);
    check(first.counters.writes > 0 && second.counters.writes === 0 &&
        animator.getDropletsForCascade(2).length > 0 && animator.getDropletsForCascade(3).length === 0 &&
        first.counters.queries + second.counters.queries === boundQueries,
        'Visible waterfall updates cached bindings and spawns drops without querying or animating hidden cascades');

    const frozenFirst = { ...first.counters };
    const frozenSecond = { ...second.counters };
    shared.listener?.({ ...snapshot, isPaused: true, frameDtSec: 0, simTimeSec: 2.2 });
    check(JSON.stringify(first.counters) === JSON.stringify(frozenFirst) &&
        JSON.stringify(second.counters) === JSON.stringify(frozenSecond),
        'Paused or hidden shared frames perform zero waterfall DOM reads, writes or queries');

    shared.listener?.({ ...snapshot, reducedMotion: true, simTimeSec: 2.4 });
    check(JSON.stringify(first.counters) === JSON.stringify(frozenFirst) &&
        JSON.stringify(second.counters) === JSON.stringify(frozenSecond),
        'Reduced motion performs zero waterfall DOM work');

    first.node.hidden = true;
    const priorDropCount = animator.getDropletsForCascade(2).length;
    shared.listener?.({ ...snapshot, simTimeSec: 4 });
    check(first.counters.writes === frozenFirst.writes && second.counters.writes === 0 &&
        first.counters.queries + second.counters.queries === boundQueries &&
        animator.getDropletsForCascade(2).length === priorDropCount,
        'All hidden waterfall panels freeze DOM updates and spawning without layout or selector queries');

    second.node.hidden = false;
    shared.listener?.({ ...snapshot, simTimeSec: 5 });
    check(second.counters.writes > 0 && first.counters.writes === frozenFirst.writes &&
        animator.getDropletsForCascade(3).length > 0 &&
        first.counters.queries + second.counters.queries === boundQueries,
        'Revealing one cascade resumes its existing animation while other hidden bindings stay idle');

    animator.releaseCascade(3, second.root);
    const retainedSubscription = shared.releases === 0;
    animator.releaseCascade(2, first.root);
    check(retainedSubscription && shared.releases === 1 && shared.listener === null,
        'Releasing the final waterfall root unsubscribes the shared frame exactly once');

    first.node.isConnected = false;
    animator.bindCascade(2, first.root);
    shared.listener?.({ ...snapshot, simTimeSec: 6 });
    check(shared.subscriptions === 2 && shared.releases === 2 && shared.listener === null,
        'An externally removed waterfall root releases its cache and shared frame subscription');
}
// КОНЕЦ ФУНКЦИИ runWaterfallLifecycleChecks
// КОНЕЦ РАЗДЕЛА 2
