/**
 * Passport Photo Print Application
 * Handles photo upload, preview with zoom/pan, and layout generation for different paper sizes
 */

// Configuration for different paper sizes and photo layouts
const CONFIG = {
    // Bangladesh passport photo dimensions in mm
    photoSize: {
        width: 40,
        height: 50
    },
    // Stamp photo dimensions in mm
    stampSize: {
        width: 20,
        height: 25
    },
    // Paper sizes in mm with photo counts
    paperSizes: {
        '3R': { type: 'grid', width: 89, height: 127, photos: 4, cols: 2, rows: 2 },
        // 4R mixed layout: 5 passport (3 rotated, 2 upright) + 1 stamp
        '4R': { type: 'mixed', width: 102, height: 152 },
        'A4': { type: 'grid', width: 210, height: 297, photos: 20, cols: 4, rows: 5 }
    },
    // DPI for high-quality print output
    printDPI: 300
};

// Application state
const state = {
    uploadedImage: null,
    imageDataURL: null,
    // Zoom and position state
    zoom: 100,
    offsetX: 0,
    offsetY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0
};

// DOM Elements
const elements = {
    countrySelect: null,
    uploadArea: null,
    uploadPlaceholder: null,
    photoInput: null,
    previewContainer: null,
    previewImage: null,
    previewImageContainer: null,
    previewFrame: null,
    changePhotoBtn: null,
    layoutsSection: null,
    layout3R: null,
    layout4R: null,
    layoutA4: null,
    downloadCanvas: null,
    // Zoom controls
    zoomSlider: null,
    zoomValue: null,
    zoomIn: null,
    zoomOut: null,
    resetBtn: null
};

/**
 * Initialize the application
 */
function init() {
    // Cache DOM elements
    elements.countrySelect = document.getElementById('countrySelect');
    elements.uploadArea = document.getElementById('uploadArea');
    elements.uploadPlaceholder = document.getElementById('uploadPlaceholder');
    elements.photoInput = document.getElementById('photoInput');
    elements.previewContainer = document.getElementById('previewContainer');
    elements.previewImage = document.getElementById('previewImage');
    elements.previewImageContainer = document.getElementById('previewImageContainer');
    elements.previewFrame = document.getElementById('previewFrame');
    elements.changePhotoBtn = document.getElementById('changePhotoBtn');
    elements.layoutsSection = document.getElementById('layoutsSection');
    elements.layout3R = document.getElementById('layout3R');
    elements.layout4R = document.getElementById('layout4R');
    elements.layoutA4 = document.getElementById('layoutA4');
    elements.downloadCanvas = document.getElementById('downloadCanvas');
    elements.zoomSlider = document.getElementById('zoomSlider');
    elements.zoomValue = document.getElementById('zoomValue');
    elements.zoomIn = document.getElementById('zoomIn');
    elements.zoomOut = document.getElementById('zoomOut');
    elements.resetBtn = document.getElementById('resetBtn');

    setupEventListeners();
    initializeLayoutPapers();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Upload area click
    elements.uploadPlaceholder.addEventListener('click', () => {
        elements.photoInput.click();
    });

    // File input change
    elements.photoInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    elements.uploadPlaceholder.addEventListener('dragover', handleDragOver);
    elements.uploadPlaceholder.addEventListener('dragleave', handleDragLeave);
    elements.uploadPlaceholder.addEventListener('drop', handleDrop);

    // Change photo button
    elements.changePhotoBtn.addEventListener('click', () => {
        elements.photoInput.click();
    });

    // Download buttons
    document.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const layout = e.currentTarget.dataset.layout;
            downloadLayout(layout);
        });
    });

    // Zoom controls
    elements.zoomSlider.addEventListener('input', handleZoomChange);
    elements.zoomIn.addEventListener('click', () => adjustZoom(5));
    elements.zoomOut.addEventListener('click', () => adjustZoom(-5));
    elements.resetBtn.addEventListener('click', resetAdjustments);

    // Drag to pan
    elements.previewImageContainer.addEventListener('mousedown', startDrag);
    elements.previewImageContainer.addEventListener('mousemove', drag);
    elements.previewImageContainer.addEventListener('mouseup', endDrag);
    elements.previewImageContainer.addEventListener('mouseleave', endDrag);

    // Touch support for mobile
    elements.previewImageContainer.addEventListener('touchstart', startDragTouch);
    elements.previewImageContainer.addEventListener('touchmove', dragTouch);
    elements.previewImageContainer.addEventListener('touchend', endDrag);
}

