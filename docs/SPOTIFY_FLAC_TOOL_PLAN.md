# Spotify FLAC Download Tool — Analysis & Implementation Plan

## 1. Executive Summary

Build a tool inside UDesk that, given a Spotify track/album/playlist URL or ID,
produces a **FLAC file** on disk with proper tags and album art.

The tool leverages the user's **Spotify Premium** account for metadata and
playlist access, and uses UDesk's existing **Puppeteer-in-Electron** stack for
automation.

---

## 2. Critical Technical Reality (read first)

### 2.1 Spotify does NOT stream or sell FLAC

| Tier          | Format      | Max bitrate | Lossless? |
|---------------|-------------|-------------|-----------|
| Free          | Ogg Vorbis  | 160 kbps    | No        |
| Premium       | Ogg Vorbis  | 320 kbps    | No        |
| Premium (web) | AAC         | 256 kbps    | No        |
| Spotify HiFi  | —           | —           | **Announced Feb 2021, never launched** |

There is **no official Spotify endpoint** that returns lossless audio.
"Spotify HiFi" was announced in 2021 and has not shipped as of this writing.

### 2.2 Converting a Spotify stream to FLAC is pointless

Re-encoding a 320 kbps lossy stream into FLAC produces a *larger* file that
contains **no more audio information** than the original. It is a wasteful
transcode, not a true lossless download. Any tool that claims "Spotify → FLAC"
by capturing the stream is doing exactly this.

### 2.3 The only way to get *true* FLAC is from a lossless source

To deliver genuine lossless audio, the tool must obtain the audio from a
**source that actually offers FLAC** and use Spotify only as the *catalogue /
metadata layer*. This is the approach used by community tools such as
`spotDL` (YouTube/Youtube Music), `spotify-dl` (YouTube), and various
Tidal/Qobuz/Deezer-based downloaders.

---

## 3. Approach Options

### Option A — Metadata match + YouTube Music (recommended for legality/availability)

1. Use Spotify Web API to resolve the track (ISRC, title, artist, album, art).
2. Search **YouTube Music** (or YouTube) for a matching video.
3. Download the best available audio stream.
4. If the source is lossy (Opus/AAC), transcode to FLAC *only as a container*
   (honest about provenance) — OR keep the original codec and tag it.
5. Embed ID3/Vorbis tags + cover art from Spotify metadata.

- **Pros**: YouTube Music offers 256 kbps AAC (free tier) and up to
  lossless/24-bit on Premium; no extra paid account strictly required for
  256 kbps; large catalogue match rate.
- **Cons**: 256 kbps AAC → FLAC is still a lossy→lossless transcode unless the
  specific video is a true lossless upload. True FLAC is only available on
  YouTube Music Premium for select tracks.
- **Match quality**: High when using ISRC.

### Option B — Metadata match + Tidal / Qobuz / Deezer (true FLAC)

1. Spotify API for metadata (same as A).
2. Search a **lossless streaming service** (Tidal HiFi, Qobuz, Deezer HiFi)
   by ISRC.
3. Download the FLAC stream from that service.

- **Pros**: Genuine 16/24-bit FLAC.
- **Cons**: Requires a **paid subscription** to the target service; each has
  anti-download protections (Widevine, encrypted blobs); significantly more
  complex automation; stronger ToS conflict.

### Option C — Spotify stream capture (NOT recommended)

1. Capture Spotify's decrypted Ogg Vorbis stream (requires breaking Widevine
   DRM on the client).
2. Transcode Ogg Vorbis 320 kbps → FLAC.

- **Pros**: Uses only the Spotify account you already have.
- **Cons**: Output is **not truly lossless**; requires circumventing DRM
  (illegal in many jurisdictions, e.g. DMCA §1201); brittle; breaks on every
  Spotify client update.

### Recommendation

**Option A** for a working, maintainable tool that fits UDesk's Puppeteer
architecture. If you already pay for **Tidal HiFi / Qobuz**, Option B gives
true FLAC but with higher complexity and ToS risk.

---

## 4. Legal & Terms-of-Service Notes

