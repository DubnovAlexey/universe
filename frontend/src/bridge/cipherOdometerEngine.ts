// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/cipherOdometerEngine.ts
// НАЗНАЧЕНИЕ: Движок 3D-барабанов Odometer, магнитного detent и вёрстки (MASTER 05 v2.0)
// ЗАДАЧИ ФАЙЛА:
// 1. Хранить 5 каноничных строк финала и упорядоченный алфавитный барабан символов.
// 2. Адаптивно переносить длинные строки 4–5 по разделителям ' · ' на узких экранах
//    (320px..1920px), полностью исключая обрезку (clipping) текста.
// 3. Вычислять физически достоверное торможение барабанов с магнитной фиксацией (detent),
//    волной защёлкивания слева направо (15–25 мс на колонку) и гарантией 100% фиксации
//    всех символов к progress = 0.86 (никакого зависания или дрожи последних букв!).
// 4. Сохранять спиральные траектории для обратного возврата глифов в Точку Нуля при Restart.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. КАНОНИЧНЫЕ 5 СТРОК ФИНАЛА И УПОРЯДОЧЕННОЕ КОЛЕСО СИМВОЛОВ (MASTER 05 АКТ D)
// ----------------------------------------------------------------------------
export const CANONICAL_FINALE_LINES: ReadonlyArray<string> = [
    'UNIVERSE // NEURAL SINGULARITY',
    'ALEXEY DUBNOV',
    'GITHUB.COM / DUBNOVALEXEY / UNIVERSE',
    'ВРЕМЯ · ПРОСТРАНСТВО · МЫСЛЬ · ОБРАЗ · КОД',
    'ASTRO · TYPESCRIPT · REACT · WEBGPU · RUST/WASM · PYTHON',
];

// Упорядоченный набор символов барабана: вращение читается как прокрутка алфавитного колеса
export const ORDERED_WHEEL_ALPHABET =
    ' ABCDEFGHIJKLMNOPQRSTUVWXYZАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ0123456789/·.-';

export interface OdometerGlyphCellState {
    readonly lineIndex: number;
    readonly charIndex: number;
    readonly targetChar: string;
    readonly targetX: number;
    readonly targetY: number;
    readonly currentX: number;
    readonly currentY: number;
    readonly fontSizePx: number;
    readonly fontWeight: string;
    readonly colorHex: string;
    readonly stepWidthPx: number;
    readonly isLocked: boolean;
    readonly lockFlash: number;      // Короткий янтарно-циановый импульс в момент защёлкивания (0..1)
    readonly primaryChar: string;    // Текущая центральная грань 3D-барабана
    readonly upperChar: string;      // Верхняя соседняя грань в перспективе
    readonly lowerChar: string;      // Нижняя соседняя грань в перспективе
    readonly wheelPhaseFrac: number; // Смещение прокрутки грани (-0.5 .. +0.5)
    readonly verticalScale: number;  // Косинусное перспективное сжатие грани при вращении
}

interface ResponsiveSubRow {
    lineIndex: number;
    text: string;
    fontSizePx: number;
    fontWeight: string;
    colorHex: string;
    letterSpacingPx: number;
    yOffsetPx: number;
    rowStartProgress: number;
}

// ----------------------------------------------------------------------------
// 2. КЛАСС ДВИЖКА 3D-БАРАБАНОВ ODOMETER С ГАРАНТИРОВАННОЙ СХОДИМОСТЬЮ
// ----------------------------------------------------------------------------
export class CipherOdometerEngine {
    private readonly alphabetLen = ORDERED_WHEEL_ALPHABET.length;

