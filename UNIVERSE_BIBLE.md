<!-- НАЗНАЧЕНИЕ: Справочник исходников, памяти, состояний и вычислительных контрактов. -->
<!-- РАЗДЕЛЫ: Обзор; Фазы; Карта модулей; Runtime; Память; Финал; Модели; Представление; Диагностика; Проверки; Сборка; Лицензии. -->
# UNIVERSE — технический справочник

## 1. Назначение

UNIVERSE — интерактивная аудиовизуальная инсталляция с 108-секундным циклом и общей геометрией для космической оптики, NEXUS и X-RAY. Этот справочник описывает модули, форматы памяти, конечный автомат и численные контракты.

[Обзор и запуск](README.md) · [Архитектурный конвейер](docs/ARCHITECTURE.md) · [Математические модели](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)

## 2. ХРОНОМЕТРАЖ 108 СЕКУНД И ПОВЕДЕНИЕ В РЕЖИМАХ DESKTOP / MOBILE

Пять фаз сценария рассчитаны на **108.0 секунд активного времени сцены** (`17 + 22 + 25 + 15 + 29 = 108 с`). Пауза и скрытая вкладка останавливают часы; ограничение шага при зависании кадра и межцикловое схлопывание могут увеличить реальную длительность просмотра. Сцена объединяет астрофизические мотивы разных реальных объектов (`RS Puppis`, `M31 / NGC 3169`, `NGC 6543`) в единую научно-художественную композицию (*science-inspired art*).

Колонка «Цель в метаданных» содержит `targetParticleCount` фазы. Для непрерывного морфинга симуляция с первой фазы сохраняет единый ансамбль до **820 частиц на HIGH**; количество выбирается при создании/перезапуске с учётом профиля качества, при reduced motion ограничено 420. Переход между фазами не пересоздаёт ансамбль. Изменения DPR применяются в текущем цикле без сброса частиц.

| Фаза | Кодовое имя | Интервал (с) | Длительность | Цель в метаданных | Главный визуальный и математический процесс |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`01_VOID`** | `MASTER_01 // RS_PUPPIS_ECHO` | `0.0 – 17.0` | `17.0 с` | `680` | Дышащая Точка Нуля, 7 деформируемых колец светового эха по мотивам цефеиды `RS Кормы` (по 120 угловых сегментов с FBM-модуляцией) и 8 криволинейных сигналов `RK2 Curl-Noise`. |
| **`02_GENESIS`** | `MASTER_02 // ANDROMEDA_SPIRAL` | `17.0 – 39.0` | `22.0 с` | `760` | Наклонный 3D-диск (`-0.17 рад`) с 4 логарифмическими рукавами, 2 барицентрами со световым мостом, 48 пылевыми облаками `M31` и синхронизацией Курамото `r(t)`. |
| **`03_EVOLUTION`** | `MASTER_03 // COGNITIVE_NEXUS` | `39.0 – 64.0` | `25.0 с` | `820` | C²-морфинг рукавов в два полушария Мозга вокруг 5 встречных кеплеровских колец. Синтез 3 классов рёбер (`MST`, `Gabriel`, `Murray`) и до 92 синаптических комет. |
| **`04_COLLAPSE`** | `MASTER_04 // BREACH_LENS_STORM` | `64.0 – 79.0` | `15.0 с` | `820` | 3 гравитационные аномалии на кольцах, авто-раскрытие (на `66.0–71.5 с`) или ручное управление мембраной `BREACH LENS`, микротрещины, сетка рентгена и слой `Z4`. |
| **`05_SINGULARITY`** | `MASTER_05 // CATS_EYE_TO_ODOMETER` | `79.0 – 108.0` | `29.0 с` | `820` | **Акт A (`79–87.5 с`):** корона по мотивам `NGC 6543` и Чёрная дыра -> **Акт B (`87.5–92.6 с`):** сжатие в Точку Нуля -> **Акт C (`92.6–93.05 с`):** импульс Нуля -> **Акт D (`93.05–108 с`):** визитка `DUBNOV ALEXEY`. |

### Различие компоновки Desktop (16:9) и Mobile (9:16)
* **На широких экранах (`window.innerWidth > 920px`):** правая колонка телеметрии (`LAYER_02`, `LAYER_03`, `LAYER_04`) открыта по умолчанию и занимает `422px` у правого края, не перекрывая центральную сцену.
* **На мобильных телефонах и при сужении окна (`window.innerWidth <= 920px`):**
    1. При старте страницы и при пересечении порога `<= 920px` во время `resize` (`syncViewportLayoutMode`) флаги `layer2_metricsHud`, `layer3_topologyGraph`, `layer4_architectTerminal` устанавливаются в `false` (`universeState.ts`), чтобы экран телефона был полностью свободен для космоса и финальной визитки.
    2. При нажатии на любую из кнопок `METRICS`, `TOPOLOGY` или `TERMINAL` метод `toggleLayer()` работает в **режиме аккордеона**: открывается только одна выбранная панель посередине экрана, а две другие автоматически закрываются, что полностью исключает наслоение панелей друг на друга.
    3. Высота вьюпорта задана через `100dvh` и `env(safe-area-inset-bottom)`, поэтому нижний док управления всегда виден над нижней панелью Safari/Chrome.

