const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const VIDEO_EXTS = ['.mp4'];

// ── Paste your key here (temporary hardcoded) ───────────────
const GEMINI_API_KEY = '';

// ── Prompt: optimize for Oculus Quest 2 / Quest 3 VR180/VR360 streaming over WiFi 6 ─
const QUEST2_OPTIMIZATION_PROMPT = `
You are a VR video streaming engineer specializing in VR180/VR360 content for Oculus Quest 2 / Quest 3 via XBVR and DeoVR over WiFi 6.
The host machine runs Windows/Linux with an NVIDIA RTX 3070 GPU (Ampere). Always prefer GPU hardware encoding (nvenc).

Analyze the source video metadata and determine if it needs re-encoding ("action": "encode") or should be skipped ("action": "skip").

RESTORATION RULES (override any conflicting rules below):
1. Evaluate the supplied source image thoroughly for ALL potential improvements. Be comprehensive: if the video has compression blocks/grid, unnatural color cast, noise or flat washed-out contrast, flag them honestly and do not hide minor defects. Inspect noise specifically in shadow areas and low-detail regions (sky, dark clothing, background) — a single frame can hide heavy grain. Low BPP alone is NEVER a reason to skip restoration. Increased bitrate or size is allowed when restoration benefits quality.
2. For low-resolution SBS VR180 (height <= 1920), restore and upscale to 4800x2400. For height >= 4096 or width > 6144, downscale to fit 6144x3072 at <= 60 fps HEVC. Preserve aspect ratio and stereo layout; never stretch non-2:1 content and NEVER crop the frame — VR180 does not tolerate cropping.
3. Restoration flags map to filters: remove_grid enables spp+hqdn3d degrid/denoise, remove_noise enables standalone hqdn3d denoising, color_correct enables colortemperature=7500 (yellow cast only), adjust_contrast enables a mild eq boost. correct_geometry or projection_type=fisheye enables v360 reprojection, interlaced enables deinterlacing, swap_lr swaps the SBS eye order. The full variant also applies unsharp sharpening; the pure variant stays entirely on the GPU.
4. With CUDA decoded frames, CPU filters require hwdownload,format=nv12 (p010le for 10-bit),format=yuv420p first. After CPU filters ALWAYS use format=yuv420p,hwupload_cuda,scale_cuda=W:H:format=nv12:interp_algo=bicubic. This prevents rgb0 -> semiplanar8 failures.
5. Always return action=encode if there is any improvement potential: AVC grid removal, denoising, yellow cast correction, luminance/contrast correction, low-resolution upscale to 2400p, or downscale for Quest 2.
6. Return action=skip ONLY when the original image is visually clean (no AVC grid, noise or yellow cast), has no improvement potential AND uses HEVC/H.264 with dimensions <=6144x3072 and fps <=60. Unknown metadata or visual uncertainty is NOT permission to skip.
7. Return source_clean=true ONLY when the supplied source image confirms all visual cleanliness criteria. Otherwise return false. Return visual decisions as restoration flags: {"remove_grid": boolean, "remove_noise": boolean, "color_correct": boolean, "adjust_contrast": boolean, "correct_geometry": boolean, "interlaced": boolean, "swap_lr": boolean, "projection_type": "equirectangular"|"fisheye"}.
   - remove_grid=true STRICTLY AND EXCLUSIVELY for a visible blocky AVC macroblock compression grid. If the video is HEVC, 4K/8K, or clean, remove_grid MUST always be false.
   - remove_noise=true for visible digital noise/grain, especially in shadows and low-detail areas. Independent of remove_grid — a file can be noisy without any grid.
   - color_correct=true STRICTLY AND EXCLUSIVELY for a pronounced, unnatural yellow/green cast (e.g., cheap indoor lighting). If the colors look natural, neutral, or cinematic, color_correct MUST be false.
   - adjust_contrast=true whenever luminance is flat, washed-out, or needs enhancement (especially for upscaled or low-contrast sources).
   - correct_geometry=true if the file has a projection mismatch, needs fisheye-to-equirectangular conversion, shows vertical eye-alignment errors, or is geometrically distorted/stretched. Set projection_type="fisheye" for raw fisheye/dual-fisheye lenses (visible circular/hemispherical images).
   - interlaced=true for comb artifacts / interlaced scan lines.
   - swap_lr=true only when the SBS eye order is clearly wrong (impossible/inverted parallax — nearer objects rendered behind farther ones in stereopsis). If uncertain, keep false.
   Default all flags to false for clean sources, but flag every defect you can actually see. The application enforces safe profiles and always produces both a pure-GPU variant and a full-restoration variant.
   The METADATA may include stream side data such as rotation; a rotated VR frame is non-standard — flag correct_geometry in that case.

ENCODING & RATE CONTROL RULES (If action is "encode"):
1. Playback must be smooth — zero re-buffering on Quest 2. Preferred codec: HEVC (mandatory for >4K).
2. DO NOT force fixed, overly high bitrates if the source video has low complexity. Instead of strict high-floor VBR, prefer a flexible Constrained Quality (CQ) mode or smart VBR to prevent size bloating.
3. For hevc_nvenc, you can use: "-c:v", "hevc_nvenc", "-rc", "vbr", "-cq", "20", "-maxrate", "MAX_CAP", "-bufsize", "BUF_CAP".
   - Hard upper caps for maxrate/bufsize based on target resolutions:
     * 6K (6144x3072) @ 60fps: -maxrate 72M -bufsize 120M (Target average ~35M-60M depending on complexity)
     * 5.7K (5760x2880) @ 60fps: -maxrate 60M -bufsize 100M
     * 4K (3840x1920) @ 60fps: -maxrate 35M -bufsize 70M
4. Audio: AAC stereo, keep original sample rate. Use -c:a copy if source is already AAC.
5. For network streaming add -movflags +faststart.
6. Use NVENC preset: p4 (quality) or p5 (balanced), -tune hq, -bf 3 -refs 4.
7. CUDA Scaling: after CPU restoration use format=yuv420p,hwupload_cuda,scale_cuda=W:H:format=nv12:interp_algo=bicubic; never upload rgb0 frames.

CRITICAL ARGUMENT RULES:
- "input_args" MUST contain ONLY input-side global flags like "-hwaccel" / "-hwaccel_output_format".
- NEVER put "-i" or any input filename inside "input_args". The harness injects the input file itself.
- Put all encoding/filter/output flags (including -vf) into "output_args".

CRITICAL TOKEN CAP: Keep the 'rationale' field strictly under 1-2 concise sentences. Do not write long text blocks or explanations. Be as brief as possible.

RESPONSE LANGUAGE: Russian. JSON keys must remain in English, but all text values (rationale) must be written in Russian.

Return ONLY a valid JSON object with no markdown formatting or backticks.
Strict Output Format:
{
  "action": "encode",
  "source_clean": false,
  "restoration": {"remove_grid": true, "remove_noise": false, "color_correct": true, "adjust_contrast": false, "correct_geometry": false, "interlaced": false, "swap_lr": false, "projection_type": "equirectangular"},
  "rationale": "Кратко объясните визуальные дефекты и необходимость реставрации; разрешение и параметры задает приложение."
}
`.trim();