- Downloading from Spotify by circumventing its DRM violates Spotify's ToS
  and may violate local law (DMCA in the US, Copyright Directive in the EU).
- Downloading from YouTube/Youtube Music via third-party tools violates
  YouTube's ToS; legality varies by jurisdiction and is generally tolerated
  for personal, non-commercial use but is not endorsed.
- Downloading from Tidal/Qobuz/Deezer via unofficial clients violates their
  ToS.
- **This plan is for personal use of content you have a right to access.**
  Do not redistribute downloaded files.

---

## 5. Architecture (UDesk integration)

```
┌──────────────────────────────────────────────────────────────┐
│ UDesk Angular UI                                             │
│  └─ Spotify FLAC panel: paste URL, queue, progress, settings │
└───────────────┬──────────────────────────────────────────────┘
                │ IPC (preload.js bridge)
┌───────────────▼──────────────────────────────────────────────┐
│ Electron Main Process                                        │
│                                                              │
│  ┌────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │ Spotify     │   │ Matcher       │   │ Downloader         │  │
│  │ Metadata    │──▶│ (ISRC search  │──▶│ (Puppeteer /       │  │
│  │ Service     │   │  on YT Music) │   │  yt-dlp / API)     │  │
│  └────────────┘   └──────────────┘   └─────────┬──────────┘  │
│        │                                        │            │
│        │                                   ┌────▼─────┐      │
│        └──────────────────────────────────▶│ Tagger   │      │
│        │ (tags + art)                       │ (FLAC +  │      │
│        │                                    │  cover)  │      │
│        │                                    └────┬─────┘      │
│  ┌─────▼──────┐                              ┌───▼──────┐     │
│  │ NestDB     │◀─────────────────────────────│ Output   │     │
│  │ (history)  │                              │ dir      │     │
│  └────────────┘                              └──────────┘     │
└──────────────────────────────────────────────────────────────┘
```

### Components

| Component            | Responsibility                                       | Tech                          |
|----------------------|------------------------------------------------------|-------------------------------|
| Spotify Metadata Svc | Resolve URL → track/album/playlist; fetch ISRC, art  | `spotify-uri`, Web API        |
| Auth                 | OAuth PKCE flow (user premium)                       | `spotify-web-api-node` or raw |
| Matcher              | ISRC/title search on Youtube Music                   | Puppeteer page in UDesk       |
| Downloader           | Fetch best audio stream, save to temp                | `yt-dlp` (bundled) or API     |
| Transcoder           | (Optional) → FLAC container                          | `ffmpeg` (bundled)            |
| Tagger               | Embed tags + cover art                               | `music-metadata` / `flac.js`  |
| Queue/History        | Persist downloads, skip dupes                        | NestDB (already in UDesk)     |
| UI Panel             | Angular component in PrimeNG                         | New module under `src/`       |

---

## 6. Required Dependencies

### npm (add to `package.json`)

```jsonc
{
  "dependencies": {
    "spotify-uri": "^3.x",          // parse spotify:// and https URLs
    "spotify-web-api-node": "^5.x", // Web API client (metadata, playlists)
    // choose one downloader backend:
    "youtube-music-api": "^1.x",    // YT Music metadata search (no auth)
    // OR shell out to yt-dlp binary (see below)
    "music-metadata": "^11.x",      // read/write tags
    "fluent-ffmpeg": "^2.x"         // transcode wrapper (optional)
  }
}
```

### External binaries (bundle via `electron-builder` `extraResources`)

- **`yt-dlp`** — the most reliable Youtube Music audio downloader. Ship the
  single-file binary for the user's platform. Update via UDesk's existing
  auto-updater.
- **`ffmpeg`** — only needed if you transcode to FLAC container or need to
  remux. Ship a static build.

### Spotify API access

- Register an app at <https://developer.spotify.com/dashboard>.
- Use **Authorization Code with PKCE** (no client secret in the desktop app).
- Scopes needed: `user-read-private`, `playlist-read-private`,
  `user-library-read`. Premium is *not strictly required* for metadata, but
  the user has it and it enables higher-quality stream *capture* if you ever
  go Option C later.

