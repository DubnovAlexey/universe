# UNIVERSE / НЕЙРОВЕРС — ГЕНЕРАЛЬНАЯ ИНЖЕНЕРНАЯ КОНСТИТУЦИЯ И ТЕХНИЧЕСКАЯ ПАМЯТЬ ПРОЕКТА (v2.5)

## 0. МЕТАДАННЫЕ И СТАТУС ДОКУМЕНТА

* **Дата ревизии:** 24 октября 2026 года
* **Версия архитектуры:** `v2.5.0`
* **Автор и архитектор:** Алексей Дубнов (`Alexey Dubnov` / `DubnovAlexey`)
* **Репозиторий исходного кода:** `https://github.com/DubnovAlexey/universe`
* **Публичная презентация (GitHub Pages):** `https://dubnovalexey.github.io/universe/`
* **Профиль автора на GitHub:** `https://github.com/DubnovAlexey`
* **Назначение документа:** Внутренняя техническая энциклопедия проекта, позволяющая автору в любой момент быстро восстановить в памяти устройство каждого файла, математический аппарат, байтовую раскладку буфера памяти, логику конечного автомата 108-секундного цикла, причины архитектурных решений и процедуры тестирования.
* **Граница реализации:** документ описывает текущие исходники и статическую сборку. Rust/WASM ABI v1 реализован и проверен в JS runtime; выборочный просмотр production-сборки подтвердил `WASM_ACTIVE`/`READY`. Исходный baseline `c2e2c0c` предшествует подключению реального WASM. V1 и QA-исправления реализованы в исходниках; финальный локальный pipeline прошёл 48 модульных и 5 WASM-проверок, typecheck, Astro/Pages; актуальный выборочный desktop/mobile smoke отмечен в `docs/QA_STATUS.md`. Исторический production smoke не заменяет проверку этих изменений.
* **Статусы компонентов в этом документе:**
    * `[РЕАЛИЗОВАНО В RUNTIME]` — код активно исполняется в браузере посетителя на GitHub Pages;
    * `[ПРОВЕРЕНО АВТОТЕСТОМ]` — инвариант автоматически проверяется при каждом запуске тестов (`npm test`, `unittest`, `cargo test`) и в GitHub Actions;
    * `[РЕЗЕРВ / FALLBACK]` — детерминированный резервный путь, активный по умолчанию при отсутствии внешнего бинарника или сервера;
    * `[ПРОВЕРКА ПОДДЕРЖКИ / PROBE]` — проверка возможностей браузера без переключения основного рендерера;
    * `[ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER]` — серверный или компилируемый модуль, проверяемый в CI и локальном терминале.

---

## 1. МИССИЯ ПРОЕКТА, ФИЛОСОФСКАЯ ОСЬ И АУДИТОРИИ

**UNIVERSE (Нейроверс)** — интерактивная научно-художественная аудиовизуальная инсталляция «Из Нуля в Ноль» длительностью **108 секунд**, работающая как живая входная витрина портфолио и репозитория автора на GitHub Pages.

