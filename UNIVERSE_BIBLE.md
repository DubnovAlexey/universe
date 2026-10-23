# UNIVERSE / НЕЙРОВЕРС — ГЕНЕРАЛЬНАЯ ИНЖЕНЕРНАЯ КОНСТИТУЦИЯ И ТЕХНИЧЕСКАЯ ПАМЯТЬ ПРОЕКТА (v2.5)

## 0. МЕТАДАННЫЕ И СТАТУС ДОКУМЕНТА

* **Дата ревизии:** 23 октября 2026 года
* **Версия архитектуры:** `v2.5.0`
* **Автор и архитектор:** Алексей Дубнов (`Alexey Dubnov` / `DubnovAlexey`)
* **Репозиторий исходного кода:** `https://github.com/DubnovAlexey/universe`
* **Публичная презентация (GitHub Pages):** `https://dubnovalexey.github.io/universe/`
* **Профиль автора на GitHub:** `https://github.com/DubnovAlexey`
* **Назначение документа:** Внутренняя техническая энциклопедия проекта, позволяющая автору в любой момент быстро восстановить в памяти устройство каждого файла, математический аппарат, байтовую раскладку буфера памяти, логику конечного автомата 108-секундного цикла, причины архитектурных решений и процедуры тестирования.
* **Статусы компонентов в этом документе:**
    * `[РЕАЛИЗОВАНО В RUNTIME]` — код активно исполняется в браузере посетителя на GitHub Pages;
    * `[ПРОВЕРЕНО АВТОТЕСТОМ]` — инвариант автоматически проверяется при каждом запуске `npm test` и в GitHub Actions;
    * `[РЕЗЕРВ / FALLBACK]` — детерминированный резервный путь, активный по умолчанию при отсутствии внешнего бинарника или сервера;
    * `[ПРОВЕРКА ПОДДЕРЖКИ / PROBE]` — проверка возможностей браузера без переключения основного рендерера;
    * `[ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER]` — серверный или компилируемый модуль, проверяемый в CI и локальном терминале.

---

## 1. МИССИЯ ПРОЕКТА, ФИЛОСОФСКАЯ ОСЬ И ДВЕ АУДИТОРИИ

**UNIVERSE (Нейроверс)** — интерактивная аудиовизуальная инсталляция «Из Нуля в Ноль» длительностью **108 секунд**, работающая как живая входная витрина портфолио и репозитория автора на GitHub Pages.

### 1.1. Задача для посетителя, HR и арт-директора
1. **Мгновенный запуск без ожидания:** открытие ссылки `https://dubnovalexey.github.io/universe/` сразу запускает фазу `01. VOID` (рождение светового эха из Точки Нуля).
2. **Непрерывная музыка с первого касания:** при первом клике или касании экрана (на компьютерах и телефонах iOS/Android) вступает космический трек `/audio/cosmic_ambient.mp3` с отметки `2.6 с` (пропуская начальную тишину файла) и играет непрерывно без сбоев при смене фаз, паузе и перезапуске цикла.
3. **Кульминация и выход визитки (79–108 с):** в 5-й фазе корона туманности «Кошачий глаз» (`NGC 6543`) и Чёрная дыра по спирали сжимаются строго в центральную Точку Нуля (`radius -> 0 px`), дают короткий `0.45 с` импульс и без паузы раскрываются в голографическую визитку **`DUBNOV ALEXEY`** с парящей в воздухе без рамок квантовой строкой (`18–26 Гц`).
4. **Прямой переход в GitHub и постоянный режим `.ambient-loop`:** на визитке (и в правом нижнем углу экрана) расположены прямые кнопки перехода в профиль `https://github.com/DubnovAlexey` и репозиторий `https://github.com/DubnovAlexey/universe`. После завершения первого 108-секундного круга космос уходит на новый виток (`01_VOID`), а визитка не исчезает — она остаётся полупрозрачно парить в центре экрана (`opacity: 0.46`) и плавно проявляется до `0.98` при наведении мыши.
5. **Чистое превью ссылки в мессенджерах:** в `frontend/src/pages/index.astro` установлен лаконичный `<title>Alexey Dubnov</title>` без мета-описаний, чтобы при пересылке ссылки в WhatsApp/Telegram отображались только имя автора и URL.

### 1.2. Задача для Senior-инженера, преподавателя и CTO
Доказать на работающем коде принцип **Оптического Единства (Optical Equivalence)**:
* Художественный космос (`ILLUSION`), нейронный граф (`NEXUS`) и инженерный рентген (`X-RAY / TRUTH`) — это не три отдельные анимации, а три синхронных представления одного типизированного буфера состояния `SceneBufferSoA`.
* На каждом шаге физики координаты, скорости и энергии частиц сворачиваются в 32-битный хеш `FNV-1a State Digest`, выводимый в реальном времени в панелях `LAYER_02` и `LAYER_04`:
  `StateDigest(ILLUSION) == StateDigest(NEXUS) == StateDigest(X-RAY)`.

---

## 2. ХРОНОМЕТРАЖ 108 СЕКУНД И ПОВЕДЕНИЕ В РЕЖИМАХ DESKTOP / MOBILE

Общая длительность полного цикла составляет ровно **108.0 секунд** (`17 + 22 + 25 + 15 + 29 = 108 с`).

