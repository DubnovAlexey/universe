// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer2_Metrics.tsx
// НАЗНАЧЕНИЕ: Автономная DOM/SVG JSX-фабрика React, общий движок «Цифрового
//             водопада / Звездопада» и верхний каскад телеметрии (LAYER_02)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Нативная DOM/SVG фабрика React.createElement: создание элементов HTML
//    и SVG (http://www.w3.org/2000/svg), привязка inline-стилей и событий
//    в строгом соответствии с контрактом JSX.Element = globalThis.Element.
// 2. Математический генератор живого контура мембраны (buildLivingBreachContourPath)
//    и стохастический контроллер «Звездопада / Капель» (StarfallController):
//    расчёт волновых границ X_border(y, t) без прямых углов и неравномерного
//    падения отделившихся цифр с прокруткой обновлённого значения на месте.
// 3. Представление верхнего каскада (renderLayer2MetricsView): вывод укрупнённых
//    реально измеряемых показателей FPS, P95, дрейфа энергии ΔE/E0, параметра
//    Курамото r(t), 32-битного FNV-1a State Digest и статуса аудио.
// 4. Реактивный монтировщик (mountLayer2Metrics): подписка на UniverseStore
//    и запуск плавного 60-FPS обновления контуров и падающих цифр-звёзд.
// ============================================================================

import { universeStore, type UniverseState } from '../store/universeState';

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

export const React = {
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
                            const cssProp = sKey.replace(/[A-Z]/g, (m: string) => `-${m.toLowerCase()}`);
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
};

// ============================================================================
// РАЗДЕЛ 2. ГЕНЕРАТОР ЖИВОГО КОНТУРА МЕМБРАНЫ И ДВИЖОК «ЗВЕЗДОПАДА / КАПЕЛЬ»
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

const STARFALL_GLYPH_POOL = '0123456789ABCDEF.+-xΔr∑';

/**
 * Вычисляет замкнутый SVG-путь живого нестабильного контура панели
 * по волновому оператору мембраны BREACH LENS (без прямых линий и острых углов).
 */
export function buildLivingBreachContourPath(
    width: number,
    height: number,
    timeSec: number,
    phaseOffset = 0
): string {
    const pad = 9;
    const w = Math.max(120, width - pad * 2);
    const h = Math.max(70, height - pad * 2);
    const vSteps = 26;
    const hSteps = 12;
    const pts: Array<[number, number]> = [];

    // 1. Левая волновая мембрана (сверху вниз)
    for (let i = 0; i <= vSteps; i++) {
        const u = i / vSteps;
        const y = pad + u * h;
        const env = Math.sin(u * Math.PI);
        const wave =
            env *
            (4.6 * Math.sin(u * 8.5 - timeSec * 1.85 + phaseOffset) +
                2.5 * Math.cos(u * 15.0 + timeSec * 2.5));
        pts.push([pad + wave, y]);
    }

    // 2. Нижняя волновая кромка (слева направо)
    for (let i = 1; i <= hSteps; i++) {
        const u = i / hSteps;
        const x = pad + u * w;
        const env = Math.sin(u * Math.PI);
        const wave = env * 3.2 * Math.sin(u * 6.0 + timeSec * 2.0 + phaseOffset);
        pts.push([x, pad + h + wave]);
    }

    // 3. Правая волновая мембрана (снизу вверх)
    for (let i = 1; i <= vSteps; i++) {
        const u = 1.0 - i / vSteps;
        const y = pad + u * h;
        const env = Math.sin(u * Math.PI);
        const wave =
            env *
            (3.7 * Math.cos(u * 8.0 + timeSec * 1.6 + phaseOffset) +
                2.1 * Math.sin(u * 14.0 - timeSec * 2.2));
        pts.push([pad + w + wave, y]);
    }

    // 4. Верхняя волновая кромка (справа налево)
    for (let i = 1; i < hSteps; i++) {
        const u = 1.0 - i / hSteps;
        const x = pad + u * w;
        const env = Math.sin(u * Math.PI);
        const wave = env * 2.9 * Math.cos(u * 6.0 - timeSec * 1.75 + phaseOffset);
        pts.push([x, pad + wave]);
    }

    if (pts.length === 0) return '';
    let pathStr = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
        pathStr += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    }
    return pathStr + ' Z';
}

