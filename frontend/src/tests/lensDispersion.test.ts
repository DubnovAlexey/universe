// ============================================================================
// ФАЙЛ: frontend/src/tests/lensDispersion.test.ts
// НАЗНАЧЕНИЕ: Проверить opt-in, непрерывность и ограниченный бюджет цветового эскиза.
// РАЗДЕЛЫ: 1. Режим и часы; 2. Неизменность сцены и отсутствие работы по умолчанию.
// ФУНКЦИИ: runLensDispersionChecks.
// ============================================================================
import { LensDispersionPass, isLensDispersionPreview, smoothDispersionGain } from '../engine/passes/lensDispersionPass';
import { universeStore } from '../store/universeState';
import { stressStore } from '../store/stressState';
import type { QuantumParticle } from '../phases/01_void';

// НАЧАЛО ФУНКЦИИ runLensDispersionChecks
export function runLensDispersionChecks(check: (passed: boolean, description: string) => void): void {
    check(isLensDispersionPreview('?optics=dispersion') &&
        !isLensDispersionPreview('') && !isLensDispersionPreview('?optics=rainbow'),
        'Local lens colour preview requires an explicit mode and leaves the standard palette unchanged');
    const first = smoothDispersionGain(0.35, 0.85, 1 / 60);
    let settled = 0.35;
    for (let frame = 0; frame < 180; frame++) settled = smoothDispersionGain(settled, 0.85, 1 / 60);
    check(first > 0.35 && first < 0.39 && settled > 0.849 && settled <= 0.85 &&
        smoothDispersionGain(0.35, 0.85, 0) === 0.35 &&
        Number.isFinite(smoothDispersionGain(NaN, Infinity, NaN)),
        'Lens colour strength eases across the breach switch and rejects invalid or stopped clocks');
    const state = universeStore.getState();
    const before = JSON.stringify({ phase: state.currentPhase, time: state.telemetry.simulationTimeSec, layers: state.layers });
    let touched = false;
    const ctx = new Proxy({} as CanvasRenderingContext2D, { get: () => { touched = true; throw new Error('Unexpected draw'); } });
    new LensDispersionPass(false).render(ctx, [], 1, state);
    new LensDispersionPass(true).render(ctx, [], 1, { ...state, reducedMotion: true });
    check(!touched && before === JSON.stringify({ phase: state.currentPhase, time: state.telemetry.simulationTimeSec, layers: state.layers }),
        'Disabled and reduced-motion lens previews perform no Canvas work or phase/layer/time mutation');

    const savedState = Object.getOwnPropertyDescriptor(stressStore, 'getState');
    const savedOffset = Object.getOwnPropertyDescriptor(stressStore, 'getBoundaryRefractionOffset');
    const stress = stressStore.getState();
    try {
        Object.defineProperty(stressStore, 'getState', { configurable: true, value: () => ({ ...stress,
            currentBreachRadius: 100, lensX: 0, lensY: 0, isBreaching: true }) });
        Object.defineProperty(stressStore, 'getBoundaryRefractionOffset', { configurable: true,
            value: () => ({ dx: 1, dy: 2, rimHighlight: 1, dispersionFactor: 0.85 }) });
        const particles = Array.from({ length: 400 }, () => ({ x: 100, y: 0, radius: 2,
            depthTier: 'MIDGROUND' })) as QuantumParticle[];
        const source = JSON.stringify(particles);
        let arcs = 0;
        let maxShift = 0;
        let savedAlpha = 0.7;
        const drawing = { globalAlpha: 0.7, fillStyle: '', save() { savedAlpha = this.globalAlpha; },
            restore() { this.globalAlpha = savedAlpha; }, beginPath() {}, fill() {},
            arc(x: number, y: number) { arcs++; maxShift = Math.max(maxShift, Math.hypot(x - 101, y - 2)); } } as unknown as CanvasRenderingContext2D;
        const preview = new LensDispersionPass(true);
        for (let frame = 0; frame < 120; frame++) { arcs = 0; preview.render(drawing, particles, frame / 60, { ...state, isPaused: false, reducedMotion: false }); }
        check(arcs === 48 && maxShift <= 1.4 + 1e-9 && JSON.stringify(particles) === source && drawing.globalAlpha === 0.7,
            'Lens sketch is bounded to24 pairs within1.4px of the existing refracted coordinates and never changes source particles');
    } finally {
        if (savedState) Object.defineProperty(stressStore, 'getState', savedState); else delete (stressStore as unknown as Record<string, unknown>).getState;
        if (savedOffset) Object.defineProperty(stressStore, 'getBoundaryRefractionOffset', savedOffset); else delete (stressStore as unknown as Record<string, unknown>).getBoundaryRefractionOffset;
    }
}
// КОНЕЦ ФУНКЦИИ runLensDispersionChecks