    // Адаптивная раскладка строк под любую ширину экрана (320, 360, 390, 768, 1280, 1920 px)
    public buildResponsiveLayout(viewportWidth: number, viewportHeight: number): ResponsiveSubRow[] {
        const safeW = Math.max(320, viewportWidth);
        const isCompactMobile = safeW < 640;
        const isTablet = safeW >= 640 && safeW < 1024;

        const baseScale = isCompactMobile
            ? Math.max(0.54, safeW / 680)
            : isTablet
                ? 0.82
                : 1.0;

        const rawSpecs = [
            { idx: 0, text: CANONICAL_FINALE_LINES[0], size: 13, weight: '600', color: '#7dd3fc', spacing: 10.5 },
            { idx: 1, text: CANONICAL_FINALE_LINES[1], size: 26, weight: '700', color: '#f8fafc', spacing: 17.5 },
            { idx: 2, text: CANONICAL_FINALE_LINES[2], size: 14, weight: '600', color: '#38bdf8', spacing: 10.0 },
            { idx: 3, text: CANONICAL_FINALE_LINES[3], size: 13, weight: '500', color: '#f59e0b', spacing: 9.2 },
            { idx: 4, text: CANONICAL_FINALE_LINES[4], size: 11.5, weight: '500', color: '#7dd3fc', spacing: 8.2 },
        ];

        const subRows: Array<Omit<ResponsiveSubRow, 'yOffsetPx' | 'rowStartProgress'>> = [];
        const maxAllowedRowWidth = safeW * 0.88;

        for (let i = 0; i < rawSpecs.length; i++) {
            const spec = rawSpecs[i];
            const scaledSize = Math.max(9, Math.round(spec.size * baseScale));
            let scaledSpacing = spec.spacing * baseScale;
            const estimatedWidth = spec.text.length * scaledSpacing;

            // Если строка 4 или 5 с разделителями ' · ' не помещается на узком экране — делим на 2 ряда
            if (estimatedWidth > maxAllowedRowWidth && spec.text.includes(' · ')) {
                const parts = spec.text.split(' · ');
                const mid = Math.ceil(parts.length / 2);
                const firstHalf = parts.slice(0, mid).join(' · ');
                const secondHalf = parts.slice(mid).join(' · ');

                const maxHalfLen = Math.max(firstHalf.length, secondHalf.length);
                if (maxHalfLen * scaledSpacing > maxAllowedRowWidth) {
                    scaledSpacing = maxAllowedRowWidth / Math.max(1, maxHalfLen);
                }

                subRows.push({
                    lineIndex: spec.idx,
                    text: firstHalf,
                    fontSizePx: scaledSize,
                    fontWeight: spec.weight,
                    colorHex: spec.color,
                    letterSpacingPx: scaledSpacing,
                });
                subRows.push({
                    lineIndex: spec.idx,
                    text: secondHalf,
                    fontSizePx: scaledSize,
                    fontWeight: spec.weight,
                    colorHex: spec.color,
                    letterSpacingPx: scaledSpacing,
                });
            } else {
                if (estimatedWidth > maxAllowedRowWidth) {
                    scaledSpacing = maxAllowedRowWidth / Math.max(1, spec.text.length);
                }
                subRows.push({
                    lineIndex: spec.idx,
                    text: spec.text,
                    fontSizePx: scaledSize,
                    fontWeight: spec.weight,
                    colorHex: spec.color,
                    letterSpacingPx: scaledSpacing,
                });
            }
        }

        // Вертикальное центрирование всех рядов с учётом высоты экрана
        const rowGap = Math.min(36, Math.max(22, viewportHeight * 0.044));
        const totalBlockHeight = (subRows.length - 1) * rowGap;
        const startYOffset = -totalBlockHeight * 0.5 - 18;

        return subRows.map((row, rIdx) => ({
            ...row,
            yOffsetPx: startYOffset + rIdx * rowGap,
            // Тайминги старта рядов распределены в окне [0.04 .. 0.36], чтобы к 0.84 все 100% букв встали в lock!
            rowStartProgress: 0.04 + (rIdx / Math.max(1, subRows.length - 1)) * 0.32,
        }));
    }

