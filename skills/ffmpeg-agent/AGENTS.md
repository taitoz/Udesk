# FFmpeg agent verification

- Run `npm test` in this directory; tests use Node's built-in test runner and mocked Gemini/FFmpeg calls.
- Run `node --check index.js` and `node --check test-run.js` for syntax verification.
- Actual restoration tests require FFmpeg with spp, hqdn3d, colortemperature, cas, scale_cuda and hevc_nvenc, plus an accessible NVIDIA driver. A build listing CUDA support alone is not sufficient.
- CLI authentication uses the GEMINI_API_KEY environment variable. stdout contains JSON; diagnostics go to stderr.
- executeBatch generates task objects only. Do not reintroduce automatic final encoding or database writes.
- Both PASS and WARN candidates must retain commands (including in the CLI). Exclude explicit skips and critical FAIL only. A source may skip only with confirmed visual cleanliness and Quest 2 compatibility; recoverable assessment-service failures after a valid sample are WARN.
