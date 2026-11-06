// ============================================================================
// ФАЙЛ: frontend/src/tests/frameDiagnostics.test.ts
// НАЗНАЧЕНИЕ: Проверить обнаружение длинных кадров без маскировки паузой/клипом dt.
// РАЗДЕЛЫ: 1. Активный кадр; 2. Пауза/скрытие и opt-in;
//          3. Окно перцентилей/проходы render; 4. Ограниченные записи CPU/gap и владение снимками;
//          5. Opt-in browser LoAF: duration/layout пики, feature detection и безопасные копии.
// ФУНКЦИИ: runFrameDiagnosticsChecks.
// ============================================================================
import { BROWSER_LONG_FRAME_LIMIT, BROWSER_LONG_FRAME_SCRIPT_LIMIT, FRAME_DIAGNOSTIC_TOP_LIMIT,
    FRAME_DIAGNOSTIC_WINDOW, FrameDiagnostics, getDiagnosticDpr, type BrowserLongFrameSource } from '../core/frameDiagnostics';
import { universeStore } from '../store/universeState';

// НАЧАЛО ФУНКЦИИ runFrameDiagnosticsChecks
export function runFrameDiagnosticsChecks(check: (passed: boolean, description: string) => void): void {
    const canvas = { dataset: {} as Record<string, string> } as HTMLCanvasElement;
    const profile = new FrameDiagnostics(canvas, true);
    const state = { ...universeStore.getState(), isPaused: false, isTabHidden: false };
    profile.record(16, 4, state, 0);
    profile.record(1450, 1200, state, 1450, { setupMs: 10, simulationMs: 100, uiMs: 70, renderMs: 1020,
        visualSignals: { 'finale-card': 65, waterfall: 2 } });
    const report = profile.snapshot();
    check(report.totals.frames === 2 && report.totals.maxGapMs === 1450 && report.totals.maxCpuMs === 1200 &&
        report.totals.gapsOver1000Ms === 1 && JSON.parse(canvas.dataset.frameProfile!).totals.maxGapMs === 1450,
    'Opt-in profiling retains a1.45-second actual gap and CPU cost instead of clamping them to physics dt');
    check(report.totals.maxSetupMs === 10 && report.totals.maxSimulationMs === 100 &&
        report.totals.maxUiMs === 70 && report.totals.maxRenderMs === 1020 &&
        Object.values(report.stages).some(stage => stage.maxRenderMs === 1020) &&
        report.totals.maxVisualSignalsMs['finale-card'] === 65 && report.totals.maxVisualSignalsMs.waterfall === 2,
        'The active stage distinguishes setup, simulation, UI updates and rendering instead of attributing every hitch to geometry');
    profile.record(2000, 2, { ...state, isPaused: true }, 3450);
    profile.record(2000, 2, state, 5450);
    profile.record(3000, 2, { ...state, isTabHidden: true }, 8450);
    profile.record(3000, 2, state, 11450);
    check(profile.snapshot().totals.gapsOver1000Ms === 1,
        'Paused, hidden and first resumed intervals do not masquerade as active rendering stalls');
    profile.resetContinuity();
    profile.record(60000, 5, state, 71450);
    check(profile.snapshot().totals.gapsOver1000Ms === 1,
        'Visibility suspension excludes a full hidden interval even when no hidden RAF was delivered');
    const disabledCanvas = { dataset: {} as Record<string, string> } as HTMLCanvasElement;
    const disabled = new FrameDiagnostics(disabledCanvas, false);
    let disabledPassReads = 0;
    disabled.record(3000, 2000, state, 0, { setupMs: 1, simulationMs: 2, uiMs: 3, renderMs: 4,
        get renderPasses() { disabledPassReads++; return { particles: 4 }; } });
    check(disabled.snapshot().totals.frames === 0 && disabled.snapshot().topCPUFrames.length === 0 &&
        disabled.snapshot().topGapFrames.length === 0 && Object.keys(disabled.snapshot().totals.maxRenderPassesMs).length === 0 &&
        disabledPassReads === 0 && Object.keys(disabledCanvas.dataset).length === 0,
        'Normal viewing does not record or publish the optional diagnostic profile');
    check(getDiagnosticDpr('?profile=1&dpr=3') === 3 && getDiagnosticDpr('?dpr=3') === null &&
        ['?profile=1&dpr=100', '?profile=1&dpr=NaN', '?profile=1&dpr=-1', '?profile=1'].every(search => getDiagnosticDpr(search) === null),
        'A bounded diagnostic DPR requires explicit profiling; normal viewing and malformed requests retain the physical ratio');

    const passes = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true);
    const inheritedPasses = Object.assign(Object.create({ inherited: 9000 }) as Record<string, number>, {
        background: 4, particles: 10, zero: 0, negative: -1, nan: NaN, infinity: Infinity
    });
    passes.record(16, 20, state, 0, { setupMs: 1, simulationMs: 2, uiMs: 3, renderMs: 14, renderPasses: inheritedPasses });
    passes.record(16, 25, state, 16, { setupMs: 1, simulationMs: 2, uiMs: 3, renderMs: 17,
        renderPasses: { background: 7, particles: 8, zero: -1, negative: -2, nan: NaN, infinity: Infinity } });
    const passReport = passes.snapshot();
    const passStage = state.currentPhase + ':' + state.singularityAct;
    check(passReport.totals.maxRenderPassesMs.background === 7 && passReport.totals.maxRenderPassesMs.particles === 10 &&
        passReport.totals.maxRenderPassesMs.zero === 0 && Object.keys(passReport.totals.maxRenderPassesMs).length === 3 &&
        passReport.stages[passStage]!.maxRenderPassesMs.background === 7 &&
        Object.keys(passReport.topCPUFrames[1]!.work!.renderPasses!).length === 3,
        'Render-pass maxima accumulate by label per run and stage while rejecting inherited, negative and nonfinite timings');
    passReport.totals.maxRenderPassesMs.background = 1000;
    passReport.stages[passStage]!.maxRenderPassesMs.particles = 1000;
    check(passes.snapshot().totals.maxRenderPassesMs.background === 7 &&
        passes.snapshot().stages[passStage]!.maxRenderPassesMs.particles === 10,
        'Render-pass metric snapshots own their maps independently of retained totals and stage metrics');

    const boundedPasses = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true);
    boundedPasses.record(16, 20, state, 0, { setupMs: 1, simulationMs: 2, uiMs: 3, renderMs: 14,
        renderPasses: Object.fromEntries(Array.from({ length: 20 }, (_, index) => ['pass-' + index, index])) });
    boundedPasses.record(16, 25, state, 16, { setupMs: 1, simulationMs: 2, uiMs: 3, renderMs: 14,
        renderPasses: { extra: 1000, ['x'.repeat(65)]: 1000, 'pass-0': 8 } });
    const boundedPassReport = boundedPasses.snapshot();
    check(Object.keys(boundedPassReport.totals.maxRenderPassesMs).length === 16 &&
        Object.keys(boundedPassReport.topCPUFrames[1]!.work!.renderPasses!).length === 16 &&
        boundedPassReport.totals.maxRenderPassesMs['pass-0'] === 8 &&
        boundedPassReport.topCPUFrames[0]!.work!.renderPasses!['x'.repeat(65)] === undefined,
        'Render-pass history bounds labels and name lengths while continuing to update retained maxima');
    const withoutPasses = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true);
    withoutPasses.record(16, 2, state, 0);
    withoutPasses.record(16, 4, state, 16, { setupMs: 1, simulationMs: 1, uiMs: 1, renderMs: 1 });
    const withoutPassReport = withoutPasses.snapshot();
    check(withoutPassReport.totals.frames === 2 && Object.keys(withoutPassReport.totals.maxRenderPassesMs).length === 0 &&
        withoutPassReport.topCPUFrames[0]!.work!.renderPasses === undefined && withoutPassReport.topCPUFrames[1]!.work === undefined,
        'Callers without a work breakdown or render-pass map retain the existing optional diagnostics contract');

    const rolling = new FrameDiagnostics(canvas, true);
    const rollingState = { ...state, currentPhase: '01_VOID' as const, singularityAct: 'INACTIVE' as const };
    for (let i = 1; i <= FRAME_DIAGNOSTIC_WINDOW; i++) rolling.record(i, i, rollingState, i * 20,
        { setupMs: i / 4, simulationMs: i / 2, uiMs: i / 8, renderMs: i * 2 });
    const percentiles = rolling.snapshot().totals;
    check(percentiles.sampleWindowFrames === 512 && percentiles.p50CpuMs === 257 && percentiles.p95CpuMs === 487 &&
        percentiles.p95SimulationMs === 243.5 && percentiles.p95RenderMs === 974 &&
        percentiles.p95UiMs === 60.875 && percentiles.p95SetupMs === 121.75,
        'Opt-in snapshots provide exact bounded p50/p95 CPU and work costs without sorting on every frame');

    for (let i = 1; i <= FRAME_DIAGNOSTIC_WINDOW; i++) rolling.record(16, 2, rollingState, 11000 + i * 20,
        { setupMs: 0.1, simulationMs: 0.5, uiMs: 0.4, renderMs: 1 });
    const expired = rolling.snapshot().totals;
    check(expired.frames === 1024 && expired.sampleWindowFrames === 512 && expired.p50CpuMs === 2 && expired.p95CpuMs === 2 &&
        expired.p95GapMs === 16 && expired.p95RenderMs === 1 && expired.maxCpuMs === 512 && expired.maxRenderMs === 1024 &&
        expired.gapsOver500Ms === 12,
        'Rolling percentiles replace old samples while whole-run maxima and long-gap counters remain intact');

    const laterStage = { ...rollingState, currentPhase: '03_EVOLUTION' as const };
    rolling.record(16, 7, laterStage, 23000, { setupMs: 1, simulationMs: 2, uiMs: 1, renderMs: 3 });
    const separated = rolling.snapshot();
    const stageSummary = separated.stages[laterStage.currentPhase + ':' + laterStage.singularityAct]!;
    stageSummary.maxVisualSignalsMs.injected = 1000;
    check(stageSummary.sampleWindowFrames === 1 && stageSummary.p95CpuMs === 7 && stageSummary.p95RenderMs === 3 &&
        !('injected' in rolling.snapshot().stages[laterStage.currentPhase + ':' + laterStage.singularityAct]!.maxVisualSignalsMs),
        'Each phase keeps its own bounded statistics and consumer snapshots cannot mutate retained diagnostics');

    const peaks = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true);
    const peakState = { ...state, currentPhase: '02_GENESIS' as const, singularityAct: 'INACTIVE' as const };
    peaks.record(99999, 1, peakState, 100);
    check(peaks.snapshot().topCPUFrames[0]!.gapMs === null && peaks.snapshot().topGapFrames.length === 0,
        'The first active CPU sample has no continuous preceding gap and cannot become a gap peak');
    for (let index = 1; index <= FRAME_DIAGNOSTIC_TOP_LIMIT + 5; index++) {
        peaks.record(100 + index, 200 - index, peakState, 100 + index,
            { setupMs: 1, simulationMs: 2, uiMs: index, renderMs: 3,
                visualSignals: { 'finale-card': index / 2 } });
    }
    const peakReport = peaks.snapshot();
    check(peakReport.topCPUFrames.length === FRAME_DIAGNOSTIC_TOP_LIMIT &&
        peakReport.topGapFrames.length === FRAME_DIAGNOSTIC_TOP_LIMIT &&
        peakReport.topCPUFrames[0]!.cpuMs === 199 && peakReport.topCPUFrames.at(-1)!.cpuMs === 188 &&
        peakReport.topGapFrames[0]!.gapMs === 117 && peakReport.topGapFrames.at(-1)!.gapMs === 106 &&
        peakReport.topCPUFrames.every((frame, index, frames) => index === 0 || frames[index - 1]!.cpuMs >= frame.cpuMs) &&
        peakReport.topGapFrames.every((frame, index, frames) => index === 0 || frames[index - 1]!.gapMs! >= frame.gapMs!),
        'Independent CPU and gap top lists keep only the largest twelve records and snapshots order them descending');
    check(peakReport.topCPUFrames[0]!.frameIndex === 2 && peakReport.topCPUFrames[0]!.nowMs === 101 &&
        peakReport.topCPUFrames[0]!.stage === '02_GENESIS:INACTIVE' &&
        peakReport.topGapFrames[0]!.cpuMs === 183 && peakReport.topGapFrames[0]!.work!.uiMs === 17 &&
        peakReport.topGapFrames[0]!.work!.visualSignals!['finale-card'] === 8.5 &&
        peakReport.topGapFrames.every(frame => frame.gapInterval === 'before-current-callback'),
        'Peak entries retain one callback context and labels while explicitly placing the gap before that callback');

    const interruptions = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true);
    interruptions.record(10000, 1, peakState, 0);
    interruptions.record(70, 2, peakState, 70);
    interruptions.record(9000, 9000, { ...peakState, isPaused: true }, 80);
    interruptions.record(9000, 3, peakState, 90);
    interruptions.record(9000, 9000, { ...peakState, isTabHidden: true }, 100);
    interruptions.record(9000, 4, peakState, 110);
    interruptions.resetContinuity();
    interruptions.record(9000, 5, peakState, 120);
    interruptions.record(90, 6, peakState, 210);
    const interruptionReport = interruptions.snapshot();
    check(interruptionReport.topCPUFrames.length === 6 && interruptionReport.topGapFrames.length === 2 &&
        interruptionReport.topGapFrames[0]!.gapMs === 90 && interruptionReport.topGapFrames[1]!.gapMs === 70 &&
        interruptionReport.topCPUFrames.filter(frame => frame.gapMs === null).length === 4 &&
        interruptionReport.topCPUFrames[0]!.frameIndex === 6,
        'Inactive callbacks are excluded and pause, hidden-tab and reset boundaries suppress only the resumed gap');

    const ownership = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true);
    ownership.record(16, 1, peakState, 0);
    const labels = { 'finale-card': 12 };
    const reusedPasses = { background: 1, particles: 3 };
    const work = { setupMs: 1, simulationMs: 2, uiMs: 13, renderMs: 4, visualSignals: labels, renderPasses: reusedPasses };
    ownership.record(800, 20, peakState, 800, work);
    work.uiMs = 999;
    labels['finale-card'] = 999;
    reusedPasses.background = 999;
    reusedPasses.particles = 1000;
    ownership.record(16, 2, peakState, 816, work);
    const owned = ownership.snapshot();
    check(owned.topCPUFrames[0]!.work!.uiMs === 13 &&
        owned.topGapFrames[0]!.work!.visualSignals!['finale-card'] === 12 &&
        owned.topCPUFrames[0]!.work!.renderPasses!.background === 1 &&
        owned.topGapFrames[0]!.work!.renderPasses!.particles === 3,
        'Retained peak records copy caller-owned work values, listener labels and render-pass maps reused by the next frame');
    owned.topCPUFrames[0]!.work!.uiMs = 1000;
    (owned.topCPUFrames[0]!.work!.visualSignals as Record<string, number>)['finale-card'] = 1000;
    (owned.topCPUFrames[0]!.work!.renderPasses as Record<string, number>).particles = 2000;
    owned.topGapFrames[0]!.stage = 'mutated';
    owned.topCPUFrames.pop();
    const ownedAgain = ownership.snapshot();
    check(owned.topGapFrames[0]!.work!.uiMs === 13 &&
        owned.topGapFrames[0]!.work!.visualSignals!['finale-card'] === 12 &&
        owned.topGapFrames[0]!.work!.renderPasses!.particles === 3 &&
        ownedAgain.topCPUFrames.length === 3 && ownedAgain.topCPUFrames[0]!.work!.uiMs === 13 &&
        ownedAgain.topCPUFrames[0]!.work!.visualSignals!['finale-card'] === 12 &&
        ownedAgain.topCPUFrames[0]!.work!.renderPasses!.particles === 3 &&
        ownedAgain.topGapFrames[0]!.stage === '02_GENESIS:INACTIVE',
        'Snapshot arrays, records and labels are independent between both top lists and later snapshots');

    const browserEntries = Array.from({ length: BROWSER_LONG_FRAME_LIMIT + 5 }, (_, index) => ({
        startTime: index * 100, duration: 60 + index, renderStart: index * 100 + 2,
        styleAndLayoutStart: index * 100 + 4, blockingDuration: index,
        scripts: Array.from({ length: BROWSER_LONG_FRAME_SCRIPT_LIMIT + 4 }, (_, script) => ({
            startTime: index * 100 + script, duration: 6 + script,
            sourceFunctionName: 'f'.repeat(300), sourceURL: 'https://example.invalid/' + 'x'.repeat(1000),
            invoker: 'i'.repeat(300), forcedStyleAndLayoutDuration: 2, pauseDuration: 1
        }))
    }));
    let browserCalls = 0, requestedEntryType = '';
    const browserSource: BrowserLongFrameSource = { supportedEntryTypes: ['long-animation-frame'],
        getEntriesByType(type) { browserCalls++; requestedEntryType = type; return browserEntries; } };
    const browserCanvas = { dataset: {} } as HTMLCanvasElement;
    const browserProfile = new FrameDiagnostics(browserCanvas, true, browserSource);
    const browserReport = browserProfile.snapshot().browserLongFrames;
    check(browserReport.supported && browserReport.scope === 'page-timeline' && browserCalls === 1 &&
        requestedEntryType === 'long-animation-frame' && browserReport.entries.length === BROWSER_LONG_FRAME_LIMIT &&
        browserReport.entries[0]!.duration === 76 && browserReport.entries.at(-1)!.duration === 65 &&
        browserReport.entries[0]!.scripts.length === BROWSER_LONG_FRAME_SCRIPT_LIMIT &&
        browserReport.entries[0]!.scripts[0]!.duration === 17 && browserReport.entries[0]!.scripts.at(-1)!.duration === 10,
        'Opt-in LoAF snapshots expose the worst bounded page-wide frames and script attributions in descending duration order');
    check(browserReport.layoutEntries.length === BROWSER_LONG_FRAME_LIMIT &&
        browserReport.layoutEntries[0]!.duration === 76 && browserReport.layoutEntries.at(-1)!.duration === 65 && browserCalls === 1,
        'The layout top list is independently bounded, breaks equal layout totals by frame duration and reuses the same native API read');
    const firstBrowserFrame = browserReport.entries[0]!;
    check(firstBrowserFrame.startTime === 1600 && firstBrowserFrame.renderStart === 1602 &&
        firstBrowserFrame.styleAndLayoutStart === 1604 && firstBrowserFrame.blockingDuration === 16 &&
        firstBrowserFrame.scripts[0]!.sourceFunctionName.length === 128 && firstBrowserFrame.scripts[0]!.sourceURL.length === 512 &&
        firstBrowserFrame.scripts[0]!.invoker.length === 128 && firstBrowserFrame.scripts[0]!.forcedStyleAndLayoutDuration === 2 &&
        firstBrowserFrame.scripts[0]!.pauseDuration === 1,
        'LoAF copies preserve browser timing fields and cap function, URL and invoker strings');
    firstBrowserFrame.scripts[0]!.sourceURL = 'consumer mutation';
    browserReport.layoutEntries[0]!.scripts[0]!.pauseDuration = 999;
    browserReport.entries.pop();
    const secondBrowserReport = browserProfile.snapshot().browserLongFrames;
    browserEntries[16]!.scripts[11]!.sourceFunctionName = 'source mutation';
    browserEntries[16]!.renderStart = 9999;
    check(secondBrowserReport.entries.length === BROWSER_LONG_FRAME_LIMIT &&
        secondBrowserReport.entries[0]!.scripts[0]!.sourceURL.startsWith('https://example.invalid/') &&
        secondBrowserReport.entries[0]!.scripts[0]!.sourceFunctionName === 'f'.repeat(128) &&
        secondBrowserReport.entries[0]!.renderStart === 1602 && browserEntries[0]!.duration === 60 &&
        browserReport.layoutEntries[0]!.scripts[0]!.sourceURL.startsWith('https://example.invalid/') &&
        firstBrowserFrame.scripts[0]!.pauseDuration === 1 && secondBrowserReport.layoutEntries[0]!.scripts[0]!.pauseDuration === 1 &&
        secondBrowserReport.layoutEntries[0]!.scripts[0]!.sourceFunctionName === 'f'.repeat(128),
        'LoAF snapshots neither retain native entry/script references nor alias later snapshots or reorder the source timeline');
    browserProfile.record(16, 1, peakState, 0);
    const publishedBrowser = JSON.parse(browserCanvas.dataset.frameProfile!).browserLongFrames;
    check(publishedBrowser.supported && publishedBrowser.scope === 'page-timeline' &&
        publishedBrowser.entries.length === BROWSER_LONG_FRAME_LIMIT && publishedBrowser.layoutEntries.length === BROWSER_LONG_FRAME_LIMIT,
        'The existing throttled data-frame-profile publication includes browser LoAF without another timer or observer');

    let unsupportedCalls = 0, disabledFeatureReads = 0;
    const unsupported = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true,
        { supportedEntryTypes: [], getEntriesByType() { unsupportedCalls++; return []; } });
    const disabledBrowser = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, false,
        { get supportedEntryTypes() { disabledFeatureReads++; return ['long-animation-frame']; },
            getEntriesByType() { unsupportedCalls++; return []; } });
    disabledBrowser.record(1000, 500, peakState, 0);
    check(!unsupported.snapshot().browserLongFrames.supported && !disabledBrowser.snapshot().browserLongFrames.supported &&
        unsupported.snapshot().browserLongFrames.layoutEntries.length === 0 &&
        disabledBrowser.snapshot().browserLongFrames.layoutEntries.length === 0 && unsupportedCalls === 0 && disabledFeatureReads === 0,
        'Feature detection rejects unsupported LoAF and disabled profiling does not read or query any browser API');
    const absentBrowser = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true, null);
    const throwingBrowser = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true,
        { supportedEntryTypes: ['long-animation-frame'], getEntriesByType() { throw new Error('timeline unavailable'); } });
    const throwingFeature = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true,
        { get supportedEntryTypes(): readonly string[] { throw new Error('feature access denied'); }, getEntriesByType() { return []; } });
    check([absentBrowser, throwingBrowser, throwingFeature].every(value => {
        const browser = value.snapshot().browserLongFrames;
        return !browser.supported && browser.entries.length === 0 && browser.layoutEntries.length === 0;
    }) && (typeof window !== 'undefined' || !new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true).snapshot().browserLongFrames.supported),
        'Absent, throwing or Node-only browser APIs yield a safe empty unavailable snapshot');
    const emptyBrowser = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true,
        { supportedEntryTypes: ['long-animation-frame'], getEntriesByType() { return []; } }).snapshot().browserLongFrames;
    check(emptyBrowser.supported && emptyBrowser.entries.length === 0 && emptyBrowser.layoutEntries.length === 0,
        'A supported empty browser timeline remains distinguishable from an unavailable API');
    const invalidBrowser = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true,
        { supportedEntryTypes: ['long-animation-frame'], getEntriesByType() { return [null, {startTime:NaN,duration:100},
            {startTime:1,duration:-1}, {startTime:1,duration:100,renderStart:Infinity,styleAndLayoutStart:-1,blockingDuration:'bad',
                scripts:[{startTime:2,duration:10,sourceURL:4,forcedStyleAndLayoutDuration:NaN,pauseDuration:-2}, {startTime:2,duration:Infinity}]}]; } })
        .snapshot().browserLongFrames;
    check(invalidBrowser.entries.length === 1 && invalidBrowser.entries[0]!.renderStart === 0 &&
        invalidBrowser.entries[0]!.styleAndLayoutStart === 0 && invalidBrowser.entries[0]!.blockingDuration === 0 &&
        invalidBrowser.entries[0]!.scripts.length === 1 && invalidBrowser.entries[0]!.scripts[0]!.sourceURL === '' &&
        invalidBrowser.entries[0]!.scripts[0]!.forcedStyleAndLayoutDuration === 0 && invalidBrowser.entries[0]!.scripts[0]!.pauseDuration === 0 &&
        invalidBrowser.layoutEntries.length === 0,
        'Malformed LoAF records are discarded and optional timings/text never publish NaN, Infinity or negative durations');

    const durationNoise = Array.from({ length: BROWSER_LONG_FRAME_LIMIT + 5 }, (_, index) => ({
        startTime: index * 100, duration: 200 + index, scripts: []
    }));
    const distributedLayout = { startTime: 9000, duration: 65, scripts: Array.from({ length: 10 }, (_, index) => ({
        startTime: 9000 + index, duration: 6, forcedStyleAndLayoutDuration: 3, sourceFunctionName: 'distributed-' + index
    })) };
    const concentratedLayout = { startTime: 9100, duration: 100, scripts: [
        {startTime:9100,duration:35,forcedStyleAndLayoutDuration:29,sourceFunctionName:'forced-work'},
        {startTime:9135,duration:40,forcedStyleAndLayoutDuration:0,sourceFunctionName:'duration-only'}
    ] };
    let layoutCalls = 0;
    const layoutProfile = new FrameDiagnostics({ dataset: {} } as HTMLCanvasElement, true,
        { supportedEntryTypes: ['long-animation-frame'], getEntriesByType() {
            layoutCalls++; return [...durationNoise, distributedLayout, concentratedLayout];
        } });
    const layoutReport = layoutProfile.snapshot().browserLongFrames;
    check(layoutCalls === 1 && layoutReport.entries.every(entry => entry.duration >= 200) &&
        layoutReport.layoutEntries.length === 2 && layoutReport.layoutEntries[0]!.startTime === 9000 &&
        layoutReport.layoutEntries[1]!.startTime === 9100 &&
        layoutReport.layoutEntries[0]!.scripts.length === BROWSER_LONG_FRAME_SCRIPT_LIMIT &&
        layoutReport.layoutEntries[0]!.scripts.reduce((sum, script) => sum + script.forcedStyleAndLayoutDuration, 0) === 24 &&
        layoutReport.layoutEntries[1]!.scripts[0]!.sourceFunctionName === 'forced-work',
        'Expensive layout survives longer unrelated LoAFs and ranks by all original script costs before the eight-script output limit');
    layoutReport.layoutEntries[0]!.scripts[0]!.sourceFunctionName = 'changed snapshot';
    const freshLayout = layoutProfile.snapshot().browserLongFrames;
    check(layoutCalls === 2 && freshLayout.layoutEntries[0]!.scripts[0]!.sourceFunctionName === 'distributed-0' &&
        distributedLayout.scripts[0]!.sourceFunctionName === 'distributed-0',
        'The layout-specific selection returns fresh frame/script copies without retaining consumer mutations');
}
// КОНЕЦ ФУНКЦИИ runFrameDiagnosticsChecks
