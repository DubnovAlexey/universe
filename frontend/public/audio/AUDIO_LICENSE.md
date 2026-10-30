# 🎵 Audio Track & Licensing Documentation (`cosmic_ambient.mp3`)

* **Track:** Photosynthesis
* **Artist:** Carbon Based Lifeforms
* **Album:** World of Sleepers
* **In-scene credit:** HOW IT WORKS → About the music (collapsed by default; labels follow RU/EN/HE/ES).

* **File Path:** `frontend/public/audio/cosmic_ambient.mp3` (`~16.46 MB`, start offset `2.6s`)
* **Runtime Loader:** `frontend/src/utils/audioSync.ts` (`${import.meta.env.BASE_URL}audio/cosmic_ambient.mp3`)
* **Usage in Project:** Continuous ambient soundtrack for the non-commercial portfolio installation **UNIVERSE** by **Alexey Dubnov** (`https://dubnovalexey.github.io/universe/`). On desktop, an available `Web Audio API` graph uses `AnalyserNode` to drive breathing, synaptic modulation and the card heartbeat. Mobile playback uses the media element directly with a synchronized procedural LFO envelope; this envelope is not a spectral measurement of the track. A procedural fallback also keeps the scene moving when analysis or playback is unavailable.
* **Playback & Browser Autoplay Policy:** Respects browser autoplay restrictions (`HTMLMediaElement.play()` promise handling and feature-detected `navigator.audioSession.type = 'playback'` on iOS Safari). If audible autoplay is deferred by the visitor's browser prior to the first user gesture, the visual simulation runs autonomously via internal LFO fallback, displays an interactive unlock prompt (`[ 🔊 TAP / CLICK TO ENGAGE AUDIO ]`), and engages the audio stream upon the first pointer, touch, or keyboard interaction.
* **Licensing & Redistribution Notice:** The **MIT License** in the root `LICENSE` file applies strictly to the software source code of this repository. The audio recording `cosmic_ambient.mp3` is included solely for non-commercial portfolio demonstration on GitHub Pages. Any third-party commercial reuse or standalone redistribution of the audio file requires separate verification of the recording's source license or replacement with an explicitly attributed asset.
