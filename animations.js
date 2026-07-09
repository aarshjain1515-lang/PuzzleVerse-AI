/**
 * PuzzleVerse AI - Animations Module
 * High-performance canvas particles for chimes, snapping sparks, and victory confetti.
 */

const CanvasEffects = {
    canvas: null,
    ctx: null,
    particles: [],
    isActive: false,
    width: 0,
    height: 0,

    /**
     * Initializes the canvas and starts the animation loop if needed.
     */
    init() {
        if (this.canvas) return;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'effects-canvas';
        // Style it to overlay the entire screen
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '99999'; // Highest overlay
        document.body.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.resize();

        window.addEventListener('resize', () => this.resize());
    },

    /**
     * Resizes the canvas to full screen.
     */
    resize() {
        if (!this.canvas) return;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    },

    /**
     * Core animation loop. Shuts down when no particles remain.
     */
    loop() {
        if (!this.isActive) return;

        this.ctx.clearRect(0, 0, this.width, this.height);

        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Apply physics
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.alpha -= p.fade;
            p.rotation += p.spin;

            // Draw particle
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;

            if (p.shape === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.shape === 'star') {
                // Draw 4-point sparkle star
                this.ctx.beginPath();
                for (let k = 0; k < 4; k++) {
                    this.ctx.rotate(Math.PI / 2);
                    this.ctx.lineTo(p.size, 0);
                    this.ctx.lineTo(0, p.size / 4);
                }
                this.ctx.closePath();
                this.ctx.fill();
            } else {
                // Confetti rectangle
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
            }

            this.ctx.restore();

            // Remove dead particles
            if (p.alpha <= 0 || p.y > this.height + 20) {
                this.particles.splice(i, 1);
            }
        }

        if (this.particles.length === 0) {
            this.isActive = false;
            this.ctx.clearRect(0, 0, this.width, this.height);
        } else {
            requestAnimationFrame(() => this.loop());
        }
    },

    /**
     * Activates the particle system loop.
     */
    start() {
        if (!this.isActive) {
            this.isActive = true;
            this.loop();
        }
    },

    /**
     * Trigger a burst of sparkle particles when a piece snaps correctly.
     * x, y are absolute screen coordinates.
     */
    triggerSnapSparkles(x, y) {
        this.init();
        const colors = ['#00F2FE', '#4FACFE', '#FF0844', '#FFB199', '#FFF200', '#FAD961'];
        const count = Utils.randomInt(15, 25);

        for (let i = 0; i < count; i++) {
            const angle = Utils.randomRange(0, Math.PI * 2);
            const speed = Utils.randomRange(2, 6);
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.1, // slight gravity
                drag: 0.98,
                alpha: 1.0,
                fade: Utils.randomRange(0.015, 0.03),
                size: Utils.randomRange(3, 7),
                color: Utils.randomChoice(colors),
                shape: Utils.randomChoice(['circle', 'star']),
                rotation: Utils.randomRange(0, Math.PI * 2),
                spin: Utils.randomRange(-0.1, 0.1)
            });
        }
        this.start();
    },

    /**
     * Trigger an epic shower of victory confetti.
     */
    triggerVictoryConfetti() {
        this.init();
        const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#ffeb3b', '#ff9800'];
        const count = 120;

        // Emit from the left and right borders of the screen
        for (let i = 0; i < count; i++) {
            const fromLeft = Math.random() > 0.5;
            const x = fromLeft ? -10 : this.width + 10;
            const y = Utils.randomRange(this.height * 0.1, this.height * 0.5);
            
            // Adjust angles to shoot inwards and upwards
            const angle = fromLeft 
                ? Utils.randomRange(-Math.PI / 6, -Math.PI / 3) // shoot up-right
                : Utils.randomRange(-Math.PI * 2/3, -Math.PI * 5/6); // shoot up-left
            
            const speed = Utils.randomRange(10, 22);

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: 0.35, // fall down
                drag: 0.96,
                alpha: 1.0,
                fade: Utils.randomRange(0.005, 0.015),
                size: Utils.randomRange(6, 12),
                color: Utils.randomChoice(colors),
                shape: 'rect',
                rotation: Utils.randomRange(0, Math.PI * 2),
                spin: Utils.randomRange(-0.2, 0.2)
            });
        }
        this.start();
    },

    /**
     * Clears all active particles.
     */
    clear() {
        this.particles = [];
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }
        this.isActive = false;
    }
};

/**
 * Ambient background bubble animation manager for the landing page.
 */
class BackgroundParticles {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 40;
        this.active = false;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        this.width = this.canvas.offsetWidth;
        this.height = this.canvas.offsetHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    init() {
        this.particles = [];
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Utils.randomRange(1.5, 4.5),
                vx: Utils.randomRange(-0.3, 0.3),
                vy: Utils.randomRange(-0.4, -0.1), // slowly float up
                alpha: Utils.randomRange(0.1, 0.4),
                hue: Utils.randomChoice([210, 260, 280, 320]) // Blue/Purple/Magenta tones
            });
        }
    }

    start() {
        if (this.active) return;
        this.active = true;
        this.init();
        this.animate();
    }

    stop() {
        this.active = false;
    }

    animate() {
        if (!this.active) return;

        this.ctx.clearRect(0, 0, this.width, this.height);

        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            // Loop edges
            if (p.y < -10) {
                p.y = this.height + 10;
                p.x = Math.random() * this.width;
            }
            if (p.x < -10 || p.x > this.width + 10) {
                p.x = Math.random() * this.width;
            }

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${p.alpha})`;
            this.ctx.fill();
        });

        requestAnimationFrame(() => this.animate());
    }
}
