// ============================================================================
// ФАЙЛ: frontend/src/engine/passes/explanationFocusPass.ts
// НАЗНАЧЕНИЕ: Сдержанный акцент на существующих точках и связях выбранной темы.
// РАЗДЕЛЫ: 1. Бюджет и выбор объектов; 2. Общий Canvas-проход.
// ФУНКЦИИ: sampleRefraction, renderExplanationFocusPass.
// Не создаёт частиц, связей, орбит или таймеров и не меняет входные координаты.
// ============================================================================
import type { SceneExplanationFocusSnapshot } from '../../core/sceneExplanationFocus';
import type { VisualSignalSnapshot } from '../../core/visualSignals';
import type { QuantumParticle, TopologyEdge } from '../../phases/01_void';
import { stressStore, type RefractionOffset } from '../../store/stressState';
import { TAU } from '../math/noise2d';

// НАЧАЛО РАЗДЕЛА 1. БЮДЖЕТ И ОПТИЧЕСКОЕ СООТВЕТСТВИЕ
export const EXPLANATION_FOCUS_PARTICLE_LIMIT = 24;
export const EXPLANATION_FOCUS_EDGE_LIMIT = 14;
type RefractionSampler = (x: number, y: number, timeSec: number) => Pick<RefractionOffset, 'dx' | 'dy' | 'rimHighlight'>;

// НАЧАЛО ФУНКЦИИ sampleRefraction
/** Та же выборка BREACH LENS, что используется основным проходом частиц. */
function sampleRefraction(x: number, y: number, timeSec: number): RefractionOffset {
    return stressStore.getBoundaryRefractionOffset(x, y, timeSec);
}
// КОНЕЦ ФУНКЦИИ sampleRefraction
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ДОПОЛНИТЕЛЬНЫЙ АКЦЕНТ В ТЕКУЩЕМ КАДРЕ
// НАЧАЛО ФУНКЦИИ renderExplanationFocusPass
/**
 * Рисует лишь тонкие ободки уже видимых частиц и часть реальных кривых графа.
 * Родительская globalAlpha (включая уход сцены в финале) сохраняется.
 * FBM/Ouroboros усиливаются родителем в их существующих проходах, если они видимы.
 */
export function renderExplanationFocusPass(
    ctx: CanvasRenderingContext2D,
    particles: readonly QuantumParticle[],
    edges: readonly TopologyEdge[],
    signals: Readonly<VisualSignalSnapshot>,
    focus: Readonly<SceneExplanationFocusSnapshot>,
    graphVisible: boolean,
    refractAt: RefractionSampler = sampleRefraction,
): void {
    const pointWeight = Math.min(1, focus.field + focus.synchrony);
    const graphWeight = graphVisible ? focus.connections : 0;
    if (pointWeight < 0.001 && graphWeight < 0.001) return;
    ctx.save();
    const sceneAlpha = ctx.globalAlpha;
    if (pointWeight >= 0.001) {
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 0.95;
        let rendered = 0;
        for (const p of particles) {
            // Идентификатор, а не положение в Z-sort, сохраняет выбранные точки.
            if (p.id % 31 !== 0 || p.depthTier === 'FOREGROUND' || !Number.isFinite(p.x + p.y + p.radius)) continue;
            const refraction = refractAt(p.x, p.y, signals.simTimeSec);
            const breath = 0.84 + 0.24 * Math.sin(p.kuramotoPhase + signals.simTimeSec * 1.1);
            const radius = p.radius * breath * (1 + refraction.rimHighlight * 0.35 + signals.pulse * 0.14);
            const rhythm = signals.reducedMotion ? 1 : 0.66 + 0.34 * Math.cos(p.kuramotoPhase + signals.simTimeSec * 1.1);
            ctx.globalAlpha = sceneAlpha * (focus.field * 0.23 + focus.synchrony * rhythm * 0.34);
            ctx.beginPath();
            ctx.arc(p.x + refraction.dx, p.y + refraction.dy, Math.max(2.6, Math.min(6.5, radius * 1.6 + 1.6)), 0, TAU);
            ctx.stroke();
            if (++rendered >= EXPLANATION_FOCUS_PARTICLE_LIMIT) break;
        }
    }
    if (graphWeight >= 0.001) {
        ctx.strokeStyle = '#bae6fd';
        let rendered = 0;
        for (const edge of edges) {
            if (((edge.fromIndex * 31 + edge.toIndex) >>> 0) % 47 !== 0 || edge.arcLength < 8 || edge.strength <= 0) continue;
            ctx.globalAlpha = sceneAlpha * graphWeight * Math.min(0.28, 0.12 + edge.strength * 0.16);
            ctx.lineWidth = Math.max(0.9, Math.min(1.7, edge.murrayRadiusPx));
            ctx.beginPath();
            // Кривая совпадает с основным NEXUS-проходом без вторичного преломления.
            ctx.moveTo(edge.x1, edge.y1);
            ctx.quadraticCurveTo(edge.ctrlX, edge.ctrlY, edge.x2, edge.y2);
            ctx.stroke();
            if (++rendered >= EXPLANATION_FOCUS_EDGE_LIMIT) break;
        }
    }
    ctx.restore();
}
// КОНЕЦ ФУНКЦИИ renderExplanationFocusPass
// КОНЕЦ РАЗДЕЛА 2
