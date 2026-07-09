/**
 * PuzzleVerse AI - Puzzle Game Engine Module
 * Manages piece generation, board rendering, game modes, physics/snapping, and state tracking.
 */

class PuzzleGame {
    constructor(canvasId, containerId) {
        this.canvas = document.getElementById(canvasId);
        this.container = document.getElementById(containerId);
        this.ctx = this.canvas.getContext('2d');
        
        // Game Settings / Parameters
        this.mode = 'classic'; // 'classic', 'rotate', 'sliding', 'memory', 'speed'
        this.difficulty = 'easy'; // 'easy', 'medium', 'hard', 'expert', 'master', 'impossible'
        this.imageSrc = ''; // Current puzzle image dataURL/URL
        this.imageElement = null;
        
        // Grid size lookup
        this.difficultyGrid = {
            easy: { r: 3, c: 3 },
            medium: { r: 4, c: 4 },
            hard: { r: 5, c: 5 },
            expert: { r: 6, c: 6 },
            master: { r: 8, c: 8 },
            impossible: { r: 10, c: 10 }
        };

        // Engine State
        this.pieces = [];
        this.rows = 0;
        this.cols = 0;
        this.boardWidth = 0;
        this.boardHeight = 0;
        this.boardX = 0;
        this.boardY = 0;
        this.cellW = 0;
        this.cellH = 0;
        this.padding = 0; // Padding for piece tabs
        
        // Interaction State
        this.activePiece = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.hoveredPiece = null;
        
        // Sliding puzzle state
        this.emptyCell = { r: 0, c: 0 };
        
        // Memory match state
        this.selectedCards = [];
        this.lockBoard = false;
        
        // Gameplay Stats
        this.timer = 0;
        this.timerInterval = null;
        this.moves = 0;
        this.correctPlacements = 0;
        this.totalPlacements = 0; // Used for accuracy
        this.hintsUsed = 0;
        this.score = 0;
        this.isFinished = false;
        this.isPaused = false;
        
        // Undo/Redo stacks
        this.undoStack = [];
        this.redoStack = [];

        // Preview state
        this.isPreviewing = false;

        // Campaign progression
        this.campaignLevel = null;

        this.setupEvents();
    }

    /**
     * Initializes the puzzle board with chosen parameters.
     */
    init(imageSrc, mode, difficulty, campaignLevel = null) {
        this.imageSrc = imageSrc;
        this.mode = mode;
        this.difficulty = difficulty;
        this.campaignLevel = campaignLevel;
        
        const grid = this.difficultyGrid[difficulty];
        this.rows = grid.r;
        this.cols = grid.c;

        // Reset stats
        this.stopTimer();
        this.timer = 0;
        this.moves = 0;
        this.correctPlacements = 0;
        this.totalPlacements = 0;
        this.hintsUsed = 0;
        this.score = 0;
        this.isFinished = false;
        this.isPaused = false;
        this.isPreviewing = false;
        this.undoStack = [];
        this.redoStack = [];
        this.pieces = [];
        this.activePiece = null;
        this.selectedCards = [];
        this.lockBoard = false;

        // Update UI
        this.updateStatsUI();

        // Load image
        const img = new Image();
        img.src = imageSrc;
        img.onload = () => {
            this.imageElement = img;
            this.resizeBoard();
            this.generatePieces();
            this.shufflePieces();
            this.saveStateToUndo();
            this.startTimer();
            this.draw();
            Utils.showToast(`Puzzle generated! Mode: ${mode.toUpperCase()} (${difficulty.toUpperCase()})`);
        };
        img.onerror = () => {
            Utils.showToast("Failed to load puzzle image.");
        };
    }

    /**
     * Calculates the game board scale, offsets, and centers it inside the responsive canvas.
     */
    resizeBoard() {
        if (!this.imageElement) return;

        // Make canvas fill container
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const w = rect.width;
        const h = rect.height;

        // Determine if screen layout is portrait (mobile/tablet portrait)
        const isPortrait = h > w || w < 768;

        // Scale board width: 85% on mobile portrait, 55% on landscape desktop
        const boardScale = isPortrait ? 0.85 : 0.55; 
        
        const imgAspect = 4 / 3; // Fixed crop aspect ratio
        let bw = w * boardScale;
        let bh = bw / imgAspect;

        // Restrict board height to leave tray space (45% max on portrait, 70% max on landscape)
        const maxHeightLimit = isPortrait ? 0.45 : 0.70;
        if (bh > h * maxHeightLimit) {
            bh = h * maxHeightLimit;
            bw = bh * imgAspect;
        }

        this.boardWidth = bw;
        this.boardHeight = bh;
        this.boardX = (w - bw) / 2;
        
        // Position board vertically
        if (isPortrait) {
            // Shift board up to leave ample space for the tray below
            this.boardY = Math.max(70, (h - bh) * 0.28);
        } else {
            this.boardY = (h - bh) / 2;
        }

        this.cellW = bw / this.cols;
        this.cellH = bh / this.rows;
        
        // Scale pieces padding proportional to cell size
        this.padding = Math.max(this.cellW, this.cellH) * 0.28;

        const oldCw = this.prevCanvasWidth || w;
        const oldCh = this.prevCanvasHeight || h;

        // If pieces exist, reposition them proportionally
        if (this.pieces.length > 0) {
            this.pieces.forEach(p => {
                // Keep relative coordinates relative to overall canvas dimensions to prevent drift
                const relCanvasX = p.x / oldCw;
                const relCanvasY = p.y / oldCh;

                p.cellW = this.cellW;
                p.cellH = this.cellH;
                p.padding = this.padding;
                p.width = this.cellW + this.padding * 2;
                p.height = this.cellH + this.padding * 2;

                p.targetX = this.boardX + p.col * this.cellW - p.padding;
                p.targetY = this.boardY + p.row * this.cellH - p.padding;

                if (p.isSnapped || this.mode === 'sliding' || this.mode === 'rotate') {
                    p.x = p.targetX;
                    p.y = p.targetY;
                } else {
                    // Update positions based on overall canvas scale and clamp inside new bounds
                    p.x = Utils.clamp(relCanvasX * w, 0, w - p.width); 
                    p.y = Utils.clamp(relCanvasY * h, 0, h - p.height); 
                }

                // Regenerate cropped sub-canvas
                p.canvas = this.createPieceCanvas(p);
            });
        }

        this.prevCanvasWidth = w;
        this.prevCanvasHeight = h;
    }

