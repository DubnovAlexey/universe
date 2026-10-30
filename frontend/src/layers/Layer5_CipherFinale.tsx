// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/layers/Layer5_CipherFinale.tsx
// НАЗНАЧЕНИЕ: Видимый семантический DOM-слой финальной визитки DUBNOV ALEXEY,
//             быстрой парящей в воздухе квантовой строки (~3.5x быстрее) и
//             постоянного полупрозрачного режима на фоне цикла (MASTER 05 v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ:
//   СЕМАНТИЧЕСКИЕ ТЕМЫ: FINALE_TOPIC_TERMS и renderFinaleTermParts сохраняют
//             пять кнопок моделей при посимвольной сборке строки.
//   РАЗДЕЛ 0. Постоянная Unicode-сетка (bindFinaleQuantumCells,
//             updateFinaleQuantumCells) без скачков высоты при смене знаков.
//   РАЗДЕЛ 1. Делегирование фазового перебора общему контроллеру наведения
//             и клавиатурного фокуса (triggerLineOrButtonScramble).
//   РАЗДЕЛ 2. Контроллер анимации на общем такте кадра (FinaleCardDomAnimator):
//     - Подраздел 2.1. Подписка общего кадра (активна в Акте D и в постоянном
//                      полупрозрачном фоновом режиме после первого показа),
//                      безопасное смещение визитки после возврата в фазу 01,
//                      уменьшение только на телефоне в завершении подъёма.
//     - Подраздел 2.2. Ускоренная в ~3.5 раза квантовая строка (18–26 Гц,
//                      постоянные ячейки без скачков метрик шрифта) и
//                      гарантированная 100%-ная фиксация строк 0, 1, 3, 4.
//   РАЗДЕЛ 3. Семантический компонент визитки (renderLayer5CipherFinaleView)
//             с поддержкой полупрозрачного режима .ambient-loop и защитой
//             aria-hidden / tabIndex при скрытом состоянии.
//   РАЗДЕЛ 4. Mount-once монтировщик (mountLayer5CipherFinale).
// ============================================================================

import { React } from './Layer2_Metrics';
import { getLocale, subscribeLocale, translateUi } from '../core/locale';
import { getFinaleLines, formatFinaleStaticLine } from '../bridge/cipherOdometerEngine';
import {
    CAMERA_DRIFT_Y_AMPLITUDE, CAMERA_ZOOM_SWAY, UNIVERSE_PHASES,
    smootherstep, universeStore, type UniverseState,
} from '../store/universeState';
import { subscribeVisualSignals, type VisualSignalSnapshot } from '../core/visualSignals';
import { getGlyphFontEpoch, getRenderableGlyphPool, GLYPH_WAITING_SPACE, splitGlyphText } from '../core/glyphGrammar';
import { calmGlyphHover, prepareFittedGlyph, setFittedGlyph, type GlyphInkFit } from '../core/glyphHover';
import { getFinaleCardPlacement, getFinaleCardScale, type FinaleCardLayout } from '../core/finaleComposition';

const FINALE_PEAK_ZOOM = Math.max(...Object.values(UNIVERSE_PHASES).map((phase) => phase.targetZoom)) + CAMERA_ZOOM_SWAY;

// НАЧАЛО РАЗДЕЛА. СЕМАНТИЧЕСКИЕ ТЕМЫ И НЕПРЕРЫВНАЯ СБОРКА СТРОК
export const FINALE_TOPIC_TERMS: readonly { lineIndex: number; label: string; topicId: string }[] = [
    { lineIndex: 3, label: 'SCRAMBLER', topicId: 'prng' },
    { lineIndex: 3, label: 'KURAMOTO', topicId: 'kuramoto' },
    { lineIndex: 3, label: 'fBm', topicId: 'fbm' },
    { lineIndex: 3, label: 'VERLET', topicId: 'symplectic' },
    { lineIndex: 3, label: 'PLUMMER', topicId: 'plummer' },
];

