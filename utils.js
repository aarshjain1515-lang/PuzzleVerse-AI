/**
 * PuzzleVerse AI - Utilities Module
 * Contains helper functions for math, graphics, and performance.
 */

// Canvas roundRect polyfill for older browsers compatibility
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (r === undefined) r = 0;
        if (typeof r === 'number') {
            r = { tl: r, tr: r, br: r, bl: r };
        } else {
            r = Object.assign({ tl: 0, tr: 0, br: 0, bl: 0 }, r);
        }
        this.moveTo(x + r.tl, y);
        this.lineTo(x + w - r.tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
        this.lineTo(x + w, y + h - r.br);
        this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
        this.lineTo(x + r.bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
        this.lineTo(x, y + r.tl);
        this.quadraticCurveTo(x, y, x + r.tl, y);
        return this;
    };
}

const Utils = {
    /**
     * Clamps a value between a min and max.
     */
    clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    },

    /**
     * Linearly interpolates between two values.
     */
    lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    },

    /**
     * Calculates Euclidean distance between two points.
     */
    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    /**
     * Generates a random float in [min, max).
     */
    randomRange(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Generates a random integer in [min, max].
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Compresses an image file before usage using Canvas API.
     * Returns a Promise that resolves to a DataURL.
     */
    compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    // Calculate new dimensions
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    // Draw to canvas for compression
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Export compressed version
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    },

    /**
     * Formats elapsed seconds into MM:SS format.
     */
    formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    },

    /**
     * Returns a random item from an array.
     */
    randomChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    /**
     * Shuffles an array in place (Fisher-Yates).
     */
    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    /**
     * Triggers a browser native share or copies score text.
     */
    shareScore(score, moves, timeStr, mode, difficulty) {
        const text = `🌌 PuzzleVerse AI 🌌\nI completed a ${difficulty} puzzle in ${mode} mode!\n🏆 Score: ${score}\n⏱️ Time: ${timeStr}\n🎯 Moves: ${moves}\nPlay here and make your own puzzles! 🚀`;
        
        if (navigator.share) {
            navigator.share({
                title: 'My PuzzleVerse AI Score',
                text: text,
                url: window.location.href
            }).catch(() => {
                this.copyToClipboard(text);
            });
        } else {
            this.copyToClipboard(text);
        }
    },

    /**
     * Copy text to clipboard and show toast fallback.
     */
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast("Score copied to clipboard! Share it with friends.");
        }).catch(() => {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                this.showToast("Score copied to clipboard! Share it with friends.");
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
            }
            document.body.removeChild(textArea);
        });
    },

    /**
     * Shows a glassmorphic toast notification.
     */
    showToast(message, duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.zIndex = '9999';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'glass-toast';
        toast.style.background = 'rgba(25, 20, 40, 0.75)';
        toast.style.backdropFilter = 'blur(10px)';
        toast.style.border = '1px solid rgba(255, 255, 255, 0.15)';
        toast.style.borderRadius = '12px';
        toast.style.color = '#ffffff';
        toast.style.padding = '12px 24px';
        toast.style.fontSize = '0.9rem';
        toast.style.fontFamily = "'Outfit', sans-serif";
        toast.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.37)';
        toast.style.transform = 'translateY(50px)';
        toast.style.opacity = '0';
        toast.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        toast.innerText = message;

        container.appendChild(toast);

        // Force reflow and animate in
        setTimeout(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        }, 10);

        // Slide out and remove
        setTimeout(() => {
            toast.style.transform = 'translateY(-20px)';
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
                if (container.children.length === 0) {
                    container.remove();
                }
            }, 400);
        }, duration);
    }
};

window.Utils = Utils;
