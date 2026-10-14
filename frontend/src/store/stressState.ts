// ============================================================================
// ФАЙЛ: frontend/src/store/stressState.ts
// НАЗНАЧЕНИЕ: Оптика BREACH LENS, пружинная инерция, рефракция и микротрещины
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Двигает центр линзы (lensX, lensY) за указателем мыши/touch с пружинным демпфированием.
// 2. Масштабирует радиус разрыва в пределах 12-24% от меньшей стороны экрана (viewport).
// 3. Строит 4 зоны оптической маски и вычисляет вектор рефракции звезд на кромке мембраны.
// 4. Генерирует 3-8 детерминированных ветвящихся микротрещин на контуре разрыва и спонтанные разломы.
// ============================================================================

import { universeStore } from './universeState';

// ----------------------------------------------------------------------------
// 1. СТРУКТУРЫ УДАРНЫХ ВОЛН, МИКРОТРЕЩИН МЕМБРАНЫ И СПОНТАННЫХ РАЗРЫВОВ
// ----------------------------------------------------------------------------
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
    anchorAngle: number;      // Угол привязки к кромке BREACH LENS
    segments: MicroCrackSegment[];
    branches: MicroCrackSegment[];
    life: number;             // 0.0 -> 1.0 (фаза жизни трещины)
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
    rimHighlight: number;     // Яркость холодного блика на кромке мембраны (0..1)
    dispersionFactor: number; // Тонкая дисперсия на контрастных дугах (0..1)
}

export interface StressStateData {
    globalStress: number;
    targetStress: number;

    // Сырые координаты указателя мыши или касания пальца (touch)
    pointerX: number;
    pointerY: number;
    // Инерционные координаты центра BREACH LENS (догоняют курсор с пружиной)
    lensX: number;
    lensY: number;
    lensVx: number;
    lensVy: number;

    normX: number;
    normY: number;
    isPointerInside: boolean;

    isBreaching: boolean;
    currentBreachRadius: number;
    baseBreachRadius: number;
    maxBreachRadius: number;
    revealIntensity: number;  // Степень вскрытия мембраны Истины (0..1)

    shockwaves: SpaceShockwave[];
    microCracks: MembraneMicroCrack[];
    spontaneousRifts: SpontaneousRift[];
}

// ----------------------------------------------------------------------------
// 2. КОНТРОЛЛЕР ОПТИЧЕСКОЙ МЕМБРАНЫ ПРОСТРАНСТВА И BREACH LENS
// ----------------------------------------------------------------------------
class StressStateController {
    private state: StressStateData = {
        globalStress: 0.05,
        targetStress: 0.05,
        pointerX: -1000,
        pointerY: -1000,
        lensX: -1000,
        lensY: -1000,
        lensVx: 0,
        lensVy: 0,
        normX: 0.5,
        normY: 0.5,
        isPointerInside: false,
        isBreaching: false,
        currentBreachRadius: 0,
        baseBreachRadius: 110,
        maxBreachRadius: 230,
        revealIntensity: 0,
        shockwaves: [],
        microCracks: [],
        spontaneousRifts: [],
    };

    private nextId = 1;
    private radialVelocity = 0;
    private viewportMinSide = 960;

    public getState(): Readonly<StressStateData> {
        return this.state;
    }

    // Детерминированный псевдослучайный генератор от сида
    private seededRandom(seed: number): number {
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
    }

    // Обновление позиции курсора или точки касания (с калибровкой 12-24% экрана)
    public updatePointer(x: number, y: number, viewportWidth: number, viewportHeight: number): void {
        this.viewportMinSide = Math.max(320, Math.min(viewportWidth, viewportHeight));
        // По спецификации FX 03: диапазон линзы 12-24% меньшей стороны окна
        this.state.baseBreachRadius = Math.round(this.viewportMinSide * 0.11);
        this.state.maxBreachRadius = Math.round(this.viewportMinSide * 0.22);

        if (!this.state.isPointerInside) {
            this.state.lensX = x;
            this.state.lensY = y;
        }

        this.state.pointerX = x;
        this.state.pointerY = y;
        this.state.normX = viewportWidth > 0 ? x / viewportWidth : 0.5;
        this.state.normY = viewportHeight > 0 ? y / viewportHeight : 0.5;
        this.state.isPointerInside = true;
    }

