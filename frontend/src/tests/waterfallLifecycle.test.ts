// ============================================================================
// ФАЙЛ: frontend/src/tests/waterfallLifecycle.test.ts
// НАЗНАЧЕНИЕ: Проверить кеш DOM, равноправные каскады и неподвижный читаемый текст.
// РАЗДЕЛЫ: 1. Минимальные DOM-привязки; 2. Общий кадр; 3. Каскад объяснений;
//          4. Плавное свечение без движения текста; 5. Размер контура без чтений кадра.
// ФУНКЦИИ: makeCascade, runWaterfallLifecycleChecks, runExplanationWaterfallChecks,
//          runStableTextChecks, runResizedContourChecks.
// ============================================================================
import { TelemetryWaterfallAnimator, buildLivingBreachContourPath, setHudText, type StarfallDroplet } from '../layers/Layer2_Metrics';
import { getVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЙ DOM-КОНТРАКТ
interface DomCounters { queries: number; reads: number; writes: number; }
class WaterfallNode {
    public isConnected = true;
    public hidden = false;
    public className = '';
    public parent: WaterfallNode | null = null;
    public ownerSVGElement: WaterfallNode | null = null;
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
    public get clientWidth(): number { this.counters.reads++; return 418; }
    public get clientHeight(): number { this.counters.reads++; return 280; }
    public getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
        this.counters.reads++;
        return { left: 0, top: 0, width: 418, height: 280 };
    }
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
    runStableTextChecks(check);
    runResizedContourChecks(check);
}
// КОНЕЦ ФУНКЦИИ runWaterfallLifecycleChecks
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ОБЩИЙ ЗВЕЗДОПАД ОБЪЯСНЕНИЙ И ТЕЛЕМЕТРИИ
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
    let stationaryHeadings = true;
    let sameInitialSpawn = false;
    const spawnProfile = (drop: StarfallDroplet | undefined): string => drop ? JSON.stringify({
        glyph: drop.glyph, opacity: drop.opacity, velocity: drop.velocityPx, life: drop.life, maxLife: drop.maxLife,
        x: drop.xPercent, y: drop.startYPercent, offset: drop.yOffsetPx, scale: drop.scale,
    }) : '';
    for (let frame = 0; frame <= 600; frame++) {
        nowSec = frame * 0.05;
        const signal = { ...snapshot, simTimeSec: nowSec };
        baselineFrame.listener?.(signal);
        guideFrame.listener?.(signal);
        const drops = guide.getDropletsForCascade(5);
        if (nowSec < 0.5 && drops.length) quietStart = false;
        bounded = bounded && drops.every((drop) => drop.opacity >= 0 && drop.opacity <= 0.86 && drop.maxLife <= 2.181);
        for (const drop of drops) {
            if (!seenGuide.has(drop.id)) { seenGuide.add(drop.id); spawnTimes.push(nowSec); }
        }
        for (const drop of guide.getDropletsForCascade(2)) seenRight.add(drop.id);
        for (const id of [2, 3, 4] as const) {
            rightUnchanged = rightUnchanged && JSON.stringify(guide.getDropletsForCascade(id)) ===
                JSON.stringify(baseline.getDropletsForCascade(id));
        }
        stationaryHeadings &&= title.style.transform === 'none' && kicker.style.transform === 'none' &&
            title.style.color === '#e0f2fe' && kicker.style.color === '#e0f2fe';
        if (frame === 10) sameInitialSpawn = drops[0]?.opacity > 0.8 &&
            spawnProfile(drops[0]) === spawnProfile(guide.getDropletsForCascade(2)[0]);
    }
    check(guideFrame.subscriptions === 1 && reader.counters.queries === boundQueries,
        'Explanation starfall joins the existing shared frame and keeps its DOM binding cache');
    check(quietStart && spawnTimes[0] === 0.5 && sameInitialSpawn &&
        spawnTimes.every((time, index) => index === 0 ||
            (time - spawnTimes[index - 1] >= 0.58 && time - spawnTimes[index - 1] <= 1.551)) &&
        seenGuide.size >= seenRight.size * 0.65 && seenGuide.size <= seenRight.size * 1.5 && bounded,
        'Explanation symbols share the right cascade first-spawn timing, glyph physics, full opacity and normal cadence');
    check(rightUnchanged,
        'Opening explanation starfall preserves the cadence, glyph sequence and trajectories of cascades 2–4');
    check(stationaryHeadings && JSON.stringify(paragraph.style) === '{}',
        'Explanation headings retain their position, scale and pearl color while paragraphs remain untouched');

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
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 0.45 });
    const quietReopen = guide.getDropletsForCascade(5).length === 0;
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 0.5 });
    const resumed = guide.getDropletsForCascade(5).length > 0;
    reopened.node.isConnected = false;
    guideFrame.listener?.({ ...snapshot, simTimeSec: nowSec + 0.55 });
    check(quietReopen && resumed && guide.getDropletsForCascade(5).length === 0 && guideFrame.releases === 0,
        'Reopening uses the normal half-second entrance and detaching the guide clears its symbols without stopping telemetry');
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