/**
 * Initialize empty paper layouts
 */
function initializeLayoutPapers() {
    Object.entries(CONFIG.paperSizes).forEach(([size, config]) => {
        const paperElement = document.querySelector(`.paper-${size.toLowerCase()}`);
        if (paperElement) {
            paperElement.innerHTML = '';
            if (config.type === 'grid') {
                for (let i = 0; i < config.photos; i++) {
                    const cell = document.createElement('div');
                    cell.className = 'photo-cell';
                    paperElement.appendChild(cell);
                }
            } else if (size === '4R') {
                // For 4R mixed layout, we'll populate it dynamically in updatePaperLayouts
                // Just ensure the container exists
            }
        }
    });
}

/**
 * Handle drag over event
 */
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadPlaceholder.classList.add('drag-over');
}

/**
 * Handle drag leave event
 */
function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadPlaceholder.classList.remove('drag-over');
}

/**
 * Handle drop event
 */
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    elements.uploadPlaceholder.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

/**
 * Handle file selection from input
 */
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

/**
 * Process the selected file
 */
function processFile(file) {
    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        showNotification('Please upload a JPG, PNG or WEBP image.', 'error');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showNotification('Image size cannot exceed 10MB.', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            state.uploadedImage = img;
            state.imageDataURL = e.target.result;
            // Reset adjustments when new image is uploaded
            resetAdjustments();
            updateUI();
        };
        img.src = e.target.result;
    };

    reader.onerror = () => {
        showNotification('Error reading image. Please try again.', 'error');
    };

    reader.readAsDataURL(file);
}

/**
 * Handle zoom slider change
 */
function handleZoomChange(e) {
    state.zoom = parseInt(e.target.value);
    elements.zoomValue.textContent = `${state.zoom}%`;
    applyTransform();
    updatePaperLayouts();
}

/**
 * Adjust zoom by delta
 */
function adjustZoom(delta) {
    let newZoom = state.zoom + delta;
    newZoom = Math.max(100, Math.min(1000, newZoom));
    state.zoom = newZoom;
    elements.zoomSlider.value = newZoom;
    elements.zoomValue.textContent = `${newZoom}%`;
    applyTransform();
    updatePaperLayouts();
}

/**
 * Reset all adjustments
 */
function resetAdjustments() {
    state.zoom = 100;
    state.offsetX = 0;
    state.offsetY = 0;
    if (elements.zoomSlider) {
        elements.zoomSlider.value = 100;
    }
    if (elements.zoomValue) {
        elements.zoomValue.textContent = '100%';
    }
    applyTransform();
    updatePaperLayouts();
}

/**
 * Apply transform to preview image
 */
