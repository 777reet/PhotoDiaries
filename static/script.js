class PhotoboothApp {
    constructor() {
        this.currentImage = null;
        this.currentFilter = 'none';
        this.gallery = [];
        this.stripImages = [];
        this.sessionId = this.generateSessionId();
        this.stats = { photos: 0, filters: 0, strips: 0 };
        this.stream = null;
        this.canvas = null;
        this.ctx = null;
        this.isProcessing = false;
        this.magicMenuOpen = false;
        
        this.init();
    }
    
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeApp());
        } else {
            this.initializeApp();
        }
    }
    
    initializeApp() {
        try {
            this.setupCanvas();
            this.bindEvents();
            this.updateSessionId();
            this.updateStatsDisplay();
            this.startAmbientAnimations();
            this.setupKeyboardShortcuts();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showToast('Application failed to initialize', 'error');
        }
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        } else {
            console.warn('Canvas element not found');
        }
    }
    
    generateSessionId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    updateSessionId() {
        const sessionElement = document.getElementById('sessionId');
        if (sessionElement) {
            sessionElement.textContent = `session: ${this.sessionId}`;
        }
    }
    
    bindEvents() {
        // Camera controls
        this.addEventListener('startCamera', 'click', this.startCamera.bind(this));
        this.addEventListener('capturePhoto', 'click', this.capturePhoto.bind(this));
        this.addEventListener('stopCamera', 'click', this.stopCamera.bind(this));
        
        // File upload
        this.setupFileUpload();
        
        // Filter selection
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectFilter(e));
        });
        
        // Action buttons
        this.addEventListener('processImage', 'click', this.processImage.bind(this));
        this.addEventListener('saveImage', 'click', this.saveImage.bind(this));
        this.addEventListener('createStrip', 'click', this.createPhotoStrip.bind(this));
        
        // Gallery controls
        this.addEventListener('refreshGallery', 'click', this.refreshGallery.bind(this));
        this.addEventListener('clearGallery', 'click', this.clearGallery.bind(this));
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e));
        });
        
        // Feature options
        document.querySelectorAll('.option-card').forEach(option => {
            option.addEventListener('click', (e) => this.selectOption(e));
        });
        
        // Strip controls
        this.addEventListener('downloadStrip', 'click', this.downloadStrip.bind(this));
        this.addEventListener('shareStrip', 'click', this.shareStrip.bind(this));
        this.addEventListener('printStrip', 'click', this.printStrip.bind(this));
        
        // Magic FAB
        this.addEventListener('magicFab', 'click', this.toggleMagicMenu.bind(this));
        document.querySelectorAll('.fab-option').forEach(option => {
            option.addEventListener('click', (e) => this.handleMagicAction(e));
        });
        
        // Session reset
        this.addEventListener('newSession', 'click', this.newSession.bind(this));
        
        // Window events
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Click outside to close magic menu
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.fab-container') && this.magicMenuOpen) {
                this.closeMagicMenu();
            }
        });
    }
    
    addEventListener(elementId, event, callback) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, callback);
        } else {
            console.warn(`Element with ID '${elementId}' not found`);
        }
    }
    
    setupFileUpload() {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        
        if (!uploadZone || !fileInput) return;
        
        // Drag and drop events
        uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadZone.addEventListener('drop', this.handleDrop.bind(this));
        
        // Click to upload
        uploadZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        this.saveImage();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.newSession();
                        break;
                }
            }
            
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    this.capturePhoto();
                    break;
                case 'Escape':
                    this.closeMagicMenu();
                    break;
            }
        });
    }
    
    // Camera functionality
    async startCamera() {
        try {
            this.showLoading('Starting camera...');
            
            const constraints = {
                video: {
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    facingMode: 'user'
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            const video = document.getElementById('video');
            
            if (!video) {
                throw new Error('Video element not found');
            }
            
            video.srcObject = this.stream;
            
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = () => {
                    video.play().then(resolve).catch(reject);
                };
                video.onerror = reject;
            });
            
            this.updateCameraUI(true);
            this.hideLoading();
            this.showToast('Camera ready!', 'success');
            
        } catch (error) {
            console.error('Camera error:', error);
            this.hideLoading();
            let message = 'Camera access denied';
            if (error.name === 'NotFoundError') {
                message = 'No camera found';
            } else if (error.name === 'NotAllowedError') {
                message = 'Camera access denied';
            } else if (error.name === 'NotReadableError') {
                message = 'Camera is being used by another application';
            }
            this.showToast(message, 'error');
        }
    }
    
    capturePhoto() {
        const video = document.getElementById('video');
        
        if (!video || !this.canvas || !this.ctx) {
            this.showToast('Camera not properly initialized', 'error');
            return;
        }
        
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            this.showToast('Camera not ready', 'error');
            return;
        }
        
        // Set canvas dimensions to match video
        this.canvas.width = video.videoWidth;
        this.canvas.height = video.videoHeight;
        
        // Add capture flash effect
        this.addCaptureFlash();
        
        // Draw current video frame to canvas
        this.ctx.drawImage(video, 0, 0);
        
        // Convert to image data
        const imageData = this.canvas.toDataURL('image/jpeg', 0.9);
        
        // Load image and add to gallery
        this.loadImage(imageData);
        this.addToGallery(imageData);
        
        // Update stats
        this.updateStats('photos');
        
        this.showToast('Photo captured!', 'success');
        this.addButtonAnimation('capturePhoto', 'animate-bounce');
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        const video = document.getElementById('video');
        if (video) {
            video.srcObject = null;
        }
        
        this.updateCameraUI(false);
        this.showToast('Camera stopped', 'info');
    }
    
    updateCameraUI(isActive) {
        const startBtn = document.getElementById('startCamera');
        const captureBtn = document.getElementById('capturePhoto');
        const stopBtn = document.getElementById('stopCamera');
        
        if (startBtn) startBtn.style.display = isActive ? 'none' : 'block';
        if (captureBtn) captureBtn.style.display = isActive ? 'block' : 'none';
        if (stopBtn) stopBtn.style.display = isActive ? 'block' : 'none';
        
        const cameraPreview = document.querySelector('.camera-preview');
        if (cameraPreview) {
            if (isActive) {
                cameraPreview.classList.add('breathing-element');
            } else {
                cameraPreview.classList.remove('breathing-element');
            }
        }
    }
    
    // File upload functionality
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadZone = document.getElementById('uploadZone');
        if (uploadZone) {
            uploadZone.classList.add('dragover');
        }
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const uploadZone = document.getElementById('uploadZone');
        if (uploadZone) {
            uploadZone.classList.remove('dragover');
        }
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const uploadZone = document.getElementById('uploadZone');
        if (uploadZone) {
            uploadZone.classList.remove('dragover');
        }
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
        // Clear file input for re-selection of same file
        e.target.value = '';
    }
    
    async processFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.showToast('Please select image files only', 'error');
            return;
        }
        
        this.showLoading(`Processing ${imageFiles.length} image(s)...`);
        
        let processedCount = 0;
        let errorCount = 0;
        
        for (const file of imageFiles) {
            try {
                const imageData = await this.fileToDataURL(file);
                this.addToGallery(imageData);
                
                // Load first image in preview if none is loaded
                if (!this.currentImage) {
                    this.loadImage(imageData);
                }
                
                this.updateStats('photos');
                processedCount++;
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                errorCount++;
            }
        }
        
        this.hideLoading();
        
        if (processedCount > 0) {
            this.showToast(`${processedCount} image(s) uploaded successfully!`, 'success');
        }
        
        if (errorCount > 0) {
            this.showToast(`${errorCount} image(s) failed to upload`, 'error');
        }
        
        this.addUploadAnimation();
    }
    
    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                reject(new Error('File too large (max 10MB)'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
    
    // Image handling
    loadImage(imageData) {
        const preview = document.getElementById('imagePreview');
        if (!preview) return;
        
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = 'Preview';
        img.style.animation = 'fadeInContent 0.4s ease-out';
        
        preview.innerHTML = '';
        preview.appendChild(img);
        
        this.currentImage = imageData;
        this.enableActionButtons();
    }
    
    enableActionButtons() {
        const buttons = ['processImage', 'saveImage', 'createStrip'];
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = false;
            }
        });
    }
    
    // Filter functionality
    selectFilter(e) {
        if (!e.currentTarget) return;
        
        // Remove active class from all filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to selected filter
        e.currentTarget.classList.add('active');
        
        // Update current filter
        this.currentFilter = e.currentTarget.dataset.filter || 'none';
        
        // Add selection animation
        this.addElementAnimation(e.currentTarget, 'animate-bounce');
        
        // Auto-apply filter if image is loaded
        if (this.currentImage && !this.isProcessing) {
            setTimeout(() => this.processImage(), 200);
        }
    }
    
    async processImage() {
        if (!this.currentImage) {
            this.showToast('Please select an image first', 'error');
            return;
        }
        
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.showLoading(`Applying ${this.currentFilter} filter...`);
        
        try {
            // Convert base64 to blob
            const blob = await this.dataURLtoBlob(this.currentImage);
            
            // Create FormData
            const formData = new FormData();
            formData.append('file', blob, 'image.jpg');
            formData.append('filters', this.currentFilter);
            formData.append('session_id', this.sessionId);
            
            // Send to backend
            const response = await fetch('/upload-image/', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Failed to process image');
            }
            
            const data = await response.json();
            
            // Update preview with processed image
            this.loadImage(data.processed_image);
            this.currentImage = data.processed_image;
            
            this.updateStats('filters');
            this.hideLoading();
            this.showToast(`${this.currentFilter} filter applied!`, 'success');
            
        } catch (error) {
            console.error('Filter error:', error);
            this.hideLoading();
            this.showToast('Error applying filter', 'error');
        } finally {
            this.isProcessing = false;
        }
    }
    
    // Helper function to convert data URL to Blob
    dataURLtoBlob(dataURL) {
        return new Promise((resolve, reject) => {
            try {
                const arr = dataURL.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                resolve(new Blob([u8arr], { type: mime }));
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async applyFilter(imageData, filterType) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Apply CSS filter
                    ctx.filter = this.getFilterCSS(filterType);
                    ctx.drawImage(img, 0, 0);
                    
                    // Apply additional pixel manipulation for certain filters
                    if (this.needsPixelManipulation(filterType)) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        this.applyPixelFilter(imageData.data, filterType);
                        ctx.putImageData(imageData, 0, 0);
                    }
                    
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image for filtering'));
            img.src = imageData;
        });
    }
    
    getFilterCSS(filterType) {
        const filters = {
            none: 'none',
            vintage: 'sepia(0.8) contrast(1.2) brightness(1.1) saturate(0.8)',
            bw: 'grayscale(1) contrast(1.3)',
            blur: 'blur(2px) brightness(1.1)',
            enhance: 'contrast(1.3) saturate(1.4) brightness(1.1)',
            retro: 'sepia(0.4) hue-rotate(15deg) saturate(1.2) contrast(1.1)'
        };
        
        return filters[filterType] || 'none';
    }
    
    needsPixelManipulation(filterType) {
        return ['vintage', 'enhance', 'retro'].includes(filterType);
    }
    
    applyPixelFilter(data, filterType) {
        switch (filterType) {
            case 'vintage':
                this.applyVintageEffect(data);
                break;
            case 'enhance':
                this.applyEnhanceEffect(data);
                break;
            case 'retro':
                this.applyRetroEffect(data);
                break;
        }
    }
    
    applyVintageEffect(data) {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Vintage color matrix with warm tone
            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189) + 30);
            data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168) + 15);
            data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131) + 5);
        }
    }
    
    applyEnhanceEffect(data) {
        for (let i = 0; i < data.length; i += 4) {
            // Boost colors with slight saturation increase
            data[i] = Math.min(255, data[i] * 1.2);
            data[i + 1] = Math.min(255, data[i + 1] * 1.2);
            data[i + 2] = Math.min(255, data[i + 2] * 1.2);
        }
    }
    
    applyRetroEffect(data) {
        for (let i = 0; i < data.length; i += 4) {
            // Retro color shift with orange tint
            data[i] = Math.min(255, data[i] * 1.15 + 15);     // Red boost
            data[i + 1] = Math.min(255, data[i + 1] * 1.05 + 8); // Green slight boost
            data[i + 2] = Math.min(255, data[i + 2] * 0.9);      // Blue reduction
        }
    }
    
    // Save functionality
    saveImage() {
        if (!this.currentImage) {
            this.showToast('No image to save', 'error');
            return;
        }
        
        try {
            const link = document.createElement('a');
            link.download = `photobooth-${this.sessionId}-${Date.now()}.jpg`;
            link.href = this.currentImage;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showToast('Image saved!', 'success');
            this.addButtonAnimation('saveImage', 'animate-pulse');
            
        } catch (error) {
            console.error('Save error:', error);
            this.showToast('Failed to save image', 'error');
        }
    }
    
    // Gallery functionality
    addToGallery(imageData) {
        const galleryItem = {
            data: imageData,
            timestamp: Date.now(),
            filter: this.currentFilter,
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };
        
        this.gallery.unshift(galleryItem); // Add to beginning
        
        // Limit gallery size to prevent memory issues
        if (this.gallery.length > 50) {
            this.gallery = this.gallery.slice(0, 50);
        }
        
        this.updateGalleryDisplay();
    }
    
    updateGalleryDisplay() {
        const grid = document.getElementById('galleryGrid');
        if (!grid) return;
        
        if (this.gallery.length === 0) {
            grid.innerHTML = '<div class="gallery-empty">No photos yet. Start capturing!</div>';
            return;
        }
        
        grid.innerHTML = '';
        
        this.gallery.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'gallery-item interactive';
            div.innerHTML = `<img src="${item.data}" alt="Gallery image" loading="lazy" />`;
            
            div.addEventListener('click', () => {
                this.loadImage(item.data);
                this.showToast('Image loaded from gallery', 'success');
                this.addElementAnimation(div, 'animate-bounce');
            });
            
            // Add staggered entrance animation
            div.style.animationDelay = `${index * 0.05}s`;
            div.style.animation = 'fadeInContent 0.3s ease-out forwards';
            
            grid.appendChild(div);
        });
    }
    
    refreshGallery() {
        this.updateGalleryDisplay();
        this.showToast('Gallery refreshed', 'info');
        this.addButtonAnimation('refreshGallery', 'animate-glow');
    }
    
    clearGallery() {
        if (this.gallery.length === 0) {
            this.showToast('Gallery is already empty', 'info');
            return;
        }
        
        // Confirm before clearing
        if (!confirm('Are you sure you want to clear the gallery? This cannot be undone.')) {
            return;
        }
        
        this.gallery = [];
        this.stats.photos = 0;
        this.updateGalleryDisplay();
        this.updateStatsDisplay();
        this.showToast('Gallery cleared', 'success');
    }
    
    // Tab functionality
    switchTab(e) {
        if (!e.currentTarget) return;
        
        const tabName = e.currentTarget.dataset.tab;
        if (!tabName) return;
        
        // Remove active from all tabs and content
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Activate clicked tab and corresponding content
        e.currentTarget.classList.add('active');
        const tabContent = document.getElementById(tabName);
        if (tabContent) {
            tabContent.classList.add('active');
        }
        
        this.addElementAnimation(e.currentTarget, 'animate-bounce');
    }
    
    // Feature options
    selectOption(e) {
        if (!e.currentTarget) return;
        
        const optionType = e.currentTarget.closest('.tab-content').id;
        const optionValue = e.currentTarget.dataset[optionType.slice(0, -1)]; // Remove 's' from end
        
        this.addElementAnimation(e.currentTarget, 'animate-pulse');
        this.showToast(`${optionType.slice(0, -1)}: ${optionValue} selected`, 'success');
        
        // Apply feature effect
        this.applyFeatureEffect(optionType, optionValue);
    }
    
    applyFeatureEffect(type, value) {
        if (!this.currentImage) {
            this.showToast('Please select an image first', 'error');
            return;
        }
        
        // Placeholder for feature effects
        console.log(`Applying ${type}: ${value}`);
        this.showToast(`${value} effect applied!`, 'info');
    }
    
    // Photo strip functionality
    createPhotoStrip() {
        if (this.gallery.length < 2) {
            this.showToast('Need at least 2 photos for a strip', 'error');
            return;
        }
        
        this.showLoading('Creating photo strip...');
        
        // Take last 4 images for strip
        const stripImages = this.gallery.slice(0, 4).map(item => item.data);
        
        setTimeout(() => {
            this.generatePhotoStrip(stripImages);
            this.stripImages = stripImages;
            this.updateStats('strips');
            this.hideLoading();
            this.showToast('Photo strip created!', 'success');
        }, 1000);
    }
    
    generatePhotoStrip(images) {
        const container = document.getElementById('stripContainer');
        if (!container) return;
        
        const stripHTML = images.map((img, index) => 
            `<img src="${img}" alt="Strip image ${index + 1}" class="strip-image" 
             style="animation-delay: ${index * 0.1}s; animation: fadeInContent 0.5s ease-out forwards;" />`
        ).join('');
        
        container.innerHTML = `<div class="photo-strip animate-glow">${stripHTML}</div>`;
    }
    
    downloadStrip() {
        if (this.stripImages.length === 0) {
            this.showToast('No strip to download', 'error');
            return;
        }
        
        this.showLoading('Preparing download...');
        
        this.createStripCanvas().then(canvas => {
            const link = document.createElement('a');
            link.download = `photo-strip-${this.sessionId}-${Date.now()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.hideLoading();
            this.showToast('Strip downloaded!', 'success');
        }).catch(error => {
            console.error('Download error:', error);
            this.hideLoading();
            this.showToast('Failed to download strip', 'error');
        });
    }
    
    createStripCanvas() {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const stripWidth = 1200;
            const stripHeight = 300;
            const imageWidth = stripWidth / this.stripImages.length;
            
            canvas.width = stripWidth;
            canvas.height = stripHeight;
            
            // White background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, stripWidth, stripHeight);
            
            let loadedCount = 0;
            
            this.stripImages.forEach((imgData, index) => {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, index * imageWidth, 0, imageWidth, stripHeight);
                    loadedCount++;
                    
                    if (loadedCount === this.stripImages.length) {
                        resolve(canvas);
                    }
                };
                img.onerror = () => reject(new Error(`Failed to load strip image ${index}`));
                img.src = imgData;
            });
        });
    }
    
    shareStrip() {
        if (this.stripImages.length === 0) {
            this.showToast('No strip to share', 'error');
            return;
        }
        
        if (navigator.share) {
            navigator.share({
                title: 'My Photobooth Strip',
                text: 'Check out my photobooth strip!',
                url: window.location.href
            }).then(() => {
                this.showToast('Shared successfully!', 'success');
            }).catch(error => {
                console.log('Share cancelled or failed:', error);
                this.fallbackShare();
            });
        } else {
            this.fallbackShare();
        }
    }
    
    fallbackShare() {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showToast('Link copied to clipboard!', 'success');
            }).catch(() => {
                this.showToast('Unable to share', 'error');
            });
        } else {
            this.showToast('Sharing not supported on this browser', 'info');
        }
    }
    
    printStrip() {
        if (this.stripImages.length === 0) {
            this.showToast('No strip to print', 'error');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        const stripHTML = this.stripImages.map((img, index) => 
            `<img src="${img}" alt="Strip ${index + 1}" class="strip-image" />`
        ).join('');
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Photobooth Strip - Print</title>
                <style>
                    body { margin: 20px; font-family: Arial, sans-serif; text-align: center; }
                    .photo-strip { display: flex; gap: 4px; justify-content: center; margin: 20px 0; }
                    .strip-image { width: 150px; height: 200px; object-fit: cover; border: 1px solid #ccc; }
                    .print-info { margin-top: 20px; font-size: 12px; color: #666; }
                    @media print { 
                        body { margin: 10px; }
                        .photo-strip { margin: 10px 0; }
                    }
                </style>
            </head>
            <body>
                <h2>Photobooth Strip</h2>
                <div class="photo-strip">${stripHTML}</div>
                <div class="print-info">
                    Session: ${this.sessionId} | Generated: ${new Date().toLocaleDateString()}
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
        
        this.showToast('Opening print dialog...', 'info');
    }
    
    // Magic FAB functionality
    toggleMagicMenu() {
        const menu = document.querySelector('.fab-menu');
        if (!menu) return;
        
        this.magicMenuOpen = !this.magicMenuOpen;
        
        if (this.magicMenuOpen) {
            menu.classList.add('active');
            this.addElementAnimation(document.getElementById('magicFab'), 'animate-bounce');
        } else {
            menu.classList.remove('active');
        }
    }
    
    closeMagicMenu() {
        const menu = document.querySelector('.fab-menu');
        if (menu) {
            menu.classList.remove('active');
            this.magicMenuOpen = false;
        }
    }
    
    handleMagicAction(e) {
        if (!e.currentTarget) return;
        
        const action = e.currentTarget.dataset.action;
        
        switch (action) {
            case 'random-filter':
                this.applyRandomFilter();
                break;
            case 'auto-enhance':
                this.autoEnhance();
                break;
            case 'surprise-me':
                this.surpriseMe();
                break;
            default:
                console.warn('Unknown magic action:', action);
        }
        
        this.closeMagicMenu();
    }
    
    applyRandomFilter() {
        const filters = ['vintage', 'bw', 'blur', 'enhance', 'retro'];
        const randomFilter = filters[Math.floor(Math.random() * filters.length)];
        
        const filterBtn = document.querySelector(`[data-filter="${randomFilter}"]`);
        if (filterBtn) {
            filterBtn.click();
            this.showToast(`Random filter: ${randomFilter}!`, 'success');
        }
    }
    
    autoEnhance() {
        if (!this.currentImage) {
            this.showToast('Please select an image first', 'error');
            return;
        }
        
        const enhanceBtn = document.querySelector('[data-filter="enhance"]');
        if (enhanceBtn) {
            enhanceBtn.click();
            this.showToast('Auto-enhanced!', 'success');
        }
    }
    
    surpriseMe() {
        const surprises = [
            () => this.createConfetti(),
            () => this.triggerRandomColorScheme(),
            () => this.addSparkleEffect(),
            () => this.bounceAllElements()
        ];
        
        const randomSurprise = surprises[Math.floor(Math.random() * surprises.length)];
        randomSurprise();
        
        this.showToast('Surprise activated!', 'success');
    }
    
    // Fun effects
    createConfetti() {
        const colors = ['#a8b5a0', '#c4967a', '#d4c4b0', '#e8ddd0', '#f5f2ed'];
        const confettiCount = 60;
        
        for (let i = 0; i < confettiCount; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                
                Object.assign(confetti.style, {
                    position: 'fixed',
                    width: Math.random() * 8 + 4 + 'px',
                    height: Math.random() * 8 + 4 + 'px',
                    backgroundColor: colors[Math.floor(Math.random() * colors.length)],
                    left: Math.random() * window.innerWidth + 'px',
                    top: '-20px',
                    zIndex: '9999',
                    borderRadius: Math.random() > 0.5 ? '50%' : '0',
                    pointerEvents: 'none',
                    transform: `rotate(${Math.random() * 360}deg)`
                });
                
                document.body.appendChild(confetti);
                
                const fallDuration = Math.random() * 3000 + 2000;
                const horizontalDrift = (Math.random() - 0.5) * 100;
                
                confetti.animate([
                    { 
                        transform: `translateY(0px) translateX(0px) rotate(0deg)`,
                        opacity: 1 
                    },
                    { 
                        transform: `translateY(${window.innerHeight + 50}px) translateX(${horizontalDrift}px) rotate(360deg)`,
                        opacity: 0 
                    }
                ], {
                    duration: fallDuration,
                    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                });
                
                setTimeout(() => {
                    if (document.body.contains(confetti)) {
                        document.body.removeChild(confetti);
                    }
                }, fallDuration);
            }, i * 50);
        }
    }
    
    triggerRandomColorScheme() {
        const schemes = [
            { '--sage-accent': '#ff6b6b', '--terracotta': '#4ecdc4', '--taupe': '#45b7d1' },
            { '--sage-accent': '#96ceb4', '--terracotta': '#feca57', '--taupe': '#ff9ff3' },
            { '--sage-accent': '#fd79a8', '--terracotta': '#6c5ce7', '--taupe': '#a29bfe' },
            { '--sage-accent': '#00d2d3', '--terracotta': '#ff9f43', '--taupe': '#ee5a6f' }
        ];
        
        const randomScheme = schemes[Math.floor(Math.random() * schemes.length)];
        const root = document.documentElement;
        
        // Apply color scheme
        Object.entries(randomScheme).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
        
        // Reset after 5 seconds
        setTimeout(() => {
            Object.keys(randomScheme).forEach(property => {
                root.style.removeProperty(property);
            });
        }, 5000);
    }
    
    addSparkleEffect() {
        const sparkleCount = 25;
        const sparkleEmojis = ['✨', '⭐', '🌟', '💫'];
        
        for (let i = 0; i < sparkleCount; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                
                Object.assign(sparkle.style, {
                    position: 'fixed',
                    left: Math.random() * window.innerWidth + 'px',
                    top: Math.random() * window.innerHeight + 'px',
                    zIndex: '9999',
                    fontSize: Math.random() * 15 + 15 + 'px',
                    pointerEvents: 'none',
                    userSelect: 'none'
                });
                
                sparkle.textContent = sparkleEmojis[Math.floor(Math.random() * sparkleEmojis.length)];
                document.body.appendChild(sparkle);
                
                sparkle.animate([
                    { 
                        transform: 'scale(0) rotate(0deg)', 
                        opacity: 0 
                    },
                    { 
                        transform: 'scale(1.2) rotate(180deg)', 
                        opacity: 1,
                        offset: 0.5 
                    },
                    { 
                        transform: 'scale(0) rotate(360deg)', 
                        opacity: 0 
                    }
                ], {
                    duration: 2500,
                    easing: 'ease-in-out'
                });
                
                setTimeout(() => {
                    if (document.body.contains(sparkle)) {
                        document.body.removeChild(sparkle);
                    }
                }, 2500);
            }, i * 80);
        }
    }
    
    bounceAllElements() {
        const elements = document.querySelectorAll('.panel, .btn, .filter-btn, .option-card, .gallery-item');
        
        elements.forEach((el, index) => {
            setTimeout(() => {
                this.addElementAnimation(el, 'animate-bounce');
            }, index * 50);
        });
    }
    
    // Session management
    newSession() {
        if (!confirm('Start a new session? This will clear the current gallery and reset stats.')) {
            return;
        }
        
        this.sessionId = this.generateSessionId();
        this.gallery = [];
        this.stripImages = [];
        this.currentImage = null;
        this.currentFilter = 'none';
        this.stats = { photos: 0, filters: 0, strips: 0 };
        
        // Reset UI
        this.updateSessionId();
        this.updateStatsDisplay();
        this.updateGalleryDisplay();
        this.clearImagePreview();
        this.resetFilterSelection();
        
        // Stop camera if running
        this.stopCamera();
        
        this.showToast('New session started!', 'success');
    }
    
    clearImagePreview() {
        const preview = document.getElementById('imagePreview');
        if (preview) {
            preview.innerHTML = `
                <div class="preview-placeholder floating-placeholder">
                    <div class="placeholder-content">
                        <span class="placeholder-icon breathing-circle">○</span>
                        <p class="placeholder-text">your image appears here</p>
                        <div class="placeholder-hint">upload or capture to begin</div>
                    </div>
                </div>
            `;
        }
        
        // Disable action buttons
        const buttons = ['processImage', 'saveImage', 'createStrip'];
        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
            }
        });
    }
    
    resetFilterSelection() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const noneFilter = document.querySelector('[data-filter="none"]');
        if (noneFilter) {
            noneFilter.classList.add('active');
        }
    }
    
    // Stats management
    updateStats(type) {
        if (this.stats.hasOwnProperty(type)) {
            this.stats[type]++;
            this.updateStatsDisplay();
        }
    }
    
    updateStatsDisplay() {
        const elements = {
            photoCount: this.stats.photos,
            filtersUsed: this.stats.filters,
            stripsCreated: this.stats.strips
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }
    
    // Utility methods
    addCaptureFlash() {
        const flash = document.createElement('div');
        
        Object.assign(flash.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            zIndex: '9999',
            pointerEvents: 'none'
        });
        
        document.body.appendChild(flash);
        
        flash.animate([
            { opacity: 0 },
            { opacity: 0.9 },
            { opacity: 0 }
        ], {
            duration: 150,
            easing: 'ease-out'
        });
        
        setTimeout(() => {
            if (document.body.contains(flash)) {
                document.body.removeChild(flash);
            }
        }, 150);
    }
    
    addElementAnimation(element, animationClass) {
        if (!element) return;
        
        element.classList.add(animationClass);
        setTimeout(() => {
            element.classList.remove(animationClass);
        }, 600);
    }
    
    addButtonAnimation(buttonId, animationClass) {
        const button = document.getElementById(buttonId);
        if (button) {
            this.addElementAnimation(button, animationClass);
        }
    }
    
    addUploadAnimation() {
        const uploadZone = document.getElementById('uploadZone');
        if (uploadZone) {
            this.addElementAnimation(uploadZone, 'animate-pulse');
        }
    }
    
    startAmbientAnimations() {
        // Add breathing effect to certain elements
        const breathingElements = document.querySelectorAll('.breathing-circle, .placeholder-icon');
        breathingElements.forEach(el => {
            el.style.animation = 'breathingScale 4s ease-in-out infinite';
        });
        
        // Add floating effect to placeholders
        const floatingElements = document.querySelectorAll('.floating-placeholder');
        floatingElements.forEach(el => {
            el.style.animation = 'gentleFloat 6s ease-in-out infinite';
        });
    }
    
    handleResize() {
        // Handle responsive behavior if needed
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile && this.magicMenuOpen) {
            this.closeMagicMenu();
        }
    }
    
    // Loading and toast functionality
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            const text = overlay.querySelector('.loading-text');
            if (text) {
                text.textContent = message;
            }
            overlay.classList.add('active');
        }
    }
    
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const content = document.createElement('div');
        content.className = 'toast-content';
        
        const messageEl = document.createElement('span');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => this.removeToast(toast);
        
        content.appendChild(messageEl);
        content.appendChild(closeBtn);
        toast.appendChild(content);
        
        container.appendChild(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
        });
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            this.removeToast(toast);
        }, 5000);
    }
    
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container toast-modern';
        document.body.appendChild(container);
        return container;
    }
    
    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.transform = 'translateX(320px)';
            toast.style.opacity = '0';
            
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }
    
    // Error handling
    handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);
        this.hideLoading();
        this.showToast(`Error: ${error.message || 'Something went wrong'}`, 'error');
    }
    
    // Cleanup
    cleanup() {
        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        // Clear intervals/timeouts if any
        // Remove event listeners if needed for cleanup
        
        console.log('Photobooth app cleaned up');
    }
}

// Initialize the app when the script loads
document.addEventListener('DOMContentLoaded', () => {
    window.photobooth = new PhotoboothApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.photobooth) {
        window.photobooth.cleanup();
    }
});