/**
 * Единый контроллер непрерывной 60-FPS анимации живых контуров, фонового течения
 * «Цифрового водопада» и опадающих цифр-капель («Звездопада») для каскадов Layers 2, 3, 4.
 */
class TelemetryWaterfallAnimator {
    private droplets: StarfallDroplet[] = [];
    private ignitedSlots: Map<string, number> = new Map();
    private nextSpawnSec: Record<2 | 3 | 4, number> = { 2: 0.6, 3: 0.9, 4: 1.2 };
    private dropCounter = 1;
    private rafId = 0;
    private lastMs = 0;

    public getTimeSec(): number {
        return typeof performance !== 'undefined' ? performance.now() * 0.001 : 0;
    }

    public ensureRunning(): void {
        if (this.rafId !== 0 || typeof window === 'undefined') return;
        this.lastMs = performance.now();
        this.rafId = window.requestAnimationFrame(this.tick);
    }

    private tick = (nowMs: number): void => {
        const dt = Math.min(0.08, Math.max(0.001, (nowMs - this.lastMs) / 1000));
        this.lastMs = nowMs;
        const timeSec = nowMs * 0.001;

        this.stepDroplets(dt, timeSec);
        this.updateLiveDomElements(timeSec);

        this.rafId = window.requestAnimationFrame(this.tick);
    };

    private stepDroplets(dt: number, timeSec: number): void {
        const cascades: ReadonlyArray<2 | 3 | 4> = [2, 3, 4];
        const slotPools: Record<2 | 3 | 4, ReadonlyArray<string>> = {
            2: ['l2_fps', 'l2_drift', 'l2_kuramoto', 'l2_nodes', 'l2_core', 'l2_audio'],
            3: ['l3_trunks', 'l3_bridges', 'l3_dendrites', 'l3_deg', 'l3_diam', 'l3_pulses'],
            4: ['l4_mod0', 'l4_mod1', 'l4_mod2', 'l4_ledger', 'l4_log0'],
        };

        for (let c = 0; c < cascades.length; c++) {
            const cId = cascades[c];
            if (timeSec >= this.nextSpawnSec[cId]) {
                const interval = 0.58 + Math.abs(Math.sin(timeSec * 1.67 + cId * 1.9)) * 1.15;
                this.nextSpawnSec[cId] = timeSec + interval;

                const pool = slotPools[cId];
                const slotKey = pool[(this.dropCounter * 3 + cId) % pool.length];
                this.ignitedSlots.set(slotKey, timeSec);

                const glyph =
                    STARFALL_GLYPH_POOL[
                    (this.dropCounter * 11 + Math.floor(timeSec * 19)) %
                    STARFALL_GLYPH_POOL.length
                        ];

                this.droplets.push({
                    id: this.dropCounter++,
                    cascadeId: cId,
                    glyph,
                    xPercent: 18 + ((this.dropCounter * 29) % 68),
                    startYPercent: 25 + ((this.dropCounter * 19) % 58),
                    yOffsetPx: 0,
                    xDriftPx: 0,
                    velocityPx: 25 + ((this.dropCounter * 13) % 22),
                    opacity: 0.9,
                    scale: 1.04,
                    life: 0,
                    maxLife: 1.55 + ((this.dropCounter * 7) % 9) * 0.11,
                });
            }
        }

        const active: StarfallDroplet[] = [];
        for (let i = 0; i < this.droplets.length; i++) {
            const d = this.droplets[i];
            const nextLife = d.life + dt;
            if (nextLife >= d.maxLife) continue;
            const prog = nextLife / d.maxLife;
            const nextVel = d.velocityPx + 35 * dt;
            const nextOpacity = Math.max(0, (1 - prog) * (1 - prog * 0.62) * 0.9);
            if (nextOpacity <= 0.02) continue;

            active.push({
                ...d,
                life: nextLife,
                velocityPx: nextVel,
                yOffsetPx: d.yOffsetPx + nextVel * dt,
                xDriftPx: Math.sin(nextLife * 4.2 + d.id) * 6.0 * prog,
                opacity: nextOpacity,
                scale: 1.04 - prog * 0.24,
            });
        }
        this.droplets = active.slice(-28);
    }