    public clearPointer(): void {
        this.state.isPointerInside = false;
        if (this.state.isBreaching) {
            this.setBreaching(false, false);
        }
    }

    // Раскрытие или закрытие локального разрыва реальности
    public setBreaching(active: boolean, triggerShockwave = true): void {
        const wasBreaching = this.state.isBreaching;
        this.state.isBreaching = active;

        if (active && !wasBreaching && this.state.isPointerInside) {
            universeStore.emitEvent('breach:opened', `BREACH LENS открыта в (${Math.round(this.state.lensX)}, ${Math.round(this.state.lensY)})`);
            if (triggerShockwave) {
                this.spawnShockwave(this.state.lensX, this.state.lensY, this.state.maxBreachRadius * 1.65, 0.8);
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
            this.spawnShockwave(centerX, centerY, this.viewportMinSide * 0.55, 0.95);
            this.spawnSpontaneousRift(centerX, centerY);
        }
        universeStore.emitEvent('stress:threshold-crossed', `Скачок напряжения ткани: ${Math.round(this.state.globalStress * 100)}%`);
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
        this.state.spontaneousRifts.push({
            id: this.nextId++,
            x,
            y,
            radius: 14,
            maxRadius: this.viewportMinSide * (0.08 + Math.random() * 0.06),
            life: 1.0,
        });
        if (this.state.spontaneousRifts.length > 5) {
            this.state.spontaneousRifts.shift();
        }
    }

    // --------------------------------------------------------------------------
    // 3. ГЕНЕРАЦИЯ ДЕТЕРМИНИРОВАННЫХ МИКРОТРЕЩИН НА КРОМКЕ ЛИНЗЫ (3-8 ТРЕЩИН)
    // --------------------------------------------------------------------------
    private generateDeterministicMicroCracks(): void {
        this.state.microCracks = [];
        const crackCount = Math.min(8, Math.max(3, Math.floor(4 + this.state.globalStress * 4)));
        const baseSeed = this.nextId * 37 + Math.round(this.state.lensX);

        for (let i = 0; i < crackCount; i++) {
            const seed = baseSeed + i * 19;
            const anchorAngle = (i / crackCount) * Math.PI * 2 + (this.seededRandom(seed) - 0.5) * 0.45;
            const segmentCount = 2 + Math.floor(this.seededRandom(seed + 1) * 3); // 2..4 сегмента

            const segments: MicroCrackSegment[] = [];
            const branches: MicroCrackSegment[] = [];

            let curX = 0;
            let curY = 0;
            let curAngle = anchorAngle + (this.seededRandom(seed + 2) - 0.5) * 0.65;
            let segLen = 14 + this.state.globalStress * 18;

            for (let s = 0; s < segmentCount; s++) {
                const nextX = curX + Math.cos(curAngle) * segLen;
                const nextY = curY + Math.sin(curAngle) * segLen;
                const thickness = Math.max(0.5, 1.0 - (s / segmentCount) * 0.45);

                segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY, thickness });

                // 1-2 коротких боковых ответвления
                if (s === 0 || (s === 1 && this.seededRandom(seed + s * 7) > 0.45)) {
                    const branchAngle = curAngle + (this.seededRandom(seed + s * 11) > 0.5 ? 0.52 : -0.52);
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
                curAngle += (this.seededRandom(seed + s * 13) - 0.5) * 0.55;
                segLen *= 0.72; // Сегменты укорачиваются к концу
            }

            this.state.microCracks.push({
                id: this.nextId++,
                anchorAngle,
                segments,
                branches,
                life: 1.0,
                maxLife: 0.9 + this.seededRandom(seed + 5) * 0.7,
                intensity: 0.7 + this.state.globalStress * 0.3,
            });
        }
    }

    // --------------------------------------------------------------------------
    // 4. ФИЗИЧЕСКИЙ ШАГ ПРУЖИННОЙ ИНЕРЦИИ ЛИНЗЫ, ТРЕЩИН И СПОНТАННЫХ РАЗРЫВОВ
    // --------------------------------------------------------------------------
    public stepPhysics(dtSeconds: number): void {
        const dt = Math.min(dtSeconds, 0.05);
        const uState = universeStore.getState();

        // В состоянии 2.5с абсолютной тишины (ZERO_SILENCE) все возмущения заморожены
        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') {
            this.state.currentBreachRadius = 0;
            this.state.revealIntensity = 0;
            this.state.shockwaves = [];
            this.state.microCracks = [];
            this.state.spontaneousRifts = [];
            return;
        }

