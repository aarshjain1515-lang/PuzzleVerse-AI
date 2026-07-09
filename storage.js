/**
 * PuzzleVerse AI - Storage Module
 * Manages LocalStorage persistence for settings, stats, scores, progress, and achievements.
 */

const Storage = {
    PREFIX: 'puzzleverse_',

    // Default settings
    DEFAULTS: {
        settings: {
            theme: 'dark', // 'dark', 'light', 'high-contrast'
            musicVolume: 0.5,
            sfxVolume: 0.7,
            animations: true,
            language: 'en',
            difficulty: 'easy'
        },
        achievements: {
            first_puzzle: { unlocked: false, name: "First Pieces", desc: "Complete your first puzzle", unlockedAt: null },
            puzzle_master: { unlocked: false, name: "Puzzle Master", desc: "Complete a puzzle on Hard difficulty or higher", unlockedAt: null },
            fast_solver: { unlocked: false, name: "Speed Demon", desc: "Complete a puzzle in under 60 seconds", unlockedAt: null },
            no_hint_winner: { unlocked: false, name: "Pure Intellect", desc: "Solve a Medium or harder puzzle without using hints", unlockedAt: null },
            perfect_accuracy: { unlocked: false, name: "Sniper accuracy", desc: "Solve a puzzle with over 90% snap accuracy", unlockedAt: null }
        },
        profile: {
            username: '',
            avatar: '🚀',
            xp: 0,
            level: 1
        },
        campaign: {
            completedLevels: {}, // "level_1" -> { stars: 3, score: 2800 }
            unlockedCount: 1     // Level 1 is unlocked initially
        },
        scores: {}, // Keyed by difficulty_mode. e.g. "medium_classic" -> { bestTime: 120, bestMoves: 24, bestScore: 2500 }
        progress: null // Holds serialized current game state if in progress
    },

    /**
     * Initializes Storage. Merges defaults with saved values.
     */
    init() {
        if (!this.get('settings')) {
            this.set('settings', this.DEFAULTS.settings);
        } else {
            // Merge defaults to support future setting expansion
            const current = this.get('settings');
            this.set('settings', { ...this.DEFAULTS.settings, ...current });
        }

        if (!this.get('achievements')) {
            this.set('achievements', this.DEFAULTS.achievements);
        } else {
            // Merge in case achievements list changes
            const current = this.get('achievements');
            const merged = { ...this.DEFAULTS.achievements };
            for (const key in current) {
                if (merged[key]) {
                    merged[key] = { ...merged[key], ...current[key] };
                }
            }
            this.set('achievements', merged);
        }

        if (!this.get('profile')) {
            this.set('profile', this.DEFAULTS.profile);
        }

        if (!this.get('campaign')) {
            this.set('campaign', this.DEFAULTS.campaign);
        }

        if (!this.get('scores')) {
            this.set('scores', this.DEFAULTS.scores);
        }
    },

    /**
     * Set a value in LocalStorage.
     */
    set(key, value) {
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.error("LocalStorage set error: ", e);
        }
    },

    /**
     * Get a value from LocalStorage.
     */
    get(key) {
        try {
            const data = localStorage.getItem(this.PREFIX + key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error("LocalStorage get error: ", e);
            return null;
        }
    },

    /**
     * Removes a key from LocalStorage.
     */
    remove(key) {
        localStorage.removeItem(this.PREFIX + key);
    },

    /**
     * Updates settings.
     */
    saveSettings(settings) {
        const current = this.get('settings') || this.DEFAULTS.settings;
        this.set('settings', { ...current, ...settings });
    },

    /**
     * Gets settings.
     */
    getSettings() {
        return this.get('settings') || this.DEFAULTS.settings;
    },

    /**
     * Saves a high score. Returns true if it's a new personal best.
     */
    saveScore(difficulty, mode, time, moves, score) {
        const scores = this.get('scores') || {};
        const key = `${difficulty}_${mode}`;
        const prev = scores[key];
        
        let isNewBest = false;
        if (!prev) {
            scores[key] = { bestTime: time, bestMoves: moves, bestScore: score };
            isNewBest = true;
        } else {
            const updated = { ...prev };
            if (time < prev.bestTime) {
                updated.bestTime = time;
                isNewBest = true;
            }
            if (moves < prev.bestMoves) {
                updated.bestMoves = moves;
                isNewBest = true;
            }
            if (score > prev.bestScore) {
                updated.bestScore = score;
                isNewBest = true;
            }
            scores[key] = updated;
        }

        this.set('scores', scores);
        return isNewBest;
    },

    /**
     * Gets high score for a specific difficulty and mode.
     */
    getScore(difficulty, mode) {
        const scores = this.get('scores') || {};
        return scores[`${difficulty}_${mode}`] || null;
    },

    /**
     * Gets all scores.
     */
    getAllScores() {
        return this.get('scores') || {};
    },

    /**
     * Unlocks an achievement. Returns true if newly unlocked.
     */
    unlockAchievement(id) {
        const achievements = this.get('achievements') || this.DEFAULTS.achievements;
        if (achievements[id] && !achievements[id].unlocked) {
            achievements[id].unlocked = true;
            achievements[id].unlockedAt = new Date().toISOString();
            this.set('achievements', achievements);
            Utils.showToast(`🏆 Achievement Unlocked: ${achievements[id].name}!`);
            return true;
        }
        return false;
    },

    /**
     * Gets achievements list.
     */
    getAchievements() {
        return this.get('achievements') || this.DEFAULTS.achievements;
    },

    /**
     * Saves current game state for resuming later.
     */
    saveProgress(state) {
        this.set('progress', state);
    },

    /**
     * Gets current game state.
     */
    getProgress() {
        return this.get('progress');
    },

    getProfile() {
        return this.get('profile') || this.DEFAULTS.profile;
    },

    saveProfile(profile) {
        const current = this.getProfile();
        this.set('profile', { ...current, ...profile });
    },

    /**
     * Adds XP and handles leveling up.
     * Returns level up info.
     */
    addXP(amount) {
        const profile = this.getProfile();
        profile.xp += amount;
        
        let leveledUp = false;
        const oldLevel = profile.level;
        
        // Level threshold: level 1 = 600xp, level 2 = 1200xp...
        while (profile.xp >= profile.level * 600) {
            profile.xp -= profile.level * 600;
            profile.level++;
            leveledUp = true;
        }
        
        this.saveProfile(profile);
        
        if (leveledUp) {
            Utils.showToast(`🎉 LEVEL UP! You reached Level ${profile.level}!`);
        }
        
        return {
            leveledUp,
            oldLevel,
            newLevel: profile.level,
            xpGained: amount
        };
    },

    getCampaign() {
        return this.get('campaign') || this.DEFAULTS.campaign;
    },

    saveCampaign(campaign) {
        const current = this.getCampaign();
        this.set('campaign', { ...current, ...campaign });
    },

    /**
     * Marks a campaign level as complete. Unlocks next.
     */
    completeCampaignLevel(levelNumber, stars, score) {
        const campaign = this.getCampaign();
        const levelId = `level_${levelNumber}`;
        
        const prevRecord = campaign.completedLevels[levelId];
        let isNewRecord = false;
        
        if (!prevRecord) {
            campaign.completedLevels[levelId] = { stars, score };
            isNewRecord = true;
        } else {
            const updated = { ...prevRecord };
            if (stars > prevRecord.stars) updated.stars = stars;
            if (score > prevRecord.score) {
                updated.score = score;
                isNewRecord = true;
            }
            campaign.completedLevels[levelId] = updated;
        }

        // Unlock next level
        const nextLevel = levelNumber + 1;
        if (nextLevel <= 12 && campaign.unlockedCount < nextLevel) {
            campaign.unlockedCount = nextLevel;
            Utils.showToast(`🔓 Level ${nextLevel} Unlocked!`);
        }

        this.saveCampaign(campaign);
        return isNewRecord;
    },

    /**
     * Clears current game state.
     */
    clearProgress() {
        this.remove('progress');
    },

    /**
     * Resets all storage to default settings.
     */
    resetAll() {
        localStorage.clear();
        this.init();
        Utils.showToast("All progress, achievements, and settings have been reset.");
    }
};

// Initialize Storage
Storage.init();
