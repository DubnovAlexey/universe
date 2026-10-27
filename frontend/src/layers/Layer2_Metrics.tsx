// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer2_Metrics.tsx
// НАЗНАЧЕНИЕ: Автономная DOM/SVG JSX-фабрика, 60-FPS контроллер «Цифрового
//             водопада / Звездопада» с синхронизацией от музыки и каскад LAYER_02
// ============================================================================
// ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ:
//   РАЗДЕЛ 1. Нативная DOM/SVG фабрика React.createElement: создание узлов HTML и SVG
//             (http://www.w3.org/2000/svg) без сторонних runtime-зависимостей.
//   РАЗДЕЛ 2. Генератор спокойного волнового контура (buildLivingBreachContourPath)
//             и плавной подзаголовочной волны (buildLivingHorizontalWavePath).
//   РАЗДЕЛ 3. Контроллер общего кадра (TelemetryWaterfallAnimator): непрерывное
//             обновление контуров, падающих буковок и дыхания цифр ([data-breath-slot])
//             в такт музыке, с кешем DOM и отключением при снятии каскадов.
//   РАЗДЕЛ 4. Представление и mount-once монтировщик верхнего каскада (renderLayer2MetricsView,
//             mountLayer2Metrics) с честной динамической подписью источника физики
//             ([rust/gravity.rs] при WASM_ACTIVE или [ts/wasmBridge.ts] при TS_FALLBACK).
// ============================================================================

import { universeStore, type UniverseState } from '../store/universeState';
import { getVisualSignals, subscribeVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';
import { pickGlyph } from '../core/glyphGrammar';

// ============================================================================
// РАЗДЕЛ 1. АВТОНОМНАЯ ФАБРИКА JSX -> DOM/SVG ELEMENT (БЕЗ ОШИБКИ TS2322)
// ============================================================================

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SVG_TAG_NAMES = new Set<string>([
    'svg',
    'defs',
    'linearGradient',
    'radialGradient',
    'stop',
    'path',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'rect',
    'g',
]);

// --- НАЧАЛО ФУНКЦИИ appendJsxChildren ---
function appendJsxChildren(parent: Node, children: unknown[]): void {
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (Array.isArray(child)) {
            appendJsxChildren(parent, child);
        } else if (child instanceof Node) {
            parent.appendChild(child);
        } else if (child !== null && child !== undefined && typeof child !== 'boolean') {
            parent.appendChild(document.createTextNode(String(child)));
        }
    }
}
// --- КОНЕЦ ФУНКЦИИ appendJsxChildren ---

export const React = {
    // --- НАЧАЛО ФУНКЦИИ createElement ---
    createElement(
        tag: string | ((props: Record<string, unknown>) => Element),
        props: Record<string, unknown> | null,
        ...children: unknown[]
    ): Element {
        if (typeof tag === 'function') {
            return tag({ ...(props ?? {}), children });
        }

        const isSvg = SVG_TAG_NAMES.has(tag);
        const el = isSvg
            ? document.createElementNS(SVG_NAMESPACE, tag)
            : document.createElement(tag);

        if (props) {
            const keys = Object.keys(props);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const val = props[key];
                if (
                    val === undefined ||
                    val === null ||
                    val === false ||
                    key === 'children' ||
                    key === 'key'
                ) {
                    continue;
                }

                if (key === 'className') {
                    if (isSvg) {
                        el.setAttribute('class', String(val));
                    } else {
                        (el as HTMLElement).className = String(val);
                    }
                } else if (key === 'style' && typeof val === 'object') {
                    const styleRecord = val as Record<string, string | number | undefined>;
                    const styleKeys = Object.keys(styleRecord);
                    for (let s = 0; s < styleKeys.length; s++) {
                        const sKey = styleKeys[s];
                        const sVal = styleRecord[sKey];
                        if (sVal !== undefined) {
                            const cssProp = sKey.replace(
                                /[A-Z]/g,
                                (m: string) => `-${m.toLowerCase()}`
                            );
                            (el as HTMLElement).style.setProperty(cssProp, String(sVal));
                        }
                    }
                } else if (key.startsWith('on') && typeof val === 'function') {
                    const eventName = key.slice(2).toLowerCase();
                    el.addEventListener(eventName, val as EventListener);
                } else if (val === true) {
                    el.setAttribute(key, '');
                } else {
                    el.setAttribute(key, String(val));
                }
            }
        }

        appendJsxChildren(el, children);
        return el;
    },
    // --- КОНЕЦ ФУНКЦИИ createElement ---
};

