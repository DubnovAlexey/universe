# 🎵 Audio Track & Licensing Documentation (`cosmic_ambient.mp3`)

* **File Path:** `frontend/public/audio/cosmic_ambient.mp3`
* **Runtime Loader:** `frontend/src/utils/audioSync.ts` (`${import.meta.env.BASE_URL}audio/cosmic_ambient.mp3`)
* **Usage in Project:** Continuous ambient soundtrack and real-time `Web Audio API` (`AnalyserNode`) spectral source driving low-frequency breathing envelopes (`20–250 Hz`), mid-band synaptic pulse modulation (`250–2500 Hz`), and manifesto card heartbeat in the non-commercial open-source portfolio installation **UNIVERSE** by **Alexey Dubnov**.
* **Playback & Autoplay Policy:** Respects browser autoplay restrictions (`HTMLMediaElement.play()` promise handling). If audible autoplay is deferred by the visitor's browser prior to the first user gesture, the visual simulation runs autonomously via internal LFO fallback and seamlessly engages the audio stream upon the first pointer or keyboard interaction without restarting the visual timeline.
* **Rights & Attribution:** Curated royalty-free space ambient composition included for non-commercial portfolio demonstration on GitHub Pages (`https://dubnovalexey.github.io/universe/`).