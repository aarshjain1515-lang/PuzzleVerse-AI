/**
 * PuzzleVerse AI - Main Application Controller
 * Orchestrates screen switching, event bindings, settings, achievements, levels, and profiles.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate game engine
    const game = new PuzzleGame('game-canvas', 'board-container');
    
    // Background animation
    const bgCanvas = document.getElementById('bg-particle-canvas');
    let bgParticles = null;
    if (bgCanvas) {
        bgParticles = new BackgroundParticles(bgCanvas);
        bgParticles.start();
    }

    // Application state
    let selectedImageSrc = '';
    let currentTheme = 'dark';
    let activeCampaignLevel = null; // null if Quick Play

    // Campaign levels config
    const CAMPAIGN_LEVELS = [
        { num: 1, title: "Neon Beginnings", image: "assets/images/nebula.png", mode: "classic", difficulty: "easy" },
        { num: 2, title: "Sliding Blocks", image: "assets/images/castle.png", mode: "sliding", difficulty: "easy" },
        { num: 3, title: "Memory Woods", image: "assets/images/forest.png", mode: "memory", difficulty: "easy" },
        { num: 4, title: "Rotated Cosmos", image: "assets/images/nebula.png", mode: "rotate", difficulty: "easy" },
        { num: 5, title: "Speedy Castle", image: "assets/images/castle.png", mode: "speed", difficulty: "easy" },
        { num: 6, title: "Abstract Grid", image: "assets/images/abstract.png", mode: "classic", difficulty: "medium" },
        { num: 7, title: "Nebula Twist", image: "assets/images/nebula.png", mode: "rotate", difficulty: "medium" },
        { num: 8, title: "Castle Slide II", image: "assets/images/castle.png", mode: "sliding", difficulty: "medium" },
        { num: 9, title: "Memory Geometry", image: "assets/images/abstract.png", mode: "memory", difficulty: "medium" },
        { num: 10, title: "Speedy Forest", image: "assets/images/forest.png", mode: "speed", difficulty: "medium" },
        { num: 11, title: "Abstract Twist II", image: "assets/images/abstract.png", mode: "rotate", difficulty: "hard" },
        { num: 12, title: "Cosmic Finale", image: "assets/images/nebula.png", mode: "classic", difficulty: "hard" }
    ];

    // Elements
    const screens = document.querySelectorAll('.screen');
    const setupModal = document.getElementById('setup-modal');
    
    // ==============================================
    // SCREEN ROUTING SYSTEM
    // ==============================================
    function showScreen(screenId) {
        screens.forEach(s => s.classList.remove('active'));
        const activeScreen = document.getElementById(screenId);
        if (activeScreen) {
            activeScreen.classList.add('active');
            
            // Auto-reset scroll position of scrollable container inside active screen
            const scrollContainer = activeScreen.querySelector('.scroll-container');
            if (scrollContainer) {
                scrollContainer.scrollTop = 0;
            }
        }

        // Optimize CPU: only animate background particles on menu screens
        if (bgParticles) {
            if (screenId === 'landing-screen' || screenId === 'gallery-screen' || screenId === 'settings-screen' || screenId === 'about-screen' || screenId === 'leaderboard-screen' || screenId === 'campaign-screen' || screenId === 'login-screen') {
                bgParticles.start();
            } else {
                bgParticles.stop();
            }
        }

        // Specific screen initializations
        if (screenId === 'settings-screen') {
            renderAchievements();
        } else if (screenId === 'leaderboard-screen') {
            renderLeaderboard();
        } else if (screenId === 'campaign-screen') {
            renderCampaignMap();
        } else if (screenId === 'game-screen') {
            // Force game board recalculation
            setTimeout(() => {
                game.resizeBoard();
                game.draw();
            }, 50);
        }
    }

    // Bind Back Buttons
    const backBtnMappings = [
        { btn: 'gallery-back', target: 'landing-screen' },
        { btn: 'settings-back', target: 'landing-screen' },
        { btn: 'about-back', target: 'landing-screen' },
        { btn: 'leaderboard-back', target: 'landing-screen' }
    ];
    backBtnMappings.forEach(mapping => {
        const btn = document.getElementById(mapping.btn);
        if (btn) {
            btn.addEventListener('click', () => {
                AudioManager.playSFX('click');
                showScreen(mapping.target);
            });
        }
    });

    // Menu Navigation
    document.getElementById('menu-campaign').addEventListener('click', () => {
        AudioManager.playSFX('click');
        showScreen('campaign-screen');
    });

    document.getElementById('menu-play').addEventListener('click', () => {
        AudioManager.playSFX('click');
        activeCampaignLevel = null;
        document.getElementById('setup-title').innerText = "Puzzle Settings";
        showScreen('gallery-screen');
    });

    document.getElementById('menu-upload').addEventListener('click', () => {
        AudioManager.playSFX('click');
        activeCampaignLevel = null;
        showScreen('gallery-screen');
        // Instantly trigger input click
        document.getElementById('image-file-input').click();
    });

    document.getElementById('menu-gallery').addEventListener('click', () => {
        AudioManager.playSFX('click');
        showScreen('gallery-screen');
    });

    document.getElementById('menu-leaderboard').addEventListener('click', () => {
        AudioManager.playSFX('click');
        showScreen('leaderboard-screen');
    });

    document.getElementById('menu-settings').addEventListener('click', () => {
        AudioManager.playSFX('click');
        showScreen('settings-screen');
    });

    document.getElementById('menu-about').addEventListener('click', () => {
        AudioManager.playSFX('click');
        showScreen('about-screen');
    });

    document.getElementById('campaign-back').addEventListener('click', () => {
        AudioManager.playSFX('click');
        showScreen('landing-screen');
    });

    document.getElementById('campaign-btn-custom').addEventListener('click', () => {
        AudioManager.playSFX('click');
        activeCampaignLevel = null;
        showScreen('gallery-screen');
    });

    // ==============================================
    // IMAGE UPLOADER & CROPPER
    // ==============================================
    ImageUploader.init(
        'gallery-upload-box',
        'image-file-input',
        'crop-canvas',
        'crop-zoom'
    );

    // Override ImageUploader openCropper to route correctly
    const originalOpenCropper = ImageUploader.openCropper;
    ImageUploader.openCropper = function() {
        showScreen('cropper-screen');
        originalOpenCropper.call(ImageUploader);
    };

    document.getElementById('crop-cancel').addEventListener('click', () => {
        AudioManager.playSFX('click');
        ImageUploader.originalImage = null;
        showScreen('gallery-screen');
    });

    document.getElementById('crop-confirm').addEventListener('click', () => {
        AudioManager.playSFX('click');
        const croppedData = ImageUploader.crop();
        if (croppedData) {
            selectedImageSrc = croppedData;
            openSetupModal();
        } else {
            Utils.showToast("Failed to crop image.");
        }
    });

    // ==============================================
    // GALLERY IMAGE SELECTION
    // ==============================================
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            AudioManager.playSFX('click');
            galleryItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            
            // Read source
            selectedImageSrc = item.getAttribute('data-image');
            openSetupModal();
        });
    });

    // ==============================================
    // GALLERY FILTER CATEGORIES
    // ==============================================
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            AudioManager.playSFX('click');
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const category = tab.getAttribute('data-category');
            galleryItems.forEach(item => {
                const itemCategory = item.getAttribute('data-category');
                if (category === 'all' || itemCategory === category) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        });
    });

    // ==============================================
    // GAME SETUP MODAL
    // ==============================================
    function openSetupModal() {
        setupModal.classList.remove('hidden');
    }

    document.getElementById('setup-cancel').addEventListener('click', () => {
        AudioManager.playSFX('click');
        setupModal.classList.add('hidden');
        galleryItems.forEach(i => i.classList.remove('selected'));
    });

    document.getElementById('setup-start').addEventListener('click', () => {
        setupModal.classList.add('hidden');
        
        // Setup details
        const mode = document.getElementById('setup-mode').value;
        const difficulty = document.getElementById('setup-difficulty').value;

        // Switch to game dashboard screen
        showScreen('game-screen');
        
        // Start game
        game.init(selectedImageSrc, mode, difficulty, activeCampaignLevel);
        
        // Start background music loop
        const currentSettings = Storage.getSettings();
        if (currentSettings.musicVolume > 0) {
            AudioManager.toggleMusic(true);
        }
    });

    // ==============================================
    // GAMEPLAY HUD ACTIONS
    // ==============================================
    document.getElementById('game-btn-home').addEventListener('click', () => {
        AudioManager.playSFX('click');
        if (confirm("Are you sure you want to quit? Current progress will be lost.")) {
            game.stopTimer();
            AudioManager.toggleMusic(false);
            showScreen('landing-screen');
            // Hide overlays
            document.getElementById('pause-overlay').classList.add('hidden');
            document.getElementById('victory-overlay').classList.add('hidden');
        }
    });

    // Pause Screen Actions
    const pauseBtn = document.getElementById('game-btn-pause');
    const resumeBtn = document.getElementById('pause-resume');
    const restartBtn = document.getElementById('pause-restart');
    const quitBtn = document.getElementById('pause-menu');

    const handlePauseToggle = () => {
        AudioManager.playSFX('click');
        game.togglePause();
    };

    pauseBtn.addEventListener('click', handlePauseToggle);
    resumeBtn.addEventListener('click', handlePauseToggle);

    restartBtn.addEventListener('click', () => {
        AudioManager.playSFX('click');
        document.getElementById('pause-overlay').classList.add('hidden');
        game.init(game.imageSrc, game.mode, game.difficulty, game.campaignLevel);
    });

    quitBtn.addEventListener('click', () => {
        AudioManager.playSFX('click');
        game.stopTimer();
        AudioManager.toggleMusic(false);
        document.getElementById('pause-overlay').classList.add('hidden');
        showScreen('landing-screen');
    });

    // Preview hold logic
    const previewBtn = document.getElementById('game-btn-preview');
    const startPreview = () => {
        if (game.isFinished || game.isPaused) return;
        game.isPreviewing = true;
        game.draw();
    };
    const endPreview = () => {
        if (game.isFinished || game.isPaused) return;
        game.isPreviewing = false;
        game.draw();
    };
    previewBtn.addEventListener('mousedown', startPreview);
    previewBtn.addEventListener('mouseup', endPreview);
    previewBtn.addEventListener('mouseleave', endPreview);
    
    // Touch preview support
    previewBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startPreview();
    });
    previewBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        endPreview();
    });

    // Hint
    document.getElementById('game-btn-hint').addEventListener('click', () => {
        game.triggerHint();
    });

    // Shuffle
    document.getElementById('game-btn-shuffle').addEventListener('click', () => {
        AudioManager.playSFX('click');
        game.shufflePieces();
        game.undoStack = [];
        game.redoStack = [];
        game.saveStateToUndo();
        game.draw();
    });

    // Undo / Redo
    document.getElementById('game-btn-undo').addEventListener('click', () => {
        game.undo();
    });
    document.getElementById('game-btn-redo').addEventListener('click', () => {
        game.redo();
    });

    // Fullscreen toggle
    document.getElementById('game-btn-fullscreen').addEventListener('click', () => {
        AudioManager.playSFX('click');
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Mute SFX / volume toggle
    const muteBtn = document.getElementById('game-btn-mute');
    muteBtn.addEventListener('click', () => {
        const settings = Storage.getSettings();
        const isMuted = !settings.muted;
        Storage.saveSettings({ muted: isMuted });
        AudioManager.toggleMute(isMuted);
        
        // Update sound icon representation
        const soundSvg = document.getElementById('sound-svg');
        if (isMuted) {
            soundSvg.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
            AudioManager.toggleMusic(false); // also halt music immediately
        } else {
            soundSvg.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
            if (settings.musicVolume > 0) {
                AudioManager.toggleMusic(true);
            }
        }
    });

    // ==============================================
    // VICTORY OVERLAY REPLAY OVERRIDE
    // ==============================================
    document.getElementById('vic-replay').addEventListener('click', () => {
        AudioManager.playSFX('click');
        document.getElementById('victory-overlay').classList.add('hidden');
        // Restart with campaignLevel intact
        game.init(game.imageSrc, game.mode, game.difficulty, game.campaignLevel);
    });

    document.getElementById('vic-screenshot').addEventListener('click', () => {
        AudioManager.playSFX('click');
        game.downloadScreenshot();
    });

    document.getElementById('vic-share').addEventListener('click', () => {
        AudioManager.playSFX('click');
        const accPct = Math.round((game.correctPlacements / Math.max(1, game.totalPlacements)) * 100);
        Utils.shareScore(game.score, game.moves, Utils.formatTime(game.timer), game.mode, game.difficulty);
    });

    document.getElementById('vic-campaign-map').addEventListener('click', () => {
        AudioManager.playSFX('click');
        AudioManager.toggleMusic(false);
        document.getElementById('victory-overlay').classList.add('hidden');
        showScreen('campaign-screen');
    });

    document.getElementById('vic-menu').addEventListener('click', () => {
        AudioManager.playSFX('click');
        AudioManager.toggleMusic(false);
        document.getElementById('victory-overlay').classList.add('hidden');
        showScreen('landing-screen');
    });

    // Next Level Button Handler
    document.getElementById('vic-next-level').addEventListener('click', () => {
        AudioManager.playSFX('click');
        document.getElementById('victory-overlay').classList.add('hidden');
        
        // Find next level details
        const nextLvlNum = game.campaignLevel + 1;
        const nextLvl = CAMPAIGN_LEVELS.find(l => l.num === nextLvlNum);
        if (nextLvl) {
            activeCampaignLevel = nextLvl.num;
            selectedImageSrc = nextLvl.image;
            showScreen('game-screen');
            game.init(nextLvl.image, nextLvl.mode, nextLvl.difficulty, nextLvl.num);
        }
    });

    // ==============================================
    // LEADERBOARD RENDERING
    // ==============================================
    const filterMode = document.getElementById('leaderboard-filter-mode');
    const filterDiff = document.getElementById('leaderboard-filter-diff');

    filterMode.addEventListener('change', renderLeaderboard);
    filterDiff.addEventListener('change', renderLeaderboard);

    function renderLeaderboard() {
        const mode = filterMode.value;
        const diff = filterDiff.value;
        const tbody = document.getElementById('leaderboard-tbody');
        tbody.innerHTML = '';

        const score = Storage.getScore(diff, mode);
        
        if (score) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${diff.toUpperCase()} - ${mode.toUpperCase()}</td>
                <td style="color: var(--primary); font-weight:700;">${score.bestScore}</td>
                <td>${Utils.formatTime(score.bestTime)}</td>
                <td>${score.bestMoves}</td>
            `;
            tbody.appendChild(tr);
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--text-muted);">No records found. Play a game to record a score!</td>`;
            tbody.appendChild(tr);
        }
    }

    // ==============================================
    // SETTINGS EVENT BINDINGS
    // ==============================================
    const themeSelect = document.getElementById('settings-theme');
    const musicVolInput = document.getElementById('settings-music-volume');
    const sfxVolInput = document.getElementById('settings-sfx-volume');
    const animSelect = document.getElementById('settings-animations');
    
    const musicValLabel = document.getElementById('val-music-volume');
    const sfxValLabel = document.getElementById('val-sfx-volume');

    // Load initial settings
    const currentSettings = Storage.getSettings();
    themeSelect.value = currentSettings.theme;
    applyTheme(currentSettings.theme);

    musicVolInput.value = currentSettings.musicVolume;
    musicValLabel.innerText = `${Math.round(currentSettings.musicVolume * 100)}%`;
    
    sfxVolInput.value = currentSettings.sfxVolume;
    sfxValLabel.innerText = `${Math.round(currentSettings.sfxVolume * 100)}%`;
    
    animSelect.value = currentSettings.animations ? 'true' : 'false';

    // Theme Selector
    themeSelect.addEventListener('change', (e) => {
        AudioManager.playSFX('click');
        applyTheme(e.target.value);
        Storage.saveSettings({ theme: e.target.value });
    });

    function applyTheme(theme) {
        document.body.className = '';
        if (theme === 'light') {
            document.body.classList.add('light');
        } else if (theme === 'high-contrast') {
            document.body.classList.add('high-contrast');
        }
    }

    // Music Volume Slider
    musicVolInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        musicValLabel.innerText = `${Math.round(val * 100)}%`;
        AudioManager.setMusicVolume(val);
        Storage.saveSettings({ musicVolume: val });
        
        // Start/Stop music depending on volume slide
        if (val > 0 && game.canvas.parentNode.parentNode.classList.contains('active') && !game.isFinished && !game.isPaused) {
            AudioManager.toggleMusic(true);
        } else if (val === 0) {
            AudioManager.toggleMusic(false);
        }
    });

    // SFX Volume Slider
    sfxVolInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        sfxValLabel.innerText = `${Math.round(val * 100)}%`;
        AudioManager.setSFXVolume(val);
        Storage.saveSettings({ sfxVolume: val });
    });
    sfxVolInput.addEventListener('change', () => {
        // Trigger a test sound on release so user hears new SFX volume level
        AudioManager.playSFX('snap');
    });

    // Animations Toggle
    animSelect.addEventListener('change', (e) => {
        AudioManager.playSFX('click');
        const enabled = e.target.value === 'true';
        Storage.saveSettings({ animations: enabled });
    });

    // Reset progress
    document.getElementById('settings-btn-reset').addEventListener('click', () => {
        if (confirm("WARNING: This will permanently delete all achievements, settings, profile info, and campaign progression! Proceed?")) {
            Storage.resetAll();
            
            // Reload DOM settings representations
            const defaults = Storage.getSettings();
            themeSelect.value = defaults.theme;
            applyTheme(defaults.theme);
            musicVolInput.value = defaults.musicVolume;
            musicValLabel.innerText = `${Math.round(defaults.musicVolume * 100)}%`;
            sfxVolInput.value = defaults.sfxVolume;
            sfxValLabel.innerText = `${Math.round(defaults.sfxVolume * 100)}%`;
            animSelect.value = defaults.animations ? 'true' : 'false';

            renderAchievements();
            
            // Clear input fields and show login page
            document.getElementById('login-username').value = '';
            showScreen('login-screen');
        }
    });

    // ==============================================
    // ACHIEVEMENTS RENDERING
    // ==============================================
    function renderAchievements() {
        const list = document.getElementById('achievements-grid-list');
        list.innerHTML = '';

        const achievements = Storage.getAchievements();
        
        for (const id in achievements) {
            const achieve = achievements[id];
            const div = document.createElement('div');
            div.className = `achievement-card ${achieve.unlocked ? 'unlocked' : ''}`;
            
            // Trophy emoji or locking icon
            const icon = achieve.unlocked ? '🏆' : '🔒';
            const dateStr = achieve.unlockedAt 
                ? `<p style="font-size:0.75rem; color:var(--primary); margin-top:2px;">Unlocked: ${new Date(achieve.unlockedAt).toLocaleDateString()}</p>`
                : '';

            div.innerHTML = `
                <div class="achievement-icon">${icon}</div>
                <div class="achievement-info">
                    <h4>${achieve.name}</h4>
                    <p>${achieve.desc}</p>
                    ${dateStr}
                </div>
            `;
            list.appendChild(div);
        }
    }

    // ==============================================
    // USER PROFILE & LOGIN FLOW IMPLEMENTATION
    // ==============================================
    const avatarGridOptions = document.querySelectorAll('.avatar-option');
    let selectedAvatar = '🚀';

    avatarGridOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            AudioManager.playSFX('click');
            avatarGridOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedAvatar = opt.getAttribute('data-avatar');
        });
    });

    // Handle Login Submit
    document.getElementById('login-submit').addEventListener('click', () => {
        const usernameInput = document.getElementById('login-username');
        const username = usernameInput.value.trim();

        if (!username) {
            Utils.showToast("Gamer Tag cannot be empty!");
            return;
        }

        // Save new user profile
        Storage.saveProfile({
            username: username,
            avatar: selectedAvatar,
            xp: 0,
            level: 1
        });

        AudioManager.playSFX('correct');
        Utils.showToast(`Welcome Gamer, ${username}!`);
        
        updateProfileUI();
        showScreen('landing-screen');
    });

    // Sync profile displays in HTML
    function updateProfileUI() {
        const profile = Storage.getProfile();
        if (!profile.username) return;

        // Update landing profiles
        const landingProfName = document.getElementById('landing-prof-name');
        if (landingProfName) landingProfName.innerText = profile.username;
        const landingProfAvatar = document.getElementById('landing-prof-avatar');
        if (landingProfAvatar) landingProfAvatar.innerText = profile.avatar;
        const landingProfLvl = document.getElementById('landing-prof-lvl');
        if (landingProfLvl) landingProfLvl.innerText = profile.level;
        
        // XP progress bar
        const totalNeeded = profile.level * 600;
        const xpPct = (profile.xp / totalNeeded) * 100;
        const landingProfXp = document.getElementById('landing-prof-xp');
        if (landingProfXp) landingProfXp.style.width = `${xpPct}%`;

        // Update campaign profiles
        const campaignProfName = document.getElementById('campaign-prof-name');
        if (campaignProfName) campaignProfName.innerText = profile.username;
        const campaignProfAvatar = document.getElementById('campaign-prof-avatar');
        if (campaignProfAvatar) campaignProfAvatar.innerText = profile.avatar;
        const campaignProfLvl = document.getElementById('campaign-prof-lvl');
        if (campaignProfLvl) campaignProfLvl.innerText = profile.level;
    }

    // ==============================================
    // CAMPAIGN MAP RENDERING ENGINE
    // ==============================================
    function renderCampaignMap() {
        const levelMap = document.getElementById('campaign-level-map');
        if (!levelMap) return;
        
        levelMap.innerHTML = '';

        const campaign = Storage.getCampaign();
        const unlockedCount = campaign.unlockedCount;

        CAMPAIGN_LEVELS.forEach(level => {
            const isLocked = level.num > unlockedCount;
            const record = campaign.completedLevels[`level_${level.num}`];
            
            const node = document.createElement('div');
            node.className = `level-node ${isLocked ? 'locked' : ''}`;
            
            // Background image blur thumbnail
            const bgDiv = document.createElement('div');
            bgDiv.className = 'level-node-bg';
            bgDiv.style.backgroundImage = `url(${level.image})`;
            node.appendChild(bgDiv);

            // Level Info
            const infoDiv = document.createElement('div');
            infoDiv.className = 'level-node-info';
            
            const numSpan = document.createElement('span');
            numSpan.className = 'level-node-num';
            numSpan.innerText = level.num.toString().padStart(2, '0');
            infoDiv.appendChild(numSpan);

            const titleSpan = document.createElement('span');
            titleSpan.className = 'level-node-title';
            titleSpan.innerText = level.title;
            infoDiv.appendChild(titleSpan);

            const modeSpan = document.createElement('span');
            modeSpan.className = 'level-node-mode';
            modeSpan.innerText = `${level.mode} - ${level.difficulty.toUpperCase()}`;
            infoDiv.appendChild(modeSpan);

            // Stars rating if completed
            if (record) {
                const starsSpan = document.createElement('span');
                starsSpan.className = 'level-node-stars';
                let starChars = '';
                for (let i = 0; i < 5; i++) {
                    starChars += i < record.stars ? '★' : '☆';
                }
                starsSpan.innerText = starChars;
                infoDiv.appendChild(starsSpan);
            }

            node.appendChild(infoDiv);

            // Lock Overlay icon
            if (isLocked) {
                const lockDiv = document.createElement('div');
                lockDiv.className = 'level-node-lock-overlay';
                lockDiv.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>';
                node.appendChild(lockDiv);
            }

            // Click listener
            node.addEventListener('click', () => {
                if (isLocked) {
                    AudioManager.playSFX('wrong');
                    Utils.showToast(`Level ${level.num} is locked! Clear previous levels first.`);
                } else {
                    AudioManager.playSFX('click');
                    // Launch setup modal configured for this specific level
                    launchCampaignLevel(level);
                }
            });

            levelMap.appendChild(node);
        });
    }

    function launchCampaignLevel(level) {
        activeCampaignLevel = level.num;
        selectedImageSrc = level.image;

        // Switch to game dashboard screen instantly
        showScreen('game-screen');
        
        // Start game with pre-configured campaign mode & difficulty
        game.init(level.image, level.mode, level.difficulty, level.num);
        
        // Start background music loop if enabled
        const currentSettings = Storage.getSettings();
        if (currentSettings.musicVolume > 0) {
            AudioManager.toggleMusic(true);
        }
    }

    // ==============================================
    // WINDOW RESIZING & RESPONSIVENESS
    // ==============================================
    window.addEventListener('resize', () => {
        // Redraw active puzzle if currently in gameplay screen
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen && gameScreen.classList.contains('active')) {
            game.resizeBoard();
            game.draw();
        }
    });

    // Check Login Authenticator State on load
    const profile = Storage.getProfile();
    if (!profile.username) {
        showScreen('login-screen');
    } else {
        updateProfileUI();
        showScreen('landing-screen');
    }

    // Let the first user click wake up AudioContext (required by browsers autoplay policy)
    window.addEventListener('click', () => {
        AudioManager.resume();
    }, { once: true });

    window.addEventListener('touchstart', () => {
        AudioManager.resume();
    }, { once: true });
});
