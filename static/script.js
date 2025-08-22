// Global variables
let currentStream = null;
let currentImageData = null;
let sessionImages = [];
let photoCount = 0;
let filtersUsed = 0;
let stripsCreated = 0;
let currentFilter = 'none';

// DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
const imagePreview = document.getElementById('imagePreview');
const galleryGrid = document.getElementById('galleryGrid');
const toastContainer = document.getElementById('toastContainer');
const loadingOverlay = document.getElementById('loadingOverlay');
const fabMenu = document.querySelector('.fab-menu');
const stripContainer = document.getElementById('stripContainer');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadSessionData();
    updateStats();
});

function initializeApp() {
    // Set up canvas context
    const ctx = canvas.getContext('2d');
    
    // Initialize session ID
    updateSessionId();
    
    // Add gentle animations to elements
    addBreathingAnimation();
    
    showToast('welcome to your minimal photobooth', 'info');
}

function setupEventListeners() {
    // Camera controls
    document.getElementById('startCamera').addEventListener('click', startCamera);
    document.getElementById('capturePhoto').addEventListener('click', capturePhoto);
    document.getElementById('stopCamera').addEventListener('click', stopCamera);
    
    // File upload
    fileInput.addEventListener('change', handleFileSelect);
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleFileDrop);
    
    // Filter controls
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            if (currentImageData) {
                applyFilter(currentFilter);
            }
        });
    });
    
    // Action buttons
    document.getElementById('processImage').addEventListener('click', processCurrentImage);
    document.getElementById('saveImage').addEventListener('click', saveCurrentImage);
    document.getElementById('createStrip').addEventListener('click', createPhotoStrip);
    
    // Session controls
    document.getElementById('newSession').addEventListener('click', startNewSession);
    document.getElementById('refreshGallery').addEventListener('click', refreshGallery);
    document.getElementById('clearGallery').addEventListener('click', clearGallery);
    
    // Strip controls
    document.getElementById('downloadStrip').addEventListener('click', downloadStrip);
    document.getElementById('shareStrip').addEventListener('click', shareStrip);
    document.getElementById('printStrip').addEventListener('click', printStrip);
    
    // FAB controls
    document.getElementById('magicFab').addEventListener('click', toggleFabMenu);
    document.querySelectorAll('.fab-option').forEach(option => {
        option.addEventListener('click', handleFabAction);
    });
    
    // Tab controls
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', switchTab);
    });
    
    // Template/Frame/Effect controls
    document.querySelectorAll('.template-item, .frame-item, .effect-item').forEach(item => {
        item.addEventListener('click', handleFeatureSelect);
    });
}

// Camera functions
async function startCamera() {
    try {
        showLoading('accessing camera...');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } 
        });
        
        currentStream = stream;
        video.srcObject = stream;
        
        // Update UI
        document.getElementById('startCamera').style.display = 'none';
        document.getElementById('capturePhoto').style.display = 'inline-flex';
        document.getElementById('stopCamera').style.display = 'inline-flex';
        
        hideLoading();
        showToast('camera ready', 'success');
        
        // Add gentle pulsing to capture button
        document.getElementById('capturePhoto').classList.add('breathing-element');
        
    } catch (error) {
        console.error('Camera error:', error);
        hideLoading();
        showToast('camera access denied', 'error');
    }
}

async function capturePhoto() {
    if (!currentStream) return;
    
    try {
        // Add capture animation
        const captureBtn = document.getElementById('capturePhoto');
        captureBtn.classList.add('animate-bounce');
        
        // Set canvas dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Capture frame
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        // Create image data
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        currentImageData = imageData;
        
        // Display in preview
        displayImageInPreview(imageData);
        
        // Add to session
        sessionImages.push({
            data: imageData,
            timestamp: Date.now(),
            filter: 'none'
        });
        
        photoCount++;
        updateStats();
        updateGallery();
        
        showToast('photo captured', 'success');
        
        // Remove animation class
        setTimeout(() => {
            captureBtn.classList.remove('animate-bounce');
        }, 600);
        
    } catch (error) {
        console.error('Capture error:', error);
        showToast('capture failed', 'error');
    }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
        video.srcObject = null;
        
        // Update UI
        document.getElementById('startCamera').style.display = 'inline-flex';
        document.getElementById('capturePhoto').style.display = 'none';
        document.getElementById('stopCamera').style.display = 'none';
        
        showToast('camera stopped', 'info');
    }
}

