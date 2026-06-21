// uiDisplay.js - Handles putting the digitized text onto the screen

class UIDisplay {
    constructor(workspaceId) {
        this.workspace = document.getElementById(workspaceId);
    }

    // Creates a new piece of text and places it at specific coordinates
    renderText(text, boundingBox) {
        const textElement = document.createElement("div");
        
        textElement.innerText = text;
        textElement.style.position = "absolute"; // Allows us to place it exactly by X/Y
        textElement.style.left = `${boundingBox.x}px`;
        
        // We push it down slightly so it aligns with where the bottom of your letters were
        textElement.style.top = `${boundingBox.y + (boundingBox.height / 2)}px`;
        
        // Styling the text to look like a clean digital note
        textElement.style.color = "#222";
        textElement.style.fontSize = "24px";
        textElement.style.fontFamily = "sans-serif";
        textElement.style.pointerEvents = "none"; // So it doesn't block you from drawing over it
        
        // Add it to the screen!
        this.workspace.appendChild(textElement);
    }
}