// НАЧАЛО ФУНКЦИИ renderFinaleTermParts
/** Стабильные кнопки содержат собственный перебор; разделители сохраняют общие позиции строки. */
function renderFinaleTermParts(lineIndex: number, interactive: boolean): Element[] {
    const canonical = getFinaleLines()[lineIndex];
    const parts: Element[] = [];
    let offset = 0;
    const append = (text: string, start: number, topicId?: string): void => {
        if (!text) return;
        const props = {
            'data-finale-term-part': 'true', 'data-term-start': String(splitGlyphText(canonical.slice(0, start)).length),
            'data-term-length': String(splitGlyphText(text).length), 'data-canonical-text': text,
        };
        if (topicId) {
            parts.push(<button {...props} type="button" className="finale-term" data-explain-topic={topicId}
                aria-haspopup="dialog" aria-controls="explanation-dialog" aria-label={`${translateUi('Пояснение:')} ${text}`}
                title={`${translateUi('Пояснение:')} ${text}`} tabIndex={interactive ? 0 : -1} disabled={!interactive}
                onPointerEnter={(event: PointerEvent): void => {
                    triggerLineOrButtonScramble(event.currentTarget as HTMLElement, text);
                }} onFocus={(event: FocusEvent): void => {
                    triggerLineOrButtonScramble(event.currentTarget as HTMLElement, text);
                }} onClick={(): void => {
                    universeStore.setFinaleCardHovered(false);
                }}>{text}</button>);
        } else {
            parts.push(<span {...props} className="finale-term-separator" aria-hidden="true">{text}</span>);
        }
    };
    for (const term of FINALE_TOPIC_TERMS.filter((entry) => entry.lineIndex === lineIndex)) {
        const start = canonical.indexOf(term.label, offset);
        append(canonical.slice(offset, start), offset);
        append(term.label, start, term.topicId);
        offset = start + term.label.length;
    }
    append(canonical.slice(offset), offset);
    return parts;
}
// КОНЕЦ ФУНКЦИИ renderFinaleTermParts
// КОНЕЦ РАЗДЕЛА. СЕМАНТИЧЕСКИЕ ТЕМЫ И НЕПРЕРЫВНАЯ СБОРКА СТРОК

// НАЧАЛО РАЗДЕЛА 0. ПОСТОЯННЫЕ ЯЧЕЙКИ КВАНТОВОЙ СТРОКИ
interface FinaleQuantumCell {
    readonly node: HTMLElement;
    readonly ink: HTMLElement;
    readonly sourceIndex: number;
    readonly canonical: string;
    glyph: string;
    fitKey: string;
}

// --- НАЧАЛО ФУНКЦИИ bindFinaleQuantumCells ---
/** Создаёт по одной постоянной ячейке на знак; размеры строк задаёт CSS Grid. */
export function bindFinaleQuantumCells(line: HTMLElement | null, canonical = getFinaleLines()[2]): readonly FinaleQuantumCell[] {
    if (!line) return [];
    const cells: FinaleQuantumCell[] = [];
    Array.from(canonical).forEach((character, sourceIndex) => {
        if (/\s/u.test(character)) return;
        const node = line.ownerDocument.createElement('span');
        node.className = 'finale-quantum-cell';
        node.dataset.quantumIndex = String(sourceIndex);
        const ink = line.ownerDocument.createElement('span');
        ink.className = 'glyph-reel-ink';
        ink.textContent = character;
        node.replaceChildren(ink);
        cells.push({ node, ink, sourceIndex, canonical: character, glyph: '', fitKey: '' });
    });
    line.style.setProperty('--quantum-columns', String(cells.length));
    line.style.setProperty('--quantum-compact-columns', String(Math.ceil(cells.length / 2)));
    line.replaceChildren(...cells.map((cell) => cell.node));
    return cells;
}
// --- КОНЕЦ ФУНКЦИИ bindFinaleQuantumCells ---

// --- НАЧАЛО ФУНКЦИИ updateFinaleQuantumCells ---
/** Меняет только содержимое кешированных ячеек, сохраняя сетку и индивидуальный темп. */
export function updateFinaleQuantumCells(cells: readonly FinaleQuantumCell[], glyphPool: readonly string[], step: number, reducedMotion: boolean,
    writes?: (() => void)[]): void {
    const updates: { cell: FinaleQuantumCell; glyph: string; fitKey: string; fit: GlyphInkFit }[] = [];
    const fontEpoch = getGlyphFontEpoch();
    for (const cell of cells) {
        const index = cell.sourceIndex;
        const slotStride = index % 3 === 0 ? 1 : 2;
        const charTick = Math.floor((step + index * 7) / slotStride);
        const glyphIndex = (index * 19 + charTick * 7 + (index % 5) * 13) % glyphPool.length;
        const glyph = reducedMotion || !glyphPool.length ? cell.canonical : glyphPool[glyphIndex];
        const fitKey = `${fontEpoch}:${cell.node.clientWidth}:${cell.node.clientHeight}`;
        if (cell.glyph !== glyph || cell.fitKey !== fitKey) {
            updates.push({ cell, glyph, fitKey, fit: prepareFittedGlyph(cell.ink, glyph, cell.canonical, fitKey) });
        }
    }
    // Размеры и метрики всех 25 окон прочитаны до первого изменения начертания.
    const apply = (): void => {
        updates.forEach(({ cell, glyph, fitKey, fit }) => {
            cell.glyph = glyph;
            cell.fitKey = fitKey;
            setFittedGlyph(cell.ink, glyph, cell.canonical, fit);
        });
    };
    if (writes) writes.push(apply); else apply();
}
// --- КОНЕЦ ФУНКЦИИ updateFinaleQuantumCells ---
// КОНЕЦ РАЗДЕЛА 0