// File handling
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    processFiles(files);
}

function handleDragOver(event) {
    event.preventDefault();
    uploadZone.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadZone.classList.remove('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    uploadZone.classList.remove('dragover');
    
    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
        processFiles(imageFiles);
    } else {
        showToast('please drop image files only', 'error');
    }
}

function processFiles(files) {
    showLoading('processing images...');
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            
            // Add to session
            sessionImages.push({
                data: imageData,
                timestamp: Date.now(),
                filter: 'none',
                filename: file.name
            });
            
            // Display first image in preview
            if (!currentImageData) {
                currentImageData = imageData;
                displayImageInPreview(imageData);
            }
            
            photoCount++;
            updateStats();
            updateGallery();
        };
        reader.readAsDataURL(file);
    });
    
    hideLoading();
    showToast(`${files.length} image(s) added`, 'success');
}

// Image processing
function displayImageInPreview(imageData) {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = `<img src="${imageData}" alt="Preview" class="minimal-transition">`;
    
    // Add gentle hover effect
    const img = preview.querySelector('img');
    img.addEventListener('mouseenter', () => {
        img.style.transform = 'scale(1.02)';
    });
    img.addEventListener('mouseleave', () => {
        img.style.transform = 'scale(1)';
    });
}

function applyFilter(filterType) {
    if (!currentImageData) return;
    
    showLoading('applying filter...');
    
    // Create temporary canvas for filtering
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);
        
        // Apply filter
        switch(filterType) {
            case 'vintage':
                applyVintageFilter(tempCtx, tempCanvas.width, tempCanvas.height);
                break;
            case 'bw':
                applyBWFilter(tempCtx, tempCanvas.width, tempCanvas.height);
                break;
            case 'blur':
                applySoftFilter(tempCtx, tempCanvas.width, tempCanvas.height);
                break;
            case 'enhance':
                applyVibrantFilter(tempCtx, tempCanvas.width, tempCanvas.height);
                break;
            case 'retro':
                applyRetroFilter(tempCtx, tempCanvas.width, tempCanvas.height);
                break;
            default:
                break;
        }
        
        const filteredData = tempCanvas.toDataURL('image/jpeg', 0.9);
        displayImageInPreview(filteredData);
        currentImageData = filteredData;
        
        hideLoading();
        
        if (filterType !== 'none') {
            filtersUsed++;
            updateStats();
            showToast(`${filterType} filter applied`, 'success');
        }
    };
    
    img.src = currentImageData;
}

// Filter implementations (simplified for minimal aesthetic)
function applyVintageFilter(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.1 + 30);     // Red
        data[i + 1] = Math.min(255, data[i + 1] * 0.9);  // Green
        data[i + 2] = Math.min(255, data[i + 2] * 0.7);  // Blue
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function applyBWFilter(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function applySoftFilter(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] + 20);
        data[i + 1] = Math.min(255, data[i + 1] + 20);
        data[i + 2] = Math.min(255, data[i + 2] + 20);
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function applyVibrantFilter(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.2);
        data[i + 1] = Math.min(255, data[i + 1] * 1.2);
        data[i + 2] = Math.min(255, data[i + 2] * 1.2);
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function applyRetroFilter(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.3 + 40);
        data[i + 1] = Math.min(255, data[i + 1] * 0.8);
        data[i + 2] = Math.min(255, data[i + 2] * 0.6);
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Action functions
function processCurrentImage() {
    if (!currentImageData) {
        showToast('no image to process', 'error');
        return;
    }
    
    showLoading('processing...');
    
    // Simulate processing time
    setTimeout(() => {
        applyFilter(currentFilter);
        hideLoading();
        showToast('image processed', 'success');
    }, 800);
}

function saveCurrentImage() {
    if (!currentImageData) {
        showToast('no image to save', 'error');
        return;
    }
    
    // Create download link
    const link = document.createElement('a');
    link.download = `photobooth-${Date.now()}.jpg`;
    link.href = currentImageData;
    link.click();
    
    showToast('image saved', 'success');
}