### 1.1. Для зрителя
1. **Мгновенный запуск без ожидания:** открытие ссылки `https://dubnovalexey.github.io/universe/` сразу запускает фазу `01. VOID` (рождение светового эха из Точки Нуля).
2. **Непрерывная музыка без отложенной загрузки:** аудиоэлемент и трек подготавливаются при старте, а воспроизведение сразу запрашивается у браузера. Если политика автозапуска блокирует звук, существующая кнопка и первый пользовательский жест запускают его с отметки `2.6 с`. После запуска трек не прерывается сменой фаз и циклов; доступность автозапуска зависит от браузера и устройства.
3. **Кульминация и выход визитки (79–108 с):** в 5-й фазе корона туманности «Кошачий глаз» (`NGC 6543`) и Чёрная дыра по спирали сжимаются строго в центральную Точку Нуля (`radius -> 0 px`), дают короткий `0.45 с` импульс и без паузы раскрываются в голографическую визитку **`DUBNOV ALEXEY`** с парящей в воздухе без рамок квантовой строкой (`18–26 Гц`).
4. **Прямой переход в GitHub и постоянный режим `.ambient-loop`:** на визитке (и в правом нижнем углу экрана) расположены прямые кнопки перехода в профиль `https://github.com/DubnovAlexey` и репозиторий `https://github.com/DubnovAlexey/universe`. После завершения первого 108-секундного круга космос уходит на новый виток (`01_VOID`), а визитка не исчезает — она за 12 секунд активного времени плавно поднимается: на desktop в более свободную область над центром, на узком экране более сдержанно; величина подъёма учитывает высоту карточки и доступное место сверху. Фоновая прозрачность составляет `0.60`, при наведении — до `0.98`; мягкая глубокая тень и прозрачная радиальная подложка отделяют текст от сцены. Пауза замораживает подъём, reduced motion выбирает статичное положение.
5. **Чистое превью ссылки в мессенджерах:** в `frontend/src/pages/index.astro` установлен лаконичный `<title>Alexey Dubnov</title>` без мета-описаний, чтобы при пересылке ссылки в WhatsApp/Telegram отображались только имя автора и URL.

### 1.2. Для системного архитектора, преподавателя и CTO
Принцип **Оптического Единства (Optical Equivalence)** задаёт общую геометрию художественного космоса (`ILLUSION`), графа (`NEXUS`) и инженерной оптики (`X-RAY / TRUTH`). Физический provider выполняется перед художественными целями; итоговые particle-координаты читаются Canvas, квантованием графа и публикацией `SceneBufferSoA`. Rust не выполняет скрытую запись в SoA после публикации.
* Квантованный выборочный `FNV-1a State Digest` выводится в `LAYER_02` и `LAYER_04`. Общая подпись является диагностикой и сама по себе не доказывает тождество полного состояния или экранных преобразований.
* Влияние Rust-фазы на видимые координаты позднего GENESIS и данные графа/SoA проверяется реальной WASM-интеграцией. Общий экранный transform всех оптик развивается в отдельном визуальном этапе.

---

## 2. ХРОНОМЕТРАЖ 108 СЕКУНД И ПОВЕДЕНИЕ В РЕЖИМАХ DESKTOP / MOBILE

Общая длительность полного цикла составляет ровно **108.0 секунд** (`17 + 22 + 25 + 15 + 29 = 108 с`). Сцена объединяет астрофизические мотивы разных реальных объектов (`RS Puppis`, `M31 / NGC 3169`, `NGC 6543`) в единую научно-художественную композицию (*science-inspired art*).