        // 1. Плавная релаксация глобального стресса
        this.state.globalStress += (this.state.targetStress - this.state.globalStress) * dt * 1.6;

        // 2. Пружинная инерция следования центра линзы (lensX, lensY) за указателем (pointerX, pointerY)
        if (this.state.isPointerInside) {
            const posStiffness = 160;
            const posDamping = 18;
            const ax = (this.state.pointerX - this.state.lensX) * posStiffness;
            const ay = (this.state.pointerY - this.state.lensY) * posStiffness;

            this.state.lensVx = (this.state.lensVx + ax * dt) * Math.exp(-posDamping * dt);
            this.state.lensVy = (this.state.lensVy + ay * dt) * Math.exp(-posDamping * dt);
            this.state.lensX += this.state.lensVx * dt;
            this.state.lensY += this.state.lensVy * dt;
        }

        // 3. Пружинная инерция радиуса раскрытия BREACH LENS
        let targetRadius = 0;
        if (this.state.isPointerInside) {
            const stressBonus = this.state.globalStress * 35;
            targetRadius = this.state.isBreaching
                ? this.state.maxBreachRadius + stressBonus
                : this.state.baseBreachRadius * 0.55;
        }

        const radStiffness = 135;
        const radDamping = 14;
        const radialForce = (targetRadius - this.state.currentBreachRadius) * radStiffness;
        this.radialVelocity = (this.radialVelocity + radialForce * dt) * Math.exp(-radDamping * dt);
        this.state.currentBreachRadius = Math.max(0, this.state.currentBreachRadius + this.radialVelocity * dt);

        // Плавная интенсивность раскрытия X-RAY внутри линзы
        const targetReveal = this.state.isBreaching ? 1.0 : this.state.isPointerInside ? 0.38 : 0.0;
        this.state.revealIntensity += (targetReveal - this.state.revealIntensity) * dt * 7.5;

        if (this.state.isBreaching && this.state.revealIntensity > 0.92) {
            universeStore.emitEventOnce('breach_peak', 'breach:peak');
        }

        // 4. Жизненный цикл микротрещин на кромке
        for (let i = this.state.microCracks.length - 1; i >= 0; i--) {
            const crack = this.state.microCracks[i];
            const decayRate = this.state.isBreaching ? 0.35 : 1.45;
            crack.life -= (dt / crack.maxLife) * decayRate;
            if (crack.life <= 0.01) {
                this.state.microCracks.splice(i, 1);
            }
        }

        // Если кнопка удерживается, периодически обновляем затухшие микротрещины
        if (this.state.isBreaching && this.state.microCracks.length < 3) {
            this.generateDeterministicMicroCracks();
        }

        // 5. Обновление ударных волн и спонтанных разрывов при высоком стрессе
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

