// ============================================================================
// ФАЙЛ: frontend/src/tests/backgroundFields.test.ts
// НАЗНАЧЕНИЕ: Проверить детерминированное состояние фоновых полей без DOM и рендерера.
// РАЗДЕЛЫ: 1. Опорные значения и снимки; 2. Генерация; 3. Шаг, respawn и перенос границ.
// ФУНКЦИИ: snapshot, finiteState, runBackgroundFieldsChecks, countDraws.
// ============================================================================
import { DeterministicPRNG } from '../core/prng';
import { BackgroundFields } from '../engine/backgroundFields';

// НАЧАЛО РАЗДЕЛА 1. ОПОРНЫЕ ЗНАЧЕНИЯ И СНИМКИ ПУБЛИЧНОГО СОСТОЯНИЯ
// Значения фиксируют порядок потребления PRNG и ближайших соседей сети Z4.
const GOLDENS = [
    { seed: 0, cloudAngle: 0.5211044038958121, signalSpeed: 0.11139532811008394,
        nodePhase: 2.8182889240174602, neighbors: [115, 104, 135] },
    { seed: 104729, cloudAngle: 0.5387758792690207, signalSpeed: 0.17505891620181502,
        nodePhase: 1.057860770341524, neighbors: [48, 70, 53] },
    { seed: 0xffffffff, cloudAngle: 0.5593902060887982, signalSpeed: 0.20483218307141215,
        nodePhase: 5.914451946949358, neighbors: [118, 75, 121] },
] as const;

// НАЧАЛО ФУНКЦИИ snapshot
function snapshot(fields: BackgroundFields): string {
    return JSON.stringify([fields.clouds, fields.signals, fields.nodes]);
}
// КОНЕЦ ФУНКЦИИ snapshot

// НАЧАЛО ФУНКЦИИ finiteState
function finiteState(fields: BackgroundFields): boolean {
    return [...fields.clouds, ...fields.signals, ...fields.nodes].every((item) =>
        Object.values(item).every((value) => Array.isArray(value)
            ? value.every(Number.isFinite) : typeof value !== 'number' || Number.isFinite(value)));
}
// КОНЕЦ ФУНКЦИИ finiteState
// КОНЕЦ РАЗДЕЛА 1. ОПОРНЫЕ ЗНАЧЕНИЯ И СНИМКИ ПУБЛИЧНОГО СОСТОЯНИЯ

