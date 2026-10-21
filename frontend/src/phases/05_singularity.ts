// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/phases/05_singularity.ts
// НАЗНАЧЕНИЕ: MASTER 05 v2.5 — Рождение из Точки Нуля, кеплеровская аккреция,
//             спиральное сжатие в Точку и разлёт ореола вокруг визитки (79–108 с)
// ============================================================================
// ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ:
//   РАЗДЕЛ 1. Акт A (ACT_A_ACCRETION): плавное развёртывание аккреционного диска
//             и полярных джетов из Точки Нуля, закон Кеплера Ω ∝ r^(-3/2) и допплер.
//   РАЗДЕЛ 2. Акт B (ACT_B_LOGIC) и Акт C: непрерывное спиральное сжатие всей
//             материи в центральную Точку Нуля с сохранением момента импульса.
//   РАЗДЕЛ 3. Акт D (ACT_D_GITHUB_CARD): плавный разлёт частиц из Точки Нуля в
//             спокойный фоновый ореол вокруг визитки DUBNOV ALEXEY (исключает
//             слипание 820 узлов в одну точку и спам нулевых рёбер).
// ============================================================================

import type { MorphTargetPoint, QuantumParticle } from './01_void';
import { smootherstep, universeStore } from '../store/universeState';
import { DeterministicPRNG } from '../core/prng';

// ============================================================================
// РАЗДЕЛ 1–3. РАСЧЁТ ЦЕЛЕВЫХ КООРДИНАТ ФАЗЫ 05 (computeSingularityTarget)
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ computeSingularityTarget ---
/**
 * Вычисляет целевую точку и энергию частицы p для всех подактов фазы 05_SINGULARITY:
 * от рождения Чёрной дыры из точки и сжатия обратно в точку до раскрытия ореола визитки.
 */
