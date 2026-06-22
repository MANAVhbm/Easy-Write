        feather.replace();

        // --- THEME ENGINE ---
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const defaultColorSwatch = document.getElementById('defaultColorSwatch');
        let isDarkMode = false;

        themeToggleBtn.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            if (isDarkMode) {
                document.documentElement.setAttribute('data-theme', 'dark');
                themeToggleBtn.innerHTML = '<i data-feather="sun"></i>';
                if (penColor === '#1e1e1e') penColor = '#ececf1';
                if (currentColor === '#1e1e1e') currentColor = '#ececf1';
                defaultColorSwatch.style.background = '#ececf1';
                defaultColorSwatch.setAttribute('data-color', '#ececf1');
            } else {
                document.documentElement.removeAttribute('data-theme');
                themeToggleBtn.innerHTML = '<i data-feather="moon"></i>';
                if (penColor === '#ececf1') penColor = '#1e1e1e';
                if (currentColor === '#ececf1') currentColor = '#1e1e1e';
                defaultColorSwatch.style.background = '#1e1e1e';
                defaultColorSwatch.setAttribute('data-color', '#1e1e1e');
            }
            
            // Visually update the active swatch in the panel
            document.querySelectorAll('.color-swatch').forEach(s => {
                s.classList.toggle('active', s.getAttribute('data-color') === currentColor);
            });
            
            feather.replace();
            redrawCanvas(); 
        });

        // --- CORE LOGIC ---
        const canvasContainer = document.getElementById('canvas-area');
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
const tools = { 
            hand: document.getElementById('handBtn'), select: document.getElementById('selectBtn'), 
            lasso: document.getElementById('lassoBtn'), 
            rect: document.getElementById('rectBtn'), circle: document.getElementById('circleBtn'), line: document.getElementById('lineBtn'),
            diamond: document.getElementById('diamondBtn'), arrow: document.getElementById('arrowBtn'),
            pen: document.getElementById('penBtn'), highlighter: document.getElementById('highlighterBtn'), pointer: document.getElementById('pointerBtn'),
            eraser: document.getElementById('eraserBtn'), text: document.getElementById('textBtn')
        };
        let lassoPoints = []; 
        let laserPoints = []; // FIXED: This was missing, causing the crash!

        // NEW: Laser Pointer Decay Timer (Clears the trail automatically)
        // NEW: Laser Pointer Decay Timer (60fps Micro-Pump)
        // NEW: Laser Pointer Decay Timer (60fps Micro-Pump)
        setInterval(() => {
            // FIX: If standing still, refresh the head's timestamp but DON'T spam duplicate points!
            if (isDrawing && currentTool === 'pointer' && laserPoints.length > 0) {
                laserPoints[laserPoints.length - 1].time = Date.now();
            }

            if (laserPoints.length > 0) {
                const now = Date.now();
                laserPoints = laserPoints.filter(p => now - p.time < 800); 
                redrawCanvas();
            }
        }, 16);// 16ms = 60fps buttery smooth decay
        const textInput = document.getElementById('text-input');
        let textWorldPos = { x: 0, y: 0 };

        // NEW: Handles saving the text box to your canvas history
        function saveText() {
            if (textInput.style.display === 'block') {
                const textContent = textInput.innerText.trim();
                if (textContent) {
                    const sizes = { 2: 16, 4: 20, 7: 28, 12: 40, 20: 64 }; // Updated smooth curve                    // Drop the crisp new text exactly where the old ink used to be
                    history.push({
                        type: 'text', text: textContent, color: currentColor, font: currentFont, 
                        size: sizes[currentWidth] || 24, x: textWorldPos.x, y: textWorldPos.y
                    });                    redoStack = [];
                    undoBtn.disabled = false;
                    saveWorkspace();
                    redrawCanvas();
                }
                textInput.style.display = 'none';
                textInput.innerHTML = '';
            }
        }

        // Save text if user clicks away or presses Escape
        textInput.addEventListener('blur', saveText);
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') saveText();
            // Enter saves the text, Shift+Enter drops a new line
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveText(); }
        });

// --- IMAGE TOOL LOGIC ---
        const imageUpload = document.getElementById('imageUpload');
        
        document.getElementById('imageBtn').addEventListener('click', () => {
            imageUpload.click(); // Secretly clicks the hidden file input
        });

        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    // Smart Scaling: Shrink massive photos so they don't break the canvas
                    const maxSize = 600;
                    let w = img.width; let h = img.height;
                    if (w > maxSize || h > maxSize) {
                        const ratio = Math.min(maxSize / w, maxSize / h);
                        w *= ratio; h *= ratio;
                    }
                    
                    // Math: Calculate exact center of your current screen, accounting for Pan & Zoom
                    const centerX = -cameraOffset.x / cameraZoom + (canvas.width / 2 / cameraZoom) - (w / 2);
                    const centerY = -cameraOffset.y / cameraZoom + (canvas.height / 2 / cameraZoom) - (h / 2);

                    history.push({
                        type: 'image', img: img, 
                        src: event.target.result, // NEW: Save the Base64 string for Auto-Save
                        x: centerX, y: centerY, w: w, h: h
                    });
                    saveWorkspace(); // Auto-save when an image is dropped
                    
                    redoStack = [];
                    undoBtn.disabled = false;
                    redrawCanvas();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
            e.target.value = ''; // Reset input so you can upload the same file again if desired
        });

        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        const outputDiv = document.getElementById('output');
        const resultsPanel = document.getElementById('results-panel');
        const zoomText = document.getElementById('zoomText');

        let bgMode = 'ruled';
        let isLocked = false; // NEW: Global Read-Only State
        let currentTool = 'pen';
        let currentColor = '#1e1e1e'; 
        let penColor = '#1e1e1e';          // NEW: Tracks the pen and shape color
        let highlighterColor = '#f08c00';  // NEW: Tracks highlighter color (defaults to yellow/orange)
        let currentWidth = 4;
        let lastRecognizedText = "";
        
        // NEW: Multi-Page State Variables
        let pages = [];
        let currentPageId = null;

        let history = [];     
        let redoStack = [];   
        let currentAction = null; 
        let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

        function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }

        function switchPage(pageId) {
            // 1. Save the current canvas state into the departing page's memory
            if (currentPageId) {
                const activePage = pages.find(p => p.id === currentPageId);
                if (activePage) {
                    activePage.history = [...history]; 
                    activePage.bgMode = bgMode;
                    activePage.cameraOffset = { ...cameraOffset };
                    activePage.cameraZoom = cameraZoom;
                }
            }

            // 2. Load the new page's memory into the canvas
            currentPageId = pageId;
            const newPage = pages.find(p => p.id === currentPageId);
            if (newPage) {
                history = [...newPage.history];
                bgMode = newPage.bgMode || 'ruled';
                cameraOffset = newPage.cameraOffset || { x: 0, y: 0 };
                cameraZoom = newPage.cameraZoom || 1;
                
                redoStack = [];
                undoBtn.disabled = history.length === 0;
                redoBtn.disabled = true;

                // Sync the UI background button
                const btn = document.getElementById('bgToggleBtn');
                if (bgMode === 'grid') btn.innerHTML = '<i data-feather="grid"></i>';
                if (bgMode === 'ruled') btn.innerHTML = '<i data-feather="align-justify"></i>';
                if (bgMode === 'none') btn.innerHTML = '<i data-feather="square"></i>';
                feather.replace();

                redrawCanvas();
                renderSidebar();
                saveWorkspace(); // Ensure the switch is saved to LocalStorage
            }
        }

        function createNewPage() {
            const newId = generateId();
            pages.push({
                id: newId, title: `Lecture ${pages.length + 1}`,
                history: [], bgMode: 'ruled', cameraOffset: { x: 0, y: 0 }, cameraZoom: 1
            });
            switchPage(newId);
            document.getElementById('sidebar').classList.add('open');
        }

        function renderSidebar() {
            const list = document.getElementById('pageList');
            list.innerHTML = '';
            pages.forEach((page) => {
                const item = document.createElement('div');
                item.className = `page-item ${page.id === currentPageId ? 'active' : ''}`;
                // Only the active page title is editable to prevent messy clicks
                item.innerHTML = `
                    <i data-feather="file-text" style="width:16px;"></i> 
                    <span ${page.id === currentPageId ? 'contenteditable="true"' : ''} class="page-title-edit" data-id="${page.id}" spellcheck="false">${page.title}</span>
                `;
                
                item.addEventListener('click', (e) => {
                    // Prevent switching if they are just trying to click and type a new name
                    if (e.target.tagName !== 'SPAN') switchPage(page.id);
                });
                list.appendChild(item);
            });
            feather.replace();
            
            // Handle saving the renamed title
            document.querySelectorAll('.page-title-edit').forEach(span => {
                span.addEventListener('blur', (e) => {
                    const id = e.target.getAttribute('data-id');
                    const p = pages.find(page => page.id === id);
                    if (p) {
                        p.title = e.target.innerText.trim() || 'Untitled';
                        saveWorkspace();
                    }
                });
                span.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                });
            });
        }
        
        let cameraOffset = { x: 0, y: 0 };
        let cameraZoom = 1;

        function getEventLocation(e) {
            const rect = canvas.getBoundingClientRect();
            return { x: ((e.clientX - rect.left) - cameraOffset.x) / cameraZoom, y: ((e.clientY - rect.top) - cameraOffset.y) / cameraZoom };
        }

        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let spacePressed = false;
        
        let isDraggingObject = false;
        let isResizingObject = false; 
        let resizeHandle = ''; 
        let selectedAction = null; // Used temporarily while dragging/resizing
        let activeSelection = null; // NEW: Persists the selection after releasing the mouse
        let dragOffset = { x: 0, y: 0 };

        function adjustZoom(zoomAmount, zoomPointX, zoomPointY) {
            if (isDragging) return;
            const worldX = (zoomPointX - cameraOffset.x) / cameraZoom;
            const worldY = (zoomPointY - cameraOffset.y) / cameraZoom;
            
            cameraZoom += zoomAmount;
            cameraZoom = Math.min(Math.max(0.1, cameraZoom), 5); 
            
            cameraOffset.x = zoomPointX - (worldX * cameraZoom);
            cameraOffset.y = zoomPointY - (worldY * cameraZoom);
            redrawCanvas();
        }

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault(); 
            if (e.ctrlKey) {
                const rect = canvas.getBoundingClientRect();
                adjustZoom(e.deltaY * -0.01, e.clientX - rect.left, e.clientY - rect.top);
            } else {
                cameraOffset.x -= e.deltaX; cameraOffset.y -= e.deltaY; redrawCanvas();
            }
        }, { passive: false }); 

        document.getElementById('zoomInBtn').addEventListener('click', () => adjustZoom(0.1, canvas.width/2, canvas.height/2));
        document.getElementById('zoomOutBtn').addEventListener('click', () => adjustZoom(-0.1, canvas.width/2, canvas.height/2));

        let isDrawing = false;
        let autoRunTimer;

        // Auto-collapse properties panel when interacting with canvas
        canvas.addEventListener('pointerdown', () => {
            document.getElementById('properties-panel').classList.remove('active');
        });

