// main.js - The central nervous system of our app

let canvasManager;
let wordDetector;
let recognitionService;
let uiDisplay;

document.addEventListener("DOMContentLoaded", () => {
    
    canvasManager = new CanvasManager("note-canvas");
    recognitionService = new RecognitionService();
    uiDisplay = new UIDisplay("workspace");
    
    wordDetector = new WordDetector(1000, async (completedStrokes) => {
        
        const boundingBox = recognitionService.getBoundingBox(completedStrokes);
        
        // 1. Take the photo BEFORE we clear the ink!
        const imageSnapshot = canvasManager.getSnapshot(boundingBox);
        
        // 2. Clear visual ink and reset mathematical memory for the next word
        canvasManager.clearCanvas();
        canvasManager.clearMemory();
        
        // 3. Send the photo to Tesseract
        const recognizedText = await recognitionService.recognizeHandwriting(imageSnapshot);
        
        // 4. Print it to the screen if it actually found text
        if (recognizedText.length > 0) {
            uiDisplay.renderText(recognizedText, boundingBox);
        }
    });

    canvasManager.onPenDown = () => wordDetector.recordPointerDown();
    canvasManager.onPenUp = (strokes) => wordDetector.recordPointerUp(strokes);
    
    console.log("Phase 4 Complete: Tesseract Pipeline Active.");
});