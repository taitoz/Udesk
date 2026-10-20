const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { FfmpegAgent } = require('./index');

const metadata = (width = 3840, height = 1920, fps = '60000/1001') => ({
    format: { duration: '1800', bit_rate: '12000000' },
    streams: [{ codec_type: 'video', codec_name: 'h264', width, height,
        pix_fmt: 'yuv420p', avg_frame_rate: fps }],
});
const agent = () => new FfmpegAgent({ apiKey: 'test-placeholder' });

test('low AVC gets 2400p restoration, explicit CPU/CUDA transitions and original fps', () => {
    const profile = agent()._restorationProfile(metadata(), { color_correct: true });
    const filter = profile.output_args[1];
    assert.match(filter, /^hwdownload,format=nv12,format=yuv420p,spp=6:0:1,hqdn3d=/);
    assert.match(filter, /temperature=7500,cas=0.5,format=yuv420p,hwupload_cuda,scale_cuda=4800:2400:format=nv12:interp_algo=bicubic$/);
    assert.equal(profile.output_args[profile.output_args.indexOf('-r') + 1], '60000/1001');
    assert.equal(profile.mandatory, true);
    const tenBit = metadata();
    tenBit.streams[0].pix_fmt = 'yuv420p10le';
    assert.match(agent()._restorationProfile(tenBit, { color_correct: true }).output_args[1],
        /^hwdownload,format=p010le,format=yuv420p,spp=6:0:1,hqdn3d=1.5:1:1.5:1,colortemperature=temperature=7500,cas=0.5,format=yuv420p,hwupload_cuda,scale_cuda=/);
});

test('8K and >60 fps are capped; non-2:1 geometry is preserved', () => {
    const a = agent();
    const profile = a._restorationProfile(metadata(8192, 4096, '120'));
    assert.match(profile.output_args[1], /scale_cuda=5376:2688/);
    assert.equal(profile.output_args[profile.output_args.indexOf('-r') + 1], '60');
    assert.match(a._restorationProfile(metadata(4096, 4096)).output_args[1], /scale_cuda=2688:2688/);
    assert.match(a._restorationProfile(metadata()).output_args[1], /temperature=6500/);
});

test('sample offsets stay in short clips and central region of long clips', () => {
    const a = agent();
    for (const duration of [0, 1, 4, 10, 70, 3600]) {
        const offset = a._sampleOffset(duration);
        assert.ok(offset >= 0 && offset <= Math.max(0, duration - 5));
        if (duration === 3600) assert.ok(offset >= 1260 && offset <= 2340);
    }
});

test('executeBatch generates every PASS/WARN task, excludes only skip/FAIL and never launches FFmpeg', async () => {
    const a = agent();
    a._runFfmpeg = () => assert.fail('Final encoding must never run');
    const profile = a._restorationProfile(metadata());
    const task = { name: 'input file.mp4', ext: '.mp4', path: 'input file.mp4', action: 'encode',
        inputArgs: profile.input_args, outputArgs: profile.output_args, rationale: 'Реставрация',
        assessment: { status: 'PASS', grid_removed: true, color_corrected: false, notes: 'OK' } };
    const warning = { ...task, name: 'warning.mp4', path: 'warning.mp4', assessment: { status: 'WARN', notes: 'Остаточная сетка' } };
    const tasks = await a.executeBatch([task, warning, { ...task, assessment: { status: 'FAIL' } }, { ...task, action: 'skip' }, { ...task, assessment: null }]);
    assert.equal(tasks.length, 3);
    assert.deepEqual(tasks.map(result => result.assessment.status), ['PASS', 'WARN', 'WARN']);
    assert.equal(tasks[1].assessment.notes, 'Остаточная сетка');
    assert.equal(tasks[1].file_name, 'warning.mp4');
    assert.deepEqual(Object.keys(tasks[0]), ['file_name', 'action', 'target_resolution', 'input_args', 'output_args', 'full_command', 'rationale', 'assessment']);
    assert.equal(tasks[0].target_resolution, '4800:2400');
    assert.match(tasks[0].full_command, /input file.mp4/);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(tasks[0])));
});