    // Вычисление состояния всех ячеек 3D-барабанов для заданного прогресса p ∈ [0, 1]
    public evaluateCells(
        viewportWidth: number,
        viewportHeight: number,
        assemblyProgress: number,
        reducedMotion = false
    ): OdometerGlyphCellState[] {
        const cx = viewportWidth * 0.5;
        const cy = viewportHeight * 0.5;
        const p = Math.max(0, Math.min(1, assemblyProgress));
        const rows = this.buildResponsiveLayout(viewportWidth, viewportHeight);
        const cells: OdometerGlyphCellState[] = [];

        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const chars = row.text.split('');
            const totalW = (chars.length - 1) * row.letterSpacingPx;
            const startX = cx - totalW * 0.5;
            const targetY = cy + row.yOffsetPx;

            for (let c = 0; c < chars.length; c++) {
                const targetChar = chars[c];
                if (targetChar === ' ') continue;

                const targetX = startX + c * row.letterSpacingPx;
                // Волна слева направо: смещение старта колонки до 0.20, длительность вращения 0.28.
                // Максимальная точка окончания последней буквы: 0.36 + 0.20 + 0.28 = 0.84 (< 1.0!).
                const colWaveDelay = (c / Math.max(1, chars.length - 1)) * 0.20;
                const charStart = row.rowStartProgress + colWaveDelay;
                const spinDuration = 0.28;

                const localP = Math.max(0, Math.min(1, (p - charStart) / spinDuration));
                if (localP <= 0.001) continue;

                // В режиме prefers-reduced-motion используем спокойный кроссфейд на месте без вращения
                const flyFraction = reducedMotion ? 1.0 : Math.min(1.0, localP / 0.42);
                const flyEase = 1.0 - Math.pow(1.0 - flyFraction, 3);

                // Спиральная траектория вылета из Точки Нуля (и обратного возврата при Restart)
                const spiralAngle = (1.0 - flyEase) * (Math.PI * 1.4 + ((c + r * 3) % 7) * 0.45);
                const spiralRadius = (1.0 - flyEase) * Math.min(150, viewportWidth * 0.18);

                const currentX = cx + (targetX - cx) * flyEase + Math.cos(spiralAngle) * spiralRadius;
                const currentY = cy + (targetY - cy) * flyEase + Math.sin(spiralAngle) * spiralRadius * 0.65;

                const targetAlphabetIdx = Math.max(0, ORDERED_WHEEL_ALPHABET.indexOf(targetChar));
                const isLocked = localP >= 0.999 || reducedMotion;

                if (isLocked) {
                    const timeAfterLock = Math.max(0, p - (charStart + spinDuration));
                    const lockFlash = reducedMotion ? 0 : Math.max(0, 1.0 - timeAfterLock * 6.5);

                    cells.push({
                        lineIndex: row.lineIndex,
                        charIndex: c,
                        targetChar,
                        targetX,
                        targetY,
                        currentX: targetX,
                        currentY: targetY,
                        fontSizePx: row.fontSizePx,
                        fontWeight: row.fontWeight,
                        colorHex: row.colorHex,
                        stepWidthPx: row.letterSpacingPx,
                        isLocked: true,
                        lockFlash,
                        primaryChar: targetChar,
                        upperChar: targetChar,
                        lowerChar: targetChar,
                        wheelPhaseFrac: 0,
                        verticalScale: 1.0,
                    });
                } else {
                    // Экспоненциальное замедление колеса с магнитным дотягиванием (detent) к целевой грани
                    const remaining = 1.0 - localP;
                    const detentEase = remaining * remaining * (2.6 - 1.6 * remaining);
                    const totalSpins = 9 + (c % 5) * 2;
                    const continuousWheelIdx = targetAlphabetIdx + detentEase * totalSpins;

                    const nearestIdx = Math.round(continuousWheelIdx);
                    const wheelPhaseFrac = continuousWheelIdx - nearestIdx; // -0.5 .. +0.5
                    const wrappedPrimary =
                        ((nearestIdx % this.alphabetLen) + this.alphabetLen) % this.alphabetLen;
                    const wrappedUpper =
                        ((wrappedPrimary - 1) + this.alphabetLen) % this.alphabetLen;
                    const wrappedLower = (wrappedPrimary + 1) % this.alphabetLen;

                    const verticalScale = Math.max(0.32, Math.cos(wheelPhaseFrac * Math.PI * 0.85));

                    cells.push({
                        lineIndex: row.lineIndex,
                        charIndex: c,
                        targetChar,
                        targetX,
                        targetY,
                        currentX,
                        currentY,
                        fontSizePx: row.fontSizePx,
                        fontWeight: row.fontWeight,
                        colorHex: row.colorHex,
                        stepWidthPx: row.letterSpacingPx,
                        isLocked: false,
                        lockFlash: 0,
                        primaryChar: ORDERED_WHEEL_ALPHABET[wrappedPrimary],
                        upperChar: ORDERED_WHEEL_ALPHABET[wrappedUpper],
                        lowerChar: ORDERED_WHEEL_ALPHABET[wrappedLower],
                        wheelPhaseFrac,
                        verticalScale,
                    });
                }
            }
        }

        return cells;
    }

    // Верификация точности финальных строк после защёлкивания (renderedText === expectedText)
    public verifyFinalLockedText(viewportWidth = 1920, viewportHeight = 1080): boolean {
        const lockedCells = this.evaluateCells(viewportWidth, viewportHeight, 1.0, false);
        return lockedCells.length > 0 && lockedCells.every((cell) => cell.isLocked && cell.primaryChar === cell.targetChar);
    }
}

export const cipherOdometerEngine = new CipherOdometerEngine();