---

## 3. ПОЛНАЯ КАРТА ДЕРЕВА ФАЙЛОВ И СИМВОЛОВ РЕПОЗИТОРИЯ

    universe/
    ├── .github/workflows/deploy.yml           # Проверки Python/Rust/TypeScript/WASM, сборка и публикация Pages
    ├── backend/                               # [ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER] Научное и верификационное ядро Python 3
    │   ├── api/transport.py                   # build_health_and_parity_report(), generate_live_binary_step()
    │   ├── core/
    │   │   ├── prng.py                        # DeterministicPRNG, GOLDEN_SEED=104729, compute_state_digest_fnv1a()
    │   │   ├── graph_logic.py                 # compute_nexus_topology(), build_bezier_arc_length_lut(), _compute_authentic_invariants()
    │   │   ├── stress_solver.py               # evaluate_breach_lens_refraction() — C¹-колокол g(u)=(1-u²)²
    │   │   └── singularity.py                 # evaluate_black_hole_optics(), sample_endless_cipher_stream()
    │   ├── utils/binary_packer.py             # pack_scene_binary_frame(), unpack_and_validate_header() ('<IHHIIII', 24 байта)
    │   ├── test_backend_parity.py             # Модульные тесты для стандартного раннера `python -B -m unittest discover -v`
    │   └── main.py                            # UniverseTelemetryHTTPHandler, run_cli_verification() (--verify)
    ├── physics_engine/                        # [RUST/WASM PROVIDER + NATIVE TESTS] Kuramoto и контрольные REF64 орбиты
    │   ├── Cargo.toml                         # crate-type = ["cdylib"]
    │   └── src/
    │       ├── lib.rs                         # Raw C ABI v1, импорт состояния, метрики и native-тесты
    │       ├── memory.rs                      # SceneBufferHeader (#[repr(C)], 24 байта), SceneStateSoA (MAX_CAPACITY=1024)
    │       ├── gravity.rs                     # step_symplectic_verlet_and_kuramoto(), compute_reference_total_energy()
    │       ├── breach_math.rs                 # compute_refraction_offset_with_stress(), compute_refraction_offset()
    │       └── prng.rs                        # DeterministicPrng, verify_golden_vectors(), compute_quantized_state_digest()
    ├── frontend/                              # [РЕАЛИЗОВАНО В RUNTIME] Клиентское приложение Astro + TypeScript
    │   ├── astro.config.mjs                   # site: 'https://dubnovalexey.github.io', base: '/universe' (prod) / '/' (dev)
    │   ├── package.json                       # Скрипты: dev, typecheck, test (Vite SSR runner), build, preview
    │   ├── scripts/
    │   │   ├── build-wasm.mjs                 # Сборка реального модуля и проверка ABI
    │   │   ├── verify-wasm-runtime.mjs        # Проверки реального WASM
    │   │   ├── verify-pages-artifact.mjs      # Статическая проверка Pages-артефакта
    │   │   └── verify-repository.mjs          # Отслеживаемые исходники и npm entry scripts
    │   ├── public/
    │   │   ├── audio/cosmic_ambient.mp3       # Мастер-трек космического эмбиента (старт с 2.6 с)
    │   │   ├── audio/AUDIO_LICENSE.md         # Документация использования аудиопотока
    │   │   ├── fonts/LICENSE.txt             # Исходные лицензии OFL локальных шрифтов Noto
    │   │   ├── wasm/physics_engine.wasm       # Raw WASM ABI v1 без imports; default async, ?wasm=0 принуждает TS
    │   │   └── favicon.png                    # Растровая иконка вкладки
    │   └── src/
    │       ├── assets/fonts/                 # Локальные наборы Noto: общие Vite URL для CSS и preload
    │       ├── pages/index.astro              # Точка входа HTML (<title>Alexey Dubnov</title>), холст, баннер звука, док
    │       ├── styles/universe.css            # Цветовая конституция, вёрстка HUD, бесшовная визитка и адаптив 9:16
    │       ├── core/
    │       │   ├── contracts.ts               # Канонические типы PhaseId, SingularityAct, WorldEntity, TelemetrySnapshot
    │       │   ├── visualSignals.ts           # Неизменяемый снимок фазы, аудио и stress на кадр
    │       │   ├── glyphGrammar.ts            # Фазовые пулы code point, проверка глифов и fallback
    │       │   ├── glyphHover.ts              # Барабанные ячейки статических строк и действий финальной визитки
    │       │   ├── glyphFontAssets.json       # Файлы шрифтов, SHA-256, покрытие Unicode и источники лицензий
    │       │   ├── buttonSolid.ts             # Шесть CSS-граней, layout-размеры, доступный канон и обновление подписи
    │       │   ├── buttonMotion.ts            # Полные обороты вокруг собственной оси, выравнивание и плавный разгон
    │       │   ├── finaleComposition.ts       # Общая геометрия фотонного кольца и безопасного подъёма визитки
    │       │   ├── prng.ts                    # DeterministicPRNG, GOLDEN_U32_VECTORS, computeQuantizedStateDigest()
    │       │   ├── sceneBuffer.ts             # SceneBufferSoA (24-байтный заголовок 'UNVS' + 8-польный NaN-guard)
    │       │   ├── integrationRegistry.ts     # IntegrationRegistryManager (8 модулей, p50/p95 перцентили шага)
    │       │   ├── qualityGovernor.ts         # QualityGovernor (EMA времени кадра, профили HIGH/MEDIUM/LOW, гистерезис 3.5 с)
    │       │   └── resourceLedger.ts          # ResourceLedgerManager (5 категорий + underflowCount + disposerErrors)
    │       ├── store/
    │       │   ├── universeState.ts           # UniverseStore, smootherstep(), syncViewportLayoutMode(), 5 фаз, 4 подакта
    │       │   └── stressState.ts             # StressStateController (пружина линзы ζ=0.92, C¹-рефракция, микротрещины)
    │       ├── phases/
    │       │   ├── 01_void.ts                 # VoidPhaseSimulation (C²-морфинг по снимку morphOrigin, граф NEXUS, импульсы)
    │       │   ├── 02_genesis.ts              # computeGenesisTarget() (4 логарифмических рукава, мост, Курамото)
    │       │   ├── 03_evolution.ts            # computeEvolutionBrainTarget() (5 кеплеровских колец + 2 полушария)
    │       │   ├── 04_collapse.ts             # computeCollapseStormTarget() (3 гравитационные аномалии env1..env3)
    │       │   └── 05_singularity.ts          # computeSingularityTarget() (аккреция -> сжатие в Ноль -> ореол визитки)
    │       ├── bridge/
    │       │   ├── wasmBridge.ts              # WasmPhysicsBridge (ABI v1, state adoption/mirrors, REF64 ΔE/E₀, непрерывный TS fallback)
    │       │   ├── simulationWorker.ts        # NexusGraphEngine (Прим MST, Габриэль, Мюррей, кластеризация, BFS-28)
    │       │   ├── pythonSocketClient.ts      # PythonSocketClient (подготовленный клиент и валидатор пакетов 'UNVS')
    │       │   └── cipherOdometerEngine.ts    # CipherOdometerEngine (CANONICAL_FINALE_LINES, 3D-барабаны одометра)
    │       ├── engine/
    │       │   ├── pipeline.ts                # RenderPipeline (High-DPI Canvas2D, probeWebGpuSupport, Blue-Noise 64x64)
    │       │   ├── renderer.ts                # UniverseRenderer (отрисовка всех 5 фаз, Z4, цикл RAF, bootstrapUniverseV2)
    │       │   └── webgpu/*.wgsl              # Шейдерные спецификации WGSL (illusion.wgsl, truth.wgsl, breach.wgsl)
    │       ├── layers/
    │       │   ├── Layer2_Metrics.tsx         # Нативная фабрика React.createElement, динамический тег физики, LAYER_02
    │       │   ├── Layer3_Topology.tsx        # mountLayer3Topology() — инспектор графа NEXUS (LAYER_03, EST. BFS)
    │       │   ├── Layer4_Terminal.tsx        # mountLayer4Terminal() — полная таблица всех 8 модулей и логи (LAYER_04)
    │       │   └── Layer5_CipherFinale.tsx    # FinaleCardDomAnimator, mountLayer5CipherFinale() — визитка DUBNOV ALEXEY
    │       ├── utils/audioSync.ts             # AudioSyncEngine (Web Audio API, iOS audioSession, снятие слушателей с 1-го тапа)
    │       └── tests/
    │           ├── parityAndSeams.test.ts     # runUniverseVerificationSuite() — Регрессионные проверки ядра и DOM lifecycle
    │           ├── buttonMotion.test.ts       # Полные обороты, индивидуальные тени, взаимодействия и очистка
    │           ├── buttonSolid.test.ts        # Шесть граней, доступные подписи, размеры и восстановление DOM
    │           ├── finaleComposition.test.ts # Размещение визитки, зазор над ореолом и плавный подъём
    │           ├── visualSignals.test.ts     # Кадровый шаг, Unicode/кириллица, доступность и прокрутка
    │           ├── waterfallLifecycle.test.ts # Кеш DOM, shared frame, visibility и lifecycle каскадов
    │           └── fixtures/nexusParity24.json # Общие входы и полный результат TS/Python, 40 рёбер
    ├── docs/
    │   ├── ARCHITECTURE.md                    # Краткий архитектурный обзор
    │   ├── DEMO_SCRIPT.md                     # Сценарий знакомства со сценой и инженерными слоями
    │   ├── ADR-001-POLYGLOT-RUNTIME.md         # Решение о ролях вычислительных модулей
    │   ├── VISUAL_AUDIO_DIRECTION.md          # Фазы, художественные мотивы, символы и звук
    │   └── study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md
    ├── package.json                           # Корневой манифест монорепозитория (workspaces: ["frontend"])
    ├── README.md                              # Двуязычная публичная витрина проекта (EN + RU)
    └── UNIVERSE_BIBLE.md                      # Справочник модулей, памяти и вычислительных контрактов

---

## 4. АРХИТЕКТУРА И ГРАНИЦЫ РЕАЛЬНОГО ИСПОЛНЕНИЯ (RUNTIME MAP)

| Подсистема | Файл и класс | Статус на GitHub Pages | Что именно делает в реальности |
| :--- | :--- | :---: | :--- |
| **Оболочка Astro** | `frontend/src/pages/index.astro` | `[РЕАЛИЗОВАНО В RUNTIME]` | Отдаёт статический HTML/CSS каркас с `base: '/universe'` в production и `'/'` в dev. |
| **Хранилище и часы** | `frontend/src/store/universeState.ts` (`UniverseStore`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Управляет монотонным временем `0..108 с`, 5 фазами, 4 подактами финала и `SceneBufferSoA`. |
| **Рендерер Canvas 2D** | `frontend/src/engine/renderer.ts` (`UniverseRenderer`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Активный графический движок (`Canvas2D-HighDPI`), рисующий все 5 фаз, дизеринг `Blue-Noise`, линзу `BREACH` и эшелон `Z4`. |
| **Проверка WebGPU** | `frontend/src/engine/pipeline.ts` (`probeWebGpuSupport`) | `[ПРОВЕРКА ПОДДЕРЖКИ / PROBE]` | Вызывает `navigator.gpu.requestAdapter()` и выставляет статус `fallback` / `unsupported`. Файлы `*.wgsl` — спецификации; активный рендер остаётся Canvas 2D. |
| **Физический provider** | `frontend/src/bridge/wasmBridge.ts` (`WasmPhysicsBridge`) | `[RUST/WASM / TS FALLBACK]` | Default async raw ABI v1; после валидного шага — `WASM_ACTIVE`, при `?wasm=0` или отказе — TS. Kuramoto влияет на видимые цели; отдельные `REF64` орбиты дают энергию. CI собирает и проверяет реальный WASM до Astro. |
| **Графовый движок NEXUS** | `frontend/src/bridge/simulationWorker.ts` (`NexusGraphEngine`) | `[РЕЗЕРВ / FALLBACK]` | Вызывается синхронно из `01_void.ts` каждые `0.12 с` симуляционного времени. Статус в реестре — `FALLBACK`, метка в UI — `[ts/graph_engine]`. |
| **Нативные DOM/SVG слои** | `frontend/src/layers/Layer2..Layer5.tsx` | `[РЕАЛИЗОВАНО В RUNTIME]` | Собственная легковесная фабрика `React.createElement` (без пакета React). Монтирует DOM один раз и обновляет числа через `data-bind`, а контуры и одометр — на `60 FPS`. |
| **Звуковой движок** | `frontend/src/utils/audioSync.ts` (`AudioSyncEngine`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Запрашивает воспроизведение при загрузке; при запрете автозапуска использует пользовательский жест. Спектральные огибающие имеют временно-независимое сглаживание. `audioSession.type = 'playback'` задаётся при наличии API, но поведение зависит от платформы. |
| **Ядро Python 3** | `backend/main.py`, `backend/core/*.py` | `[ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER]` | Реализует локальный HTTP/Binary сервер (`/api/health`, `/api/topology`, `/api/frame.bin`), CLI-верификатор (`--verify`) и проверки `unittest`. На статическом GitHub Pages Python-сервер не запущен (`CLIENT_ONLY`), а `PythonSocketClient` служит подготовленным и протестированным валидатором бинарных пакетов `'UNVS'`. |
| **Крейт Rust** | `physics_engine/src/*.rs` | `[WASM PROVIDER / NATIVE TESTS]` | Raw ABI v1, Kuramoto, контрольный Velocity Verlet и `breach_math`; native-тесты и интеграции реального WASM. |

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
* `vel: Float32Array(3072)` — вектор скорости `[vx, vy, vz]`.
* `depthZ: Float32Array(1024)` — координата глубины (`0.10 .. 1.60`), определяющая принадлежность к эшелонам `Z0..Z3`.
* `energy: Float32Array(1024)` — нормированная светимость / заряд узла (`0.0 .. 10.0`).
* `flags: Uint32Array(1024)` — упакованный номер кластера `(clusterId << 4)` и бит синаптической вспышки.

Финальные координаты публикуются в `pos`. Заголовок соответствует schema version 2; память provider использует raw ABI v1.

### 5.3. Полная 8-польная защита `NaN / Infinity Guard`
В методе `SceneBufferSoA.syncEntityFromParticle()` все **8 числовых параметров** (`x, y, z, vx, vy, vz, depthZ, energy`) проходят индивидуальную проверку `Number.isFinite(val)`. Каждое нечисловое значение заменяется безопасным конечным значением (`0` или `1.0` для `depthZ`) и увеличивает счётчик `this.nanGuardTriggeredCount` ровно на число обнаруженных повреждённых полей.

---

## 6. КОНЕЧНЫЙ АВТОМАТ 5-Й ФАЗЫ (`05_SINGULARITY`)

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
         полупрозрачный фоновый режим (.ambient-loop, opacity: 0.60) и ярко проявляется
         до 0.98 при наведении мыши на любом этапе следующих циклов!

---

## 7. МАТЕМАТИЧЕСКИЕ МОДЕЛИ И АЛГОРИТМЫ (ПО ФАКТИЧЕСКОМУ КОДУ)

### 7.1. Детерминированный ГПСЧ `Mulberry32 / SplitMix32` и `FNV-1a State Digest`
* **Файлы:** `frontend/src/core/prng.ts`, `physics_engine/src/prng.rs`, `backend/core/prng.py`.
* **Потоковый генератор `nextU32()` (Mulberry32):**
    1. `state = (state + 0x6D2B79F5) >>> 0`
    2. `z = Math.imul(state ^ (state >>> 15), state | 1) >>> 0`
    3. `z = (z ^ (z + Math.imul(z ^ (z >>> 7), z | 61))) >>> 0`
    4. `return (z ^ (z >>> 14)) >>> 0`
* **Индексная хеш-функция `hashU32(seed, index)` (SplitMix32):** использует константы `0x9E3779B9`, `0x85EBCA6B`, `0xC2B2AE35`.
* **Эталонный вектор при `GOLDEN_SEED = 104729`:**
  `GOLDEN_U32_VECTORS = [325253669, 3481002091, 881690241, 2630884050]`.
* **Квантование и свертка `computeQuantizedStateDigest`:**
  Для каждой 4-й частицы (`stride = 4`) координаты и скорости умножаются на `10.0`, энергия — на `100.0`, округляются по единому правилу `quantizeHalfUp(v) = Math.floor(v + 0.5) | 0` и сворачиваются в 32-битный хеш `FNV-1a` (`offset_basis = 0x811C9DC5`, `prime = 0x01000193`).

### 7.2. Симплектический интегратор `Velocity Verlet`, истинный дрейф энергии и модель Курамото
* **Файлы:** `physics_engine/src/gravity.rs`, `frontend/src/bridge/wasmBridge.ts`.
* **Модель Курамото:** для всех активных частиц вычисляется средний фазовый угол $\psi = \text{atan2}(\sum \sin\theta_i, \sum \cos\theta_i)$ и параметр порядка $r(t) = \frac{1}{N}\sqrt{(\sum \cos\theta_i)^2 + (\sum \sin\theta_i)^2} \in [0, 1]$.
* **Видимый потребитель фаз:** provider выполняется до расчёта целей; фазы Курамото управляют дыханием частиц и тройной геометрией позднего GENESIS. Итоговые архетипы пяти фаз сохраняются. Это ограниченный физический вклад в художественную сцену, а не полная N-body модель.
* **Схема Velocity Verlet и дрейф $\Delta E / E_0$:** отдельные 64 контрольные орбиты `REF64` интегрируются в статическом потенциале Пламмера ($\varepsilon^2 = 64.0$, $GM = 4900.0$). Положительный `safeDt <= 0.05` разбивается на `ceil(safeDt / 0.004)` равных подшагов; `dt <= 0` и count `0` не продвигают время. Начальная энергия $E_0$ фиксируется при инициализации, а дрейф $|E(t)-E_0|/|E_0|$ относится только к контрольному ансамблю.
* **Общий ABI-контракт:** raw v1 без imports, `f64` для шага/накопленного времени/метрик, `f32[1024]` для фаз/частот, `f32[3072]` для позиций/скоростей (первые 64 орбиты). `step_verlet_nbody` возвращает статус `1`/`0`, не digest. При поздней загрузке WASM получает актуальные TS-массивы, baseline и время; reset/seed/count переинициализируют provider. После валидного native-шага TS-зеркала обновляются целиком; trap/ошибка результата возвращают TS к последнему принятому состоянию. Отказ `commit_uploaded_state` требует discard provider со стороны host.

### 7.3. Эвристическая модель графа `NEXUS` и паритет TS <-> Python (`simulationWorker.ts`, `backend/core/graph_logic.py`)
* Реализации TypeScript и Python используют общее правило `floor(value * scale + 0.5) / scale` для двух/трёх десятичных знаков; отрицательные ties идут к `+∞`. Fixture6 и общий `nexusParity24.json` содержат воспроизводимые эталонные данные: transport RNG потребляет по шесть значений на узел, затем точно сравниваются 40 рёбер, классы, контрольные точки, LUT, радиусы Мюррея, 24 степени и семь метрик. Эталонные входы и результаты находятся в общей JSON-fixture; область проверки задаётся этими входами.
* На полной рабочей сцене ($N > 260$) браузерный TS-движок включает прореживание `stride = 2`; реальный Worker ещё не подключён. Выигрыш производительности требует измерения.
* Диаметр `diameterHops` и средняя длина пути `avgPathLength` вычисляются обходом в ширину (`BFS`) с шагом выборки стартовых вершин `sampleStride = max(1, floor(N / 28))` (здесь $N$ — число активных узлов после прореживания; при $N < 56$ шаг равен 1 и обход полный, при $N \ge 56$ стартовые вершины выбираются с шагом не менее 2). Метка `BFS-28` обозначает делитель шага, а не жёсткий предел в 28 стартов. Выборка на 24 узлах не проверяет sampling, лимит 36 хабов и прореживание.

### 7.4. Оптическое преломление `BREACH LENS` (`stressState.ts`, `breach_math.rs`, `stress_solver.py`)
* На кольце вокруг деформированной границы линзы ($d = \text{dist} / (R \cdot \text{warp})$, полуширина $w = 0.24$, нормированное расстояние от кромки $u = |d - 1.0| / w$) действует компактно-поддерживаемый колокол 4-й степени:
  $$g(u) = (1 - u^2)^2 \quad \text{при } u < 1, \qquad g(u) = 0 \quad \text{при } u \ge 1$$
* На границе кольца ($u = 1$) функция $g(1) = 0$ и её первая производная $g'(1) = 0$ ($C^1$-гладкое сопряжение без оптического шва, $C^\infty$ внутри открытого интервала $u \in (0, 1)$). Все три реализации (TS, Python, Rust) содержат идентичную формулу `warp`. В `getTruthRevealFactorAt` передаётся текущее `simulationTimeSec`, поэтому внутренняя маска следует тому же движущемуся контуру; переход фиксированной точки через кромку покрыт регрессией.

* Существующий `evaluate_lens_refraction(px, py, lensX, lensY, radius, reveal)` возвращает скалярную длину смещения при stress `0.25` и time `0`. Он включён в обязательные build/host exports и типизирован в TS. Сравнение с длиной TS-вектора использует f32-нормализованные входы и численный допуск. Контракт скалярный: векторное преломление и dispersion в Canvas рассчитываются TypeScript.

---

## 8. РЕНДЕРИНГ, ЗВУК И КНИГА УЧЁТА РЕСУРСОВ (`ResourceLedger`)

### 8.1. Графический конвейер и дизеринг `Blue-Noise`
* `RenderPipeline` (`frontend/src/engine/pipeline.ts`) создаёт 2D-контекст с ограничением `dpr = min(maxDpr, window.devicePixelRatio)` из `QualityGovernor` (`2.0` для HIGH, `1.5` для MEDIUM, `1.25` для LOW) и генерирует тайл дизеринга `64×64` (`buildBlueNoiseDitherPattern`).
* `syncQualityProfile()` применяет изменившийся DPR на общем кадре без ожидания resize; неизменный профиль не изменяет размеры холста.

### 8.2. Аудио-конвейер и мгновенное снятие слушателей (`frontend/src/utils/audioSync.ts`)
* Файл: `frontend/public/audio/cosmic_ambient.mp3` (`~16.46 МБ`).
* При старте вызывается `configureIosAudioSession()` (`navigator.audioSession.type = 'playback'`).
* На мобильных user agent (`iPhone`, `iPad`, `iPod`, `Android`, `Mobile`) MP3 воспроизводится через `<audio>` без `MediaElementAudioSourceNode` и `AnalyserNode`; модуляцию ведёт синхронная LFO-огибающая. Этот режим сохраняет звук при ограничениях мобильного аудиотракта. На остальных устройствах при доступности используется анализ звука.
* При старте `trySilentAutoplayWithoutWarning()` сразу запрашивает воспроизведение `<audio>` без создания `AudioContext`. Браузер может отклонить запрос по своей autoplay policy; тогда доступен запуск первым жестом пользователя. Наличие или отсутствие сообщения в консоли зависит от браузера.
* Как только промис `audioEl.play()` разрешается или срабатывает событие `'playing'`, немедленно вызывается `this.removeUnlockListenersFn?.()`, отключающая все глобальные слушатели разблокировки.

### 8.3. Книга учёта ресурсов `ResourceLedger` (`frontend/src/core/resourceLedger.ts`)
* Отслеживает 5 категорий ресурсов (`buffers`, `textures`, `audioNodes`, `listeners`, `workers`) и 2 диагностических счётчика (`underflowCount` при попытке освободить больше ресурсов, чем было выделено, и `disposerErrors` при исключениях внутри колбэков очистки).
* Метод `disposeCycleResources()` проверяет все 5 категорий и отсутствие `underflowCount` / `disposerErrors`.


### 8.4. Общие визуальные сигналы и символы

Renderer публикует неизменяемый `VisualSignalSnapshot`: время, нормализованный `frameDtSec`, фаза, пауза/reduced motion, seed, аудио, Kuramoto и stress. Шаг ограничен `0..0.05 с`, при pause/hidden равен нулю. Водопад, символы и DOM-визитка используют общий кадр.

`glyphGrammar.ts` хранит фазовые семейства полных Unicode code point и фильтрует недоступные начертания. `glyphHover.ts` управляет прокруткой отдельных глифов в устойчивых ячейках статических строк и действий финальной визитки, восстановлением точного текста и доступностью. В угловых меню движутся цельные плашки с неизменными надписями. Числовая телеметрия сохраняет реальные значения.

`glyphFontAssets.json` описывает локальные наборы Noto из `src/assets/fonts/`: файлы, хеши, диапазоны Unicode и происхождение. Vite создаёт общие URL для CSS и предварительной загрузки; лицензии OFL публикуются из `public/fonts/LICENSE.txt`. Шрифты содержат выбранные египетские, рунические, числовые знаки майя, математические и декоративные символы; при недоступном начертании остаётся базовый fallback.

`buttonSolid.ts` монтирует внутри неподвижного элемента замкнутый CSS-кубоид из шести непрозрачных граней. Подпись находится на передней грани, скрытый измеритель в обычном потоке сохраняет размеры host. `ResizeObserver` следит за layout border box; обновление размеров учитывает только изменившиеся значения. Тело помечено `aria-hidden`, а доступный канон хранится отдельно или в native `aria-label`. `setSolidButtonLabel()` обновляет подпись и измеритель, сохраняя геометрию тела. Атрибут `data-button-solid="1"` обозначает смонтированную геометрию; информационные строки имеют вид `status` и сохраняют семантику текста и заголовков.

`buttonMotion.ts` использует общий кадр и четыре CSS-параметра вращения: компоненты фиксированной нормированной оси и накопленный угол. Вложенное тело совершает полные обороты вокруг собственного неподвижного центра; элементы имеют разные направления и скорости. Фаза и её прогресс, Курамото, stress и музыка плавно влияют на угловую скорость. Наведение или видимый клавиатурный фокус переводит выбранное тело к ближайшему углу, кратному полному обороту, с C²-выравниванием передней грани. Остальные тела продолжают вращаться. После отпускания выбранный элемент плавно разгоняется от достигнутой позы.

Каждая кнопка имеет отдельную тень с тёмной серединой и холодным полутоном в `::before` неподвижного host. Шесть дополнительных CSS-параметров задают смещение, размытие, прозрачность и форму тени по текущей ориентации тела; обновление ограничено 12 Гц общего кадра. Размытие применяется только к тени и сохраняет шесть объёмных граней корпуса. При чтении тело и тень увеличиваются вместе; тень становится мягче. Верхняя мобильная плашка компактна и центрирована. На экранах до 600px нижние меню занимают почти полную ширину с полями; интервалы между рядами и нижний отступ оставляют место вращению и теням. Настольная компоновка сохраняется.

`finaleComposition.ts` согласует геометрию фотонного ореола Canvas и положение DOM-визитки в CSS-пикселях, учитывая дыхание карточки, HUD и свободную высоту экрана. `bindHudDockLayout()` в renderer измеряет верхнее меню и нижний док через `ResizeObserver` и публикует `--hud-top-inset` и `--hud-bottom-inset`; карточка резервирует его фактическую высоту при переносе увеличенных кнопок.

В строках визитки канонический текст generic `p/span` доступен в отдельном span, а декоративное представление имеет `aria-hidden`. Кнопки, ссылки и заголовки сохраняют доступное имя. Центральная квантовая строка из 25 ячеек использует отдельный диапазон `18–26 Гц`; цифровой водопад сохраняет собственное символьное представление.

Статичные строки собираются слева направо: закреплённый текст, фронт прокрутки, затем пустые окна. Первоначальные Canvas и DOM используют общий порядок; при наведении каждый знак проходит два оборота и закрепляется в настоящем DOM. Измеритель сохраняет размеры, доступный текст остаётся каноническим; постоянная квантовая строка работает независимо.

В шкале фаз текущая кнопка удерживает читаемую переднюю грань и увеличивается вместе с тенью. Приоритет выделения: наведение → видимый клавиатурный фокус → текущая фаза. После ухода курсора и снятия фокуса выделяется актуальная фаза; остальные тела вращаются независимо.

Визитка появляется из Точки Нуля и после первого показа плавно поднимается над светлой областью фотонного ореола при переходе в другую фазу или новый цикл. Повторный вход в финал сохраняет начавшийся подъём и собранный текст. Позиция ограничена размерами карточки, HUD и viewport; пауза сохраняет положение, reduced motion использует статичное представление. На низком экране ограничение подъёма сохраняет видимость содержимого и действий, даже если полный зазор над ореолом недостижим.

---

## 9. МАТРИЦА РЕЕСТРА ИНТЕГРАЦИЙ (`IntegrationRegistry`)

Все **8 модулей** в `frontend/src/core/integrationRegistry.ts` инициализируются с нулевыми замерами (`0 ms`) и в полном составе отображаются в панели `LAYER_04 // TERMINAL & REGISTRY`:

| ID модуля | Язык | Основной файл | Стартовый статус | Когда обновляется |
| :--- | :--- | :--- | :---: | :--- |
| `ts-core` | `TypeScript` | `frontend/src/store/universeState.ts` | `READY` | На каждом шаге физики в режиме `TS_FALLBACK` (`wasmBridge.ts`). |
| `wasm-physics` | `Rust/WASM` | `physics_engine/src/gravity.rs` | `LOADING` → `READY` / `FALLBACK` | Default async raw ABI v1; первый валидный native-шаг даёт `WASM_ACTIVE` без утверждения SIMD. `?wasm=0` или ошибка выбирают TS fallback. |
| `webgpu-render` | `WGSL/WebGPU` | `frontend/src/engine/webgpu/illusion.wgsl` | `FALLBACK` | Вызывает только `probeWebGpuSupport()`; WGSL-спецификации не запускаются, текущий рендер выполняется через Canvas 2D. |
| `canvas2d-render` | `Canvas2D` | `frontend/src/engine/renderer.ts` | `READY` | На каждом кадре в `UniverseRenderer.renderFrame()`. |
| `pyodide-graph` | `Python` | `backend/core/graph_logic.py` | `FALLBACK` | Остаётся в `FALLBACK` при работе локального TS-движка графа. |
| `server-ws` | `Python` | `backend/api/transport.py` | `INACTIVE` | Офлайн HTTP/Binary инструмент и подготовленный `PythonSocketClient`; текущие HTTP и WebSocket протоколы не образуют рабочее браузерное подключение. |
| `web-audio` | `WebAudio` | `frontend/src/utils/audioSync.ts` | `LOADING` | Переходит в `READY` при старте `cosmic_ambient.mp3` (`updateRealtimeModulation`). |
| `worker-physics` | `TypeScript` | `frontend/src/bridge/simulationWorker.ts` | `FALLBACK` | Записывает время построения графа `NEXUS` (`buildDeterministicGraph`). |

---

## 10. Проверки

Полная команда из корня репозитория — `npm run verify:all`. Она проверяет отслеживаемые исходники и точки запуска, Python reference, native Rust, TypeScript, настоящий WASM-модуль и статический Pages-артефакт.

| Команда | Назначение |
|---|---|
| `npm run verify:repo` | Наличие исходников, fixtures и npm entry scripts в Git |
| `npm run verify:python` | Отчёт Python о численных и бинарных контрактах |
| `npm run test:python` | Python-регрессии |
| `npm run test:rust` | Нативные проверки Rust |
| `npm run typecheck` / `npm test` | Типы и регрессии TypeScript |
| `npm run build:wasm` / `npm run verify:wasm` | Сборка, ABI, перенос состояния и численный стык WASM |
| `npm run build` / `npm run verify:pages-artifact` | Статическая сборка и ресурсы публикации |

Реальные WASM-проверки охватывают шаги разной длительности, рост памяти, active count, seed/reset, позднюю загрузку, trap/ABI/pointer fallback, влияние native-фазы на геометрию и скалярный оптический reference. DOM-проверки охватывают общий кадр, доступный канон, паузу и освобождение подписок.

Визуальное качество проверяется отдельно на разных viewport и способах ввода. Численные fixtures имеют явную область входов; их успешное прохождение не доказывает тождества всех возможных состояний.

## 11. Сборка и публикация

Нужны Node.js `>=22.23.4`, Python `3.11+`, Rust и target `wasm32-unknown-unknown`. Зависимости устанавливаются по lock-файлу через `npm ci`.

```sh
rustup target add wasm32-unknown-unknown
npm run build:wasm
npm run dev
```

Адрес локального сервера выводится Astro. `npm run build` создаёт `frontend/dist` с production base `/universe`; `npm run preview` позволяет проверить собранный сайт. Workflow `.github/workflows/deploy.yml` выполняет проверки, собирает WASM и Astro, проверяет ресурсы и публикует Pages-артефакт.

## 12. Конфигурация и лицензии

Опциональная конфигурация описана в `.env.example`; локальный `.env` исключён из Git. Публичные клиентские параметры не предназначены для хранения секретов.

Код распространяется по [MIT](LICENSE). Условия использования саундтрека описаны отдельно в [AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md); лицензия кода не заменяет права на аудиозапись.