// ── Prompt: assess 5-second test encode output ──────────────
const VR_QUALITY_ASSESSMENT_PROMPT = `
You are an expert VR video encoding engineer specializing in high-resolution VR180/VR360 content playback on Oculus Quest 2 / Quest 3 via XBVR and DeoVR streaming over WiFi 6.
Your core mission is NOT to simply minimize file size, but to find the perfect technical balance between maximum visual fidelity, decoder stability, and smooth local network streaming.

VISUAL RESTORATION ASSESSMENT (override conflicting size rules below):
Compare the labelled BEFORE and AFTER images from the same timestamp alongside metadata.
Inspect residual AVC grid, noise (check shadows and low-detail areas), yellow cast/white balance, luminance/contrast, detail retention, oversharpening halos, stereo geometry and projection correctness.
The chain may use spp, hqdn3d, colortemperature=7500, eq, unsharp, v360 fisheye→equirectangular reprojection, yadif deinterlacing, stereo3d eye-swap and CUDA scaling. Verify the AFTER frame is not cropped and geometry/projection looks correct — VR180 does not tolerate cropping or wrong eye order.
4800x2400 upscale for low-resolution SBS VR180 and downscale of 4096p+/8K to fit 6144x3072 <=60 fps are intentional.
Increased bitrate/file size is NOT a regression when restoring artifacts or upscaling. BPP is contextual, not a skip threshold.
Always recommend action=encode if the ORIGINAL has improvement potential (grid removal, denoising, color normalization, low-resolution upscale to 2400p) or requires downscale for Quest 2. An improved AFTER image does not make the ORIGINAL eligible for skipping.
Return action=skip ONLY if the ORIGINAL is visually clean (no AVC grid, noise or yellow cast), has no improvement potential AND is HEVC/H.264 with dimensions <=6144x3072 at <=60fps. Never skip for uncertainty or low BPP.
PASS means acceptable visual quality and decoder compatibility. WARN means non-critical remarks, residual artifacts, uncertainty or additional improvement potential: encoding is STILL recommended, and the task MUST remain in the queue.
FAIL is reserved exclusively for critical inability to encode/analyze the video (unreadable file or corrupt video stream), NOT minor visual issues, bitrate growth or a recoverable model-service error. Never invent successful correction.
Return ONLY {"action":"encode"|"skip", "status":"PASS"|"WARN"|"FAIL", "grid_removed":boolean, "color_corrected":boolean, "notes":"Краткая оценка сетки, шума, цвета, яркости/контраста и резкости"}.
The status object above is mandatory; all conclusions must be grounded in the images.

Evaluation Criteria:
1. Decoder Compatibility (Quest 2 Hardware Limits):
   - Original codec outside HEVC/H.264 requires encoding, not automatic FAIL. The target profile is HEVC.
   - Quest 2 queue policy: dimensions <=6144x3072 and <=60fps. Any original exceeding these limits requires encoding, even when the image is clean. Flag output non-compliance for review.
2. Resolution & Bitrate Synergy:
   - Do not apply flat-video rules (like 15-40 Mbps limits).
   - For 6K (6144x3072) or 5.7K, a bitrate of 40-75 Mbps is completely normal and preferred for streaming over Wi-Fi 6 to retain VR immersion.
   - Only flag bitrate as "TOO HIGH" if it risks triggering network buffering (>90-100 Mbps sustained over WiFi 6) or if BPP shows diminishing returns.
3. Quality Retention vs. Bloat:
   - Compare INPUT BPP and OUTPUT BPP. If OUTPUT size/bitrate increased but resolution stayed the same, diagnose WHY (e.g., encoder fighting high-frequency noise/grain, or too low CRF/qp setting).
   - Increased size alone is not a regression. Judge restoration by the paired images and decoder compliance.

CRITICAL TOKEN CAP: Keep the 'notes' field strictly under 1-2 concise sentences. Do not write long text blocks or explanations. Be as brief as possible.

RESPONSE LANGUAGE: Russian. JSON keys must remain in English, but all text values (notes) must be written in Russian.

Return ONLY a valid JSON object. Do not include markdown formatting or backticks.
{
  "action": "encode",
  "status": "PASS",
  "grid_removed": true,
  "color_corrected": true,
  "notes": "Краткая техническая и визуальная оценка результата."
}
`.trim();

