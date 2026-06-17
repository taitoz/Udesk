const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { GoogleGenAI } = require('@google/genai');

const VIDEO_EXTS = ['.mp4'];

// ── Paste your key here (temporary hardcoded) ───────────────
const GEMINI_API_KEY = '';

// ── Prompt: optimize for Oculus Quest 2 streaming over WiFi 6 ─
const QUEST2_OPTIMIZATION_PROMPT = `
You are a VR video streaming engineer. The source video will be served by XBVR and streamed to an Oculus Quest 2 over WiFi 6.

Hard requirements:
1. Playback must be smooth — zero re-buffering on Quest 2.
2. Must use Quest 2 hardware decoder: H.264 High Profile (preferred for widest compatibility) or HEVC (only if source resolution is > 4K and you need to preserve detail).
3. Keep CPU/GPU load on Quest 2 minimal — avoid AV1, VP9, software-heavy profiles.
4. Bitrate must fit real-world WiFi 6 shared throughput (~600 Mbps theoretical, ~200-400 Mbps practical). Recommend video bitrate between 15 Mbps (1080p) and 40 Mbps (4K/5K). Use -maxrate and -bufsize to prevent spikes.
5. Audio: AAC stereo, keep original sample rate.
6. For network streaming add -movflags +faststart.
7. If source width > 4096 and you keep H.264, scale to max 4096 to stay within Quest 2 decoder level limits (Level 5.2). If you really want > 4096, switch to HEVC.
8. Use -pix_fmt yuv420p for decoder compatibility.
9. ENCODING HARDWARE: the host has an NVIDIA RTX 3070 (Ampere). Always prefer hardware GPU encoding over CPU. Use h264_nvenc or hevc_nvenc. Never use libx264/libx265 — those burn CPU and are slower.
10. NVENC preset for RTX 3070: choose between p4 (quality) and p5 (balanced). Avoid p1-p3 (too blocky) and p6-p7 (marginal gain, slower). Add -preset p4 or -preset p5.
11. NVENC tuning: add -tune hq for quality or -tune ll (low latency) only if explicitly needed for live. Default to hq.
12. Include -rc vbr and set -b:v, -maxrate, -bufsize together. Example: -b:v 25M -maxrate 30M -bufsize 60M.
13. Always add -c:v h264_nvenc -profile:v high -bf 3 -refs 4.
14. If scaling is needed, use CUDA scaler: -vf "scale_cuda=1920:1080:format=yuv420p" (faster than software scale).
15. Ensure -hwaccel cuda -hwaccel_output_format cuda is used before -i so the entire pipeline stays on GPU where possible.

Return ONLY a valid JSON object with no markdown formatting.
Keys:
  "ffmpeg_args": array of strings (codec/filter arguments ONLY; never include -i, filenames, -y, or output paths).
  "rationale": one-sentence explanation of your choices.
`.trim();

