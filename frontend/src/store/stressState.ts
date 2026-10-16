// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/store/stressState.ts
// НАЗНАЧЕНИЕ: Математическая модель BREACH LENS, C¹-рефракции и микротрещин (MASTER 04 v2.0)
// ЗАДАЧИ ФАЙЛА:
// 1. Двигать центр линзы (lensX, lensY) критически демпфированной пружиной (ζ ≈ 0.92).
// 2. Поддерживать управление мышью, касанием (touch) и клавиатурой (Стрелки, Space, Esc).
// 3. Вычислять C¹-непрерывное поле преломления δ(p) = r̂·A·g(d) + t̂·B·g(d), строго g=0 за кромкой.
// 4. Генерировать 3–8 детерминированных микротрещин через DeterministicPRNG (без Math.random).
// 5. Выполнять режиссёрский авто-разрыв около 66 с цикла при отсутствии пользовательского ввода.
// ============================================================================

import { universeStore } from './universeState';
import { DeterministicPRNG } from '../core/prng';

export interface SpaceShockwave {
    id: number;
    x: number;
    y: number;
    currentRadius: number;
    maxRadius: number;
    strength: number;
    life: number;
}

export interface MicroCrackSegment {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    thickness: number;
}

export interface MembraneMicroCrack {
    id: number;
    anchorAngle: number;
    segments: MicroCrackSegment[];
    branches: MicroCrackSegment[];
    life: number;
    maxLife: number;
    intensity: number;
}

export interface SpontaneousRift {
    id: number;
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    life: number;
}

export interface RefractionOffset {
    dx: number;
    dy: number;
    rimHighlight: number;
    dispersionFactor: number;
}

export interface StressStateData {
    globalStress: number;
    targetStress: number;
    pointerX: number;
    pointerY: number;
    lensX: number;
    lensY: number;
    lensVx: number;
    lensVy: number;
    normX: number;
    normY: number;
    isPointerInside: boolean;
    isBreaching: boolean;
    hasUserInteracted: boolean;
    ghostHintAlpha: number; // Однократная призрачная подсказка у курсора около 60 с (MASTER 00)
    currentBreachRadius: number;
    baseBreachRadius: number;
    maxBreachRadius: number;
    revealIntensity: number;
    shockwaves: SpaceShockwave[];
    microCracks: MembraneMicroCrack[];
    spontaneousRifts: SpontaneousRift[];
}

class StressStateController {
    private state: StressStateData = {
        globalStress: 0.05,
        targetStress: 0.05,
        pointerX: 960,
        pointerY: 540,
        lensX: 960,
        lensY: 540,
        lensVx: 0,
        lensVy: 0,
        normX: 0.5,
        normY: 0.5,
        isPointerInside: false,
        isBreaching: false,
        hasUserInteracted: false,
        ghostHintAlpha: 0,
        currentBreachRadius: 0,
        baseBreachRadius: 115,
        maxBreachRadius: 225,
        revealIntensity: 0,
        shockwaves: [],
        microCracks: [],
        spontaneousRifts: [],
    };

    private nextId = 1;
    private radialVelocity = 0;
    private viewportWidth = 1920;
    private viewportHeight = 1080;
    private viewportMinSide = 1080;

    constructor() {
        if (typeof window !== 'undefined') {
            this.bindKeyboardNavigation();
        }
    }

    public getState(): Readonly<StressStateData> {
        return this.state;
    }