test('analysis supplies labelled inline images, forces low AVC restoration and cleans temp files', async () => {
    const a = agent();
    const screenshots = [];
    const commands = [];
    a._captureScreenshot = async (input, offset, output) => {
        screenshots.push({ input, offset, output });
        fs.writeFileSync(output, Buffer.from('png-test-data'));
    };
    a._runFfmpeg = async args => commands.push(args);
    a._runFfprobe = async () => {
        const output = metadata(4800, 2400);
        output.streams[0].codec_name = 'hevc';
        return output;
    };
    let calls = 0;
    a.genai = { models: { generateContent: async request => {
        const parts = request.contents[0].parts;
        calls++;
        assert.equal(parts.filter(part => part.inlineData).length, calls === 1 ? 1 : 2);
        return { text: JSON.stringify(calls === 1 ? { action: 'skip', source_clean: true, rationale: 'Реставрация' }
            : { status: 'PASS', grid_removed: true, color_corrected: false, notes: 'OK' }) };
    } } };
    const queue = await a.analyzeAndEstimate([{ name: 'input.mp4', ext: '.mp4', path: 'input.mp4', metadata: metadata() }]);
    assert.equal(queue[0].action, 'encode');
    assert.equal(queue[0].assessment.status, 'PASS');
    assert.equal(commands.length, 1);
    assert.ok(commands[0].includes('5'));
    assert.equal(screenshots[1].offset, 0);
    assert.equal(fs.existsSync(screenshots[0].output), false);
});

test('failed sample cannot enter queue and temporary images are removed', async () => {
    const a = agent();
    let screenshot;
    a._captureScreenshot = async (input, offset, output) => {
        screenshot = output;
        fs.writeFileSync(output, 'image');
    };
    a.genai = { models: { generateContent: async () => ({ text: '{"action":"encode"}' }) } };
    a._runFfmpeg = async () => { throw new Error('CUDA unavailable'); };
    const queue = await a.analyzeAndEstimate([{ name: 'input.mp4', path: 'input.mp4', ext: '.mp4', metadata: metadata() }]);
    assert.equal(queue[0].assessment.status, 'FAIL');
    assert.equal(fs.existsSync(screenshot), false);
    assert.deepEqual(await a.executeBatch(queue), []);
});

test('only confirmed clean and decoder-compatible originals may skip', async () => {
    const cases = [
        { clean: true, width: 4800, height: 2400, fps: '60', codec: 'hevc', expected: 'skip' },
        { clean: false, width: 4800, height: 2400, fps: '60', codec: 'hevc', expected: 'encode' },
        { width: 4800, height: 2400, fps: '60', codec: 'hevc', expected: 'encode' },
        { clean: true, width: 8192, height: 4096, fps: '60', codec: 'hevc', expected: 'encode' },
        { clean: true, width: 4800, height: 2400, fps: '120', codec: 'hevc', expected: 'encode' },
        { clean: true, width: 4800, height: 2400, fps: '0/0', codec: 'hevc', expected: 'encode' },
        { clean: true, width: 4800, height: 2400, fps: '60', codec: 'vp9', expected: 'encode' },
    ];
    for (const entry of cases) {
        const a = agent();
        const source = metadata(entry.width, entry.height, entry.fps);
        source.streams[0].codec_name = entry.codec;
        a._captureScreenshot = async (input, offset, output) => fs.writeFileSync(output, 'image');
        a._runFfmpeg = async () => {};
        a._runFfprobe = async () => {
            const output = metadata(4800, 2400);
            output.streams[0].codec_name = 'hevc';
            return output;
        };
        let calls = 0;
        a.genai = { models: { generateContent: async () => ({ text: JSON.stringify(++calls === 1
            ? { action: 'skip', source_clean: entry.clean }
            : { action: 'encode', status: 'WARN', notes: 'Остаточная сетка' }) }) } };
        const queue = await a.analyzeAndEstimate([{ name: 'input.mp4', path: 'input.mp4', ext: '.mp4', metadata: source }]);
        assert.equal(queue[0].action, entry.expected, JSON.stringify(entry));
        const tasks = await a.executeBatch(queue);
        assert.equal(tasks.length, entry.expected === 'skip' ? 0 : 1);
        if (tasks.length) assert.equal(tasks[0].assessment.status, 'WARN');
    }
});