// ============================================================================
// РАЗДЕЛ 1. ОБЩИЙ КОНТРОЛЛЕР ПЛАВНОГО ФАЗОВОГО ПЕРЕБОРА
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ triggerLineOrButtonScramble ---
/**
 * Передаёт строку или кнопку контроллеру без собственного таймера наведения.
 */
function triggerLineOrButtonScramble(el: HTMLElement, canonicalText: string): void {
    calmGlyphHover.start(el, canonicalText);
}
// --- КОНЕЦ ФУНКЦИИ triggerLineOrButtonScramble ---

// ============================================================================
// РАЗДЕЛ 2. ОБЩИЙ ТАКТ ВЫХОДА ИЗ ТОЧКИ, ОДОМЕТРА И ДЫХАНИЯ ВИЗИТКИ
// ============================================================================

class FinaleCardDomAnimator {
    private unsubscribeSignals: (() => void) | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private layoutDirty = true;
    private lastStaticStateKey = '';
    private accumulatedQuantumPhase = 0;
    private accumulatedAssemblyPhase = 0;
    private lfoClockSec = 0;
    private lastQuantumStep = -1;
    private lastQuantumFontEpoch = -1;
    private ambientRiseDistancePx = 0;
    private ambientLayoutKey = '';
    private ambientLayout: FinaleCardLayout | null = null;
    private breathHeartbeat = 0.35;

    private cardBoxEl: HTMLElement | null = null;
    private headerEl: HTMLElement | null = null;
    private line0El: HTMLElement | null = null;
    private line1El: HTMLElement | null = null;
    private quantumCells: readonly FinaleQuantumCell[] = [];
    private line3El: HTMLElement | null = null;
    private line4El: HTMLElement | null = null;
    private readonly topicParts = new Map<HTMLElement, readonly { node: HTMLElement; start: number; length: number }[]>();

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.1. ПРИВЯЗКА DOM-УЗЛОВ И ЖИЗНЕННЫЙ ЦИКЛ ПОДПИСКИ КАДРА
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ bindElements ---
    public bindElements(root: HTMLElement): void {
        this.stop();
        this.cardBoxEl = root.querySelector<HTMLElement>('[data-bind="l5-card-box"]');
        this.headerEl = root.ownerDocument.querySelector<HTMLElement>('.brand-card');
        this.ambientLayoutKey = '';
        this.ambientLayout = null;
        this.layoutDirty = true;
        this.lastStaticStateKey = '';
        this.line0El = root.querySelector<HTMLElement>('[data-bind="l5-line-0"]');
        this.line1El = root.querySelector<HTMLElement>('[data-bind="l5-line-1"]');
        this.quantumCells = bindFinaleQuantumCells(root.querySelector<HTMLElement>('[data-bind="l5-line-2"]'));
        this.lastQuantumStep = -1;
        this.lastQuantumFontEpoch = -1;
        this.line3El = root.querySelector<HTMLElement>('[data-bind="l5-line-3"]');
        this.line4El = root.querySelector<HTMLElement>('[data-bind="l5-line-4"]');
        const staticLines = [this.line0El, this.line1El, null, this.line3El, this.line4El];
        this.topicParts.clear();
        staticLines.forEach((el, index) => {
            if (!el) return;
            const parts = Array.from(el.querySelectorAll<HTMLElement>('[data-finale-term-part]'));
            if (parts.length) {
                this.topicParts.set(el, parts.map((node) => ({ node,
                    start: Number(node.dataset.termStart), length: Number(node.dataset.termLength) })));
                parts.forEach((node) => calmGlyphHover.setCanonical(node, node.dataset.canonicalText ?? ''));
            } else calmGlyphHover.setCanonical(el, getFinaleLines()[index]);
            // Холодные ячейки создаются при скрытом монтировании, а не в кадре выхода из Точки Нуля.
            if (!universeStore.getState().finaleReachedOnce) {
                this.setLineVisualText(el, GLYPH_WAITING_SPACE.repeat(splitGlyphText(getFinaleLines()[index]).length));
            }
        });
        root.querySelectorAll<HTMLElement>('.btn-cipher-action').forEach((el) => {
            calmGlyphHover.setCanonical(el, el.textContent ?? '');
        });
    }
    // --- КОНЕЦ ФУНКЦИИ bindElements ---

