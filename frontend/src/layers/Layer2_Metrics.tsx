// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer2_Metrics.tsx
// НАЗНАЧЕНИЕ: Автономная DOM/SVG JSX-фабрика React, плавный движок «Цифрового
//             водопада / Звездопада» (60 FPS без мерцания) и каскад LAYER_02
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Нативная DOM/SVG фабрика React.createElement: генерация узлов HTML и SVG
//    (http://www.w3.org/2000/svg) в соответствии с контрактом JSX.Element.
// 2. Генератор спокойного волнового контура (buildLivingBreachContourPath)
//    и плавной подзаголовочной волны (buildLivingHorizontalWavePath):
//    медленные длинноволновые гармоники с умеренно увеличенной амплитудой
//    без высокочастотной ряби и без пересечения строк текста.
// 3. Контроллер 60-FPS анимации (TelemetryWaterfallAnimator): прямое обновление
//    SVG-контуров и падающих буковок «Звездопада» в DOM без пересоздания узлов
//    и без искажения субпиксельного сглаживания шрифтов.
// 4. Представление и монтировщик верхнего каскада (renderLayer2MetricsView,
//    mountLayer2Metrics): вывод метрик FPS, P95, ΔE/E0, Курамото r(t) и Digest.
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
// РАЗДЕЛ 2. ГЕНЕРАТОР ПЛАВНОГО ВОЛНОВОГО КОНТУРА (БЕЗ ВЫСОКОЧАСТОТНОЙ РЯБИ)
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
 * Вычисляет замкнутый SVG-путь живого контура панели:
 * сохраняет плавность первого варианта, но с чуть большей амплитудой (6.4 px + 3.1 px),
 * чтобы мягкое волновое движение считывалось глазом спокойно и комфортно.
 */
export function buildLivingBreachContourPath(
    width: number,
    height: number,
    timeSec: number,
    phaseOffset = 0
): string {
    const padX = 12;
    const padY = 9;
    const w = Math.max(120, width - padX * 2);
    const h = Math.max(70, height - padY * 2);
    const vSteps = 28;
    const hSteps = 16;
    const pts: Array<[number, number]> = [];

    // 1. Левая волновая граница (сверху вниз — плавная длинная волна)
    for (let i = 0; i <= vSteps; i++) {
        const u = i / vSteps;
        const y = padY + u * h;
        const env = 0.22 + 0.78 * Math.sin(u * Math.PI);
        const wave =
            env *
            (6.4 * Math.sin(u * 7.5 - timeSec * 1.35 + phaseOffset) +
                3.1 * Math.cos(u * 13.0 + timeSec * 1.75));
        pts.push([padX + wave, y]);
    }

    // 2. Нижняя волновая кромка (слева направо)
    for (let i = 1; i <= hSteps; i++) {
        const u = i / hSteps;
        const x = padX + u * w;
        const env = 0.22 + 0.78 * Math.sin(u * Math.PI);
        const wave =
            env *
            (4.2 * Math.sin(u * 6.5 + timeSec * 1.4 + phaseOffset) +
                1.8 * Math.cos(u * 11.0 - timeSec * 1.65));
        pts.push([x, padY + h + wave]);
    }

    // 3. Правая волновая граница (снизу вверх)
    for (let i = 1; i <= vSteps; i++) {
        const u = 1.0 - i / vSteps;
        const y = padY + u * h;
        const env = 0.22 + 0.78 * Math.sin(u * Math.PI);
        const wave =
            env *
            (5.4 * Math.cos(u * 7.5 + timeSec * 1.25 + phaseOffset) +
                2.6 * Math.sin(u * 13.0 - timeSec * 1.6));
        pts.push([padX + w + wave, y]);
    }

    // 4. Верхняя волновая кромка (справа налево)
    for (let i = 1; i < hSteps; i++) {
        const u = 1.0 - i / hSteps;
        const x = padX + u * w;
        const env = 0.22 + 0.78 * Math.sin(u * Math.PI);
        const wave =
            env *
            (3.9 * Math.cos(u * 6.5 - timeSec * 1.35 + phaseOffset) +
                1.7 * Math.sin(u * 11.0 + timeSec * 1.55));
        pts.push([x, padY + wave]);
    }

    if (pts.length === 0) return '';
    let pathStr = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
        pathStr += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    }
    return pathStr + ' Z';
}

/**
 * Вычисляет плавно изгибающуюся линию под заголовком панели (y = 42),
 * чтобы она мягко дышала в такт контуру без резких частых изломов.
 */
export function buildLivingHorizontalWavePath(
    width: number,
    yCenter: number,
    timeSec: number,
    phaseOffset = 0,
    amplitude = 2.9
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
            (amplitude * Math.sin(u * 7.0 - timeSec * 1.45 + phaseOffset) +
                amplitude * 0.42 * Math.cos(u * 13.0 + timeSec * 1.85 - phaseOffset));
        d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
}

