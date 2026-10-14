// ============================================================================
// ФАЙЛ: frontend/src/store/stressState.ts
// НАЗНАЧЕНИЕ: Математическая модель напряжения пространства и Разрыва (Breach)
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Отслеживает координаты курсора наблюдателя и превращает его в «Линзу Истины».
// 2. Рассчитывает пружинную инерцию раскрытия разрыва (Breach Lens) при клике/удержании.
// 3. Управляет ударными волнами (Shockwaves), искажающими ткань пространства.
// 4. Вычисляет в любой точке экрана коэффициент видимости Истины сквозь Иллюзию (0..1).
// ============================================================================

// ----------------------------------------------------------------------------
// 1. ИНТЕРФЕЙСЫ РАЗРЫВА РЕАЛЬНОСТИ И УДАРНЫХ ВОЛН
// ----------------------------------------------------------------------------
export interface SpaceShockwave {
    id: number;
    x: number;           // Экранная координата X центра волны (в пикселях)
    y: number;           // Экранная координата Y центра волны (в пикселях)
    currentRadius: number;
    maxRadius: number;
    strength: number;    // Сила гравитационного/оптического толчка (0.0 .. 1.0)
    life: number;        // Оставшееся время жизни волны (1.0 -> 0.0)
}

export interface StressStateData {
    // Глобальный уровень стресса/энтропии ткани пространства (0.0 - покой, 1.0 - коллапс)
    globalStress: number;
    targetStress: number;

    // Координаты курсора наблюдателя (в пикселях экрана и нормализованные 0..1)
    pointerX: number;
    pointerY: number;
    normX: number;
    normY: number;
    isPointerInside: boolean;

    // Состояние прорыва ткани реальности (Breach)
    isBreaching: boolean;        // Зажата ли кнопка мыши / активен ли прорыв
    currentBreachRadius: number; // Текущий радиус окна в мир Истины (в пикселях)
    baseBreachRadius: number;    // Базовый радиус ореола вокруг курсора
    maxBreachRadius: number;     // Максимальный радиус при полном раскрытии

    // Активные ударные волны в пространстве
    shockwaves: SpaceShockwave[];
}

// ----------------------------------------------------------------------------
// 2. КЛАСС КОНТРОЛЛЕРА ТЕНЗОРА НАПРЯЖЕНИЯ И ЛИНЗЫ РАЗРЫВА
// ----------------------------------------------------------------------------
class StressStateController {
    private state: StressStateData = {
        globalStress: 0.08,
        targetStress: 0.08,
        pointerX: -1000,
        pointerY: -1000,
        normX: 0.5,
        normY: 0.5,
        isPointerInside: false,
        isBreaching: false,
        currentBreachRadius: 0,
        baseBreachRadius: 95,
        maxBreachRadius: 320,
        shockwaves: [],
    };

    private nextWaveId = 1;
    private radialVelocity = 0; // Скорость изменения радиуса для эффекта упругой пружины

    // Получение прямого доступа к данным (для чтения в рендер-цикле без аллокаций памяти)
    public getState(): Readonly<StressStateData> {
        return this.state;
    }

    // Обновление позиции курсора наблюдателя
    public updatePointer(x: number, y: number, viewportWidth: number, viewportHeight: number): void {
        this.state.pointerX = x;
        this.state.pointerY = y;
        this.state.normX = viewportWidth > 0 ? x / viewportWidth : 0.5;
        this.state.normY = viewportHeight > 0 ? y / viewportHeight : 0.5;
        this.state.isPointerInside = true;
    }

    // Курсор покинул пределы окна
    public clearPointer(): void {
        this.state.isPointerInside = false;
        this.state.isBreaching = false;
    }

    // Активация или деактивация глубокого прорыва Иллюзии (при зажатии кнопки мыши)
    public setBreaching(active: boolean, triggerShockwave = true): void {
        const wasBreaching = this.state.isBreaching;
        this.state.isBreaching = active;

        if (active && !wasBreaching && triggerShockwave && this.state.isPointerInside) {
            this.spawnShockwave(this.state.pointerX, this.state.pointerY, 420, 0.85);
        }
    }

    // Установка целевого базового уровня стресса (зависит от текущей фазы 01..05)
    public setTargetStress(stress: number): void {
        this.state.targetStress = Math.max(0, Math.min(1, stress));
    }

    // Мгновенный выброс энтропии (например, из терминала Архитектора)
    public injectEntropySpike(amount = 0.35, centerX?: number, centerY?: number): void {
        this.state.globalStress = Math.min(1.0, this.state.globalStress + amount);
        if (centerX !== undefined && centerY !== undefined) {
            this.spawnShockwave(centerX, centerY, 650, 1.0);
        }
    }