    // НАЧАЛО ФУНКЦИИ setLineVisualText
    /** Общий фронт слева направо проходит через границы терминов, не заменяя их кнопки. */
    private setLineVisualText(element: HTMLElement | null, text: string, writes?: (() => void)[]): void {
        if (!element) return;
        const parts = this.topicParts.get(element);
        if (!parts) { calmGlyphHover.setVisualText(element, text, writes); return; }
        const glyphs = splitGlyphText(text);
        for (const part of parts) {
            if (!calmGlyphHover.isActive(part.node)) {
                calmGlyphHover.setVisualText(part.node, glyphs.slice(part.start, part.start + part.length).join(''), writes);
            }
        }
    }
    // КОНЕЦ ФУНКЦИИ setLineVisualText

    // --- НАЧАЛО ФУНКЦИИ startIfNeeded ---
    public startIfNeeded(): void {
        if (this.unsubscribeSignals || typeof window === 'undefined') return;
        if (!this.resizeObserver && typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => { this.layoutDirty = true; });
        }
        if (this.cardBoxEl) {
            this.resizeObserver?.observe(this.cardBoxEl);
            if (this.cardBoxEl.parentElement) {
                this.resizeObserver?.observe(this.cardBoxEl.parentElement);
            }
        }
        if (this.headerEl) this.resizeObserver?.observe(this.headerEl);
        this.layoutDirty = true;
        this.unsubscribeSignals = subscribeVisualSignals(this.tick, 'finale-card');
    }
    // --- КОНЕЦ ФУНКЦИИ startIfNeeded ---

    // --- НАЧАЛО ФУНКЦИИ stop ---
    public stop(): void {
        this.unsubscribeSignals?.();
        this.unsubscribeSignals = null;
        this.resizeObserver?.disconnect();
    }
    // --- КОНЕЦ ФУНКЦИИ stop ---

    // --- НАЧАЛО ФУНКЦИИ getAmbientRiseDistance ---
    /** Резервирует полное яркое кольцо и ограничивает подъём безопасной областью. */
    private getAmbientRiseDistance(): number {
        const card = this.cardBoxEl;
        const stage = card?.parentElement;
        if (!card || !stage) return 0;
        if (!this.layoutDirty && this.ambientLayoutKey) return this.ambientRiseDistancePx;

        const compactLayout = stage.clientWidth <= 920;
        const headerBottom = compactLayout ? this.headerEl?.getBoundingClientRect().bottom ?? 44 : 0;
        const stageStyle = window.getComputedStyle(stage);
        const paddingTop = Number.parseFloat(stageStyle.paddingTop) || 0;
        const paddingBottom = Number.parseFloat(stageStyle.paddingBottom) || 0;
        const layoutKey = `${stage.clientWidth}:${stage.clientHeight}:${card.offsetHeight}:${headerBottom}:${paddingTop}:${paddingBottom}`;
        if (layoutKey !== this.ambientLayoutKey) {
            this.ambientLayoutKey = layoutKey;
            // Пиковая геометрия не зависит от текущего акта: после сжатия кольца
            // карточка остаётся в верхней свободной области вместо обратного спуска.
            this.ambientLayout = {
                viewportWidth: stage.clientWidth, viewportHeight: stage.clientHeight,
                cardHeight: card.offsetHeight, paddingTop, paddingBottom, headerBottom,
                peakZoom: FINALE_PEAK_ZOOM,
                cameraDriftYAmplitude: CAMERA_DRIFT_Y_AMPLITUDE,
            };
            this.ambientRiseDistancePx = getFinaleCardPlacement(this.ambientLayout).risePx;
        }

        return this.ambientRiseDistancePx;
    }
    // --- КОНЕЦ ФУНКЦИИ getAmbientRiseDistance ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.2. АНИМАЦИЯ СБОРКИ И УСКОРЕННОЙ В ~3.5 РАЗА КВАНТОВОЙ СТРОКИ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ formatOdometerLineForProgress ---
    /** Общий с Canvas фронт слева направо; непройденные окна остаются пустыми. */
    private formatOdometerLineForProgress(
        canonical: string,
        lineIndex: number,
        progress: number,
        assemblyWheelStep: number,
        glyphPool: readonly string[]
    ): string {
        return formatFinaleStaticLine(canonical, lineIndex, progress, assemblyWheelStep, glyphPool);
    }
    // --- КОНЕЦ ФУНКЦИИ formatOdometerLineForProgress ---

    // --- НАЧАЛО ФУНКЦИИ tick ---
    private tick = (signals: Readonly<VisualSignalSnapshot>): void => {
        const state = universeStore.getState();
        const isActD = state.singularityAct === 'ACT_D_GITHUB_CARD';
        const isCollapsing = state.singularityAct === 'RESTART_COLLAPSE';
        const isPersistentCard = state.finaleReachedOnce;

        // До первого появления визитка не подписана на общий кадр.
        if (!isActD && !isCollapsing && !isPersistentCard) {
            this.stop();
            return;
        }

        const isSimActive = !signals.isPaused && !state.isPaused && !state.isTabHidden;
        const staticStateKey = `${state.currentPhase}:${state.cycleCount}:${state.githubCardAssemblyProgress}:${state.singularityAct}:${state.reducedMotion}:${state.finaleRiseElapsedSec !== null}`;
        if ((!isSimActive || state.reducedMotion) && !this.layoutDirty && staticStateKey === this.lastStaticStateKey) {
            return;
        }
        this.lastStaticStateKey = staticStateKey;
        const dtSec = isSimActive ? signals.frameDtSec : 0;
        const glyphPool = getRenderableGlyphPool(state.currentPhase);

        if (this.cardBoxEl) {
            const glyphWrites: (() => void)[] = [];
            const hasLoopCard = isPersistentCard && state.finaleRiseElapsedSec !== null;
            const p = hasLoopCard
                ? 1.0
                : Math.max(0, Math.min(1, state.githubCardAssemblyProgress));
            if (isSimActive && !state.reducedMotion) {
                this.lfoClockSec += dtSec;
            }

            if (isSimActive) this.breathHeartbeat = signals.heartbeat;

            // Полная сборка в Акте D начинает 12-секундный подъём на общих часах сцены.
            // Общий кадр объединяет его с дыханием: CSS не переопределяет transform,
            // пауза сохраняет положение, reduced motion сразу выбирает статичную позицию.
            const ambientRiseElapsedSec = state.reducedMotion ? 12 : Math.max(0, Math.min(12, state.finaleRiseElapsedSec ?? 0));
            const ambientTarget = hasLoopCard ? this.getAmbientRiseDistance() : 0;
            const settledScale = hasLoopCard && this.ambientLayout
                ? getFinaleCardScale(this.ambientLayout.viewportWidth, ambientRiseElapsedSec, state.reducedMotion) : 1;
            // Финальная мера учитывает уменьшение; текущая не выпускает ещё крупную карточку за верхний HUD.
            const currentRiseLimit = this.ambientLayout
                ? getFinaleCardPlacement(this.ambientLayout, settledScale).risePx : ambientTarget;
            const ambientRise = Math.min(ambientTarget * smootherstep(0, 12, ambientRiseElapsedSec), currentRiseLimit);

            // Плавный C2-выход всей визитки из центральной Точки Нуля при первом появлении
            const emergeScale =
                state.reducedMotion || hasLoopCard
                    ? 1.0
                    : 0.04 + 0.96 * smootherstep(0.0, 0.46, p);

            // Спокойное дыхание зафиксированной визитки в такт низкочастотной огибающей музыки
            const breathEnv =
                state.reducedMotion ? 0 : smootherstep(0.48, 0.88, p);
            const musicPulse = 1.0 + this.breathHeartbeat * 0.42;
            const heartbeatScale =
                1.0 +
                breathEnv *
                (0.008 * musicPulse * Math.sin(this.lfoClockSec * 1.3) +
                    0.003 * Math.cos(this.lfoClockSec * 2.5));
            const floatY = breathEnv * Math.cos(this.lfoClockSec * 1.05) * 2.0;

            const finalScale = emergeScale * heartbeatScale * settledScale;
            const cardTransform = `translate3d(0, ${(floatY - ambientRise).toFixed(
                1
            )}px, 0) scale(${finalScale.toFixed(4)})`;

            // Накопление фазы начальной сборки
            if (isSimActive && !state.reducedMotion) {
                this.accumulatedAssemblyPhase += dtSec * 9.5;
            }
            const assemblyStep = Math.floor(this.accumulatedAssemblyPhase);

            if (p < 0.76 && !state.reducedMotion) {
                if (this.line0El && !calmGlyphHover.isActive(this.line0El)) {
                    this.setLineVisualText(this.line0El, this.formatOdometerLineForProgress(
                        getFinaleLines()[0],
                        0,
                        p,
                        assemblyStep,
                        glyphPool
                    ), glyphWrites);
                }
                if (this.line1El && !calmGlyphHover.isActive(this.line1El)) {
                    this.setLineVisualText(this.line1El, this.formatOdometerLineForProgress(
                        getFinaleLines()[1],
                        1,
                        p,
                        assemblyStep,
                        glyphPool
                    ), glyphWrites);
                }
                if (this.line3El && !calmGlyphHover.isActive(this.line3El)) {
                    this.setLineVisualText(this.line3El, this.formatOdometerLineForProgress(
                        getFinaleLines()[3],
                        3,
                        p,
                        assemblyStep,
                        glyphPool
                    ), glyphWrites);
                }
                if (this.line4El && !calmGlyphHover.isActive(this.line4El)) {
                    this.setLineVisualText(this.line4El, this.formatOdometerLineForProgress(
                        getFinaleLines()[4],
                        4,
                        p,
                        assemblyStep,
                        glyphPool
                    ), glyphWrites);
                }
            } else {
                if (this.line0El && !calmGlyphHover.isActive(this.line0El)) {
                    this.setLineVisualText(this.line0El, getFinaleLines()[0], glyphWrites);
                }
                if (this.line1El && !calmGlyphHover.isActive(this.line1El)) {
                    this.setLineVisualText(this.line1El, getFinaleLines()[1], glyphWrites);
                }
                if (this.line3El && !calmGlyphHover.isActive(this.line3El)) {
                    this.setLineVisualText(this.line3El, getFinaleLines()[3], glyphWrites);
                }
                if (this.line4El && !calmGlyphHover.isActive(this.line4El)) {
                    this.setLineVisualText(this.line4El, getFinaleLines()[4], glyphWrites);
                }
            }

            // Накопительный такт квантовой строки с ограниченной частотой:
            // Фаза накапливается через dtSec * boundedRateHz в диапазоне [18.0 .. 26.0] шагов/с.
            // При этом каждый не-пробельный символ вращается по индивидуальной скорости,
            // обеспечивая ~8–11 живых смен в секунду на каждый знак без зависимости от uptime.
            if (isSimActive && !state.reducedMotion) {
                const lfoWave =
                    3.2 * Math.sin(this.lfoClockSec * 0.85) +
                    1.8 * Math.cos(this.lfoClockSec * 1.75);
                const boundedRateHz = Math.max(
                    18.0,
                    Math.min(26.0, 21.5 + lfoWave + signals.heartbeat * 2.5)
                );
                this.accumulatedQuantumPhase += dtSec * boundedRateHz;
            }

            const qStep = Math.floor(this.accumulatedQuantumPhase);
            const fontEpoch = getGlyphFontEpoch();
            if (this.quantumCells.length && (state.reducedMotion || qStep !== this.lastQuantumStep ||
                this.layoutDirty || fontEpoch !== this.lastQuantumFontEpoch)) {
                this.lastQuantumStep = qStep;
                this.lastQuantumFontEpoch = fontEpoch;
                updateFinaleQuantumCells(this.quantumCells, glyphPool, qStep, state.reducedMotion, glyphWrites);
            }
            // Один пакет для всех строк: transform и текст не прерывают измерения следующей строки.
            glyphWrites.forEach(apply => apply());
            this.cardBoxEl.style.transform = cardTransform;
        }

        this.layoutDirty = false;
    };
    // --- КОНЕЦ ФУНКЦИИ tick ---
}