function applyTransform() {
    if (elements.previewImage && state.uploadedImage) {
        const img = state.uploadedImage;
        const previewFrameWidth = 160;
        const previewFrameHeight = 200;

        // Calculate Base Scale (Cover logic matches Canvas)
        const targetRatio = previewFrameWidth / previewFrameHeight;
        const imgRatio = img.width / img.height;

        let baseScale;
        if (imgRatio > targetRatio) {
            // Wider: scale by height
            baseScale = previewFrameHeight / img.height;
        } else {
            // Taller: scale by width
            baseScale = previewFrameWidth / img.width;
        }

        const currentScale = baseScale * (state.zoom / 100);

        // Translate needs to align center of image to center of frame first?
        // No, transform-origin is center center. 
        // We just need to translate by offsetX, offsetY.

        elements.previewImage.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${currentScale})`;
    } else if (elements.previewImage) {
        // Reset if no image
        elements.previewImage.style.transform = 'none';
    }
}

/**
 * Start dragging (mouse)
 */
function startDrag(e) {
    if (!state.uploadedImage) return;
    state.isDragging = true;
    state.dragStartX = e.clientX - state.offsetX;
    state.dragStartY = e.clientY - state.offsetY;
    elements.previewImageContainer.style.cursor = 'grabbing';
}

/**
 * Start dragging (touch)
 */
function startDragTouch(e) {
    if (!state.uploadedImage) return;
    const touch = e.touches[0];
    state.isDragging = true;
    state.dragStartX = touch.clientX - state.offsetX;
    state.dragStartY = touch.clientY - state.offsetY;
}

/**
 * Handle dragging (mouse)
 */
/**
 * Handle dragging (mouse)
 */
function drag(e) {
    if (!state.isDragging) return;
    e.preventDefault();

    state.offsetX = e.clientX - state.dragStartX;
    state.offsetY = e.clientY - state.dragStartY;

    // Allow flexible adjustment: Limit offset to reasonable bounds (e.g. +/- 100px)
    // This allows moving the photo even at 100% zoom to adjust cropping of non-centered subjects
    const limit = 150 * (state.zoom / 100);
    state.offsetX = Math.max(-limit, Math.min(limit, state.offsetX));
    state.offsetY = Math.max(-limit, Math.min(limit, state.offsetY));

    applyTransform();
}

/**
 * Handle dragging (touch)
 */
function dragTouch(e) {
    if (!state.isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    state.offsetX = touch.clientX - state.dragStartX;
    state.offsetY = touch.clientY - state.dragStartY;

    // Same limit for touch
    const limit = 150 * (state.zoom / 100);
    state.offsetX = Math.max(-limit, Math.min(limit, state.offsetX));
    state.offsetY = Math.max(-limit, Math.min(limit, state.offsetY));

    applyTransform();
}

/**
 * End dragging
 */
function endDrag() {
    if (state.isDragging) {
        state.isDragging = false;
        elements.previewImageContainer.style.cursor = 'grab';
        updatePaperLayouts();
    }
}

/**
 * Update the UI after image upload
 */
function updateUI() {
    // Show preview
    elements.previewImage.src = state.imageDataURL;
    elements.uploadPlaceholder.style.display = 'none';
    elements.previewContainer.style.display = 'flex';

    // Show layouts section
    elements.layoutsSection.style.display = 'block';

    // Apply initial transform
    applyTransform();

    // Update all paper layouts
    updatePaperLayouts();

    // Smooth scroll to layouts
    setTimeout(() => {
        elements.layoutsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/**
 * Create adjusted photo canvas for templates
 */
function createAdjustedPhotoCanvas() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set output size to passport photo dimensions at 300 DPI
    const mmToPixels = (mm) => Math.round(mm * CONFIG.printDPI / 25.4);
    const outputWidth = mmToPixels(CONFIG.photoSize.width);
    const outputHeight = mmToPixels(CONFIG.photoSize.height);

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    // Clear canvas with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputWidth, outputHeight);

    const img = state.uploadedImage;
    if (!img) return canvas;

    // --- Transform Logic: Match CSS Preview ---

    // 1. Calculate Base Scale
    // We want the image to COVER the output area initially, but NOT be cropped by context
    // Actually, user said "Don't Move/Cut photo automatically".
    // If we cover, we might cut edges. If we contain, we show white bars.
    // 'Cover' is standard 'Passport' behavior logic (fill frame).
    // Let's stick to the scaling logic we just wrote (Cover) as a base, 
    // BUT since we removed CSS object-fit, we need to ensure the JS logic aligns 
    // with how the HTML <img> is rendered.

    // In CSS now, img has no size constraints. We must set it via JS on load, 
    // OR we translate the 'Preview' logic to match.

    // Let's look at Scale Calculation again.
    const targetRatio = CONFIG.photoSize.width / CONFIG.photoSize.height;
    const imgRatio = img.width / img.height;

    let baseScale;
    if (imgRatio > targetRatio) {
        // Wider: scale by height to cover
        baseScale = outputHeight / img.height;
    } else {
        // Taller: scale by width to cover
        baseScale = outputWidth / img.width;
    }

    // 2. Apply User Zoom
    const currentScale = baseScale * (state.zoom / 100);

    // 3. User Pan
    const previewFrameWidth = 160;
    const scaleFactor = outputWidth / previewFrameWidth;

    const panX = state.offsetX * scaleFactor;
    const panY = state.offsetY * scaleFactor;

    // 4. Draw
    ctx.save();
    ctx.translate(outputWidth / 2, outputHeight / 2);
    ctx.translate(panX, panY);
    ctx.scale(currentScale, currentScale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();

    return canvas;
}

/**
 * Update all paper layouts with the adjusted image
 */
function updatePaperLayouts() {
    if (!state.uploadedImage) return;

    // Create adjusted photo
    const adjustedCanvas = createAdjustedPhotoCanvas();
    const adjustedDataURL = adjustedCanvas.toDataURL('image/jpeg', 0.95);

    Object.entries(CONFIG.paperSizes).forEach(([layoutName, config]) => {
        const paperElement = document.querySelector(`.paper-${layoutName.toLowerCase()}`);
        if (!paperElement) return;

        paperElement.innerHTML = ''; // Clear existing
        paperElement.style.display = ''; // Reset display
        paperElement.className = `paper-${layoutName.toLowerCase()}`; // Reset class

        if (layoutName === '3R') {
            // Special 3R Layout matching Photoshop Picture Package coordinates
            // We use absolute positioning based on percentages relative to paper size (3.5" x 5")
            // Coords: (0.10, 0.25), (1.83, 0.25), (0.10, 2.50), (1.83, 2.50)
            // Photo size: ~1.575" x 1.97" (40mm x 50mm)

            paperElement.style.display = 'block';
            paperElement.style.position = 'relative';

            // Calculate percentages
            const paperW = 3.5;
            const paperH = 5.0;
            const photoW = 1.5748; // 40mm
            const photoH = 1.9685; // 50mm

            // Padding for white border (1.5mm ~ 0.059 inch)
            // In preview, we can just show the photo with a white border div
            const paddingInch = 0.059;

            const positions = [
                { x: 0.10, y: 0.25 },
                { x: 1.83, y: 0.25 },
                { x: 0.10, y: 2.50 },
                { x: 1.83, y: 2.50 }
            ];

            positions.forEach(pos => {
                const wrapper = document.createElement('div');
                wrapper.className = 'photo-wrapper-absolute';

                // Style for absolute positioning
                const left = (pos.x / paperW) * 100;
                const top = (pos.y / paperH) * 100;
                const width = (photoW / paperW) * 100;
                const height = (photoH / paperH) * 100;

                // Adjust for padding (centering logic similar to download)
                // Start position is for the PHOTO top-left.
                // So wrapper should be slightly larger and shifted left/up if we want border?
                // Let's keep it simple: Wrapper IS the photo + border. 
                // Download draws box at (x - padding, y - padding).
                // So wrapper Left = (x - padding) ...

                const wrapperLeft = ((pos.x - paddingInch) / paperW) * 100;
                const wrapperTop = ((pos.y - paddingInch) / paperH) * 100;
                const wrapperW = ((photoW + paddingInch * 2) / paperW) * 100;
                const wrapperH = ((photoH + paddingInch * 2) / paperH) * 100;

                wrapper.style.position = 'absolute';
                wrapper.style.left = `${wrapperLeft}%`;
                wrapper.style.top = `${wrapperTop}%`;
                wrapper.style.width = `${wrapperW}%`;
                wrapper.style.height = `${wrapperH}%`;
                wrapper.style.background = '#fff';
                wrapper.style.padding = '1px'; // Visual approximation of padding in small preview
                wrapper.style.boxSizing = 'border-box';
                // wrapper.style.border = '1px solid #eee'; // Optional guide

                const img = document.createElement('img');
                img.src = adjustedDataURL;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain'; // or cover
                img.style.display = 'block';

                wrapper.appendChild(img);
                paperElement.appendChild(wrapper);
            });

        } else if (config.type === 'grid') {
            // Standard Grid Layout (A4)
            paperElement.className = `paper-${layoutName.toLowerCase()} layout-grid`;
            // Ensure grid display is active (overriding any inline styles if reused)
            paperElement.style.display = 'grid';

            for (let i = 0; i < config.photos; i++) {
                const cell = document.createElement('div');
                cell.className = 'photo-cell';
                const img = document.createElement('img');
                img.src = adjustedDataURL;
                cell.appendChild(img);
                paperElement.appendChild(cell);
            }
        } else if (layoutName === '4R') {
            // Special 4R Mixed Layout
            paperElement.className = `paper-4r layout-mixed`;

            // Left Column (Rotated photos)
            const leftCol = document.createElement('div');
            leftCol.className = 'p4r-col-left';
            for (let i = 0; i < 3; i++) {
                const wrapper = document.createElement('div');
                wrapper.className = 'photo-wrapper-rotated';
                const img = document.createElement('img');
                img.src = adjustedDataURL;
                wrapper.appendChild(img);
                leftCol.appendChild(wrapper);
            }
            paperElement.appendChild(leftCol);

            // Right Column (Upright photos + Stamp)
            const rightCol = document.createElement('div');
            rightCol.className = 'p4r-col-right';

            // 2 Passport Photos
            for (let i = 0; i < 2; i++) {
                const wrapper = document.createElement('div');
                wrapper.className = 'photo-wrapper-normal';
                const img = document.createElement('img');
                img.src = adjustedDataURL;
                wrapper.appendChild(img);
                rightCol.appendChild(wrapper);
            }

            // 1 Stamp Photo
            const stampWrapper = document.createElement('div');
            stampWrapper.className = 'photo-wrapper-stamp';
            const stampImg = document.createElement('img');
            stampImg.src = adjustedDataURL;
            stampWrapper.appendChild(stampImg);
            rightCol.appendChild(stampWrapper);

            paperElement.appendChild(rightCol);
        }
    });
}

/**
 * Download layout as high-resolution image at 300 DPI
 */
function downloadLayout(layoutName) {
    if (!state.uploadedImage) {
        showNotification('Please upload a photo first.', 'error');
        return;
    }

    const config = CONFIG.paperSizes[layoutName];
    if (!config) return;

    const canvas = elements.downloadCanvas;
    const ctx = canvas.getContext('2d');

    // Calculate dimensions at 300 DPI
    const mmToPixels = (mm) => Math.round(mm * CONFIG.printDPI / 25.4);

    const paperWidth = mmToPixels(config.width);
    const paperHeight = mmToPixels(config.height);
    const photoWidth = mmToPixels(CONFIG.photoSize.width);
    const photoHeight = mmToPixels(CONFIG.photoSize.height);
    const stampWidth = mmToPixels(CONFIG.stampSize.width);
    const stampHeight = mmToPixels(CONFIG.stampSize.height);

    // Set canvas size
    canvas.width = paperWidth;
    canvas.height = paperHeight;

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, paperWidth, paperHeight);

    // Create adjusted photo canvas (Upright)
    const adjustedPhoto = createAdjustedPhotoCanvas();

    // Define standard padding (2mm for single cut workflow)
    const paddingMm = 2;
    const paddingPx = mmToPixels(paddingMm);

    // Helper to draw photo with white padding (Cutting Guide Style)
    const drawPhotoWithBorder = (imgCanvas, x, y, w, h, isRotated = false) => {
        // Total block size including padding
        const blockW = w + (paddingPx * 2);
        const blockH = h + (paddingPx * 2);

        // Draw white background (padding area)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, blockW, blockH);

        // Draw Image centered in block (x + padding, y + padding)
        ctx.drawImage(imgCanvas, x + paddingPx, y + paddingPx, w, h);
    };

    if (layoutName === '3R') {
        // Specific 3R Layout (Photoshop Picture Package coordinates)
        const inchToPx = (inch) => Math.round(inch * CONFIG.printDPI);
        const coords = [
            { x: inchToPx(0.10), y: inchToPx(0.25) },
            { x: inchToPx(1.83), y: inchToPx(0.25) },
            { x: inchToPx(0.10), y: inchToPx(2.50) },
            { x: inchToPx(1.83), y: inchToPx(2.50) }
        ];

        coords.forEach(pt => {
            drawPhotoWithBorder(adjustedPhoto, pt.x - paddingPx, pt.y - paddingPx, photoWidth, photoHeight);
        });

    } else if (config.type === 'grid' && layoutName !== '3R') { // A4/Standard Grid

        // Total block size for standard photo
        const blockW = photoWidth + (paddingPx * 2);
        const blockH = photoHeight + (paddingPx * 2);

        const gapPixels = 0; // 0 gap for single cut (padding provides separation)

        // Calculate total grid size
        const totalPhotosWidth = config.cols * blockW;
        const totalPhotosHeight = config.rows * blockH;

        const marginX = (paperWidth - totalPhotosWidth) / 2;
        const marginY = (paperHeight - totalPhotosHeight) / 2;

        for (let row = 0; row < config.rows; row++) {
            for (let col = 0; col < config.cols; col++) {
                const x = marginX + col * blockW;
                const y = marginY + row * blockH;
                drawPhotoWithBorder(adjustedPhoto, x, y, photoWidth, photoHeight);
            }
        }
    } else if (layoutName === '4R') {
        // Custom 4R Layout

        // Total block sizes (Image + Padding)
        // Rotated: 50mm width, 40mm height
        const rotPhotoW = photoHeight;
        const rotPhotoH = photoWidth;
        const rotBlockW = rotPhotoW + (paddingPx * 2);
        const rotBlockH = rotPhotoH + (paddingPx * 2);

        // Upright: 40mm width, 50mm height
        const normPhotoW = photoWidth;
        const normPhotoH = photoHeight;
        const normBlockW = normPhotoW + (paddingPx * 2);
        const normBlockH = normPhotoH + (paddingPx * 2);

        // Stamp: 20mm width, 25mm height
        const stampW = stampWidth;
        const stampH = stampHeight;
        const stampBlockW = stampW + (paddingPx * 2);
        const stampBlockH = stampH + (paddingPx * 2);

        // Gap between items/columns - Set to 0 for single cut
        const gapPixels = 0;

        // --- Calculate Layout Dimensions to Center ---
        const leftColH = (rotBlockH * 3);
        const rightColH = (normBlockH * 2) + stampBlockH;

        const contentW = rotBlockW + gapPixels + normBlockW;
        const contentH = Math.max(leftColH, rightColH);

        let startX = (paperWidth - contentW) / 2;
        let startY = (paperHeight - contentH) / 2;

        // --- Draw Left Column ---
        const rotatedCanvas = document.createElement('canvas');
        rotatedCanvas.width = photoHeight;
        rotatedCanvas.height = photoWidth;
        const rctx = rotatedCanvas.getContext('2d');
        rctx.translate(photoHeight / 2, photoWidth / 2);
        rctx.rotate(-90 * Math.PI / 180);
        rctx.drawImage(adjustedPhoto, -photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight);

        let curX = startX;
        let curY = startY;

        for (let i = 0; i < 3; i++) {
            drawPhotoWithBorder(rotatedCanvas, curX, curY, rotPhotoW, rotPhotoH, true);
            curY += rotBlockH;
        }

        // --- Draw Right Column ---
        curX = startX + rotBlockW + gapPixels;
        curY = startY;

        // 2 Upright Photos
        for (let i = 0; i < 2; i++) {
            drawPhotoWithBorder(adjustedPhoto, curX, curY, normPhotoW, normPhotoH);
            curY += normBlockH;
        }

        // 1 Stamp Photo
        const stampOffsetX = (normBlockW - stampBlockW) / 2;
        drawPhotoWithBorder(adjustedPhoto, curX + stampOffsetX, curY, stampW, stampH);
    }

    // Trigger download
    const link = document.createElement('a');
    link.download = `passport-photo-${layoutName}-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 1.0);
    link.click();

    showNotification(`${layoutName} layout downloaded successfully!`, 'success');
}

/**
 * Show notification message
 */
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">
            ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}
        </span>
        <span class="notification-message">${message}</span>
    `;

    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '16px 24px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.95rem',
        fontFamily: 'Inter, sans-serif',
        zIndex: '9999',
        animation: 'slideInRight 0.3s ease-out',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        background: type === 'success' ? 'linear-gradient(135deg, #22c55e, #16a34a)' :
            type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
                'linear-gradient(135deg, #14b8a6, #0ea5e9)',
        color: '#ffffff'
    });

    // Add animation keyframes if not exists
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', init);