// НАЧАЛО РАЗДЕЛА 4. ПЛАВНОЕ СВЕЧЕНИЕ БЕЗ ДВИЖЕНИЯ ТЕКСТА
function runStableTextChecks(check: (passed: boolean, description: string) => void): void {
    const shared: { listener: ((snapshot: Readonly<VisualSignalSnapshot>) => void) | null } = { listener: null };
    const animator = new TelemetryWaterfallAnimator(listener => {
        shared.listener = listener;
        return () => { shared.listener = null; };
    });
    const ids = [2, 3, 4, 5] as const;
    const roots = ids.map(id => {
        const root = makeCascade();
        const heading = root.node.selectors.get('[data-breath-slot]')![0];
        heading.attributes.set('data-breath-slot', `l${id}_title`);
        heading.attributes.set('data-breath-seed', String(id * 0.3));
        animator.bindCascade(id, root.root);
        return { ...root, heading };
    });
    const previous = new Map<WaterfallNode, { blur: number; alpha: number }>();
    const shadows = new Set<string>();
    let stable = true, smooth = true;
    for (let frame = 0; frame < 360; frame++) {
        const simTimeSec = frame < 120 ? frame / 60 : frame < 240 ? 80 + (frame - 120) / 60 : (frame - 240) / 60;
        shared.listener?.({ ...getVisualSignals(), frameDtSec: 1 / 60, simTimeSec,
            isPaused: false, reducedMotion: false, pulse: frame % 80 < 40 ? 1 : 0, low: frame % 100 < 50 ? 1 : 0 });
        for (const { heading } of roots) {
            stable &&= heading.style.transform === 'none' && heading.style.color === '#e0f2fe';
            const blur = Number(/([\d.]+)px/u.exec(heading.style.textShadow)?.[1]);
            const alpha = Number(/, ([\d.]+)\)$/u.exec(heading.style.textShadow)?.[1]);
            const last = previous.get(heading);
            smooth &&= Number.isFinite(blur) && Number.isFinite(alpha) &&
                (!last || (Math.abs(blur - last.blur) <= 0.301 && Math.abs(alpha - last.alpha) <= 0.021));
            previous.set(heading, { blur, alpha }); shadows.add(heading.style.textShadow);
        }
    }
    check(stable && smooth && shadows.size > 20,
        'Every panel keeps text position, scale and color stable while its glow changes smoothly through symbol births, phase-clock jumps and abrupt music inputs');
    roots.forEach(({ root }, index) => animator.releaseCascade(ids[index], root));
}
// КОНЕЦ РАЗДЕЛА 4