export function computeSingularityTarget(
    p: QuantumParticle,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    simTimeSec: number
): MorphTargetPoint {
    const uState = universeStore.getState();
    const act = uState.singularityAct;
    const actProgress = uState.singularityActProgress;

    // ------------------------------------------------------------------------
    // РАЗДЕЛ 1. АКТ A (79.0–87.5 с): Плавное рождение диска и джетов из Точки Нуля
    // ------------------------------------------------------------------------
    if (act === 'ACT_A_ACCRETION' || act === 'NONE' || act === 'INACTIVE') {
        const unfoldFromZero = 0.02 + 0.98 * smootherstep(0.0, 0.44, actProgress);

        // Два узких полярных джета со светлым ядром и лёгкой прецессией
        if (p.id % 14 === 0) {
            const jetSign = p.id % 28 === 0 ? -1 : 1;
            const jetFlow = (simTimeSec * 1.45 + (p.id % 11) / 11) % 1.0;
            const precessionAngle = Math.sin(simTimeSec * 0.9) * 0.045;
            const jetDist =
                (18 + jetFlow * (height * 0.44)) * unfoldFromZero * jetSign;
            const isCoreJet = p.id % 28 === 0;
            const spread =
                (isCoreJet ? 3 : 16) *
                (0.3 + jetFlow) *
                unfoldFromZero *
                Math.sin(p.id * 2.3 + simTimeSec * 5.5);

            const x = centerX + spread - jetDist * Math.sin(precessionAngle);
            const y = centerY + jetDist * Math.cos(precessionAngle);
            return {
                x,
                y,
                energy:
                    Math.max(0.25, (isCoreJet ? 1.0 : 0.72) - jetFlow * 0.35) *
                    unfoldFromZero,
            };
        }

        const radialFraction = 0.08 + ((p.id % 24) / 23) * 0.86;
        const keplerOmega = 0.42 / Math.pow(radialFraction + 0.18, 1.5);
        const spinAngle = p.id * 2.39996 + simTimeSec * keplerOmega;

        const diskRx = width * (0.06 + radialFraction * 0.39) * unfoldFromZero;
        const isLensedPhotonArch = p.id % 5 === 0;
        const impactParamB = Math.max(0.12, radialFraction);
        const einsteinDeflection = 0.045 / impactParamB;

        const diskRy =
            (isLensedPhotonArch
                ? height * (0.08 + radialFraction * 0.25 + einsteinDeflection)
                : height * (0.028 + radialFraction * 0.125)) * unfoldFromZero;

        const tilt = -0.14;
        const lx = Math.cos(spinAngle) * diskRx;
        const ly = Math.sin(spinAngle) * diskRy;

        const dopplerFactor = -Math.cos(spinAngle) * 0.28;
        const innerHeat = (1.0 - radialFraction) * 0.45;
        const energy = Math.max(
            0.18,
            Math.min(1.0, (0.52 + innerHeat + dopplerFactor) * unfoldFromZero)
        );

        return {
            x: centerX + lx * Math.cos(tilt) - ly * Math.sin(tilt),
            y: centerY + lx * Math.sin(tilt) + ly * Math.cos(tilt),
            energy,
            dopplerBoost: dopplerFactor,
        };
    }

    // ------------------------------------------------------------------------
    // РАЗДЕЛ 2. АКТ B (87.5–92.6 с): Непрерывное спиральное сжатие в Точку Нуля
    // ------------------------------------------------------------------------
    if (act === 'ACT_B_LOGIC') {
        const smoothCollapse = smootherstep(0.05, 0.98, actProgress);
        const radiusEnvelope = Math.pow(1.0 - smoothCollapse, 1.85);

        const spokeIndex = p.id % 12;
        const ringTier = (Math.floor(p.id / 12) % 8) / 7;

        // Ускорение углового вращения при уменьшении радиуса (сохранение момента импульса)
        const angularMomentumSpin =
            (1.0 - radiusEnvelope) * (3.6 + (1.0 - ringTier) * 2.4);
        const baseAngle =
            (spokeIndex / 12) * Math.PI * 2 +
            ringTier * 0.35 +
            simTimeSec * 0.28 +
            angularMomentumSpin;

        const rx = width * (0.05 + ringTier * 0.39) * radiusEnvelope;
        const ry = height * (0.05 + ringTier * 0.37) * radiusEnvelope;

        return {
            x: centerX + Math.cos(baseAngle) * rx,
            y: centerY + Math.sin(baseAngle) * ry,
            energy: Math.max(0.08, radiusEnvelope * 0.95),
        };
    }

    // ------------------------------------------------------------------------
    // РАЗДЕЛ 3. АКТ C (импульс Точки Нуля) и АКТ D (Возрождение из точки в ореол визитки)
    // ------------------------------------------------------------------------
    if (act === 'ACT_C_ZERO_SILENCE') {
        const microAngle = p.id * 2.39996 + simTimeSec * 3.2;
        const microR = (p.id % 5) * 0.8 * (1.0 - actProgress * 0.7);
        return {
            x: centerX + Math.cos(microAngle) * microR,
            y: centerY + Math.sin(microAngle) * microR,
            energy: 0.35 * (1.0 - actProgress * 0.5),
        };
    }

    // В Акте D (ACT_D_GITHUB_CARD / RESTART_COLLAPSE) частицы плавно разлетаются
    // из центральной Точки Нуля в спокойный широкий ореол вокруг визитки,
    // чтобы фон продолжал мягко дышать и граф NEXUS сохранял живую структуру.
    const cardProg = Math.max(0, Math.min(1, uState.githubCardAssemblyProgress));
    const haloExpand = smootherstep(0.0, 0.72, cardProg);
    const rHash = DeterministicPRNG.hashFloat(p.id + 104729, 53);
    const aHash = DeterministicPRNG.hashFloat(p.id + 104729, 71);

    const orbitAngle =
        aHash * Math.PI * 2 + simTimeSec * (0.045 + (p.id % 5) * 0.012) * p.quantumSpin;
    const minRingFrac = 0.27;
    const maxRingFrac = 0.48;
    const ringFrac = (minRingFrac + rHash * (maxRingFrac - minRingFrac)) * haloExpand;

    const x = centerX + Math.cos(orbitAngle) * (width * ringFrac);
    const y = centerY + Math.sin(orbitAngle) * (height * ringFrac * 0.86);

    return {
        x,
        y,
        energy: (0.22 + 0.18 * Math.sin(simTimeSec * 1.1 + p.phaseOffset)) * haloExpand,
    };
}
// --- КОНЕЦ ФУНКЦИИ computeSingularityTarget ---