| Фаза | Кодовое имя | Интервал (с) | Длительность | Число частиц | Главный визуальный и математический процесс |
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
    ├── .github/workflows/deploy.yml           # Python verifier/8 tests -> Rust 13 tests -> raw WASM build/5 integrations -> TS typecheck/27 invariants -> Astro/Pages checks -> Deploy
    ├── backend/                               # [ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER] Научное и верификационное ядро Python 3
    │   ├── api/transport.py                   # build_health_and_parity_report(), generate_live_binary_step()
    │   ├── core/
    │   │   ├── prng.py                        # DeterministicPRNG, GOLDEN_SEED=104729, compute_state_digest_fnv1a()
    │   │   ├── graph_logic.py                 # compute_nexus_topology(), build_bezier_arc_length_lut(), _compute_authentic_invariants()
    │   │   ├── stress_solver.py               # evaluate_breach_lens_refraction() — C¹-колокол g(u)=(1-u²)²
    │   │   └── singularity.py                 # evaluate_black_hole_optics(), sample_endless_cipher_stream()
    │   ├── utils/binary_packer.py             # pack_scene_binary_frame(), unpack_and_validate_header() ('<IHHIIII', 24 байта)
    │   ├── test_backend_parity.py             # 8 модульных тестов для стандартного раннера `python -B -m unittest discover -v`
    │   └── main.py                            # UniverseTelemetryHTTPHandler, run_cli_verification() (--verify)
    ├── physics_engine/                        # [RUST/WASM PROVIDER + NATIVE TESTS] Kuramoto и контрольные REF64 орбиты
    │   ├── Cargo.toml                         # crate-type = ["cdylib"]
    │   └── src/
    │       ├── lib.rs                         # Raw C ABI v1, импорт состояния, метрики + 13 native-тестов
    │       ├── memory.rs                      # SceneBufferHeader (#[repr(C)], 24 байта), SceneStateSoA (MAX_CAPACITY=1024)
    │       ├── gravity.rs                     # step_symplectic_verlet_and_kuramoto(), compute_reference_total_energy()
    │       ├── breach_math.rs                 # compute_refraction_offset_with_stress(), compute_refraction_offset()
    │       └── prng.rs                        # DeterministicPrng, verify_golden_vectors(), compute_quantized_state_digest()
    ├── frontend/                              # [РЕАЛИЗОВАНО В RUNTIME] Клиентское приложение Astro + TypeScript
    │   ├── astro.config.mjs                   # site: 'https://dubnovalexey.github.io', base: '/universe' (prod) / '/' (dev)
    │   ├── package.json                       # Скрипты: dev, typecheck, test (Vite SSR runner), build, preview
    │   ├── scripts/
    │   │   ├── build-wasm.mjs                 # Сборка реального модуля и проверка ABI
    │   │   ├── verify-wasm-runtime.mjs        # Пять интеграций реального WASM
    │   │   ├── verify-pages-artifact.mjs      # Статическая проверка Pages-артефакта
    │   │   └── verify-repository.mjs          # Отслеживаемые исходники и npm entry scripts
    │   ├── public/
    │   │   ├── audio/cosmic_ambient.mp3       # Мастер-трек космического эмбиента (старт с 2.6 с)
    │   │   ├── audio/AUDIO_LICENSE.md         # Документация использования аудиопотока
    │   │   ├── wasm/physics_engine.wasm       # Raw WASM ABI v1, ≈54 КиБ, без imports; default async, ?wasm=0 принуждает TS
    │   │   └── favicon.png                    # Растровая иконка вкладки
    │   └── src/
    │       ├── pages/index.astro              # Точка входа HTML (<title>Alexey Dubnov</title>), холст, баннер звука, док
    │       ├── styles/universe.css            # Цветовая конституция, вёрстка HUD, бесшовная визитка и адаптив 9:16
    │       ├── core/
    │       │   ├── contracts.ts               # Канонические типы PhaseId, SingularityAct, WorldEntity, TelemetrySnapshot
    │       │   ├── visualSignals.ts           # Неизменяемый снимок фазы, аудио и stress на кадр
    │       │   ├── glyphGrammar.ts            # Фазовые пулы code point, проверка глифов и fallback
    │       │   ├── glyphHover.ts              # Общий Roll/Dwell без новых RAF и таймеров
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
    │           ├── parityAndSeams.test.ts     # runUniverseVerificationSuite() — 27 проверок вместе с V1
    │           ├── visualSignals.test.ts     # Общий снимок, Unicode, Roll/Dwell, восстановление
    │           └── fixtures/nexusParity24.json # Общие входы и полный результат TS/Python, 40 рёбер
    ├── docs/
    │   ├── ARCHITECTURE.md                    # Краткий архитектурный обзор
    │   ├── DEMO_SCRIPT.md                     # Сценарий демонстрации, 48 модульных и 5 WASM-интеграционных проверок
    │   ├── ADR-001-POLYGLOT-RUNTIME.md         # Контракты runtime, реализация и порядок следующих этапов
    │   ├── VISUAL_AUDIO_DIRECTION.md          # Реализованный V1 и будущие глубина/переходы
    │   ├── QA_STATUS.md                       # Покрытие QA, выбранные исправления и открытые проверки
    │   └── study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md
    ├── package.json                           # Корневой манифест монорепозитория (workspaces: ["frontend"])
    ├── README.md                              # Двуязычная публичная витрина проекта (EN + RU)
    └── UNIVERSE_BIBLE.md                      # Настоящая внутренняя техническая конституция проекта

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
| **Ядро Python 3** | `backend/main.py`, `backend/core/*.py` | `[ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER]` | Реализует локальный HTTP/Binary сервер (`/api/health`, `/api/topology`, `/api/frame.bin`), CLI-верификатор (`--verify`) и 8 модульных тестов `unittest`. На статическом GitHub Pages Python-сервер не запущен (`CLIENT_ONLY`), а `PythonSocketClient` служит подготовленным и протестированным валидатором бинарных пакетов `'UNVS'`. |
| **Крейт Rust** | `physics_engine/src/*.rs` | `[WASM PROVIDER / NATIVE TESTS]` | Raw ABI v1, Kuramoto, контрольный Velocity Verlet и `breach_math`; 13 native-тестов и 5 интеграций реального WASM. |

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