    /**
     * Generates jigsaw piece definitions (Classic, Rotate, Speed).
     * For Sliding/Memory, it generates standard rectangular grid cuts.
     */
    generatePieces() {
        this.pieces = [];
        
        // Step 1: Pre-generate edge tabs/slots configuration to guarantee match
        const edgesGrid = [];
        for (let r = 0; r < this.rows; r++) {
            edgesGrid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                edgesGrid[r][c] = { top: 0, right: 0, bottom: 0, left: 0 };
            }
        }

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                // Top edge
                if (r === 0) {
                    edgesGrid[r][c].top = 0; // Flat
                } else {
                    edgesGrid[r][c].top = -edgesGrid[r-1][c].bottom;
                }
                
                // Left edge
                if (c === 0) {
                    edgesGrid[r][c].left = 0; // Flat
                } else {
                    edgesGrid[r][c].left = -edgesGrid[r][c-1].right;
                }

                // Bottom edge
                if (r === this.rows - 1) {
                    edgesGrid[r][c].bottom = 0;
                } else {
                    edgesGrid[r][c].bottom = Math.random() > 0.5 ? 1 : -1;
                }

                // Right edge
                if (c === this.cols - 1) {
                    edgesGrid[r][c].right = 0;
                } else {
                    edgesGrid[r][c].right = Math.random() > 0.5 ? 1 : -1;
                }
            }
        }

        // Create padded source image canvas (aligned using source padding parameters)
        const srcCw = this.imageElement.width / this.cols;
        const srcCh = this.imageElement.height / this.rows;
        const srcPadding = Math.max(srcCw, srcCh) * 0.28;

        const paddedCanvas = document.createElement('canvas');
        paddedCanvas.width = this.imageElement.width + srcPadding * 2;
        paddedCanvas.height = this.imageElement.height + srcPadding * 2;
        const pCtx = paddedCanvas.getContext('2d');
        
        // Draw main image offset by source padding
        pCtx.drawImage(this.imageElement, srcPadding, srcPadding, this.imageElement.width, this.imageElement.height);

        // Render pieces
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const piece = {
                    id: `${r}_${c}`,
                    row: r,
                    col: c,
                    edges: edgesGrid[r][c],
                    isSnapped: false,
                    rotation: 0, // 0, 90, 180, 270
                    
                    // Display size
                    cellW: this.cellW,
                    cellH: this.cellH,
                    padding: this.padding,
                    width: this.cellW + this.padding * 2,
                    height: this.cellH + this.padding * 2,
                    
                    // Coordinates
                    x: 0,
                    y: 0,
                    targetX: this.boardX + c * this.cellW - this.padding,
                    targetY: this.boardY + r * this.cellH - this.padding,
                    
                    // For Memory Match cards
                    isFlipped: false,
                    isMatched: false
                };

                // Generate sub-canvas
                piece.canvas = this.createPieceCanvas(piece, paddedCanvas);
                this.pieces.push(piece);
            }
        }

        // If Sliding puzzle, save target empty cell (bottom-right)
        if (this.mode === 'sliding') {
            this.emptyCell = { r: this.rows - 1, c: this.cols - 1 };
            // Delete the last piece to create the sliding gap
            this.pieces = this.pieces.filter(p => !(p.row === this.emptyCell.r && p.col === this.emptyCell.c));
        }
    }

    /**
     * Creates an offscreen sub-canvas for a piece.
     * Masks the canvas with the jigsaw Bezier shape (or rectangular cuts if Sliding/Memory).
     */
    createPieceCanvas(piece, prebuiltPaddedCanvas = null) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = piece.width;
        offCanvas.height = piece.height;
        const offCtx = offCanvas.getContext('2d');

        // Draw path mask
        if (this.mode === 'sliding' || this.mode === 'memory') {
            // Draw simple rounded rect for sliding/cards
            offCtx.beginPath();
            const r = 8; // Border radius
            const w = piece.cellW;
            const h = piece.cellH;
            const p = piece.padding;
            offCtx.moveTo(p + r, p);
            offCtx.lineTo(p + w - r, p);
            offCtx.quadraticCurveTo(p + w, p, p + w, p + r);
            offCtx.lineTo(p + w, p + h - r);
            offCtx.quadraticCurveTo(p + w, p + h, p + w - r, p + h);
            offCtx.lineTo(p + r, p + h);
            offCtx.quadraticCurveTo(p, p + h, p, p + h - r);
            offCtx.lineTo(p, p + r);
            offCtx.quadraticCurveTo(p, p, p + r, p);
            offCtx.closePath();
        } else {
            // Draw beautiful detailed Jigsaw tab/slot Bezier path
            this.drawJigsawPath(offCtx, piece.cellW, piece.cellH, piece.edges, piece.padding);
        }

        // Clip and draw image
        offCtx.save();
        offCtx.clip();
        
        // Source crop calculations
        const srcCw = this.imageElement.width / this.cols;
        const srcCh = this.imageElement.height / this.rows;
        const srcPadding = Math.max(srcCw, srcCh) * 0.28;

        if (prebuiltPaddedCanvas) {
            // Read from pre-aligned padded canvas
            const srcX = piece.col * srcCw;
            const srcY = piece.row * srcCh;
            offCtx.drawImage(
                prebuiltPaddedCanvas,
                srcX, srcY, srcCw + srcPadding * 2, srcCh + srcPadding * 2,
                0, 0, piece.width, piece.height
            );
        } else {
            // Standard fallback drawing directly from original image
            // Note: edge distortion will occur at boundary tabs if padding crops out-of-bounds
            const srcX = piece.col * srcCw - srcPadding;
            const srcY = piece.row * srcCh - srcPadding;
            offCtx.drawImage(
                this.imageElement,
                srcX, srcY, srcCw + srcPadding * 2, srcCh + srcPadding * 2,
                0, 0, piece.width, piece.height
            );
        }
        offCtx.restore();

        // Draw piece outline for premium looks (glass shimmer border effect)
        if (this.mode !== 'sliding' && this.mode !== 'memory') {
            offCtx.save();
            offCtx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            offCtx.lineWidth = 1.5;
            offCtx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            offCtx.shadowBlur = 4;
            this.drawJigsawPath(offCtx, piece.cellW, piece.cellH, piece.edges, piece.padding);
            offCtx.stroke();
            offCtx.restore();
        }

        return offCanvas;
    }

    /**
     * Draws a continuous jigsaw tab/slot path using mathematical curves
     */
    drawJigsawPath(ctx, w, h, edges, padding) {
        const drawEdge = (length, thickness, type) => {
            if (type === 0) {
                ctx.lineTo(length, 0);
                return;
            }
            const s = -type; // -1 for tab (outward), 1 for slot (inward)
            
            ctx.lineTo(length * 0.35, 0);
            
            // Outer bulb neck curve
            ctx.bezierCurveTo(
                length * 0.34, s * thickness * 0.06,
                length * 0.38, s * thickness * 0.16,
                length * 0.44, s * thickness * 0.16
            );
            // Circle cap of the tab
            ctx.bezierCurveTo(
                length * 0.38, s * thickness * 0.28,
                length * 0.62, s * thickness * 0.28,
                length * 0.56, s * thickness * 0.16
            );
            // Closing bulb neck curve
            ctx.bezierCurveTo(
                length * 0.62, s * thickness * 0.16,
                length * 0.66, s * thickness * 0.06,
                length * 0.65, 0
            );
            ctx.lineTo(length, 0);
        };

        ctx.beginPath();

        // Top Edge
        ctx.save();
        ctx.translate(padding, padding);
        ctx.moveTo(0, 0);
        drawEdge(w, h, edges.top);
        ctx.restore();

        // Right Edge
        ctx.save();
        ctx.translate(padding + w, padding);
        ctx.rotate(Math.PI / 2);
        drawEdge(h, w, edges.right);
        ctx.restore();

        // Bottom Edge
        ctx.save();
        ctx.translate(padding + w, padding + h);
        ctx.rotate(Math.PI);
        drawEdge(w, h, edges.bottom);
        ctx.restore();

        // Left Edge
        ctx.save();
        ctx.translate(padding, padding + h);
        ctx.rotate(-Math.PI / 2);
        drawEdge(h, w, edges.left);
        ctx.restore();

        ctx.closePath();
    }

    /**
     * Scatters/Shuffles pieces based on the active mode.
     */
    shufflePieces() {
        const cw = this.canvas.width / window.devicePixelRatio;
        const ch = this.canvas.height / window.devicePixelRatio;

        if (this.mode === 'sliding') {
            // sliding puzzle shuffle must be solvable. We simulate sliding moves.
            const moves = 150;
            const dirs = [
                { r: -1, c: 0 }, { r: 1, c: 0 },
                { r: 0, c: -1 }, { r: 0, c: 1 }
            ];
            
            for (let i = 0; i < moves; i++) {
                const validDirs = dirs.filter(d => {
                    const nr = this.emptyCell.r + d.r;
                    const nc = this.emptyCell.c + d.c;
                    return nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols;
                });
                const dir = Utils.randomChoice(validDirs);
                this.slideTile(this.emptyCell.r + dir.r, this.emptyCell.c + dir.c, false);
            }
            
            // Anchor all tiles correctly inside the board grid
            this.pieces.forEach(p => {
                p.x = this.boardX + p.col * this.cellW - p.padding;
                p.y = this.boardY + p.row * this.cellH - p.padding;
            });
            this.moves = 0;
            return;
        }

        if (this.mode === 'memory') {
            // memory cards are placed face down in the board slots, shuffled index
            const positions = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    positions.push({ r, c });
                }
            }
            Utils.shuffleArray(positions);

            this.pieces.forEach((p, idx) => {
                const pos = positions[idx];
                p.row = pos.r;
                p.col = pos.c;
                p.x = this.boardX + pos.c * this.cellW - p.padding;
                p.y = this.boardY + pos.r * this.cellH - p.padding;
                p.isSnapped = false;
                p.isFlipped = false;
                p.isMatched = false;
            });
            return;
        }

        // Classic, Rotate, Speed modes: scatter pieces in tray/margins
        const isPortrait = ch > cw || cw < 768;

        this.pieces.forEach(p => {
            p.isSnapped = false;
            
            // Random rotation if Rotate mode
            if (this.mode === 'rotate') {
                p.rotation = Utils.randomChoice([0, 90, 180, 270]);
                // In pure Rotate puzzle, pieces are pre-placed in correct grid coordinates
                p.x = p.targetX;
                p.y = p.targetY;
            } else {
                p.rotation = 0;
                
                // Scatter pieces on canvas margins (outside board area)
                const margin = 15;
                let rx, ry;
                
                // Select scatter zone based on layout orientation
                const zone = isPortrait ? 'bottom' : Utils.randomChoice(['left', 'right', 'bottom']);
                
                if (zone === 'left') {
                    rx = Utils.randomRange(margin, this.boardX - p.width * 0.75);
                    ry = Utils.randomRange(margin, ch - p.height - margin);
                } else if (zone === 'right') {
                    rx = Utils.randomRange(this.boardX + this.boardWidth - p.width * 0.25, cw - p.width - margin);
                    ry = Utils.randomRange(margin, ch - p.height - margin);
                } else {
                    // Bottom tray
                    rx = Utils.randomRange(margin, cw - p.width - margin);
                    const minY = this.boardY + this.boardHeight - p.height * 0.2;
                    ry = Utils.randomRange(minY, ch - p.height - margin);
                }
                
                // Clamping to guarantee pieces are always in bounds
                p.x = Utils.clamp(rx, 0, cw - p.width);
                p.y = Utils.clamp(ry, 0, ch - p.height);
            }
        });
    }

    /**
     * Redraws the complete board, silhouettes, pieces, overlays.
     */
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);

        // 1. Draw glassmorphic board background grid
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight, 12);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();

        // 2. Draw outline grid guide lines inside board
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let r = 1; r < this.rows; r++) {
            this.ctx.moveTo(this.boardX, this.boardY + r * this.cellH);
            this.ctx.lineTo(this.boardX + this.boardWidth, this.boardY + r * this.cellH);
        }
        for (let c = 1; c < this.cols; c++) {
            this.ctx.moveTo(this.boardX + c * this.cellW, this.boardY);
            this.ctx.lineTo(this.boardX + c * this.cellW, this.boardY + this.boardHeight);
        }
        this.ctx.stroke();
        this.ctx.restore();

        // 2.1 Draw faint ghost background image guide (very helper friendly for kids)
        if (this.imageElement && !this.isFinished && this.mode !== 'memory') {
            this.ctx.save();
            this.ctx.globalAlpha = 0.08;
            this.ctx.drawImage(this.imageElement, this.boardX, this.boardY, this.boardWidth, this.boardHeight);
            this.ctx.restore();
        }

        // 2.2 Draw glowing neon grid slot indicator if dragging near target (magnetic helper)
        if (this.activePiece && this.mode !== 'sliding' && this.mode !== 'memory') {
            const dist = Utils.distance(this.activePiece.x, this.activePiece.y, this.activePiece.targetX, this.activePiece.targetY);
            const magnetRange = Math.max(70, this.cellW * 0.85);
            
            if (dist < magnetRange && (this.activePiece.rotation % 360) === 0) {
                this.ctx.save();
                this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.8)';
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = '#00f2fe';
                this.ctx.shadowBlur = 15;
                
                const gx = this.boardX + this.activePiece.col * this.cellW;
                const gy = this.boardY + this.activePiece.row * this.cellH;
                
                this.ctx.beginPath();
                this.ctx.roundRect(gx, gy, this.cellW, this.cellH, 8);
                this.ctx.stroke();
                this.ctx.restore();
            }
        }

        // 3. Draw image original preview if user is holding preview button
        if (this.isPreviewing && this.imageElement) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.35;
            this.ctx.drawImage(this.imageElement, this.boardX, this.boardY, this.boardWidth, this.boardHeight);
            this.ctx.restore();
        }

        // Sort pieces so: Snapped pieces first (bottom), Unsnapped second, Hovered third, Dragged last (top)
        const renderList = [...this.pieces];
        renderList.sort((a, b) => {
            if (a.isSnapped && !b.isSnapped) return -1;
            if (!a.isSnapped && b.isSnapped) return 1;
            
            // Active dragged piece is always on top
            if (a === this.activePiece) return 1;
            if (b === this.activePiece) return -1;
            
            // Hovered piece slightly on top of standard pieces
            if (a === this.hoveredPiece) return 1;
            if (b === this.hoveredPiece) return -1;
            
            return 0;
        });

        // 4. Render pieces
        renderList.forEach(p => {
            this.ctx.save();

            const cx = p.x + p.width / 2;
            const cy = p.y + p.height / 2;

            this.ctx.translate(cx, cy);

            if (p.rotation !== 0) {
                this.ctx.rotate((p.rotation * Math.PI) / 180);
            }

            // Apply dragging hover scale & shadow effects
            if (p === this.activePiece) {
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                this.ctx.shadowBlur = 20;
                this.ctx.shadowOffsetX = 8;
                this.ctx.shadowOffsetY = 12;
                this.ctx.scale(1.1, 1.1); // Enlarge slightly
            } else if (!p.isSnapped && p === this.hoveredPiece) {
                this.ctx.shadowColor = 'rgba(0, 242, 254, 0.4)';
                this.ctx.shadowBlur = 10;
            } else if (!p.isSnapped) {
                this.ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
                this.ctx.shadowBlur = 6;
                this.ctx.shadowOffsetY = 4;
            }

            // Draw Card Background if Memory Mode & Face Down
            if (this.mode === 'memory' && !p.isFlipped && !p.isMatched) {
                // Card back design
                this.ctx.fillStyle = 'rgba(30, 25, 50, 0.9)';
                this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.roundRect(-p.cellW / 2, -p.cellH / 2, p.cellW, p.cellH, 8);
                this.ctx.fill();
                this.ctx.stroke();

                // Abstract center logo glow
                this.ctx.fillStyle = 'rgba(0, 242, 254, 0.15)';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, Math.min(p.cellW, p.cellH) * 0.2, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Draw piece canvas (reveals piece image)
                this.ctx.drawImage(p.canvas, -p.width / 2, -p.height / 2);
            }

            this.ctx.restore();
        });
    }

    /**
     * Mouse & Touch Events Handler
     */
    setupEvents() {
        const getMousePos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const handleStart = (e) => {
            if (this.isPaused || this.isFinished || this.lockBoard) return;
            const pos = getMousePos(e);
            
            // Check double click / double tap for rotation
            const now = Date.now();
            const isDoubleTap = this.lastTap && (now - this.lastTap) < 300;
            this.lastTap = now;

            // Find piece clicked (searched backwards so top rendered is selected first)
            let clickedPiece = null;
            for (let i = this.pieces.length - 1; i >= 0; i--) {
                const p = this.pieces[i];
                if (p.isSnapped && this.mode !== 'rotate') continue; // Locked once snapped
                if (this.mode === 'memory' && p.isMatched) continue; // Locked once matched

                // Check collision inside bounding box
                if (pos.x >= p.x + p.padding && pos.x <= p.x + p.width - p.padding &&
                    pos.y >= p.y + p.padding && pos.y <= p.y + p.height - p.padding) {
                    clickedPiece = p;
                    break;
                }
            }

            if (clickedPiece) {
                if (this.mode === 'sliding') {
                    // Check if adjacent to empty cell and slide
                    this.slideTile(clickedPiece.row, clickedPiece.col, true);
                    return;
                }

                if (this.mode === 'memory') {
                    // Flip card
                    this.flipCard(clickedPiece);
                    return;
                }

                if (this.mode === 'rotate') {
                    // Clicking in rotate mode rotates piece by 90 deg
                    this.rotatePiece(clickedPiece, 90);
                    return;
                }

                if (isDoubleTap) {
                    // Double tap rotates piece
                    this.rotatePiece(clickedPiece, 90);
                    return;
                }

                // Start dragging
                this.activePiece = clickedPiece;
                this.dragOffsetX = pos.x - clickedPiece.x;
                this.dragOffsetY = pos.y - clickedPiece.y;
                AudioManager.playSFX('click');
                this.draw();
            }
        };

        const handleMove = (e) => {
            if (this.isPaused || this.isFinished || this.lockBoard) return;
            const pos = getMousePos(e);

            // Drag behavior
            if (this.activePiece) {
                e.preventDefault();
                this.activePiece.x = pos.x - this.dragOffsetX;
                this.activePiece.y = pos.y - this.dragOffsetY;
                this.draw();
            } else {
                // Hover highlight checks (Desktop mouse move)
                let hovered = null;
                for (let i = this.pieces.length - 1; i >= 0; i--) {
                    const p = this.pieces[i];
                    if (p.isSnapped) continue;
                    if (pos.x >= p.x + p.padding && pos.x <= p.x + p.width - p.padding &&
                        pos.y >= p.y + p.padding && pos.y <= p.y + p.height - p.padding) {
                        hovered = p;
                        break;
                    }
                }
                if (hovered !== this.hoveredPiece) {
                    this.hoveredPiece = hovered;
                    this.draw();
                }
            }
        };

        const handleEnd = () => {
            if (!this.activePiece) return;
            
            // Check snap placement
            this.checkSnap(this.activePiece);
            this.activePiece = null;
            this.draw();
        };

        // Mouse listeners
        this.canvas.addEventListener('mousedown', handleStart);
        this.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);

        // Touch listeners
        this.canvas.addEventListener('touchstart', handleStart, { passive: true });
        this.canvas.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd, { passive: true });

        // Right click to rotate pieces in drag and drop modes
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.isPaused || this.isFinished || this.lockBoard) return;
            const rect = this.canvas.getBoundingClientRect();
            const pos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            for (let i = this.pieces.length - 1; i >= 0; i--) {
                const p = this.pieces[i];
                if (p.isSnapped) continue;
                if (pos.x >= p.x + p.padding && pos.x <= p.x + p.width - p.padding &&
                    pos.y >= p.y + p.padding && pos.y <= p.y + p.height - p.padding) {
                    this.rotatePiece(p, 90);
                    break;
                }
            }
        });
    }

    /**
     * Checks if a dropped piece is close to its correct grid coordinates.
     * Snaps it into place if distance is below threshold and rotation is 0.
     */
    checkSnap(piece) {
        // High magnetic threshold makes it extremely child-friendly and smooth to play
        const snapThreshold = Math.max(38, this.cellW * 0.45);
        const dist = Utils.distance(piece.x, piece.y, piece.targetX, piece.targetY);
        
        this.moves++;
        this.totalPlacements++;

        // In Rotate+Drag puzzle, piece must be rotated correctly to snap
        const rotationSnapped = (piece.rotation % 360) === 0;

        if (dist < snapThreshold && rotationSnapped) {
            piece.x = piece.targetX;
            piece.y = piece.targetY;
            piece.isSnapped = true;
            this.correctPlacements++;
            
            // Audio + Particles
            AudioManager.playSFX('snap');
            
            // Get screen coordinates of snap
            const canvasRect = this.canvas.getBoundingClientRect();
            const px = canvasRect.left + (piece.x + piece.width / 2);
            const py = canvasRect.top + (piece.y + piece.height / 2);
            CanvasEffects.triggerSnapSparkles(px, py);

            this.saveStateToUndo();
            this.checkVictory();
        } else {
            // Smooth float back (optional, let's keep it dropped or bounce back to tray if dropped far out)
            // For classic look, let's just let it stay where dropped.
            AudioManager.playSFX('click'); // Standard drop
            this.saveStateToUndo();
        }

        this.updateStatsUI();
    }

    /**
     * Rotates a piece by N degrees (90, -90).
     */
    rotatePiece(piece, deg) {
        if (piece.isSnapped && this.mode !== 'rotate') return;
        
        piece.rotation = (piece.rotation + deg) % 360;
        AudioManager.playSFX('click');
        
        this.moves++;
        this.saveStateToUndo();
        this.updateStatsUI();

        // In pure Rotate mode, check victory condition after each rotation
        if (this.mode === 'rotate') {
            this.checkRotateVictory();
        } else {
            this.draw();
        }
    }

    /**
     * Slide tile in sliding mode
     */
    slideTile(row, col, isMove = true) {
        // Must be adjacent to empty cell
        const dr = Math.abs(row - this.emptyCell.r);
        const dc = Math.abs(col - this.emptyCell.c);
        
        if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
            // Find sliding piece
            const piece = this.pieces.find(p => p.row === row && p.col === col);
            if (piece) {
                // Swap coords
                const targetX = this.boardX + this.emptyCell.c * this.cellW - piece.padding;
                const targetY = this.boardY + this.emptyCell.r * this.cellH - piece.padding;
                
                piece.x = targetX;
                piece.y = targetY;
                
                // Swap grid locations
                const tempRow = piece.row;
                const tempCol = piece.col;
                piece.row = this.emptyCell.r;
                piece.col = this.emptyCell.c;
                
                this.emptyCell.r = tempRow;
                this.emptyCell.c = tempCol;
                
                if (isMove) {
                    this.moves++;
                    this.totalPlacements++;
                    AudioManager.playSFX('snap');
                    this.saveStateToUndo();
                    this.updateStatsUI();
                    this.checkSlidingVictory();
                }
            }
        }
    }

    /**
     * Flip Card Logic (Memory Mode)
     */
    flipCard(piece) {
        if (piece.isFlipped || piece.isMatched || this.lockBoard) return;

        piece.isFlipped = true;
        this.selectedCards.push(piece);
        AudioManager.playSFX('click');
        this.draw();

        if (this.selectedCards.length === 2) {
            this.moves++;
            this.totalPlacements++;
            this.lockBoard = true;

            const [card1, card2] = this.selectedCards;

            // Check match based on matching original cut coordinate IDs
            if (card1.id === card2.id) {
                // Match found!
                card1.isMatched = true;
                card2.isMatched = true;
                this.correctPlacements += 2;
                this.selectedCards = [];
                this.lockBoard = false;
                
                // Trigger snap sounds and sparks
                setTimeout(() => {
                    AudioManager.playSFX('correct');
                    const canvasRect = this.canvas.getBoundingClientRect();
                    const px = canvasRect.left + (card2.x + card2.width / 2);
                    const py = canvasRect.top + (card2.y + card2.height / 2);
                    CanvasEffects.triggerSnapSparkles(px, py);
                    
                    this.checkMemoryVictory();
                    this.updateStatsUI();
                }, 400);
            } else {
                // No match, flip back
                setTimeout(() => {
                    card1.isFlipped = false;
                    card2.isFlipped = false;
                    this.selectedCards = [];
                    this.lockBoard = false;
                    AudioManager.playSFX('wrong');
                    this.draw();
                }, 1200);
            }
            this.updateStatsUI();
        }
    }

    /**
     * Highlights a single correct snap slot for hints
     */
    triggerHint() {
        if (this.isFinished || this.isPaused || this.mode === 'sliding' || this.mode === 'memory') return;

        // Find a random piece that is not snapped
        const unsnapped = this.pieces.filter(p => !p.isSnapped);
        if (unsnapped.length === 0) return;

        const targetPiece = Utils.randomChoice(unsnapped);

        // Highlight correct grid slot with gold flash
        this.hintsUsed++;
        
        // Visual cue: slide the piece directly to its correct slot
        targetPiece.x = targetPiece.targetX;
        targetPiece.y = targetPiece.targetY;
        targetPiece.rotation = 0;
        targetPiece.isSnapped = true;
        this.correctPlacements++;

        AudioManager.playSFX('snap');
        const canvasRect = this.canvas.getBoundingClientRect();
        const px = canvasRect.left + (targetPiece.x + targetPiece.width / 2);
        const py = canvasRect.top + (targetPiece.y + targetPiece.height / 2);
        
        // Emit sparkle fireworks at snapped location
        CanvasEffects.triggerSnapSparkles(px, py);
        
        this.saveStateToUndo();
        this.updateStatsUI();
        this.draw();
        
        this.checkVictory();
    }

    /**
     * Victory Checks
     */
    checkVictory() {
        const allSnapped = this.pieces.every(p => p.isSnapped);
        if (allSnapped) {
            this.concludeGame();
        }
    }

    checkRotateVictory() {
        const allAligned = this.pieces.every(p => (p.rotation % 360) === 0);
        if (allAligned) {
            this.pieces.forEach(p => p.isSnapped = true);
            this.concludeGame();
        }
    }

    checkSlidingVictory() {
        // Every tile must be at its original row/col
        const allCorrect = this.pieces.every(p => {
            const originalCol = parseInt(p.id.split('_')[1]);
            const originalRow = parseInt(p.id.split('_')[0]);
            return p.row === originalRow && p.col === originalCol;
        });

        if (allCorrect) {
            this.pieces.forEach(p => p.isSnapped = true);
            this.concludeGame();
        }
    }

    checkMemoryVictory() {
        const allMatched = this.pieces.every(p => p.isMatched);
        if (allMatched) {
            this.concludeGame();
        }
    }

    /**
     * Stops clocks, calculates scores, unlocks achievements, saves records, triggers confetti.
     */
    concludeGame() {
        this.isFinished = true;
        this.stopTimer();

        // Calculate accuracy
        const acc = this.totalPlacements > 0 ? (this.correctPlacements / this.totalPlacements) : 1;
        const accuracyPct = Math.round(acc * 100);

        // Score Multipliers
        const diffMultiplierMap = { easy: 1, medium: 2, hard: 3, expert: 4, master: 6, impossible: 10 };
        const mult = diffMultiplierMap[this.difficulty] || 1;
        
        // Base scoring logic
        const baseScore = 3000 * mult;
        const timePenalty = this.timer * 4;
        const movePenalty = this.moves * 8;
        const hintPenalty = this.hintsUsed * 300;
        this.score = Math.round(Math.max(100, (baseScore - timePenalty - movePenalty - hintPenalty) * acc));

        // Victory SFX + Confetti
        AudioManager.playSFX('victory');
        CanvasEffects.triggerVictoryConfetti();
        
        // Save score and check personal bests
        const isNewBest = Storage.saveScore(this.difficulty, this.mode, this.timer, this.moves, this.score);
        
        // Check Achievements
        Storage.unlockAchievement('first_puzzle');
        if (this.difficulty === 'hard' || this.difficulty === 'expert' || this.difficulty === 'master' || this.difficulty === 'impossible') {
            Storage.unlockAchievement('puzzle_master');
        }
        if (this.timer < 60) {
            Storage.unlockAchievement('fast_solver');
        }
        if (this.hintsUsed === 0 && (this.difficulty !== 'easy')) {
            Storage.unlockAchievement('no_hint_winner');
        }
        if (accuracyPct >= 90) {
            Storage.unlockAchievement('perfect_accuracy');
        }

        // Calculate stars and award XP
        const starString = this.getStarString(this.score, mult);
        const starCount = (starString.match(/★/g) || []).length;
        
        let xpGained = 0;
        if (this.campaignLevel) {
            xpGained = Math.round(this.score);
            Storage.completeCampaignLevel(this.campaignLevel, starCount, this.score);
        } else {
            xpGained = Math.round(this.score / 2);
        }
        Storage.addXP(xpGained);

        // Show Victory Overlay
        const overlay = document.getElementById('victory-overlay');
        document.getElementById('vic-score').innerHTML = `${this.score} <span style="font-size:0.95rem; color:var(--primary); display:block; margin-top:2px;">+${xpGained} XP</span>`;
        document.getElementById('vic-time').innerText = Utils.formatTime(this.timer);
        document.getElementById('vic-moves').innerText = this.moves;
        document.getElementById('vic-accuracy').innerText = `${accuracyPct}%`;
        document.getElementById('vic-stars').innerHTML = starString;
        document.getElementById('vic-best-badge').style.display = isNewBest ? 'inline-block' : 'none';
        
        // Configure campaign navigation buttons dynamically
        const nextLevelBtn = document.getElementById('vic-next-level');
        const campaignMapBtn = document.getElementById('vic-campaign-map');
        const mainMenuBtn = document.getElementById('vic-menu');

        if (this.campaignLevel) {
            document.getElementById('vic-title').innerText = `Level ${this.campaignLevel} Cleared!`;
            
            // Toggle Campaign buttons: hide Main Menu, show Campaign Map and Next Level (unless Level 12)
            mainMenuBtn.style.display = 'none';
            campaignMapBtn.style.display = 'block';
            
            if (this.campaignLevel < 12) {
                nextLevelBtn.style.display = 'block';
            } else {
                nextLevelBtn.style.display = 'none';
            }
        } else {
            document.getElementById('vic-title').innerText = "Puzzle Complete!";
            
            // Default Quick Play buttons: show Main Menu, hide Campaign specific buttons
            mainMenuBtn.style.display = 'block';
            campaignMapBtn.style.display = 'none';
            nextLevelBtn.style.display = 'none';
        }
        
        overlay.classList.remove('hidden');

        // Draw complete board with no grids/preview overlap
        this.draw();
    }

    /**
     * Stars based on score percentage
     */
    getStarString(score, mult) {
        const maxScorePossible = 3000 * mult;
        const pct = score / maxScorePossible;
        let starCount = 1;
        if (pct > 0.8) starCount = 5;
        else if (pct > 0.65) starCount = 4;
        else if (pct > 0.45) starCount = 3;
        else if (pct > 0.25) starCount = 2;

        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < starCount ? '★' : '☆';
        }
        return stars;
    }

    /**
     * Clocks scheduling
     */
    startTimer() {
        this.stopTimer();
        
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && !this.isFinished) {
                // In Speed mode, countdown. Else, count up.
                if (this.mode === 'speed') {
                    // Setup initial countdown time if 0
                    if (this.timer === 0) {
                        const countdownTimes = { easy: 90, medium: 150, hard: 240, expert: 360, master: 480, impossible: 600 };
                        this.timer = countdownTimes[this.difficulty];
                    }
                    this.timer--;
                    
                    if (this.timer <= 0) {
                        this.timer = 0;
                        this.concludeGameFailed();
                    }
                } else {
                    this.timer++;
                }
                this.updateStatsUI();
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseOverlay = document.getElementById('pause-overlay');
        
        if (this.isPaused) {
            pauseOverlay.classList.remove('hidden');
        } else {
            pauseOverlay.classList.add('hidden');
        }
    }

    /**
     * Speed challenge failure conclusion
     */
    concludeGameFailed() {
        this.isFinished = true;
        this.stopTimer();
        AudioManager.playSFX('wrong');
        Utils.showToast("Speed Challenge Time's Up!");

        // Show failed screen overlay
        const overlay = document.getElementById('victory-overlay');
        document.getElementById('vic-title').innerText = "Speed Run Failed!";
        document.getElementById('vic-score').innerText = 0;
        document.getElementById('vic-time').innerText = "Expired";
        document.getElementById('vic-moves').innerText = this.moves;
        document.getElementById('vic-accuracy').innerText = "0%";
        document.getElementById('vic-stars').innerHTML = "☆☆☆☆☆";
        document.getElementById('vic-best-badge').style.display = 'none';
        
        overlay.classList.remove('hidden');
    }

    /**
     * State Undo / Redo Stacks
     */
    saveStateToUndo() {
        // Stringify layout state
        const state = this.pieces.map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            row: p.row,
            col: p.col,
            rotation: p.rotation,
            isSnapped: p.isSnapped,
            isFlipped: p.isFlipped,
            isMatched: p.isMatched
        }));

        this.undoStack.push(JSON.stringify(state));
        this.redoStack = []; // Clear redo stack on new action
    }

    undo() {
        if (this.undoStack.length <= 1) return; // Need at least current + previous
        
        // Pop current state and move to redo
        const current = this.undoStack.pop();
        this.redoStack.push(current);

        // Load previous state
        const prevState = JSON.parse(this.undoStack[this.undoStack.length - 1]);
        this.restoreState(prevState);
        AudioManager.playSFX('click');
        this.draw();
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const next = this.redoStack.pop();
        this.undoStack.push(next);

        const nextState = JSON.parse(next);
        this.restoreState(nextState);
        AudioManager.playSFX('click');
        this.draw();
    }

    restoreState(stateData) {
        stateData.forEach(savedPiece => {
            const piece = this.pieces.find(p => p.id === savedPiece.id);
            if (piece) {
                piece.x = savedPiece.x;
                piece.y = savedPiece.y;
                piece.row = savedPiece.row;
                piece.col = savedPiece.col;
                piece.rotation = savedPiece.rotation;
                piece.isSnapped = savedPiece.isSnapped;
                piece.isFlipped = savedPiece.isFlipped;
                piece.isMatched = savedPiece.isMatched;
            }
        });
    }

    /**
     * Updates HTML dashboard displays
     */
    updateStatsUI() {
        document.getElementById('stat-timer').innerText = Utils.formatTime(this.timer);
        document.getElementById('stat-moves').innerText = this.moves;
        
        // Calculate dynamic accuracy
        const acc = this.totalPlacements > 0 ? (this.correctPlacements / this.totalPlacements) : 1;
        document.getElementById('stat-accuracy').innerText = `${Math.round(acc * 100)}%`;
    }

    /**
     * Canvas screenshot grab for download
     */
    downloadScreenshot() {
        // Redraw board cleanly
        this.draw();

        // Create virtual download anchor
        const link = document.createElement('a');
        link.download = `PuzzleVerse_Score_${this.score}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
        
        Utils.showToast("Screenshot downloaded!");
    }
}

window.PuzzleGame = PuzzleGame;