// ============================================================================
// РАЗДЕЛ 2. ГЕНЕРАТОР ПЛАВНОГО ВОЛНОВОГО КОНТУРА С МУЗЫКАЛЬНОЙ ОГИБАЮЩЕЙ
// ============================================================================

export interface StarfallDroplet {
    id: number;
    cascadeId: 2 | 3 | 4;
    glyph: string;
    xPercent: number;
    startYPercent: number;
    yOffsetPx: number;
    xDriftPx: number;
    velocityPx: number;
    opacity: number;
    scale: number;
    life: number;
    maxLife: number;
}

// --- НАЧАЛО ФУНКЦИИ buildLivingBreachContourPath ---
export function buildLivingBreachContourPath(
    width: number,
    height: number,
    timeSec: number,
    phaseOffset = 0,
    audioBoost = 0
): string {
    const padX = 12;
    const padY = 9;
    const w = Math.max(120, width - padX * 2);
    const h = Math.max(70, height - padY * 2);
    const vSteps = 28;
    const hSteps = 16;
    const pts: Array<[number, number]> = [];
    const musicScale = 1.0 + Math.min(0.35, audioBoost * 0.28);

    for (let i = 0; i <= vSteps; i++) {
        const u = i / vSteps;
        const y = padY + u * h;
        const env = (0.22 + 0.78 * Math.sin(u * Math.PI)) * musicScale;
        const wave =
            env *
            (5.8 * Math.sin(u * 7.2 - timeSec * 1.15 + phaseOffset) +
                2.7 * Math.cos(u * 12.5 + timeSec * 1.45));
        pts.push([padX + wave, y]);
    }

    for (let i = 1; i <= hSteps; i++) {
        const u = i / hSteps;
        const x = padX + u * w;
        const env = (0.22 + 0.78 * Math.sin(u * Math.PI)) * musicScale;
        const wave =
            env *
            (3.8 * Math.sin(u * 6.2 + timeSec * 1.2 + phaseOffset) +
                1.6 * Math.cos(u * 10.5 - timeSec * 1.4));
        pts.push([x, padY + h + wave]);
    }

    for (let i = 1; i <= vSteps; i++) {
        const u = 1.0 - i / vSteps;
        const y = padY + u * h;
        const env = (0.22 + 0.78 * Math.sin(u * Math.PI)) * musicScale;
        const wave =
            env *
            (4.9 * Math.cos(u * 7.2 + timeSec * 1.1 + phaseOffset) +
                2.3 * Math.sin(u * 12.5 - timeSec * 1.38));
        pts.push([padX + w + wave, y]);
    }

    for (let i = 1; i < hSteps; i++) {
        const u = 1.0 - i / hSteps;
        const x = padX + u * w;
        const env = (0.22 + 0.78 * Math.sin(u * Math.PI)) * musicScale;
        const wave =
            env *
            (3.5 * Math.cos(u * 6.2 - timeSec * 1.15 + phaseOffset) +
                1.5 * Math.sin(u * 10.5 + timeSec * 1.32));
        pts.push([x, padY + wave]);
    }

    if (pts.length === 0) return '';
    let pathStr = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
        pathStr += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    }
    return pathStr + ' Z';
}
// --- КОНЕЦ ФУНКЦИИ buildLivingBreachContourPath ---

// --- НАЧАЛО ФУНКЦИИ buildLivingHorizontalWavePath ---
export function buildLivingHorizontalWavePath(
    width: number,
    yCenter: number,
    timeSec: number,
    phaseOffset = 0,
    amplitude = 2.6
): string {
    const padX = 18;
    const spanW = Math.max(80, width - padX * 2);
    const steps = 24;
    let d = '';

    for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const x = padX + u * spanW;
        const env = 0.2 + 0.8 * Math.sin(u * Math.PI);
        const y =
            yCenter +
            env *
            (amplitude * Math.sin(u * 6.8 - timeSec * 1.22 + phaseOffset) +
                amplitude * 0.4 * Math.cos(u * 12.4 + timeSec * 1.55 - phaseOffset));
        d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
}
// --- КОНЕЦ ФУНКЦИИ buildLivingHorizontalWavePath ---