test('recoverable Gemini assessment failure preserves a WARN task after successful encoding', async () => {
    const a = agent();
    a._captureScreenshot = async (input, offset, output) => fs.writeFileSync(output, 'image');
    a._runFfmpeg = async () => {};
    a._runFfprobe = async () => {
        const output = metadata(4800, 2400);
        output.streams[0].codec_name = 'hevc';
        return output;
    };
    let calls = 0;
    a.genai = { models: { generateContent: async () => {
        if (++calls === 1) return { text: '{"action":"encode"}' };
        throw new Error('Gemini service unavailable');
    } } };
    const queue = await a.analyzeAndEstimate([{ name: 'input.mp4', path: 'input.mp4', ext: '.mp4', metadata: metadata() }]);
    const tasks = await a.executeBatch(queue);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].assessment.status, 'WARN');
    assert.match(tasks[0].assessment.notes, /Gemini service unavailable/);
});

test('critical analysis failure in one file does not abort the rest of the batch', async () => {
    const a = agent();
    a._captureScreenshot = async (input, offset, output) => fs.writeFileSync(output, 'image');
    a._runFfmpeg = async () => {};
    a._runFfprobe = async () => {
        const output = metadata(4800, 2400);
        output.streams[0].codec_name = 'hevc';
        return output;
    };
    a.genai = { models: { generateContent: async () => ({ text: '{"action":"encode","status":"WARN"}' }) } };
    const queue = await a.analyzeAndEstimate([
        { name: 'broken.mp4', path: 'broken.mp4', ext: '.mp4', metadata: { streams: [] } },
        { name: 'valid.mp4', path: 'valid.mp4', ext: '.mp4', metadata: metadata() },
    ]);
    assert.deepEqual(queue.map(task => task.assessment.status), ['FAIL', 'WARN']);
    const tasks = await a.executeBatch(queue);
    assert.deepEqual(tasks.map(task => task.file_name), ['valid.mp4']);
});

test('missing visual verdict is never a PASS', () => {
    assert.equal(agent()._normalizeAssessment({ assessment: 'PASS' }).status, 'WARN');
    assert.equal(agent()._normalizeAssessment(null).grid_removed, false);
});

function launcherFixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-launcher-test-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

