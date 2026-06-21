// wordDetector.js - Handles the timer logic to detect completed words

class WordDetector {
    // We set a default wait time of 1000 milliseconds (1 second)
    constructor(waitTimeMs = 1000, onWordCompleteCallback) {
        this.waitTimeMs = waitTimeMs;
        this.onWordComplete = onWordCompleteCallback;
        this.timer = null;
    }

    // Called whenever the pen touches the screen
    recordPointerDown() {
        if (this.timer) {
            clearTimeout(this.timer); // Stop the countdown! The user is still writing.
            this.timer = null;
        }
    }

    // Called whenever the pen lifts off the screen
    recordPointerUp(currentStrokes) {
        // Start the countdown clock
        this.timer = setTimeout(() => {
            // The clock hit zero. If there are strokes, the word is done.
            if (currentStrokes.length > 0) {
                this.onWordComplete(currentStrokes);
            }
        }, this.waitTimeMs);
    }
}