| Фаза | Кодовое имя | Интервал (с) | Длительность | Число частиц | Главный визуальный и математический процесс |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`01_VOID`** | `MASTER_01 // RS_PUPPIS_ECHO` | `0.0 – 17.0` | `17.0 с` | `680` | Дышащая Точка Нуля, 7 деформируемых колец светового эха цефеиды `RS Кормы` (по 120 угловых сегментов с FBM-модуляцией) и 8 криволинейных сигналов `RK2 Curl-Noise`. |
| **`02_GENESIS`** | `MASTER_02 // ANDROMEDA_SPIRAL` | `17.0 – 39.0` | `22.0 с` | `760` | Наклонный 3D-диск (`-0.17 рад`) с 4 логарифмическими рукавами, 2 барицентрами со световым мостом, 48 пылевыми облаками `M31` и синхронизацией Курамото `r(t)`. |
| **`03_EVOLUTION`** | `MASTER_03 // COGNITIVE_NEXUS` | `39.0 – 64.0` | `25.0 с` | `820` | C²-морфинг рукавов в два полушария Мозга вокруг 5 встречных кеплеровских колец. Синтез 3 классов рёбер (`MST`, `Gabriel`, `Murray`) и до 92 синаптических комет. |
| **`04_COLLAPSE`** | `MASTER_04 // BREACH_LENS_STORM` | `64.0 – 79.0` | `15.0 с` | `820` | 3 гравитационные аномалии на кольцах, авто-раскрытие (на `66.0–71.5 с`) или ручное управление мембраной `BREACH LENS`, микротрещины, сетка рентгена и слой `Z4`. |
| **`05_SINGULARITY`** | `MASTER_05 // CATS_EYE_TO_ODOMETER` | `79.0 – 108.0` | `29.0 с` | `820` | **Акт A (`79–87.5 с`):** корона `NGC 6543` и Чёрная дыра -> **Акт B (`87.5–92.6 с`):** сжатие в Точку Нуля -> **Акт C (`92.6–93.05 с`):** импульс Нуля -> **Акт D (`93.05–108 с`):** визитка `DUBNOV ALEXEY`. |

### Различие компоновки Desktop (16:9) и Mobile (9:16)
* **На широких экранах (`window.innerWidth > 920px`):** правая колонка телеметрии (`LAYER_02`, `LAYER_03`, `LAYER_04`) открыта по умолчанию и занимает `422px` у правого края, не перекрывая центральную сцену.
* **На мобильных телефонах (`window.innerWidth <= 920px`):**
    1. При старте страницы флаги `layer2_metricsHud`, `layer3_topologyGraph`, `layer4_architectTerminal` устанавливаются в `false` (`universeState.ts`), чтобы экран телефона был полностью свободен для космоса и финальной визитки.
    2. При нажатии на любую из кнопок `METRICS`, `TOPOLOGY` или `TERMINAL` метод `toggleLayer()` работает в **режиме аккордеона**: открывается только одна выбранная панель посередине экрана, а две другие автоматически закрываются, что полностью исключает наслоение панелей друг на друга.
    3. Высота вьюпорта задана через `100dvh` и `env(safe-area-inset-bottom)`, поэтому нижний док управления всегда виден над нижней панелью Safari/Chrome.

---

