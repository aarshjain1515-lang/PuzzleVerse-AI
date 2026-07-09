/**
 * PuzzleVerse AI - Audio Module
 * Procedurally synthesizes all sound effects and background music using Web Audio API.
 * No external file dependencies.
 */

const AudioManager = {
    audioCtx: null,
    musicGain: null,
    sfxGain: null,
    masterGain: null,
    
    // Music state
    musicPlaying: false,
    musicIntervalId: null,
    nextChordTime: 0,
    currentChordIndex: 0,
    activeOscillators: [],
    
    // Volume state
    settings: {
        musicVolume: 0.5,
        sfxVolume: 0.7,
        muted: false
    },

    // Ambient chord frequencies (Hz)
    CHORDS: [
        [130.81, 196.00, 246.94, 293.66, 329.63], // Cmaj9: C3, G3, B3, D4, E4
        [174.61, 261.63, 329.63, 392.00, 440.00], // Fmaj9: F3, C4, E4, G4, A4
        [110.00, 164.81, 196.00, 246.94, 261.63], // Am9: A2, E3, G3, B3, C4
        [98.00, 146.83, 185.00, 220.00, 246.94, 329.63] // G6/9: G2, D3, F#3, A3, B3, E4
    ],

    /**
     * Lazy initializes the AudioContext after user interaction
     */
    init() {
        if (this.audioCtx) return;

        // Create AudioContext
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
            console.warn("Web Audio API is not supported in this browser.");
            return;
        }

        try {
            this.audioCtx = new AudioContextClass();
        } catch (e) {
            console.error("Failed to initialize AudioContext", e);
            return;
        }

        // Load settings from storage
        const savedSettings = Storage.getSettings();
        this.settings.musicVolume = savedSettings.musicVolume;
        this.settings.sfxVolume = savedSettings.sfxVolume;
        
        // Setup Gain Nodes
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.connect(this.audioCtx.destination);
        this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

        this.musicGain = this.audioCtx.createGain();
        this.musicGain.connect(this.masterGain);
        this.musicGain.gain.setValueAtTime(this.settings.musicVolume, this.audioCtx.currentTime);

        this.sfxGain = this.audioCtx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.sfxGain.gain.setValueAtTime(this.settings.sfxVolume, this.audioCtx.currentTime);
        
        // Start background scheduler
        this.startScheduler();
    },

    /**
     * Resumes AudioContext if suspended (browser security policy)
     */
    resume() {
        this.init();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    /**
     * Start/stop music looping
     */
    toggleMusic(play) {
        this.resume();
        if (play) {
            if (!this.musicPlaying) {
                this.musicPlaying = true;
                if (this.audioCtx) {
                    this.nextChordTime = this.audioCtx.currentTime + 0.1;
                    this.scheduleNextChord();
                }
            }
        } else {
            this.musicPlaying = false;
            this.stopAllActiveNotes();
        }
    },

    /**
     * Schedules procedural chord progressions in the future
     */
    startScheduler() {
        // Run tick every 500ms to queue chords in advance
        setInterval(() => {
            if (!this.musicPlaying || !this.audioCtx) return;
            
            const scheduleAheadTime = 1.5; // Look ahead 1.5 seconds
            while (this.nextChordTime < this.audioCtx.currentTime + scheduleAheadTime) {
                this.scheduleNextChord();
            }
        }, 500);
    },

    /**
     * Schedules a single beautiful chord pad
     */
    scheduleNextChord() {
        const chord = this.CHORDS[this.currentChordIndex];
        const chordDuration = 7.0; // Seconds the chord lasts
        const startTime = this.nextChordTime;
        
        // Low pass filter to make the chords warm, ambient, and soft
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, startTime);
        filter.Q.setValueAtTime(1.0, startTime);
        filter.connect(this.musicGain);

        const chordOscillators = [];
        
        // Trigger each note in the chord
        chord.forEach((freq, index) => {
            const osc = this.audioCtx.createOscillator();
            const gainNode = this.audioCtx.createGain();
            
            // Warm waves: use triangle for smooth warmth, mix in a soft sine or sub-bass for low notes
            osc.type = index === 0 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);
            
            // Micro-detune to create a chorus effect
            if (index > 0) {
                osc.detune.setValueAtTime(Utils.randomRange(-8, 8), startTime);
            }

            // Slow fade in and fade out envelope for ambient pad feel
            const attack = 2.5; // Fade-in time
            const decay = 2.5;  // Fade-out time
            const sustain = chordDuration - attack - decay;

            gainNode.gain.setValueAtTime(0, startTime);
            // Ramp up
            gainNode.gain.linearRampToValueAtTime(0.04, startTime + attack);
            // Hold and ramp down
            gainNode.gain.setValueAtTime(0.04, startTime + attack + sustain);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + chordDuration);

            osc.connect(gainNode);
            gainNode.connect(filter);
            
            osc.start(startTime);
            osc.stop(startTime + chordDuration);

            chordOscillators.push(osc);
        });

        // Store active oscillators so we can stop them if music is muted/paused
        this.activeOscillators.push({
            endTime: startTime + chordDuration,
            oscillators: chordOscillators
        });

        // Move scheduler timing forward
        this.nextChordTime += chordDuration - 1.0; // 1 second overlap for crossfade
        this.currentChordIndex = (this.currentChordIndex + 1) % this.CHORDS.length;

        // Clean up finished oscillators from list
        this.activeOscillators = this.activeOscillators.filter(item => {
            return item.endTime > this.audioCtx.currentTime;
        });
    },

    /**
     * Immediately stops all currently playing music oscillators
     */
    stopAllActiveNotes() {
        this.activeOscillators.forEach(item => {
            item.oscillators.forEach(osc => {
                try {
                    osc.stop();
                } catch (e) {}
            });
        });
        this.activeOscillators = [];
    },

    /**
     * Plays a synthesized game sound effect
     */
    playSFX(type) {
        this.resume();
        if (!this.audioCtx || this.settings.muted) return;

        const time = this.audioCtx.currentTime;
        
        switch (type) {
            case 'click': {
                // Short, high-passed click
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, time);
                osc.frequency.exponentialRampToValueAtTime(150, time + 0.05);

                gain.gain.setValueAtTime(0.3, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

                osc.connect(gain);
                gain.connect(this.sfxGain);

                osc.start(time);
                osc.stop(time + 0.06);
                break;
            }

            case 'snap': {
                // Satisfying wood-like wooden block snap
                const osc = this.audioCtx.createOscillator();
                const filter = this.audioCtx.createBiquadFilter();
                const gain = this.audioCtx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(400, time);
                osc.frequency.exponentialRampToValueAtTime(100, time + 0.08);

                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(500, time);
                filter.Q.setValueAtTime(5.0, time);

                gain.gain.setValueAtTime(0.8, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxGain);

                osc.start(time);
                osc.stop(time + 0.09);
                break;
            }

            case 'correct': {
                // Beautiful rising pentatonic major arpeggio
                const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
                notes.forEach((freq, idx) => {
                    const noteTime = time + idx * 0.06;
                    const osc = this.audioCtx.createOscillator();
                    const gain = this.audioCtx.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, noteTime);
                    osc.frequency.exponentialRampToValueAtTime(freq * 1.05, noteTime + 0.2);

                    gain.gain.setValueAtTime(0.0, noteTime);
                    gain.gain.linearRampToValueAtTime(0.15, noteTime + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.22);

                    osc.connect(gain);
                    gain.connect(this.sfxGain);

                    osc.start(noteTime);
                    osc.stop(noteTime + 0.23);
                });
                break;
            }

            case 'wrong': {
                // Flat low-frequency double vibration buzz
                const notes = [130, 120];
                notes.forEach((freq, idx) => {
                    const noteTime = time + idx * 0.1;
                    const osc = this.audioCtx.createOscillator();
                    const gain = this.audioCtx.createGain();
                    
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(freq, noteTime);
                    
                    gain.gain.setValueAtTime(0.15, noteTime);
                    gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.12);

                    osc.connect(gain);
                    gain.connect(this.sfxGain);

                    osc.start(noteTime);
                    osc.stop(noteTime + 0.13);
                });
                break;
            }

            case 'victory': {
                // Epic triumphant major brass arpeggio
                const notes = [
                    { f: 261.63, delay: 0 },    // C4
                    { f: 329.63, delay: 0.15 }, // E4
                    { f: 392.00, delay: 0.3 },  // G4
                    { f: 523.25, delay: 0.45 }, // C5
                    { f: 659.25, delay: 0.60 }, // E5
                    { f: 783.99, delay: 0.75 }  // G5
                ];
                
                notes.forEach(note => {
                    const noteTime = time + note.delay;
                    const osc = this.audioCtx.createOscillator();
                    const gain = this.audioCtx.createGain();
                    
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(note.f, noteTime);
                    
                    // Add slight detuned oscillator for thickness
                    const oscDetune = this.audioCtx.createOscillator();
                    oscDetune.type = 'sine';
                    oscDetune.frequency.setValueAtTime(note.f + 3, noteTime);
                    
                    gain.gain.setValueAtTime(0, noteTime);
                    gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.05);
                    gain.gain.setValueAtTime(0.2, noteTime + 0.3);
                    gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 1.2);

                    osc.connect(gain);
                    oscDetune.connect(gain);
                    gain.connect(this.sfxGain);

                    osc.start(noteTime);
                    oscDetune.start(noteTime);
                    osc.stop(noteTime + 1.25);
                    oscDetune.stop(noteTime + 1.25);
                });
                break;
            }
        }
    },

    /**
     * Dynamically sets background music volume
     */
    setMusicVolume(vol) {
        this.settings.musicVolume = vol;
        if (this.musicGain && this.audioCtx) {
            this.musicGain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        }
    },

    /**
     * Dynamically sets Sound FX volume
     */
    setSFXVolume(vol) {
        this.settings.sfxVolume = vol;
        if (this.sfxGain && this.audioCtx) {
            this.sfxGain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        }
    },

    /**
     * Toggles master mute
     */
    toggleMute(isMuted) {
        this.settings.muted = isMuted;
        if (this.masterGain && this.audioCtx) {
            const val = isMuted ? 0 : 1;
            this.masterGain.gain.setValueAtTime(val, this.audioCtx.currentTime);
        }
    }
};

window.AudioManager = AudioManager;
