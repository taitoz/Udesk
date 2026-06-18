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

CRITICAL RULES FOR SKIPPING (Idempotency & Efficiency):
1. If source BPP < 0.035 AND source bitrate < 80M AND resolution <= 8192x4096:
   You MUST recommend "action": "skip", UNLESS the resolution/fps configuration strictly exceeds Quest hardware decoder limits (e.g., 8K@60fps which exceeds HEVC L6.1 max of 1.47 Gpps and causes stuttering).
2. Never re-encode a file if the target encoding profile will result in a higher bitrate or larger file size than the source, unless downscaling is mandatory for hardware decoding compliance.

ENCODING & RATE CONTROL RULES (If action is "encode"):
1. Playback must be smooth — zero re-buffering on Quest 2. Preferred codec: HEVC (mandatory for >4K).
2. DO NOT force fixed, overly high bitrates if the source video has low complexity. Instead of strict high-floor VBR, prefer a flexible Constrained Quality (CQ) mode or smart VBR to prevent size bloating.
3. For hevc_nvenc, you can use: "-c:v", "hevc_nvenc", "-rc", "vbr", "-cq", "20", "-maxrate", "MAX_CAP", "-bufsize", "BUF_CAP".
   - Hard upper caps for maxrate/bufsize based on target resolutions:
     * 6K (6144x3072) @ 60fps: -maxrate 72M -bufsize 120M (Target average ~35M-60M depending on complexity)
     * 5.7K (5376x2688) @ 60fps: -maxrate 60M -bufsize 100M
     * 4K (3840x1920) @ 60fps: -maxrate 35M -bufsize 70M
4. Audio: AAC stereo, keep original sample rate. Use -c:a copy if source is already AAC.
5. For network streaming add -movflags +faststart.
6. Use NVENC preset: p4 (quality) or p5 (balanced), -tune hq, -bf 3 -refs 4.
7. CUDA Scaling: If scaling, use -vf "scale_cuda=W:H:format=yuv420p" and do NOT add "-pix_fmt yuv420p" to output_args.

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
  "input_args": ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"],
  "output_args": ["-c:v", "hevc_nvenc", "-preset", "p4", "-tune", "hq", "-rc", "vbr", "-cq", "20", "-maxrate", "72M", "-bufsize", "120M", "-bf", "3", "-refs", "4", "-c:a", "copy", "-movflags", "+faststart"],
  "rationale": "One-sentence explanation of why we encode or skip."
}
`.trim();

// ── Prompt: assess 5-second test encode output ──────────────
const VR_QUALITY_ASSESSMENT_PROMPT = `
You are an expert VR video encoding engineer specializing in high-resolution VR180/VR360 content playback on Oculus Quest 2 / Quest 3 via XBVR and DeoVR streaming over WiFi 6.
Your core mission is NOT to simply minimize file size, but to find the perfect technical balance between maximum visual fidelity, decoder stability, and smooth local network streaming.

CRITICAL METRIC (BPP - Bits Per Pixel Per Frame):
- BPP < 0.035: Video is ALREADY highly compressed. Re-encoding will likely destroy quality or inefficiently bloat the file size. Advise warning/skipping.
- BPP 0.040 - 0.070: Balanced sweet spot for high-quality VR180.
- BPP > 0.080: Potential overkill or unoptimized raw encode, good candidate for optimization if resolution is extreme (e.g., 8K).

Analyze the provided INPUT and OUTPUT metadata alongside their calculated BPP metrics.

Evaluation Criteria:
1. Decoder Compatibility (Quest 2 Hardware Limits):
   - Codec MUST be HEVC (preferred for VR) or H.264. Any other codec is an instant FAIL.
   - Check Profile/Level (e.g., HEVC Main 10@L5.1 or L6.0). Flag if it exceeds Quest 2 hardware capabilities (Max hardware decoding for Quest 2 is roughly 8K@30fps or 5.7K@60fps for HEVC. 8K@60fps requires Quest 3 / AV1).
2. Resolution & Bitrate Synergy:
   - Do not apply flat-video rules (like 15-40 Mbps limits).
   - For 6K (6144x3072) or 5.7K, a bitrate of 40-75 Mbps is completely normal and preferred for streaming over Wi-Fi 6 to retain VR immersion.
   - Only flag bitrate as "TOO HIGH" if it risks triggering network buffering (>90-100 Mbps sustained over WiFi 6) or if BPP shows diminishing returns.