// НАЧАЛО ФУНКЦИИ runBackgroundFieldsChecks
export function runBackgroundFieldsChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. ГЕНЕРАЦИЯ И СТАБИЛЬНОСТЬ ПРЕДСТАВЛЕНИЙ
    const originalNextU32 = DeterministicPRNG.prototype.nextU32;
    let draws = 0;
    let emptyConstructor = false;
    let goldenGeneration = true;
    let stableViews = true;
    try {
        // НАЧАЛО ФУНКЦИИ countDraws
        DeterministicPRNG.prototype.nextU32 = function countDraws(this: DeterministicPRNG): number {
            draws++;
            return originalNextU32.call(this);
        };
        // КОНЕЦ ФУНКЦИИ countDraws
        const fields = new BackgroundFields();
        const clouds = fields.clouds;
        const signals = fields.signals;
        const nodes = fields.nodes;
        emptyConstructor = draws === 0 && clouds.length === 0 && signals.length === 0 && nodes.length === 0;
        for (const golden of GOLDENS) {
            draws = 0;
            fields.reset(golden.seed);
            goldenGeneration &&= draws === 1352 && fields.clouds.length === 48 && fields.signals.length === 8 &&
                fields.nodes.length === 136 && finiteState(fields) &&
                Math.abs(fields.clouds[0].baseAngle - golden.cloudAngle) < 1e-14 &&
                Math.abs(fields.signals[0].speed - golden.signalSpeed) < 1e-14 &&
                Math.abs(fields.nodes[0].phase - golden.nodePhase) < 1e-14 &&
                fields.nodes[0].neighbors.length === 3 &&
                golden.neighbors.every((neighbor, index) => fields.nodes[0].neighbors[index] === neighbor);
            stableViews &&= fields.clouds === clouds && fields.signals === signals && fields.nodes === nodes;
        }
    } finally {
        DeterministicPRNG.prototype.nextU32 = originalNextU32;
    }
    check(emptyConstructor,
        'BackgroundFields construction leaves all three public views empty and consumes no PRNG values');
    check(goldenGeneration,
        'Three boundary seeds preserve 48 clouds, 8 signals, 136 Z4 nodes, 1352 PRNG draws and fixed field/network anchors');
    check(stableViews && DeterministicPRNG.prototype.nextU32 === originalNextU32,
        'Reset preserves all three public array identities and PRNG instrumentation is restored');
    // КОНЕЦ РАЗДЕЛА 2. ГЕНЕРАЦИЯ И СТАБИЛЬНОСТЬ ПРЕДСТАВЛЕНИЙ

    // НАЧАЛО РАЗДЕЛА 3. ДЕТЕРМИНИРОВАННЫЙ ШАГ И ПЕРЕНОС ГРАНИЦ
    let deterministic = true;
    const seedStates = new Set<string>();
    for (const { seed } of GOLDENS) {
        const first = new BackgroundFields();
        const second = new BackgroundFields();
        first.reset(seed);
        second.reset(seed);
        const initial = snapshot(first);
        for (let frame = 1; frame <= 240; frame++) {
            first.step(0.05, frame * 0.05, seed);
            second.step(0.05, frame * 0.05, seed);
        }
        deterministic &&= snapshot(first) === snapshot(second) && finiteState(first) && snapshot(first) !== initial;
        seedStates.add(snapshot(first));
        first.reset(seed);
        deterministic &&= snapshot(first) === initial;
    }
    check(deterministic && seedStates.size === GOLDENS.length,
        'Reset replays the exact initial fields; equal seeds and active steps remain deterministic while distinct seeds retain distinct states');

    const fields = new BackgroundFields();
    fields.reset(104729);
    const expired = fields.signals[0];
    const escapedX = fields.signals[1];
    const escapedY = fields.signals[2];
    expired.life = expired.maxLife;
    escapedX.xNorm = 0.66;
    escapedY.yNorm = -0.63;
    const positiveBoundary = fields.nodes[0];
    const negativeBoundary = fields.nodes[1];
    Object.assign(positiveBoundary, { xNorm: 0.6199, yNorm: 0.5599, vxNorm: 0.014, vyNorm: 0.014 });
    Object.assign(negativeBoundary, { xNorm: -0.6199, yNorm: -0.5599, vxNorm: -0.014, vyNorm: -0.014 });
    fields.step(0.05, 20, 104729);
    check(fields.signals[0] !== expired && fields.signals[1] !== escapedX && fields.signals[2] !== escapedY &&
        fields.signals.length === 8 && fields.signals.slice(0, 3).every((signal) =>
            signal.life >= 0 && signal.life < signal.maxLife && Math.abs(signal.xNorm) <= 0.56 &&
            Math.abs(signal.yNorm) <= 0.54) && finiteState(fields),
        'Expired signals and signals beyond either screen boundary respawn with finite positions and remaining lifetime');
    check(positiveBoundary.xNorm === -0.62 && positiveBoundary.yNorm === -0.56 &&
        negativeBoundary.xNorm === 0.62 && negativeBoundary.yNorm === 0.56 && fields.nodes.length === 136 &&
        fields.nodes.every((node) => Math.abs(node.xNorm) <= 0.62 && Math.abs(node.yNorm) <= 0.56 &&
            node.phase >= 0 && node.phase < Math.PI * 2) && finiteState(fields),
        'Z4 nodes wrap across both positive and negative X/Y boundaries while phase and all field values stay finite');
    // КОНЕЦ РАЗДЕЛА 3. ДЕТЕРМИНИРОВАННЫЙ ШАГ И ПЕРЕНОС ГРАНИЦ
}
// КОНЕЦ ФУНКЦИИ runBackgroundFieldsChecks