    /**
     * Плавно обновляет волновые SVG-контуры, течение водопада и падающие цифры
     * непосредственно в DOM на частоте 60 FPS между тиками UniverseStore.
     */
    private updateLiveDomElements(timeSec: number): void {
        if (typeof document === 'undefined') return;

        const contourPaths = document.querySelectorAll<SVGPathElement>(
            'path[data-breach-contour]'
        );
        contourPaths.forEach((pathEl: SVGPathElement) => {
            const cId = Number(pathEl.getAttribute('data-breach-contour') || '2');
            const offset = (cId - 2) * 1.25;
            pathEl.setAttribute('d', buildLivingBreachContourPath(418, 280, timeSec, offset));
        });

        const streamOverlays = document.querySelectorAll<HTMLElement>(
            '.waterfall-stream-overlay'
        );
        streamOverlays.forEach((el: HTMLElement, idx: number) => {
            const yPos = (timeSec * (9.5 + idx * 1.2)) % 26;
            el.style.backgroundPosition = `0px ${yPos.toFixed(1)}px`;
        });
    }

    public getDropletsForCascade(cascadeId: 2 | 3 | 4): ReadonlyArray<StarfallDroplet> {
        return this.droplets.filter((d: StarfallDroplet) => d.cascadeId === cascadeId);
    }

    public getBreathingSlotStyle(
        slotKey: string,
        phaseSeed: number
    ): Record<string, string | number> {
        const timeSec = this.getTimeSec();
        const ignitedAt = this.ignitedSlots.get(slotKey) ?? -10;
        const elapsed = timeSec - ignitedAt;
        const isReigniting = elapsed >= 0 && elapsed < 0.46;
        const breathScale = 1.0 + 0.022 * Math.sin(timeSec * 2.05 + phaseSeed);

        return {
            display: 'inline-block',
            transform: isReigniting
                ? `translateY(${((0.46 - elapsed) * -8.5).toFixed(1)}px) scale(${(
                    breathScale * 1.09
                ).toFixed(3)})`
                : `scale(${breathScale.toFixed(3)})`,
            color: isReigniting ? '#f8fafc' : '#e0f2fe',
            textShadow: isReigniting
                ? '0 0 14px rgba(125, 211, 252, 0.96), 0 0 24px rgba(56, 189, 248, 0.68)'
                : '0 0 9px rgba(56, 189, 248, 0.36)',
        };
    }
}

export const waterfallAnimator = new TelemetryWaterfallAnimator();

/**
 * Строит SVG-подложку с живым волновым контуром в стиле мембраны BREACH LENS
 * и слой падающих цифр-звёзд («Звездопад / Капли») для указанного каскада (2, 3 или 4).
 */
