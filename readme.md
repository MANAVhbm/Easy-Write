# Notebook Workspace Pro 📝

A high-performance, distraction-free digital notebook built with HTML5 Canvas and vanilla JavaScript. Engineered to provide a fluid, infinite-canvas experience with custom math for ink smoothing, ray-casting collision detection, and a local Python OCR bridge.

## 🏗️ Architecture & Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Rendering:** HTML5 Canvas API (2D Context), Pointer Events API
* **Backend Bridge:** Python 3 (Flask local server)
* **Storage:** LocalStorage API (JSON serialization of vector data)
* **Dependencies:** jsPDF (Client-side PDF generation), Feather Icons (SVG UI)

## ✨ Core Capabilities

* **Advanced Digital Ink Engine (`canvas.js`):** Implements point-throttling, pressure-averaging, and Bezier curve smoothing to render jitter-free, pressure-sensitive pen strokes.
* **Vector Stroke Eraser:** Utilizes dynamic ray-casting collision detection to mathematically remove complete ink strokes or geometric shapes instantly, rather than painting over pixels.
* **Local OCR Integration (`recognition.js` & `server.py`):** Bridges the frontend canvas to a Python backend via the Fetch API, converting handwriting into editable text without destroying the underlying background grid.
* **Word Detection (`wordDetector.js`):** Intelligently groups and processes drawn strokes for seamless hand-to-text conversion.
* **Dynamic Text System:** Standard text boxes that can be typed in, lassoed, moved, and scaled using universal 8-point bounding box handles.
* **Modular UI (`uiDisplay.js`):** A clean, Excalidraw-inspired toolbar that handles tool switching, color picking, and theme toggling dynamically.
* **State Management (`main.js`):** Custom undo/redo engine that handles the splicing and restoration of vector arrays and memory blocks.

## 🚀 Local Installation

### 1. Frontend Setup
The frontend requires no build steps or package managers. 
1. Clone the repository:
   ```bash
   git clone [https://github.com/MANAVhbm/Easy-Write.git](https://github.com/MANAVhbm/Easy-Write.git)

2. Open index.html in any modern web browser