        // Редкие спонтанные разрывы в фазе TENSION / BREACH при высоком глобальном стрессе
        if (
            this.state.globalStress > 0.68 &&
            this.state.spontaneousRifts.length < 2 &&
            Math.random() < dt * 0.45
        ) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 120 + Math.random() * 220;
            const cx = (typeof window !== 'undefined' ? window.innerWidth : 1920) * 0.5 + Math.cos(angle) * dist;
            const cy = (typeof window !== 'undefined' ? window.innerHeight : 1080) * 0.5 + Math.sin(angle) * dist;
            this.spawnSpontaneousRift(cx, cy);
        }
    }

    // --------------------------------------------------------------------------
    // 5. НЕИДЕАЛЬНЫЙ УПРУГИЙ КОНТУР ЛИНЗЫ И РЕФРАКЦИЯ НА ГРАНИЦЕ (FX 03)
    // --------------------------------------------------------------------------
    public getDeformedLensRadiusAtAngle(angleRad: number, simTimeSec = 0): number {
        const baseR = this.state.currentBreachRadius;
        if (baseR <= 1) return 0;
        // Низкочастотное органическое возмущение кромки (без превращения в шестеренку)
        const warp1 = Math.sin(angleRad * 3.0 + simTimeSec * 1.7) * 0.045;
        const warp2 = Math.cos(angleRad * 5.0 - simTimeSec * 1.1) * 0.025;
        return baseR * (1.0 + (warp1 + warp2) * (0.5 + this.state.globalStress * 0.5));
    }

    // Вычисление оптического смещения (преломления) внешних звезд и волокон у кромки разрыва
    public getBoundaryRefractionOffset(x: number, y: number, simTimeSec = 0): RefractionOffset {
        const r = this.state.currentBreachRadius;
        if (r < 8 || !this.state.isPointerInside) {
            return { dx: 0, dy: 0, rimHighlight: 0, dispersionFactor: 0 };
        }

        const dx = x - this.state.lensX;
        const dy = y - this.state.lensY;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
        const angle = Math.atan2(dy, dx);
        const deformedR = this.getDeformedLensRadiusAtAngle(angle, simTimeSec);

        const bandHalfWidth = Math.max(18, deformedR * 0.24);
        const distFromRim = Math.abs(dist - deformedR);

        if (distFromRim > bandHalfWidth) {
            return { dx: 0, dy: 0, rimHighlight: 0, dispersionFactor: 0 };
        }

        const t = 1.0 - distFromRim / bandHalfWidth;
        const smoothBand = t * t * (3.0 - 2.0 * t);

        const radialUnitX = dx / dist;
        const radialUnitY = dy / dist;
        const tangentUnitX = -radialUnitY;
        const tangentUnitY = radialUnitX;

        const radialPush = smoothBand * (6.5 + this.state.revealIntensity * 8.0);
        const tangentShift = smoothBand * Math.sin(angle * 4.0 + simTimeSec * 2.0) * 3.2;

        return {
            dx: radialUnitX * radialPush + tangentUnitX * tangentShift,
            dy: radialUnitY * radialPush + tangentUnitY * tangentShift,
            rimHighlight: smoothBand,
            dispersionFactor: smoothBand * (this.state.isBreaching ? 0.85 : 0.35),
        };
    }

    // --------------------------------------------------------------------------
    // 6. ЧЕТЫРЕ ЗОНЫ МАСКИ ПРОЗРАЧНОСТИ ИСТИНЫ (X-RAY REVEAL FACTOR 0..1)
    // --------------------------------------------------------------------------
    public getTruthRevealFactorAt(x: number, y: number, fullXRayMode = false): number {
        if (fullXRayMode) return 1.0;

        const uState = universeStore.getState();
        if (uState.singularityAct === 'ACT_C_ZERO_SILENCE') return 0.0;

        // В кульминации LOGIC все три мира прозрачны и совпадают глобально
        let reveal = uState.opticalWeights.logicConvergence * 0.88;

        // 1. Вклад от инерционной BREACH LENS (4 зоны: ядро X-RAY, переход, кольцо рефракции, космос)
        if (this.state.currentBreachRadius > 2.0) {
            const dx = x - this.state.lensX;
            const dy = y - this.state.lensY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            const localR = this.getDeformedLensRadiusAtAngle(angle);

            if (dist < localR) {
                const norm = dist / Math.max(1, localR);
                // Внутренние 55% радиуса — уверенное ядро X-RAY, далее плавный переход
                const coreMask =
                    norm < 0.55
                        ? 1.0
                        : 1.0 - Math.pow((norm - 0.55) / 0.45, 2) * (3.0 - 2.0 * ((norm - 0.55) / 0.45));
                reveal = Math.max(reveal, coreMask * (0.45 + this.state.revealIntensity * 0.55));
            }
        }

        // 2. Вклад от спонтанных разломов пространства
        for (let i = 0; i < this.state.spontaneousRifts.length; i++) {
            const rift = this.state.spontaneousRifts[i];
            const dx = x - rift.x;
            const dy = y - rift.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < rift.radius) {
                const t = 1.0 - dist / rift.radius;
                reveal = Math.max(reveal, t * t * rift.life * 0.85);
            }
        }

        // 3. Вклад от бегущих гравитационных волн
        for (let i = 0; i < this.state.shockwaves.length; i++) {
            const wave = this.state.shockwaves[i];
            const dx = x - wave.x;
            const dy = y - wave.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ringDist = Math.abs(dist - wave.currentRadius);
            const ringThickness = 44;

            if (ringDist < ringThickness) {
                const factor = (1.0 - ringDist / ringThickness) * wave.life * wave.strength;
                reveal = Math.max(reveal, factor);
            }
        }

        return Math.max(0.0, Math.min(1.0, reveal));
    }
}

export const stressStore = new StressStateController();