// ============================================================================
// РАЗДЕЛ 3. КОНТРОЛЛЕР ПЛАВНОЙ 60-FPS АНИМАЦИИ КОНТУРА И «ЗВЕЗДОПАДА / КАПЕЛЬ»
// ============================================================================

class TelemetryWaterfallAnimator {
    private droplets: StarfallDroplet[] = [];
    private ignitedSlots: Map<string, number> = new Map();
    private nextSpawnSec: Record<2 | 3 | 4, number> = { 2: 0.5, 3: 0.8, 4: 1.1 };
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
        const dt = Math.min(0.06, Math.max(0.001, (nowMs - this.lastMs) / 1000));
        this.lastMs = nowMs;
        const timeSec = nowMs * 0.001;

        this.stepDroplets(dt, timeSec);
        this.updateLiveDomElements(timeSec);

        this.rafId = window.requestAnimationFrame(this.tick);
    };

    /**
     * Обновляет траектории падающих буковок: скорость падения чуть увеличена
     * (начальная 32..56 px/s и ускорение 46 px/s^2), чтобы падение было плавным и заметным.
     */
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
                const interval = 0.52 + Math.abs(Math.sin(timeSec * 1.45 + cId * 1.7)) * 0.95;
                this.nextSpawnSec[cId] = timeSec + interval;

                const pool = slotPools[cId];
                const slotKey = pool[(this.dropCounter * 3 + cId) % pool.length];
                this.ignitedSlots.set(slotKey, timeSec);

                const glyph =
                    STARFALL_GLYPH_POOL[
                    (this.dropCounter * 11 + Math.floor(timeSec * 17)) %
                    STARFALL_GLYPH_POOL.length
                        ];

                this.droplets.push({
                    id: this.dropCounter++,
                    cascadeId: cId,
                    glyph,
                    xPercent: 18 + ((this.dropCounter * 29) % 68),
                    startYPercent: 22 + ((this.dropCounter * 19) % 54),
                    yOffsetPx: 0,
                    xDriftPx: 0,
                    velocityPx: 32 + ((this.dropCounter * 13) % 24),
                    opacity: 0.88,
                    scale: 1.04,
                    life: 0,
                    maxLife: 1.42 + ((this.dropCounter * 7) % 8) * 0.1,
                });
            }
        }

        const active: StarfallDroplet[] = [];
        for (let i = 0; i < this.droplets.length; i++) {
            const d = this.droplets[i];
            const nextLife = d.life + dt;
            if (nextLife >= d.maxLife) continue;
            const prog = nextLife / d.maxLife;
            const nextVel = d.velocityPx + 46 * dt;
            const nextOpacity = Math.max(0, (1 - prog) * (1 - prog * 0.55) * 0.88);
            if (nextOpacity <= 0.02) continue;

            active.push({
                ...d,
                life: nextLife,
                velocityPx: nextVel,
                yOffsetPx: d.yOffsetPx + nextVel * dt,
                xDriftPx: Math.sin(nextLife * 3.1 + d.id) * 4.5 * prog,
                opacity: nextOpacity,
                scale: 1.04 - prog * 0.22,
            });
        }
        this.droplets = active.slice(-28);
    }

    /**
     * Плавно на 60 FPS обновляет контуры, линию под заголовком и падающие буковки
     * напрямую в DOM без пересоздания элементов и без дрожания текста.
     */
    private updateLiveDomElements(timeSec: number): void {
        if (typeof document === 'undefined') return;

        // 1. Плавное обновление внешнего волнового контура
        const contourPaths = document.querySelectorAll<SVGPathElement>(
            'path[data-breach-contour]'
        );
        contourPaths.forEach((pathEl: SVGPathElement) => {
            const cId = Number(pathEl.getAttribute('data-breach-contour') || '2');
            const offset = (cId - 2) * 1.25;
            pathEl.setAttribute('d', buildLivingBreachContourPath(418, 280, timeSec, offset));
        });

        // 2. Плавное обновление волнистой линии под заголовком
        const dividerPaths = document.querySelectorAll<SVGPathElement>(
            'path[data-breach-wave-line]'
        );
        dividerPaths.forEach((lineEl: SVGPathElement) => {
            const cId = Number(lineEl.getAttribute('data-breach-wave-line') || '2');
            const yPos = Number(lineEl.getAttribute('data-wave-y') || '42');
            const amp = Number(lineEl.getAttribute('data-wave-amp') || '2.9');
            const offset = (cId - 2) * 1.3;
            lineEl.setAttribute(
                'd',
                buildLivingHorizontalWavePath(418, yPos, timeSec, offset, amp)
            );
        });

        // 3. Мягкое вертикальное течение фоновой вуали водопада
        const streamOverlays = document.querySelectorAll<HTMLElement>(
            '.waterfall-stream-overlay'
        );
        streamOverlays.forEach((el: HTMLElement, idx: number) => {
            const yPos = (timeSec * (12.0 + idx * 1.5)) % 120;
            el.style.backgroundPosition = `0px ${yPos.toFixed(1)}px`;
        });

        // 4. Плавная 60-FPS отрисовка падающих буковок в контейнерах .starfall-drops-layer
        const dropContainers = document.querySelectorAll<HTMLElement>(
            '.starfall-drops-layer[data-cascade-drops]'
        );
        dropContainers.forEach((container: HTMLElement) => {
            const cId = Number(container.getAttribute('data-cascade-drops') || '2') as 2 | 3 | 4;
            const drops = this.getDropletsForCascade(cId);
            const existingMap = new Map<number, HTMLElement>();

            const children = container.querySelectorAll<HTMLElement>('span[data-drop-id]');
            children.forEach((child: HTMLElement) => {
                const id = Number(child.getAttribute('data-drop-id'));
                existingMap.set(id, child);
            });

            const activeIds = new Set<number>();
            for (let i = 0; i < drops.length; i++) {
                const d = drops[i];
                activeIds.add(d.id);
                let span = existingMap.get(d.id);
                if (!span) {
                    span = document.createElement('span');
                    span.className = 'starfall-glyph';
                    span.setAttribute('data-drop-id', String(d.id));
                    span.textContent = d.glyph;
                    span.style.left = `${d.xPercent}%`;
                    span.style.top = `${d.startYPercent}%`;
                    container.appendChild(span);
                }
                span.style.opacity = d.opacity.toFixed(3);
                span.style.transform = `translate3d(${d.xDriftPx.toFixed(
                    1
                )}px, ${d.yOffsetPx.toFixed(1)}px, 0) scale(${d.scale.toFixed(2)})`;
            }

            existingMap.forEach((node: HTMLElement, id: number) => {
                if (!activeIds.has(id)) {
                    node.remove();
                }
            });
        });
    }

    public getDropletsForCascade(cascadeId: 2 | 3 | 4): ReadonlyArray<StarfallDroplet> {
        return this.droplets.filter((d: StarfallDroplet) => d.cascadeId === cascadeId);
    }

    /**
     * Спокойное, комфортное для глаз дыхание цифр (чуть заметнее первого варианта,
     * но без резкого дрожания и без потери чёткости шрифта).
     */
    public getBreathingSlotStyle(
        slotKey: string,
        phaseSeed: number
    ): Record<string, string | number> {
        const timeSec = this.getTimeSec();
        const ignitedAt = this.ignitedSlots.get(slotKey) ?? -10;
        const elapsed = timeSec - ignitedAt;
        const isReigniting = elapsed >= 0 && elapsed < 0.42;

        const breathScale = 1.0 + 0.028 * Math.sin(timeSec * 1.55 + phaseSeed);
        const gentleY = 1.15 * Math.cos(timeSec * 1.35 + phaseSeed * 0.8);

        return {
            display: 'inline-block',
            transform: isReigniting
                ? `translateY(${((0.42 - elapsed) * -7.5 + gentleY).toFixed(1)}px) scale(${(
                    breathScale * 1.07
                ).toFixed(3)})`
                : `translateY(${gentleY.toFixed(1)}px) scale(${breathScale.toFixed(3)})`,
            color: isReigniting ? '#f8fafc' : '#e0f2fe',
            textShadow: isReigniting
                ? '0 0 12px rgba(125, 211, 252, 0.92), 0 0 20px rgba(56, 189, 248, 0.58)'
                : '0 0 8px rgba(56, 189, 248, 0.32)',
        };
    }
}

export const waterfallAnimator = new TelemetryWaterfallAnimator();

/**
 * Строит SVG-подложку с плавным волновым контуром, одной мягкой волнистой линией
 * под заголовком и 60-FPS слоем падающих буковок для каскадов 2, 3 и 4.
 */
export function renderWaterfallMembraneDecor(cascadeId: 2 | 3 | 4): Element[] {
    const timeSec = waterfallAnimator.getTimeSec();
    const phaseOffset = (cascadeId - 2) * 1.25;
    const contourD = buildLivingBreachContourPath(418, 280, timeSec, phaseOffset);
    const headerWaveD = buildLivingHorizontalWavePath(
        418,
        42,
        timeSec,
        phaseOffset + 0.4,
        2.9
    );

    const drops = waterfallAnimator.getDropletsForCascade(cascadeId);
    const shiftY = (timeSec * (12.0 + (cascadeId - 2) * 1.5)) % 120;

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
                data-wave-amp="2.9"
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

// ============================================================================
// РАЗДЕЛ 4. ПРЕДСТАВЛЕНИЕ И МОНТИРОВЩИК ВЕРХНЕГО КАСКАДА LAYER 2: METRICS
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

    return universeStore.subscribe(update);
}

export default renderLayer2MetricsView;