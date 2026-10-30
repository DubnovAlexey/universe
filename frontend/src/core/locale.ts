// ============================================================================
// ФАЙЛ: frontend/src/core/locale.ts
// НАЗНАЧЕНИЕ: Общий язык интерфейса, подписки и переводы подписей без изменения физики.
// РАЗДЕЛЫ: 1. Контракт; 2. Словарь UI; 3. Фазы и сообщения; 4. Выбор и подписки.
// ФУНКЦИИ: getLocale, setLocale, subscribeLocale, translateUi, hasUiTranslation, translateLog.
// ============================================================================

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ
export const LOCALES = ['ru', 'en', 'he', 'es'] as const;
export type Locale = typeof LOCALES[number];
type Words = readonly [string, string, string, string];
const entries = new Map<string, Words>();
// НАЧАЛО ФУНКЦИИ add
function add(source: string, ru: string, en: string, he: string, es: string): void {
    entries.set(source, Object.freeze([ru, en, he, es]));
}
// КОНЕЦ ФУНКЦИИ add
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПОЛЬЗОВАТЕЛЬСКИЕ ПОДПИСИ
const ui: readonly (readonly [string, ...Words])[] = [
    ['HOW IT WORKS','КАК ЭТО УСТРОЕНО','HOW IT WORKS','איך זה עובד','CÓMO FUNCIONA'],
    ['LANGUAGE','ЯЗЫК','LANGUAGE','שפה','IDIOMA'],
    ['UNIVERSE / ПУТЕВОДИТЕЛЬ','UNIVERSE / ПУТЕВОДИТЕЛЬ','UNIVERSE / FIELD GUIDE','UNIVERSE / מדריך','UNIVERSE / GUÍA'],
    ['Закрыть ×','Закрыть ×','Close ×','סגירה ×','Cerrar ×'],
    ['Глубина объяснения','Глубина объяснения','Explanation depth','רמת ההסבר','Nivel de explicación'],
    ['Просто','Просто','Simply','בפשטות','En sencillo'],
    ['Технически','Технически','Technical','טכני','Técnico'],
    ['Темы объяснения','Темы объяснения','Explore a topic','נושאי ההסבר','Temas de explicación'],
    ['Что видно в сцене','Что видно в сцене','What you see','מה רואים בסצנה','Qué se ve en la escena'],
    ['Простая идея','Простая идея','The intuition','הרעיון בפשטות','La idea intuitiva'],
    ['Как это реализовано','Как это реализовано','Implementation','איך זה ממומש','Cómo se implementa'],
    ['Формулы и обозначения','Формулы и обозначения','Equations and notation','נוסחאות וסימונים','Fórmulas y notación'],
    ['Посмотреть исходный код','Посмотреть исходный код','Explore the source','עיון בקוד המקור','Ver el código fuente'],
    ['Наблюдайте за сценой и управляйте звуком, пока изучаете объяснения.','Наблюдайте за сценой и управляйте звуком, пока изучаете объяснения.','The scene and audio controls remain active while you explore.','הסצנה ובקרי השמע ממשיכים לפעול בזמן קריאת ההסברים.','La escena y los controles de sonido siguen activos mientras exploras.'],
    ['Пояснение:','Пояснение:','Explain:','הסבר:','Explicación:'],
    ['⏸ PAUSE','⏸ ПАУЗА','⏸ PAUSE','⏸ השהיה','⏸ PAUSA'],
    ['▶ RESUME','▶ ПРОДОЛЖИТЬ','▶ RESUME','▶ המשך','▶ CONTINUAR'],
    ['🔄 AUTO: ON','🔄 АВТО: ВКЛ','🔄 AUTO: ON','🔄 אוטומטי: פעיל','🔄 AUTO: SÍ'],
    ['🔄 AUTO: OFF','🔄 АВТО: ВЫКЛ','🔄 AUTO: OFF','🔄 אוטומטי: כבוי','🔄 AUTO: NO'],
    ['🔊 AUDIO: ON','🔊 ЗВУК: ВКЛ','🔊 AUDIO: ON','🔊 שמע: פעיל','🔊 AUDIO: SÍ'],
    ['🔇 AUDIO: MUTED','🔇 ЗВУК: ВЫКЛ','🔇 AUDIO: MUTED','🔇 שמע: מושתק','🔇 AUDIO: NO'],
    ['🔊 AUDIO: WAIT','🔊 ВКЛЮЧИТЬ ЗВУК','🔊 AUDIO: WAIT','🔊 הפעלת שמע','🔊 ACTIVAR AUDIO'],
    ['📊 METRICS','📊 МЕТРИКИ','📊 METRICS','📊 מדדים','📊 MÉTRICAS'],
    ['🕸 TOPOLOGY','🕸 ТОПОЛОГИЯ','🕸 TOPOLOGY','🕸 טופולוגיה','🕸 TOPOLOGÍA'],
    ['⌨ TERMINAL','⌨ ТЕРМИНАЛ','⌨ TERMINAL','⌨ מסוף','⌨ TERMINAL'],
    ['🔬 X-RAY','🔬 РЕНТГЕН','🔬 X-RAY','🔬 מבט פנימי','🔬 RAYOS X'],
    ['VOID','ПУСТОТА','VOID','ריק','VACÍO'],
    ['GENESIS','ГЕНЕЗИС','GENESIS','התהוות','GÉNESIS'],
    ['EVOLUTION','ЭВОЛЮЦИЯ','EVOLUTION','התפתחות','EVOLUCIÓN'],
    ['COLLAPSE','КОЛЛАПС','COLLAPSE','קריסה','COLAPSO'],
    ['SINGULARITY','СИНГУЛЯРНОСТЬ','SINGULARITY','סינגולריות','SINGULARIDAD'],
    ['[ 🔊 TAP / CLICK TO ENGAGE AUDIO ]','[ 🔊 НАЖМИТЕ ДЛЯ ВКЛЮЧЕНИЯ ЗВУКА ]','[ 🔊 TAP / CLICK TO ENGAGE AUDIO ]','[ 🔊 לחיצה להפעלת שמע ]','[ 🔊 PULSA PARA ACTIVAR EL AUDIO ]'],
    ['POLYGLOT ARCHITECTURE : FROM ZERO TO ZERO (108 SEC)','ПОЛИГЛОТНАЯ АРХИТЕКТУРА : ИЗ НУЛЯ В НУЛЬ (108 СЕК)','POLYGLOT ARCHITECTURE : FROM ZERO TO ZERO (108 SEC)','ארכיטקטורה רב־לשונית : מאפס לאפס (108 שניות)','ARQUITECTURA POLÍGLOTA : DE CERO A CERO (108 S)'],
    ['[ ↗ GITHUB PROFILE : DUBNOV ALEXEY ]','[ ↗ ПРОФИЛЬ GITHUB : DUBNOV ALEXEY ]','[ ↗ GITHUB PROFILE : DUBNOV ALEXEY ]','[ ↗ פרופיל GITHUB : DUBNOV ALEXEY ]','[ ↗ PERFIL GITHUB : DUBNOV ALEXEY ]'],
    ['[ ↗ PROJECT REPOSITORY ]','[ ↗ РЕПОЗИТОРИЙ ПРОЕКТА ]','[ ↗ PROJECT REPOSITORY ]','[ ↗ מאגר הפרויקט ]','[ ↗ REPOSITORIO DEL PROYECTO ]'],
    ['[ ↻ RESTART UNIVERSE CYCLE ]','[ ↻ ПЕРЕЗАПУСТИТЬ ЦИКЛ ]','[ ↻ RESTART UNIVERSE CYCLE ]','[ ↻ התחלת המחזור מחדש ]','[ ↻ REINICIAR EL CICLO ]'],
    ['LAYER_02 // POLYGLOT TELEMETRY','LAYER_02 // ТЕЛЕМЕТРИЯ','LAYER_02 // POLYGLOT TELEMETRY','LAYER_02 // טלמטריה','LAYER_02 // TELEMETRÍA'],
    ['LAYER_03 // NEXUS GRAPH TOPOLOGY','LAYER_03 // ТОПОЛОГИЯ NEXUS','LAYER_03 // NEXUS GRAPH TOPOLOGY','LAYER_03 // טופולוגיית NEXUS','LAYER_03 // TOPOLOGÍA NEXUS'],
    ['LAYER_04 // TERMINAL & REGISTRY','LAYER_04 // ТЕРМИНАЛ И РЕЕСТР','LAYER_04 // TERMINAL & REGISTRY','LAYER_04 // מסוף ורישום','LAYER_04 // TERMINAL Y REGISTRO'],
    ['NODES / EDGES [ts/graph_engine]','УЗЛЫ / РЁБРА [ts/graph_engine]','NODES / EDGES [ts/graph_engine]','צמתים / קשתות [ts/graph_engine]','NODOS / ARISTAS [ts/graph_engine]'],
    ['CORE STATUS [IntegrationRegistry]','СОСТОЯНИЕ ЯДРА [IntegrationRegistry]','CORE STATUS [IntegrationRegistry]','מצב הליבה [IntegrationRegistry]','ESTADO DEL NÚCLEO [IntegrationRegistry]'],
    ['AUDIO RMS [web-audio]','УРОВЕНЬ ЗВУКА RMS [web-audio]','AUDIO RMS [web-audio]','עוצמת שמע RMS [web-audio]','NIVEL DE AUDIO RMS [web-audio]'],
    ['CLASS A (MST TRUNKS):','КЛАСС A (СТВОЛЫ MST):','CLASS A (MST TRUNKS):','קבוצה A (גזעי MST):','CLASE A (TRONCOS MST):'],
    ['CLASS B (GABRIEL BRIDGES):','КЛАСС B (МОСТЫ Gabriel):','CLASS B (GABRIEL BRIDGES):','קבוצה B (גשרי Gabriel):','CLASE B (PUENTES Gabriel):'],
    ['CLASS C (MURRAY DENDRITES):','КЛАСС C (ДЕНДРИТЫ Murray):','CLASS C (MURRAY DENDRITES):','קבוצה C (דנדריטים Murray):','CLASE C (DENDRITAS Murray):'],
    ['AVG DEGREE / CLUSTERING:','СР. СТЕПЕНЬ / КЛАСТЕРИЗАЦИЯ:','AVG DEGREE / CLUSTERING:','דרגה ממוצעת / אשכולות:','GRADO MEDIO / AGRUPAMIENTO:'],
    ['EST. DIAMETER / PATH (BFS):','ОЦЕНКА ДИАМЕТРА / ПУТИ (BFS):','EST. DIAMETER / PATH (BFS):','אומדן קוטר / מסלול (BFS):','DIÁMETRO / CAMINO EST. (BFS):'],
    ['PULSES IN FLIGHT:','ИМПУЛЬСЫ В ПУТИ:','PULSES IN FLIGHT:','פעימות בתנועה:','PULSOS EN TRÁNSITO:'],
    ['Инженерная телеметрия полиглот-ядра','Инженерная телеметрия полиглот-ядра','Polyglot engine telemetry','טלמטריית המנוע הרב־לשוני','Telemetría del núcleo políglota'],
    ['Инспектор топологии графа NEXUS','Инспектор топологии графа NEXUS','NEXUS graph inspector','בודק גרף NEXUS','Inspector del grafo NEXUS'],
    ['Инженерный терминал и реестр полиглот-модулей','Инженерный терминал и реестр полиглот-модулей','Engineering terminal and module registry','מסוף הנדסי ומרשם מודולים','Terminal de ingeniería y registro de módulos'],
    ['Интерактивное космическое и нейронное полотно UNIVERSE','Интерактивное космическое и нейронное полотно UNIVERSE','UNIVERSE interactive cosmic and neural scene','הסצנה הקוסמית והעצבית של UNIVERSE','Escena cósmica y neuronal interactiva UNIVERSE'],
    ['Финальная визитка автора — Dubnov Alexey','Финальная визитка автора — Dubnov Alexey','Author card — Dubnov Alexey','כרטיס היוצר — Dubnov Alexey','Tarjeta del autor — Dubnov Alexey'],
    ['Включить космическое звуковое сопровождение','Включить космическое звуковое сопровождение','Enable the cosmic soundtrack','הפעלת הפסקול הקוסמי','Activar la banda sonora cósmica'],
    ['LANGUAGE: RU / EN / HE / ES','ЯЗЫК: RU / EN / HE / ES','LANGUAGE: RU / EN / HE / ES','שפה: RU / EN / HE / ES','IDIOMA: RU / EN / HE / ES'],
    ['Каскад телеметрии Цифрового Водопада','Каскад телеметрии Цифрового Водопада','Digital Waterfall telemetry panels','לוחות הטלמטריה של המפל הדיגיטלי','Paneles de telemetría de la cascada digital'],
    ['Шкала 5 фаз эволюции Вселенной (108 секунд)','Шкала 5 фаз эволюции Вселенной (108 секунд)','Five phases of universe evolution (108 seconds)','חמשת שלבי התפתחות היקום (108 שניות)','Cinco fases de evolución del universo (108 segundos)'],
    ['Пояснения к технологиям и математике','Пояснения к технологиям и математике','Technology and mathematics guide','מדריך לטכנולוגיה ולמתמטיקה','Guía de tecnología y matemáticas'],
    ['Открыть простые объяснения, формулы и устройство проекта','Открыть простые объяснения, формулы и устройство проекта','Explore simple explanations, equations and project architecture','פתיחת הסברים פשוטים, נוסחאות ומבנה הפרויקט','Explorar explicaciones sencillas, fórmulas y arquitectura del proyecto'],
    ['Управление звуком, инженерными оптиками и переходом в GitHub','Управление звуком, инженерными оптиками и переходом в GitHub','Audio, engineering views and GitHub controls','בקרי שמע, תצוגות הנדסיות ו־GitHub','Controles de audio, vistas de ingeniería y GitHub'],
    ['Пауза / Продолжить (Клавиша P)','Пауза / Продолжить (Клавиша P)','Pause / Resume (P key)','השהיה / המשך (מקש P)','Pausa / Continuar (tecla P)'],
    ['Автоматический 108-секундный цикл','Автоматический 108-секундный цикл','Automatic 108-second cycle','מחזור אוטומטי של 108 שניות','Ciclo automático de 108 segundos'],
    ['Включить / Выключить звук (Клавиша M)','Включить / Выключить звук (Клавиша M)','Enable / Mute audio (M key)','הפעלה / השתקת שמע (מקש M)','Activar / Silenciar audio (tecla M)'],
    ['Телеметрия полиглот-ядра (Клавиша 2)','Телеметрия полиглот-ядра (Клавиша 2)','Polyglot engine telemetry (2 key)','טלמטריית המנוע הרב־לשוני (מקש 2)','Telemetría del núcleo políglota (tecla 2)'],
    ['Топология графа NEXUS (Клавиша 3)','Топология графа NEXUS (Клавиша 3)','NEXUS graph topology (3 key)','טופולוגיית גרף NEXUS (מקש 3)','Topología del grafo NEXUS (tecla 3)'],
    ['Терминал и IntegrationRegistry (Клавиша 4)','Терминал и IntegrationRegistry (Клавиша 4)','Terminal and IntegrationRegistry (4 key)','מסוף ו־IntegrationRegistry (מקש 4)','Terminal e IntegrationRegistry (tecla 4)'],
    ['Глобальный инженерный рентген X-RAY (Клавиша 5)','Глобальный инженерный рентген X-RAY (Клавиша 5)','Global engineering X-RAY view (5 key)','תצוגת X-RAY הנדסית כוללת (מקש 5)','Vista global de ingeniería X-RAY (tecla 5)'],
    ['Перейти на главную страницу профиля GitHub — Dubnov Alexey','Перейти на главную страницу профиля GitHub — Dubnov Alexey','Open the GitHub profile — Dubnov Alexey','פתיחת פרופיל GitHub — Dubnov Alexey','Abrir el perfil de GitHub — Dubnov Alexey'],
    ['32-bit FNV-1a State Digest (ILLUSION == NEXUS == X-RAY)','32-битный отпечаток состояния FNV-1a (ILLUSION == NEXUS == X-RAY)','32-bit FNV-1a state digest (ILLUSION == NEXUS == X-RAY)','טביעת מצב FNV-1a של 32 סיביות (ILLUSION == NEXUS == X-RAY)','Huella de estado FNV-1a de 32 bits (ILLUSION == NEXUS == X-RAY)'],
    ['Выборочная оценка диаметра и средней длины пути методом BFS (до 28 стартовых вершин)','Выборочная оценка диаметра и средней длины пути методом BFS','Sampled BFS estimate of graph diameter and average path length','אומדן בדגימת BFS לקוטר הגרף ולאורך המסלול הממוצע','Estimación mediante muestreo BFS del diámetro y la longitud media de camino'],
    ['Что означает SCRAMBLER?','Что означает SCRAMBLER?','What does SCRAMBLER mean?','מה המשמעות של SCRAMBLER?','¿Qué significa SCRAMBLER?'],
    ['Что означает KURAMOTO?','Что означает KURAMOTO?','What does KURAMOTO mean?','מה המשמעות של KURAMOTO?','¿Qué significa KURAMOTO?'],
    ['Что означает fBm?','Что означает fBm?','What does fBm mean?','מה המשמעות של fBm?','¿Qué significa fBm?'],
    ['Что означает VERLET?','Что означает VERLET?','What does VERLET mean?','מה המשמעות של VERLET?','¿Qué significa VERLET?'],
    ['Что означает PLUMMER?','Что означает PLUMMER?','What does PLUMMER mean?','מה המשמעות של PLUMMER?','¿Qué significa PLUMMER?'],
];
ui.forEach(([source, ...words]) => add(source, ...words));
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ФАЗЫ И СООБЩЕНИЯ
const phases: readonly Words[] = [
 ['01. ПУСТОТА И СВЕТОВОЕ ЭХО (VOID)','01. VOID AND LIGHT ECHO','01. ריק והד אור','01. VACÍO Y ECO DE LUZ'],
 ['02. ГЕНЕЗИС (GENESIS)','02. GENESIS','02. התהוות','02. GÉNESIS'],
 ['03. ЭВОЛЮЦИЯ И НЕЙРОВЕРС (EVOLUTION)','03. EVOLUTION AND NEURAL UNIVERSE','03. התפתחות ויקום עצבי','03. EVOLUCIÓN Y UNIVERSO NEURONAL'],
 ['04. ПРЕЛОМЛЕНИЕ И ШТОРМ (COLLAPSE)','04. REFRACTION AND STORM','04. שבירה וסערה','04. REFRACCIÓN Y TORMENTA'],
 ['05. СИНГУЛЯРНОСТЬ И ОДОМЕТР (LOGIC → ∞)','05. SINGULARITY AND ODOMETER (LOGIC → ∞)','05. סינגולריות ואודומטר (LOGIC → ∞)','05. SINGULARIDAD Y ODÓMETRO (LOGIC → ∞)'],
 ['Квантовая флуктуация, световое эхо цефеиды RS Кормы и гравитационный чирп (0–17 с)','Quantum fluctuation, RS Puppis light echo and gravitational chirp (0–17 s)','תנודה קוונטית, הד האור של RS Puppis וציוץ כבידתי (0–17 שניות)','Fluctuación cuántica, eco de RS Puppis y chirp gravitacional (0–17 s)'],
 ['Пылевые рукава M31 / NGC 3169, гравитация N-тел и синхронизация Курамото (17–39 с)','Dust arms of M31 / NGC 3169 and Kuramoto synchronization (17–39 s)','זרועות האבק של M31 / NGC 3169 וסנכרון Kuramoto (17–39 שניות)','Brazos de polvo de M31 / NGC 3169 y sincronización Kuramoto (17–39 s)'],
 ['Когнитивные полушария, граф Габриэля — Мюррея и каскады импульсов (39–64 с)','Cognitive hemispheres, Gabriel–Murray graph and impulse cascades (39–64 s)','המיספרות קוגניטיביות, גרף Gabriel–Murray ומפלי פעימות (39–64 שניות)','Hemisferios cognitivos, grafo Gabriel–Murray y cascadas de impulsos (39–64 s)'],
 ['Гравитационные аномалии, фазовый срыв и рентген-оптика BREACH LENS (64–79 с)','Gravitational anomalies, phase disruption and BREACH LENS optics (64–79 s)','חריגות כבידתיות, שיבוש פאזה ואופטיקת BREACH LENS (64–79 שניות)','Anomalías gravitacionales, ruptura de fase y óptica BREACH LENS (64–79 s)'],
 ['Корона «Кошачьего глаза» NGC 6543, Чёрная дыра и квантовый одометр (79–108 с)','NGC 6543 Cat’s Eye corona, black hole and quantum odometer (79–108 s)','קורונת Cat’s Eye של NGC 6543, חור שחור ואודומטר קוונטי (79–108 שניות)','Corona Cat’s Eye NGC 6543, agujero negro y odómetro cuántico (79–108 s)'],
];
phases.forEach((words) => add(words[0], ...words));
const logParts: readonly Words[] = [
 ['Инициализация UNIVERSE','Initializing UNIVERSE','אתחול UNIVERSE','Inicialización de UNIVERSE'],
 ['Переход к фазе','Entering phase','מעבר לשלב','Cambio a la fase'],
 ['Симуляция приостановлена пользователем.','Simulation paused.','הסימולציה מושהית.','Simulación en pausa.'],
 ['Симуляция продолжена.','Simulation resumed.','הסימולציה חודשה.','Simulación reanudada.'],
 ['Симуляция возобновлена.','Simulation resumed.','הסימולציה חודשה.','Simulación reanudada.'],
 ['Интерференция сигналов в соме','Signal interference in soma','התאבכות אותות בסומה','Interferencia de señales en el soma'],
 ['Рентген','X-ray','מבט פנימי','Rayos X'],
 ['Включён','Enabled','מופעל','Activado'], ['Выключен','Disabled','כבוי','Desactivado'],
    ['Автоматический 108-секундный цикл включён.','Automatic 108-second cycle enabled.','מחזור אוטומטי של 108 שניות הופעל.','Ciclo automático de 108 segundos activado.'],
    ['Ручной режим исследования фазы включён.','Manual phase exploration enabled.','מצב חקירה ידנית של השלב הופעל.','Exploración manual de la fase activada.'],
    ['АКТИВИРОВАН','ENABLED','מופעל','ACTIVADO'],
    ['СКРЫТ','HIDDEN','מוסתר','OCULTO'],
    ['Обнаружена пауза цикла RAF (','RAF loop stall detected (','זוהתה עצירה בלולאת RAF (','Se detectó una pausa del ciclo RAF ('],
    ['Ожидание восстановления кадра.','Waiting for frame recovery.','בהמתנה לחידוש הפריימים.','Esperando la recuperación de los fotogramas.'],
    ['Неизвестное исключение кадра','Unknown frame exception','חריגת פריים לא ידועה','Excepción de fotograma desconocida'],
    ['Запущено гравитационное схлопывание цикла #','Starting gravitational collapse for cycle #','התחלת קריסה כבידתית של מחזור #','Inicio del colapso gravitacional del ciclo #'],
    ['Цикл #','Cycle #','מחזור #','Ciclo #'],
    [' открыт в фазе ',' opened in phase ',' נפתח בשלב ',' abierto en la fase '],
    [' (визитка активна на фоне).',' (card remains active in the background).',' (הכרטיס ממשיך לפעול ברקע).',' (la tarjeta sigue activa en el fondo).'],
    ['Акт B (LOGIC): Спиральное сжатие в Точку Нуля. StateDigest=','Act B (LOGIC): spiral contraction into the Zero Point. StateDigest=','מערכה B (LOGIC): התכווצות ספירלית אל נקודת האפס. StateDigest=','Acto B (LOGIC): contracción en espiral hacia el Punto Cero. StateDigest='],
    ['Точка Нуля достигнута: мгновенное перерождение в визитку DUBNOV ALEXEY','Zero Point reached: immediate rebirth as the DUBNOV ALEXEY card','נקודת האפס הושגה: לידה מחדש מיידית ככרטיס DUBNOV ALEXEY','Punto Cero alcanzado: renacimiento inmediato como tarjeta DUBNOV ALEXEY'],
    ['Акт D: Развёртывание визитки DUBNOV ALEXEY из Точки Нуля.','Act D: unfolding the DUBNOV ALEXEY card from the Zero Point.','מערכה D: פריסת כרטיס DUBNOV ALEXEY מתוך נקודת האפס.','Acto D: despliegue de la tarjeta DUBNOV ALEXEY desde el Punto Cero.'],
    ['BREACH LENS открыта в (','BREACH LENS opened at (','BREACH LENS נפתחה ב־(','BREACH LENS abierta en ('],
    ['Оптическая мембрана BREACH закрыта.','BREACH optical membrane closed.','הממברנה האופטית BREACH נסגרה.','Membrana óptica BREACH cerrada.'],
    ['Скачок напряжения ткани:','Fabric stress spike:','זינוק במתח המארג:','Pico de tensión del tejido:'],
    ['Отброшен бинарный кадр до завершения handshake.','Binary frame discarded before handshake completion.','פריים בינרי נדחה לפני השלמת handshake.','Fotograma binario descartado antes de completar handshake.'],
    ['Handshake подтверждён (schema v','Handshake confirmed (schema v','Handshake אושר (schema v','Handshake confirmado (schema v'],
    ['). Статус: SERVER CONNECTED.','). Status: SERVER CONNECTED.','). מצב: SERVER CONNECTED.','). Estado: SERVER CONNECTED.'],
    ['Неизвестная версия схемы сервера:','Unknown server schema version:','גרסת סכמת שרת לא מוכרת:','Versión de esquema del servidor desconocida:'],
    [' (ожидалась ',' (expected ',' (נדרשה ',' (se esperaba '],
    ['Отброшено повреждённое JSON-сообщение.','Malformed JSON message discarded.','הודעת JSON פגומה נדחתה.','Mensaje JSON dañado descartado.'],
    ['Отброшен обрезанный пакет (','Truncated packet discarded (','חבילה קטועה נדחתה (','Paquete truncado descartado ('],
    ['Отброшен пакет с неверной сигнатурой magic.','Packet with invalid magic signature discarded.','חבילה עם חתימת magic שגויה נדחתה.','Paquete con firma magic incorrecta descartado.'],
    ['Несовместимая версия или флаги пакета (','Incompatible packet version or flags (','גרסת חבילה או דגלים לא תואמים (','Versión o indicadores de paquete incompatibles ('],
    ['Некорректное число сущностей в пакете:','Invalid entity count in packet:','מספר ישויות לא תקין בחבילה:','Número de entidades incorrecto en el paquete:'],
    ['Отброшен устаревший или дублирующийся кадр ','Stale or duplicate frame discarded ','פריים ישן או כפול נדחה ','Fotograma antiguo o duplicado descartado '],
    [' (последний=',' (last=',' (אחרון=',' (último='],
    ['Выход за границы буфера: заявлено ','Buffer bounds exceeded: declared ','חריגה מגבולות המאגר: הוצהרו ','Límites del búfer excedidos: declarados '],
    [' узлов (',' nodes (',' צמתים (',' nodos ('],
    [' Б), получено ',' B), received ',' B), התקבלו ',' B), recibidos '],
    ['Отброшен пакет с NaN/Infinity в узле #','Packet with NaN/Infinity discarded at node #','חבילה עם NaN/Infinity נדחתה בצומת #','Paquete con NaN/Infinity descartado en el nodo #'],
    ['Не удалось инициализировать 2D-контекст холста.','Could not initialize the 2D canvas context.','לא ניתן לאתחל את הקשר הציור הדו־ממדי.','No se pudo inicializar el contexto 2D del lienzo.'],
    [' байт < ',' bytes < ',' בתים < ',' bytes < '],
    [' Б.',' B.',' B.',' B.'],
    [' мс',' ms',' ms',' ms'],
];
logParts.forEach((words) => add(words[0], ...words));
// КОНЕЦ РАЗДЕЛА 3