    // Клавиатурная альтернатива по MASTER 04: стрелки двигают линзу, Space удерживает, Esc закрывает
    private bindKeyboardNavigation(): void {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            const step = 28;
            if (e.key === 'ArrowLeft') {
                this.moveLensByKeyboard(-step, 0);
            } else if (e.key === 'ArrowRight') {
                this.moveLensByKeyboard(step, 0);
            } else if (e.key === 'ArrowUp') {
                this.moveLensByKeyboard(0, -step);
            } else if (e.key === 'ArrowDown') {
                this.moveLensByKeyboard(0, step);
            } else if (e.key === ' ' && !e.repeat) {
                if (!this.state.isPointerInside) {
                    this.updatePointer(this.viewportWidth * 0.5, this.viewportHeight * 0.5, this.viewportWidth, this.viewportHeight);
                }
                this.setBreaching(true, true);
            } else if (e.key === 'Escape') {
                this.setBreaching(false, false);
                this.clearPointer();
            }
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            if (e.key === ' ') {
                this.setBreaching(false, false);
            }
        });
    }

    private moveLensByKeyboard(dx: number, dy: number): void {
        const baseX = this.state.isPointerInside ? this.state.pointerX : this.viewportWidth * 0.5;
        const baseY = this.state.isPointerInside ? this.state.pointerY : this.viewportHeight * 0.5;
        const nx = Math.max(40, Math.min(this.viewportWidth - 40, baseX + dx));
        const ny = Math.max(40, Math.min(this.viewportHeight - 40, baseY + dy));
        this.updatePointer(nx, ny, this.viewportWidth, this.viewportHeight);
    }

    public updatePointer(x: number, y: number, viewportWidth: number, viewportHeight: number): void {
        this.viewportWidth = Math.max(320, viewportWidth);
        this.viewportHeight = Math.max(320, viewportHeight);
        this.viewportMinSide = Math.min(this.viewportWidth, this.viewportHeight);

        // Радиус R = 12–24% меньшей стороны окна по MASTER 04
        this.state.baseBreachRadius = Math.round(this.viewportMinSide * 0.12);
        this.state.maxBreachRadius = Math.round(this.viewportMinSide * 0.22);

        if (!this.state.isPointerInside) {
            this.state.lensX = x;
            this.state.lensY = y;
        }

        this.state.pointerX = x;
        this.state.pointerY = y;
        this.state.normX = this.viewportWidth > 0 ? x / this.viewportWidth : 0.5;
        this.state.normY = this.viewportHeight > 0 ? y / this.viewportHeight : 0.5;
        this.state.isPointerInside = true;
    }

    public clearPointer(): void {
        this.state.isPointerInside = false;
        if (this.state.isBreaching) {
            this.setBreaching(false, false);
        }
    }

    public setBreaching(active: boolean, triggerShockwave = true): void {
        const wasBreaching = this.state.isBreaching;
        this.state.isBreaching = active;
        if (active) {
            this.state.hasUserInteracted = true;
            this.state.ghostHintAlpha = 0;
        }

        if (active && !wasBreaching && this.state.isPointerInside) {
            universeStore.emitEvent(
                'breach:opened',
                `BREACH LENS открыта в (${Math.round(this.state.lensX)}, ${Math.round(this.state.lensY)}) [wgsl/breach.wgsl]`
            );
            if (triggerShockwave) {
                this.spawnShockwave(this.state.lensX, this.state.lensY, this.state.maxBreachRadius * 1.6, 0.8);
            }
            this.generateDeterministicMicroCracks();
        } else if (!active && wasBreaching) {
            universeStore.emitEvent('breach:closed', 'Оптическая мембрана BREACH закрыта.');
        }
    }

    public setTargetStress(stress: number): void {
        this.state.targetStress = Math.max(0, Math.min(1, stress));
    }

    public injectEntropySpike(amount = 0.35, centerX?: number, centerY?: number): void {
        this.state.globalStress = Math.min(1.0, this.state.globalStress + amount);
        if (centerX !== undefined && centerY !== undefined) {
            this.spawnShockwave(centerX, centerY, this.viewportMinSide * 0.5, 0.9);
            this.spawnSpontaneousRift(centerX, centerY);
        }
        universeStore.emitEvent(
            'stress:threshold-crossed',
            `Скачок напряжения ткани: ${Math.round(this.state.globalStress * 100)}% [rust/breach_math.rs]`
        );
    }

    public spawnShockwave(x: number, y: number, maxRadius = 360, strength = 0.7): void {
        this.state.shockwaves.push({
            id: this.nextId++,
            x,
            y,
            currentRadius: 12,
            maxRadius,
            strength,
            life: 1.0,
        });
        if (this.state.shockwaves.length > 10) {
            this.state.shockwaves.shift();
        }
    }

    private spawnSpontaneousRift(x: number, y: number): void {
        const rng = new DeterministicPRNG(universeStore.getState().seed + this.nextId * 71);
        this.state.spontaneousRifts.push({
            id: this.nextId++,
            x,
            y,
            radius: 14,
            maxRadius: this.viewportMinSide * rng.nextRange(0.08, 0.14),
            life: 1.0,
        });
        if (this.state.spontaneousRifts.length > 5) {
            this.state.spontaneousRifts.shift();
        }
    }

    // Генерация 3–8 детерминированных микротрещин (0.5–1.0 px) строго от eventSeed
    private generateDeterministicMicroCracks(): void {
        this.state.microCracks = [];
        const uState = universeStore.getState();
        const eventSeed = (uState.seed ^ Math.imul(this.nextId, 0x9e3779b9)) >>> 0;
        const rng = new DeterministicPRNG(eventSeed);

        const crackCount = Math.min(8, Math.max(3, Math.floor(4 + this.state.globalStress * 4)));

        for (let i = 0; i < crackCount; i++) {
            const anchorAngle = (i / crackCount) * Math.PI * 2 + rng.nextRange(-0.22, 0.22);
            const segmentCount = 2 + (rng.nextU32() % 4); // 2..5 укорачивающихся сегментов

            const segments: MicroCrackSegment[] = [];
            const branches: MicroCrackSegment[] = [];

            let curX = 0;
            let curY = 0;
            let curAngle = anchorAngle + rng.nextRange(-0.32, 0.32);
            let segLen = 14 + this.state.globalStress * 18;

            for (let s = 0; s < segmentCount; s++) {
                const nextX = curX + Math.cos(curAngle) * segLen;
                const nextY = curY + Math.sin(curAngle) * segLen;
                const thickness = Math.max(0.5, 1.0 - (s / segmentCount) * 0.45);

                segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY, thickness });

                if (s < 2 && rng.nextFloat() > 0.35) {
                    const branchAngle = curAngle + (rng.nextFloat() > 0.5 ? 0.52 : -0.52);
                    const branchLen = segLen * 0.55;
                    branches.push({
                        x1: nextX,
                        y1: nextY,
                        x2: nextX + Math.cos(branchAngle) * branchLen,
                        y2: nextY + Math.sin(branchAngle) * branchLen,
                        thickness: 0.55,
                    });
                }

                curX = nextX;
                curY = nextY;
                curAngle += rng.nextRange(-0.28, 0.28);
                segLen *= 0.72;
            }

            this.state.microCracks.push({
                id: this.nextId++,
                anchorAngle,
                segments,
                branches,
                life: 1.0,
                maxLife: rng.nextRange(0.9, 1.6),
                intensity: 0.7 + this.state.globalStress * 0.3,
            });
        }
    }

    public stepPhysics(dtSeconds: number): void {
        const dt = Math.min(dtSeconds, 0.05);
        const uState = universeStore.getState();
        const simSec = uState.telemetry.simulationTimeSec;

        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.state.currentBreachRadius = 0;
            this.state.revealIntensity = 0;
            this.state.shockwaves = [];
            this.state.microCracks = [];
            this.state.spontaneousRifts = [];
            return;
        }

        this.state.globalStress += (this.state.targetStress - this.state.globalStress) * dt * 1.6;

        // Однократная призрачная подсказка около 60 с цикла (MASTER 00 раздел 1)
        if (!this.state.hasUserInteracted && simSec >= 58.5 && simSec <= 64.5) {
            this.state.ghostHintAlpha = Math.sin(((simSec - 58.5) / 6.0) * Math.PI) * 0.38;
        } else {
            this.state.ghostHintAlpha = 0;
        }

        // Режиссёрский автоматический разрыв на 66–71 с, если пользователь ещё не нажимал мышь (MASTER 04)
        const isDirectorAutoBreach =
            !this.state.hasUserInteracted &&
            uState.currentPhase === '04_COLLAPSE' &&
            simSec >= 66.0 &&
            simSec <= 71.5;

        if (isDirectorAutoBreach && !this.state.isPointerInside) {
            this.state.lensX = this.viewportWidth * 0.5 + Math.cos(simSec * 0.8) * 120;
            this.state.lensY = this.viewportHeight * 0.5 + Math.sin(simSec * 0.8) * 70;
        }

        // Критически/слегка недодемпфированная пружина (ζ ≈ 0.92) следования центра линзы
        if (this.state.isPointerInside) {
            const omega = 14.0;
            const zeta = 0.92;
            const ax = omega * omega * (this.state.pointerX - this.state.lensX) - 2 * zeta * omega * this.state.lensVx;
            const ay = omega * omega * (this.state.pointerY - this.state.lensY) - 2 * zeta * omega * this.state.lensVy;

            this.state.lensVx += ax * dt;
            this.state.lensVy += ay * dt;
            this.state.lensX += this.state.lensVx * dt;
            this.state.lensY += this.state.lensVy * dt;
        }

        let targetRadius = 0;
        if (this.state.isPointerInside || isDirectorAutoBreach) {
            const stressBonus = this.state.globalStress * 32;
            targetRadius =
                this.state.isBreaching || isDirectorAutoBreach
                    ? this.state.maxBreachRadius + stressBonus
                    : this.state.baseBreachRadius * 0.55;
        }

        const radOmega = 12.5;
        const radZeta = 0.9;
        const radialAccel =
            radOmega * radOmega * (targetRadius - this.state.currentBreachRadius) -
            2 * radZeta * radOmega * this.radialVelocity;
        this.radialVelocity += radialAccel * dt;
        this.state.currentBreachRadius = Math.max(0, this.state.currentBreachRadius + this.radialVelocity * dt);

        const targetReveal =
            this.state.isBreaching || isDirectorAutoBreach ? 1.0 : this.state.isPointerInside ? 0.38 : 0.0;
        this.state.revealIntensity += (targetReveal - this.state.revealIntensity) * dt * 7.5;

        if ((this.state.isBreaching || isDirectorAutoBreach) && this.state.revealIntensity > 0.92) {
            universeStore.emitEventOnce('breach_peak', 'breach:peak');
        }

        for (let i = this.state.microCracks.length - 1; i >= 0; i--) {
            const crack = this.state.microCracks[i];
            const decayRate = this.state.isBreaching || isDirectorAutoBreach ? 0.35 : 1.45;
            crack.life -= (dt / crack.maxLife) * decayRate;
            if (crack.life <= 0.01) {
                this.state.microCracks.splice(i, 1);
            }
        }

        if ((this.state.isBreaching || isDirectorAutoBreach) && this.state.microCracks.length < 3) {
            this.generateDeterministicMicroCracks();
        }

        for (let i = this.state.shockwaves.length - 1; i >= 0; i--) {
            const wave = this.state.shockwaves[i];
            wave.currentRadius += (wave.maxRadius - wave.currentRadius) * dt * 3.8;
            wave.life -= dt * 1.15;
            if (wave.life <= 0.01) this.state.shockwaves.splice(i, 1);
        }

        for (let i = this.state.spontaneousRifts.length - 1; i >= 0; i--) {
            const rift = this.state.spontaneousRifts[i];
            rift.radius += (rift.maxRadius - rift.radius) * dt * 3.2;
            rift.life -= dt * 0.75;
            if (rift.life <= 0.01) this.state.spontaneousRifts.splice(i, 1);
        }
    }

    public getDeformedLensRadiusAtAngle(angleRad: number, simTimeSec = 0): number {
        const baseR = this.state.currentBreachRadius;
        if (baseR <= 1) return 0;
        const warp1 = Math.sin(angleRad * 3.0 + simTimeSec * 1.7) * 0.042;
        const warp2 = Math.cos(angleRad * 5.0 - simTimeSec * 1.1) * 0.024;
        return baseR * (1.0 + (warp1 + warp2) * (0.5 + this.state.globalStress * 0.5));
    }

    // Математическая модель C¹-непрерывного преломления δ(p) = r̂·A·g(d) + t̂·B·g(d) по MASTER 04:
    // строго g(d) = 0 за пределами кольца ширины w вокруг d = 1
    public getBoundaryRefractionOffset(x: number, y: number, simTimeSec = 0): RefractionOffset {
        const r = this.state.currentBreachRadius;
        if (r < 8) {
            return { dx: 0, dy: 0, rimHighlight: 0, dispersionFactor: 0 };
        }

        const dx = x - this.state.lensX;
        const dy = y - this.state.lensY;
        const dist = Math.hypot(dx, dy) + 0.0001;
        const angle = Math.atan2(dy, dx);
        const localR = Math.max(8, this.getDeformedLensRadiusAtAngle(angle, simTimeSec));

        const d = dist / localR;
        const w = 0.24; // Полуширина кольца рефракции вокруг d = 1
        const u = Math.abs(d - 1.0) / w;

        // Строго g(d) = 0 за границей кольца (u >= 1.0)
        if (u >= 1.0) {
            return { dx: 0, dy: 0, rimHighlight: 0, dispersionFactor: 0 };
        }

        // C¹-гладкий колокол: g(u) = (1 - u²)²
        const oneMinusU2 = 1.0 - u * u;
        const g = oneMinusU2 * oneMinusU2;

        const radialUnitX = dx / dist;
        const radialUnitY = dy / dist;
        const tangentUnitX = -radialUnitY;
        const tangentUnitY = radialUnitX;

        const radialAmp = (6.5 + this.state.revealIntensity * 8.5) * g;
        const tangentAmp = Math.sin(angle * 4.0 + simTimeSec * 2.0) * 3.4 * g;

        return {
            dx: radialUnitX * radialAmp + tangentUnitX * tangentAmp,
            dy: radialUnitY * radialAmp + tangentUnitY * tangentAmp,
            rimHighlight: g,
            dispersionFactor: g * (this.state.isBreaching ? 0.85 : 0.35),
        };
    }

    public getTruthRevealFactorAt(x: number, y: number, fullXRayMode = false): number {
        if (fullXRayMode) return 1.0;

        const uState = universeStore.getState();
        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') return 0.0;

        let reveal = uState.opticalWeights.logicConvergence * 0.88;

        if (this.state.currentBreachRadius > 2.0) {
            const dx = x - this.state.lensX;
            const dy = y - this.state.lensY;
            const dist = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            const localR = this.getDeformedLensRadiusAtAngle(angle);

            if (dist < localR) {
                const norm = dist / Math.max(1, localR);
                const coreMask =
                    norm < 0.55
                        ? 1.0
                        : 1.0 -
                        Math.pow((norm - 0.55) / 0.45, 2) * (3.0 - 2.0 * ((norm - 0.55) / 0.45));
                reveal = Math.max(reveal, coreMask * (0.45 + this.state.revealIntensity * 0.55));
            }
        }

        for (let i = 0; i < this.state.spontaneousRifts.length; i++) {
            const rift = this.state.spontaneousRifts[i];
            const dist = Math.hypot(x - rift.x, y - rift.y);
            if (dist < rift.radius) {
                const t = 1.0 - dist / rift.radius;
                reveal = Math.max(reveal, t * t * rift.life * 0.85);
            }
        }

        for (let i = 0; i < this.state.shockwaves.length; i++) {
            const wave = this.state.shockwaves[i];
            const dist = Math.hypot(x - wave.x, y - wave.y);
            const ringDist = Math.abs(dist - wave.currentRadius);
            if (ringDist < 44) {
                const factor = (1.0 - ringDist / 44) * wave.life * wave.strength;
                reveal = Math.max(reveal, factor);
            }
        }

        return Math.max(0.0, Math.min(1.0, reveal));
    }
}

export const stressStore = new StressStateController();