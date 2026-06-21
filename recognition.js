// recognition.js - Calculates boundaries and talks to the Python Backend

class RecognitionService {
    
    getBoundingBox(strokes) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        strokes.forEach(stroke => {
            stroke.forEach(point => {
                if (point.x < minX) minX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.x > maxX) maxX = point.x;
                if (point.y > maxY) maxY = point.y;
            });
        });

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    // NEW: Send the image to Python instead of Tesseract
    async recognizeHandwriting(imageDataUrl) {
        console.log("Sending image to Python Backend...");
        try {
            const response = await fetch('http://localhost:5000/recognize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageDataUrl })
            });

            const data = await response.json();
            console.log("Backend returned:", data.text);
            return data.text || ""; 
            
        } catch (error) {
            console.error("Failed to reach Python server. Is server.py running?", error);
            return "";
        }
    }
}