---

## 7. Implementation Plan (phased)

### Phase 0 — Spike (0.5 day)

- [ ] Validate ISRC-based matching on Youtube Music for 10 sample tracks.
- [ ] Confirm `yt-dlp` can pull 256 kbps AAC (free) and lossless (Premium)
      from Youtube Music.
- [ ] Decide: transcode to FLAC container (honest) vs. keep native codec.

### Phase 1 — Spotify metadata service (1 day)

- [ ] Add OAuth PKCE flow in Electron main process; store token in NestDB.
- [ ] Implement `resolveSpotifyUrl(url)` → `{type, ids[]}`.
- [ ] Implement `getTrack(id)` → `{isrc, title, artists, album, coverUrl,
      durationMs}`.
- [ ] Implement `getAlbum(id)` / `getPlaylist(id)` → list of track ids.
- [ ] Expose via IPC handlers in `mainPageActions.js` (or a new
      `mainSpotify.js`).

### Phase 2 — Matcher + Downloader (1.5 days)

- [ ] `matchOnYoutubeMusic(isrc, title, artists)` → videoId.
      - Prefer ISRC search: `https://music.youtube.com/search?q=<ISRC>`.
      - Fallback to `"title" "artist"` query; pick closest by duration match
        (±2s).
- [ ] `downloadAudio(videoId, outDir)` → spawn `yt-dlp`:
      ```
      yt-dlp -f bestaudio --extract-audio --audio-format flac \
             -o "%(title)s.%(ext)s" \
             "https://music.youtube.com/watch?v=<videoId>"
      ```
- [ ] Stream progress via IPC to the Angular UI.

### Phase 3 — Tagging (0.5 day)

- [ ] Write FLAC tags (title, artist, album, ISRC, date, cover) using
      `music-metadata` or `metaflac` (bundled with ffmpeg).
- [ ] Embed cover art from Spotify's `images[0].url`.

### Phase 4 — UI panel (1 day)

- [ ] New Angular module `src/app/spotify-flac/`.
- [ ] Components:
      - `SpotifyLoginComponent` — OAuth button + status.
      - `SpotifyQueueComponent` — paste URL, list tracks, per-track status.
      - `SpotifySettingsComponent` — output dir, quality preference,
        overwrite behavior.
- [ ] PrimeNG table + progress bars; integrate with existing UDesk shell.

### Phase 5 — Queue, history, dedupe (0.5 day)

- [ ] NestDB collection `spotify_downloads` with `{isrc, status, path, ts}`.
- [ ] Skip already-downloaded ISRCs (configurable).
- [ ] Resume on restart.

### Phase 6 — Packaging & polish (0.5 day)

- [ ] Bundle `yt-dlp` + `ffmpeg` via `electron-builder` `extraResources`.
- [ ] Add `--yt-dlp-path` / `--ffmpeg-path` resolution in main process.
- [ ] Self-update `yt-dlp` binary on app start (it self-updates via
      `yt-dlp -U`).
- [ ] Error handling: no match, region-blocked, rate limits.

**Estimated total: ~5 days** for a working v1.

---

## 8. Key Code Sketches

### 8.1 Resolve + fetch metadata (main process)

```ts
import SpotifyWebApi from 'spotify-web-api-node';
import spotifyUri from 'spotify-uri';

const api = new SpotifyWebApi();
api.setAccessToken(token); // from PKCE flow

async function resolve(url: string) {
  const parsed = spotifyUri.parse(url);
  if (parsed.type === 'track') {
    const t = await api.getTrack(parsed.id);
    return [toTrack(t.body)];
  }
  if (parsed.type === 'album') {
    const { body } = await api.getAlbumTracks(parsed.id, { limit: 50 });
    return Promise.all(body.items.map(i => api.getTrack(i.id).then(r => toTrack(r.body))));
  }
  if (parsed.type === 'playlist') {
    const { body } = await api.getPlaylistTracks(parsed.id, { limit: 100 });
    return Promise.all(body.items.map(i => api.getTrack(i.track.id).then(r => toTrack(r.body))));
  }
  throw new Error(`Unsupported type: ${parsed.type}`);
}

function toTrack(t: any) {
  return {
    isrc: t.external_ids?.isrc,
    title: t.name,
    artists: t.artists.map((a: any) => a.name).join(', '),
    album: t.album.name,
    coverUrl: t.album.images[0]?.url,
    durationMs: t.duration_ms,
  };
}
```