// ============================================================================
// РАЗДЕЛ 3. КОНТРОЛЛЕР ОБЩЕГО КАДРА И КЕШ DOM ПРИВЯЗОК КАСКАДОВ
// ============================================================================

type CascadeId = 2 | 3 | 4;
interface WaterfallCascadeBinding {
    root: HTMLElement;
    contours: SVGPathElement[];
    dividers: { node: SVGPathElement; y: number; amplitude: number }[];
    streams: HTMLElement[];
    breaths: { node: HTMLElement; slotKey: string; seed: number }[];
    drops: { container: HTMLElement; nodes: Map<number, HTMLElement> }[];
}

export class TelemetryWaterfallAnimator {
    private droplets: StarfallDroplet[] = [];
    private ignitedSlots: Map<string, number> = new Map();
    private nextSpawnSec: Record<2 | 3 | 4, number> = { 2: 0.5, 3: 0.85, 4: 1.2 };
    private dropCounter = 1;
    private unsubscribeSignals: (() => void) | null = null;
    private cascades = new Map<CascadeId, WaterfallCascadeBinding>();
    private smoothedMusicPulse = 0.22;
    private smoothedMusicLow = 0.2;
    private lastSignalSec = 0;

    // --- НАЧАЛО ФУНКЦИИ constructor (TelemetryWaterfallAnimator) ---
    public constructor(private readonly subscribeFrame: typeof subscribeVisualSignals = subscribeVisualSignals) {}
    // --- КОНЕЦ ФУНКЦИИ constructor (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ getTimeSec (TelemetryWaterfallAnimator) ---
    public getTimeSec(): number {
        return getVisualSignals().simTimeSec;
    }
    // --- КОНЕЦ ФУНКЦИИ getTimeSec (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ ensureRunning (TelemetryWaterfallAnimator) ---
    public ensureRunning(): void {
        if (!this.unsubscribeSignals && this.cascades.size) {
            this.unsubscribeSignals = this.subscribeFrame(this.tick);
        }
    }
    // --- КОНЕЦ ФУНКЦИИ ensureRunning (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ bindCascade (TelemetryWaterfallAnimator) ---
    /** Привязки статичных узлов собираются один раз после монтирования каскада. */
    public bindCascade(id: CascadeId, root: HTMLElement): void {
        const drops = Array.from(root.querySelectorAll<HTMLElement>('.starfall-drops-layer[data-cascade-drops]'))
            .map((container) => ({
                container,
                nodes: new Map(Array.from(container.querySelectorAll<HTMLElement>('span[data-drop-id]'))
                    .map((node) => [Number(node.getAttribute('data-drop-id')), node] as const)),
            }));
        this.cascades.set(id, {
            root,
            contours: Array.from(root.querySelectorAll<SVGPathElement>('path[data-breach-contour]')),
            dividers: Array.from(root.querySelectorAll<SVGPathElement>('path[data-breach-wave-line]'))
                .map((node) => ({
                    node,
                    y: Number(node.getAttribute('data-wave-y') || '42'),
                    amplitude: Number(node.getAttribute('data-wave-amp') || '2.6'),
                })),
            streams: Array.from(root.querySelectorAll<HTMLElement>('.waterfall-stream-overlay')),
            breaths: Array.from(root.querySelectorAll<HTMLElement>('[data-breath-slot]'))
                .map((node) => ({
                    node,
                    slotKey: node.getAttribute('data-breath-slot') || 'slot',
                    seed: Number(node.getAttribute('data-breath-seed') || '0'),
                })),
            drops,
        });
        this.ensureRunning();
    }
    // --- КОНЕЦ ФУНКЦИИ bindCascade (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ releaseCascade (TelemetryWaterfallAnimator) ---
    public releaseCascade(id: CascadeId, root?: HTMLElement | null): void {
        if (root && this.cascades.get(id)?.root !== root) return;
        this.cascades.delete(id);
        this.droplets = this.droplets.filter((drop) => drop.cascadeId !== id);
        this.ignitedSlots.forEach((_time, key) => {
            if (key.startsWith(`l${id}_`)) this.ignitedSlots.delete(key);
        });
        if (!this.cascades.size) {
            this.unsubscribeSignals?.();
            this.unsubscribeSignals = null;
        }
    }
    // --- КОНЕЦ ФУНКЦИИ releaseCascade (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ tick (TelemetryWaterfallAnimator) ---
    private tick = (signals: Readonly<VisualSignalSnapshot>): void => {
        if (signals.isPaused || signals.reducedMotion) return;

        const visible: [CascadeId, WaterfallCascadeBinding][] = [];
        this.cascades.forEach((binding, id) => {
            if (!binding.root.isConnected) this.releaseCascade(id, binding.root);
            else if (!binding.root.classList.contains('layer-hidden')) visible.push([id, binding]);
        });
        if (!visible.length) return;

        const dt = signals.frameDtSec;
        const timeSec = signals.simTimeSec;
        if (timeSec < this.lastSignalSec) {
            this.nextSpawnSec = { 2: timeSec + 0.5, 3: timeSec + 0.85, 4: timeSec + 1.2 };
            this.droplets = [];
            this.ignitedSlots.clear();
        }
        this.lastSignalSec = timeSec;

        this.smoothedMusicPulse = signals.pulse;
        this.smoothedMusicLow = signals.low;
        this.stepDroplets(dt, timeSec, visible.map(([id]) => id), signals);
        this.updateLiveDomElements(timeSec, visible);
    };
    // --- КОНЕЦ ФУНКЦИИ tick (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ stepDroplets (TelemetryWaterfallAnimator) ---
    private stepDroplets(
        dt: number,
        timeSec: number,
        cascades: readonly CascadeId[],
        signals: Readonly<VisualSignalSnapshot>
    ): void {
        const slotPools: Record<2 | 3 | 4, ReadonlyArray<string>> = {
            2: ['l2_fps', 'l2_drift', 'l2_kuramoto', 'l2_nodes', 'l2_core', 'l2_audio'],
            3: ['l3_trunks', 'l3_bridges', 'l3_dendrites', 'l3_deg', 'l3_diam', 'l3_pulses'],
            4: ['l4_mod0', 'l4_mod1', 'l4_mod2', 'l4_ledger', 'l4_log0'],
        };

        for (let c = 0; c < cascades.length; c++) {
            const cId = cascades[c];
            if (timeSec >= this.nextSpawnSec[cId]) {
                const interval =
                    0.58 + Math.abs(Math.sin(timeSec * 1.35 + cId * 1.7)) * 0.92;
                this.nextSpawnSec[cId] = timeSec + interval;

                const pool = slotPools[cId];
                const slotKey = pool[(this.dropCounter * 3 + cId) % pool.length];
                this.ignitedSlots.set(slotKey, timeSec);

                const glyph = pickGlyph(signals.phase, this.dropCounter, Math.floor(timeSec * 3), signals.seed);

                this.droplets.push({
                    id: this.dropCounter++,
                    cascadeId: cId,
                    glyph,
                    xPercent: 18 + ((this.dropCounter * 29) % 68),
                    startYPercent: 22 + ((this.dropCounter * 19) % 54),
                    yOffsetPx: 0,
                    xDriftPx: 0,
                    velocityPx: 30 + ((this.dropCounter * 13) % 22),
                    opacity: 0.86,
                    scale: 1.03,
                    life: 0,
                    maxLife: 1.48 + ((this.dropCounter * 7) % 8) * 0.1,
                });
            }
        }

        const active: StarfallDroplet[] = [];
        for (let i = 0; i < this.droplets.length; i++) {
            const d = this.droplets[i];
            if (!cascades.includes(d.cascadeId)) {
                active.push(d);
                continue;
            }
            const nextLife = d.life + dt;
            if (nextLife >= d.maxLife) continue;
            const prog = nextLife / d.maxLife;
            const nextVel = d.velocityPx + 42 * dt;
            const nextOpacity = Math.max(0, (1 - prog) * (1 - prog * 0.55) * 0.86);
            if (nextOpacity <= 0.02) continue;

            active.push({
                ...d,
                life: nextLife,
                velocityPx: nextVel,
                yOffsetPx: d.yOffsetPx + nextVel * dt,
                xDriftPx: Math.sin(nextLife * 2.9 + d.id) * 4.2 * prog,
                opacity: nextOpacity,
                scale: 1.03 - prog * 0.2,
            });
        }
        this.droplets = active.slice(-28);
    }
    // --- КОНЕЦ ФУНКЦИИ stepDroplets (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ computeSlotBreathCss (TelemetryWaterfallAnimator) ---
    public computeSlotBreathCss(
        slotKey: string,
        phaseSeed: number,
        timeSec: number
    ): { transform: string; color: string; textShadow: string } {
        const ignitedAt = this.ignitedSlots.get(slotKey) ?? -10;
        const elapsed = timeSec - ignitedAt;
        const reigniteWave =
            elapsed >= 0 && elapsed < 0.55
                ? Math.sin((elapsed / 0.55) * Math.PI)
                : 0.0;

        const musicMod = 1.0 + this.smoothedMusicPulse * 0.35;
        const breathScale =
            1.0 +
            0.016 * musicMod * Math.sin(timeSec * 1.25 + phaseSeed) +
            reigniteWave * 0.032;
        const gentleY =
            0.75 * Math.cos(timeSec * 1.05 + phaseSeed * 0.8) - reigniteWave * 2.2;

        return {
            transform: `translate3d(0, ${gentleY.toFixed(2)}px, 0) scale(${breathScale.toFixed(
                4
            )})`,
            color: reigniteWave > 0.35 ? '#f8fafc' : '#e0f2fe',
            textShadow:
                reigniteWave > 0.35
                    ? '0 0 11px rgba(186, 230, 253, 0.78), 0 0 18px rgba(56, 189, 248, 0.45)'
                    : `0 0 ${(6 + this.smoothedMusicLow * 6).toFixed(
                        1
                    )}px rgba(56, 189, 248, ${(0.26 + this.smoothedMusicPulse * 0.22).toFixed(
                        2
                    )})`,
        };
    }
    // --- КОНЕЦ ФУНКЦИИ computeSlotBreathCss (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ updateLiveDomElements (TelemetryWaterfallAnimator) ---
    private updateLiveDomElements(
        timeSec: number,
        visible: readonly [CascadeId, WaterfallCascadeBinding][]
    ): void {
        visible.forEach(([id, binding]) => {
            binding.contours.forEach((path) => {
                path.setAttribute('d', buildLivingBreachContourPath(
                    418, 280, timeSec, (id - 2) * 1.25, this.smoothedMusicLow
                ));
            });
            binding.dividers.forEach(({ node, y, amplitude }) => {
                node.setAttribute('d', buildLivingHorizontalWavePath(
                    418, y, timeSec, (id - 2) * 1.3,
                    amplitude * (1 + this.smoothedMusicPulse * 0.25)
                ));
            });
            binding.streams.forEach((node) => {
                const y = (timeSec * (11 + (id - 2) * 1.4)) % 120;
                node.style.backgroundPosition = `0px ${y.toFixed(1)}px`;
            });
            binding.breaths.forEach(({ node, slotKey, seed }) => {
                const css = this.computeSlotBreathCss(slotKey, seed, timeSec);
                node.style.transform = css.transform;
                node.style.color = css.color;
                node.style.textShadow = css.textShadow;
            });

            binding.drops.forEach(({ container, nodes }) => {
                const drops = this.getDropletsForCascade(id);
                const activeIds = new Set<number>();
                drops.forEach((drop) => {
                    activeIds.add(drop.id);
                    let span = nodes.get(drop.id);
                    if (!span) {
                        span = container.ownerDocument.createElement('span');
                        span.className = 'starfall-glyph';
                        span.setAttribute('data-drop-id', String(drop.id));
                        span.textContent = drop.glyph;
                        span.style.left = `${drop.xPercent}%`;
                        span.style.top = `${drop.startYPercent}%`;
                        container.appendChild(span);
                        nodes.set(drop.id, span);
                    }
                    span.style.opacity = drop.opacity.toFixed(3);
                    span.style.transform = `translate3d(${drop.xDriftPx.toFixed(1)}px, ${drop.yOffsetPx.toFixed(1)}px, 0) scale(${drop.scale.toFixed(2)})`;
                });
                nodes.forEach((node, dropId) => {
                    if (!activeIds.has(dropId)) {
                        node.remove();
                        nodes.delete(dropId);
                    }
                });
            });
        });
    }
    // --- КОНЕЦ ФУНКЦИИ updateLiveDomElements (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ getDropletsForCascade (TelemetryWaterfallAnimator) ---
    public getDropletsForCascade(cascadeId: 2 | 3 | 4): ReadonlyArray<StarfallDroplet> {
        return this.droplets.filter((d: StarfallDroplet) => d.cascadeId === cascadeId);
    }
    // --- КОНЕЦ ФУНКЦИИ getDropletsForCascade (TelemetryWaterfallAnimator) ---