    // Создание гравитационно-оптической ударной волны
    public spawnShockwave(x: number, y: number, maxRadius = 380, strength = 0.7): void {
        this.state.shockwaves.push({
            id: this.nextWaveId++,
            x,
            y,
            currentRadius: 10,
            maxRadius,
            strength,
            life: 1.0,
        });

        // Ограничиваем число одновременных волн для сохранения 120 FPS
        if (this.state.shockwaves.length > 12) {
            this.state.shockwaves.shift();
        }
    }

    // --------------------------------------------------------------------------
    // 3. ФИЗИЧЕСКИЙ ШАГ ИНЕРЦИИ РАЗРЫВА (ВЫЗЫВАЕТСЯ КАЖДЫЙ КАДР)
    // --------------------------------------------------------------------------
    public stepPhysics(dtSeconds: number): void {
        const dt = Math.min(dtSeconds, 0.05); // Защита от рывков при сворачивании вкладки

        // 1. Плавная релаксация глобального стресса к базовому уровню текущей фазы
        const stressDiff = this.state.targetStress - this.state.globalStress;
        this.state.globalStress += stressDiff * dt * 1.8;

        // 2. Расчет целевого радиуса Линзы Истины (Breach Lens)
        let targetRadius = 0;
        if (this.state.isPointerInside) {
            // Чем выше глобальный стресс Вселенной, тем шире сама по себе рвется ткань
            const stressBonus = this.state.globalStress * 90;
            targetRadius = this.state.isBreaching
                ? this.state.maxBreachRadius + stressBonus
                : this.state.baseBreachRadius + stressBonus * 0.4;
        }

        // Пружинная физика (Закон Гука с затуханием) для органического дыхания разрыва
        const stiffness = 140; // Жесткость пружины
        const damping = 14;    // Коэффициент затухания
        const displacement = targetRadius - this.state.currentBreachRadius;
        const springForce = displacement * stiffness;

        this.radialVelocity += springForce * dt;
        this.radialVelocity *= Math.exp(-damping * dt);
        this.state.currentBreachRadius = Math.max(
            0,
            this.state.currentBreachRadius + this.radialVelocity * dt
        );

        // 3. Обновление активных ударных волн
        for (let i = this.state.shockwaves.length - 1; i >= 0; i--) {
            const wave = this.state.shockwaves[i];
            wave.currentRadius += (wave.maxRadius - wave.currentRadius) * dt * 4.5;
            wave.life -= dt * 1.25;
            if (wave.life <= 0.01) {
                this.state.shockwaves.splice(i, 1);
            }
        }
    }

    // --------------------------------------------------------------------------
    // 4. ВЫЧИСЛЕНИЕ ПРОЗРАЧНОСТИ МИРА ИСТИНЫ В КОНКРЕТНОЙ ТОЧКЕ ЭКРАНА (X, Y)
    // Возвращает число от 0.0 (чистая Иллюзия) до 1.0 (полностью обнаженная Истина)
    // --------------------------------------------------------------------------
    public getTruthRevealFactorAt(x: number, y: number, fullXRayMode = false): number {
        if (fullXRayMode) return 1.0;

        let reveal = 0.0;

        // Вклад от курсора-линзы (Breach Lens)
        if (this.state.currentBreachRadius > 1.0) {
            const dx = x - this.state.pointerX;
            const dy = y - this.state.pointerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.state.currentBreachRadius) {
                // Плавный переход на краях разрыва (функция smoothstep)
                const normalizedDist = dist / this.state.currentBreachRadius;
                const edgeFalloff = 1.0 - normalizedDist * normalizedDist * (3.0 - 2.0 * normalizedDist);
                reveal = Math.max(reveal, edgeFalloff);
            }
        }

        // Вклад от бегущих ударных волн (на гребне волны тоже проступает сетка Истины)
        for (let i = 0; i < this.state.shockwaves.length; i++) {
            const wave = this.state.shockwaves[i];
            const dx = x - wave.x;
            const dy = y - wave.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const ringDistance = Math.abs(dist - wave.currentRadius);
            const ringThickness = 48;

            if (ringDistance < ringThickness) {
                const ringFactor = (1.0 - ringDistance / ringThickness) * wave.life * wave.strength;
                reveal = Math.max(reveal, ringFactor);
            }
        }

        // В фазе Коллапса и Сингулярности Истина начинает проступать по всему пространству
        if (this.state.globalStress > 0.65) {
            const ambientTruth = (this.state.globalStress - 0.65) * 1.4;
            reveal = Math.max(reveal, Math.min(0.65, ambientTruth));
        }

        return Math.max(0.0, Math.min(1.0, reveal));
    }
}

export const stressStore = new StressStateController();