### 5.3. Полная 8-польная защита `NaN / Infinity Guard`
В методе `SceneBufferSoA.syncEntityFromParticle()` все **8 числовых параметров** (`x, y, z, vx, vy, vz, depthZ, energy`) проходят индивидуальную проверку `Number.isFinite(val)`. Каждое нечисловое значение заменяется безопасным конечным значением (`0` или `1.0` для `depthZ`) и увеличивает счётчик `this.nanGuardTriggeredCount` ровно на число обнаруженных повреждённых полей (`[ПРОВЕРЕНО АВТОТЕСТОМ]`).

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
* **Эталонный вектор при `GOLDEN_SEED = 104729` (`[ПРОВЕРЕНО АВТОТЕСТОМ]`):**
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
* Реализации TypeScript и Python используют общее правило `floor(value * scale + 0.5) / scale` для двух/трёх десятичных знаков; отрицательные ties идут к `+∞`. Сохранена fixture6 и добавлен общий `nexusParity24.json`: transport RNG потребляет по шесть значений на узел, затем точно сравниваются 40 рёбер, классы, контрольные точки, LUT, радиусы Мюррея, 24 степени и семь метрик. Результат: 23 магистрали, 11 мостов, 6 дендритов; `avgDegree=3.33`, `C=0.384`, `D=8`, `avgPathLength=3.29`. Это не доказывает паритет всех входов $N \le 260$.
* На полной рабочей сцене ($N > 260$) браузерный TS-движок включает прореживание `stride = 2`; реальный Worker ещё не подключён. Выигрыш производительности требует измерения.
* Диаметр `diameterHops` и средняя длина пути `avgPathLength` вычисляются обходом в ширину (`BFS`) с шагом выборки стартовых вершин `sampleStride = max(1, floor(N / 28))` (здесь $N$ — число активных узлов после прореживания; при $N < 56$ шаг равен 1 и обход полный, при $N \ge 56$ стартовые вершины выбираются с шагом не менее 2). Метка `BFS-28` обозначает делитель шага, а не жёсткий предел в 28 стартов. Выборка на 24 узлах не проверяет sampling, лимит 36 хабов и прореживание.

### 7.4. Оптическое преломление `BREACH LENS` (`stressState.ts`, `breach_math.rs`, `stress_solver.py`)
* На кольце вокруг деформированной границы линзы ($d = \text{dist} / (R \cdot \text{warp})$, полуширина $w = 0.24$, нормированное расстояние от кромки $u = |d - 1.0| / w$) действует компактно-поддерживаемый колокол 4-й степени:
  $$g(u) = (1 - u^2)^2 \quad \text{при } u < 1, \qquad g(u) = 0 \quad \text{при } u \ge 1$$
