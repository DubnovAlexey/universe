// ============================================================================
// ФАЙЛ: frontend/src/tests/waterfallLifecycle.test.ts
// НАЗНАЧЕНИЕ: Проверить кеш DOM, каскады телеметрии и редкий фон объяснений.
// РАЗДЕЛЫ: 1. Минимальные DOM-привязки; 2. Общий кадр; 3. Каскад объяснений.
// ФУНКЦИИ: makeCascade, runWaterfallLifecycleChecks, runExplanationWaterfallChecks.
// ============================================================================
import { TelemetryWaterfallAnimator, setHudText } from '../layers/Layer2_Metrics';
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
    let text = '', textWrites = 0;
    const label = { get textContent(): string { return text; }, set textContent(value: string) { text = value; textWrites++; } } as HTMLElement;
    setHudText(label, 'READY');
    for (let i = 0; i < 120; i++) setHudText(label, 'READY');
    setHudText(label, 'FALLBACK');
    setHudText(null, 'READY');
    check(textWrites === 2 && text === 'FALLBACK',
        'Repeated unchanged telemetry retains its text node while real status changes appear immediately');
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

    runExplanationWaterfallChecks(check);
}
// КОНЕЦ ФУНКЦИИ runWaterfallLifecycleChecks
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. РЕДКИЙ КАСКАД ОБЪЯСНЕНИЙ
// НАЧАЛО ФУНКЦИИ runExplanationWaterfallChecks
function runExplanationWaterfallChecks(check: (passed: boolean, description: string) => void): void {
    let nowSec = 0;
    const baselineFrame: { listener: ((snapshot: Readonly<VisualSignalSnapshot>) => void) | null } = { listener: null };
    const guideFrame: { listener: ((snapshot: Readonly<VisualSignalSnapshot>) => void) | null;
        subscriptions: number; releases: number } = { listener: null, subscriptions: 0, releases: 0 };
    const baseline = new TelemetryWaterfallAnimator((listener) => {
        baselineFrame.listener = listener;
        return () => { baselineFrame.listener = null; };
    });
    const guide = new TelemetryWaterfallAnimator((listener) => {
        guideFrame.listener = listener;
        guideFrame.subscriptions++;
        return () => { guideFrame.listener = null; guideFrame.releases++; };
    });
    guide.getTimeSec = () => nowSec;
    const baseRoots = [makeCascade(), makeCascade(), makeCascade()];
    const guideRoots = [makeCascade(), makeCascade(), makeCascade()];
    ([2, 3, 4] as const).forEach((id, index) => {
        baseline.bindCascade(id, baseRoots[index].root);
        guide.bindCascade(id, guideRoots[index].root);
    });
    const reader = makeCascade();
    const kicker = new WaterfallNode(reader.counters);
    const title = new WaterfallNode(reader.counters);
    const paragraph = new WaterfallNode(reader.counters);
    kicker.attributes.set('data-breath-slot', 'l5_explain_kicker');
    kicker.attributes.set('data-breath-seed', '0.4');
    title.attributes.set('data-breath-slot', 'l5_explain_title');
    title.attributes.set('data-breath-seed', '1.1');
    reader.node.selectors.set('[data-breath-slot]', [kicker, title]);
    guide.bindCascade(5, reader.root);
    const boundQueries = reader.counters.queries;
    const snapshot = { ...getVisualSignals(), frameDtSec: 0.05, isPaused: false, reducedMotion: false,
        pulse: 0.4, low: 0.3 };
    const seenGuide = new Set<number>();
    const seenRight = new Set<number>();
    const spawnTimes: number[] = [];
    let rightUnchanged = true;
    let bounded = true;
    let quietStart = true;
    let gentleHeadings = false;
    for (let frame = 0; frame <= 600; frame++) {
        nowSec = frame * 0.05;
        const signal = { ...snapshot, simTimeSec: nowSec };
        baselineFrame.listener?.(signal);
        guideFrame.listener?.(signal);
        const drops = guide.getDropletsForCascade(5);
        if (nowSec < 2 && drops.length) quietStart = false;
        bounded = bounded && drops.length <= 2 && drops.every((drop) => drop.opacity <= 0.3 && drop.maxLife <= 2.181);
        for (const drop of drops) {
            if (!seenGuide.has(drop.id)) { seenGuide.add(drop.id); spawnTimes.push(nowSec); }
        }
        for (const drop of guide.getDropletsForCascade(2)) seenRight.add(drop.id);
        for (const id of [2, 3, 4] as const) {
            rightUnchanged = rightUnchanged && JSON.stringify(guide.getDropletsForCascade(id)) ===
                JSON.stringify(baseline.getDropletsForCascade(id));
        }
        if (frame === 10) {
            const normal = guide.computeSlotBreathCss('l5_explain_title', 1.1, nowSec);
            const readTransform = (value: string): number[] => Array.from(value.matchAll(/-?\d+(?:\.\d+)?/g), (match) => Number(match[0]));
            const quiet = readTransform(title.style.transform);
            const full = readTransform(normal.transform);
            // translate3d contributes its own digit before the coordinate and scale values.
            gentleHeadings = Math.abs(quiet[2] - full[2] * 0.22) <= 0.011 &&
                Math.abs((quiet[4] - 1) - (full[4] - 1) * 0.22) <= 0.00011;
        }
    }
    check(guideFrame.subscriptions === 1 && reader.counters.queries === boundQueries,
        'Explanation starfall joins the existing shared frame and keeps its DOM binding cache');
    check(quietStart && spawnTimes[0] === 2 && spawnTimes.length >= 3 &&
        spawnTimes.every((time, index) => index === 0 || time - spawnTimes[index - 1] >= 1.85) &&
        seenGuide.size < seenRight.size / 2 && bounded,
        'Explanation starfall waits two seconds, falls rarely at low opacity and keeps at most two short-lived symbols');
    check(rightUnchanged,
        'Opening explanation starfall preserves the cadence, glyph sequence and trajectories of cascades 2–4');
    check(gentleHeadings && JSON.stringify(paragraph.style) === '{}' && kicker.style.color === '#e0f2fe',
        'Explanation headings breathe at a gentle fraction of telemetry motion while paragraphs remain untouched');

    const frozen = JSON.stringify(reader.counters);
    const frozenWrites = reader.counters.writes;
    const frozenQueries = reader.counters.queries;
    const frozenDrops = JSON.stringify(guide.getDropletsForCascade(5));
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 1, isPaused: true, frameDtSec: 0 });
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 2, reducedMotion: true });
    check(JSON.stringify(reader.counters) === frozen && JSON.stringify(guide.getDropletsForCascade(5)) === frozenDrops,
        'Manual pause and reduced motion freeze explanation symbols and headings without DOM work');
    reader.node.hidden = true;
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 3 });
    check(reader.counters.writes === frozenWrites && reader.counters.queries === frozenQueries &&
        JSON.stringify(guide.getDropletsForCascade(5)) === frozenDrops,
        'A hidden explanation root freezes only its own cached symbols');
    guide.releaseCascade(5, reader.root);
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 4 });
    check(guide.getDropletsForCascade(5).length === 0 && guideFrame.releases === 0 &&
        reader.counters.writes === frozenWrites && reader.counters.queries === frozenQueries,
        'Closing explanation starfall releases its drops while telemetry retains the shared subscription');

    nowSec += 5;
    const reopened = makeCascade();
    guide.bindCascade(5, reopened.root);
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 1.9 });
    const quietReopen = guide.getDropletsForCascade(5).length === 0;
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 2 });
    const resumed = guide.getDropletsForCascade(5).length > 0;
    reopened.node.isConnected = false;
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 2.05 });
    check(quietReopen && resumed && guide.getDropletsForCascade(5).length === 0 && guideFrame.releases === 0,
        'Reopening resets the quiet entrance and detaching the guide clears its symbols without stopping telemetry');
    ([2, 3, 4] as const).forEach((id, index) => {
        baseline.releaseCascade(id, baseRoots[index].root);
        guide.releaseCascade(id, guideRoots[index].root);
    });
    check(guideFrame.releases === 1 && guideFrame.listener === null,
        'The final shared cascade release unsubscribes exactly once after explanation open and detach');
    const isolated = makeCascade();
    guide.bindCascade(5, isolated.root);
    isolated.node.isConnected = false;
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 3 });
    check(guideFrame.subscriptions === 2 && guideFrame.releases === 2 && guideFrame.listener === null,
        'An isolated explanation root releases the shared frame when removed from the page');
}
// КОНЕЦ ФУНКЦИИ runExplanationWaterfallChecks
// КОНЕЦ РАЗДЕЛА 3
