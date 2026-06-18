# FFmpeg Agent — VR180/VR360 Streaming Optimizer (Quest 2 / Quest 3)

Локальный AI-скилл для интеллектуальной оценки и пережатия VR-контента (**VR180 / VR360, 5.7K / 6K / 8K**) под стриминг через **XBVR / DeoVR** на **Oculus Quest 2 / Quest 3** по **WiFi 6** с использованием аппаратного кодирования на **NVIDIA RTX 3070 (CUDA / NVENC)**.

Ключевое отличие от простых «оптимизаторов размера»: агент самостоятельно рассчитывает **BPP (Bits Per Pixel Per Frame)** и передаёт его в Gemini, чтобы избежать деструктивного пережатия уже сжатых файлов или, наоборот, пропуска перекодирования сырых необработанных исходников.

## Стек

- **Node.js** — стандартные модули (`child_process`, `fs`, `path`).
- **@google/genai** — официальный SDK Gemini (`gemini-2.5-flash`).
- **ffmpeg / ffprobe** — предполагается глобально доступные в системе.

## Локация

```
src/skills/ffmpeg-agent/
├── index.js      # основной класс FfmpegAgent
├── test-run.js   # демо-скрипт с readline-подтверждением
└── README.md     # этот файл
```

## Архитектура — 3 этапа

### Stage 1: Scan Folder

Сканирует заданную папку, ищет видеофайлы (только `.mp4` по умолчанию; расширения настраиваются через `options.videoExts`).
Для каждого файла запускает `ffprobe -v error -show_format -show_streams -print_format json` и собирает полные метаданные.

Если `ffprobe` вернёт битый JSON или файл заблокирован — файл пропускается с предупреждением в консоль.

### Stage 2: Analyze & Estimate (цикл с подтверждением)

Для каждого файла:

1. **AI-анализ**. Метаданные отправляются в Gemini с жёстким системным промптом (`QUEST2_OPTIMIZATION_PROMPT`). Модель возвращает строгий JSON с `ffmpeg_args` (массив строк) и `rationale`.

2. **Тестовое пережатие** (5 секунд). Отрезок `00:10:00` → `+5s` перекодируется предложенными параметрами во временный файл. Замеряется реальное время обработки через `Date.now()`.

3. **Повторный ffprobe** выходного файла.

4. **AI-оценка качества** (`VR_QUALITY_ASSESSMENT_PROMPT`). Перед отправкой в Gemini Node.js самостоятельно рассчитывает **BPP** (Bits Per Pixel Per Frame) для входного файла и 5-секундного сэмпла. В промпт передаются JSON-метаданные и оба значения BPP. Модель возвращает вердикт:
    - `assessment`: `PASS` | `WARN` | `FAIL`
    - `streaming_score`: 0–100 (стабильность потока / битрейт)
    - `quality_score`: 0–100 (сохранение качества / BPP)
    - `compatibility_score`: 0–100 (совместимость с Quest 2 декодером)
    - `notes`: техническое пояснение
    - `recommended_changes`: конкретные правки ffmpeg или `['skip re-encode']`

5. **Экстраполяция времени**. `(testDurationMs / 1000) * (duration / 5)` — примерное время на весь файл.

**Цикл подтверждения**: после оценки пользователю предлагается три варианта:

- `y` — подтвердить, перейти к Stage 3
- `n` — отменить всё
- `r` — повторить Stage 2 с новым промптом (можно скорректировать требования)

### Stage 3: Execute Batch

Поочерёдная обработка подтверждённой очереди через `spawn('ffmpeg', args)`:

- Создаётся выходная директория (если отсутствует).
- Каждый файл кодируется с параметрами из Stage 2.
- `stderr` парсится в реальном времени: ищется `time=HH:MM:SS.mm`.
- Рассчитывается `% прогресса` от общей длительности файла.
- Результат и elapsed time сохраняются.

## BPP (Bits Per Pixel Per Frame)

Рассчитывается локально в Node.js **до** отправки в Gemini:

```
BPP = Bitrate / (Width × Height × FPS)
```

FPS парсится из ffprobe-строк вида `60/1` или `2997/100`. Битрейт берётся из видеопотока, а при отсутствии — из общего формата.

**Интерпретация BPP для VR180/VR360:**

| BPP | Смысл |
| --- | ----- |
| `< 0.035` | Видео уже сильно сжато. Перекодирование скорее всего уничтожит детали или раздует файл. Рекомендуется `skip re-encode`. |
| `0.040 – 0.070` | Золотая середина для высококачественного VR180. |
| `> 0.080` | Потенциальный оверкилл или необработанный сырой энкод. Хороший кандидат для оптимизации, особенно при 8K. |