* На границе кольца ($u = 1$) функция $g(1) = 0$ и её первая производная $g'(1) = 0$ ($C^1$-гладкое сопряжение без оптического шва, $C^\infty$ внутри открытого интервала $u \in (0, 1)$). Все три реализации (TS, Python, Rust) содержат идентичную формулу `warp`. В `getTruthRevealFactorAt` передаётся текущее `simulationTimeSec`, поэтому внутренняя маска следует тому же движущемуся контуру; переход фиксированной точки через кромку покрыт регрессией.

---

## 8. РЕНДЕРИНГ, ЗВУК И КНИГА УЧЁТА РЕСУРСОВ (`ResourceLedger`)

### 8.1. Графический конвейер и дизеринг `Blue-Noise`
* `RenderPipeline` (`frontend/src/engine/pipeline.ts`) создаёт 2D-контекст с ограничением `dpr = min(maxDpr, window.devicePixelRatio)` из `QualityGovernor` (`2.0` для HIGH, `1.5` для MEDIUM, `1.25` для LOW) и генерирует тайл дизеринга `64×64` (`buildBlueNoiseDitherPattern`).

### 8.2. Аудио-конвейер и мгновенное снятие слушателей (`frontend/src/utils/audioSync.ts`)
* Файл: `frontend/public/audio/cosmic_ambient.mp3` (`~16.46 МБ`).
* При старте вызывается `configureIosAudioSession()` (`navigator.audioSession.type = 'playback'`).
* При старте `trySilentAutoplayWithoutWarning()` сразу запрашивает воспроизведение `<audio>` без создания `AudioContext`. Браузер может отклонить запрос по своей autoplay policy; тогда доступен запуск первым жестом пользователя. Наличие или отсутствие сообщения в консоли зависит от браузера.
* Как только промис `audioEl.play()` разрешается или срабатывает событие `'playing'`, немедленно вызывается `this.removeUnlockListenersFn?.()`, отключающая все глобальные слушатели разблокировки.

### 8.3. Книга учёта ресурсов `ResourceLedger` (`frontend/src/core/resourceLedger.ts`)
* Отслеживает 5 категорий ресурсов (`buffers`, `textures`, `audioNodes`, `listeners`, `workers`) и 2 диагностических счётчика (`underflowCount` при попытке освободить больше ресурсов, чем было выделено, и `disposerErrors` при исключениях внутри колбэков очистки).
* Метод `disposeCycleResources()` проверяет все 5 категорий и отсутствие `underflowCount` / `disposerErrors` (`[ПРОВЕРЕНО АВТОТЕСТОМ]`).


### 8.4. Общие визуальные сигналы, Unicode и Roll/Dwell (V1)
Один неизменяемый `VisualSignalSnapshot` публикуется из существующего цикла renderer: `tick`, время, фаза/прогресс, пауза/reduced motion, seed, `low/mid/high/pulse/heartbeat`, `kuramotoR` и `globalStress`. Renderer, водопад, Canvas-одометр и DOM-визитка читают согласованные фазовые и аудиоданные; новый анализатор или планировщик не создаётся.

`glyphGrammar.ts` хранит семейства как массивы полных code point через `Array.from`: базовые числа/латиница, геометрия, математика, связность и египетские знаки. Проверка растрового отпечатка отбраковывает неподдерживаемые глифы; при недоступном шрифте/Canvas остаётся базовый ASCII-пул. Тяжёлые веб-шрифты не добавлены. Составные графемы потребуют отдельной сегментации.

`glyphHover.ts` выполняет три фазовых roll-шага по `160–180 мс`, затем удерживает точный канонический текст `280–320 мс`. Targets — `.brand-card`, кнопки фазовой шкалы, `.controls-dock` и статические строки/кнопки Layer5. Локальные glow/translate не меняют размеры панели; числовая телеметрия не подменяется. Завершение, pointerleave/blur, пауза и reduced motion восстанавливают текст; доступное имя кнопки остаётся стабильным. Автономная центральная строка сохраняет отдельный диапазон `18–26 Гц`. Модульные проверки охватывают Unicode, fallback, восстановление и dwell; фактическое качество шрифтов и наведения на устройствах проверяется в браузере.

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