function createPhotoStrip() {
    if (sessionImages.length < 2) {
        showToast('need at least 2 photos for strip', 'error');
        return;
    }
    
    showLoading('creating photo strip...');
    
    // Create strip canvas
    const stripCanvas = document.createElement('canvas');
    const stripCtx = stripCanvas.getContext('2d');
    
    const stripWidth = 400;
    const photoHeight = 150;
    const padding = 20;
    const stripHeight = (photoHeight + padding) * Math.min(sessionImages.length, 4) + padding;
    
    stripCanvas.width = stripWidth;
    stripCanvas.height = stripHeight;
    
    // Background
    stripCtx.fillStyle = '#F7F5F2';
    stripCtx.fillRect(0, 0, stripWidth, stripHeight);
    
    // Add photos
    const photosToUse = sessionImages.slice(-4); // Last 4 photos
    
    let loadedImages = 0;
    photosToUse.forEach((photo, index) => {
        const img = new Image();
        img.onload = function() {
            const y = padding + (photoHeight + padding) * index;
            const x = padding;
            const width = stripWidth - (padding * 2);
            
            // Draw photo
            stripCtx.drawImage(img, x, y, width, photoHeight);
            
            // Add subtle border
            stripCtx.strokeStyle = 'rgba(139, 115, 85, 0.2)';
            stripCtx.lineWidth = 1;
            stripCtx.strokeRect(x, y, width, photoHeight);
            
            loadedImages++;
            
            if (loadedImages === photosToUse.length) {
                // Strip complete
                const stripData = stripCanvas.toDataURL('image/jpeg', 0.9);
                displayStrip(stripData);
                stripsCreated++;
                updateStats();
                hideLoading();
                showToast('photo strip created', 'success');
            }
        };
        img.src = photo.data;
    });
}

function displayStrip(stripData) {
    stripContainer.innerHTML = `<img src="${stripData}" alt="Photo Strip" class="strip-image minimal-transition">`;
}

// Gallery functions
function updateGallery() {
    galleryGrid.innerHTML = '';
    
    sessionImages.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `<img src="${image.data}" alt="Photo ${index + 1}">`;
        
        item.addEventListener('click', () => {
            currentImageData = image.data;
            displayImageInPreview(image.data);
            showToast('image selected', 'info');
        });
        
        galleryGrid.appendChild(item);
    });
}

function refreshGallery() {
    updateGallery();
    showToast('gallery refreshed', 'info');
}

function clearGallery() {
    if (sessionImages.length === 0) {
        showToast('gallery already empty', 'info');
        return;
    }
    
    if (confirm('clear all photos?')) {
        sessionImages = [];
        currentImageData = null;
        photoCount = 0;
        updateStats();
        updateGallery();
        
        // Clear preview
        document.getElementById('imagePreview').innerHTML = `
            <div class="preview-placeholder">
                <span class="placeholder-icon">○</span>
                <p>your image appears here</p>
            </div>
        `;
        
        showToast('gallery cleared', 'success');
    }
}

// Session management
function startNewSession() {
    if (confirm('start new session? current photos will be cleared.')) {
        sessionImages = [];
        currentImageData = null;
        photoCount = 0;
        filtersUsed = 0;
        stripsCreated = 0;
        
        updateStats();
        updateGallery();
        updateSessionId();
        
        // Clear preview
        document.getElementById('imagePreview').innerHTML = `
            <div class="preview-placeholder">
                <span class="placeholder-icon">○</span>
                <p>your image appears here</p>
            </div>
        `;
        
        // Clear strip
        stripContainer.innerHTML = `
            <div class="strip-placeholder">
                <span class="strip-icon">—</span>
                <p>create your first strip</p>
            </div>
        `;
        
        showToast('new session started', 'success');
    }
}

function updateSessionId() {
    const sessionId = 'minimal-' + Date.now().toString().slice(-6);
    document.getElementById('sessionId').textContent = `session: ${sessionId}`;
}

function loadSessionData() {
    // Simulate loading session data without localStorage
    console.log('Session data would be loaded from storage');
}

function saveSessionData() {
    // Simulate saving session data without localStorage
    console.log('Session data would be saved to storage');
}

// UI functions
function updateStats() {
    document.getElementById('photoCount').textContent = photoCount;
    document.getElementById('filtersUsed').textContent = filtersUsed;
    document.getElementById('stripsCreated').textContent = stripsCreated;
    
    saveSessionData();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-message">${message}</span>
            <button class="toast-close">×</button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });
    
    // Auto remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 4000);
}

