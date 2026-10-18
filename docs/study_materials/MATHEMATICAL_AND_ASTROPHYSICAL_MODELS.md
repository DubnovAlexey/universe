# Учебно-справочное руководство: Математические и астрофизические модели UNIVERSE v2.2
# Study & Engineering Reference: Mathematical and Astrophysical Models of UNIVERSE v2.2

Настоящий документ содержит полное математическое описание алгоритмов, физических интеграторов, топологических графов и астрофизических моделей, реализованных в полиглот-ядре **UNIVERSE (`TypeScript` + `Rust/WASM` + `Python` + `WebGPU/WGSL`)**.

---

## 1. Детерминированный ГПСЧ `SplitMix32` и побитовый паритет (`FNV-1a`)

Для того чтобы симуляция развивалась абсолютно одинаково в браузере (`TypeScript`), в бинарном модуле (`Rust/WASM`) и на вычислительном сервере (`Python`), все три среды используют единый 32-битный генератор псевдослучайных чисел **SplitMix32** с каноническим зерном `GOLDEN_SEED = 104729`:

$$z_0 = (\text{state} + \text{0x6D2B79F5}) \bmod 2^{32}$$

$$z_1 = \text{imul32}\big(z_0 \oplus (z_0 \gg 15),\; z_0 \mid 1\big)$$

$$z_2 = z_1 \oplus \Big(z_1 + \text{imul32}\big(z_1 \oplus (z_1 \gg 7),\; z_1 \mid 61\big)\Big) \bmod 2^{32}$$

$$u_{32} = z_2 \oplus (z_2 \gg 14)$$

* **Эталонные векторы (`GOLDEN_U32_VECTORS` при `seed = 104729`):**
  `[2440595534, 3339150257, 2107725929, 4067807368]`
* **Контроль целостности (`FNV-1a 32-bit State Digest`):** на каждом физическом тике координаты $(x, y)$ и скорости $(v_x, v_y)$ квантуются с шагом $0.1\text{ px}$ и сворачиваются хешем Фаулера — Нолла — Во (`offset_basis = 0x811C9DC5`, `prime = 0x01000193`).
* **Литература:**
    * Steele G. L., Lea D., Flood C. H. *Fast Splittable Pseudorandom Number Generators* (OOPSLA 2014).

---

## 2. Астрофизические эталоны телескопа «Хаббл» и «Телескопа горизонта событий» (EHT)

Визуальная драматургия 5 фаз опирается на реальные наблюдательные данные глубокого космоса:

1. **Фаза 01 (`01_VOID`) — Световое эхо переменной звезды `RS Кормы (RS Puppis)`:**
    * Цефеида `RS Puppis` пульсирует с периодом $41.4$ суток. Излучаемый звездой свет распространяется сквозь окружающую отражательную пылевую туманность, создавая бегущие концентрические кольца **светового эха (Light Echo)**:
      $$I_{\text{echo}}(r, t) = I_0 \cdot \left[\frac{1 + \sin(k r - \omega t)}{2}\right] \cdot \exp\left(-\frac{r}{\lambda_{\text{dust}}}\right)$$
2. **Фаза 02 (`02_GENESIS`) — Пылевые рукава `Андромеды (M31)`, `M64 («Чёрный Глаз»)` и `NGC 3169`:**
    * Вместо искусственных геометрических линий используются анизотропные газопылевые облака с двухпроходным искривлением области (`Domain Warping`) и вычитанием гребневого шума поглощения пыли (`Ridged Dust Absorption`):
      $$\rho_{\text{eff}}(\mathbf{p}) = \text{smoothstep}\big(0.22, 0.86, \text{FBM}(\mathbf{p} + \mathbf{r})\big) - 0.52 \cdot \big(1 - \vert{}2\,\text{noise}(\mathbf{p}) - 1\vert{}\big)^3$$
3. **Фаза 05 (`05_SINGULARITY`) — Туманность `«Кошачий глаз» (NGC 6543)` и Сверхмассивная Чёрная Дыра:**
    * Центральная звезда Вольфа — Райе ($T \approx 80\,000\text{ K}$, светимость $\sim 10^4 L_\odot$) формирует многослойную корону сферических и лепестковых выбросов газа (`Cat's Eye Shells`).
    * В центре системы располагается **Чёрная дыра Шварцшильда — Керра** с радиусом горизонта событий $R_s = \frac{2GM}{c^2}$, углом гравитационного отклонения лучей Эйнштейна:
      $$\alpha(b) \approx \frac{4GM}{c^2 b} = \frac{2 R_s}{b}$$
      узким фотонным кольцом на критическом прицельном параметре $b_c = \frac{3\sqrt{3}}{2} R_s \approx 2.6 R_s$ и релятивистским доплеровским усилением яркости приближающегося крыла плазмы:
      $$I_{\text{obs}} = I_{\text{emit}} \cdot D^3, \quad D = \frac{1}{\gamma (1 - \beta_\parallel)}, \quad \gamma = \frac{1}{\sqrt{1 - \beta^2}}$$

---

## 3. Симплектический интегратор `Leapfrog` (`Kick-Drift-Kick`) и модель Курамото

