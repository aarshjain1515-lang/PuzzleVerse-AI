/**
 * PuzzleVerse AI - Upload and Image Cropper Module
 * Manages image drag & drop, file reading, compression, and interactive zoom/crop/reposition.
 */

const ImageUploader = {
    originalImage: null, // HTMLImageElement
    cropCanvas: null,
    cropCtx: null,
    zoomSlider: null,
    
    // Cropper State
    scale: 1.0,
    minScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    
    // Configuration
    cropWidth: 800,
    cropHeight: 600,
    aspectRatio: 4 / 3,

    /**
     * Initializes elements and attaches upload event listeners.
     */
    init(dropzoneId, fileInputId, cropCanvasId, zoomSliderId) {
        const dropzone = document.getElementById(dropzoneId);
        const fileInput = document.getElementById(fileInputId);
        this.cropCanvas = document.getElementById(cropCanvasId);
        this.zoomSlider = document.getElementById(zoomSliderId);

        if (this.cropCanvas) {
            this.cropCtx = this.cropCanvas.getContext('2d');
            this.setupCropperEvents();
        }

        if (!dropzone || !fileInput) return;

        // Click to upload
        dropzone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFile(e.target.files[0]);
            }
        });

        // Drag and Drop events
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('drag-active');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files[0]) {
                this.handleFile(files[0]);
            }
        });
    },

    /**
     * Reads and compresses the uploaded file, then opens the cropper.
     */
    handleFile(file) {
        // Verify it is an image
        if (!file.type.startsWith('image/')) {
            Utils.showToast("Please upload a valid image file (PNG, JPG, WEBP).");
            return;
        }

        Utils.showToast("Compressing image...");
        Utils.compressImage(file, 1600, 1600) // Compress large images
            .then(dataUrl => {
                const img = new Image();
                img.src = dataUrl;
                img.onload = () => {
                    this.originalImage = img;
                    this.openCropper();
                };
            })
            .catch(err => {
                console.error("Image loading failed: ", err);
                Utils.showToast("Failed to load image. Try another file.");
            });
    },

    /**
     * Prepares and renders the cropper view.
     */
    openCropper() {
        if (!this.originalImage) return;

        // Show the cropper modal/section
        document.getElementById('upload-section').classList.add('hidden');
        document.getElementById('cropper-section').classList.remove('hidden');

        // Reset cropper state
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1.0;
        if (this.zoomSlider) {
            this.zoomSlider.value = 1.0;
        }

        // Setup crop canvas internal resolution (fixed at 800x600)
        this.cropCanvas.width = this.cropWidth;
        this.cropCanvas.height = this.cropHeight;

        // Calculate minimum scale to cover the crop area
        const imgRatio = this.originalImage.width / this.originalImage.height;
        const canvasRatio = this.cropWidth / this.cropHeight;

        if (imgRatio > canvasRatio) {
            // Image is wider than canvas (height is the limiting factor)
            this.minScale = this.cropHeight / this.originalImage.height;
        } else {
            // Image is taller than canvas (width is the limiting factor)
            this.minScale = this.cropWidth / this.originalImage.width;
        }

        this.scale = this.minScale;
        if (this.zoomSlider) {
            this.zoomSlider.min = this.minScale;
            this.zoomSlider.max = this.minScale * 4;
            this.zoomSlider.value = this.minScale;
        }

        this.drawCropper();
    },

    /**
     * Renders the image on the crop canvas with zoom, translation and overlay grid.
     */
    drawCropper() {
        if (!this.originalImage || !this.cropCtx) return;

        const w = this.cropCanvas.width;
        const h = this.cropCanvas.height;

        // Clear canvas
        this.cropCtx.clearRect(0, 0, w, h);

        // Draw image translated and scaled
        this.cropCtx.save();
        this.cropCtx.translate(w / 2 + this.offsetX, h / 2 + this.offsetY);
        this.cropCtx.scale(this.scale, this.scale);
        
        // Draw centered
        this.cropCtx.drawImage(
            this.originalImage, 
            -this.originalImage.width / 2, 
            -this.originalImage.height / 2
        );
        this.cropCtx.restore();

        // Draw subtle guideline border (the crop boundary is the entire canvas viewport)
        this.cropCtx.strokeStyle = 'rgba(0, 242, 254, 0.6)';
        this.cropCtx.lineWidth = 2;
        this.cropCtx.strokeRect(2, 2, w - 4, h - 4);
        
        // Draw grid lines
        this.cropCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.cropCtx.lineWidth = 1;
        // Verticals
        this.cropCtx.beginPath();
        this.cropCtx.moveTo(w / 3, 0); this.cropCtx.lineTo(w / 3, h);
        this.cropCtx.moveTo((w * 2) / 3, 0); this.cropCtx.lineTo((w * 2) / 3, h);
        // Horizontals
        this.cropCtx.moveTo(0, h / 3); this.cropCtx.lineTo(w, h / 3);
        this.cropCtx.moveTo(0, (h * 2) / 3); this.cropCtx.lineTo(w, (h * 2) / 3);
        this.cropCtx.stroke();
    },

    /**
     * Binds mouse and touch inputs to allow dragging the crop image.
     */
    setupCropperEvents() {
        // Slider zoom
        if (this.zoomSlider) {
            this.zoomSlider.addEventListener('input', (e) => {
                this.scale = parseFloat(e.target.value);
                this.limitOffsets();
                this.drawCropper();
            });
        }

        // Helper to extract coordinates
        const getCoords = (e) => {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        };

        const startDrag = (e) => {
            this.isDragging = true;
            const coords = getCoords(e);
            this.startX = coords.x - this.offsetX;
            this.startY = coords.y - this.offsetY;
            AudioManager.playSFX('click');
        };

        const moveDrag = (e) => {
            if (!this.isDragging) return;
            e.preventDefault(); // Prevent scrolling on mobile while dragging
            const coords = getCoords(e);
            this.offsetX = coords.x - this.startX;
            this.offsetY = coords.y - this.startY;
            this.limitOffsets();
            this.drawCropper();
        };

        const endDrag = () => {
            this.isDragging = false;
        };

        this.cropCanvas.addEventListener('mousedown', startDrag);
        this.cropCanvas.addEventListener('mousemove', moveDrag);
        window.addEventListener('mouseup', endDrag);

        this.cropCanvas.addEventListener('touchstart', startDrag, { passive: false });
        this.cropCanvas.addEventListener('touchmove', moveDrag, { passive: false });
        window.addEventListener('touchend', endDrag);

        // Scroll wheel to zoom
        this.cropCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.05 : 0.95;
            const newScale = Utils.clamp(this.scale * factor, this.minScale, this.minScale * 4);
            this.scale = newScale;
            if (this.zoomSlider) {
                this.zoomSlider.value = newScale;
            }
            this.limitOffsets();
            this.drawCropper();
        }, { passive: false });
    },

    /**
     * Keeps the image inside the crop borders so no blank areas appear.
     */
    limitOffsets() {
        if (!this.originalImage) return;

        const w = this.cropCanvas.width;
        const h = this.cropCanvas.height;

        const scaledW = this.originalImage.width * this.scale;
        const scaledH = this.originalImage.height * this.scale;

        // Maximum allowed offsets from center
        const maxOffsetX = Math.max(0, (scaledW - w) / 2);
        const maxOffsetY = Math.max(0, (scaledH - h) / 2);

        this.offsetX = Utils.clamp(this.offsetX, -maxOffsetX, maxOffsetX);
        this.offsetY = Utils.clamp(this.offsetY, -maxOffsetY, maxOffsetY);
    },

    /**
     * Crops and returns the cropped image as a dataURL.
     */
    crop() {
        if (!this.originalImage) return null;

        // Create an offscreen canvas at full output resolution (800x600)
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = this.cropWidth;
        exportCanvas.height = this.cropHeight;
        const exportCtx = exportCanvas.getContext('2d');

        // Draw image with direct translation and scale
        exportCtx.save();
        exportCtx.translate(
            this.cropWidth / 2 + this.offsetX, 
            this.cropHeight / 2 + this.offsetY
        );
        exportCtx.scale(this.scale, this.scale);

        exportCtx.drawImage(
            this.originalImage, 
            -this.originalImage.width / 2, 
            -this.originalImage.height / 2
        );
        exportCtx.restore();

        return exportCanvas.toDataURL('image/jpeg', 0.9);
    },

    /**
     * Resets the uploader state and returns to landing.
     */
    cancel() {
        this.originalImage = null;
        document.getElementById('cropper-section').classList.add('hidden');
        document.getElementById('upload-section').classList.remove('hidden');
    }
};

window.ImageCropper = ImageCropper;
