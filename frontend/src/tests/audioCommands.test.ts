// ============================================================================
// ФАЙЛ: frontend/src/tests/audioCommands.test.ts
// НАЗНАЧЕНИЕ: Регрессии первого AUDIO-жеста, отложенной загрузки и гонки play/mute.
// РАЗДЕЛЫ: 1. Управляемые Audio/Window; 2. Команды и восстановление окружения.
// ФУНКЦИИ: runAudioCommandChecks.
// ============================================================================
import { AudioSyncEngine, SOUNDTRACKS } from '../utils/audioSync';
import { integrationRegistry } from '../core/integrationRegistry';
import { universeStore } from '../store/universeState';

// НАЧАЛО РАЗДЕЛА 1. УПРАВЛЯЕМЫЕ AUDIO/WINDOW
class DeferredPlay {
    private resolved?: () => void;
    private rejected?: () => void;
    then(callback: () => void): this { this.resolved = callback; return this; }
    catch(callback: () => void): this { this.rejected = callback; return this; }
    resolve(): void { this.resolved?.(); }
    reject(): void { this.rejected?.(); }
}
class AudioFixture {
    static instances: AudioFixture[] = [];
    readonly attributes = new Map<string, string>();
    readonly listeners = new Map<string, (() => void)[]>();
    loop = false; preload = ''; volume = 1; muted = false; paused = true;
    currentTime = 0; duration = 408; readyState = 0; ended = false;
    error: { code: number } | null = null;
    playCalls = 0; loadCalls = 0;
    pending = new DeferredPlay();
    constructor(url?: string) { if (url) this.src = url; AudioFixture.instances.push(this); }
    set src(value: string) { this.attributes.set('src', value); this.currentTime = 0; this.readyState = 0; this.ended = false; }
    get src(): string { return this.attributes.get('src') ?? ''; }
    setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
    getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
    addEventListener(name: string, callback: () => void): void {
        const list = this.listeners.get(name) ?? []; list.push(callback); this.listeners.set(name, list);
    }
    emit(name: string): void { this.listeners.get(name)?.forEach(callback => callback()); }
    load(): void { this.loadCalls++; this.error = null; this.ended = false; }
    play(): Promise<void> {
        this.playCalls++; this.paused = false; this.pending = new DeferredPlay();
        return this.pending as unknown as Promise<void>;
    }
    pause(): void { this.paused = true; }
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ runAudioCommandChecks
export function runAudioCommandChecks(check: (passed: boolean, description: string) => void): void {
    const names = ['window', 'navigator', 'Audio'] as const;
    const globals = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    const statusDescriptor = Object.getOwnPropertyDescriptor(integrationRegistry, 'updateModuleStatus');
    const storeDescriptor = Object.getOwnPropertyDescriptor(universeStore, 'setAudioEnabled');
    const statuses: string[] = [];
    const handlers = new Map<string, Set<(event: Event) => void>>();
    const fakeWindow = {
        addEventListener(name: string, callback: (event: Event) => void): void {
            const list = handlers.get(name) ?? new Set(); list.add(callback); handlers.set(name, list);
        },
        removeEventListener(name: string, callback: (event: Event) => void): void { handlers.get(name)?.delete(callback); },
    };
    // НАЧАЛО РАЗДЕЛА 2. КОМАНДЫ И ВОССТАНОВЛЕНИЕ
    try {
        Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'iPhone' } });
        Object.defineProperty(globalThis, 'Audio', { configurable: true, value: AudioFixture });
        Object.defineProperty(integrationRegistry, 'updateModuleStatus', { configurable: true, value: () => {} });
        Object.defineProperty(universeStore, 'setAudioEnabled', { configurable: true,
            value: (enabled: boolean, status: string) => { statuses.push(`${enabled}:${status}`); } });
        AudioFixture.instances.length = 0;
        const engine = new AudioSyncEngine();
        const audio = AudioFixture.instances[0];
        engine.startPlayback(false);
        check(audio.preload === 'none' && !audio.src && audio.playCalls === 0 && audio.loadCalls === 0,
            'Audio construction and non-gesture requests leave src unset and perform no eager load or play');

        const audioButton = { closest: (selector: string) => selector === '#btn-toggle-audio' ? {} : null };
        for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown']) {
            const event = new Event(type);
            Object.defineProperties(event, { target: { value: audioButton }, code: { value: 'KeyM' }, key: { value: 'm' } });
            handlers.get(type)?.forEach(handler => handler(event));
        }
        // Счётчик читаем до команды отдельно: иначе TS сужает playCalls до 0 и сравнение с 1 не компилируется.
        const playCallsBeforeCommand = audio.playCalls;
        const firstCommandAccepted = engine.toggleFromUserCommand();
        check(playCallsBeforeCommand === 0 && firstCommandAccepted && audio.playCalls === 1 && Boolean(audio.src),
            'AUDIO/M capture gestures do not race the explicit first command; that command requests playback once');
        const duplicate = new Event('pointerup');
        handlers.get('pointerup')?.forEach(handler => handler(duplicate));
        audio.readyState = 1; audio.emit('loadedmetadata');
        audio.emit('playing'); audio.pending.resolve();
        const playing = statuses.at(-1) === 'true:PLAYING_MP3';
        check(playing && audio.playCalls === 1 && audio.currentTime === 2.6 && !engine.toggleFromUserCommand() && audio.paused,
            'Successful first playback preserves the2.6s intro offset and the next AUDIO command mutes it');

        statuses.length = 0;
        engine.toggleFromUserCommand();
        const pending = audio.pending;
        engine.toggleFromUserCommand();
        audio.emit('playing'); pending.resolve();
        check(!engine.isEnabled() && audio.paused && statuses.at(-1) === 'false:MUTED',
            'A late playing event or resolved play promise cannot undo a newer mute command');
        engine.toggleFromUserCommand(); audio.pending.reject();
        const waiting = statuses.at(-1) === 'true:AWAITING_GESTURE';
        const attempts = audio.playCalls;
        engine.toggleFromUserCommand();
        check(waiting && engine.isEnabled() && audio.playCalls === attempts + 1,
            'A rejected play clears the pending state and permits a later explicit retry');
        audio.pending.resolve(); audio.emit('playing');
        audio.currentTime = audio.duration - 0.1;
        audio.emit('timeupdate');
        check(!audio.loop && audio.currentTime === audio.duration - 0.1,
            'The media element no longer loops or seeks before the end, allowing the complete track to finish');

        let sequencePreserved = true;
        for (let step = 1; step <= SOUNDTRACKS.length; step++) {
            audio.ended = true; audio.emit('ended');
            const track = SOUNDTRACKS[step % SOUNDTRACKS.length];
            sequencePreserved &&= decodeURIComponent(audio.src).endsWith(`/audio/${track.file}`);
            audio.readyState = 1; audio.emit('loadedmetadata');
            sequencePreserved &&= audio.currentTime === track.startOffsetSec;
            audio.emit('playing'); audio.pending.resolve();
        }
        check(sequencePreserved && AudioFixture.instances.length === 1,
            'All four encoded soundtrack URLs play sequentially and wrap on one Audio element, with intro offset applied only to the original track');

        audio.ended = true; audio.emit('ended');
        const transitionPromise = audio.pending;
        engine.setEnabled(false);
        const mutedSource = audio.src, mutedCalls = audio.playCalls;
        transitionPromise.resolve(); audio.ended = true;
        audio.emit('playing'); audio.emit('ended'); audio.emit('error');
        check(audio.paused && audio.src === mutedSource && audio.playCalls === mutedCalls && statuses.at(-1) === 'false:MUTED',
            'Mute during an automatic transition wins over stale play/ended/error events and never advances or restarts the playlist');

        engine.setEnabled(true);
        const beforeFailures = audio.playCalls;
        for (let failed = 0; failed < SOUNDTRACKS.length + 2; failed++) audio.emit('error');
        check(audio.paused && audio.playCalls === beforeFailures + SOUNDTRACKS.length - 1 &&
            statuses.at(-1) === 'true:AWAITING_GESTURE',
            'A complete circle of failed tracks stops after a bounded number of attempts without a retry timer');
        const contextProbe = engine as unknown as { ctx: { state: string } | null };
        contextProbe.ctx = { state: 'running' };
        const phaseRetryCalls = audio.playCalls;
        engine.transitionToPhase('02_GENESIS');
        check(audio.playCalls === phaseRetryCalls && audio.paused,
            'A desktop phase transition cannot restart an exhausted playlist without a new playback command');
        contextProbe.ctx = null;
        const callsBeforeRetry = audio.playCalls, loadsBeforeRetry = audio.loadCalls;
        engine.toggleFromUserCommand();
        check(audio.playCalls === callsBeforeRetry + 1 && audio.loadCalls === loadsBeforeRetry + 1,
            'A later explicit AUDIO command reloads the exhausted source and begins a fresh bounded attempt');
        engine.setEnabled(false);
        audio.error = { code: 4 }; audio.emit('error');
        const pausedErrorLoads = audio.loadCalls, pausedErrorPlays = audio.playCalls;
        engine.setEnabled(true);
        check(audio.loadCalls === pausedErrorLoads + 1 && audio.playCalls === pausedErrorPlays + 1 && audio.error === null,
            'A media failure delivered while muted cannot poison the later explicit retry: the source is reloaded before play');
    } finally {
        for (const [name, descriptor] of globals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
        }
        if (statusDescriptor) Object.defineProperty(integrationRegistry, 'updateModuleStatus', statusDescriptor);
        else Reflect.deleteProperty(integrationRegistry, 'updateModuleStatus');
        if (storeDescriptor) Object.defineProperty(universeStore, 'setAudioEnabled', storeDescriptor);
        else Reflect.deleteProperty(universeStore, 'setAudioEnabled');
        AudioFixture.instances.length = 0;
    }
    // КОНЕЦ РАЗДЕЛА 2
}
// КОНЕЦ ФУНКЦИИ runAudioCommandChecks