В модуле `physics_engine/src/gravity.rs` и `wasmBridge.ts` гравитационная динамика $N$ тел со смягчённым потенциалом Пламмера $\Phi(r) = -\frac{G M}{\sqrt{r^2 + \varepsilon^2}}$ интегрируется симплектической схемой второго порядка **Verlet / Leapfrog**:

$$\mathbf{v}_{n + 1/2} = \mathbf{v}_n + \frac{\Delta t}{2}\,\mathbf{a}(\mathbf{x}_n)$$

$$\mathbf{x}_{n + 1} = \mathbf{x}_n + \Delta t\,\mathbf{v}_{n + 1/2}$$

$$\mathbf{v}_{n + 1} = \mathbf{v}_{n + 1/2} + \frac{\Delta t}{2}\,\mathbf{a}(\mathbf{x}_{n + 1})$$

Симплектическая природа интегратора сохраняет фазовый объём по теореме Лиувилля и удерживает относительный дрейф полной механической энергии $\vert{}\Delta E / E_0\vert{} < 0.05$.

Для синхронизации частоты мерцания узлов применяется ансамбль связанных фазовых осцилляторов **Курамото**:

$$\frac{d\theta_i}{dt} = \omega_i + \frac{K}{N} \sum_{j=1}^{N} \sin(\theta_j - \theta_i), \quad R = \left\vert{}\frac{1}{N} \sum_{j=1}^{N} e^{i\theta_j}\right\vert{} \in [0, 1]$$

---

## 4. Когнитивная топология `NEXUS`: `MST` + Граф Габриэля + Закон Мюррея + `Arc-Length LUT`

Чтобы избежать визуального хаоса полного графа $O(N^2)$, в `simulationWorker.ts` и `backend/core/graph_logic.py` строится трёхуровневая биологически достоверная сеть:

1. **Класс A (`AXON_TRUNK`):** минимальное остовное дерево (алгоритм Прима) по главным центрам кластеров.
2. **Класс B (`BRIDGE`):** межкластерные мосты по геометрическому **критерию Габриэля** — ребро $(A, B)$ создаётся только тогда, когда открытый круг с диаметром $AB$ не содержит ни одного третьего узла $C$:
   $$\forall C \neq A, B: \quad \Vert{}\mathbf{x}_C - \tfrac{1}{2}(\mathbf{x}_A + \mathbf{x}_B)\Vert{}^2 > \frac{1}{4}\Vert{}\mathbf{x}_A - \mathbf{x}_B\Vert{}^2$$
3. **Класс C (`DENDRITE`) и биофизический закон Мюррея:** при ветвлении сосудов и аксонов сумма кубов радиусов дочерних ветвей равна кубу радиуса родительского ствола:
   $$r_{\text{parent}}^3 = \sum_{k=1}^{m} r_{\text{child}, k}^3 \implies r_{\text{child}} = r_{\text{parent}} \cdot m^{-1/3}$$
4. **Параметризация по натуральной длине дуги (`Arc-Length LUT`):** чтобы синаптические импульсы двигались вдоль квадратичных кривых Безье $\mathbf{B}(t) = (1-t)^2 \mathbf{P}_0 + 2(1-t)t \mathbf{P}_1 + t^2 \mathbf{P}_2$ без рывков скорости на крутых изгибах, для каждого ребра предвычисляется 5-точечная таблица накопленной длины дуги $s(t) = \int_0^t \Vert{}\mathbf{B}'(\tau)\Vert{}\,d\tau$.

---

## 5. Оптика `BREACH LENS`: $C^1$-гладкое поле преломления

При сближении курсора с полотном мембрана `ILLUSION` испытывает упругое преломление, раскрывая инженерный слой `X-RAY / TRUTH`. Смещение луча задаётся гладким колоколом четвёртой степени $g(u) = (1 - u^2)^2$:

$$\boldsymbol{\delta}(\mathbf{p}) = \hat{\mathbf{r}}\,A\,g(u) + \hat{\mathbf{t}}\,B\,g(u), \quad u = \frac{\vert{}d - 1\vert{}}{w}, \quad d = \frac{\Vert{}\mathbf{p} - \mathbf{p}_{\text{lens}}\Vert{}}{R(\theta)}$$

При $u \ge 1$ функция $g(1) = 0$ и её первая производная $g'(1) = 0$, что математически исключает видимый шов или ступеньку на внешней границе линзы.

---

## 6. Ссылки на первоисточники и спецификации

1. [W3C WebGPU & WGSL Official Specification](https://www.w3.org/TR/WGSL/)
2. [Inigo Quilez — Domain Warping & Procedural FBM](https://iquilezles.org/articles/warp/)
3. [NASA / ESA Hubble Space Telescope — RS Puppis Light Echoes](https://esahubble.org/images/heic1323a/)
4. [NASA / ESA Hubble — NGC 6543 (Cat's Eye Nebula)](https://esahubble.org/images/heic0414a/)
5. [Event Horizon Telescope Collaboration — First M87* & Sgr A* Results](https://eventhorizontelescope.org/)
6. [Strogatz S. H. — From Kuramoto to Crawford: Exploring the Onset of Synchronization (Physica D, 2000)](https://doi.org/10.1016/S0167-2789(00)00094-4)