## 10. ПРОВЕРКИ (48 МОДУЛЬНЫХ: 27 TS + 8 PYTHON + 13 RUST; 5 ИНТЕГРАЦИОННЫХ WASM)

| Команда | Что реально проверяет | Результат |
| :--- | :--- | :---: |
| `npm run verify:repo` | Проверяет наличие и отслеживание npm entry scripts, исходников и fixtures до численных проверок и сборки; запускается также в CI. | PASS в финальном `verify:all` |
| `python -B -m backend.main --verify` | CLI-проверка 5 математических инвариантов Python-ядра: `GOLDEN_U32_VECTORS`, 24-байтный заголовок `'UNVS'`, граф `NEXUS`, кольцо рефракции `BREACH LENS` (`px=232`) и оптика Чёрной дыры. | `status: "ok"` (Exit Code `0`) |
| `python -B -m unittest discover -v` | Запускает **8 модульных тестов** из `backend/test_backend_parity.py`: PRNG, FNV-1a дайджест, санитизация `NaN` и отбраковка обрезанных пакетов в `binary_packer.py`, граф `NEXUS` на 6 и 24 узлах, десятичные ties, граничные условия `BREACH LENS` и генератор кадров `generate_live_binary_step`. | `Ran 8 tests — OK` (Exit Code `0`) |
| `npm run test:rust` | **13 native-тестов** Rust: PRNG/инициализация, энергия и рефракция, C ABI, перенос состояния, накопленное время, границы шага/count и атомарность расчётного шага. | `13 passed; 0 failed` |
| `npm run build:wasm` | Собирает raw `wasm32-unknown-unknown` и проверяет ABI v1/отсутствие imports. | Реальный модуль `≈54 КиБ` |
| `npm run verify:wasm` | **5 интеграционных проверок** реального WASM: 600 смешанных шагов против TS (96 осцилляторов/64 орбиты/энергия), memory growth/count, seed/reset/late adoption, trap и неверные ABI/указатели, влияние Rust-фазы на видимые координаты и граф/SoA. | `5/5 PASS` |
| `npm --prefix frontend run typecheck` | Запускает строгий компилятор `tsc --noEmit` по всем `.ts` и `.tsx` модулям фронтенда. | `0 errors` (Exit Code `0`) |
| `npm --prefix frontend test` | Запускает через Vite SSR функцию `runUniverseVerificationSuite()` из `frontend/src/tests/parityAndSeams.test.ts` (**27 инвариантов**, включая временно-независимую атаку/релиз аудиоогибающей). | `Summary: 27/27 PASSED` (Exit Code `0`) |
| `npm --prefix frontend run build` + `npm --prefix frontend run verify:pages-artifact` | Проверяет production HTML, обязательные UI-точки входа, адреса Astro-бандлов под `/universe/`, наличие фавикона и аудиотрека в Pages-артефакте. Это статическая проверка собранного артефакта, не полноценный браузерный E2E-тест. | PASS в финальном `verify:all`; границы браузерной проверки — `docs/QA_STATUS.md` |

---

## 11. СБОРКА, ЛОКАЛЬНАЯ РАЗРАБОТКА И ДЕПЛОЙ НА GITHUB PAGES

### Команды для работы из корня репозитория (`C:\Projects\Full_Stack\universe`):
1. Чистая установка зависимостей по lock-файлу: `npm ci` (Astro `7.4.2`, Node.js `>=22.23.4` в обоих manifests)
2. Сборка WASM (нужен Rust target `wasm32-unknown-unknown`): `npm run build:wasm`
3. Локальный сервер разработки (`http://localhost:4321/`): `npm run dev`
4. Проверка полноты исходников: `npm run verify:repo`; полная локальная проверка: `npm run verify:all` — guard, Python verifier/тесты, native Rust, TS typecheck/инварианты, WASM build/integration, Astro и Pages artifact.
5. Продакшен-сборка в папку `frontend/dist` (`base: '/universe'`): `npm run build`