3. Quality Retention vs. Bloat:
   - Compare INPUT BPP and OUTPUT BPP. If OUTPUT size/bitrate increased but resolution stayed the same, diagnose WHY (e.g., encoder fighting high-frequency noise/grain, or too low CRF/qp setting).
   - If OUTPUT bitrate or file size is HIGHER than INPUT while resolution DROPPED (e.g. 8K->6K), this is a REGRESSION. Mark as "REGRESSION".

CRITICAL TOKEN CAP: Keep the 'notes' field strictly under 1-2 concise sentences. Do not write long text blocks or explanations. Be as brief as possible.

RESPONSE LANGUAGE: Russian. JSON keys must remain in English, but all text values (notes) must be written in Russian.

Return ONLY a valid JSON object. Do not include markdown formatting or backticks.
{
  "assessment": "PASS" | "WARN" | "FAIL" | "SKIP" | "REGRESSION",
  "notes": "Short, technically precise explanation of your decision."
}
`.trim();

class FfmpegAgent {
    constructor(options = {}) {
        this.apiKey = options.apiKey || GEMINI_API_KEY;
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY is not configured. Paste it into the constant at the top of index.js');
        }
        this.genai = new GoogleGenAI({ apiKey: this.apiKey });
        this.model = options.model || 'gemini-2.5-flash';
        this.promptTemplate = options.promptTemplate || QUEST2_OPTIMIZATION_PROMPT;
        this.videoExts = options.videoExts || VIDEO_EXTS;
        this.testOffsetMin = options.testOffsetMin || 10;
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
        if (!stat.isDirectory()) {
            throw new Error(`Path is not a directory: ${resolved}`);
        }

        const entries = fs.readdirSync(resolved);
        const files = [];
        for (const entry of entries) {
            const ext = path.extname(entry).toLowerCase();
            if (!this.videoExts.includes(ext)) continue;

            const fullPath = path.join(resolved, entry);
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

            // ── 2a. Ask Gemini for encoding args ───────────────────
            let action = 'encode';
            let inputArgs;
            let outputArgs;
            let rationale;
            try {
                const prompt = this._buildPrompt(file);
                const response = await this.genai.models.generateContent({
                    model: this.model,
                    contents: prompt,
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
                if (!text) throw new Error('Empty response from Gemini');
                const parsed = this._extractJson(text);
                action = parsed.action || 'encode';
                inputArgs = this._sanitizeInputArgs(parsed.input_args || []);
                outputArgs = parsed.output_args || [];
                rationale = parsed.rationale;
                if (action === 'encode' && (!Array.isArray(inputArgs) || !Array.isArray(outputArgs))) {
                    throw new Error('input_args or output_args is not an array');
                }
            } catch (err) {
                console.warn(`[analyze] AI failed for "${file.name}": ${err.message}`);
                action = 'encode';
                inputArgs = ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'];
                outputArgs = ['-c:v', 'hevc_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', '20', '-maxrate', '35M', '-bufsize', '70M', '-bf', '3', '-refs', '4', '-c:a', 'copy', '-movflags', '+faststart'];
                rationale = 'Fallback to HEVC NVENC CQ20 Constrained VBR due to AI error';
            }

            let testSuccess = false;
            const testStart = Date.now();
            let outputProbe = null;
            let assessment = null;
            let inputBPP = null;
            let outputBPP = null;

            if (action === 'skip') {
                // No GPU resources wasted on already-optimal files
                assessment = { assessment: 'SKIP', notes: rationale };
            } else {
                // ── 2b. Test encode: 5-second sample ───────────────────
                const tempOutput = path.join(path.dirname(file.path), `${path.basename(file.name, file.ext)}_test_tmp${file.ext}`);
                const offsetStr = `00:${String(this.testOffsetMin).padStart(2, '0')}:00`;
                const testArgs = [...inputArgs, '-ss', offsetStr, '-t', '5', '-i', file.path, ...outputArgs, '-y', tempOutput];
                console.log(`[ffmpeg] test command: ffmpeg ${testArgs.map(a => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);

                try {
                    await this._runFfmpeg(testArgs);
                    testSuccess = true;

                    // Re-probe output
                    outputProbe = await this._runFfprobe(tempOutput);

                    // Calculate BPP for both input and output
                    inputBPP = this._calculateBPP(file.metadata);
                    outputBPP = this._calculateBPP(outputProbe);

                    // Ask AI to assess output quality
                    const assessPrompt = this._buildAssessmentPrompt(file, outputProbe, inputBPP, outputBPP);
                    const assessResponse = await this.genai.models.generateContent({
                        model: this.model,
                        contents: assessPrompt,
                        config: {
                            responseMimeType: 'application/json',
                            maxOutputTokens: 512,
                            thinkingConfig: { thinkingBudget: 0 },
                        },
                    });
                    const assessText = assessResponse?.text;
                    if (assessText) {
                        assessment = this._extractJson(assessText);
                    }
                } catch (err) {
                    console.warn(`[analyze] test/assessment failed for "${file.name}": ${err.message}`);
                }

                // Cleanup temp
                try {
                    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                } catch {
                    /* ignore cleanup errors */
                }
            }
            const testDurationMs = Date.now() - testStart;

            // ── 2c. Extrapolate total time ─────────────────────────
            let estimatedSeconds = 0;
            if (testSuccess && duration > 0) {
                estimatedSeconds = (testDurationMs / 1000) * (duration / 5);
                // NVENC stabilizes ~10-30% faster on long runs; scale down estimate
                estimatedSeconds = estimatedSeconds * 0.8;
            }

            queue.push({
                ...file,
                action,
                inputArgs,
                outputArgs,
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
        }
        return queue;
    }

    /**
     * Stage 3: Batch encode all queued files.
     * @param {Array} queue - result from analyzeAndEstimate
     * @param {string} outputPath - destination directory
     * @param {Function} onProgress - optional callback({stage, current, total, file, progressPercent, ...})
     * @returns {Promise<Array<{success:boolean, task:object, outputFile?:string, elapsed?:number, error?:string}>>}
     */
    async executeBatch(queue, outputPath, onProgress = () => {}) {
        const results = [];
        for (let i = 0; i < queue.length; i++) {
            const task = queue[i];

            // Encode only files that passed AI quality assessment
            const verdict = task.assessment?.assessment;
            if (task.action === 'skip' || verdict !== 'PASS') {
                const reason = task.rationale || (verdict ? `Assessment: ${verdict}` : 'No assessment');
                console.log(`[SKIPPED] ${task.name} — Reason: ${reason}`);
                results.push({ success: true, task, skipped: true });
                onProgress({
                    stage: 'encode-done',
                    current: i + 1,
                    total: queue.length,
                    file: task.name,
                    skipped: true,
                });
                continue;
            }

            const baseName = path.basename(task.name, task.ext);
            const targetDir = outputPath ? path.resolve(outputPath) : path.dirname(task.path);
            if (outputPath && !fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            const outputFile = path.join(targetDir, `${baseName}_encoded${task.ext}`);

            onProgress({
                stage: 'encode-start',
                current: i + 1,
                total: queue.length,
                file: task.name,
                progressPercent: 0,
            });

            const args = [...task.inputArgs, '-i', task.path, ...task.outputArgs, '-y', outputFile];
            const startTime = Date.now();
            let lastTime = 0;

            try {
                await this._runFfmpeg(args, line => {
                    const timeMatch = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                    const speedMatch = line.match(/speed=\s*([0-9.]+x)/);
                    if (timeMatch) {
                        const seconds = this._parseTimeToSeconds(timeMatch[1]);
                        lastTime = seconds;
                        const pct = task.duration > 0 ? Math.min(100, (seconds / task.duration) * 100) : 0;
                        onProgress({
                            stage: 'encode',
                            current: i + 1,
                            total: queue.length,
                            file: task.name,
                            progressPercent: pct,
                            currentTime: seconds,
                            speed: speedMatch ? speedMatch[1] : '1x',
                        });
                    }
                });

                const elapsed = Date.now() - startTime;
                results.push({ success: true, task, outputFile, elapsed });
                onProgress({
                    stage: 'encode-done',
                    current: i + 1,
                    total: queue.length,
                    file: task.name,
                    progressPercent: 100,
                });
            } catch (err) {
                results.push({ success: false, task, error: err.message });
                onProgress({
                    stage: 'encode-error',
                    current: i + 1,
                    total: queue.length,
                    file: task.name,
                    error: err.message,
                });
            }
        }
        return results;
    }

    /* ------------------------------------------------------------------ */
    /* Helpers                                                            */
    /* ------------------------------------------------------------------ */

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
