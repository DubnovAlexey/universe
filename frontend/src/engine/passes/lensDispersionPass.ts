// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/lensDispersionPass.ts
// НАЗНАЧЕНИЕ: Сдержанный эскиз цветового края BREACH LENS для ?optics=dispersion.
// РАЗДЕЛЫ: 1. Режим и гладкая огибающая; 2. Цветовые спутники существующих частиц.
// ФУНКЦИИ: isLensDispersionPreview, smoothDispersionGain, render.
// Не меняет координаты, физику, граф или стандартную палитру без явного preview.
// ============================================================================
import type { QuantumParticle } from '../../phases/01_void';
import { stressStore } from '../../store/stressState';
import type { UniverseState } from '../../store/universeState';

// НАЧАЛО РАЗДЕЛА 1. РЕЖИМ И ГЛАДКАЯ ОГИБАЮЩАЯ
// НАЧАЛО ФУНКЦИИ isLensDispersionPreview
export function isLensDispersionPreview(search: string): boolean {
    return new URLSearchParams(search).get('optics') === 'dispersion';
}
// КОНЕЦ ФУНКЦИИ isLensDispersionPreview

// НАЧАЛО ФУНКЦИИ smoothDispersionGain
/** Ограничивает скорость изменения силы; разрыв isBreaching не становится вспышкой. */
export function smoothDispersionGain(current: number, target: number, dtSec: number): number {
    const from = Number.isFinite(current) ? Math.max(0, Math.min(0.85, current)) : 0;
    const to = Number.isFinite(target) ? Math.max(0, Math.min(0.85, target)) : 0;
    const dt = Number.isFinite(dtSec) ? Math.max(0, Math.min(0.1, dtSec)) : 0;
    return from + (to - from) * (1 - Math.exp(-dt / 0.3));
}
// КОНЕЦ ФУНКЦИИ smoothDispersionGain
// КОНЕЦ РАЗДЕЛА 1

export class LensDispersionPass {
    private gain = 0;
    private lastTimeSec: number | null = null;

    constructor(public readonly enabled = isLensDispersionPreview(
        typeof window !== 'undefined' ? window.location.search : '')) {}

    // НАЧАЛО РАЗДЕЛА 2. ЦВЕТОВЫЕ СПУТНИКИ СУЩЕСТВУЮЩИХ ЧАСТИЦ
    // НАЧАЛО ФУНКЦИИ render
    /** Рисуется под основными белыми ядрами; не более24 пар на кадр, без новых текстур. */
    public render(ctx: CanvasRenderingContext2D, particles: readonly QuantumParticle[],
        simTimeSec: number, state: Readonly<UniverseState>): void {
        if (!this.enabled || state.reducedMotion || !Number.isFinite(simTimeSec)) return;
        const stress = stressStore.getState();
        const target = stress.isBreaching ? 0.85 : 0.35;
        const dt = this.lastTimeSec === null ? 0 : simTimeSec - this.lastTimeSec;
        this.lastTimeSec = simTimeSec;
        if (!state.isPaused) this.gain = smoothDispersionGain(this.gain, target, dt);
        if (this.gain < 0.001 || stress.currentBreachRadius < 8) return;

        ctx.save();
        const parentAlpha = ctx.globalAlpha;
        let rendered = 0;
        for (let index = 0; index < particles.length && rendered < 24; index += 7) {
            const p = particles[index];
            if (p.depthTier === 'FOREGROUND') continue;
            const offset = stressStore.getBoundaryRefractionOffset(p.x, p.y, simTimeSec);
            // Сам коэффициент строго нулевой вне оптической кромки.
            const dispersion = offset.dispersionFactor * this.gain / target;
            if (dispersion < 0.002) continue;
            const dx = p.x - stress.lensX;
            const dy = p.y - stress.lensY;
            const length = Math.hypot(dx, dy);
            if (length < 0.001) continue;
            const shift = Math.min(1.4, dispersion * 1.65);
            const x = p.x + offset.dx;
            const y = p.y + offset.dy;
            const nx = dx / length * shift;
            const ny = dy / length * shift;
            const radius = Math.max(0.8, Math.min(3.0, p.radius * 1.45));
            ctx.globalAlpha = parentAlpha * Math.min(0.14, dispersion * 0.17);
            ctx.fillStyle = '#70cef0';
            ctx.beginPath(); ctx.arc(x + nx, y + ny, radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e9b5a4';
            ctx.beginPath(); ctx.arc(x - nx, y - ny, radius, 0, Math.PI * 2); ctx.fill();
            rendered++;
        }
        ctx.restore();
    }
    // КОНЕЦ ФУНКЦИИ render
    // КОНЕЦ РАЗДЕЛА 2
}
