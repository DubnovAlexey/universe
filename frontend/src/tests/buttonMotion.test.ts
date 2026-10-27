// ============================================================================
// ФАЙЛ: frontend/src/tests/buttonMotion.test.ts
// НАЗНАЧЕНИЕ: Проверить обороты 3D-тел, независимые тени, читаемую грань и освобождение.
// РАЗДЕЛЫ: 1. Минимальный host/кадр; 2. Обороты; 3. Взаимодействие и lifecycle.
// ФУНКЦИИ: makeHarness, spin, axis, isFront, styleSnapshot, shadowSnapshot, runButtonMotionChecks.
// ============================================================================
import { ButtonMotionController } from '../core/buttonMotion';
import { getVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЙ HOST И КАДР
class MotionButton extends EventTarget {
    public id = '';
    public dataset: Record<string, string> = {};
    public textContent = 'CANONICAL BUTTON';
    public focusVisible = false;
    public values = new Map<string, string>();
    public priorities = new Map<string, string>();
    public writes = 0;
    public shadowWrites = 0;
    // НАЧАЛО ФУНКЦИИ matches
    public matches(selector: string): boolean { return selector === ':focus-visible' && this.focusVisible; }
    // КОНЕЦ ФУНКЦИИ matches
    public style = {
        // НАЧАЛО ФУНКЦИИ getPropertyValue
        getPropertyValue: (name: string): string => this.values.get(name) ?? '',
        // КОНЕЦ ФУНКЦИИ getPropertyValue
        // НАЧАЛО ФУНКЦИИ getPropertyPriority
        getPropertyPriority: (name: string): string => this.priorities.get(name) ?? '',
        // КОНЕЦ ФУНКЦИИ getPropertyPriority
        // НАЧАЛО ФУНКЦИИ setProperty
        setProperty: (name: string, value: string, priority = ''): void => {
            this.writes++; this.values.set(name, value);
            if (name.startsWith('--button-shadow-')) this.shadowWrites++;
            if (priority) this.priorities.set(name, priority);
            else this.priorities.delete(name);
        },
        // КОНЕЦ ФУНКЦИИ setProperty
        // НАЧАЛО ФУНКЦИИ removeProperty
        removeProperty: (name: string): void => { this.writes++; this.values.delete(name); this.priorities.delete(name); },
        // КОНЕЦ ФУНКЦИИ removeProperty
    };
}
// НАЧАЛО ФУНКЦИИ makeHarness
function makeHarness(count = 4, statusIndices: readonly number[] = [], phaseIds: readonly string[] = [], githubIndex = -1) {
    const shared: { listener: ((frame: Readonly<VisualSignalSnapshot>) => void) | null; subscriptions: number; releases: number } = {
        listener: null, subscriptions: 0, releases: 0,
    };
    const controller = new ButtonMotionController((listener) => {
        shared.listener = listener; shared.subscriptions++;
        return () => { shared.listener = null; shared.releases++; };
    });
    const buttons = Array.from({ length: count }, (_, index) => {
        const button = new MotionButton();
        if (statusIndices.includes(index)) button.dataset.buttonSolidKind = 'status';
        if (phaseIds[index]) button.dataset.phaseId = phaseIds[index];
        if (index === githubIndex) {
            button.id = 'link-hud-github';
            button.values.set('--github-ink-color', 'rgb(190 150 130)');
            button.priorities.set('--github-ink-color', 'important');
        }
        return button;
    });
    if (buttons[2]) {
        buttons[2].values.set('--button-axis-x', '0.2');
        buttons[2].priorities.set('--button-axis-x', 'important');
        buttons[2].values.set('--button-spin-angle', '37deg');
        buttons[2].values.set('--button-shadow-y', '3px');
        buttons[2].priorities.set('--button-shadow-y', 'important');
        buttons[2].dataset.buttonMotion = 'previous';
        if (phaseIds[2]) buttons[2].dataset.buttonPhaseEmphasis = 'previous';
    }
    const binding = controller.mount(buttons as unknown as HTMLElement[]);
    const frame: Readonly<VisualSignalSnapshot> = {
        ...getVisualSignals(), frameDtSec: 0.05, isPaused: false, reducedMotion: false,
        phase: '03_EVOLUTION', phaseProgress: 0.25, kuramotoR: 0.5, globalStress: 0.2,
        low: 0, mid: 0, pulse: 0,
    };
    // НАЧАЛО ФУНКЦИИ step
    const step = (count: number, changes: Partial<VisualSignalSnapshot> = {}): void => {
        for (let index = 0; index < count; index++) shared.listener?.({ ...frame, ...changes });
    };
    // КОНЕЦ ФУНКЦИИ step
    return { shared, controller, buttons, binding, step };
}
// КОНЕЦ ФУНКЦИИ makeHarness
// НАЧАЛО ФУНКЦИИ spin
function spin(button: MotionButton): number { return Number.parseFloat(button.values.get('--button-spin-angle') ?? '0'); }
// КОНЕЦ ФУНКЦИИ spin
// НАЧАЛО ФУНКЦИИ axis
function axis(button: MotionButton): readonly number[] {
    return ['x', 'y', 'z'].map((coordinate) => Number.parseFloat(button.values.get(`--button-axis-${coordinate}`) ?? '0'));
}
// КОНЕЦ ФУНКЦИИ axis
// НАЧАЛО ФУНКЦИИ isFront
function isFront(button: MotionButton): boolean { return Math.abs(spin(button) - Math.round(spin(button) / 360) * 360) < 0.00001; }
// КОНЕЦ ФУНКЦИИ isFront
// НАЧАЛО ФУНКЦИИ styleSnapshot
function styleSnapshot(button: MotionButton): string { return JSON.stringify([...button.values]); }
// КОНЕЦ ФУНКЦИИ styleSnapshot
// НАЧАЛО ФУНКЦИИ shadowSnapshot
function shadowSnapshot(button: MotionButton): string {
    return JSON.stringify([...button.values].filter(([name]) => name.startsWith('--button-shadow-')));
}
// КОНЕЦ ФУНКЦИИ shadowSnapshot
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ runButtonMotionChecks
export function runButtonMotionChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. ПОЛНЫЕ ОБОРОТЫ
    const h = makeHarness(4, [3]);
    h.step(40);
    const statusAxis = axis(h.buttons[3]);
    check(h.shared.subscriptions === 1 && h.binding.listenerCount === 20 &&
        h.buttons.every((button) => Math.abs(Math.hypot(...axis(button)) - 1) < 0.000002 &&
            button.values.size === 10 && !button.values.has('transform') && button.textContent === 'CANONICAL BUTTON') &&
        axis(h.buttons[0])[0] > 0.99 && axis(h.buttons[1])[1] > 0.99 &&
        statusAxis[0] > 0.9998 && Math.abs(statusAxis[1]) < 0.016 && Math.abs(statusAxis[2]) < 0.006 &&
        spin(h.buttons[0]) > 0 && spin(h.buttons[1]) < 0 && spin(h.buttons[2]) < 0 && spin(h.buttons[3]) > 0,
        'Solid bodies get fixed normalized individual axes and both spin directions; wide status rows use a nearly horizontal axis while native host text and geometry remain untouched');

    const fixedAxes = h.buttons.map((button) => JSON.stringify(axis(button)));
    const field = makeHarness(17);
    const frontShadows = field.buttons.map(shadowSnapshot);
    field.step(240);
    check(new Set(field.buttons.map((button) => Math.abs(spin(button)).toFixed(4))).size === 17,
        'All seventeen control bodies have distinct orbital speeds instead of repeating synchronized groups');
    field.step(120);
    check(new Set(field.buttons.map(shadowSnapshot)).size === 17 &&
        field.buttons.every((button, index) => shadowSnapshot(button) !== frontShadows[index] &&
            [...button.values].filter(([name]) => name.startsWith('--button-shadow-'))
                .every(([, value]) => Number.isFinite(Number.parseFloat(value)))) &&
        field.buttons.some((button) => Number.parseFloat(button.values.get('--button-shadow-scale-x')!) < 0.8) &&
        field.buttons.some((button) => Number.parseFloat(button.values.get('--button-shadow-scale-y')!) < 0.8),
        'Each rotating body casts its own finite orientation-dependent shadow; horizontal and vertical silhouettes narrow independently instead of sharing one shadow');
    field.binding.dispose();

    const shadowBudget = makeHarness(1);
    const startingShadowWrites = shadowBudget.buttons[0].shadowWrites;
    const startingAngle = spin(shadowBudget.buttons[0]);
    shadowBudget.step(120, { frameDtSec: 1 / 120 });
    const activeShadowWrites = shadowBudget.buttons[0].shadowWrites - startingShadowWrites;
    const stableShadow = shadowSnapshot(shadowBudget.buttons[0]);
    const stableWrites = shadowBudget.buttons[0].writes;
    shadowBudget.step(30, { frameDtSec: 0 });
    check(activeShadowWrites > 12 && activeShadowWrites <= 72 && spin(shadowBudget.buttons[0]) > startingAngle &&
        shadowSnapshot(shadowBudget.buttons[0]) === stableShadow && shadowBudget.buttons[0].writes === stableWrites &&
        shadowBudget.shared.subscriptions === 1,
        'Shadow painting stays within a twelve-update budget during 120 shared frames per second, while zero-dt frames freeze it without a second scheduler');
    shadowBudget.binding.dispose();

    const activated = makeHarness(2);
    activated.step(200);
    activated.buttons[0].dispatchEvent(new Event('pointerenter'));
    activated.step(1);
    const peerBeforeActivation = spin(activated.buttons[1]);
    activated.buttons[0].dispatchEvent(new Event('click'));
    activated.step(1, { isPaused: true, frameDtSec: 0 });
    check(isFront(activated.buttons[0]) && spin(activated.buttons[1]) === peerBeforeActivation,
        'Activation reveals the readable front before its action can pause the scene, without moving a peer');
    activated.binding.dispose();

    let previous = h.buttons.map(spin);
    let monotonic = true;
    let boundedAngularStep = true;
    for (let frame = 0; frame < 1440; frame++) {
        h.step(1);
        h.buttons.forEach((button, index) => {
            const delta = spin(button) - previous[index];
            const direction = index === 0 || index === 3 ? 1 : -1;
            monotonic &&= delta * direction > 0;
            boundedAngularStep &&= Math.abs(delta) <= 1.001;
            previous[index] = spin(button);
        });
    }
    check(monotonic && boundedAngularStep && h.buttons.every((button, index) =>
        Math.abs(spin(button)) > 720 && JSON.stringify(axis(button)) === fixedAxes[index]),
        'Every body completes more than two signed 360-degree turns monotonically without amplitude limits, sine wobble, axis drift or translation');

    const noClockJump = makeHarness(1);
    const jumpingClock = makeHarness(1);
    for (let frame = 0; frame < 80; frame++) {
        noClockJump.step(1, { simTimeSec: frame * 0.05 });
        jumpingClock.step(1, { simTimeSec: frame % 2 ? -5000 : 5000 });
    }
    check(styleSnapshot(noClockJump.buttons[0]) === styleSnapshot(jumpingClock.buttons[0]),
        'Unwrapped rotation integrates shared active frame time and ignores forward/backward simulation-clock jumps');
    noClockJump.binding.dispose();
    jumpingClock.binding.dispose();

    const quiet = makeHarness(1);
    const tense = makeHarness(1);
    quiet.step(200, { phase: '01_VOID', phaseProgress: 0, kuramotoR: 0, globalStress: 0 });
    tense.step(200, { phase: '03_EVOLUTION', phaseProgress: 1, kuramotoR: 1, globalStress: 1 });
    const quietAngle = spin(quiet.buttons[0]);
    const tenseAngle = spin(tense.buttons[0]);
    tense.step(1, { phase: '03_EVOLUTION', phaseProgress: 1, kuramotoR: 1, globalStress: 1 });
    const steadyDelta = spin(tense.buttons[0]) - tenseAngle;
    const beforeSpeedChange = spin(tense.buttons[0]);
    tense.step(1, { phase: '01_VOID', phaseProgress: 0, kuramotoR: 0, globalStress: 0, low: 1, mid: 1, pulse: 1 });
    const changedDelta = spin(tense.buttons[0]) - beforeSpeedChange;
    check(tenseAngle - quietAngle > 5 && changedDelta > 0 && Math.abs(changedDelta - steadyDelta) < 0.03 &&
        JSON.stringify(axis(quiet.buttons[0])) === JSON.stringify(axis(tense.buttons[0])),
        'Scene progress, coherence, stress and audio gently change angular speed while preserving the fixed axis, spin sign and continuous angle');
    quiet.binding.dispose();
    tense.binding.dispose();
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ВЗАИМОДЕЙСТВИЕ И LIFECYCLE
    const phases = makeHarness(6, [], ['01_VOID', '02_GENESIS', '03_EVOLUTION', '04_COLLAPSE', '05_SINGULARITY']);
    phases.step(100);
    const phaseFrontWrites = phases.buttons[2].writes;
    const initialPeerAngle = spin(phases.buttons[0]);
    phases.step(20);
    check(isFront(phases.buttons[2]) && phases.buttons[2].writes === phaseFrontWrites &&
        phases.buttons[2].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons.filter((button) => button.dataset.buttonPhaseEmphasis === '1').length === 1 &&
        spin(phases.buttons[0]) > initialPeerAngle,
        'The playing phase holds its readable front and emphasis without repeated style writes while all other phase bodies keep rotating');

    const releasedPhaseAngle = spin(phases.buttons[2]);
    phases.step(20, { phase: '04_COLLAPSE' });
    check(isFront(phases.buttons[3]) && phases.buttons[3].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons[2].dataset.buttonPhaseEmphasis === undefined && spin(phases.buttons[2]) < releasedPhaseAngle - 5 &&
        phases.buttons.filter((button) => button.dataset.buttonPhaseEmphasis === '1').length === 1,
        'A phase change transfers the single readable emphasis to the new playing phase and smoothly releases the previous phase');

    phases.buttons[0].dispatchEvent(new Event('pointerenter'));
    phases.buttons[5].dispatchEvent(new Event('pointerenter'));
    phases.step(20, { phase: '05_SINGULARITY' });
    const independentPeerAngle = spin(phases.buttons[3]);
    phases.step(10, { phase: '05_SINGULARITY' });
    const hoverTakesPriority = isFront(phases.buttons[0]) && isFront(phases.buttons[5]) &&
        phases.buttons[0].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons[4].dataset.buttonPhaseEmphasis === undefined &&
        phases.buttons.filter((button) => button.dataset.buttonPhaseEmphasis === '1').length === 1 &&
        spin(phases.buttons[3]) > independentPeerAngle;
    phases.buttons[0].dispatchEvent(new Event('pointerleave'));
    phases.step(20, { phase: '05_SINGULARITY' });
    check(hoverTakesPriority && isFront(phases.buttons[4]) && phases.buttons[4].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons[0].dataset.buttonPhaseEmphasis === undefined && isFront(phases.buttons[5]),
        'Hover overrides the playing phase exclusively, independent control hover still works, and pointer leave restores the latest playing phase');

    phases.buttons[1].focusVisible = true;
    phases.buttons[1].dispatchEvent(new Event('focus'));
    phases.step(20, { phase: '05_SINGULARITY' });
    const keyboardPhaseFront = spin(phases.buttons[1]);
    phases.buttons[0].dispatchEvent(new Event('pointerenter'));
    phases.step(20, { phase: '05_SINGULARITY' });
    const pointerOverridesKeyboard = isFront(phases.buttons[0]) &&
        phases.buttons[0].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons[1].dataset.buttonPhaseEmphasis === undefined && spin(phases.buttons[1]) < keyboardPhaseFront - 5;
    phases.buttons[0].dispatchEvent(new Event('pointerleave'));
    phases.step(20, { phase: '05_SINGULARITY' });
    const keyboardRestored = isFront(phases.buttons[1]) && phases.buttons[1].dataset.buttonPhaseEmphasis === '1';
    phases.buttons[1].focusVisible = false;
    phases.buttons[1].dispatchEvent(new Event('blur'));
    phases.step(20, { phase: '05_SINGULARITY' });
    check(pointerOverridesKeyboard && keyboardRestored && isFront(phases.buttons[4]) &&
        phases.buttons[4].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons.filter((button) => button.dataset.buttonPhaseEmphasis === '1').length === 1,
        'Phase reading priority is pointer hover, keyboard focus-visible, then the playing phase, with one effective target through each restoration');

    phases.buttons[5].dispatchEvent(new Event('pointerleave'));
    phases.step(1, { isPaused: true, frameDtSec: 0, phase: '02_GENESIS' });
    const pausedPhasePose = phases.buttons.map(styleSnapshot);
    phases.step(20, { isPaused: true, frameDtSec: 0, phase: '02_GENESIS' });
    const phaseSelectedInPause = isFront(phases.buttons[1]) && phases.buttons[1].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons.every((button, index) => styleSnapshot(button) === pausedPhasePose[index]);
    phases.buttons[0].dispatchEvent(new Event('pointerenter'));
    const pausedHoverFront = isFront(phases.buttons[0]) && phases.buttons[0].dataset.buttonPhaseEmphasis === '1';
    phases.buttons[0].dispatchEvent(new Event('pointerleave'));
    check(phaseSelectedInPause && pausedHoverFront && isFront(phases.buttons[1]) &&
        phases.buttons[1].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons.slice(2).every((button, index) => styleSnapshot(button) === pausedPhasePose[index + 2]),
        'Phase changes and explicit hover remain readable during pause without advancing peers or producing repeated style writes');

    phases.step(1, { reducedMotion: true, phase: '03_EVOLUTION' });
    const reducedPhasePose = phases.buttons.map(styleSnapshot);
    phases.step(20, { reducedMotion: true, phase: '04_COLLAPSE' });
    check(phases.buttons.every((button, index) => isFront(button) && styleSnapshot(button) === reducedPhasePose[index]) &&
        phases.buttons[3].dataset.buttonPhaseEmphasis === '1' &&
        phases.buttons.filter((button) => button.dataset.buttonPhaseEmphasis === '1').length === 1,
        'Reduced motion keeps all fronts stationary while the single phase emphasis follows the playing phase');
    phases.binding.dispose();
    const restoredPhaseMarkers = phases.buttons.map((button) => button.dataset.buttonPhaseEmphasis);
    phases.buttons[0].dispatchEvent(new Event('pointerenter'));
    check(restoredPhaseMarkers[2] === 'previous' &&
        restoredPhaseMarkers.every((marker, index) => index === 2 || marker === undefined) &&
        phases.buttons.every((button, index) => button.dataset.buttonPhaseEmphasis === restoredPhaseMarkers[index]) &&
        phases.shared.subscriptions === 1 && phases.shared.releases === 1 && phases.binding.listenerCount === 30,
        'Disposal restores existing phase-emphasis markers and removes temporary markers using the existing subscription and interaction handlers');

    const beforeHover = spin(h.buttons[0]);
    const nearestFront = Math.round(beforeHover / 360) * 360;
    const movingPeer = spin(h.buttons[1]);
    h.buttons[0].dispatchEvent(new Event('pointerenter'));
    h.step(1);
    const firstHoverStep = Math.abs(spin(h.buttons[0]) - beforeHover);
    h.step(13);
    const heldWrites = h.buttons[0].writes;
    const heldShadow = shadowSnapshot(h.buttons[0]);
    const movingPeerShadow = shadowSnapshot(h.buttons[1]);
    h.step(24);
    check(firstHoverStep < Math.abs(nearestFront - beforeHover) * 0.1 &&
        spin(h.buttons[0]) === nearestFront && isFront(h.buttons[0]) &&
        h.buttons[0].writes === heldWrites && shadowSnapshot(h.buttons[0]) === heldShadow &&
        shadowSnapshot(h.buttons[1]) !== movingPeerShadow && spin(h.buttons[1]) < movingPeer,
        'Hover aligns only the selected body and its shadow to the nearest front, then holds both without DOM writes while peers and their shadows keep turning');

    h.buttons[0].dispatchEvent(new Event('pointerleave'));
    const beforeRelease = spin(h.buttons[0]);
    h.step(1);
    const firstReleaseStep = spin(h.buttons[0]) - beforeRelease;
    h.step(20);
    check(firstReleaseStep > 0 && firstReleaseStep < 0.01 && spin(h.buttons[0]) - beforeRelease > 5,
        'Pointer leave preserves the current angle and smoothly accelerates rotation in the body\'s original direction');

    const mouseFocus = makeHarness(1);
    mouseFocus.step(100);
    mouseFocus.buttons[0].dispatchEvent(new Event('pointerenter'));
    mouseFocus.buttons[0].dispatchEvent(new Event('focus'));
    mouseFocus.step(14);
    const mouseFront = spin(mouseFocus.buttons[0]);
    const mouseWasFront = isFront(mouseFocus.buttons[0]);
    mouseFocus.buttons[0].dispatchEvent(new Event('pointerleave'));
    mouseFocus.step(24);
    check(mouseWasFront && spin(mouseFocus.buttons[0]) > mouseFront + 5,
        'Mouse-acquired focus does not keep a body stopped after pointer leave');
    mouseFocus.binding.dispose();

    h.buttons[1].focusVisible = true;
    h.buttons[1].dispatchEvent(new Event('focus'));
    h.step(14);
    const keyboardFront = spin(h.buttons[1]);
    h.buttons[1].dispatchEvent(new Event('pointerenter'));
    h.buttons[1].dispatchEvent(new Event('pointerleave'));
    h.step(20);
    const stayedKeyboardFront = isFront(h.buttons[1]) && spin(h.buttons[1]) === keyboardFront;
    h.buttons[1].focusVisible = false;
    h.buttons[1].dispatchEvent(new Event('blur'));
    h.step(24);
    check(stayedKeyboardFront && spin(h.buttons[1]) < keyboardFront - 5,
        'Only keyboard focus-visible holds a readable front after pointer leave; blur resumes the signed rotation');

    const pausedInteraction = makeHarness(3);
    pausedInteraction.step(100);
    pausedInteraction.step(1, { isPaused: true });
    const frozen = pausedInteraction.buttons.map(styleSnapshot);
    const frozenAngles = pausedInteraction.buttons.map(spin);
    const frozenWrites = pausedInteraction.buttons.map((button) => button.writes);
    pausedInteraction.step(20, { isPaused: true });
    check(pausedInteraction.buttons.every((button, index) => styleSnapshot(button) === frozen[index] &&
        button.writes === frozenWrites[index]),
        'Paused or hidden shared frames freeze every body and perform zero style writes');
    pausedInteraction.buttons[0].dispatchEvent(new Event('pointerenter'));
    const selectedFront = spin(pausedInteraction.buttons[0]);
    const selectedWrites = pausedInteraction.buttons[0].writes;
    const pausedFront = isFront(pausedInteraction.buttons[0]) &&
        pausedInteraction.buttons.slice(1).every((button, index) => styleSnapshot(button) === frozen[index + 1]);
    pausedInteraction.step(20);
    check(pausedFront && spin(pausedInteraction.buttons[0]) === selectedFront &&
        pausedInteraction.buttons[0].writes === selectedWrites && spin(pausedInteraction.buttons[1]) !== frozenAngles[1],
        'Explicit hover during pause reveals only its selected front immediately and remains held with no jump when other bodies resume');
    pausedInteraction.binding.dispose();

    const reduced = makeHarness(2);
    reduced.step(300);
    reduced.step(1, { reducedMotion: true });
    const reducedPose = reduced.buttons.map(styleSnapshot);
    const reducedWrites = reduced.buttons.map((button) => button.writes);
    reduced.step(20, { reducedMotion: true });
    const stayedReduced = reduced.buttons.every((button, index) => isFront(button) && styleSnapshot(button) === reducedPose[index] &&
        button.writes === reducedWrites[index]);
    const beforeReducedRelease = reduced.buttons.map(spin);
    reduced.step(1);
    check(stayedReduced && reduced.buttons.every((button, index) =>
        Math.abs(spin(button) - beforeReducedRelease[index]) < 0.01),
        'Reduced motion presents stationary neutral fronts once and resumes through a gentle acceleration instead of jumping');

    h.binding.dispose();
    const disposedWrites = h.buttons.map((button) => button.writes);
    h.binding.dispose();
    h.buttons[0].dispatchEvent(new Event('pointerenter'));
    h.buttons[1].dispatchEvent(new Event('focus'));
    check(h.shared.releases === 1 && h.shared.listener === null &&
        h.buttons[0].dataset.buttonMotion === undefined && h.buttons[0].values.size === 0 &&
        h.buttons[2].dataset.buttonMotion === 'previous' && h.buttons[2].values.size === 3 &&
        h.buttons[2].values.get('--button-axis-x') === '0.2' && h.buttons[2].priorities.get('--button-axis-x') === 'important' &&
        h.buttons[2].values.get('--button-spin-angle') === '37deg' &&
        h.buttons[2].values.get('--button-shadow-y') === '3px' && h.buttons[2].priorities.get('--button-shadow-y') === 'important' &&
        h.buttons[3].dataset.buttonSolidKind === 'status' &&
        h.buttons.every((button, index) => button.writes === disposedWrites[index]),
        'Disposal removes handlers and the shared subscription once, restores previous axis/angle/shadow priorities and marker, and preserves geometry-owned data');
    reduced.binding.dispose();

    const github = makeHarness(3, [], [], 1);
    const accentProperty = '--github-ink-color';
    const firstAccent = github.buttons[1].values.get(accentProperty);
    let previousChannels = firstAccent!.match(/\d+/g)!.map(Number);
    let warmAndReadable = true;
    const accentColors = new Set<string>();
    // НАЧАЛО ФУНКЦИИ luminance
    const luminance = (channels: readonly number[]): number => channels.reduce((sum, channel, index) => {
        const value = channel / 255;
        return sum + (value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)) *
            [0.2126, 0.7152, 0.0722][index];
    }, 0);
    // КОНЕЦ ФУНКЦИИ luminance
    let sawHotAmber = false;
    let minAccentLuminance = Infinity, maxAccentLuminance = 0;
    let sawCoolMetal = false;
    for (let frame = 0; frame < 360; frame++) {
        github.step(1, { simTimeSec: frame % 2 ? 1000 : -1000 });
        const color = github.buttons[1].values.get(accentProperty)!;
        const channels = color.match(/\d+/g)!.map(Number);
        accentColors.add(color);
        sawHotAmber ||= channels[0] > 240 && channels[2] < 190;
        sawCoolMetal ||= channels[2] > channels[0] + 20;
        const accentLuminance = luminance(channels);
        minAccentLuminance = Math.min(minAccentLuminance, accentLuminance);
        maxAccentLuminance = Math.max(maxAccentLuminance, accentLuminance);
        warmAndReadable &&= channels.every(channel => channel >= 0 && channel <= 255) &&
            channels.every((channel, index) => Math.abs(channel - previousChannels[index]) <= 3) &&
            (luminance(channels) + 0.05) / (luminance([56, 92, 121]) + 0.05) >= 4.5;
        previousChannels = channels;
    }
    check(warmAndReadable && sawHotAmber && sawCoolMetal && maxAccentLuminance / minAccentLuminance >= 1.18 &&
        accentColors.size > 100 && github.buttons[1].values.get(accentProperty) === firstAccent &&
        !github.buttons[0].values.has(accentProperty) && !github.buttons[2].values.has(accentProperty) &&
        github.shared.subscriptions === 1 && github.binding.listenerCount === 15,
        'Only GitHub cycles through visibly lighter/darker hot amber/coral and cool metal over18 active seconds with smooth steps, independent phase-clock jumps and at least4.5:1 text contrast');
    github.step(80);
    const accentBeforePause = github.buttons[1].values.get(accentProperty);
    github.step(40, { isPaused: true });
    const pausedAccent = github.buttons[1].values.get(accentProperty) === accentBeforePause;
    github.step(1, { reducedMotion: true });
    const reducedAccentWrites = github.buttons[1].writes;
    github.step(40, { reducedMotion: true });
    const reducedAccent = github.buttons[1].values.get(accentProperty) === accentBeforePause &&
        github.buttons[1].writes === reducedAccentWrites;
    github.step(80, { frameDtSec: 0 });
    check(pausedAccent && reducedAccent && github.buttons[1].values.get(accentProperty) === accentBeforePause,
        'GitHub accent holds its current readable color while paused, hidden, reduced-motion or zero-delta, with no repeated reduced-motion writes');
    github.binding.dispose();
    check(github.buttons[1].values.get(accentProperty) === 'rgb(190 150 130)' &&
        github.buttons[1].priorities.get(accentProperty) === 'important' && github.shared.releases === 1,
        'GitHub accent disposal restores its original custom color and priority through the existing controller lifecycle');

    const remounted = makeHarness(1);
    const nextBinding = remounted.controller.mount(remounted.buttons as unknown as HTMLElement[]);
    remounted.binding.dispose();
    const keptCurrentMount = remounted.shared.listener !== null && remounted.shared.subscriptions === 2 && remounted.shared.releases === 1;
    nextBinding.dispose();
    check(keptCurrentMount && remounted.shared.listener === null && remounted.shared.releases === 2 &&
        remounted.buttons[0].values.size === 0,
        'A stale binding cannot dispose the newer mount or leak duplicate frame subscriptions');
    // КОНЕЦ РАЗДЕЛА 3
}
// КОНЕЦ ФУНКЦИИ runButtonMotionChecks