// ── Prompt: assess 1-minute test encode output ──────────────
const QUALITY_ASSESSMENT_PROMPT = `
You are a VR QA engineer. Given the INPUT and OUTPUT ffprobe metadata of a 1-minute test encode, assess whether the output will stream smoothly to an Oculus Quest 2 over WiFi 6.

Checklist:
- Bitrate: is it within 15-40 Mbps sweet spot for WiFi 6?
- Codec: is it H.264 High Profile or HEVC? Anything else is a FAIL.
- Resolution/Level: does it exceed Quest 2 hardware decoder limits?
- Audio: is it AAC stereo?
- Any obvious red flags (incompatible profile, too many reference frames, weird SAR/DAR, etc.)?

Return ONLY a valid JSON object with no markdown formatting.
Keys:
  "assessment": one of "PASS", "WARN", "FAIL"
  "notes": short human-readable explanation
  "recommended_changes": array of suggested ffmpeg arg changes (empty if PASS, otherwise strings).
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
     * Stage 2: Analyze with AI, test-encode 60 s, re-probe output,
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
            let ffmpegArgs;
            let rationale;
            try {
                const prompt = this._buildPrompt(file);
                const response = await this.genai.models.generateContent({
                    model: this.model,
                    contents: prompt,
                    config: { responseMimeType: 'application/json' },
                });
                const text = response?.text;
                if (!text) throw new Error('Empty response from Gemini');
                const parsed = JSON.parse(text);
                ffmpegArgs = parsed.ffmpeg_args;
                rationale = parsed.rationale;
                if (!Array.isArray(ffmpegArgs)) {
                    throw new Error('ffmpeg_args is not an array');
                }
            } catch (err) {
                console.warn(`[analyze] AI failed for "${file.name}": ${err.message}`);
                ffmpegArgs = ['-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k'];
                rationale = 'Fallback to H.264/AAC due to AI error';
            }

            // ── 2b. Test encode: first 60 seconds ──────────────────
            const tempOutput = path.join(os.tmpdir(), `ffmpeg-agent-test-${Date.now()}-${i}.mp4`);
            const offsetStr = `00:${String(this.testOffsetMin).padStart(2, '0')}:00`;
            const testArgs = ['-ss', offsetStr, '-t', '60', '-i', file.path, ...ffmpegArgs, '-y', tempOutput];

            let testSuccess = false;
            const testStart = Date.now();
            let outputProbe = null;
            let assessment = null;
            try {
                await this._runFfmpeg(testArgs);
                testSuccess = true;

                // Re-probe output
                outputProbe = await this._runFfprobe(tempOutput);

                // Ask AI to assess output quality
                const assessPrompt = this._buildAssessmentPrompt(file, outputProbe);
                const assessResponse = await this.genai.models.generateContent({
                    model: this.model,
                    contents: assessPrompt,
                    config: { responseMimeType: 'application/json' },
                });
                const assessText = assessResponse?.text;
                if (assessText) {
                    assessment = JSON.parse(assessText);
                }
            } catch (err) {
                console.warn(`[analyze] test/assessment failed for "${file.name}": ${err.message}`);
            }
            const testDurationMs = Date.now() - testStart;

            // Cleanup temp
            try {
                if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
            } catch {
                /* ignore cleanup errors */
            }

            // ── 2c. Extrapolate total time ─────────────────────────
            let estimatedSeconds = 0;
            if (testSuccess && duration > 0) {
                estimatedSeconds = (testDurationMs / 1000) * (duration / 60);
            }

            queue.push({
                ...file,
                ffmpegArgs,
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
        const resolvedOut = path.resolve(outputPath);
        if (!fs.existsSync(resolvedOut)) {
            fs.mkdirSync(resolvedOut, { recursive: true });
        }

        const results = [];
        for (let i = 0; i < queue.length; i++) {
            const task = queue[i];
            const baseName = path.basename(task.name, task.ext);
            const outputFile = path.join(resolvedOut, `${baseName}_converted${task.ext}`);

            onProgress({
                stage: 'encode-start',
                current: i + 1,
                total: queue.length,
                file: task.name,
                progressPercent: 0,
            });

            const args = ['-i', task.path, ...task.ffmpegArgs, '-y', outputFile];
            const startTime = Date.now();
            let lastTime = 0;

            try {
                await this._runFfmpeg(args, line => {
                    const timeMatch = line.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
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
            let stderrBuffer = '';
            proc.stderr.on('data', chunk => {
                stderrBuffer += chunk;
                const lines = stderrBuffer.split('\n');
                stderrBuffer = lines.pop(); // keep incomplete tail
                for (const line of lines) {
                    onStderrLine(line);
                }
            });
            proc.on('close', code => {
                if (stderrBuffer) {
                    const lines = stderrBuffer.split('\n');
                    for (const line of lines) onStderrLine(line);
                }
                if (code !== 0) {
                    return reject(new Error(`ffmpeg exited with code ${code}`));
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

    _buildAssessmentPrompt(inputFile, outputProbe) {
        const inputStr = JSON.stringify(inputFile.metadata, null, 2);
        const outputStr = JSON.stringify(outputProbe, null, 2);
        return `${QUALITY_ASSESSMENT_PROMPT}

INPUT METADATA:
${inputStr}

OUTPUT (1-minute test) METADATA:
${outputStr}

Return ONLY the JSON object.`;
    }

    _parseTimeToSeconds(timeStr) {
        const [h, m, s] = timeStr.split(':');
        return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
    }
}

module.exports = { FfmpegAgent, VIDEO_EXTS };