// NEW: Universal Bounding Box Calculator
// 1. UNIVERSAL BOUNDING BOX CALCULATOR
        function getActionBounds(action) {
            if (!action) return null;
            if (action.type === 'group') return { x: action.x, y: action.y, w: action.w, h: action.h }; 
            if (action.type === 'image') return { x: action.x, y: action.y, w: action.w, h: action.h };
            if (action.type === 'ocr_text') return { x: action.box.x, y: action.box.y, w: action.box.w, h: action.box.h };
            
            // NEW: Standard Text Bounding Box Math
            if (action.type === 'text') {
                ctx.save();
                ctx.font = `normal ${action.size}px ${action.font || "system-ui, sans-serif"}`;
                const lines = action.text.split('\n');
                let maxW = 10; // Minimum width
                for (let l of lines) {
                    const metrics = ctx.measureText(l);
                    if (metrics.width > maxW) maxW = metrics.width;
                }
                ctx.restore();
                return { x: action.x, y: action.y, w: maxW, h: lines.length * (action.size * 1.2) };
            }
            
            if (action.type === 'shape') {
                return {
                    x: Math.min(action.startX, action.endX), y: Math.min(action.startY, action.endY),
                    w: Math.max(10, Math.abs(action.endX - action.startX)), h: Math.max(10, Math.abs(action.endY - action.startY))
                };
            }
            // NEW: Ink Strokes can now be selected!
            if (action.type === 'stroke') {
                if (!action.points || action.points.length === 0) return null;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (let p of action.points) {
                    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
                }
                return { x: minX, y: minY, w: Math.max(10, maxX - minX), h: Math.max(10, maxY - minY) };
            }
            return null; 
        }

        // 2. RAY-CASTING: Detects if an object is inside your Lasso loop
        function isPointInPolygon(point, vs) {
            let x = point.x, y = point.y; let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                let xi = vs[i].x, yi = vs[i].y; let xj = vs[j].x, yj = vs[j].y;
                let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }

        // 3. MOUSE EVENTS
        // 3. MOUSE EVENTS