function showLoading(message = 'processing...') {
    loadingOverlay.querySelector('p').textContent = message;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// FAB functions
function toggleFabMenu() {
    fabMenu.classList.toggle('active');
}

function handleFabAction(event) {
    const action = event.target.dataset.action;
    fabMenu.classList.remove('active');
    
    switch(action) {
        case 'random-filter':
            applyRandomFilter();
            break;
        case 'auto-enhance':
            autoEnhanceImage();
            break;
        case 'surprise-me':
            surpriseMe();
            break;
    }
}

function applyRandomFilter() {
    if (!currentImageData) {
        showToast('no image to filter', 'error');
        return;
    }
    
    const filters = ['vintage', 'bw', 'blur', 'enhance', 'retro'];
    const randomFilter = filters[Math.floor(Math.random() * filters.length)];
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const targetBtn = document.querySelector(`[data-filter="${randomFilter}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    
    currentFilter = randomFilter;
    applyFilter(randomFilter);
}

function autoEnhanceImage() {
    if (!currentImageData) {
        showToast('no image to enhance', 'error');
        return;
    }
    
    currentFilter = 'enhance';
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const enhanceBtn = document.querySelector('[data-filter="enhance"]');
    if (enhanceBtn) enhanceBtn.classList.add('active');
    
    applyFilter('enhance');
}

function surpriseMe() {
    const actions = [
        () => applyRandomFilter(),
        () => autoEnhanceImage(),
        () => {
            if (sessionImages.length >= 2) createPhotoStrip();
            else showToast('need more photos for strip', 'info');
        }
    ];
    
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    randomAction();
    showToast('surprise activated!', 'success');
}

// Tab functionality
function switchTab(event) {
    const targetTab = event.target.dataset.tab;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(targetTab).classList.add('active');
}

// Feature selection
function handleFeatureSelect(event) {
    const feature = event.target.dataset.template || event.target.dataset.frame || event.target.dataset.effect;
    const type = event.target.dataset.template ? 'template' : 
                event.target.dataset.frame ? 'frame' : 'effect';
    
    showToast(`${feature} ${type} applied`, 'success');
    
    // Add visual feedback
    event.target.style.transform = 'scale(0.95)';
    setTimeout(() => {
        event.target.style.transform = '';
    }, 150);
}

// Strip control functions
function downloadStrip() {
    const stripImage = stripContainer.querySelector('.strip-image');
    if (!stripImage) {
        showToast('no strip to download', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `photostrip-${Date.now()}.jpg`;
    link.href = stripImage.src;
    link.click();
    
    showToast('strip downloaded', 'success');
}

function shareStrip() {
    const stripImage = stripContainer.querySelector('.strip-image');
    if (!stripImage) {
        showToast('no strip to share', 'error');
        return;
    }
    
    if (navigator.share) {
        // Convert data URL to blob for sharing
        fetch(stripImage.src)
            .then(res => res.blob())
            .then(blob => {
                const file = new File([blob], 'photostrip.jpg', { type: 'image/jpeg' });
                return navigator.share({
                    title: 'My Photo Strip',
                    text: 'Check out my photo strip!',
                    files: [file]
                });
            })
            .then(() => showToast('strip shared', 'success'))
            .catch(() => showToast('sharing not available', 'error'));
    } else {
        // Fallback: copy to clipboard or show sharing options
        showToast('sharing not supported on this device', 'error');
    }
}

function printStrip() {
    const stripImage = stripContainer.querySelector('.strip-image');
    if (!stripImage) {
        showToast('no strip to print', 'error');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Photo Strip</title>
                <style>
                    body { 
                        margin: 0; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        min-height: 100vh; 
                    }
                    img { max-width: 100%; height: auto; }
                </style>
            </head>
            <body>
                <img src="${stripImage.src}" alt="Photo Strip" onload="window.print()">
            </body>
        </html>
    `);
    
    showToast('opening print dialog', 'info');
}

// Animation helper
function addBreathingAnimation() {
    const elements = document.querySelectorAll('.logo-text');
    elements.forEach(el => {
        if (!el.classList.contains('breathing-element')) {
            el.classList.add('breathing-element');
        }
    });
}