    // --- НАЧАЛО ФУНКЦИИ getBreathingSlotStyle (TelemetryWaterfallAnimator) ---
    public getBreathingSlotStyle(
        slotKey: string,
        phaseSeed: number
    ): Record<string, string | number> {
        const timeSec = this.getTimeSec();
        const css = this.computeSlotBreathCss(slotKey, phaseSeed, timeSec);
        return {
            display: 'inline-block',
            transform: css.transform,
            color: css.color,
            textShadow: css.textShadow,
        };
    }
    // --- КОНЕЦ ФУНКЦИИ getBreathingSlotStyle (TelemetryWaterfallAnimator) ---
}

export const waterfallAnimator = new TelemetryWaterfallAnimator();

// --- НАЧАЛО ФУНКЦИИ renderWaterfallMembraneDecor ---
export function renderWaterfallMembraneDecor(cascadeId: 2 | 3 | 4): Element[] {
    const timeSec = waterfallAnimator.getTimeSec();
    const phaseOffset = (cascadeId - 2) * 1.25;
    const contourD = buildLivingBreachContourPath(418, 280, timeSec, phaseOffset, 0.2);
    const headerWaveD = buildLivingHorizontalWavePath(
        418,
        42,
        timeSec,
        phaseOffset + 0.4,
        2.6
    );

    const drops = waterfallAnimator.getDropletsForCascade(cascadeId);
    const shiftY = (timeSec * (11.0 + (cascadeId - 2) * 1.4)) % 120;

    const bgGradId = `breachWaterfallBg_${cascadeId}`;
    const strokeGradId = `breachWaterfallStroke_${cascadeId}`;

    const svgContour = (
        <svg
            className="waterfall-contour-svg"
            viewBox="0 0 418 280"
            preserveAspectRatio="none"
        >
            <defs>
                <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(3, 8, 22, 0.78)" />
                    <stop offset="55%" stopColor="rgba(6, 15, 36, 0.66)" />
                    <stop offset="100%" stopColor="rgba(2, 5, 14, 0.82)" />
                </linearGradient>
                <linearGradient id={strokeGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(125, 211, 252, 0.68)" />
                    <stop offset="50%" stopColor="rgba(99, 102, 241, 0.42)" />
                    <stop offset="100%" stopColor="rgba(56, 189, 248, 0.64)" />
                </linearGradient>
            </defs>
            <path
                data-breach-contour={String(cascadeId)}
                d={contourD}
                fill={`url(#${bgGradId})`}
                stroke={`url(#${strokeGradId})`}
                stroke-width="1.45"
            />
            <path
                data-breach-wave-line={String(cascadeId)}
                data-wave-y="42"
                data-wave-amp="2.6"
                d={headerWaveD}
                fill="none"
                stroke="rgba(125, 211, 252, 0.34)"
                stroke-width="1.05"
            />
        </svg>
    );

    const streamOverlay = (
        <div
            className="waterfall-stream-overlay"
            style={{ backgroundPosition: `0px ${shiftY.toFixed(1)}px` }}
        />
    );

    const dropsLayer = (
        <div
            className="starfall-drops-layer"
            data-cascade-drops={String(cascadeId)}
        >
            {drops.map((drop: StarfallDroplet) => (
                <span
                    key={drop.id}
                    data-drop-id={String(drop.id)}
                    className="starfall-glyph"
                    style={{
                        left: `${drop.xPercent}%`,
                        top: `${drop.startYPercent}%`,
                        opacity: drop.opacity.toFixed(3),
                        transform: `translate3d(${drop.xDriftPx.toFixed(
                            1
                        )}px, ${drop.yOffsetPx.toFixed(1)}px, 0) scale(${drop.scale.toFixed(2)})`,
                    }}
                >
                    {drop.glyph}
                </span>
            ))}
        </div>
    );

    return [svgContour, streamOverlay, dropsLayer];
}
// --- КОНЕЦ ФУНКЦИИ renderWaterfallMembraneDecor ---

// ============================================================================
// РАЗДЕЛ 4. ПРЕДСТАВЛЕНИЕ И MOUNT-ONCE МОНТИРОВЩИК LAYER 2: METRICS
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ resolvePhysicsModuleTag ---
function resolvePhysicsModuleTag(wasmStatus: UniverseState['telemetry']['wasmStatus']): string {
    return wasmStatus === 'WASM_ACTIVE'
        ? '[rust/gravity.rs]'
        : '[ts/wasmBridge.ts]';
}
// --- КОНЕЦ ФУНКЦИИ resolvePhysicsModuleTag ---

// --- НАЧАЛО ФУНКЦИИ renderLayer2MetricsView ---
export function renderLayer2MetricsView(snap: Readonly<UniverseState>): Element {
    const t = snap.telemetry;
    const isVisible =
        snap.layers.layer2_metricsHud ||
        snap.layers.layer5_truthXRayMode ||
        snap.inspectionLevel === 'METRICS';
    const hiddenClass = isVisible ? '' : ' layer-hidden';
    const decor = renderWaterfallMembraneDecor(2);
    const physSourceTag = resolvePhysicsModuleTag(t.wasmStatus);

    return (
        <aside
            className={`hud-panel metrics-inspector-v2${hiddenClass}`}
            data-ui-panel="true"
            aria-label="Инженерная телеметрия полиглот-ядра"
        >
            {decor}

            <div className="waterfall-panel-content">
                <div className="inspector-header">
                    <span className="phase-codename">LAYER_02 // POLYGLOT TELEMETRY</span>
                    <span
                        className="digest-badge"
                        data-bind="l2-digest"
                        title="32-bit FNV-1a State Digest (ILLUSION == NEXUS == X-RAY)"
                    >
                        DIGEST: {t.stateDigestHex}
                    </span>
                </div>

                <div className="metrics-grid">
                    <div className="metric-box">
                        <span className="label">FPS / P95 [ts/UniverseRenderer.ts]</span>
                        <span
                            className="value"
                            data-breath-slot="l2_fps"
                            data-breath-seed="0.4"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_fps', 0.4)}
                        >
                            <span data-bind="l2-fps">{t.fps} FPS </span>
                            <small data-bind="l2-frametime">
                                ({t.frameTimeMs}/{t.frameTimeP95Ms}ms)
                            </small>
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label" data-bind="l2-drift-label">
                            REF64 ΔE/E₀ {physSourceTag}
                        </span>
                        <span
                            className="value"
                            data-bind="l2-drift"
                            data-breath-slot="l2_drift"
                            data-breath-seed="1.2"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_drift', 1.2)}
                        >
                            {t.energyDriftRatio.toExponential(2)}
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label" data-bind="l2-kuramoto-label">
                            KURAMOTO r(t) {physSourceTag}
                        </span>
                        <span
                            className="value"
                            data-bind="l2-kuramoto"
                            data-breath-slot="l2_kuramoto"
                            data-breath-seed="2.1"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_kuramoto', 2.1)}
                        >
                            {t.kuramotoOrderR.toFixed(3)}
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label">NODES / EDGES [ts/graph_engine]</span>
                        <span
                            className="value"
                            data-bind="l2-nodes"
                            data-breath-slot="l2_nodes"
                            data-breath-seed="2.9"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_nodes', 2.9)}
                        >
                            {t.activeParticles} / {t.activeConnections}
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label">CORE STATUS [IntegrationRegistry]</span>
                        <span
                            className="value"
                            data-bind="l2-core"
                            data-breath-slot="l2_core"
                            data-breath-seed="3.7"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_core', 3.7)}
                        >
                            {t.wasmStatus} · {t.pythonBackendStatus}
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label">AUDIO RMS [web-audio]</span>
                        <span
                            className="value"
                            data-bind="l2-audio"
                            data-breath-slot="l2_audio"
                            data-breath-seed="4.5"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_audio', 4.5)}
                        >
                            {t.audioStatus} ({t.silenceRmsDb.toFixed(1)} dBFS)
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
// --- КОНЕЦ ФУНКЦИИ renderLayer2MetricsView ---

// --- НАЧАЛО ФУНКЦИИ mountLayer2Metrics ---
export function mountLayer2Metrics(container: HTMLElement | null): () => void {
    if (!container) return () => {};

    let rootEl: HTMLElement | null = null;
    let elDigest: HTMLElement | null = null;
    let elFps: HTMLElement | null = null;
    let elFrameTime: HTMLElement | null = null;
    let elDriftLabel: HTMLElement | null = null;
    let elDrift: HTMLElement | null = null;
    let elKuramotoLabel: HTMLElement | null = null;
    let elKuramoto: HTMLElement | null = null;
    let elNodes: HTMLElement | null = null;
    let elCore: HTMLElement | null = null;
    let elAudio: HTMLElement | null = null;

    // --- НАЧАЛО ФУНКЦИИ update (mountLayer2Metrics) ---
    const update = (state: Readonly<UniverseState>): void => {
        if (!rootEl || !container.contains(rootEl)) {
            rootEl = renderLayer2MetricsView(state) as HTMLElement;
            container.replaceChildren(rootEl);
            waterfallAnimator.bindCascade(2, rootEl);
            elDigest = rootEl.querySelector<HTMLElement>('[data-bind="l2-digest"]');
            elFps = rootEl.querySelector<HTMLElement>('[data-bind="l2-fps"]');
            elFrameTime = rootEl.querySelector<HTMLElement>('[data-bind="l2-frametime"]');
            elDriftLabel = rootEl.querySelector<HTMLElement>('[data-bind="l2-drift-label"]');
            elDrift = rootEl.querySelector<HTMLElement>('[data-bind="l2-drift"]');
            elKuramotoLabel = rootEl.querySelector<HTMLElement>('[data-bind="l2-kuramoto-label"]');
            elKuramoto = rootEl.querySelector<HTMLElement>('[data-bind="l2-kuramoto"]');
            elNodes = rootEl.querySelector<HTMLElement>('[data-bind="l2-nodes"]');
            elCore = rootEl.querySelector<HTMLElement>('[data-bind="l2-core"]');
            elAudio = rootEl.querySelector<HTMLElement>('[data-bind="l2-audio"]');
            return;
        }

        const t = state.telemetry;
        const isVisible =
            state.layers.layer2_metricsHud ||
            state.layers.layer5_truthXRayMode ||
            state.inspectionLevel === 'METRICS';
        rootEl.classList.toggle('layer-hidden', !isVisible);

        const physSourceTag = resolvePhysicsModuleTag(t.wasmStatus);

        if (elDigest) elDigest.textContent = `DIGEST: ${t.stateDigestHex}`;
        if (elFps) elFps.textContent = `${t.fps} FPS `;
        if (elFrameTime) {
            elFrameTime.textContent = `(${t.frameTimeMs}/${t.frameTimeP95Ms}ms)`;
        }
        if (elDriftLabel) elDriftLabel.textContent = `REF64 ΔE/E₀ ${physSourceTag}`;
        if (elDrift) elDrift.textContent = t.energyDriftRatio.toExponential(2);
        if (elKuramotoLabel) elKuramotoLabel.textContent = `KURAMOTO r(t) ${physSourceTag}`;
        if (elKuramoto) elKuramoto.textContent = t.kuramotoOrderR.toFixed(3);
        if (elNodes) {
            elNodes.textContent = `${t.activeParticles} / ${t.activeConnections}`;
        }
        if (elCore) {
            elCore.textContent = `${t.wasmStatus} · ${t.pythonBackendStatus}`;
        }
        if (elAudio) {
            elAudio.textContent = `${t.audioStatus} (${t.silenceRmsDb.toFixed(1)} dBFS)`;
        }
    };
    // --- КОНЕЦ ФУНКЦИИ update (mountLayer2Metrics) ---

    const unsubscribe = universeStore.subscribe(update);
    return () => {
        unsubscribe();
        waterfallAnimator.releaseCascade(2, rootEl);
    };
}
// --- КОНЕЦ ФУНКЦИИ mountLayer2Metrics ---

export default renderLayer2MetricsView;