Полный браузерный цикл, второй цикл, звук, мобильная компоновка и p50/p95 остаются отдельной проверкой. V1 реализован: общий снимок, грамматика code point и спокойный hover. Следующие этапы — общая глубина V2 и переходы V3, затем Worker по измерениям и WebGPU. Большое разделение `renderer.ts` и CSS выполняется отдельным последним этапом после завершения ранее запланированных работ.

Предыдущий выборочный production smoke фундамента: default `WASM_ACTIVE`/`READY`, ручной переход в фазу 05, появление имени в ACT_D и автоматический вход во второй цикл с сохранённой визиткой. Rust остался `READY` после reset и изменения active count `820 → 590`. При `?wasm=0` подтверждены видимая TS-сцена и `FALLBACK`; warning/error в просмотренных запусках не зарегистрированы. Это не непрерывное наблюдение всех 108 секунд и не полный E2E.

Узкий viewport `507×684`: default native, открытые метрики с `REF64`/Rust и видимые кнопки управления; warning/error не зарегистрированы. Полное покрытие устройств, слышимость аудио, Safari/iOS и performance baseline остаются открытыми.

---

## 12. БЕЗОПАСНОСТЬ, ЛИЦЕНЗИИ И ВНЕШНИЕ РЕСУРСЫ

* В репозитории нет секретных ключей или паролей; файл `.env` добавлен в `.gitignore`, а `.env.example` содержит только закомментированный шаблон опционального адреса `PUBLIC_WS_URL`.
* После обновления зависимостей до Astro `7.4.2` команда `npm audit` сообщает 0 уязвимостей; это проверка текущего lock-файла, а не гарантия будущего состояния зависимостей.
* Весь исходный код репозитория распространяется под открытой лицензией **MIT** (`LICENSE`).
* Аудиофайл `frontend/public/audio/cosmic_ambient.mp3` включён для некоммерческого демонстрационного показа портфолио на GitHub Pages (`frontend/public/audio/AUDIO_LICENSE.md`). Лицензия MIT на программный код не заменяет музыкальную лицензию аудиозаписи; перед любым сторонним или коммерческим переиспользованием трека необходимо отдельно подтвердить права на аудиофайл.

---

## 13. ЖУРНАЛ ОБНОВЛЕНИЙ ДОКУМЕНТАЦИИ

* **24.10.2026 — исходный baseline `c2e2c0c`:** сохранены исторические результаты 16 TS, 6 Python и 5 native Rust (27 модульных). Пустой WASM этого baseline не считался работающим provider.
* **24.10.2026 — фундамент Rust/WASM:** реализован raw ABI v1, общий TS/Rust Kuramoto, REF64 и перенос состояния/fallback. Набор расширился до 35 модульных (16 TS + 6 Python + 13 Rust) и 5 интеграционных проверок реального WASM. Выборочный production smoke подтвердил default `WASM_ACTIVE`/`READY`.
* **24.10.2026 — QA и V1:** исправлены bendSign промежуточных кадров и время маски линзы; унифицировано десятичное округление; fixture6 дополнена общим transport fixture24. Реализованы `visualSignals`, `glyphGrammar`, `glyphHover` и плавный подъём фоновой визитки после первого полного круга. Текущий набор — 48 модульных (27 TS + 8 Python + 13 Rust) и 5 WASM-интеграций. Введён guard полноты репозитория. Финальный локальный `verify:all` прошёл без warning/error; выборочный desktop/mobile smoke подтвердил карточку, доступные действия, клавиатурный фокус и паузу. Границы покрытия приведены в `docs/QA_STATUS.md`; новый успешный удалённый CI отдельно не подтверждён.