// НАЧАЛО РАЗДЕЛА 5. РАЗМЕР КОНТУРА БЕЗ ЧТЕНИЙ КАДРА
function runResizedContourChecks(check: (passed: boolean, description: string) => void): void {
    let nowSec = 0;
    const shared: { listener: ((snapshot: Readonly<VisualSignalSnapshot>) => void) | null } = { listener: null };
    const animator = new TelemetryWaterfallAnimator(listener => {
        shared.listener = listener;
        return () => { shared.listener = null; };
    });
    animator.getTimeSec = () => nowSec;
    const ids = [2, 3, 4, 5] as const;
    const roots = ids.map(id => {
        const root = makeCascade();
        const contour = root.node.selectors.get('path[data-breach-contour]')![0];
        const svg = new WaterfallNode(root.counters);
        svg.attributes.set('viewBox', '0 0 418 280');
        contour.ownerSVGElement = svg;
        animator.bindCascade(id, root.root);
        return { ...root, contour, svg };
    });
    const reader = roots[3];
    const total = (key: keyof DomCounters): number => roots.reduce((sum, root) => sum + root.counters[key], 0);
    const boundQueries = total('queries');
    const inside = (path: string | undefined, width: number, height: number): boolean => {
        const coordinates = path?.match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
        const xs = coordinates.filter((_value, index) => index % 2 === 0);
        const ys = coordinates.filter((_value, index) => index % 2 === 1);
        return coordinates.length > 8 && coordinates.every(Number.isFinite) &&
            xs.every(x => x >= 0 && x <= width) && ys.every(y => y >= 0 && y <= height) &&
            Math.min(...xs) < 24 && Math.max(...xs) > width - 24 &&
            Math.min(...ys) < 18 && Math.max(...ys) > height - 18;
    };
    const snapshot = { ...getVisualSignals(), frameDtSec: 0.05, isPaused: false, reducedMotion: false, low: 1, pulse: 0.4 };
    let fits = true, defaultsUnchanged = true, cachedOnly = true;
    try {
        for (const [width, height] of [[257, 832], [508, 832], [245, 704], [144, 88]]) {
            const beforeResizeReads = total('reads');
            animator.resizeCascadeContour(5, width, height);
            cachedOnly &&= total('reads') === beforeResizeReads && total('queries') === boundQueries;
            fits &&= reader.svg.attributes.get('viewBox') === `0 0 ${width} ${height}` &&
                inside(reader.contour.attributes.get('d'), width, height);
            for (let frame = 0; frame < 90; frame++) {
                nowSec += 0.05;
                const beforeFrameReads = total('reads');
                shared.listener?.({ ...snapshot, simTimeSec: nowSec });
                cachedOnly &&= total('reads') === beforeFrameReads + roots.length && total('queries') === boundQueries;
                fits &&= inside(reader.contour.attributes.get('d'), width, height);
                for (let index = 0; index < 3; index++) {
                    defaultsUnchanged &&= roots[index].svg.attributes.get('viewBox') === '0 0 418 280' &&
                        roots[index].contour.attributes.get('d') === buildLivingBreachContourPath(418, 280, nowSec, index * 1.25, snapshot.low);
                }
            }
        }
        check(fits && defaultsUnchanged && cachedOnly,
            'Resized narrow and tall explanation contours stay inside their physical SVG bounds with fixed pixel wave amplitudes; frames use cached dimensions and preserve default right contours without geometry reads or extra selectors');

        const unchanged = JSON.stringify(roots.map(root => root.counters));
        for (const [width, height] of [[144, 88], [0, 832], [-1, 832], [257, 0], [Number.NaN, 832], [257, Number.POSITIVE_INFINITY]]) {
            animator.resizeCascadeContour(5, width, height);
        }
        animator.resizeCascadeContour(4, Number.POSITIVE_INFINITY, 280);
        const ignored = JSON.stringify(roots.map(root => root.counters)) === unchanged;
        shared.listener?.({ ...snapshot, simTimeSec: nowSec + 0.05 });
        const retained = reader.svg.attributes.get('viewBox') === '0 0 144 88' && inside(reader.contour.attributes.get('d'), 144, 88);
        animator.releaseCascade(5, reader.root);
        const released = JSON.stringify(reader.counters);
        animator.resizeCascadeContour(5, 508, 832);
        check(ignored && retained && JSON.stringify(reader.counters) === released,
            'Repeated or invalid contour sizes perform zero DOM work, preserve the last valid cached dimensions and cannot revive a released cascade');
    } finally {
        roots.forEach(({ root }, index) => animator.releaseCascade(ids[index], root));
    }
}
// КОНЕЦ РАЗДЕЛА 5
