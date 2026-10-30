// ============================================================================
// ФАЙЛ: frontend/src/tests/audioCommands.test.ts
// НАЗНАЧЕНИЕ: Регрессии первого AUDIO-жеста, отложенной загрузки и гонки play/mute.
// РАЗДЕЛЫ: 1. Управляемые Audio/Window; 2. Команды и восстановление окружения.
// ФУНКЦИИ: runAudioCommandChecks.
// ============================================================================
import { AudioSyncEngine } from '../utils/audioSync';
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
    currentTime = 0; duration = 408; readyState = 0;
    playCalls = 0; loadCalls = 0;
    pending = new DeferredPlay();
    constructor(url?: string) { if (url) this.src = url; AudioFixture.instances.push(this); }
    set src(value: string) { this.attributes.set('src', value); }
    get src(): string { return this.attributes.get('src') ?? ''; }
    setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
    getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
    addEventListener(name: string, callback: () => void): void {
        const list = this.listeners.get(name) ?? []; list.push(callback); this.listeners.set(name, list);
    }
    emit(name: string): void { this.listeners.get(name)?.forEach(callback => callback()); }
    load(): void { this.loadCalls++; }
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