// НАЧАЛО РАЗДЕЛА 4. ПУБЛИЧНЫЙ ВЫБОР ЯЗЫКА
let current: Locale = 'ru';
try {
    const saved = typeof window === 'undefined' ? null : window.localStorage?.getItem('universe-locale');
    if (LOCALES.includes(saved as Locale)) current = saved as Locale;
} catch { /* Ограниченное хранилище не мешает работе интерфейса. */ }
const listeners = new Set<(locale: Locale) => void>();
// НАЧАЛО ФУНКЦИИ getLocale
export function getLocale(): Locale { return current; }
// КОНЕЦ ФУНКЦИИ getLocale
// НАЧАЛО ФУНКЦИИ setLocale
export function setLocale(locale: Locale): void {
    if (!LOCALES.includes(locale) || locale === current) return;
    current = locale;
    try { if (typeof window !== 'undefined') window.localStorage?.setItem('universe-locale', locale); } catch { /* Выбор действует и без хранения. */ }
    [...listeners].forEach((listener) => listener(locale));
}
// КОНЕЦ ФУНКЦИИ setLocale
// НАЧАЛО ФУНКЦИИ subscribeLocale
export function subscribeLocale(listener: (locale: Locale) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
// КОНЕЦ ФУНКЦИИ subscribeLocale
// НАЧАЛО ФУНКЦИИ hasUiTranslation
export function hasUiTranslation(source: string): boolean { return entries.has(source.trim()); }
// КОНЕЦ ФУНКЦИИ hasUiTranslation
// НАЧАЛО ФУНКЦИИ translateUi
export function translateUi(source: string, locale: Locale = current): string {
    const key = source.trim();
    const words = entries.get(key);
    if (words) return source.slice(0, source.length - source.trimStart().length) + words[LOCALES.indexOf(locale)] + source.slice(source.trimEnd().length);
    const numberedPhase = /^(0[1-5]\.)(VOID|GENESIS|EVOLUTION|COLLAPSE|SINGULARITY)$/.exec(key);
    if (numberedPhase) return numberedPhase[1] + translateUi(numberedPhase[2], locale);
    if (key.startsWith('Пояснение: ')) return translateUi('Пояснение:', locale) + ' ' + key.slice(11);
    return source;
}
// КОНЕЦ ФУНКЦИИ translateUi
// НАЧАЛО ФУНКЦИИ translateLog
export function translateLog(source: string, locale: Locale = current): string {
    let text = source;
    const index = LOCALES.indexOf(locale);
    for (const words of [...phases, ...logParts]) text = text.split(words[0]).join(words[index]);
    return text;
}
// КОНЕЦ ФУНКЦИИ translateLog
// КОНЕЦ РАЗДЕЛА 4
