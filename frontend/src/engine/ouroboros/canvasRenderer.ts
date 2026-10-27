// ============================================================================
// ФАЙЛ: frontend/src/engine/ouroboros/canvasRenderer.ts
// НАЗНАЧЕНИЕ: Проекция общего 3D-поля и мягкие орбитальные нити резервного Canvas.
// РАЗДЕЛЫ: 1. Атлас света; 2. Проекция точек; 3. Орбитальные нити.
// ФУНКЦИИ: createGlowAtlas, renderOuroborosCanvas, renderOuroborosFilaments.
// ============================================================================
import type { OuroborosFrame } from './types';

// НАЧАЛО РАЗДЕЛА 1. ОДНОКРАТНЫЙ АТЛАС СВЕТА
// НАЧАЛО ФУНКЦИИ createGlowAtlas
export function createGlowAtlas(document: Document): readonly HTMLCanvasElement[] {
    return [0, 1, 2].map((kind) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return canvas;
        const gradient = ctx.createRadialGradient(kind === 2 ? 26 : 32, kind === 2 ? 25 : 32, 0, 32, 32, 31);
        if (kind === 2) {
            gradient.addColorStop(0, 'rgba(235,248,255,1)');
            gradient.addColorStop(0.22, 'rgba(147,210,244,0.96)');
            gradient.addColorStop(0.43, 'rgba(44,100,152,0.92)');
            gradient.addColorStop(0.55, 'rgba(9,20,48,0.86)');
            gradient.addColorStop(0.7, 'rgba(91,170,222,0.28)');
        } else {
            gradient.addColorStop(0, kind === 0 ? 'rgba(226,245,255,0.94)' : 'rgba(146,207,249,0.68)');
            gradient.addColorStop(0.16, 'rgba(147,211,249,0.66)');
            gradient.addColorStop(0.43, 'rgba(63,127,202,0.16)');
        }
        gradient.addColorStop(1, 'rgba(23,58,118,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        return canvas;
    });
}
// КОНЕЦ ФУНКЦИИ createGlowAtlas
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПЕРСПЕКТИВНАЯ ПРОЕКЦИЯ ОБЩИХ ТОЧЕК
// НАЧАЛО ФУНКЦИИ renderOuroborosCanvas
/** Использует те же позиции/нормали Rust или TS, которые получает WebGPU. */
export function renderOuroborosCanvas(
    ctx: CanvasRenderingContext2D, frame: OuroborosFrame,
    atlas: readonly HTMLCanvasElement[], order: Uint16Array
): void {
    const { points, count, uniforms: u } = frame;
    const sizeFactor = Math.max(0.6, Math.min(1.2, Math.min(u.width, u.height) / 800));
    for (let index = 0; index < count; index++) order[index] = index;
    const sorted = order.subarray(0, count);
    sorted.sort((a, b) => points[b * 8 + 2] - points[a * 8 + 2]);
    ctx.save();
    for (let index = 0; index < count; index++) {
        const offset = sorted[index] * 8;
        const z = points[offset + 2];
        const perspective = 3 / Math.max(0.6, 3 + z);
        const kind = Math.max(0, Math.min(2, Math.round(points[offset + 7])));
        const light = Math.max(0, points[offset + 3] * -0.35 + points[offset + 4] * 0.6 + points[offset + 5] * -0.55);
        const depthFade = Math.max(0.2, Math.min(1, 0.76 - z * 0.16));
        const strength = kind === 0 ? (0.48 + 0.52 * u.morph) * (0.5 + light * 0.5) : kind === 1 ? 0.58 : 0.94;
        const radius = Math.max(0.3, points[offset + 6] * perspective * sizeFactor) * (kind === 2 ? 2.2 : 3);
        const x = u.centerX + points[offset] * u.scale * perspective;
        const y = u.centerY - points[offset + 1] * u.scale * perspective;
        ctx.globalAlpha = u.opacity * strength * depthFade;
        ctx.drawImage(atlas[kind], x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderOuroborosCanvas
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ДАЛЬНИЕ ОРБИТАЛЬНЫЕ НИТИ
// НАЧАЛО ФУНКЦИИ renderOuroborosFilaments
/** Тонкие пространственные дуги связывают локальный объект с пылевым окружением. */
export function renderOuroborosFilaments(ctx: CanvasRenderingContext2D, frame: OuroborosFrame): void {
    const u = frame.uniforms;
    ctx.save();
    ctx.lineWidth = 0.45;
    for (let ring = 0; ring < 5; ring++) {
        const radius = 1.42 + ring * 0.19;
        const turn = u.timeSec * 0.025 + ring * 0.48;
        ctx.beginPath();
        for (let point = 0; point <= 96; point++) {
            const angle = point / 96 * Math.PI * 2;
            const x0 = Math.cos(angle) * radius;
            const y0 = Math.sin(angle) * radius * 0.48;
            const z = Math.sin(angle) * radius * 0.7;
            const x = x0 * Math.cos(turn) - y0 * Math.sin(turn);
            const y = x0 * Math.sin(turn) * 0.25 + y0 * Math.cos(turn);
            const perspective = 3 / (3 + z);
            const sx = u.centerX + x * u.scale * perspective;
            const sy = u.centerY - y * u.scale * perspective;
            if (point === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.strokeStyle = `rgba(135,197,236,${(u.opacity * (0.06 + u.energy * 0.035)).toFixed(4)})`;
        ctx.stroke();
    }
    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderOuroborosFilaments
// КОНЕЦ РАЗДЕЛА 3