export function renderWaterfallMembraneDecor(cascadeId: 2 | 3 | 4): Element[] {
    const timeSec = waterfallAnimator.getTimeSec();
    const phaseOffset = (cascadeId - 2) * 1.25;
    const pathD = buildLivingBreachContourPath(418, 280, timeSec, phaseOffset);
    const drops = waterfallAnimator.getDropletsForCascade(cascadeId);
    const shiftY = (timeSec * (9.5 + (cascadeId - 2) * 1.2)) % 26;

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
                    <stop offset="0%" stopColor="rgba(125, 211, 252, 0.62)" />
                    <stop offset="50%" stopColor="rgba(99, 102, 241, 0.34)" />
                    <stop offset="100%" stopColor="rgba(56, 189, 248, 0.58)" />
                </linearGradient>
            </defs>
            <path
                data-breach-contour={String(cascadeId)}
                d={pathD}
                fill={`url(#${bgGradId})`}
                stroke={`url(#${strokeGradId})`}
                stroke-width="1.35"
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
        <div className="starfall-drops-layer">
            {drops.map((drop: StarfallDroplet) => (
                <span
                    key={drop.id}
                    className="starfall-glyph"
                    style={{
                        left: `${drop.xPercent}%`,
                        top: `${drop.startYPercent}%`,
                        opacity: drop.opacity.toFixed(3),
                        transform: `translate(${drop.xDriftPx.toFixed(1)}px, ${drop.yOffsetPx.toFixed(
                            1
                        )}px) scale(${drop.scale.toFixed(2)})`,
                    }}
                >
                    {drop.glyph}
                </span>
            ))}
        </div>
    );

    return [svgContour, streamOverlay, dropsLayer];
}

// ============================================================================
// РАЗДЕЛ 3. ПРЕДСТАВЛЕНИЕ И МОНТИРОВЩИК ВЕРХНЕГО КАСКАДА LAYER 2: METRICS
// ============================================================================

export function renderLayer2MetricsView(snap: Readonly<UniverseState>): Element {
    const t = snap.telemetry;
    const isVisible =
        snap.layers.layer2_metricsHud ||
        snap.layers.layer5_truthXRayMode ||
        snap.inspectionLevel === 'METRICS' ||
        snap.debugMode;
    const hiddenClass = isVisible ? '' : ' layer-hidden';
    const decor = renderWaterfallMembraneDecor(2);

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
                        title="32-bit FNV-1a State Digest (ILLUSION == NEXUS == X-RAY)"
                    >
                        DIGEST: {t.stateDigestHex}
                    </span>
                </div>

                <div className="metrics-grid">
                    <div className="metric-box">
                        <span className="label">FPS / P95 [ts/renderer.ts]</span>
                        <span
                            className="value"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_fps', 0.4)}
                        >
                            {t.fps} FPS{' '}
                            <small>
                                ({t.frameTimeMs}/{t.frameTimeP95Ms}ms)
                            </small>
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label">ΔE/E₀ [rust/gravity.rs]</span>
                        <span
                            className="value"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_drift', 1.2)}
                        >
                            {t.energyDriftRatio.toExponential(2)}
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label">KURAMOTO r(t) [rust/gravity.rs]</span>
                        <span
                            className="value"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_kuramoto', 2.1)}
                        >
                            {t.kuramotoOrderR.toFixed(3)}
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label">NODES / EDGES [python/graph_logic.py]</span>
                        <span
                            className="value"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_nodes', 2.9)}
                        >
                            {t.activeParticles} / {t.activeConnections}
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label">CORE STATUS [IntegrationRegistry]</span>
                        <span
                            className="value"
                            style={waterfallAnimator.getBreathingSlotStyle('l2_core', 3.7)}
                        >
                            {t.wasmStatus} · {t.pythonBackendStatus}
                        </span>
                    </div>

                    <div className="metric-box">
                        <span className="label">AUDIO RMS [web-audio]</span>
                        <span
                            className="value"
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

export function mountLayer2Metrics(container: HTMLElement | null): () => void {
    if (!container) return () => {};
    waterfallAnimator.ensureRunning();

    const update = (state: Readonly<UniverseState>): void => {
        container.replaceChildren(renderLayer2MetricsView(state));
    };

    const unsub = universeStore.subscribe(update);
    const refreshTimer =
        typeof window !== 'undefined'
            ? window.setInterval(() => {
                update(universeStore.getState());
            }, 140)
            : 0;

    return () => {
        if (refreshTimer && typeof window !== 'undefined') {
            window.clearInterval(refreshTimer);
        }
        unsub();
    };
}

export default renderLayer2MetricsView;