### 8.2 Match on Youtube Music + download

```ts
import { spawn } from 'node:child_process';
import path from 'node:path';

function matchYTM(isrc: string, title: string, artists: string): Promise<string> {
  // Use youtube-music-api or a Puppeteer page on music.youtube.com/search
  // Prefer ISRC query; fallback to "${title} ${artists}".
  // Return the best videoId by duration proximity.
}

function download(videoId: string, outDir: string, onProgress: (p: number) => void) {
  const args = [
    '-f', 'bestaudio',
    '--extract-audio', '--audio-format', 'flac',
    '--audio-quality', '0',
    '-o', path.join(outDir, '%(title)s.%(ext)s'),
    `https://music.youtube.com/watch?v=${videoId}`,
  ];
  const proc = spawn(getYtDlpPath(), args);
  proc.stdout.on('data', /* parse progress */);
  proc.stderr.on('data', /* parse progress */);
  return new Promise((res, rej) => {
    proc.on('exit', code => (code === 0 ? res() : rej(new Error(`yt-dlp exit ${code}`))));
  });
}
```

### 8.3 IPC wiring (extend `preload.js`)

```js
contextBridge.exposeInMainWorld('spotifyFlac', {
  login:  () => ipcRenderer.invoke('spotify-flac:login'),
  status: () => ipcRenderer.invoke('spotify-flac:status'),
  enqueue: (url) => ipcRenderer.invoke('spotify-flac:enqueue', url),
  onProgress: (cb) => ipcRenderer.on('spotify-flac:progress', (_e, p) => cb(p)),
});
```

---

## 9. Quality / Honesty Matrix

| Source                        | True FLAC? | Notes                                   |
|-------------------------------|------------|-----------------------------------------|
| Spotify stream (any tier)     | No         | 320 kbps Ogg Vorbis max                 |
| Youtube Music free            | No         | 256 kbps AAC                            |
| Youtube Music Premium         | **Some**   | 24-bit lossless on select tracks        |
| Tidal HiFi / HiFi Plus        | **Yes**    | 16/24-bit FLAC                          |
| Qobuz Studio / Sublime        | **Yes**    | up to 24-bit/192kHz                     |
| Deezer HiFi                   | **Yes**    | 16-bit FLAC                             |

If your goal is **genuine lossless**, the cheapest path is a **Deezer HiFi**
or **Tidal HiFi** subscription used as the download source, with Spotify as
the catalogue. If "good enough, properly tagged" is the goal, Youtube Music
(Option A) is free and simple.

---

## 10. Risks & Mitigations

| Risk                          | Mitigation                                              |
|-------------------------------|---------------------------------------------------------|
| ISRC not present on track     | Fallback to title+artist+duration match; log confidence |
| No Youtube Music match        | Retry on YouTube main; offer manual videoId override    |
| `yt-dlp` breaks on YT change  | Auto-update binary on startup; pin known-good version   |
| Spotify token expiry          | Silent refresh via refresh token; re-prompt if revoked  |
| Rate limits (Spotify/YT)      | Queue with concurrency=1..2; exponential backoff        |
| ToS / legal                   | Personal use only; no redistribution; document in UI    |

---

## 11. Open Decisions (need your input)

1. **Download source**: Youtube Music (free, easy, lossy) vs. Tidal/Qobuz
   (paid, true FLAC, harder)?
2. **Transcode policy**: Keep source codec (honest) or always wrap in FLAC
   (cosmetic, larger files)?
3. **Bundle `yt-dlp`/`ffmpeg`** (~80 MB) or ask the user to install them?
4. **Auth storage**: NestDB (current UDesk pattern) or OS keychain
   (`keytar`)?
