# Audio playlist and credits

The four files play in order and repeat independently of the 108-second visual cycle. Known names below come from existing ID3 tags. No title or artist is invented for the numeric filename. The Zero Cult album tag was not treated as an authoritative album credit.

| Order | File in `frontend/public/audio/` | Track | Artist | Album / start |
|---|---|---|---|---|
| 1 | `cosmic_ambient.mp3` | Photosynthesis | Carbon Based Lifeforms | World of Sleepers; existing 2.6 s offset |
| 2 | `12 - Down On Me - Melokind (320).mp3` | Down On Me | Melokind | Voices; from the beginning |
| 3 | `2_5415626372078905996.mp3` | Unconfirmed | Unconfirmed | From the beginning |
| 4 | `Zero Cult - Cosmophobia.mp3` | Cosmophobia | Zero Cult | Album unconfirmed; from the beginning |

* **In-scene credits:** HOW IT WORKS → About the music (collapsed by default; labels follow RU/EN/HE/ES).
* **Runtime Loader:** `frontend/src/utils/audioSync.ts`, `SOUNDTRACKS`; URL-encoded filenames under `${import.meta.env.BASE_URL}audio/`. One existing media element and analyser graph are retained across track changes. An unavailable file advances to the next; after a complete failed circle playback waits for an explicit AUDIO retry. Original audio bytes are unchanged.
* **Usage in Project:** Continuous ambient soundtrack for the non-commercial portfolio installation **UNIVERSE** by **Alexey Dubnov** (`https://dubnovalexey.github.io/universe/`). On desktop, an available `Web Audio API` graph uses `AnalyserNode` to drive breathing, synaptic modulation and the card heartbeat. Mobile playback uses the media element directly with a synchronized procedural LFO envelope; this envelope is not a spectral measurement of the track. A procedural fallback also keeps the scene moving when analysis or playback is unavailable.
* **Playback & Browser Autoplay Policy:** Respects browser autoplay restrictions (`HTMLMediaElement.play()` promise handling and feature-detected `navigator.audioSession.type = 'playback'` on iOS Safari). If audible autoplay is deferred by the visitor's browser prior to the first user gesture, the visual simulation runs autonomously via internal LFO fallback, displays an interactive unlock prompt (`[ 🔊 TAP / CLICK TO ENGAGE AUDIO ]`), and engages the audio stream upon the first pointer, touch, or keyboard interaction.
* **Licensing & Redistribution Notice:** The **MIT License** in the root `LICENSE` file applies strictly to the software source code of this repository. These audio recordings are included solely for non-commercial portfolio demonstration on GitHub Pages. Any third-party commercial reuse or standalone redistribution of the recordings requires separate verification of their source licenses or replacement with explicitly attributed assets.
