// canvas.js - Handles drawing logic, rendering, scaling, and stroke memory

class CanvasManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext("2d");
        
        this.strokes = []; 
        this.currentStroke = null; 
        
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;

        // NEW: Track the size of the canvas to calculate scaling ratios later
        this.currentWidth = this.canvas.parentElement.clientWidth;
        this.currentHeight = this.canvas.parentElement.clientHeight;
        // Add these inside the constructor()
        this.onPenDown = null;
        this.onPenUp = null;

        this.resizeCanvas();
        this.setupEventListeners();

        window.addEventListener("resize", () => this.resizeCanvas());
    }

    resizeCanvas() {
        // 1. Get the brand new dimensions of the window
        const newWidth = this.canvas.parentElement.clientWidth;
        const newHeight = this.canvas.parentElement.clientHeight;

        // 2. Calculate the scale multiplier (e.g., 0.5 if it shrank in half)
        // Prevent dividing by zero just in case the canvas hasn't fully loaded
        const scaleX = this.currentWidth > 0 ? newWidth / this.currentWidth : 1;
        const scaleY = this.currentHeight > 0 ? newHeight / this.currentHeight : 1;

        // 3. Update our tracked dimensions for the NEXT time they resize
        this.currentWidth = newWidth;
        this.currentHeight = newHeight;

        // 4. Actually resize the HTML canvas (wipes it clean)
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        
        this.applyBrushSettings();

        // 5. NEW: Scale all the saved coordinates in memory to match the new size
        this.scaleStrokes(scaleX, scaleY);

        // 6. Redraw everything using the newly scaled coordinates
        this.redrawAll();
    }

    // NEW: Multiplies every saved X and Y by the scale ratio
    scaleStrokes(scaleX, scaleY) {
        this.strokes.forEach(stroke => {
            stroke.forEach(point => {
                point.x *= scaleX;
                point.y *= scaleY;
            });
        });
    }

    applyBrushSettings() {
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = "#111111";
    }

    setupEventListeners() {
        this.canvas.addEventListener("pointerdown", (e) => this.startDrawing(e));
        this.canvas.addEventListener("pointermove", (e) => this.draw(e));
        this.canvas.addEventListener("pointerup", () => this.stopDrawing());
        this.canvas.addEventListener("pointerout", () => this.stopDrawing()); 
    }

    startDrawing(e) {
        this.isDrawing = true;
        this.lastX = e.offsetX;
        this.lastY = e.offsetY;
        this.currentStroke = [{ x: this.lastX, y: this.lastY }];
        if (this.onPenDown) this.onPenDown();
    }

    draw(e) {
        if (!this.isDrawing) return;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(e.offsetX, e.offsetY);
        this.ctx.stroke();

        this.lastX = e.offsetX;
        this.lastY = e.offsetY;

        this.currentStroke.push({ x: this.lastX, y: this.lastY });
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.currentStroke && this.currentStroke.length > 0) {
            this.strokes.push(this.currentStroke);
        }
        
        this.currentStroke = null;
        if (this.onPenUp) this.onPenUp(this.strokes);
    }

    redrawAll() {
        if (this.strokes.length === 0) return;

        this.strokes.forEach(stroke => {
            if (stroke.length < 2) return; 

            this.ctx.beginPath();
            this.ctx.moveTo(stroke[0].x, stroke[0].y);

            for (let i = 1; i < stroke.length; i++) {
                this.ctx.lineTo(stroke[i].x, stroke[i].y);
            }
            this.ctx.stroke(); 
        });
    }
    // NEW: Wipes the mathematical memory and the visual screen
    clearCanvas() {
        this.strokes = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    // NEW: Empties the mathematical array for the next word,
    // but leaves the physical ink and red boxes on the screen for debugging.
    clearMemory() {
        this.strokes = [];
    }
    // NEW: Draws a visual representation of the calculated mathematical boundaries
    drawDebugBox(box) {
        // Save the current brush settings so we don't ruin the handwriting pen
        this.ctx.save(); 
        
        this.ctx.strokeStyle = "#FF0000"; // Bright Red
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]); // Creates a dashed line effect
        
        // Draw the rectangle using the X, Y, Width, and Height
        this.ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        // Restore the original brush settings
        this.ctx.restore(); 
    }
    // NEW: Takes a picture of the specific word, cropped and formatted for OCR
    getSnapshot(boundingBox) {
        // Tesseract needs a white border around the text to read it properly
        const padding = 15; 
        const x = Math.max(0, boundingBox.x - padding);
        const y = Math.max(0, boundingBox.y - padding);
        const w = boundingBox.width + (padding * 2);
        const h = boundingBox.height + (padding * 2);

        // Create a hidden, temporary canvas in memory
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext('2d');

        // Fill it with a solid white background (Tesseract hates transparent backgrounds)
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, w, h);

        // Copy the specific drawing from our main canvas onto the hidden one
        tempCtx.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);

        // Convert the hidden canvas into a Base64 Image URL
        return tempCanvas.toDataURL('image/png');
    }
}