function runLauncher(args, mock = true) {
    const launcher = path.join(__dirname, 'test-run.js');
    const script = `
        const { main } = require(${JSON.stringify(launcher)});
        const { FfmpegAgent } = require(${JSON.stringify(path.join(__dirname, 'index.js'))});
        class MockAgent extends FfmpegAgent {
            constructor() { super({ apiKey: 'test-placeholder' }); }
            async scanFolder(input) {
                if (require('path').basename(input) === 'scan-error') throw new Error('Scan failed');
                return super.scanFolder(input);
            }
            async _runFfprobe() { return ${JSON.stringify(metadata())}; }
            async _runFfmpeg() { throw new Error('Unexpected encoding'); }
            async analyzeAndEstimate(files) {
                return files.map(file => {
                    const profile = this._restorationProfile(file.metadata);
                    return { ...file, action: file.name.startsWith('skip') ? 'skip' : 'encode',
                        inputArgs: profile.input_args, outputArgs: profile.output_args,
                        assessment: { status: file.name.startsWith('fail') ? 'FAIL' : file.name.startsWith('warn') ? 'WARN' : 'PASS' } };
                });
            }
        }
        main(JSON.parse(process.argv[1]), MockAgent).catch(error => {
            console.error(error.message);
            process.exitCode = 1;
        });
    `;
    return spawnSync(process.execPath, mock ? ['-e', script, JSON.stringify(args)] : [launcher, ...args],
        { encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
}

test('scanFolder accepts a single video without scanning siblings', async t => {
    const directory = launcherFixture(t);
    const selected = path.join(directory, 'selected.MP4');
    fs.writeFileSync(selected, 'video');
    fs.writeFileSync(path.join(directory, 'sibling.mp4'), 'video');
    const a = agent();
    const probed = [];
    a._runFfprobe = async input => { probed.push(input); return metadata(); };
    const files = await a.scanFolder(selected);
    assert.deepEqual(files.map(file => file.name), ['selected.MP4']);
    assert.deepEqual(probed, [selected]);
});

test('launcher saves only the selected file and never overwrites existing reports', t => {
    const directory = launcherFixture(t);
    const selected = path.join(directory, 'warn clip.mp4');
    fs.writeFileSync(selected, 'video');
    fs.writeFileSync(path.join(directory, 'sibling.mp4'), 'video');
    const existingReport = path.join(directory, 'warn clip_commands.json');
    fs.writeFileSync(existingReport, 'keep original');
    const result = runLauncher([selected]);
    assert.equal(result.status, 0, result.stderr);
    const task = JSON.parse(result.stdout);
    assert.equal(task.file_name, 'warn clip.mp4');
    assert.equal(task.assessment.status, 'WARN');
    assert.equal(fs.readFileSync(existingReport, 'utf8'), 'keep original');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'warn clip_commands_1.json'), 'utf8')), task);
    assert.equal(fs.existsSync(path.join(directory, 'warn clip_encoded.mp4')), false);
});

test('launcher scans folders, preserves WARN and excludes skip/FAIL', t => {
    const directory = launcherFixture(t);
    for (const name of ['pass.mp4', 'warn.mp4', 'fail.mp4', 'skip.mp4', 'ignored.txt']) {
        fs.writeFileSync(path.join(directory, name), 'video');
    }
    const output = path.join(directory, 'reports');
    const result = runLauncher([directory, output]);
    assert.equal(result.status, 0, result.stderr);
    const tasks = JSON.parse(result.stdout);
    assert.deepEqual(tasks.map(task => task.file_name), ['pass.mp4', 'warn.mp4']);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'optimization_commands.json'), 'utf8')), tasks);
});

test('empty input produces JSON [] in stdout and a report', t => {
    const directory = launcherFixture(t);
    const result = runLauncher([directory]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), []);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'optimization_commands.json'), 'utf8')), []);
});

test('launcher validates arguments and paths before requesting credentials', t => {
    const directory = launcherFixture(t);
    const outputFile = path.join(directory, 'not-a-directory');
    fs.writeFileSync(outputFile, 'keep');
    const cases = [
        { args: [], error: /Usage:/ },
        { args: [directory, directory, 'extra'], error: /Usage:/ },
        { args: [path.join(directory, 'missing')], error: /Input path not found/ },
        { args: [outputFile], error: /Unsupported video extension/ },
        { args: [directory, outputFile], error: /Output path is not a directory/ },
        { args: [directory, path.join(outputFile, 'nested')], error: /Output path is not a directory/ },
    ];
    for (const entry of cases) {
        const result = runLauncher(entry.args, false);
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, entry.error);
        assert.doesNotMatch(result.stderr, /GEMINI_API_KEY is not configured/);
        assert.equal(result.stdout, '');
    }
    assert.equal(fs.readFileSync(outputFile, 'utf8'), 'keep');
});

test('scan errors do not create output directories and importing the launcher has no side effects', t => {
    const directory = launcherFixture(t);
    const input = path.join(directory, 'scan-error');
    const output = path.join(directory, 'output');
    fs.mkdirSync(input);
    const result = runLauncher([input, output]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Scan failed/);
    assert.equal(fs.existsSync(output), false);
    const imported = spawnSync(process.execPath,
        ['-e', `require(${JSON.stringify(path.join(__dirname, 'test-run.js'))});`],
        { encoding: 'utf8', env: { ...process.env, GEMINI_API_KEY: '' } });
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, '');
    assert.equal(imported.stderr, '');
});