## CUDA / RTX 3070 Оптимизации

Промпт жёстко требует от Gemini генерировать аргументы с учётом аппаратного кодирования:

| Параметр         | Требование                                         |
| ---------------- | -------------------------------------------------- |
| `-c:v`           | `h264_nvenc` (или `hevc_nvenc` если > 4096 px)     |
| `-preset`        | `p4` (качество) или `p5` (баланс) — Ampere оптимал |
| `-tune`          | `hq` (по умолчанию) или `ll` (low latency)         |
| `-profile:v`     | `high` для H.264                                   |
| `-rc`            | `vbr` с `-b:v`, `-maxrate`, `-bufsize`             |
| `-bf` / `-refs`  | `3` / `4` — стабильно для Quest 2                  |
| `-hwaccel cuda`  | перед `-i`, чтобы декод + фильтры шли на GPU       |
| `-vf scale_cuda` | если нужно скейлить — CUDA-ускоренный, а не CPU    |

**Запрещено**: `libx264`, `libx265`, `libsvtav1`, любое CPU-кодирование.

## Запуск

### 1. Подготовка

Убедитесь, что в системе доступны:

```bash
ffmpeg -version      # должен показывать nvenc / cuda support
ffprobe -version
```

Если `ffmpeg` не собран с `--enable-nvenc` — CUDA-кодирование не заработает. Нужен билд с поддержкой `h264_nvenc`.

### 2. Зависимости

Если переносите `ffmpeg-agent/` в другой проект:

```bash
cd ffmpeg-agent
npm init -y
npm install @google/genai
```

### 3. Запуск

Все параметры передаются через аргументы командной строки:

```bash
node test-run.js <input-dir> <output-dir> <gemini-api-key>
```

Пример:

```bash
node test-run.js ./videos ./out AIzaSy...
```

Поведение:

- Сканирует **только `.mp4`** (другие расширения игнорируются).
- Stage 1: автоматический скан
- Stage 2: AI-анализ → **тестовый отрезок с 10-й минуты, 5 секунд** → повторный ffprobe + расчёт BPP → AI-оценка с новыми скорингами → запрос подтверждения
- Stage 3: батч-обработка после `y`

### 4. Выход

Готовые файлы сохраняются в `<output-dir>/`.

## Структура очереди (queue item)

```js
{
  name: 'video.mp4',
  path: '/abs/path/to/video.mp4',
  ext: '.mp4',
  metadata: { /* ffprobe input */ },
  action: 'encode', // or 'skip'
  inputArgs: ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'],
  outputArgs: ['-c:v', 'hevc_nvenc', '-preset', 'p4', '-tune', 'hq', '-rc', 'vbr', '-cq', '20', '-maxrate', '35M', '-bufsize', '70M', '-bf', '3', '-refs', '4', '-c:a', 'copy', '-movflags', '+faststart'],
  rationale: 'HEVC NVENC p4, CQ20 Constrained VBR for 4K VR180 Quest 2',
  testSuccess: true,
  testDurationMs: 3400,
  outputProbe: { /* ffprobe output */ },
  assessment: { assessment: 'PASS', notes: '...' },
  estimatedSeconds: 120.5,
  duration: 2120
}
```

**Возможные статусы `assessment.assessment`:** `PASS`, `WARN`, `FAIL`, `SKIP`, `REGRESSION`.

## Изменение цели без редактирования кода

При `r` (retry) в консоли можно ввести новый промпт. Пример:

```
Enter new optimization prompt: Target is Pico 4 over 5GHz WiFi, prioritize low latency over quality. Use hevc_nvenc with -tune ll.
```

Агент применит его ко всем файлам и перезапустит Stage 2.

## Перенос в другой проект (standalone)

Скопируйте папку `ffmpeg-agent/` куда угодно. Внутри неё:

```bash
npm init -y
npm install @google/genai
```

`index.js` экспортирует `FfmpegAgent` и `VIDEO_EXTS`. Импортируйте как обычный модуль:

```js
const { FfmpegAgent } = require('./ffmpeg-agent');

const agent = new FfmpegAgent({
    apiKey: 'YOUR_KEY',
    model: 'gemini-2.5-flash',
    promptTemplate: '...your custom prompt...',
    videoExts: ['.mp4', '.mkv'], // default: ['.mp4']
    testOffsetMin: 5, // default: 10 (minutes)
});

const files = await agent.scanFolder('./videos');
const queue = await agent.analyzeAndEstimate(files);
const results = await agent.executeBatch(queue, './out');
```

