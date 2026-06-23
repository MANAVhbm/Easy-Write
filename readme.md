# Easy-Write

Easy-Write is a handwriting-first lecture notebook that turns handwritten notes into clean, searchable digital text. It combines a canvas-based note-taking UI with AI-powered handwriting recognition for both text and math.

## Features
- Multi-page notebook with sidebar navigation
- Infinite canvas feel with pan and zoom
- Pen, highlighter, eraser, pointer, lasso, shape, text, and image tools
- Auto-OCR for handwritten text
- Separate math mode for equations
- Dark/light theme support
- Lock mode for read-only viewing
- Undo/redo support
- Autosave with local persistence
- Searchable PDF export with invisible text overlay
- Acronym/technical-term protection for cleaner OCR output

## Tech Stack
- Frontend: HTML, CSS, Vanilla JavaScript, Canvas API
- UI helpers: Feather Icons, KaTeX, jsPDF
- Backend: Python, Flask, Flask-CORS
- OCR: Microsoft TrOCR
- Math OCR: Gemini
- Post-processing: autocorrect + technical whitelist

## How it works
1. Write on the canvas.
2. The app groups handwriting into word-sized chunks.
3. Text chunks are sent to TrOCR.
4. Math chunks are sent to Gemini.
5. Recognized output is rendered back into the notebook.
6. Export the final notes as a searchable PDF.

## Setup
1. Clone the repository.
2. Install Python dependencies.
3. Add a `.env` file with your Gemini API key.
4. Run the Flask backend.
5. Open the front end in a browser or serve it locally.

## Project Structure
- `index.html` — app shell and notebook UI
- `main.js` — canvas logic, tools, OCR orchestration, export, autosave
- `server.py` — backend OCR endpoints

## Why this project is useful
Easy-Write is designed for lectures, revision, and study workflows where handwritten notes need to become clean, searchable, and organized.