// 3. MOUSE EVENTS
        function eraseAt(loc) {
            // NEW: Map the selected dropdown width to a real-world collision radius!
            // Fine = 10px radius, Marker = 100px radius.
            const sizes = { 2: 10, 4: 15, 7: 30, 12: 50, 20: 80 };            const eraserRadius = (sizes[currentWidth] || 20) / cameraZoom;
            
            let erasedTargets = [];

            // Iterate backwards to erase the top-most items first
            for (let i = history.length - 1; i >= 0; i--) {
                let action = history[i];
                if (action.type === 'erase_record') continue; 
                
                let b = getActionBounds(action);
                if (!b) continue;

                // 1. Quick Bounding Box scan
                if (loc.x >= b.x - eraserRadius && loc.x <= b.x + b.w + eraserRadius &&
                    loc.y >= b.y - eraserRadius && loc.y <= b.y + b.h + eraserRadius) {
                    
                    let hit = false;
                    if (action.type === 'stroke') {
                        // 2. High-precision point collision for ink strokes
                        for (let p of action.points) {
                            if (Math.hypot(p.x - loc.x, p.y - loc.y) <= eraserRadius + (action.width / 2)) {
                                hit = true; break;
                            }
                        }
                    } else {
                        // Shapes, Images, and Text are deleted if you touch their bounding box
                        hit = true; 
                    }

                    if (hit) {
                        // Splice it completely out of history, but memorize its exact index for Undo!
                        let removedItem = history.splice(i, 1)[0];
                        erasedTargets.push({ item: removedItem, originalIndex: i });
                    }
                }
            }

            if (erasedTargets.length > 0) {
                history.push({ type: 'erase_record', targets: erasedTargets });
                redoStack = [];
                document.getElementById('undoBtn').disabled = false;
                document.getElementById('redoBtn').disabled = true;
                saveWorkspace();
                redrawCanvas();
            }
        }
        function startPosition(e) {
            // NEW: If the sidebar is open, clicking the canvas just closes it and prevents any drawing!
            const sidebar = document.getElementById('sidebar');
            if (sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                return; 
            }

            if (e.target === textInput) return; 
            saveText();

            // Handle Panning
            if (currentTool === 'hand' || spacePressed || e.button === 1) {
                isDragging = true;
                dragStart = { x: e.clientX - cameraOffset.x, y: e.clientY - cameraOffset.y };
                canvas.style.cursor = 'grabbing';
                return;
            }

            // Handle Lasso Start
            if (currentTool === 'lasso' && e.button === 0) {
                isDrawing = true;
                lassoPoints = [getEventLocation(e)];
                return;
            }

            // Handle Laser Pointer Start
            if (currentTool === 'pointer' && e.button === 0) {
                isDrawing = true; const loc = getEventLocation(e);
                laserPoints.push({ x: loc.x, y: loc.y, time: Date.now() });
                redrawCanvas(); return;
            }

            // FIXED: Added the missing closing bracket for the Eraser!
            if (currentTool === 'eraser' && e.button === 0) {
                if (eraserMode === 'stroke') {
                    isDrawing = true;
                    eraseAt(getEventLocation(e));
                    return;
                }
            } 

            // Handle Universal Select
            if (currentTool === 'select' && e.button === 0) {
                const loc = getEventLocation(e);
                selectedAction = null; isResizingObject = false; resizeHandle = '';
                
                if (activeSelection && !['stroke', 'group'].includes(activeSelection.type)) {
                    let b = getActionBounds(activeSelection);
                    if (b) {
                        const hs = 16 / cameraZoom; 
                        const handles = [
                            { id: 'tl', x: b.x, y: b.y }, { id: 'tc', x: b.x + b.w / 2, y: b.y },
                            { id: 'tr', x: b.x + b.w, y: b.y }, { id: 'rc', x: b.x + b.w, y: b.y + b.h / 2 },
                            { id: 'br', x: b.x + b.w, y: b.y + b.h }, { id: 'bc', x: b.x + b.w / 2, y: b.y + b.h },
                            { id: 'bl', x: b.x, y: b.y + b.h }, { id: 'lc', x: b.x, y: b.y + b.h / 2 }
                        ];
                        for (let h of handles) {
                            if (loc.x >= h.x - hs && loc.x <= h.x + hs && loc.y >= h.y - hs && loc.y <= h.y + hs) {
                                selectedAction = activeSelection; isResizingObject = true; resizeHandle = h.id; break;
                            }
                        }
                    }
                }

                if (!isResizingObject) {
                    if (activeSelection && activeSelection.type === 'group') {
                        let b = getActionBounds(activeSelection);
                        if (b && loc.x >= b.x && loc.x <= b.x + b.w && loc.y >= b.y && loc.y <= b.y + b.h) selectedAction = activeSelection;
                    }
                    if (!selectedAction) {
                        for (let i = history.length - 1; i >= 0; i--) {
                            let action = history[i];
                            let b = getActionBounds(action);
                            if (b && loc.x >= b.x && loc.x <= b.x + b.w && loc.y >= b.y && loc.y <= b.y + b.h) { selectedAction = action; break; }
                        }
                    }
                }

                activeSelection = selectedAction; redrawCanvas();

                if (selectedAction) {
                    if (isResizingObject) {
                        const cursors = { tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', tc: 'ns-resize', bc: 'ns-resize', lc: 'ew-resize', rc: 'ew-resize' };
                        canvas.style.cursor = cursors[resizeHandle] || 'pointer';
                    } else {
                        isDraggingObject = true;
                        let b = getActionBounds(selectedAction);
                        dragOffset = { x: loc.x - b.x, y: loc.y - b.y };
                        canvas.style.cursor = 'grabbing';
                    }
                } else { canvas.style.cursor = 'default'; }
                return;
            }

            if (currentTool === 'text') {
                e.preventDefault();
                const loc = getEventLocation(e); textWorldPos = { x: loc.x, y: loc.y };
                const rect = canvasContainer.getBoundingClientRect();
                textInput.style.left = `${e.clientX - rect.left}px`; textInput.style.top = `${e.clientY - rect.top}px`;
                const sizes = { 2: 16, 4: 20, 7: 28, 12: 40, 20: 64 };                textInput.style.fontSize = `${(sizes[currentWidth] || 24) * cameraZoom}px`;
                
                // NEW: Apply the chosen font dynamically to the typing box!
                textInput.style.fontFamily = currentFont;
                textInput.style.fontWeight = "300"; // NEW: Force the text to render thinner!
                
                let renderColor = currentColor; if (renderColor === '#1e1e1e' && isDarkMode) renderColor = '#ececf1';
                textInput.style.color = renderColor;
                textInput.style.display = 'block';
                setTimeout(() => textInput.focus(), 10);
                return; 
            }

            if (e.button === 0) {
                const loc = getEventLocation(e); // Get coordinates FIRST

                // --- NEW: SPATIAL-TEMPORAL GAP ANALYZER ---
                // Only run if Auto-OCR is on, we are using the pen, and a word is waiting
                if (isAutoOcrEnabled && minX !== Infinity && currentTool === 'pen') {
                    // 50 pixels of forgiveness, scaled perfectly with your zoom level!
                    const safePadding = 50 / cameraZoom; 

                    // Check if the new pen stroke is inside our expanded Safe Zone
                    const isInsideX = loc.x >= (minX - safePadding) && loc.x <= (maxX + safePadding);
                    const isInsideY = loc.y >= (minY - safePadding) && loc.y <= (maxY + safePadding);

                    // If the stroke is OUTSIDE the zone (like jumping to a new line)
                    if (!isInsideX || !isInsideY) {
                        clearTimeout(autoRunTimer); // Kill the waiting timer
                        processWord();              // Process the previous word instantly
                    }
                }
                // ------------------------------------------

                isDrawing = true; clearTimeout(autoRunTimer); 
                
                if (['rect', 'circle', 'line', 'diamond', 'arrow'].includes(currentTool)) {
                    currentAction = { type: 'shape', shapeType: currentTool, color: currentColor, width: currentWidth, startX: loc.x, startY: loc.y, endX: loc.x, endY: loc.y };
                } else {
                    let w = currentWidth;
                    if (currentTool === 'highlighter' || currentTool === 'eraser') w = currentWidth * 4; 
                    let p = e.pressure !== undefined ? e.pressure : 0.5; if (p === 0) p = 0.5; 
                    
                    // FIXED: Removed the malformed copy/paste syntax error that crashed the app!
                    currentAction = { type: 'stroke', tool: currentTool, color: currentColor, width: w, points: [{x: loc.x, y: loc.y, p: p}] };
                }

                if (currentTool === 'pen') {
                    if (loc.x < minX) minX = loc.x; if (loc.y < minY) minY = loc.y; if (loc.x > maxX) maxX = loc.x; if (loc.y > maxY) maxY = loc.y;
                }
                draw(e);
            }
        }

            function draw(e) {
            // Lasso Drawing Tracker
            if (currentTool === 'lasso' && isDrawing) {
                lassoPoints.push(getEventLocation(e)); redrawCanvas(); return;
            }

            // NEW: Laser Pointer Drawing Tracker
            // NEW: Laser Pointer Drawing Tracker (Prevents stacking artifacts)
            if (currentTool === 'pointer' && isDrawing) {
                const loc = getEventLocation(e);
                if (laserPoints.length > 0) {
                    const last = laserPoints[laserPoints.length - 1];
                    const dist = Math.hypot(loc.x - last.x, loc.y - last.y);
                    // Only drop a new point if you moved enough. Otherwise, just update the head.
                    if (dist > 2 / cameraZoom) {
                        laserPoints.push({ x: loc.x, y: loc.y, time: Date.now() });
                    } else {
                        last.x = loc.x; last.y = loc.y; last.time = Date.now();
                    }
                } else {
                    laserPoints.push({ x: loc.x, y: loc.y, time: Date.now() });
                }
                redrawCanvas(); return;
            }

            // NEW: Handle Stroke Eraser Dragging
            if (currentTool === 'eraser' && isDrawing) {
                if (eraserMode === 'stroke') {
                    eraseAt(getEventLocation(e));
                    return;
                }
            }

            if (!isDragging && !isDrawing && !isDraggingObject && !isResizingObject && currentTool === 'select') {
                const loc = getEventLocation(e); let hoveringHandle = false;
                if (activeSelection && !['stroke', 'group'].includes(activeSelection.type)) {
                    let b = getActionBounds(activeSelection);
                    if (b) {
                        const hs = 16 / cameraZoom; 
                        const handles = [
                            { id: 'tl', x: b.x, y: b.y }, { id: 'tc', x: b.x + b.w / 2, y: b.y },
                            { id: 'tr', x: b.x + b.w, y: b.y }, { id: 'rc', x: b.x + b.w, y: b.y + b.h / 2 },
                            { id: 'br', x: b.x + b.w, y: b.y + b.h }, { id: 'bc', x: b.x + b.w / 2, y: b.y + b.h },
                            { id: 'bl', x: b.x, y: b.y + b.h }, { id: 'lc', x: b.x, y: b.y + b.h / 2 }
                        ];
                        for (let h of handles) {
                            if (loc.x >= h.x - hs && loc.x <= h.x + hs && loc.y >= h.y - hs && loc.y <= h.y + hs) {
                                canvas.style.cursor = { tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', tc: 'ns-resize', bc: 'ns-resize', lc: 'ew-resize', rc: 'ew-resize' }[h.id]; 
                                hoveringHandle = true; break;
                            }
                        }
                    }
                }
                if (!hoveringHandle) {
                    let hoveringBody = false;
                    if (activeSelection && activeSelection.type === 'group') {
                        let b = getActionBounds(activeSelection);
                        if (b && loc.x >= b.x && loc.x <= b.x + b.w && loc.y >= b.y && loc.y <= b.y + b.h) hoveringBody = true;
                    }
                    if (!hoveringBody) {
                        for (let i = history.length - 1; i >= 0; i--) {
                            let b = getActionBounds(history[i]);
                            if (b && loc.x >= b.x && loc.x <= b.x + b.w && loc.y >= b.y && loc.y <= b.y + b.h) { hoveringBody = true; break; }
                        }
                    }
                    canvas.style.cursor = hoveringBody ? 'move' : 'default';
                }
                return;
            }

            if (selectedAction) {
                const loc = getEventLocation(e); let b = getActionBounds(selectedAction);
                if (isResizingObject && b) {
                    let ratio = (selectedAction.type === 'image') ? selectedAction.img.width / selectedAction.img.height : b.w / b.h;
                    const rightX = b.x + b.w; const bottomY = b.y + b.h;
                    let newW = b.w; let newH = b.h; let newX = b.x; let newY = b.y;

                    if (resizeHandle === 'br') { newW = loc.x - newX; newH = selectedAction.type === 'image' ? newW / ratio : loc.y - newY; }
                    else if (resizeHandle === 'tr') { newW = loc.x - newX; newH = selectedAction.type === 'image' ? newW / ratio : bottomY - loc.y; newY = bottomY - newH; }
                    else if (resizeHandle === 'bl') { newW = rightX - loc.x; newH = selectedAction.type === 'image' ? newW / ratio : loc.y - newY; newX = loc.x; }
                    else if (resizeHandle === 'tl') { newW = rightX - loc.x; newH = selectedAction.type === 'image' ? newW / ratio : bottomY - loc.y; newX = loc.x; newY = bottomY - newH; }
                    else if (resizeHandle === 'rc') { newW = loc.x - newX; } else if (resizeHandle === 'lc') { newW = rightX - loc.x; newX = loc.x; }
                    else if (resizeHandle === 'bc') { newH = loc.y - newY; } else if (resizeHandle === 'tc') { newH = bottomY - loc.y; newY = loc.y; }

                    if (newW > 10 && newH > 10) {
                        if (selectedAction.type === 'image') {
                            selectedAction.w = newW; selectedAction.h = newH; selectedAction.x = newX; selectedAction.y = newY;
                        } else if (selectedAction.type === 'shape') {
                            if (selectedAction.startX <= selectedAction.endX) { selectedAction.startX = newX; selectedAction.endX = newX + newW; } else { selectedAction.startX = newX + newW; selectedAction.endX = newX; }
                            if (selectedAction.startY <= selectedAction.endY) { selectedAction.startY = newY; selectedAction.endY = newY + newH; } else { selectedAction.startY = newY + newH; selectedAction.endY = newY; }
                        } else if (selectedAction.type === 'ocr_text') {
                            selectedAction.box.w = newW; selectedAction.box.h = newH; selectedAction.box.x = newX; selectedAction.box.y = newY;
                        } 
                        // NEW: Dynamically scale standard text font size when dragging the box handles!
                        else if (selectedAction.type === 'text') {
                            const linesCount = selectedAction.text.split('\n').length;
                            selectedAction.size = Math.max(10, newH / (linesCount * 1.2));
                            selectedAction.x = newX; 
                            selectedAction.y = newY;
                        }
                    }
                    redrawCanvas(); return;
                }
                
                // NEW: Group Object Dragging Logic
                if (isDraggingObject && b) {
                    let newX = loc.x - dragOffset.x; let newY = loc.y - dragOffset.y;
                    let dx = newX - b.x; let dy = newY - b.y;

                    if (selectedAction.type === 'group') {
                        selectedAction.x += dx; selectedAction.y += dy;
                        for (let item of selectedAction.items) {
                            if (item.type === 'image') { item.x += dx; item.y += dy; }
                            else if (item.type === 'ocr_text') { item.box.x += dx; item.box.y += dy; }
                            else if (item.type === 'text') { item.x += dx; item.y += dy; } // NEW!
                            else if (item.type === 'shape') { item.startX += dx; item.endX += dx; item.startY += dy; item.endY += dy; }
                            else if (item.type === 'stroke') { for (let p of item.points) { p.x += dx; p.y += dy; } }
                        }
                    } else if (selectedAction.type === 'stroke') {
                        for (let p of selectedAction.points) { p.x += dx; p.y += dy; }
                    } else if (selectedAction.type === 'image') {
                        selectedAction.x += dx; selectedAction.y += dy;
                    } else if (selectedAction.type === 'ocr_text') {
                        selectedAction.box.x += dx; selectedAction.box.y += dy;
                    } else if (selectedAction.type === 'text') {
                        selectedAction.x += dx; selectedAction.y += dy; // NEW!
                    } else if (selectedAction.type === 'shape') {
                        selectedAction.startX += dx; selectedAction.endX += dx;
                        selectedAction.startY += dy; selectedAction.endY += dy;
                    }
                    redrawCanvas(); return;
                }
            }

            if (isDragging) {
                cameraOffset.x = e.clientX - dragStart.x; cameraOffset.y = e.clientY - dragStart.y; redrawCanvas(); return;
            }
            if (!isDrawing) return;
            const loc = getEventLocation(e);

            if (currentAction.type === 'shape') {
                currentAction.endX = loc.x; currentAction.endY = loc.y;
            } else {
                let p = e.pressure !== undefined ? e.pressure : 0.5; if (p === 0) p = 0.5;
                
                // NEW: Hardware Jitter Filter! 
                // Ignore the data point if the stylus moved less than 1.5 pixels. This creates silky smooth curves.
                if (currentAction.points.length > 0) {
                    const lastPt = currentAction.points[currentAction.points.length - 1];
                    const dist = Math.hypot(loc.x - lastPt.x, loc.y - lastPt.y);
                    if (dist < 1.5 / cameraZoom) return; 
                }

                currentAction.points.push({x: loc.x, y: loc.y, p: p});
                
                if (currentTool === 'pen') { 
                    if (loc.x < minX) minX = loc.x; if (loc.y < minY) minY = loc.y; if (loc.x > maxX) maxX = loc.x; if (loc.y > maxY) maxY = loc.y;
                }
            }
            redrawCanvas(); 
        }

        function endPosition(e) {
            // NEW: Lasso Finish (Ray-Casting evaluation)
            if (currentTool === 'lasso' && isDrawing) {
                isDrawing = false;
                let selectedItems = [];
                for (let i = 0; i < history.length; i++) {
                    let action = history[i]; let b = getActionBounds(action);
                    if (!b) continue;
                    
                    let cx = b.x + b.w / 2; let cy = b.y + b.h / 2;
                    if (isPointInPolygon({x: cx, y: cy}, lassoPoints)) {
                        selectedItems.push(action);
                    } else if (action.type === 'stroke') {
                        // High-precision stroke check: If ANY part of the ink is inside
                        for (let p of action.points) {
                            if (isPointInPolygon(p, lassoPoints)) { selectedItems.push(action); break; }
                        }
                    }
                }

                if (selectedItems.length > 0) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (let item of selectedItems) {
                        let b = getActionBounds(item);
                        if (b.x < minX) minX = b.x; if (b.y < minY) minY = b.y;
                        if (b.x + b.w > maxX) maxX = b.x + b.w; if (b.y + b.h > maxY) maxY = b.y + b.h;
                    }
                    activeSelection = { type: 'group', items: selectedItems, x: minX, y: minY, w: maxX - minX, h: maxY - minY };
                } else { activeSelection = null; }
                
                lassoPoints = []; setTool('select'); return; // Auto-switches to move tool!
            }
            // NEW: Laser Pointer Finish (Do NOT save to canvas history!)
            if (currentTool === 'pointer' && isDrawing) {
                isDrawing = false; return;
            }

            if (isDraggingObject || isResizingObject) {
                isDraggingObject = false; isResizingObject = false; selectedAction = null;
                canvas.style.cursor = spacePressed || currentTool === 'hand' ? 'grab' : (currentTool === 'select' ? 'default' : 'crosshair');
                return;
            }
            if (isDragging) {
                isDragging = false; canvas.style.cursor = spacePressed || currentTool === 'hand' ? 'grab' : (currentTool === 'select' ? 'default' : 'crosshair'); return;
            }
            if (!isDrawing) return;
            isDrawing = false;

            if (currentAction) {
                if (currentAction.type === 'stroke') {
                    currentAction.ocrActive = isAutoOcrEnabled;
                    currentAction.isMath = isMathModeActive; // NEW: Tell the backend this is a math stroke
                }
                
                history.push(currentAction); redoStack = [];
                document.getElementById('undoBtn').disabled = false; document.getElementById('redoBtn').disabled = true;
                saveWorkspace();
            }
            // The 800ms sweet spot!
            if (currentTool === 'pen' && isAutoOcrEnabled) { autoRunTimer = setTimeout(() => { processWord(); }, 800); }
            currentAction = null;
        }
        // Upgraded to Pointer Events to capture stylus pressure!
        canvas.addEventListener('pointerdown', startPosition);
        window.addEventListener('pointermove', draw);
        window.addEventListener('pointerup', endPosition);
        window.addEventListener('pointercancel', endPosition);

        function redrawCanvas() {
            zoomText.innerText = Math.round(cameraZoom * 100) + '%';
            
            // 1. CSS Background Engine (Pans and zooms flawlessly)
            const scaledGrid = 32 * cameraZoom; // 32px is standard college-ruled spacing
            if (bgMode === 'grid') {
                canvasContainer.style.backgroundImage = `radial-gradient(var(--grid-color) 1.5px, transparent 1.5px)`;
                canvasContainer.style.backgroundSize = `${scaledGrid}px ${scaledGrid}px`;
                canvasContainer.style.backgroundPosition = `${cameraOffset.x}px ${cameraOffset.y}px`;
            } else if (bgMode === 'ruled') {
                // Draws crisp horizontal lines
                canvasContainer.style.backgroundImage = `linear-gradient(transparent calc(100% - 1.5px), var(--grid-color) calc(100% - 1.5px))`;
                canvasContainer.style.backgroundSize = `100% ${scaledGrid}px`;
                canvasContainer.style.backgroundPosition = `0px ${cameraOffset.y}px`;
            } else {
                canvasContainer.style.backgroundImage = `none`;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.save();
            const dpr = window.devicePixelRatio || 1;
            ctx.scale(dpr, dpr);
            ctx.translate(cameraOffset.x, cameraOffset.y);
            ctx.scale(cameraZoom, cameraZoom);

            // 2. Vector Margin Line (The classic red notebook line)
            if (bgMode === 'ruled') {
                ctx.beginPath();
                ctx.moveTo(0, -999999); // Infinite vertical reach
                ctx.lineTo(0, 999999);
                ctx.lineWidth = 1.5 / cameraZoom; // Stays crisp when zoomed
                // Soft pinkish-red in light mode, muted in dark mode
                ctx.strokeStyle = isDarkMode ? 'rgba(255, 100, 100, 0.15)' : 'rgba(255, 100, 100, 0.4)';
                ctx.stroke();
            }
            
            const objectsToDraw = [...history];
            if (currentAction) objectsToDraw.push(currentAction); 

            for (let action of objectsToDraw) {
                // NEW: Skip rendering background memory blocks
                if (action.type === 'erase_record') continue;
                
                ctx.globalCompositeOperation = 'source-over';
                
                let renderColor = action.color;
                if (renderColor === '#1e1e1e' && isDarkMode) renderColor = '#ececf1';
                if (renderColor === '#ececf1' && !isDarkMode) renderColor = '#1e1e1e';

                    if (action.type === 'stroke') {
                    // FIXED: Bring back the destination-out blend mode for Normal Erasers!
                    if (action.tool === 'eraser') {
                        ctx.globalCompositeOperation = 'destination-out';
                    } else if (action.tool === 'highlighter') {
                        ctx.globalAlpha = 0.4; 
                        ctx.globalCompositeOperation = isDarkMode ? 'screen' : 'multiply'; 
                    }

                    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = renderColor;                    // 1. PEN TOOL: Uses Pressure-Sensitive micro-segments
                    if (action.points.length > 2 && action.tool === 'pen') {
                        for (let i = 1; i < action.points.length - 1; i++) {
                            const p0 = action.points[i - 1];
                            const p1 = action.points[i];
                            const p2 = action.points[i + 1];
                            
                            const midX1 = (p0.x + p1.x) / 2;
                            const midY1 = (p0.y + p1.y) / 2;
                            const midX2 = (p1.x + p2.x) / 2;
                            const midY2 = (p1.y + p2.y) / 2;
                            
                            ctx.beginPath();
                            if (i === 1) ctx.moveTo(p0.x, p0.y);
                            else ctx.moveTo(midX1, midY1);
                            
                            ctx.quadraticCurveTo(p1.x, p1.y, midX2, midY2);
                            
                            // NEW: Average the pressure across 3 points to eliminate ugly spikes!
                            const avgPress = ((p0.p || 0.5) + (p1.p || 0.5) + (p2.p || 0.5)) / 3;
                            
                            // Softened the multiplier curve so thicks and thins blend beautifully
                            ctx.lineWidth = action.width * (avgPress * 1.0 + 0.3); 
                            ctx.stroke();
                        }
                        
                        const last = action.points[action.points.length - 1];
                        const secondLast = action.points[action.points.length - 2];
                        ctx.beginPath();
                        ctx.moveTo((secondLast.x + last.x) / 2, (secondLast.y + last.y) / 2);
                        ctx.lineTo(last.x, last.y);
                        ctx.lineWidth = action.width * ((last.p || 0.5) * 1.5 + 0.25);
                        ctx.stroke();
                        
                    } 
                    // 2. HIGHLIGHTER & ERASER: Single continuous Bezier path (Prevents overlapping blobs!)
                    else if (action.points.length > 2) {
                        ctx.beginPath(); 
                        ctx.lineWidth = action.width;
                        ctx.moveTo(action.points[0].x, action.points[0].y);
                        for (let i = 1; i < action.points.length - 1; i++) {
                            const midX = (action.points[i].x + action.points[i + 1].x) / 2;
                            const midY = (action.points[i].y + action.points[i + 1].y) / 2;
                            ctx.quadraticCurveTo(action.points[i].x, action.points[i].y, midX, midY);
                        }
                        const last = action.points[action.points.length - 1];
                        ctx.lineTo(last.x, last.y);
                        ctx.stroke();
                    } 
                    // 3. FALLBACK: Short taps and dots
                    else if (action.points.length > 0) {
                        ctx.beginPath(); ctx.lineWidth = action.width;
                        ctx.moveTo(action.points[0].x, action.points[0].y);
                        for (let i = 1; i < action.points.length; i++) ctx.lineTo(action.points[i].x, action.points[i].y);
                        ctx.stroke();
                    }
                    
                    // Reset blending for the next object
                    ctx.globalAlpha = 1.0; 
                    ctx.globalCompositeOperation = 'source-over';
                }
                else if (action.type === 'shape') {
                    ctx.beginPath(); ctx.lineWidth = action.width; ctx.strokeStyle = renderColor; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    if (action.shapeType === 'rect') {
                        ctx.strokeRect(action.startX, action.startY, action.endX - action.startX, action.endY - action.startY);
                    } else if (action.shapeType === 'circle') {
                        let radiusX = Math.abs(action.endX - action.startX) / 2;
                        let radiusY = Math.abs(action.endY - action.startY) / 2;
                        let centerX = action.startX + (action.endX - action.startX) / 2;
                        let centerY = action.startY + (action.endY - action.startY) / 2;
                        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
                        ctx.stroke();
                    } else if (action.shapeType === 'line') {
                        ctx.moveTo(action.startX, action.startY); ctx.lineTo(action.endX, action.endY); ctx.stroke();
                    } else if (action.shapeType === 'diamond') {
                        let cx = action.startX + (action.endX - action.startX) / 2;
                        let cy = action.startY + (action.endY - action.startY) / 2;
                        ctx.moveTo(cx, action.startY); ctx.lineTo(action.endX, cy);
                        ctx.lineTo(cx, action.endY); ctx.lineTo(action.startX, cy);
                        ctx.closePath(); ctx.stroke();
                    } else if (action.shapeType === 'arrow') {
                        ctx.moveTo(action.startX, action.startY); ctx.lineTo(action.endX, action.endY);
                        let dx = action.endX - action.startX; let dy = action.endY - action.startY;
                        let lineLength = Math.sqrt(dx * dx + dy * dy); let angle = Math.atan2(dy, dx);
                        let headlen = Math.max(5, Math.min(lineLength * 0.2, 30)) + action.width; 
                        ctx.moveTo(action.endX, action.endY);
                        ctx.lineTo(action.endX - headlen * Math.cos(angle - Math.PI / 7), action.endY - headlen * Math.sin(angle - Math.PI / 7));
                        ctx.moveTo(action.endX, action.endY);
                        ctx.lineTo(action.endX - headlen * Math.cos(angle + Math.PI / 7), action.endY - headlen * Math.sin(angle + Math.PI / 7));
                        ctx.stroke();
                    }
                }
                else if (action.type === 'text') {
                    const fontFam = action.font || "system-ui, sans-serif"; // Use chosen font
                    ctx.font = `300 ${action.size}px ${fontFam}`; // FIXED: Force lighter font weight
                    ctx.fillStyle = renderColor;
                    ctx.textBaseline = "top";
                    const lines = action.text.split('\n');
                    const lineHeight = action.size * 1.2;
                    lines.forEach((line, i) => { ctx.fillText(line, action.x, action.y + (i * lineHeight)); });
                }
                else if (action.type === 'image') {
                    ctx.globalCompositeOperation = 'source-over';
                    // PERMANENT FIX: Only attempt to draw if the image exists and is fully loaded!
                    if (action.img && action.img.complete && action.img.naturalWidth > 0) {
                        ctx.drawImage(action.img, action.x, action.y, action.w, action.h);
                    }
                }
                else if (action.type === 'ocr_text') {
                    // FIXED: Shrunk the size math (0.5 instead of 0.65) and completely removed forced bold!
                    const fontSize = Math.max(14, action.box.h * 0.5);
                    const fontFam = action.font || "'Segoe Script', 'Bradley Hand', cursive"; // Thinner fallback

                    ctx.font = `300 ${fontSize}px ${fontFam}`; // FIXED: Force lighter font weight
                    ctx.fillStyle = renderColor;
                    ctx.textBaseline = "middle";
                    ctx.fillText(action.text, action.box.x + 10, action.box.y + (action.box.h / 2));
                }

                // NEW: UNIVERSAL SELECTION HANDLES
// UNIVERSAL SELECTION HANDLES (For single items)
                if (currentTool === 'select' && action === activeSelection) {
                    let b = getActionBounds(action);
                    if (b) {
                        const handleSize = 8 / cameraZoom;
                        ctx.lineWidth = 2 / cameraZoom; ctx.strokeStyle = '#6965db'; ctx.setLineDash([6 / cameraZoom, 6 / cameraZoom]); ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.setLineDash([]); 
                        
                        // Disable the 8 resize points for Ink Strokes (allow moving only)
                        if (action.type !== 'stroke') {
                            ctx.fillStyle = '#ffffff';
                            const handles = [
                                { x: b.x, y: b.y }, { x: b.x + b.w / 2, y: b.y }, { x: b.x + b.w, y: b.y },
                                { x: b.x + b.w, y: b.y + b.h / 2 }, { x: b.x + b.w, y: b.y + b.h },
                                { x: b.x + b.w / 2, y: b.y + b.h }, { x: b.x, y: b.y + b.h }, { x: b.x, y: b.y + b.h / 2 }
                            ];
                            handles.forEach(h => { ctx.fillRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2); ctx.strokeRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2); });
                        }
                    }
                }
            } // (END OF objectsToDraw LOOP)

            // NEW: Render Group Selection Box
            if (currentTool === 'select' && activeSelection && activeSelection.type === 'group') {
                ctx.lineWidth = 2 / cameraZoom; ctx.strokeStyle = '#6965db'; ctx.setLineDash([6 / cameraZoom, 6 / cameraZoom]);
                ctx.strokeRect(activeSelection.x, activeSelection.y, activeSelection.w, activeSelection.h);
                ctx.setLineDash([]); 
            }

            // NEW: Render the live Lasso path while drawing
            if (currentTool === 'lasso' && lassoPoints.length > 0) {
                ctx.beginPath(); ctx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
                for (let i = 1; i < lassoPoints.length; i++) ctx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
                ctx.closePath();
                ctx.lineWidth = 2 / cameraZoom; ctx.strokeStyle = '#6965db'; ctx.setLineDash([5 / cameraZoom, 5 / cameraZoom]); ctx.stroke();
                ctx.fillStyle = 'rgba(105, 101, 219, 0.1)'; ctx.fill(); ctx.setLineDash([]);
            }
            // NEW: Render fading Laser Pointer trail (Bézier Smoothed)
// NEW: Apple-Style Glowing Laser Pointer
// NEW: Apple-Style Glowing Laser Pointer (Fixed Fluid Stream)
            // NEW: Apple-Style Glowing Laser Pointer (Flawless Comet Tail)
            // NEW: Apple-Style Glowing Laser Pointer (Flawless Comet Tail)
            // NEW: Apple-Style Glowing Laser Pointer (Flawless Comet Tail)
            if (laserPoints.length > 0) {
                ctx.lineCap = 'round'; ctx.lineJoin = 'round'; 
                
                if (laserPoints.length > 2) {
                    for (let i = 1; i < laserPoints.length - 1; i++) {
                        const p0 = laserPoints[i - 1];
                        const p1 = laserPoints[i];
                        const p2 = laserPoints[i + 1];
                        
                        const age = Date.now() - p1.time;
                        const life = Math.max(0, 1 - (age / 800));
                        const width = (8 / cameraZoom) * Math.pow(life, 1.5);
                        
                        // FIX: If it's microscopically thin, skip it to kill the anti-aliasing dot!
                        if (width < 0.2) continue;
                        
                        const midX1 = (p0.x + p1.x) / 2;
                        const midY1 = (p0.y + p1.y) / 2;
                        const midX2 = (p1.x + p2.x) / 2;
                        const midY2 = (p1.y + p2.y) / 2;
                        
                        ctx.beginPath();
                        if (i === 1) ctx.moveTo(p0.x, p0.y);
                        else ctx.moveTo(midX1, midY1);
                        
                        ctx.quadraticCurveTo(p1.x, p1.y, midX2, midY2);
                        
                        ctx.lineWidth = width;
                        ctx.strokeStyle = '#ff3b30'; 
                        ctx.stroke();
                    }
                    
                    const last = laserPoints[laserPoints.length - 1];
                    const secondLast = laserPoints[laserPoints.length - 2];
                    const age = Date.now() - last.time;
                    const life = Math.max(0, 1 - (age / 800));
                    const width = (8 / cameraZoom) * Math.pow(life, 1.5);
                    
                    if (width >= 0.2) {
                        ctx.beginPath();
                        ctx.moveTo((secondLast.x + last.x) / 2, (secondLast.y + last.y) / 2);
                        ctx.lineTo(last.x, last.y);
                        ctx.lineWidth = width;
                        ctx.strokeStyle = '#ff3b30';
                        ctx.stroke();
                    }
                    
                } else if (laserPoints.length === 2) {
                    const p1 = laserPoints[0]; const p2 = laserPoints[1];
                    const life = Math.max(0, 1 - ((Date.now() - p2.time) / 800));
                    const width = (8 / cameraZoom) * Math.pow(life, 1.5);
                    
                    if (width >= 0.2) {
                        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
                        ctx.lineWidth = width;
                        ctx.strokeStyle = '#ff3b30'; 
                        ctx.stroke();
                    }
                }

                // Apple Style: The Glowing LED Head (Only visible while actively pressing down!)
                if (isDrawing && currentTool === 'pointer') {
                    const head = laserPoints[laserPoints.length - 1];
                    
                    ctx.shadowBlur = 15 / cameraZoom;
                    ctx.shadowColor = 'rgba(255, 59, 48, 0.8)'; // Soft red glow
                    
                    ctx.beginPath(); 
                    ctx.arc(head.x, head.y, 5 / cameraZoom, 0, Math.PI * 2);
                    ctx.fillStyle = '#ff3b30'; 
                    ctx.fill();
                    
                    ctx.shadowBlur = 0; // Turn off shadow so the white core stays crisp
                    ctx.beginPath(); 
                    ctx.arc(head.x, head.y, 2.5 / cameraZoom, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff'; 
                    ctx.fill();
                }
            }            
            ctx.restore(); 
        } 
        
        
        // --- MATH RENDERER ENGINE ---
        // Converts a raw LaTeX string into a visual SVG Image that the Canvas can draw
// --- MATH RENDERER ENGINE ---
        // --- MATH RENDERER ENGINE ---
// --- UNIFIED MATH RENDERER ENGINE ---
// --- UNIFIED MATH RENDERER ENGINE ---
// --- UNIFIED MATH RENDERER ENGINE ---
// --- UNIFIED MATH RENDERER ENGINE ---
        async function renderMathToCanvas(latexString, x, y, width, height) {
            return new Promise((resolve) => {
                try {
                    const mathHtml = katex.renderToString(latexString, { 
                        displayMode: true, 
                        throwOnError: false, // Prevents crashing on slightly messy AI math
                        output: 'html'
                    });

                    const safeWidth = Math.max(width + 120, 300);
                    const safeHeight = Math.max(height + 120, 200);

                    const svgData = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}">
                            <foreignObject width="100%" height="100%">
                                <div xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                                    <style>
                                        @import url('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css');
                                        
                                        /* 1. Restore pristine KaTeX layout metrics */
                                        .katex-display, .katex { 
                                            line-height: normal !important; 
                                            margin: 0 !important;
                                        }
                                        
                                        /* 2. Apply your handwriting font carefully */
                                        .katex .mathnormal, .katex .mord, .katex .mtext { 
                                            font-family: ${currentFont} !important; 
                                            font-weight: 400 !important;
                                        }
                                        
                                        /* 3. Handwriting fonts have low baselines. This pushes superscripts specifically UP. */
                                        .katex .msupsub {
                                            transform: translateY(-0.2em);
                                            display: inline-block;
                                        }
                                    </style>
                                    
                                    <div style="font-size: 28px; color: ${currentColor};">${mathHtml}</div>
                                </div>
                            </foreignObject>
                        </svg>
                    `;

                    // PERMANENT FIX: Encodes the SVG into a permanent string that survives refreshes!
                    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
                    
                    const img = new Image();
                    img.onload = () => {
                        history.push({
                            type: 'image', 
                            img: img, src: url, 
                            x: x - ((safeWidth - width) / 2), 
                            y: y - ((safeHeight - height) / 2), 
                            w: safeWidth, h: safeHeight,
                            latex: latexString 
                        });
                        redrawCanvas();
                        resolve(true);
                    };
                    img.src = url;
                } catch (error) {
                    console.warn("AI generated invalid math syntax. Ignoring stroke.");
                    resolve(false); 
                }
            });
        }        
        async function processWord() {
            if (minX === Infinity) return;
            resultsPanel.classList.add('active');
            outputDiv.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Processing with AI...</span>';

            const pad = 20;
            let boxW = (maxX - minX) + (pad * 2);
            let boxH = (maxY - minY) + (pad * 2);
            let boxX = minX - pad;
            let boxY = minY - pad;

            // 1. BOUNDING BOX NORMALIZATION
            // Prevent the AI from panicking on tiny inputs or massive spiderwebs
            const TARGET_HEIGHT = 120;
            let scaleFactor = 1.0;

            if (boxH < 60) {
                // Too small: Pad it out with whitespace
                boxY -= (60 - boxH) / 2; boxH = 60;
                if (boxW < 100) { boxX -= (100 - boxW) / 2; boxW = 100; }
            } else if (boxH > 250) {
                // Too large: Scale the internal geometry down so the AI can "see" it
                scaleFactor = TARGET_HEIGHT / boxH;
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = boxW * scaleFactor;
            tempCanvas.height = boxH * scaleFactor;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.fillStyle = "white"; tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            tempCtx.scale(scaleFactor, scaleFactor);
            tempCtx.translate(-boxX, -boxY);
            tempCtx.lineCap = "round"; tempCtx.lineJoin = "round";

            let strokesToRemove = [];

            for (let i = history.length - 1; i >= 0; i--) {
                let stroke = history[i];
                if (stroke.type === 'stroke' && stroke.tool === 'pen' && stroke.ocrActive) {
                    strokesToRemove.push(stroke);
                    
                    // 2. TYPESET THICKNESS
                    // Artificially thicken lines so they look like textbook ink
                    tempCtx.lineWidth = Math.max(stroke.width * 2.0, 4);
                    tempCtx.strokeStyle = "black";
                    tempCtx.beginPath();
                    
                    // 3. BEZIER SMOOTHING
                    // Strip out jagged hardware noise that confuses Vision Transformers
                    if (stroke.points.length > 2) {
                        tempCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
                        for (let j = 1; j < stroke.points.length - 1; j++) {
                            const midX = (stroke.points[j].x + stroke.points[j + 1].x) / 2;
                            const midY = (stroke.points[j].y + stroke.points[j + 1].y) / 2;
                            tempCtx.quadraticCurveTo(stroke.points[j].x, stroke.points[j].y, midX, midY);
                        }
                        const last = stroke.points[stroke.points.length - 1];
                        tempCtx.lineTo(last.x, last.y);
                    } else if (stroke.points.length > 0) {
                        tempCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
                        for (let pt of stroke.points) tempCtx.lineTo(pt.x, pt.y);
                    }
                    tempCtx.stroke();
                } else break; 
            }

            const dataURL = tempCanvas.toDataURL('image/png');

            try {
                const isMathCluster = strokesToRemove.length > 0 && strokesToRemove[0].isMath;
                const apiEndpoint = isMathCluster 
                    ? 'http://127.0.0.1:5000/recognize-math' 
                    : 'http://127.0.0.1:5000/recognize-text';

                const response = await fetch(apiEndpoint, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataURL })
                });
                const data = await response.json();
                
                if (data.error) {
                    outputDiv.innerHTML = `<span style="color: #e03131;">Error: ${data.error}</span>`;
                } else {
                    outputDiv.innerHTML = `<strong style="color: var(--text-main);">${data.text}</strong>`;
                    lastRecognizedText = data.text;
                    
                    history = history.filter(item => !strokesToRemove.includes(item));
                    
                    if (isMathCluster && data.text) {
                        await renderMathToCanvas(data.text, boxX, boxY, boxW, boxH);
                    } else {
                        history.push({ type: 'ocr_text', text: data.text, color: currentColor, font: currentFont, box: { x: boxX, y: boxY, w: boxW, h: boxH } });
                    }
                    
                    saveWorkspace(); 
                    redrawCanvas();
                }
            } catch (err) {
                outputDiv.innerHTML = `<span style="color: #e03131;">Server Error! Is Python running?</span>`;
            }

            minX = Infinity; minY = Infinity; maxX = 0; maxY = 0;
            setTimeout(() => { resultsPanel.classList.remove('active'); }, 5000);
        }
document.getElementById('undoBtn').addEventListener('click', () => { 
            if (isLocked) return;
            if(history.length > 0) { 
                let action = history.pop(); 
                
                // If we undo an erase, gracefully splice the items back into their exact original positions!
                if (action.type === 'erase_record') {
                    // We sort ascending so we can insert them sequentially without shifting the array indices!
                    action.targets.sort((a, b) => a.originalIndex - b.originalIndex).forEach(t => {
                        history.splice(t.originalIndex, 0, t.item);
                    });
                }
                
                redoStack.push(action); 
                undoBtn.disabled = history.length === 0; 
                redoBtn.disabled = false; 
                saveWorkspace(); 
                redrawCanvas(); 
            }
        });

        document.getElementById('redoBtn').addEventListener('click', () => { 
            if (isLocked) return;
            if(redoStack.length > 0) { 
                let action = redoStack.pop(); 
                
                // If we redo an erase, we need to pull them back out of history!
                if (action.type === 'erase_record') {
                    // We sort descending so splicing out doesn't shift the indices of the other targets!
                    action.targets.sort((a, b) => b.originalIndex - a.originalIndex).forEach(t => {
                        history.splice(t.originalIndex, 1);
                    });
                }
                
                history.push(action); 
                redoBtn.disabled = redoStack.length === 0; 
                undoBtn.disabled = false; 
                saveWorkspace(); 
                redrawCanvas(); 
            }
        });        
        
// --- AUTO-OCR TOGGLE ENGINE ---
        let isAutoOcrEnabled = false;

            document.getElementById('ocrToggleBtn').addEventListener('click', () => { 
            if (isLocked) return;
            isAutoOcrEnabled = !isAutoOcrEnabled;
            
            const btn = document.getElementById('ocrToggleBtn');
            if (isAutoOcrEnabled) {
                // Turn ON: Light up the button and switch to the active lightning bolt
                btn.classList.add('active');
                btn.innerHTML = '<i data-feather="zap"></i>';
                btn.setAttribute('title', 'Auto-OCR: ON');
                
                // NEW: Reset the bounding box so previously drawn handwriting is completely ignored!
                minX = Infinity; minY = Infinity; maxX = 0; maxY = 0; 
            } else {
                // Turn OFF: Dim the button and stop any pending conversions
                btn.classList.remove('active');
                btn.innerHTML = '<i data-feather="zap-off"></i>';
                btn.setAttribute('title', 'Auto-OCR: OFF');
                clearTimeout(autoRunTimer);
            }
            feather.replace();
        });

// --- MATH LOCK TOGGLE ENGINE ---
        let isMathModeActive = false;

        document.getElementById('mathLockBtn').addEventListener('click', () => { 
            if (isLocked) return;
            isMathModeActive = !isMathModeActive;
            
            const btn = document.getElementById('mathLockBtn');
            if (isMathModeActive) {
                // Turn ON: Highlight the button to show Math AI is active
                btn.classList.add('active');
                btn.setAttribute('title', 'Math Mode: ON');
                
                // If you were just writing English, instantly process it before switching modes!
                if (minX !== Infinity) {
                    clearTimeout(autoRunTimer);
                    processWord();
                }
            } else {
                // Turn OFF: Back to standard text
                btn.classList.remove('active');
                btn.setAttribute('title', 'Math Mode: OFF');
            }
        });


        // --- MATH MODIFIER KEY (M) ---
        window.addEventListener('keydown', (e) => {
            // Ignore if the user is typing inside a text box
            if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
            
            if (e.key.toLowerCase() === 'm' && !isLocked) {
                isMathModeActive = true;
                document.getElementById('canvas').style.cursor = 'crosshair'; // Visual feedback
            }
        });

        window.addEventListener('keyup', (e) => {
            // Turn off when they let go of the key
            if (e.key.toLowerCase() === 'm') {
                isMathModeActive = false;
                document.getElementById('canvas').style.cursor = 'default';
            }
        });




        // --- LOCK BUTTON ENGINE (READ-ONLY MODE) ---
        document.getElementById('lockBtn').addEventListener('click', () => {
            isLocked = !isLocked;
            const btn = document.getElementById('lockBtn');
            
            if (isLocked) {
                btn.innerHTML = '<i data-feather="lock"></i>';
                btn.classList.add('active');
                btn.setAttribute('title', 'Unlock Page');
                document.body.classList.add('locked-mode');
                
                // Instantly force user into a "Safe" tool to prevent accidental drawing
                if (currentTool !== 'hand' && currentTool !== 'pointer') setTool('hand');
            } else {
                btn.innerHTML = '<i data-feather="unlock"></i>';
                btn.classList.remove('active');
                btn.setAttribute('title', 'Lock Page (Read-Only)');
                document.body.classList.remove('locked-mode');
            }
            feather.replace();
        });// --- BUTTON FUNCTIONALITY: COPY TEXT ---
        document.getElementById('copyBtn').addEventListener('click', () => {
            if (!lastRecognizedText) return;
            navigator.clipboard.writeText(lastRecognizedText).then(() => {
                const btn = document.getElementById('copyBtn');
                btn.innerHTML = `<i data-feather="check" style="width:14px; margin-right:4px;"></i>Copied`;
                feather.replace();
                // Reset button after 2 seconds
                setTimeout(() => { 
                    btn.innerHTML = `<i data-feather="copy" style="width:14px; margin-right:4px;"></i>Copy`; 
                    feather.replace(); 
                }, 2000);
            });
        });

        // --- BUTTON FUNCTIONALITY: EXPORT TO PNG ---
        // --- BUTTON FUNCTIONALITY: EXPORT TO SEARCHABLE PDF ---
        document.getElementById('shareBtn').addEventListener('click', () => {
            const { jsPDF } = window.jspdf;
            
            // Create PDF matching current canvas size
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });

            // 1. Draw a solid background so it isn't transparent
            pdf.setFillColor(isDarkMode ? '#121212' : '#fdfdff');
            pdf.rect(0, 0, canvas.width, canvas.height, 'F');

            // 2. Overlay the visual canvas
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);

            // 3. Inject Invisible Text overlay for PDF Searchability (Ctrl+F)
            history.forEach(action => {
                if (action.type === 'text') {
                    const screenX = (action.x * cameraZoom) + cameraOffset.x;
                    const screenY = (action.y * cameraZoom) + cameraOffset.y;
                    pdf.setFontSize(action.size * cameraZoom);
                    
                    const lines = action.text.split('\n');
                    const lineHeight = action.size * 1.2 * cameraZoom;
                    lines.forEach((line, i) => {
                        // renderingMode: 'invisible' places text that can be searched without ruining the drawing!
                        pdf.text(line, screenX, screenY + (i * lineHeight) + (action.size * cameraZoom * 0.8), { renderingMode: "invisible" });
                    });
                } else if (action.type === 'ocr_text') {
                    const screenX = (action.box.x * cameraZoom) + cameraOffset.x;
                    const screenY = (action.box.y * cameraZoom) + cameraOffset.y;
                    const fontSize = Math.max(16, action.box.h * 0.65) * cameraZoom;
                    
                    pdf.setFontSize(fontSize);
                    pdf.text(action.text, screenX + 10, screenY + (action.box.h * cameraZoom / 2) + (fontSize * 0.3), { renderingMode: "invisible" });
                }
            });

            // Download the final PDF document
            pdf.save(`Lecture-Notes-${Date.now()}.pdf`);
        });
// --- AUTO-SAVE ENGINE (Multi-Page) ---
        function saveWorkspace() {
            try {
                // First, sync the LIVE canvas state into the pages array before saving
                if (currentPageId) {
                    const activePage = pages.find(p => p.id === currentPageId);
                    if (activePage) {
                        activePage.history = [...history];
                        activePage.bgMode = bgMode;
                        activePage.cameraOffset = { ...cameraOffset };
                        activePage.cameraZoom = cameraZoom;
                    }
                }

                // Strip un-saveable DOM Image nodes from all pages
                const pagesToSave = pages.map(page => {
                    return {
                        ...page,
                        history: page.history.map(item => item.type === 'image' ? { ...item, img: null } : item)
                    };
                });

                localStorage.setItem('notebook_pages', JSON.stringify(pagesToSave));
                localStorage.setItem('notebook_currentPageId', currentPageId);
                localStorage.setItem('notebook_theme', isDarkMode ? 'dark' : 'light');
            } catch (e) {
                console.warn("Storage limit reached! If you have too many large images, the browser won't save them.");
            }
        }

        function loadWorkspace() {
            const savedTheme = localStorage.getItem('notebook_theme');
            if (savedTheme === 'dark' && !isDarkMode) document.getElementById('themeToggleBtn').click();
            
            const savedPages = localStorage.getItem('notebook_pages');
            const savedCurrentId = localStorage.getItem('notebook_currentPageId');

            if (savedPages) {
                pages = JSON.parse(savedPages);
                // Rehydrate all images across all pages
                pages.forEach(page => {
                    page.history.forEach(item => {
                        if (item.type === 'image' && item.src) {
                            const img = new Image();
                            img.onload = () => redrawCanvas();
                            img.src = item.src;
                            item.img = img;
                        }
                    });
                });
                
                currentPageId = savedCurrentId || pages[0].id;
                
                // Boot up the canvas with the last active page
                const activePage = pages.find(p => p.id === currentPageId);
                if (activePage) {
                    history = [...activePage.history];
                    bgMode = activePage.bgMode || 'ruled';
                    cameraOffset = activePage.cameraOffset || { x: 0, y: 0 };
                    cameraZoom = activePage.cameraZoom || 1;
                }
            } else {
                // VERY FIRST BOOT: Create a default page
                const initialId = generateId();
                pages = [{ id: initialId, title: 'Lecture 1', history: [], bgMode: 'ruled', cameraOffset: {x:0, y:0}, cameraZoom: 1 }];
                currentPageId = initialId;
            }

            // Sync Background UI
            const btn = document.getElementById('bgToggleBtn');
            if (bgMode === 'grid') btn.innerHTML = '<i data-feather="grid"></i>';
            if (bgMode === 'ruled') btn.innerHTML = '<i data-feather="align-justify"></i>';
            if (bgMode === 'none') btn.innerHTML = '<i data-feather="square"></i>';
            feather.replace();

            renderSidebar();
            redrawCanvas();
        }
        
        // Sidebar Button Controls
        document.getElementById('sidebarToggleBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('open');
        });
        document.getElementById('closeSidebarBtn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
        document.getElementById('addPageBtn').addEventListener('click', () => {
            createNewPage();
        });

        // Trigger load exactly once when the page boots
        loadWorkspace();
            function resizeCanvas() { 
            const rect = canvasContainer.getBoundingClientRect(); 
            const dpr = window.devicePixelRatio || 1; // Detect Retina/High-DPI screens
            
            // Set the actual physical pixel resolution
            canvas.width = rect.width * dpr; 
            canvas.height = rect.height * dpr; 
            
            // Lock the CSS layout size
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            
            redrawCanvas(); 
        }

        window.addEventListener('resize', resizeCanvas); resizeCanvas();

        // NEW: Eraser Mode State
        let eraserMode = 'stroke';
        
        document.getElementById('modeStrokeBtn').addEventListener('click', (e) => {
            eraserMode = 'stroke';
            e.target.classList.add('active'); document.getElementById('modePixelBtn').classList.remove('active');
        });
        document.getElementById('modePixelBtn').addEventListener('click', (e) => {
            eraserMode = 'pixel';
            e.target.classList.add('active'); document.getElementById('modeStrokeBtn').classList.remove('active');
        });

        // --- PASTE THIS NEW FONT CODE HERE ---
// NEW: Font State
        let currentFont = "'Segoe Script', 'Bradley Hand', cursive";

        document.getElementById('fontSelect').addEventListener('change', (e) => {
            currentFont = e.target.value;
            
            // Instantly update the live text box if you are currently typing!
            const liveTextBox = document.getElementById('text-input');
            if (liveTextBox.style.display === 'block') {
                liveTextBox.style.fontFamily = currentFont;
            }
        });
        // -------------------------------------
        
        function setTool(toolName) {
            if (!tools[toolName]) return;
            
            // NEW: Block switching to drawing tools when in Read-Only Mode!
            if (isLocked && !['hand', 'pointer'].includes(toolName)) return; 
            
            const isAlreadyActive = (currentTool === toolName);            // FIXED: Added 'text' to the allowed dropdown menu list!
            const hasMenu = ['pen', 'highlighter', 'eraser', 'rect', 'circle', 'line', 'diamond', 'arrow', 'text'].includes(toolName);

            if (isAlreadyActive && hasMenu) {
                document.getElementById('properties-panel').classList.toggle('active');
            } else {
                currentTool = toolName;
                Object.values(tools).forEach(btn => btn.classList.remove('active'));
                tools[toolName].classList.add('active');
                document.getElementById('properties-panel').classList.remove('active');
                
                // NEW: Show the Mode toggle, and hide colors when Eraser is selected
                const colorSection = document.querySelector('.color-row').parentElement;
                const eraserRow = document.getElementById('eraser-mode-row');
                const fontRow = document.getElementById('font-style-row'); 
                
                colorSection.style.display = currentTool === 'eraser' ? 'none' : 'block';
                eraserRow.style.display = currentTool === 'eraser' ? 'block' : 'none';
                fontRow.style.display = (currentTool === 'text' || currentTool === 'pen') ? 'block' : 'none';              
                // NEW: Swap the active color based on the tool
                if (currentTool === 'highlighter') {
                    currentColor = highlighterColor;
                } else if (['pen', 'rect', 'circle', 'line', 'diamond', 'arrow', 'text'].includes(currentTool)) {
                    currentColor = penColor;
                }
                
                // Visually update the UI color swatch to match the loaded memory
                document.querySelectorAll('.color-swatch').forEach(s => {
                    s.classList.toggle('active', s.getAttribute('data-color') === currentColor);
                });
            }
            
            // Clear selection when leaving the select tool
            if (toolName !== 'select') activeSelection = null;

            canvas.style.cursor = toolName === 'hand' ? 'grab' : (toolName === 'select' ? 'default' : 'crosshair');
            redrawCanvas(); 
        }
    

        Object.keys(tools).forEach(key => tools[key].addEventListener('click', () => setTool(key)));

        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                currentColor = e.target.getAttribute('data-color');
                
                // NEW: Save the selected color to the specific tool's memory
                if (currentTool === 'highlighter') {
                    highlighterColor = currentColor;
                } else {
                    penColor = currentColor;
                }

                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        document.querySelectorAll('.width-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetBtn = e.target.closest('.width-btn');
                currentWidth = targetBtn.getAttribute('data-width');
                document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
            });
        });

        window.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts if you are currently typing in a text box
            if (e.target.tagName === 'DIV' && e.target.contentEditable === "true") return;
            
            // NEW: Handle Keyboard Deletion (Delete or Backspace)
            if ((e.key === 'Delete' || e.key === 'Backspace') && activeSelection) {
                if (isLocked) return; // Prevent deleting if the notebook is in Read-Only mode
                e.preventDefault();
                
                let erasedTargets = [];
                
                if (activeSelection.type === 'group') {
                    // Erase multiple lassoed items safely
                    for (let i = history.length - 1; i >= 0; i--) {
                        if (activeSelection.items.includes(history[i])) {
                            let removedItem = history.splice(i, 1)[0];
                            erasedTargets.push({ item: removedItem, originalIndex: i });
                        }
                    }
                } else {
                    // Erase single selected item (like a text box)
                    const index = history.indexOf(activeSelection);
                    if (index > -1) {
                        let removedItem = history.splice(index, 1)[0];
                        erasedTargets.push({ item: removedItem, originalIndex: index });
                    }
                }

                if (erasedTargets.length > 0) {
                    history.push({ type: 'erase_record', targets: erasedTargets });
                    redoStack = [];
                    document.getElementById('undoBtn').disabled = false;
                    document.getElementById('redoBtn').disabled = true;
                    
                    activeSelection = null; // Clear the selection box
                    canvas.style.cursor = 'default';
                    
                    saveWorkspace();
                    redrawCanvas();
                }
                return;
            }

            if (e.code === 'Space') {
                e.preventDefault(); 
                if (!spacePressed && !isDrawing) {
                    spacePressed = true;
                    canvas.style.cursor = 'grab';
                }
                return; 
            }

            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') { e.preventDefault(); document.getElementById('undoBtn').click(); }
                if (e.key === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); document.getElementById('redoBtn').click(); }
            } else {
                if (isLocked) return; // Block tool shortcuts in Read-Only mode
                if (e.key.toLowerCase() === 'v') setTool('select');
                if (e.key.toLowerCase() === 'h') setTool('hand');
                if (e.key.toLowerCase() === 'p') setTool('pen');
                if (e.key.toLowerCase() === 'e') setTool('eraser');
                if (e.key.toLowerCase() === 't') setTool('text');
                if (e.key.toLowerCase() === 'r') setTool('rect'); 
                if (e.key.toLowerCase() === 'o') setTool('circle'); 
                if (e.key.toLowerCase() === 'l') setTool('line');
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                spacePressed = false;
                if (!isDragging) {
                    if (currentTool === 'hand') canvas.style.cursor = 'grab';
                    else if (currentTool === 'select') canvas.style.cursor = 'default';
                    else canvas.style.cursor = 'crosshair';
                }
            }
        });
        // --- BACKGROUND ENGINE LOGIC ---
       
        
// --- BACKGROUND ENGINE LOGIC ---
        document.getElementById('bgToggleBtn').addEventListener('click', () => {
            if (bgMode === 'grid') bgMode = 'ruled';
            else if (bgMode === 'ruled') bgMode = 'none';
            else bgMode = 'grid';
            
            // NEW: Sync the background choice with the current active page!
            if (currentPageId) {
                const activePage = pages.find(p => p.id === currentPageId);
                if (activePage) activePage.bgMode = bgMode;
            }
            
            // Update the icon to match the current mode
            const btn = document.getElementById('bgToggleBtn');
            if (bgMode === 'grid') btn.innerHTML = '<i data-feather="grid"></i>';
            if (bgMode === 'ruled') btn.innerHTML = '<i data-feather="align-justify"></i>';
            if (bgMode === 'none') btn.innerHTML = '<i data-feather="square"></i>';
            feather.replace();
            
            saveWorkspace(); // Auto-save the new background!
            redrawCanvas(); 
        });
    
    