Никаких внешних зависимостей кроме `@google/genai`.

## Ограничения

- Только «плоское» сканирование (не рекурсивное).
- Один GPU (RTX 3070), без `-gpu` выбора.
- Тестовый отрезок начинается с 10-й минуты (`-ss 00:10:00`), 5 секунд.
- Оценка качества зависит от корректности ответа Gemini; fallback на `hevc_nvenc` Constrained VBR при ошибке AI.
- Quest 2: аппаратный декод до ~8K@30fps HEVC или ~5.7K@60fps HEVC. 8K@60fps требует Quest 3 / AV1.

## Будущие планы / Roadmap

### 1. Интеграция с базой данных XBVR (SQL-выборка)

Конвейер автоматического поиска «тяжёлых» исходников для оптимизации:

#### SQL-запрос

```sql
SELECT filename, path, size
FROM files
WHERE size > 20000000000
ORDER BY size DESC
LIMIT 10;
```

| Параметр | Описание |
| -------- | -------- |
| `size > 20000000000` | ~20 GB — порог «тяжёлого» файла |
| `ORDER BY size DESC` | Приоритет самым большим |
| `LIMIT 10` | Размер пакета для одного прогона |

#### Логика конвейера

1. **SQL-выборка**: Node.js подключается к SQLite XBVR (`xbvr.db`) и получает список кандидатов.
2. **Предварительная проверка**: Для каждого файла запускается `ffprobe` для сбора актуальных метаданных (разрешение, FPS, кодек, битрейт).
3. **Фильтрация по BPP**: Если `inputBPP < 0.035` — файл уже сильно сжат, исключается из очереди.
4. **Идемпотентность**: Перед добавлением в очередь скрипт проверяет существование `*_encoded.mp4` рядом с оригиналом. Если оптимизированная копия уже есть — файл автоматически пропускается, чтобы база не крутила его по кругу.

```js
// Псевдокод защиты от повторной обработки
const encodedPath = file.path.replace('.mp4', '_encoded.mp4');
if (fs.existsSync(encodedPath)) {
    console.log(`[skip] ${file.name} — already encoded.`);
    continue;
}
```

### 2. Интерактивная UI-панель управления в Udesk

Веб-интерфейс, который исключает «слепую» автоматизацию и оставляет контроль за инженером.

#### Панель конфигурации (верх)

| Элемент | Описание |
| ------- | -------- |
| **System Prompts** | Два `textarea` с живым редактированием `QUEST2_OPTIMIZATION_PROMPT` и `VR_QUALITY_ASSESSMENT_PROMPT`. Изменения применяются к следующему вызову Gemini без перезагрузки сервера. |
| **Фильтры** | `input[type="number"]` для минимального размера файла (GB) и лимита выборки `LIMIT`. |
| **«Найти кандидатов»** | Кнопка, запускающая SQL-запрос к XBVR и первичный `ffprobe`-парсинг метаданных. |

#### Интерактивная очередь задач (центр)

| Колонка | Действие |
| ------- | -------- |
| **Файл** | Имя, размер, исходное разрешение, input BPP |
| **Тест** | Кнопка запускает 5-секундный сэмпл → Gemini-оценку. Результат: `PASS`/`WARN`/`FAIL`, итоговый битрейт, расчётный BPP |
| **Input Args** | Редактируемый `<input>` с флагами FFmpeg **до** `-i` (например, `-hwaccel cuda`) |
| **Output Args** | Редактируемый `<input>` с флагами FFmpeg **после** `-i` (кодек, битрейт, фильтры) |
| **Rationale** | Однострочное пояснение от Gemini (read-only) |

Инженер может вручную поправить любой флаг перед запуском боевого кодирования.

#### Мониторинг кодирования (низ)

| Элемент | Реализация |
| ------- | ---------- |
| **«Старт пула»** | Кнопка запуска очереди с подтверждёнными задачами |
| **Прогресс-бар** | Бэкенд парсит `stderr` FFmpeg (`time=HH:MM:SS.mm`), шлёт SSE/WebSocket-сообщение `{"file":"...","percent":42.3,"currentTime":127.5}` |
| **ETA** | Расчётное время из `estimatedSeconds` с live-обновлением |
| **Лог** | Scrollable консоль с raw-выводом ffmpeg для отладки |

**Технический стек UI**: React + TailwindCSS (или shadcn/ui), SSE для real-time прогресса, REST API-обёртка вокруг `FfmpegAgent`.