const finaleCardAnimator = new FinaleCardDomAnimator();

// ============================================================================
// РАЗДЕЛ 3. СЕМАНТИЧЕСКИЙ КОМПОНЕНТ ВИДИМОЙ ВИЗИТКИ (renderLayer5CipherFinaleView)
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ renderLayer5CipherFinaleView ---
export function renderLayer5CipherFinaleView(state: Readonly<UniverseState>): Element {
    const isActD = state.singularityAct === 'ACT_D_GITHUB_CARD';
    const isPersistentAmbient = state.finaleReachedOnce && !isActD;
    const isCardVisible = isActD || state.finaleReachedOnce;
    const isInteractive =
        isPersistentAmbient ||
        (isActD && state.githubCardAssemblyProgress >= 0.25);

    const stageVisibleClass = isCardVisible ? ' visible' : '';
    const ambientLoopClass = isPersistentAmbient ? ' ambient-loop' : '';
    const actionsVisibleClass = isInteractive ? ' visible' : '';

    const profileLabel = translateUi('[ ↗ GITHUB PROFILE : DUBNOV ALEXEY ]');
    const repoLabel = translateUi('[ ↗ PROJECT REPOSITORY ]');
    const restartLabel = translateUi('[ ↻ RESTART UNIVERSE CYCLE ]');

    return (
        <section
            className={`finale-stage-container${stageVisibleClass}`}
            data-github-card="true"
            role="region"
            aria-label={translateUi('Финальная визитка автора — Dubnov Alexey')}
            aria-hidden={isCardVisible ? 'false' : 'true'}
        >
            <div
                className="sr-only-manifesto"
                data-bind="l5-manifesto"
                aria-live="polite"
                aria-atomic="true"
            >
                {isInteractive ? getFinaleLines().join(' — ') : ''}
            </div>

            <article
                className={`finale-manifesto-card${ambientLoopClass}`}
                data-bind="l5-card-box"
                onMouseEnter={(): void => {
                    if (document.body.dataset.explanationOpen !== 'true') universeStore.setFinaleCardHovered(true);
                }}
                onMouseLeave={(): void => {
                    universeStore.setFinaleCardHovered(false);
                }}
            >
                <h1
                    className="finale-line-author"
                    data-bind="l5-line-0"
                    onPointerEnter={(e: PointerEvent): void => {
                        if (e.currentTarget instanceof HTMLElement) {
                            triggerLineOrButtonScramble(
                                e.currentTarget,
                                getFinaleLines()[0]
                            );
                        }
                    }}
                >
                    {getFinaleLines()[0]}
                </h1>

                <p
                    className="finale-line-subtitle"
                    dir={getLocale() === 'he' ? 'rtl' : 'ltr'}
                    data-bind="l5-line-1"
                    onPointerEnter={(event: PointerEvent): void => {
                        triggerLineOrButtonScramble(event.currentTarget as HTMLElement, getFinaleLines()[1]);
                    }}
                >
                    {getFinaleLines()[1]}
                </p>

                <div
                    className="finale-line-quantum-stream"
                    data-bind="l5-line-2"
                    aria-hidden="true"
                >
                    {getFinaleLines()[2]}
                </div>

                <p
                    className="finale-line-math"
                    data-bind="l5-line-3"
                >
                    {renderFinaleTermParts(3, isInteractive)}
                </p>

                <p
                    className="finale-line-stack"
                    data-bind="l5-line-4"
                    onPointerEnter={(event: PointerEvent): void => {
                        triggerLineOrButtonScramble(event.currentTarget as HTMLElement, getFinaleLines()[4]);
                    }}
                >
                    {getFinaleLines()[4]}
                </p>

                <div
                    className={`finale-counter-actions${actionsVisibleClass}`}
                    data-bind="l5-actions"
                    onFocusIn={(e: FocusEvent): void => {
                        const target = e.target;
                        if (target instanceof HTMLElement && target.matches('.btn-cipher-action')) {
                            triggerLineOrButtonScramble(
                                target,
                                target.dataset.canonicalText ?? target.textContent ?? ''
                            );
                        }
                    }}
                >
                    <a
                        className="btn-cipher-action"
                        id="link-open-profile"
                        href="https://github.com/DubnovAlexey"
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={isInteractive ? 0 : -1}
                        onPointerEnter={(e: PointerEvent): void => {
                            if (e.currentTarget instanceof HTMLElement) {
                                triggerLineOrButtonScramble(
                                    e.currentTarget,
                                    profileLabel
                                );
                            }
                        }}
                    >
                        {profileLabel}
                    </a>

                    <a
                        className="btn-cipher-action"
                        id="link-open-repo"
                        href="https://github.com/DubnovAlexey/universe"
                        target="_blank"
                        rel="noopener noreferrer"
                        tabIndex={isInteractive ? 0 : -1}
                        onPointerEnter={(e: PointerEvent): void => {
                            if (e.currentTarget instanceof HTMLElement) {
                                triggerLineOrButtonScramble(
                                    e.currentTarget,
                                    repoLabel
                                );
                            }
                        }}
                    >
                        {repoLabel}
                    </a>

                    <button
                        type="button"
                        className="btn-cipher-action"
                        id="btn-restart-universe"
                        disabled={!isInteractive}
                        tabIndex={isInteractive ? 0 : -1}
                        onPointerEnter={(e: PointerEvent): void => {
                            if (e.currentTarget instanceof HTMLElement) {
                                triggerLineOrButtonScramble(
                                    e.currentTarget,
                                    restartLabel
                                );
                            }
                        }}
                        onClick={(): void => {
                            universeStore.triggerUniverseRestart();
                        }}
                    >
                        {restartLabel}
                    </button>
                </div>
            </article>
        </section>
    );
}
// --- КОНЕЦ ФУНКЦИИ renderLayer5CipherFinaleView ---

