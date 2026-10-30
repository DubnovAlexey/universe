// ============================================================================
// ФАЙЛ: frontend/src/tests/sceneExplanationFocus.test.ts
// НАЗНАЧЕНИЕ: Проверить связь пояснений с реальной сценой, переходы и бюджет акцента.
// РАЗДЕЛЫ: 1. Минимальный Canvas и данные; 2. Карта и часы; 3. Отрисовка и границы.
// ФУНКЦИИ: signals, particle, edge, runSceneExplanationFocusChecks; методы FocusCanvas.
// ============================================================================
import { EXPLAINER_TOPICS } from '../core/explainerTopics';
import {
    getSceneExplanationChannel, SceneExplanationFocus, SCENE_EXPLANATION_CHANNELS,
    type SceneExplanationFocusSnapshot,
} from '../core/sceneExplanationFocus';
import type { VisualSignalSnapshot } from '../core/visualSignals';
import {
    renderExplanationFocusPass, EXPLANATION_FOCUS_EDGE_LIMIT, EXPLANATION_FOCUS_PARTICLE_LIMIT,
} from '../engine/passes/explanationFocusPass';
import type { QuantumParticle, TopologyEdge } from '../phases/01_void';

// НАЧАЛО РАЗДЕЛА 1. МИНИМАЛЬНЫЙ CANVAS И ВХОДНОЙ СНИМОК
class FocusCanvas {
    public globalAlpha = 0.42;
    public lineWidth = 1;
    public strokeStyle: string | CanvasGradient | CanvasPattern = '';
    public readonly arcs: number[][] = [];
    public readonly curves: number[][] = [];
    public strokes = 0;
    public saves = 0;
    private readonly stack: { alpha: number; lineWidth: number; strokeStyle: string | CanvasGradient | CanvasPattern }[] = [];
    // НАЧАЛО ФУНКЦИИ save
    public save(): void {
        this.saves++;
        this.stack.push({ alpha: this.globalAlpha, lineWidth: this.lineWidth, strokeStyle: this.strokeStyle });
    }
    // КОНЕЦ ФУНКЦИИ save
    // НАЧАЛО ФУНКЦИИ restore
    public restore(): void {
        const saved = this.stack.pop();
        if (!saved) throw new Error('Unbalanced Canvas restore');
        this.saves--;
        this.globalAlpha = saved.alpha;
        this.lineWidth = saved.lineWidth;
        this.strokeStyle = saved.strokeStyle;
    }
    // КОНЕЦ ФУНКЦИИ restore
    public beginPath(): void {}
    public moveTo(): void {}
    public arc(...args: number[]): void { this.arcs.push(args); }
    public quadraticCurveTo(...args: number[]): void { this.curves.push(args); }
    public stroke(): void { this.strokes++; }
}

// НАЧАЛО ФУНКЦИИ signals
function signals(overrides: Partial<VisualSignalSnapshot> = {}): VisualSignalSnapshot {
    return { tick: 1, simTimeSec: 3, frameDtSec: 0.016, phase: '03_EVOLUTION', phaseProgress: 0.2,
        isPaused: false, reducedMotion: false, seed: 104729, low: 0, mid: 0, high: 0, pulse: 0,
        heartbeat: 0, kuramotoR: 0.7, globalStress: 0, ...overrides };
}
// КОНЕЦ ФУНКЦИИ signals

// НАЧАЛО ФУНКЦИИ particle
function particle(index: number): QuantumParticle {
    return { id: index * 31, x: 100 + index, y: 80 + index, prevX: 100 + index, prevY: 80 + index,
        morphOriginX: 0, morphOriginY: 0, morphOriginEnergy: 0.4, homeNormX: 0.5, homeNormY: 0.5,
        depthZ: 0, depthTier: 'MIDGROUND', clusterId: 0, ringIndex: 0, tripleGroupId: 0,
        vx: 0, vy: 0, mass: 1, radius: 1.2, energy: 0.5, kuramotoPhase: index * 0.1,
        synapticCharge: 0, interferenceFlash: 0, lastSignalArrivalMs: 0, cooldownUntilMs: 0,
        degree: 3, moduleTag: 'ts-core', phaseOffset: 0, quantumSpin: 0 };
}
// КОНЕЦ ФУНКЦИИ particle