## 3. ПОЛНАЯ КАРТА ДЕРЕВА ФАЙЛОВ И СИМВОЛОВ РЕПОЗИТОРИЯ

    universe/
    ├── .github/workflows/deploy.yml           # CI/CD: Python --verify -> Rust check -> TS typecheck -> 11/11 Tests -> Astro Build -> Pages Deploy
    ├── backend/                               # [ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER] Научное и верификационное ядро Python 3
    │   ├── api/transport.py                   # build_health_and_parity_report(), generate_live_binary_step()
    │   ├── core/
    │   │   ├── prng.py                        # DeterministicPRNG, GOLDEN_SEED=104729, compute_state_digest_fnv1a()
    │   │   ├── graph_logic.py                 # compute_nexus_topology(), build_bezier_arc_length_lut(), _compute_authentic_invariants()
    │   │   ├── stress_solver.py               # evaluate_breach_lens_refraction() — C¹-колокол g(u)=(1-u²)²
    │   │   └── singularity.py                 # evaluate_black_hole_optics(), sample_endless_cipher_stream()
    │   ├── utils/binary_packer.py             # pack_scene_binary_frame(), unpack_and_validate_header() ('<IHHIIII', 24 байта)
    │   └── main.py                            # UniverseTelemetryHTTPHandler, run_cli_verification() (--verify)
    ├── physics_engine/                        # [ОФЛАЙН-ИНСТРУМЕНТ / WASM CRATE] Симплектическое ядро на Rust
    │   ├── Cargo.toml                         # crate-type = ["cdylib"]
    │   └── src/
    │       ├── lib.rs                         # C-ABI экспорты: init_bodies, step_verlet_nbody, get_positions_ptr, get_velocities_ptr
    │       ├── memory.rs                      # SceneBufferHeader (#[repr(C)], 24 байта), SceneStateSoA (MAX_CAPACITY=1024)
    │       ├── gravity.rs                     # step_symplectic_verlet_and_kuramoto(), compute_barycenter_acceleration()
    │       ├── breach_math.rs                 # compute_refraction_offset()
    │       └── prng.rs                        # DeterministicPrng, verify_golden_vectors(), compute_quantized_state_digest()
    ├── frontend/                              # [РЕАЛИЗОВАНО В RUNTIME] Клиентское приложение Astro + TypeScript
    │   ├── astro.config.mjs                   # site: 'https://dubnovalexey.github.io', base: '/universe' (prod) / '/' (dev)
    │   ├── package.json                       # Скрипты: dev, typecheck, test (Vite SSR runner), build, preview
    │   ├── public/
    │   │   ├── audio/cosmic_ambient.mp3       # Мастер-трек космического эмбиента (старт с 2.6 с)
    │   │   ├── audio/AUDIO_LICENSE.md         # Документация использования аудиопотока
    │   │   ├── wasm/physics_engine.wasm       # Слот бинарного модуля WASM (при 0 байт активируется TS_FALLBACK)
    │   │   └── favicon.svg                    # Векторная иконка вкладки
    │   └── src/
    │       ├── pages/index.astro              # Точка входа HTML, холст #universe-canvas, баннер звука, док управления
    │       ├── styles/universe.css            # Цветовая конституция, вёрстка HUD, бесшовная визитка и адаптив 9:16
    │       ├── core/
    │       │   ├── contracts.ts               # Канонические типы PhaseId, SingularityAct, WorldEntity, TelemetrySnapshot
    │       │   ├── prng.ts                    # DeterministicPRNG, GOLDEN_U32_VECTORS, computeQuantizedStateDigest()
    │       │   ├── sceneBuffer.ts             # SceneBufferSoA (24-байтный заголовок 'UNVS' + типизированные массивы SoA)
    │       │   ├── integrationRegistry.ts     # IntegrationRegistryManager (p50/p95 перцентили шага, честные статусы)
    │       │   ├── qualityGovernor.ts         # QualityGovernor (EMA времени кадра, профили HIGH/MEDIUM/LOW, гистерезис 3.5 с)
    │       │   └── resourceLedger.ts          # ResourceLedgerManager (счётчики ресурсов, cycleDisposables / pageDisposables)
    │       ├── store/
    │       │   ├── universeState.ts           # UniverseStore, smootherstep(), 5 фаз, 4 подакта сингулярности, watchdog
    │       │   └── stressState.ts             # StressStateController (пружина линзы ζ=0.92, C¹-рефракция, микротрещины)
    │       ├── phases/
    │       │   ├── 01_void.ts                 # VoidPhaseSimulation (C²-морфинг по снимку morphOrigin, граф NEXUS, импульсы)
    │       │   ├── 02_genesis.ts              # computeGenesisTarget() (4 логарифмических рукава, мост, Курамото)
    │       │   ├── 03_evolution.ts            # computeEvolutionBrainTarget() (5 кеплеровских колец + 2 полушария)
    │       │   ├── 04_collapse.ts             # computeCollapseStormTarget() (3 гравитационные аномалии env1..env3)
    │       │   └── 05_singularity.ts          # computeSingularityTarget() (аккреция -> сжатие в Ноль -> ореол визитки)
    │       ├── bridge/
    │       │   ├── wasmBridge.ts              # WasmPhysicsBridge (валидация \0asm + симплектический Verlet/Kuramoto в TS)
    │       │   ├── simulationWorker.ts        # NexusGraphEngine (Прим MST, Габриэль, Мюррей, кластеризация, BFS)
    │       │   ├── pythonSocketClient.ts      # PythonSocketClient (рукопожатие hello, валидация бинарных кадров 'UNVS')
    │       │   └── cipherOdometerEngine.ts    # CipherOdometerEngine (CANONICAL_FINALE_LINES, 3D-барабаны одометра)
    │       ├── engine/
    │       │   ├── pipeline.ts                # RenderPipeline (High-DPI Canvas2D, probeWebGpuSupport, Blue-Noise 64x64)
    │       │   ├── renderer.ts                # UniverseRenderer (отрисовка всех 5 фаз, Z4, цикл RAF, bootstrapUniverseV2)
    │       │   └── webgpu/*.wgsl              # Шейдерные спецификации WGSL (illusion.wgsl, truth.wgsl, breach.wgsl)
    │       ├── layers/
    │       │   ├── Layer2_Metrics.tsx         # Нативная фабрика React.createElement, TelemetryWaterfallAnimator, LAYER_02
    │       │   ├── Layer3_Topology.tsx        # mountLayer3Topology() — инспектор графа NEXUS (LAYER_03)
    │       │   ├── Layer4_Terminal.tsx        # mountLayer4Terminal() — матрица модулей и логи (LAYER_04)
    │       │   └── Layer5_CipherFinale.tsx    # FinaleCardDomAnimator, mountLayer5CipherFinale() — визитка DUBNOV ALEXEY
    │       ├── utils/audioSync.ts             # AudioSyncEngine (Web Audio API, iOS audioSession, единый снимок спектра)
    │       └── tests/parityAndSeams.test.ts   # runUniverseVerificationSuite() — 11 автоматических проверок
    ├── docs/
    │   ├── ARCHITECTURE.md                    # Краткий архитектурный обзор
    │   ├── DEMO_SCRIPT.md                     # Сценарий демонстрации для HR и инженеров
    │   └── study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md
    ├── package.json                           # Корневой манифест монорепозитория (workspaces: ["frontend"])
    ├── README.md                              # Двуязычная публичная витрина проекта (EN + RU)
    └── UNIVERSE_BIBLE.md                      # Настоящая внутренняя техническая конституция проекта

---

## 4. АРХИТЕКТУРА И ГРАНИЦЫ РЕАЛЬНОГО ИСПОЛНЕНИЯ (RUNTIME MAP)

Ниже приведена честная карта всех подсистем с указанием того, где именно они исполняются:

| Подсистема | Файл и класс | Статус на GitHub Pages | Что именно делает в реальности |
| :--- | :--- | :---: | :--- |
| **Оболочка Astro** | `frontend/src/pages/index.astro` | `[РЕАЛИЗОВАНО В RUNTIME]` | Отдаёт статический HTML/CSS каркас с `base: '/universe'` в production и `'/'` в dev. |
| **Хранилище и часы** | `frontend/src/store/universeState.ts` (`UniverseStore`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Управляет монотонным временем `0..108 с`, 5 фазами, 4 подактами финала и `SceneBufferSoA`. |
| **Рендерер Canvas 2D** | `frontend/src/engine/renderer.ts` (`UniverseRenderer`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Активный графический движок (`Canvas2D-HighDPI`), рисующий все 5 фаз, дизеринг `Blue-Noise`, линзу `BREACH` и эшелон `Z4`. |
| **Проверка WebGPU** | `frontend/src/engine/pipeline.ts` (`probeWebGpuSupport`) | `[ПРОВЕРКА ПОДДЕРЖКИ / PROBE]` | Вызывает `navigator.gpu.requestAdapter()` и выставляет честный статус `fallback` / `unsupported`. Файлы `*.wgsl` служат каноническими спецификациями шейдеров. |
| **Симплектическая физика** | `frontend/src/bridge/wasmBridge.ts` (`WasmPhysicsBridge`) | `[РЕЗЕРВ / FALLBACK]` | При обычном запуске исполняет детерминированный интегратор `Velocity Verlet` (64 контрольные орбиты) и фазовую модель Курамото в TypeScript (`TS_FALLBACK`). Загрузка `/wasm/physics_engine.wasm` активируется по флагу `?wasm=1` с проверкой сигнатуры `\0asm`. |
| **Графовый движок NEXUS** | `frontend/src/bridge/simulationWorker.ts` (`NexusGraphEngine`) | `[РЕЗЕРВ / FALLBACK]` | Вызывается синхронно из `01_void.ts` каждые `0.12 с` симуляционного времени. Статус в реестре — `FALLBACK`, метка в UI — `[ts/graph_engine]`. |
| **Нативные DOM/SVG слои** | `frontend/src/layers/Layer2..Layer5.tsx` | `[РЕАЛИЗОВАНО В RUNTIME]` | Собственная легковесная фабрика `React.createElement` (без пакета React). Монтирует DOM один раз и обновляет числа через `data-bind`, а контуры и одометр — на `60 FPS`. |
| **Звуковой движок** | `frontend/src/utils/audioSync.ts` (`AudioSyncEngine`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Воспроизводит `cosmic_ambient.mp3` (с `2.6 с`), опрашивает `AnalyserNode` один раз за кадр на десктопе и напрямую воспроизводит `<audio>` с `audioSession.type = 'playback'` на iOS/Android. |
| **Ядро Python 3** | `backend/main.py`, `backend/core/*.py` | `[ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER]` | Запускается в GitHub Actions и локально (`python -B -m backend.main --verify`) для проверки паритета PRNG, пакета `'UNVS'`, графа `NEXUS` и рефракции линзы. На статическом GitHub Pages Python-сервер не запущен (`CLIENT_ONLY`). |
| **Крейт Rust** | `physics_engine/src/*.rs` | `[ОФЛАЙН-ИНСТРУМЕНТ / WASM CRATE]` | Проверяется компилятором `cargo check` в GitHub Actions; содержит эталонную реализацию `SceneStateSoA`, `Velocity Verlet` и `Kuramoto` на Rust. |

### Пошаговая последовательность одного кадра в браузере (`UniverseRenderer.loop`)
1. Браузер вызывает `UniverseRenderer.loop(nowMs)` через `requestAnimationFrame`.
2. Вычисляется `rawFrameMs` и безопасный шаг `dtSec = clamp((nowMs - lastFrameTimeMs) / 1000, 0.001, 0.05)`.
3. Если симуляция не на паузе (`!state.isPaused && !state.isTabHidden`), продвигаются локальные часы `this.phaseElapsedSec += dtSec * state.timeScale` и `this.totalSimTimeSec += dtSec * state.timeScale`.
4. Вызывается `stressStore.stepPhysics(dtSec)` (движение пружины линзы `BREACH LENS`, микротрещин и ударных волн).
5. Вызывается `this.simulation.update(dtSec, ...)` (`01_void.ts`):
    * при смене фазы фиксируется снимок `morphOriginX / morphOriginY` всех частиц;
    * вычисляются целевые координаты текущей фазы (`01_void` .. `05_singularity`) и выполняется C²-морфинг через `smootherstep`;
    * координаты и скорости записываются в `SceneBufferSoA` с проверкой `Number.isFinite`;
    * вызывается `wasmPhysicsBridge.stepSymplecticPhysics()` (расчёт Курамото `r(t)` и дрейфа энергии `ΔE/E₀`);
    * вычисляется 32-битный хеш `SceneBufferSoA.commitTickAndComputeDigest()`;
    * каждые `0.12 с` перестраивается граф `NEXUS` и продвигаются кометы синаптических импульсов по таблицам длины дуги `lengthLUT`.
6. Вызывается `audioSync.updateRealtimeModulation(this.totalSimTimeSec)` — ровно один раз за кадр формируется кешированный снимок спектра `cachedSnapshot`.
7. Вызывается `this.renderFrame()` — отрисовка всех слоёв на холсте `Canvas2D-HighDPI`.
8. В самом конце кадра вызывается `universeStore.updateTelemetry({ frameTimeMs, simulationTimeSec, phaseElapsedSec, ... })` — единственная точка продвижения фазового автомата и уведомления DOM-подписчиков (не чаще 1 раза в `90 мс`, либо немедленно при смене фазы/подакта).

---

## 5. ИСТОЧНИКИ ИСТИНЫ И БИНАРНЫЙ КОНТРАКТ ДАННЫХ (`SceneBufferSoA`)

### 5.1. Раскладка 24-байтного заголовка `SceneBufferHeader` (`Little-Endian`)
Заголовок хранится в `ArrayBuffer(24)` и управляется через `DataView` с явным флагом `littleEndian = true` (`frontend/src/core/sceneBuffer.ts`). В Python (`backend/utils/binary_packer.py`) ему соответствует формат `struct.pack('<IHHIIII', ...)`, а в Rust (`physics_engine/src/memory.rs`) — структура `#[repr(C)] pub struct SceneBufferHeader`:

| Смещение (байты) | Имя поля | Тип (TS / Rust / Python) | Размер | Значение по умолчанию и назначение |
| :---: | :--- | :--- | :---: | :--- |
| `0 .. 3` | `magic` | `Uint32` / `u32` / `I` | `4 байта` | Константа `0x53564E55` (ASCII `'UNVS'` в порядке байт Little-Endian). |
| `4 .. 5` | `schemaVersion` | `Uint16` / `u16` / `H` | `2 байта` | Версия схемы бинарного протокола (`2`). |
| `6 .. 7` | `flags` | `Uint16` / `u16` / `H` | `2 байта` | Флаги состояния буфера (`0` при сбросе, `1` при активном тике). |
| `8 .. 11` | `tick` | `Uint32` / `u32` / `I` | `4 байта` | Монотонно возрастающий номер физического шага (`0, 1, 2, ...`). |
| `12 .. 15` | `count` | `Uint32` / `u32` / `I` | `4 байта` | Число активных сущностей в кадре (`0 <= count <= 1024`). |
| `16 .. 19` | `seed` | `Uint32` / `u32` / `I` | `4 байта` | Зерно детерминированного генератора (`GOLDEN_SEED = 104729`). |
| `20 .. 23` | `digest` | `Uint32` / `u32` / `I` | `4 байта` | 32-битная контрольная сумма состояния `FNV-1a State Digest`. |

### 5.2. Выровненные типизированные массивы сущностей (`capacity = 1024`)
* `id: Uint32Array(1024)` — уникальный идентификатор частицы `0 .. N-1`.
* `kind: Uint8Array(1024)` — код семантического типа (`EntityKindCode`: `0 = STAR`, `1 = NODE`, `2 = SOMA`, `3 = FILAMENT_POINT`, `4 = DUST`, `5 = CENTER`, `6 = GLYPH`).
* `pos: Float32Array(3072)` — текущие координаты `[x, y, z]` каждой сущности (`i3 = index * 3`).
* `prevPos: Float32Array(3072)` — координаты предыдущего шага (снимок перед обновлением).
* `interpPos: Float32Array(3072)` — буфер линейной интерполяции между `prevPos` и `pos`.
* `vel: Float32Array(3072)` — вектор скорости `[vx, vy, vz]`.
* `depthZ: Float32Array(1024)` — координата глубины (`0.10 .. 1.60`), определяющая принадлежность к эшелонам `Z0..Z3`.
* `energy: Float32Array(1024)` — нормированная светимость / заряд узла (`0.0 .. 10.0`).
* `flags: Uint32Array(1024)` — упакованный номер кластера `(clusterId << 4)` и бит синаптической вспышки.

### 5.3. Защита `NaN / Infinity Guard`
В методе `SceneBufferSoA.syncEntityFromParticle()` каждая координата, компонента скорости и энергия проходят проверку `Number.isFinite(val)`. Если на вход поступает `NaN`, `+Infinity` или `-Infinity`, значение автоматически заменяется на `0`, а счётчик `this.nanGuardTriggeredCount` увеличивается на `1` (`[ПРОВЕРЕНО АВТОТЕСТОМ #4]`).

---

## 6. КОНЕЧНЫЙ АВТОМАТ 5-Й ФАЗЫ (`05_SINGULARITY`) И РЕШЕНИЕ ПРОБЛЕМЫ ЗАВИСАНИЯ

### 6.1. Историческая справка: почему в ранней версии возникало зависание 5-го этапа
В ранней версии проекта при переходе в 5-ю фазу (`79 с`) происходили три ошибки:
1. Метод `updateTelemetry()` вызывался дважды за кадр: сначала из `01_void.ts` (где передавался старый `phaseElapsedSec` из стора), а затем из `renderer.ts`, что сбивало расчёт `dtSec`.
2. В Акте B (`ACT_B_LOGIC`) оптический вес `logicConvergence` поднимался до `1.0` и **не сбрасывался в `0`**, из-за чего функция `renderBreachLensAndSubQuantumZ4` продолжала рисовать поверх экрана статичный синий рентгеновский круг.
3. Оболочки короны `NGC 6543` не уменьшали свой радиус до нуля к концу Акта B.

### 6.2. Как устроен бесшовный автомат 5-й фазы в версии v2.5 (`universeState.ts` + `05_singularity.ts` + `renderer.ts`)
Вся 5-я фаза длится `29.0 секунд` (`79.0 – 108.0 с` глобального времени, `el = phaseElapsedSec` от `0.0` до `29.0 с`):

    [el: 0.0 .. 8.5 с]  ---> ACT_A_ACCRETION
       • unfoldFromZero = 0.02 + 0.98 * smootherstep(0.0, 0.44, actProgress)
       • Из Точки Нуля вырастают 7 оболочек короны NGC 6543, аккреционный диск и 2 джета.
       • logicConvergence = 0.

    [el: 8.5 .. 13.6 с] ---> ACT_B_LOGIC (Длительность 5.1 с)
       • actBProg = smootherstep(8.5, 13.6, el)
       • radiusEnvelope = (1.0 - smootherstep(0.05, 0.98, actBProg))^1.85 ---> строго в 0 px!
       • Все 7 оболочек короны, диск и частицы по спирали сжимаются в центральную Точку Нуля.
       • logicConvergence = sin(actBProg * PI) * 0.65 ---> к el = 13.6 с возвращается строго в 0!

    [el: 13.6 .. 14.05 с] -> ACT_C_ZERO_SILENCE (Длительность 0.45 с)
       • Короткий световой импульс максимального сжатия в центральной микро-точке (r = 2.4..5.6 px).
       • logicConvergence = 0. Музыка продолжает играть непрерывно.

    [el: 14.05 .. 29.0 с] -> ACT_D_GITHUB_CARD (Длительность 14.95 с)
       • Взводится флаг finaleReachedOnce = true.
       • githubCardAssemblyProgress = clamp((el - 14.05) / 4.5, 0, 1).
       • Из центральной Точки Нуля разворачивается DOM-визитка DUBNOV ALEXEY (Layer5_CipherFinale.tsx),
         а частицы фона мягко расходятся в широкий космический ореол (ringFrac = 0.27..0.48).

    [el >= 29.0 с (108 с)] -> ПЕРЕХОД НА НОВЫЙ КРУГ (RESTART_COLLAPSE -> 01_VOID)
       • Если включён AUTO: ON и курсор мыши не наведён на визитку (!isFinaleCardHovered),
         космос за 1.45 с перезапускается в фазу 01_VOID (cycleCount += 1).
       • Так как finaleReachedOnce === true, визитка НЕ закрывается, а переходит в
         полупрозрачный фоновый режим (.ambient-loop, opacity: 0.46) и ярко проявляется
         до 0.98 при наведении мыши на любом этапе следующих циклов!

---

## 7. МАТЕМАТИЧЕСКИЕ МОДЕЛИ И АЛГОРИТМЫ (ПО ФАКТИЧЕСКОМУ КОДУ)

### 7.1. Детерминированный ГПСЧ `Mulberry32 / SplitMix32` и `FNV-1a State Digest`
* **Файлы:** `frontend/src/core/prng.ts`, `physics_engine/src/prng.rs`, `backend/core/prng.py`.
* **Алгоритм `nextU32()` (Mulberry32):**
    1. `state = (state + 0x6D2B79F5) >>> 0`
    2. `z = Math.imul(state ^ (state >>> 15), state | 1) >>> 0`
    3. `z = (z ^ (z + Math.imul(z ^ (z >>> 7), z | 61))) >>> 0`
    4. `return (z ^ (z >>> 14)) >>> 0`
* **Эталонный вектор при `GOLDEN_SEED = 104729` (`[ПРОВЕРЕНО АВТОТЕСТОМ #1]`):**
  `GOLDEN_U32_VECTORS = [325253669, 3481002091, 881690241, 2630884050]`.
* **Квантование и свертка `computeQuantizedStateDigest`:**
  Для каждой 4-й частицы (`stride = 4`) координаты и скорости умножаются на `10.0`, энергия — на `100.0`, округляются по единому правилу `quantizeHalfUp(v) = Math.floor(v + 0.5) | 0` и сворачиваются в 32-битный хеш `FNV-1a` (`offset_basis = 0x811C9DC5`, `prime = 0x01000193`).

### 7.2. Симплектический интегратор `Velocity Verlet` и модель Курамото
* **Файлы:** `physics_engine/src/gravity.rs`, `frontend/src/bridge/wasmBridge.ts`.
* **Модель Курамото:** для всех активных частиц вычисляется средний фазовый угол $\psi = \text{atan2}(\sum \sin\theta_i, \sum \cos\theta_i)$ и параметр порядка $r(t) = \frac{1}{N}\sqrt{(\sum \cos\theta_i)^2 + (\sum \sin\theta_i)^2} \in [0, 1]$. Фаза каждого осциллятора интегрируется по закону $\theta_i(t + \Delta t) = (\theta_i(t) + (\omega_i + K\sin(\psi - \theta_i))\Delta t) \bmod 2\pi$.
* **Схема Velocity Verlet:** интегрирует ансамбль орбит в гравитационном потенциале с регуляризацией Пламмера ($\varepsilon^2 = 64.0$, $GM = 4900.0$):
    1. Ускорение в начале шага: $\vec{a}_0 = -GM \vec{r}_0 / (r_0^2 + \varepsilon^2)^{3/2}$.
    2. Полный шаг позиции: $\vec{r}_1 = \vec{r}_0 + \vec{v}_0 \Delta t + \frac{1}{2}\vec{a}_0 \Delta t^2$.
    3. Ускорение в новой точке: $\vec{a}_1 = -GM \vec{r}_1 / (r_1^2 + \varepsilon^2)^{3/2}$.
    4. Полушаг скорости: $\vec{v}_1 = \vec{v}_0 + \frac{1}{2}(\vec{a}_0 + \vec{a}_1)\Delta t$.
    5. Относительный дрейф полной механической энергии: $\Delta E / E_0 = |(E(t) - E_0) / E_0|$.

### 7.3. Эвристическая модель графа `NEXUS` (`simulationWorker.ts`, `backend/core/graph_logic.py`)
* **Класс A (`AXON_TRUNK`):** остовное дерево Прима по первым `min(36, N)` опорным узлам с порогом дистанции `1.65 * maxConnectDist` и толщиной `1.95 px`.
* **Класс B (`BRIDGE`):** межкластерные рёбра (`a.clusterId !== b.clusterId`), проверенные по окну соседей `k ∈ [i - 10, i + 10]` на условие пустой сферы Габриэля `cdSq >= 0.85 * radiusSq`.
* **Класс C (`DENDRITE`):** локальные связи с радиусом по формуле ветвления Мюррея `murrayRadiusPx = round(1.65 * branchOrder^(-1/3), 2)`.
* **Топологические метрики:** локальный коэффициент кластеризации вычисляется подсчётом замкнутых треугольников среди соседей каждой вершины со степенью $k \ge 2$, а диаметр `diameterHops` и средняя длина пути `avgPathLength` оцениваются обходом в ширину (`BFS`) с шагом выборки стартовых вершин `sampleStride = max(1, floor(N / 28))`.

### 7.4. Оптическое преломление `BREACH LENS` (`stressState.ts`, `breach_math.rs`, `stress_solver.py`)
* На кольце вокруг границы линзы ($d = \text{dist} / R_{\text{local}}$, полуширина $w = 0.24$, нормированное расстояние от кромки $u = |d - 1.0| / w$) действует компактно-поддерживаемый колокол 4-й степени:
  $$g(u) = (1 - u^2)^2 \quad \text{при } u < 1, \qquad g(u) = 0 \quad \text{при } u \ge 1$$
* На границе кольца ($u = 1$) функция $g(1) = 0$ и её первая производная $g'(1) = 0$, что обеспечивает гладкое $C^1$-сопряжение без оптического шва.

---

## 8. РЕНДЕРИНГ, ЗВУК И УПРАВЛЕНИЕ РЕСУРСАМИ (`ResourceLedger`)

### 8.1. Графический конвейер и дизеринг `Blue-Noise`
* `RenderPipeline` (`frontend/src/engine/pipeline.ts`) создаёт 2D-контекст с ограничением `dpr = min(maxDpr, window.devicePixelRatio)` из `QualityGovernor` (`2.0` для HIGH, `1.5` для MEDIUM, `1.25` для LOW) и генерирует тайл дизеринга `64×64` (`buildBlueNoiseDitherPattern`), устраняющий ступенчатость тёмных градиентов.

### 8.2. Аудио-конвейер и совместимость с iOS / Android (`frontend/src/utils/audioSync.ts`)
* Файл: `frontend/public/audio/cosmic_ambient.mp3` (`~16.46 МБ`).
* При старте вызывается `configureIosAudioSession()`, устанавливающий `navigator.audioSession.type = 'playback'`, чтобы на iPhone звук работал даже при включённом рычажке Silent Mode.
* До первого жеста пользователя `trySilentAutoplayWithoutWarning()` пытается запустить `<audio>` без создания `AudioContext`, поэтому в консоли браузера никогда не возникает жёлтого предупреждения `AudioContext was not allowed to start`.
* Если браузер ждёт первого клика (`AWAITING_GESTURE`), внизу сцены отображается пульсирующая капсула `#ui-audio-unlock-banner` (`[ 🔊 TAP / CLICK TO ENGAGE AUDIO ]`). При первом же клике или касании в любой точке экрана музыка вступает с отметки `2.6 с`, а капсула скрывается.

### 8.3. Книга учёта ресурсов `ResourceLedger` (`frontend/src/core/resourceLedger.ts`)
* Разделяет подписки на два контура:
    1. `cycleDisposables` — временные ресурсы одного 108-секундного цикла, очищаемые при вызове `disposeCycleResources()`;
    2. `pageDisposables` — постоянные подписки уровня страницы (4 монтировщика DOM-слоёв, слушатели окна и клавиатуры в `renderer.ts`), которые живут на протяжении всех циклов и очищаются только при выгрузке страницы (`beforeunload`).

---

## 9. МАТРИЦА РЕЕСТРА ИНТЕГРАЦИЙ (`IntegrationRegistry`)

Все 8 записей в `frontend/src/core/integrationRegistry.ts` инициализируются с нулевыми замерами (`loadMs = 0, lastStepMs = 0, stepP50Ms = 0, stepP95Ms = 0`):

| ID модуля | Язык | Файл-владелец | Стартовый статус | Когда обновляется |
| :--- | :--- | :--- | :---: | :--- |
| `ts-core` | `TypeScript` | `frontend/src/store/universeState.ts` | `READY` | На каждом шаге физики в режиме `TS_FALLBACK` (`wasmBridge.ts`). |
| `canvas2d-render` | `Canvas2D` | `frontend/src/engine/renderer.ts` | `READY` | На каждом кадре в `UniverseRenderer.renderFrame()`. |
| `webgpu-render` | `WGSL/WebGPU` | `frontend/src/engine/webgpu/illusion.wgsl` | `FALLBACK` | При проверке `probeWebGpuSupport()` (`FALLBACK` или `UNSUPPORTED`). |
| `wasm-physics` | `Rust/WASM` | `physics_engine/src/gravity.rs` | `FALLBACK` | Переходит в `READY` только при загрузке валидного `.wasm` с `?wasm=1`. |
| `worker-physics` | `TypeScript` | `frontend/src/bridge/simulationWorker.ts` | `FALLBACK` | Записывает время построения графа `NEXUS` (`buildDeterministicGraph`). |
| `pyodide-graph` | `Python` | `backend/core/graph_logic.py` | `FALLBACK` | Остаётся в `FALLBACK` при работе локального TS-движка графа. |
| `server-ws` | `Python` | `backend/api/transport.py` | `INACTIVE` | Переходит в `READY` только после JSON-рукопожатия `hello` по WebSocket. |
| `web-audio` | `WebAudio` | `frontend/src/utils/audioSync.ts` | `LOADING` | Переходит в `READY` при старте `cosmic_ambient.mp3` (`updateRealtimeModulation`). |

---

## 10. ПРОИЗВОДИТЕЛЬНОСТЬ, АДАПТИВНОЕ КАЧЕСТВО И СОВМЕСТИМОСТЬ

* **Регулятор `QualityGovernor` (`frontend/src/core/qualityGovernor.ts`):**
    * Рассчитывает экспоненциальное скользящее среднее времени кадра `emaFrameMs = emaFrameMs * 0.92 + frameTimeMs * 0.08` и 95-й перцентиль `P95` по окну из 45 кадров.
    * Если `emaFrameMs > 24.5 мс` (`< 41 FPS`), профиль плавно понижается с `HIGH` (`100%` частиц, `DPR <= 2.0`) до `MEDIUM` (`72%` частиц, `DPR <= 1.5`) и `LOW` (`48%` частиц, `DPR <= 1.25`) с защитным гистерезисом `3.5 секунды` против дребезга.
    * При включённой системной настройке `prefers-reduced-motion: reduce` лимит частиц снижается до `420`, шаг морфинга замедляется, а бегущая строка одометра фиксируется в статическом состоянии.

---

## 11. СИСТЕМА ПРОВЕРОК И АВТОТЕСТОВ (11 ИНВАРИАНТОВ + PYTHON VERIFIER)

| Команда | Что реально проверяет | Результат |
| :--- | :--- | :---: |
| `python -B -m backend.main --verify` | Проверяет 5 математических инвариантов Python-ядра: 1) совпадение `GOLDEN_U32_VECTORS`; 2) упаковку/распаковку 24-байтного заголовка `'UNVS'`; 3) непустую топологию `NEXUS` (`trunks > 0`); 4) ненулевую рефракцию на кольце `BREACH LENS` (`px=232, d≈0.94`); 5) оптику Чёрной дыры Эйнштейна. | `status: "ok"` (Exit Code `0`) |
| `cargo check` (в `physics_engine/`) | Проверяет синтаксическую и типовую корректность Rust-крейта (`lib.rs`, `memory.rs`, `gravity.rs`, `breach_math.rs`, `prng.rs`). | `Finished` (Exit Code `0`) |
| `npm --prefix frontend run typecheck` | Запускает строгий компилятор `tsc --noEmit` по всем `.ts` и `.tsx` модулям фронтенда. | `0 errors` (Exit Code `0`) |
| `npm --prefix frontend test` | Запускает через Vite SSR функцию `runUniverseVerificationSuite()` из `frontend/src/tests/parityAndSeams.test.ts` (11 проверок: PRNG, заголовок `'UNVS'`, State Digest, NaN-guard, отбраковка обрезанных/устаревших/NaN бинарных пакетов, вёрстка одометра `320..1920 px`, переход `ACT_B -> ACT_C -> ACT_D` со сбросом `logicConvergence=0`, и 10 полных циклов `Restart Universe` с проверкой `ResourceLedger` и сохранения полупрозрачной визитки). | `Summary: 11/11 PASSED` (Exit Code `0`) |

---

## 12. СБОРКА, ЛОКАЛЬНАЯ РАЗРАБОТКА И ДЕПЛОЙ НА GITHUB PAGES

### Команды для работы из корня репозитория (`C:\Projects\Full_Stack\universe`):
1. Установка зависимостей: `npm --prefix frontend install`
2. Локальный сервер разработки (`http://localhost:4321/`): `npm run dev`
3. Полная локальная проверка перед коммитом: `npm run verify:all`
4. Продакшен-сборка в папку `frontend/dist` (`base: '/universe'`): `npm run build`

### Схема работы `.github/workflows/deploy.yml`:
* Срабатывает автоматически при каждом `push` в ветку `main` или вручную через кнопку `Run workflow`.
* Использует фиксированный образ `ubuntu-24.04` и переменную `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` (без предупреждений об устаревшем Node 20).
* Если все 4 этапа верификации (`python --verify`, `cargo check`, `npm run typecheck`, `npm test`) завершились с кодом `0`, собирает `frontend/dist` и публикует артефакт на `https://dubnovalexey.github.io/universe/`.

---

## 13. БЕЗОПАСНОСТЬ, ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ И ВНЕШНИЕ РЕСУРСЫ

* В репозитории нет секретных ключей или паролей; файл `.env` добавлен в `.gitignore`, а `.env.example` содержит только закомментированный шаблон опционального адреса `PUBLIC_WS_URL`.
* Код проекта распространяется под лицензией **MIT** (`LICENSE`).
* Аудиодорожка `frontend/public/audio/cosmic_ambient.mp3` используется в некоммерческих демонстрационных целях портфолио автора (`frontend/public/audio/AUDIO_LICENSE.md`). При коммерческом переиспользовании трека необходимо отдельно проверить права на саму аудиозапись.

---

## 14. ЖУРНАЛ АРХИТЕКТУРНЫХ РЕШЕНИЙ (ADR)

* **ADR-01 (Статическая оболочка Astro + нативная фабрика JSX вместо SPA с тяжёлым рантаймом):** выбран для мгновенного старта первого кадра на GitHub Pages и обновления SVG-контуров и одометра на `60 FPS` без накладных расходов виртуального DOM.
* **ADR-02 (Основной рендерер `Canvas2D-HighDPI` + спецификации `WGSL`):** обеспечивает 100%-ную совместимость и предсказуемую отрисовку сложных составных градиентов, кривых Безье и текста одометра на всех десктопных и мобильных браузерах.
* **ADR-03 (Детерминированный `TS_FALLBACK` для физики и графа на статическом хостинге):** позволяет проекту работать на GitHub Pages полностью автономно без внешнего бэкенд-сервера и без падения при пустом `.wasm` артефакте.
* **ADR-04 (Постоянная полупрозрачная визитка `.ambient-loop` после первого цикла):** гарантирует, что рекрутер или посетитель в любой момент после первого прохода видит контакты автора и кнопки перехода в GitHub поверх живого циклического космоса.
* **ADR-05 (Режим аккордеона и свёрнутые по умолчанию панели телеметрии на мобильных экранах `<= 920px`):** решает проблему вертикального формата `9:16` на телефонах, освобождая центральную сцену от наслоения таблиц.

---

## 15. ТЕКУЩИЕ ОГРАНИЧЕНИЯ И ДОРОЖНАЯ КАРТА РАЗВИТИЯ

1. **Текущие известные границы версии v2.5:**
    * Файл `frontend/public/wasm/physics_engine.wasm` в репозитории является 0-байтным слотом; расчёт физики на GitHub Pages штатно выполняется детерминированным ядром TypeScript (`TS_FALLBACK`).
    * Построение графа `NEXUS` (`simulationWorker.ts`) выполняется в основном потоке каждые `0.12 с`.
    * Размер аудиофайла `cosmic_ambient.mp3` составляет `~16.46 МБ` (потоковая подгрузка браузером через `<audio preload="auto">`).
2. **План будущих улучшений (при необходимости):**
    * Компиляция `physics_engine` через `cargo build --target wasm32-unknown-unknown --release` и помещение готового бинарника в `frontend/public/wasm/physics_engine.wasm`.
    * Вынос `NexusGraphEngine` в отдельный фоновый `new Worker()` с обменом через `Transferable ArrayBuffer`.
    * Сжатие `cosmic_ambient.mp3` до `128–160 kbps` (`~4–5 МБ`) для ускорения загрузки на медленных мобильных сетях.

---

## 16. ЖУРНАЛ ОБНОВЛЕНИЙ ДОКУМЕНТАЦИИ

* **23.10.2026 (`v2.5.0`):**
    * Полностью восстановлена и расширена структура `UNIVERSE_BIBLE.md` по всем 16 разделам без склеенных строк.
    * Исправлен часовой шаг в регрессионном тесте #11 (`parityAndSeams.test.ts` -> `11/11 PASSED`), выполнен успешный деплой на GitHub Pages.
    * Добавлена адаптивная мобильная компоновка `9:16` (свёрнутые по умолчанию панели телеметрии, режим аккордеона, `100dvh`, `safe-area-inset-bottom`).
    * Добавлена поддержка `navigator.audioSession.type = 'playback'` и прямой запуск `<audio>` для iOS Safari / Android.
    * Очищен `<title>` в `index.astro` (`Alexey Dubnov`) для лаконичного превью ссылки в мессенджерах.