// ============================================================================
// РАЗДЕЛ 4. MOUNT-ONCE МОНТИРОВЩИК СЛОЯ 5 (mountLayer5CipherFinale)
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ mountLayer5CipherFinale ---
export function mountLayer5CipherFinale(container: HTMLElement | null): () => void {
    if (!container) return () => {};

    let rootEl: HTMLElement | null = null;
    let cardBoxEl: HTMLElement | null = null;
    let manifestoEl: HTMLElement | null = null;
    let actionsEl: HTMLElement | null = null;
    let profileLinkEl: HTMLAnchorElement | null = null;
    let repoLinkEl: HTMLAnchorElement | null = null;
    let restartBtn: HTMLButtonElement | null = null;
    let lastDomState = '';

    // --- НАЧАЛО ФУНКЦИИ update (mountLayer5CipherFinale) ---
    const update = (state: Readonly<UniverseState>): void => {
        if (!rootEl || !container.contains(rootEl)) {
            rootEl = renderLayer5CipherFinaleView(state) as HTMLElement;
            container.replaceChildren(rootEl);
            cardBoxEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-card-box"]');
            manifestoEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-manifesto"]');
            actionsEl = rootEl.querySelector<HTMLElement>('[data-bind="l5-actions"]');
            profileLinkEl = rootEl.querySelector<HTMLAnchorElement>('#link-open-profile');
            repoLinkEl = rootEl.querySelector<HTMLAnchorElement>('#link-open-repo');
            restartBtn = rootEl.querySelector<HTMLButtonElement>('#btn-restart-universe');
            finaleCardAnimator.bindElements(rootEl);
            lastDomState = '';
        }

        const isActD = state.singularityAct === 'ACT_D_GITHUB_CARD';
        const isPersistentAmbient = state.finaleReachedOnce && !isActD;
        const isCardVisible = isActD || state.finaleReachedOnce;
        const showActions =
            isPersistentAmbient ||
            (isActD && state.githubCardAssemblyProgress >= 0.25);

        const domState = `${isCardVisible}:${isPersistentAmbient}:${showActions}`;
        if (domState === lastDomState) return;
        lastDomState = domState;

        rootEl.classList.toggle('visible', isCardVisible);
        rootEl.setAttribute('aria-hidden', isCardVisible ? 'false' : 'true');
        cardBoxEl?.classList.toggle('ambient-loop', isPersistentAmbient);
        actionsEl?.classList.toggle('visible', showActions);

        if (isCardVisible) {
            finaleCardAnimator.startIfNeeded();
        } else {
            finaleCardAnimator.stop();
        }

        if (manifestoEl) {
            manifestoEl.textContent = showActions
                ? getFinaleLines().join(' — ')
                : '';
        }
        if (profileLinkEl) {
            profileLinkEl.tabIndex = showActions ? 0 : -1;
        }
        if (repoLinkEl) {
            repoLinkEl.tabIndex = showActions ? 0 : -1;
        }
        if (restartBtn) {
            restartBtn.disabled = !showActions;
            restartBtn.tabIndex = showActions ? 0 : -1;
        }
        rootEl.querySelectorAll<HTMLButtonElement>('.finale-term').forEach((button) => {
            button.disabled = !showActions;
            button.tabIndex = showActions ? 0 : -1;
        });
    };
    // --- КОНЕЦ ФУНКЦИИ update (mountLayer5CipherFinale) ---

    const unsubscribe = universeStore.subscribe(update);
    const unsubscribeLocale = subscribeLocale(() => {
        finaleCardAnimator.stop();
        rootEl?.querySelectorAll<HTMLElement>('[data-bind^="l5-line-"], [data-finale-term-part], .btn-cipher-action')
            .forEach((element) => calmGlyphHover.stop(element));
        rootEl = null;
        update(universeStore.getState());
    });
    return () => {
        finaleCardAnimator.stop();
        rootEl?.querySelectorAll<HTMLElement>('[data-bind^="l5-line-"], [data-finale-term-part], .btn-cipher-action')
            .forEach((el) => calmGlyphHover.stop(el));
        unsubscribe();
        unsubscribeLocale();
    };
}
// --- КОНЕЦ ФУНКЦИИ mountLayer5CipherFinale ---

export default renderLayer5CipherFinaleView;