class FfmpegAgent {
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || GEMINI_API_KEY;
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY is not configured. Set the environment variable or pass options.apiKey.');
        }
        this.genai = new GoogleGenAI({ apiKey: this.apiKey });
        this.model = options.model || 'gemini-2.5-flash';
        this.promptTemplate = options.promptTemplate || QUEST2_OPTIMIZATION_PROMPT;
        this.videoExts = options.videoExts || VIDEO_EXTS;
        this.testOffsetMin = options.testOffsetMin ?? null;
        this.sampleOffset = options.sampleOffset ?? null;
    }

    /**
     * Stage 1: Scan folder for video files and collect ffprobe metadata.
     * @param {string} inputPath
     * @returns {Promise<Array<{name:string, path:string, ext:string, metadata:object}>>}
     */
    async scanFolder(inputPath) {
        const resolved = path.resolve(inputPath);
        if (!fs.existsSync(resolved)) {
            throw new Error(`Path not found: ${resolved}`);
        }
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory() && !stat.isFile()) {
            throw new Error(`Path is not a file or directory: ${resolved}`);
        }

        const sourceDir = stat.isDirectory() ? resolved : path.dirname(resolved);
        const entries = stat.isDirectory() ? fs.readdirSync(resolved) : [path.basename(resolved)];
        const files = [];
        for (const entry of entries) {
            const ext = path.extname(entry).toLowerCase();
            if (!this.videoExts.includes(ext)) continue;

            const fullPath = path.join(sourceDir, entry);
            const entryStat = fs.statSync(fullPath);
            if (!entryStat.isFile()) continue;

            try {
                const probe = await this._runFfprobe(fullPath);
                files.push({ name: entry, path: fullPath, ext, metadata: probe });
            } catch (err) {
                console.warn(`[scan] skipping "${entry}": ${err.message}`);
            }
        }
        return files;
    }

    /**
     * Stage 2: Analyze with AI, test-encode 5 s, re-probe output,
     *          assess quality, estimate full-batch time.
     * @param {Array} files - result from scanFolder
     * @param {Function} onProgress - optional callback({stage, current, total, file, ...})
     * @returns {Promise<Array>} queue items with ffmpegArgs, rationale, assessment, estimatedSeconds, etc.
     */
    async analyzeAndEstimate(files, onProgress = () => {}) {
        const queue = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            onProgress({ stage: 'analyze', current: i + 1, total: files.length, file: file.name });

            const duration = parseFloat(file.metadata.format?.duration || '0');
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-agent-'));
            try {
            const before = path.join(tempDir, 'before.webp');
            const after = path.join(tempDir, 'after.webp');
            const offset = this._sampleOffset(duration);
            let sourceImage = null;
            try {
                await this._captureScreenshot(file.path, offset, before);
                sourceImage = this._imagePart(before);
            } catch (err) {
                console.warn(`[capture] ${file.name}: ${err.message}`);
            }

            // ── 2a. Ask Gemini for encoding args ───────────────────
            let action = 'encode';
            let inputArgs;
            let outputArgs;
            let pureCudaArgs;
            let fullRestoredArgs;
            let safeInputArgs;
            let safeOutputArgs;
            let safePureCudaArgs;
            let safeFullRestoredArgs;
            let usedCpuFallback = false;
            let rationale;
            try {
                const prompt = this._buildPrompt(file);
                const response = await this.genai.models.generateContent({
                    model: this.model,
                    contents: [{ role: 'user', parts: [{ text: prompt }, ...(sourceImage ? [sourceImage] : [])] }],
                    config: {
                        responseMimeType: 'application/json',
                        maxOutputTokens: 1024,
                        thinkingConfig: { thinkingBudget: 0 },
                    },
                });
                const text = response?.text;
                const finishReason = response?.candidates?.[0]?.finishReason;
                if (finishReason && finishReason !== 'STOP') {
                    console.warn(`[analyze] Gemini finishReason=${finishReason} (response may be truncated)`);
                }
                if (!text) {
                    const blockReason = response?.promptFeedback?.blockReason;
                    throw this._geminiError(`Empty response from Gemini${blockReason ? ` (prompt blocked: ${blockReason})` : ''}`, blockReason);
                }
                const parsed = this._extractJson(text);
                console.warn(`[analyze] "${file.name}" AI flags: ${JSON.stringify(parsed.restoration || {})} source_clean=${parsed.source_clean}`);
                action = parsed.action === 'skip' ? 'skip' : 'encode';
                const profile = this._restorationProfile(file.metadata, parsed.restoration);
                inputArgs = profile.input_args;
                outputArgs = profile.output_args;
                pureCudaArgs = profile.pure_cuda_output_args;
                fullRestoredArgs = profile.full_restored_output_args;
                const flagged = parsed.restoration && Object.entries(parsed.restoration)
                    .some(([key, value]) => key !== 'projection_type' ? value === true : value === 'fisheye');
                if (profile.mandatory || !sourceImage || parsed.source_clean !== true || flagged) action = 'encode';
                rationale = typeof parsed.rationale === 'string' ? parsed.rationale : 'Реставрация и масштабирование под Quest 2.';
                if (action === 'encode' && (!Array.isArray(inputArgs) || !Array.isArray(outputArgs))) {
                    throw new Error('input_args or output_args is not an array');
                }
                // Primary args stay on the GPU; CPU-safe variants are kept as fallback
                ({ inputArgs: safeInputArgs, outputArgs: safeOutputArgs } = this._ensureMemorySafeArgs(file, inputArgs, outputArgs));
                safePureCudaArgs = this._ensureMemorySafeArgs(file, [], pureCudaArgs).outputArgs;
                safeFullRestoredArgs = this._ensureMemorySafeArgs(file, [], fullRestoredArgs).outputArgs;
            } catch (err) {
                if (err.geminiBlocked) throw err;
                console.warn(`[analyze] AI failed for "${file.name}": ${err.message}`);
                action = 'encode';
                const profile = this._restorationProfile(file.metadata);
                inputArgs = profile.input_args;
                outputArgs = profile.output_args;
                pureCudaArgs = profile.pure_cuda_output_args;
                fullRestoredArgs = profile.full_restored_output_args;
                rationale = 'Резервный профиль реставрации Quest 2: spp, hqdn3d, cas и безопасное разрешение; требуется визуальная проверка.';
                ({ inputArgs: safeInputArgs, outputArgs: safeOutputArgs } = this._ensureMemorySafeArgs(file, inputArgs, outputArgs));
                safePureCudaArgs = this._ensureMemorySafeArgs(file, [], pureCudaArgs).outputArgs;
                safeFullRestoredArgs = this._ensureMemorySafeArgs(file, [], fullRestoredArgs).outputArgs;
            }

            let testSuccess = false;
            let sampleValidated = false;
            const testStart = Date.now();
            let encodeDurationMs = 0;
            let outputProbe = null;
            let assessment = null;
            let inputBPP = null;
            let outputBPP = null;

            if (action === 'skip') {
                // No GPU resources wasted on already-optimal files
                assessment = { status: 'SKIP', grid_removed: false, color_corrected: false, notes: rationale || 'Реставрация не требуется.' };
            } else {
                // ── 2b. Test encode: 5-second sample ───────────────────
                const tempOutput = path.join(tempDir, 'sample.mp4');
                const offsetStr = String(offset);
                const buildTestArgs = (inArgs, outArgs) => [...inArgs, '-ss', offsetStr, '-i', file.path, '-t', '5', ...outArgs, '-y', tempOutput];
                const testArgs = buildTestArgs(inputArgs, outputArgs);
                console.log(`[ffmpeg] test command: ffmpeg ${testArgs.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);

                try {
                    try {
                        await this._runFfmpeg(testArgs);
                    } catch (gpuErr) {
                        // Retry once with the CPU-safe variant (e.g. 8K OOM on small GPUs)
                        const cpuArgs = buildTestArgs(safeInputArgs, safeOutputArgs);
                        if (cpuArgs.join(' ') === testArgs.join(' ')) throw gpuErr;
                        console.warn(`[ffmpeg] GPU test failed for "${file.name}" (${gpuErr.message.split('\n')[0]}), retrying CPU-safe variant`);
                        console.log(`[ffmpeg] fallback command: ffmpeg ${cpuArgs.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);
                        await this._runFfmpeg(cpuArgs);
                        usedCpuFallback = true;
                    }
                    encodeDurationMs = Date.now() - testStart;
                    testSuccess = true;

                    // Re-probe output
                    outputProbe = await this._runFfprobe(tempOutput);
                    const outputVideo = outputProbe.streams?.find(stream => stream.codec_type === 'video');
                    const outputFps = this._parseFps(outputVideo?.avg_frame_rate || outputVideo?.r_frame_rate || '');
                    if (!outputVideo || outputVideo.codec_name !== 'hevc' || !(outputVideo.width > 0 && outputVideo.width <= 6144)
                        || !(outputVideo.height > 0 && outputVideo.height <= 3072) || !(outputFps > 0 && outputFps <= 60)) {
                        throw new Error('Тестовый результат не соответствует профилю HEVC Quest 2 (6144x3072, <=60 fps)');
                    }

                    sampleValidated = true;

                    // Calculate BPP for both input and output
                    inputBPP = this._calculateBPP(file.metadata);
                    outputBPP = this._calculateBPP(outputProbe);

                    // Ask AI to assess output quality
                    if (!sourceImage) throw new Error('Нет исходного скриншота для визуального сравнения');
                    await this._captureScreenshot(tempOutput, 0, after);
                    const assessPrompt = this._buildAssessmentPrompt(file, outputProbe, inputBPP, outputBPP);
                    const assessResponse = await this.genai.models.generateContent({
                        model: this.model,
                        contents: [{ role: 'user', parts: [
                            { text: assessPrompt }, { text: 'BEFORE — original frame' }, sourceImage,
                            { text: 'AFTER — first frame of encoded sample at the same source timestamp' }, this._imagePart(after),
                        ] }],
                        config: {
                            responseMimeType: 'application/json',
                            maxOutputTokens: 512,
                            thinkingConfig: { thinkingBudget: 0 },
                        },
                    });
                    const assessText = assessResponse?.text;
                    if (!assessText) {
                        const blockReason = assessResponse?.promptFeedback?.blockReason;
                        throw this._geminiError(`Empty assessment response from Gemini${blockReason ? ` (prompt blocked: ${blockReason})` : ''}`, blockReason);
                    }
                    if (assessText) {
                        assessment = this._normalizeAssessment(this._extractJson(assessText));
                    }
                } catch (err) {
                    if (err.geminiBlocked) throw err;
                    assessment = { status: sampleValidated ? 'WARN' : 'FAIL', grid_removed: false, color_corrected: false, notes: err.message };
                    console.warn(`[analyze] test/assessment failed for "${file.name}": ${err.message}`);
                }

                // Cleanup temp
                try {
                    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                } catch {
                    /* ignore cleanup errors */
                }
            }
            assessment = assessment || { status: 'WARN', grid_removed: false, color_corrected: false, notes: 'Визуальная оценка не получена.' };
            const testDurationMs = Date.now() - testStart;

            // ── 2c. Extrapolate total time ─────────────────────────
            let estimatedSeconds = 0;
            if (testSuccess && duration > 0) {
                estimatedSeconds = (encodeDurationMs / 1000) * (duration / Math.min(5, duration - offset));
                // NVENC stabilizes ~10-30% faster on long runs; scale down estimate
                estimatedSeconds = estimatedSeconds * 0.8;
            }

            queue.push({
                ...file,
                action,
                inputArgs,
                outputArgs,
                pureCudaArgs,
                fullRestoredArgs,
                safeInputArgs,
                safeOutputArgs,
                safePureCudaArgs,
                safeFullRestoredArgs,
                usedCpuFallback,
                rationale,
                testSuccess,
                testDurationMs,
                outputProbe,
                assessment,
                estimatedSeconds,
                duration,
            });

            onProgress({
                stage: 'estimate',
                current: i + 1,
                total: files.length,
                file: file.name,
                estimatedSeconds,
                assessment,
            });
            } catch (err) {
                if (err.geminiBlocked) throw err;
                const assessment = { status: 'FAIL', grid_removed: false, color_corrected: false, notes: err.message };
                queue.push({ ...file, action: 'encode', testSuccess: false, assessment });
                onProgress({ stage: 'estimate', current: i + 1, total: files.length, file: file.name, estimatedSeconds: 0, assessment });
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
        return queue;
    }

    /**
     * Stage 3: Generate queue tasks without running final encoding.
     * @param {Array} queue - result from analyzeAndEstimate
     * @param {string} outputPath - destination directory
     * @param {Function} onProgress - optional callback({stage, current, total, file, progressPercent, ...})
     * @returns {Promise<Array<{file_name:string, action:string, target_resolution:string, input_args:string[], pure_cuda:object, full_restored:object, rationale:string, assessment:object}>>}
     */
    async executeBatch(queue, outputPath, onProgress = () => {}) {
        const results = [];
        for (let i = 0; i < queue.length; i++) {
            const task = queue[i];

            // Generate commands for PASS/WARN candidates; exclude explicit skips and critical failures
            const verdict = task.assessment?.status;
            if (task.action === 'skip' || verdict === 'FAIL') continue;

            const baseName = path.basename(task.name, task.ext);
            const targetDir = outputPath ? path.resolve(outputPath) : path.dirname(task.path);
            const pureOutputFile = path.join(targetDir, `${baseName}_pure_cuda.mp4`);
            const fullOutputFile = path.join(targetDir, `${baseName}_restored.mp4`);

            const pureOutputArgs = task.pureCudaArgs || task.outputArgs;
            const fullRestoredArgs = task.fullRestoredArgs || task.outputArgs;
            const filter = fullRestoredArgs[fullRestoredArgs.indexOf('-vf') + 1];
            const resolution = filter.match(/scale(?:_cuda)?=(\d+):(\d+)/);
            if (!resolution) throw new Error('Missing target resolution');

            const pureArgsList = [...task.inputArgs, '-i', task.path, ...pureOutputArgs, pureOutputFile];
            const fullArgsList = [...task.inputArgs, '-i', task.path, ...fullRestoredArgs, fullOutputFile];
            // CPU-safe fallback commands for 8K sources that may OOM on the GPU path
            const safeInput = task.safeInputArgs || task.inputArgs;
            const pureFallbackList = [...safeInput, '-i', task.path, ...(task.safePureCudaArgs || pureOutputArgs), pureOutputFile];
            const fullFallbackList = [...safeInput, '-i', task.path, ...(task.safeFullRestoredArgs || fullRestoredArgs), fullOutputFile];
            const pureCommand = `ffmpeg ${pureArgsList.map(arg => this._quoteArgument(arg)).join(' ')}`;
            const fullCommand = `ffmpeg ${fullArgsList.map(arg => this._quoteArgument(arg)).join(' ')}`;
            const pureFallback = `ffmpeg ${pureFallbackList.map(arg => this._quoteArgument(arg)).join(' ')}`;
            const fullFallback = `ffmpeg ${fullFallbackList.map(arg => this._quoteArgument(arg)).join(' ')}`;
            results.push({
                file_name: task.name,
                action: 'encode',
                target_resolution: `${resolution[1]}:${resolution[2]}`,
                input_args: [...task.inputArgs],
                cpu_fallback: task.usedCpuFallback === true,
                pure_cuda: {
                    output_file: pureOutputFile,
                    output_args: [...pureOutputArgs],
                    full_command: pureCommand,
                    ...(pureFallback !== pureCommand ? { fallback_command: pureFallback } : {}),
                },
                full_restored: {
                    output_file: fullOutputFile,
                    output_args: [...fullRestoredArgs],
                    full_command: fullCommand,
                    ...(fullFallback !== fullCommand ? { fallback_command: fullFallback } : {}),
                },
                rationale: task.rationale || 'Реставрация и масштабирование под Quest 2.',
                assessment: this._normalizeAssessment({ ...task.assessment, status: verdict === 'PASS' ? 'PASS' : 'WARN' }),
            });
            onProgress({ stage: 'task-generated', current: i + 1, total: queue.length, file: task.name });
        }
        return results;
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                            */
    /* ------------------------------------------------------------------ */

    _restorationProfile(metadata, restoration = {}) {
        const video = metadata.streams?.find(stream => stream.codec_type === 'video');
        if (!video?.width || !video?.height) throw new Error('Video dimensions are missing');
        const sourceRate = this._parseFps(video.avg_frame_rate || '') > 0 ? video.avg_frame_rate : video.r_frame_rate;
        const fps = this._parseFps(sourceRate || '');
        // Тиры контента: 8K-даунскейл (GPU only), все файлы до 3072p — CPU по флагам или авто для <=2400p
        const isOversized = video.width > 6144 || video.height > 3072;
        const isUpTo3072 = !isOversized;

        let width, height;
        if (video.height <= 1920) {
            width = 4800;
            height = 2400;
        } else if (isOversized) {
            width = 6144;
            height = 3072;
        } else {
            width = video.width;
            height = video.height;
        }

        const removeGrid = restoration.remove_grid === true;
        const removeNoise = restoration.remove_noise === true;
        const colorCorrect = restoration.color_correct === true;
        const adjustContrast = restoration.adjust_contrast === true;
        const correctGeometry = restoration.correct_geometry === true;
        const isFisheye = restoration.projection_type === 'fisheye';
        const interlaced = restoration.interlaced === true;
        const swapLr = restoration.swap_lr === true;

        // Чистый CUDA-профиль: только GPU-скейлинг, без CPU-фильтров.
        // Чересстрочный исходник деинтерлейсится на GPU через yadif_cuda.
        const pureCudaFilters = interlaced && isUpTo3072
            ? ['yadif_cuda=mode=1', `scale_cuda=${width}:${height}:format=nv12:interp_algo=bicubic`]
            : [`scale_cuda=${width}:${height}:format=nv12:interp_algo=bicubic`];

        // Полный профиль: CPU-реставрация по флагам + шарпенинг, затем загрузка на GPU.
        // Oversized-источники (>3072p) остаются на GPU: CPU-путь на них слишком тяжёлый.
        const fullFilters = [...pureCudaFilters];
        if (isUpTo3072) {
            fullFilters.length = 0;
            fullFilters.push('hwdownload',
                `format=${/10|12|p010|p016/.test(video.pix_fmt || '') ? 'p010le' : 'nv12'}`,
                'format=yuv420p');
            // Деинтерлейс и перепроекция идут первыми — до любой очистки
            if (interlaced) fullFilters.push('yadif=mode=1');
            if (isFisheye || correctGeometry) {
                fullFilters.push('v360=input=fisheye:output=equirectangular:ih_fov=180:iv_fov=180');
            }
            if (swapLr) fullFilters.push('stereo3d=sbsl:sbsr');
            if (removeGrid) fullFilters.push('spp=4:0:1', 'hqdn3d=1:1:1:1');
            else if (removeNoise) fullFilters.push('hqdn3d=3:2:6:4.5');
            if (colorCorrect) fullFilters.push('colortemperature=temperature=7500');
            if (adjustContrast || video.height <= 2400) {
                fullFilters.push('eq=contrast=1.03:brightness=0.01');
            }
            fullFilters.push('unsharp=5:5:1.6:5:5:0', 'format=yuv420p', 'hwupload_cuda',
                `scale_cuda=${width}:${height}:format=nv12:interp_algo=bicubic`);
        }

        const rate = fps > 60 ? '60' : fps > 0 ? sourceRate : '30';
        const baseOutputArgs = ['-fps_mode', 'cfr', '-r', rate,
            '-c:v', 'hevc_nvenc', '-preset', 'p4', '-tune', 'hq', '-rc', 'vbr',
            '-b:v', width > 4800 ? '40M' : '30M', '-maxrate', width > 4800 ? '60M' : '45M',
            '-bufsize', width > 4800 ? '100M' : '60M', '-tag:v', 'hvc1',
            '-c:a', 'copy', '-movflags', '+faststart'];

        return {
            mandatory: video.height <= 1920 || isOversized || isFisheye || correctGeometry || swapLr || interlaced
                || !Number.isFinite(fps) || fps <= 0 || fps > 60 || video.codec_name !== 'hevc',
            input_args: ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'],
            pure_cuda_output_args: ['-vf', pureCudaFilters.join(','), ...baseOutputArgs],
            full_restored_output_args: ['-vf', fullFilters.join(','), ...baseOutputArgs],
            // Тестовый образец оценивает качество полной реставрации
            output_args: ['-vf', fullFilters.join(','), ...baseOutputArgs],
        };
    }

    _geminiError(message, blockReason) {
        const err = new Error(message);
        if (blockReason) err.geminiBlocked = true;
        return err;
    }

    _sampleOffset(duration) {
        if (!Number.isFinite(duration) || duration <= 0) return 0;
        const latest = Math.max(0, duration - 5);
        if (this.sampleOffset !== null) return Math.min(latest, Math.max(0, this.sampleOffset));
        if (this.testOffsetMin !== null) return Math.min(latest, Math.max(0, this.testOffsetMin * 60));
        const start = Math.min(latest, Math.max(60, duration * 0.35));
        const end = Math.min(latest, Math.max(start, duration * 0.65));
        return Math.floor(start + Math.random() * (end - start));
    }

    async _captureScreenshot(input, offset, output) {
        await this._runFfmpeg(['-ss', String(offset), '-i', input, '-map', '0:v:0',
            '-vframes', '1', '-c:v', 'libwebp', '-lossless', '1', '-y', output]);
    }

    _imagePart(file) {
        const mimeTypes = { '.png': 'image/png', '.webp': 'image/webp' };
        return { inlineData: { mimeType: mimeTypes[path.extname(file).toLowerCase()] || 'image/jpeg', data: fs.readFileSync(file).toString('base64') } };
    }

    _normalizeAssessment(value) {
        const status = ['PASS', 'WARN', 'FAIL', 'SKIP'].includes(value?.status) ? value.status : 'WARN';
        return { status, grid_removed: value?.grid_removed === true,
            color_corrected: value?.color_corrected === true,
            notes: typeof value?.notes === 'string' ? value.notes : 'Нет достоверной визуальной оценки.' };
    }

    _quoteArgument(arg) {
        const value = String(arg);
        if (process.platform === 'win32') return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`;
        return `'${value.replace(/'/g, `'"'"'`)}'`;
    }

    _runFfprobe(filePath) {
        return new Promise((resolve, reject) => {
            const proc = spawn('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-print_format', 'json', filePath]);
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', d => {
                stdout += d;
            });
            proc.stderr.on('data', d => {
                stderr += d;
            });
            proc.on('close', code => {
                if (code !== 0) {
                    return reject(new Error(`ffprobe exited ${code}: ${stderr.trim()}`));
                }
                try {
                    const data = JSON.parse(stdout);
                    resolve(data);
                } catch (e) {
                    reject(new Error(`ffprobe JSON parse error: ${e.message}`));
                }
            });
            proc.on('error', err => reject(err));
        });
    }

    _runFfmpeg(args, onStderrLine = () => {}) {
        return new Promise((resolve, reject) => {
            const proc = spawn('ffmpeg', args);

            // Lower process priority right after spawn so the OS / GUI stays responsive
            try {
                os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
            } catch (e) {
                console.warn(`[Priority] Не удалось снизить приоритет: ${e.message}`);
            }

            let remainder = '';
            const stderrLines = [];
            proc.stderr.on('data', chunk => {
                const data = remainder + chunk.toString();
                // FFmpeg progress uses \r instead of \n; split on both
                const lines = data.split(/\r|\n/);
                remainder = lines.pop(); // keep incomplete tail
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed) {
                        stderrLines.push(trimmed);
                        onStderrLine(trimmed);
                    }
                }
            });
            proc.stderr.on('end', () => {
                if (remainder.trim()) {
                    stderrLines.push(remainder.trim());
                    onStderrLine(remainder.trim());
                }
            });
            proc.on('close', code => {
                if (code !== 0) {
                    const tail = stderrLines.slice(-20).join('\n');
                    return reject(new Error(`ffmpeg exited with code ${code}\n${tail}`));
                }
                resolve();
            });
            proc.on('error', err => reject(err));
        });
    }

    _buildPrompt(file) {
        const metaStr = JSON.stringify(file.metadata, null, 2);
        return `${this.promptTemplate}

FILE: ${file.name}
METADATA:
${metaStr}

Return ONLY the JSON object.`;
    }

    _buildAssessmentPrompt(inputFile, outputProbe, inputBPP, outputBPP) {
        const inputStr = JSON.stringify(inputFile.metadata, null, 2);
        const outputStr = JSON.stringify(outputProbe, null, 2);
        return `${VR_QUALITY_ASSESSMENT_PROMPT}

INPUT METADATA:
${inputStr}

INPUT BPP: ${inputBPP !== null ? inputBPP.toFixed(6) : 'N/A'}

OUTPUT (5-second test) METADATA:
${outputStr}

OUTPUT BPP: ${outputBPP !== null ? outputBPP.toFixed(6) : 'N/A'}

Return ONLY the JSON object.`;
    }

    _parseFps(fpsStr) {
        if (!fpsStr) return 0;
        if (fpsStr.includes('/')) {
            const [num, den] = fpsStr.split('/').map(Number);
            if (!den) return 0;
            return num / den;
        }
        return parseFloat(fpsStr) || 0;
    }

    /**
     * Strip markdown fences and extract the first JSON object from raw text.
     * Gemini often ignores "no markdown" instructions and wraps JSON in ```json ... ```.
     */
    _extractJson(rawText) {
        if (!rawText) throw new Error('Empty response text');

        // 1. Try to extract from fenced code blocks (```json ... ``` or ``` ... ```)
        const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
            return JSON.parse(fenceMatch[1].trim());
        }

        // 2. Find first '{' and last '}' and slice between them
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
        }

        // 3. Last resort: try to parse the whole thing
        return JSON.parse(rawText);
    }

    /**
     * Strip any input-file directives Gemini may inject into input_args.
     * We always inject our own "-i <path>", so a model-provided "-i <file>"
     * (often a bare relative filename) creates a duplicate input and breaks ffmpeg.
     * Only keep recognised input-side global options.
     */
    _sanitizeInputArgs(args) {
        if (!Array.isArray(args)) return [];
        const allowedFlags = new Set([
            '-hwaccel',
            '-hwaccel_output_format',
            '-hwaccel_device',
            '-init_hw_device',
            '-filter_hw_device',
        ]);
        const clean = [];
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            // Drop "-i <file>" entirely
            if (arg === '-i') {
                i++; // skip the filename that follows
                continue;
            }
            if (allowedFlags.has(arg)) {
                clean.push(arg);
                if (i + 1 < args.length) clean.push(args[++i]);
                continue;
            }
            // Drop anything else that is not a recognised input-side flag
            // (e.g. a stray bare filename or output-only option)
            if (arg.startsWith('-')) {
                // Unknown flag: keep it but also keep its value if it has one
                clean.push(arg);
                if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    clean.push(args[++i]);
                }
            }
            // bare non-flag tokens (likely filenames) are dropped
        }
        return clean;
    }

    /**
     * RTX 3070 8 GB cannot handle any CUDA involvement on 8K HEVC.
     * For 8K sources: decode on CPU, scale on CPU, encode on NVENC.
     */
    _ensureMemorySafeArgs(file, inputArgs, outputArgs) {
        const videoStream = file.metadata?.streams?.find(s => s.codec_type === 'video');
        const width = videoStream?.width || 0;
        const height = videoStream?.height || 0;
        const is8K = width >= 7680 || height >= 3840;
        if (!is8K) return { inputArgs, outputArgs };

        // 8K sources MUST decode on CPU to avoid OOM on RTX 3070 8 GB.
        // Remove any hwaccel flag and its value from input_args.
        const safeInput = [];
        for (let i = 0; i < inputArgs.length; i++) {
            const arg = inputArgs[i];
            if (arg === '-hwaccel' || arg === '-hwaccel_output_format' || arg === '-hwaccel_device' || arg === '-init_hw_device') {
                i++; // skip the value
                continue;
            }
            safeInput.push(arg);
        }
        if (inputArgs.length !== safeInput.length) {
            console.warn(`[memory] 8K source detected; removed CUDA hwaccel flags to force CPU decode`);
        }

        let safeOutput = outputArgs.slice();
        for (let i = 0; i < safeOutput.length; i++) {
            const arg = safeOutput[i];
            if (arg === '-vf' || arg === '-filter:v') {
                const next = safeOutput[i + 1];
                if (typeof next === 'string' && next.includes('scale_cuda')) {
                    const target = next.match(/scale_cuda=(\d+):(\d+)/);
                    if (target) {
                        safeOutput[i + 1] = `scale=${target[1]}:${target[2]}:flags=lanczos`;
                    } else {
                        safeOutput[i + 1] = 'scale=6144:3072:flags=lanczos';
                    }
                    console.warn(`[memory] 8K source detected; replaced CUDA scaling with CPU scaling to avoid OOM`);
                }
            }
        }

        return { inputArgs: safeInput, outputArgs: safeOutput };
    }

    _calculateBPP(metadata) {
        if (!metadata || !metadata.streams) return null;
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) return null;

        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const fps = this._parseFps(videoStream.r_frame_rate || videoStream.avg_frame_rate || '');
        if (!width || !height || !fps) return null;

        let bitrate = 0;
        if (videoStream.bit_rate) {
            bitrate = parseInt(videoStream.bit_rate, 10);
        } else if (metadata.format && metadata.format.bit_rate) {
            bitrate = parseInt(metadata.format.bit_rate, 10);
        }

        if (!bitrate) return null;
        const bpp = bitrate / (width * height * fps);
        return bpp;
    }

    _parseTimeToSeconds(timeStr) {
        const [h, m, s] = timeStr.split(':');
        return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
    }
}

module.exports = { FfmpegAgent, VIDEO_EXTS };