// НАЧАЛО ФУНКЦИИ edge
function edge(index: number): TopologyEdge {
    return { id: `edge-${index}`, fromIndex: 0, toIndex: index * 47, edgeClass: 'BRIDGE',
        x1: 20 + index, y1: 30, x2: 70 + index, y2: 100, ctrlX: 50 + index, ctrlY: 65,
        arcLength: 100, lengthLUT: [0, 0.25, 0.5, 0.75, 1], murrayRadiusPx: 1.2,
        strength: 0.8, truthVisibility: 0.5, afterglow: 0 };
}
// КОНЕЦ ФУНКЦИИ edge
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ runSceneExplanationFocusChecks
export function runSceneExplanationFocusChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. КАРТА, НЕПРЕРЫВНОСТЬ И ПАУЗА
    check(Object.keys(SCENE_EXPLANATION_CHANNELS).length === EXPLAINER_TOPICS.length &&
        EXPLAINER_TOPICS.every((topic) => Object.prototype.hasOwnProperty.call(SCENE_EXPLANATION_CHANNELS, topic.id)) &&
        ['astro', 'jsx-dom', 'python', 'overview', '__proto__', 'missing'].every((topic) => getSceneExplanationChannel(topic) === null) &&
        getSceneExplanationChannel('kuramoto') === 'synchrony' && getSceneExplanationChannel('nexus') === 'connections' &&
        getSceneExplanationChannel('fbm') === 'dust' && getSceneExplanationChannel('ouroboros') === 'ouroboros',
    'All 15 explainer topics have explicit honest visual mappings; interface/reference topics and unknown IDs invent no physical effect');

    const focus = new SceneExplanationFocus();
    const snapshot = focus.getSnapshot();
    focus.selectTopic('kuramoto');
    const initial = snapshot.synchrony;
    focus.advance(signals());
    const first = snapshot.synchrony;
    focus.selectTopic('nexus');
    const beforeSwitch = snapshot.synchrony;
    focus.advance(signals());
    check(initial === 0 && first > 0 && first < 0.05 && beforeSwitch === first && snapshot.synchrony > 0 &&
        snapshot.synchrony < beforeSwitch && snapshot.connections > 0 && snapshot.connections + snapshot.synchrony <= 1 &&
        snapshot === focus.advance(signals()),
    'Topic selection crossfades existing weights without an initial flash, channel reset or per-frame snapshot allocation');

    const fine = new SceneExplanationFocus();
    const coarse = new SceneExplanationFocus();
    fine.selectTopic('plummer'); coarse.selectTopic('plummer');
    for (let i = 0; i < 100; i++) fine.advance(signals({ frameDtSec: 0.01 }));
    for (let i = 0; i < 50; i++) coarse.advance(signals({ frameDtSec: 0.02 }));
    check(Math.abs(fine.getSnapshot().field - coarse.getSnapshot().field) < 1e-12,
        'Context highlight uses frame-rate-independent exponential weights for equal active elapsed time');

    const frame = signals({ isPaused: true, frameDtSec: 0 });
    const frameBefore = JSON.stringify(frame);
    focus.selectTopic('plummer'); focus.advance(frame);
    const pausedStatic = snapshot.field === 1 && snapshot.synchrony === 0 && snapshot.connections === 0;
    focus.selectTopic('ouroboros'); focus.advance(signals({ reducedMotion: true }));
    const reducedStatic = snapshot.ouroboros === 1 && snapshot.field === 0;
    focus.selectTopic(null); focus.advance(frame);
    focus.selectTopic('nexus');
    focus.advance(signals({ frameDtSec: Number.NaN }));
    focus.advance(signals({ frameDtSec: -3 }));
    check(pausedStatic && reducedStatic && snapshot.connections === 0 && Number(snapshot.ouroboros) === 0 &&
        JSON.stringify(frame) === frameBefore,
    'Paused/reduced reading gets an immediate static selection and close clears it; invalid deltas neither move nor poison the context');

    focus.advance(signals({ isPaused: true }));
    focus.selectTopic(null);
    for (let i = 0; i < 140; i++) focus.advance(signals({ frameDtSec: 0.05 }));
    check(snapshot.topicId === null && snapshot.connections === 0 && snapshot.field === 0,
        'Closing the explanation fades out and reaches exact zero so no permanent hidden rendering pass remains');
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. РЕАЛЬНЫЕ КООРДИНАТЫ И ОГРАНИЧЕННЫЙ CANVAS-БЮДЖЕТ
    const particles = Array.from({ length: 2000 }, (_, index) => particle(index));
    const edges = Array.from({ length: 2000 }, (_, index) => edge(index));
    const sourceBefore = JSON.stringify([particles, edges]);
    const canvas = new FocusCanvas();
    const highlights: SceneExplanationFocusSnapshot = {
        topicId: 'nexus', field: 0.5, synchrony: 0.5, connections: 1, dust: 0, ouroboros: 0,
    };
    let samples = 0;
    renderExplanationFocusPass(canvas as unknown as CanvasRenderingContext2D, particles, edges, signals(), highlights, true,
        () => { samples++; return { dx: 11, dy: -7, rimHighlight: 0.2 }; });
    check(canvas.arcs.length === EXPLANATION_FOCUS_PARTICLE_LIMIT && samples === EXPLANATION_FOCUS_PARTICLE_LIMIT &&
        canvas.curves.length === EXPLANATION_FOCUS_EDGE_LIMIT && canvas.arcs[0][0] === particles[0].x + 11 &&
        canvas.arcs[0][1] === particles[0].y - 7 && canvas.curves[0][0] === edges[0].ctrlX &&
        canvas.curves[0][1] === edges[0].ctrlY && canvas.curves[0][2] === edges[0].x2 && canvas.curves[0][3] === edges[0].y2 &&
        canvas.globalAlpha === 0.42 && canvas.saves === 0 && JSON.stringify([particles, edges]) === sourceBefore,
    'Context rendering is limited to 24 existing refracted points and 14 original Bézier edges, preserves scene alpha and does not mutate simulation data');

    const none = new FocusCanvas();
    renderExplanationFocusPass(none as unknown as CanvasRenderingContext2D, particles, edges, signals(),
        { ...highlights, field: 0, synchrony: 0 }, false);
    const zero = new FocusCanvas();
    focus.reset();
    renderExplanationFocusPass(zero as unknown as CanvasRenderingContext2D, particles, edges, signals(), focus.getSnapshot(), true);
    check(none.strokes === 0 && none.saves === 0 && zero.strokes === 0 && zero.saves === 0,
        'An invisible graph stays invisible and a closed context performs no Canvas operations');
    // КОНЕЦ РАЗДЕЛА 3
}
// КОНЕЦ ФУНКЦИИ runSceneExplanationFocusChecks
