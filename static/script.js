// Enhanced Photobooth Application
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
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.bindEvents();
        this.updateSessionId();
        this.loadGallery();
        this.initializeFeatures();
        this.setupMagicEffects();
        this.startAmbientAnimations();
        this.updateStatsDisplay();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
    }
    
    generateSessionId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    
    updateSessionId() {
        document.getElementById('sessionId').textContent = `session: ${this.sessionId}`;
    }
    
    bindEvents() {
        // Camera controls
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('capturePhoto').addEventListener('click', () => this.capturePhoto());
        document.getElementById('stopCamera').addEventListener('click', () => this.stopCamera());
        
        // Upload
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        
        uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadZone.addEventListener('drop', (e) => this.handleDrop(e));
        uploadZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectFilter(e));
        });
        
        // Action buttons
        document.getElementById('processImage').addEventListener('click', () => this.processImage());
        document.getElementById('saveImage').addEventListener('click', () => this.saveImage());
        document.getElementById('createStrip').addEventListener('click', () => this.createPhotoStrip());
        
        // Gallery controls
        document.getElementById('refreshGallery').addEventListener('click', () => this.refreshGallery());
        document.getElementById('clearGallery').addEventListener('click', () => this.clearGallery());
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e));
        });
        
        // Feature options
        document.querySelectorAll('.option-card').forEach(option => {
            option.addEventListener('click', (e) => this.selectOption(e));
        });
        
        // Strip controls
        document.getElementById('downloadStrip').addEventListener('click', () => this.downloadStrip());
        document.getElementById('shareStrip').addEventListener('click', () => this.shareStrip());
        document.getElementById('printStrip').addEventListener('click', () => this.printStrip());
        
        // FAB and magic menu
        document.getElementById('magicFab').addEventListener('click', () => this.toggleMagicMenu());
        document.querySelectorAll('.option-enhanced').forEach(option => {
            option.addEventListener('click', (e) => this.handleMagicAction(e));
        });
        
        // Session reset
        document.getElementById('newSession').addEventListener('click', () => this.newSession());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Resize handling
        window.addEventListener('resize', () => this.handleResize());
    }
    
    // Camera functionality
    async startCamera() {
        try {
            this.showLoading('starting camera...');
            
            const constraints = {
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    facingMode: 'user'
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            const video = document.getElementById('video');
            video.srcObject = this.stream;
            
            await new Promise(resolve => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
            
            // Update UI
            document.getElementById('startCamera').style.display = 'none';
            document.getElementById('capturePhoto').style.display = 'block';
            document.getElementById('stopCamera').style.display = 'block';
            
            // Add camera active animation
            document.querySelector('.camera-preview').classList.add('breathing-element');
            
            this.hideLoading();
            this.showToast('Camera ready!', 'success');
            
        } catch (error) {
            console.error('Camera error:', error);
            this.hideLoading();
            this.showToast('Camera access denied or unavailable', 'error');
        }
    }
    
    capturePhoto() {
        const video = document.getElementById('video');
        const canvas = this.canvas;
        const ctx = this.ctx;
        
        // Set canvas dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Add capture flash effect
        this.addCaptureFlash();
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0);
        
        // Convert to image data
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        this.loadImageFromData(imageData);
        
        // Update stats
        this.updateStats('photos', 1);
        
        // Add to gallery
        this.addToGallery(imageData);
        
        this.showToast('Photo captured!', 'success');
        
        // Add bounce animation to capture button
        document.getElementById('capturePhoto').classList.add('animate-bounce');
        setTimeout(() => {
            document.getElementById('capturePhoto').classList.remove('animate-bounce');
        }, 600);
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        const video = document.getElementById('video');
        video.srcObject = null;
        
        // Update UI
        document.getElementById('startCamera').style.display = 'block';
        document.getElementById('capturePhoto').style.display = 'none';
        document.getElementById('stopCamera').style.display = 'none';
        
        // Remove camera animation
        document.querySelector('.camera-preview').classList.remove('breathing-element');
        
        this.showToast('Camera stopped', 'info');
    }
    
    // Upload functionality
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadZone').classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadZone').classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('uploadZone').classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }
    
    async processFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.showToast('Please select image files only', 'error');
            return;
        }
        
        this.showLoading('processing images...');
        
        for (const file of imageFiles) {
            try {
                const imageData = await this.fileToDataURL(file);
                this.addToGallery(imageData);
                
                // Load first image in preview
                if (!this.currentImage) {
                    this.loadImageFromData(imageData);
                }
                
                this.updateStats('photos', 1);
            } catch (error) {
                console.error('Error processing file:', error);
                this.showToast(`Error processing ${file.name}`, 'error');
            }
        }
        
        this.hideLoading();
        this.showToast(`${imageFiles.length} image(s) uploaded!`, 'success');
        
        // Add upload success animation
        document.getElementById('uploadZone').classList.add('animate-pulse');
        setTimeout(() => {
            document.getElementById('uploadZone').classList.remove('animate-pulse');
        }, 2000);
    }
    
    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // Image loading and display
    loadImageFromData(imageData) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${imageData}" alt="Preview" class="animate-bounce" />`;
        this.currentImage = imageData;
        
        // Enable action buttons
        this.enableActionButtons();
    }
    
    enableActionButtons() {
        document.getElementById('processImage').disabled = false;
        document.getElementById('saveImage').disabled = false;
        document.getElementById('createStrip').disabled = false;
    }
    
    // Filter functionality
    selectFilter(e) {
        // Remove active class from all filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked filter
        e.currentTarget.classList.add('active');
        
        // Update current filter
        this.currentFilter = e.currentTarget.dataset.filter;
        
        // Add filter selection animation
        e.currentTarget.classList.add('animate-bounce');
        setTimeout(() => {
            e.currentTarget.classList.remove('animate-bounce');
        }, 600);
        
        // Auto-apply filter if image is loaded
        if (this.currentImage) {
            this.processImage();
        }
    }
    
    async processImage() {
        if (!this.currentImage) {
            this.showToast('Please select an image first', 'error');
            return;
        }
        
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.showLoading('applying filter...');
        
        try {
            const filteredImage = await this.applyFilter(this.currentImage, this.currentFilter);
            
            // Update preview
            const preview = document.getElementById('imagePreview');
            preview.innerHTML = `<img src="${filteredImage}" alt="Filtered Preview" class="animate-glow" />`;
            
            this.currentImage = filteredImage;
            this.updateStats('filters', 1);
            
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
    
    async applyFilter(imageData, filter) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Apply filter based on type
                this.applyCanvasFilter(ctx, filter);
                
                ctx.drawImage(img, 0, 0);
                
                // Get additional filter effects
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                switch (filter) {
                    case 'vintage':
                        this.applyVintageFilter(data);
                        break;
                    case 'bw':
                        this.applyBlackWhiteFilter(data);
                        break;
                    case 'enhance':
                        this.applyEnhanceFilter(data);
                        break;
                    case 'retro':
                        this.applyRetroFilter(data);
                        break;
                    case 'blur':
                        // Blur is handled by CSS filter
                        break;
                }
                
                if (filter !== 'blur' && filter !== 'none') {
                    ctx.putImageData(imageData, 0, 0);
                }
                
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.src = imageData;
        });
    }
    
    applyCanvasFilter(ctx, filter) {
        switch (filter) {
            case 'vintage':
                ctx.filter = 'sepia(0.8) contrast(1.2) brightness(1.1) saturate(0.8)';
                break;
            case 'bw':
                ctx.filter = 'grayscale(1) contrast(1.3)';
                break;
            case 'blur':
                ctx.filter = 'blur(2px) brightness(1.1)';
                break;
            case 'enhance':
                ctx.filter = 'contrast(1.3) saturate(1.4) brightness(1.1)';
                break;
            case 'retro':
                ctx.filter = 'sepia(0.4) hue-rotate(15deg) saturate(1.2)';
                break;
            default:
                ctx.filter = 'none';
        }
    }
    
    applyVintageFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189) + 40);
            data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168) + 20);
            data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131) + 10);
        }
    }
    
    applyBlackWhiteFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
    }
    
    applyEnhanceFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 1.3);
            data[i + 1] = Math.min(255, data[i + 1] * 1.3);
            data[i + 2] = Math.min(255, data[i + 2] * 1.3);
        }
    }
    
    applyRetroFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 1.2 + 20);
            data[i + 1] = Math.min(255, data[i + 1] * 1.1 + 10);
            data[i + 2] = Math.min(255, data[i + 2] * 0.9);
        }
    }
    
    // Save functionality
    saveImage() {
        if (!this.currentImage) {
            this.showToast('No image to save', 'error');
            return;
        }
        
        const link = document.createElement('a');
        link.download = `photobooth-${this.sessionId}-${Date.now()}.jpg`;
        link.href = this.currentImage;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('Image saved!', 'success');
        
        // Add save animation
        document.getElementById('saveImage').classList.add('animate-pulse');
        setTimeout(() => {
            document.getElementById('saveImage').classList.remove('animate-pulse');
        }, 2000);
    }
    
    // Gallery functionality
    addToGallery(imageData) {
        this.gallery.push({
            data: imageData,
            timestamp: Date.now(),
            filter: this.currentFilter
        });
        this.updateGalleryDisplay();
    }
    
    updateGalleryDisplay() {
        const grid = document.getElementById('galleryGrid');
        grid.innerHTML = '';
        
        this.gallery.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'gallery-item interactive';
            div.innerHTML = `<img src="${item.data}" alt="Gallery image ${index + 1}" />`;
            
            div.addEventListener('click', () => {
                this.loadImageFromData(item.data);
                this.showToast('Image loaded from gallery', 'success');
                
                // Add selection animation
                div.classList.add('animate-bounce');
                setTimeout(() => div.classList.remove('animate-bounce'), 600);
            });
            
            // Add staggered animation
            div.style.animationDelay = `${index * 0.1}s`;
            div.classList.add('animate-bounce');
            setTimeout(() => div.classList.remove('animate-bounce'), 600 + (index * 100));
            
            grid.appendChild(div);
        });
        
        if (this.gallery.length === 0) {
            grid.innerHTML = '<div class="gallery-empty">No photos yet. Start capturing!</div>';
        }
    }
    
    refreshGallery() {
        this.updateGalleryDisplay();
        this.showToast('Gallery refreshed', 'info');
        
        // Add refresh animation
        document.getElementById('refreshGallery').classList.add('animate-glow');
        setTimeout(() => {
            document.getElementById('refreshGallery').classList.remove('animate-glow');
        }, 2000);
    }
    
    clearGallery() {
        if (this.gallery.length === 0) {
            this.showToast('Gallery is already empty', 'info');
            return;
        }
        
        this.gallery = [];
        this.updateGalleryDisplay();
        this.showToast('Gallery cleared', 'success');
        
        // Reset gallery stats
        this.stats.photos = 0;
        this.updateStatsDisplay();
    }
    
    // Tab functionality
    switchTab(e) {
        const tabName = e.currentTarget.dataset.tab;
        
        // Remove active from all tabs and content
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Add active to clicked tab and corresponding content
        e.currentTarget.classList.add('active');
        document.getElementById(tabName).classList.add('active');
        
        // Add tab switch animation
        e.currentTarget.classList.add('animate-bounce');
        setTimeout(() => {
            e.currentTarget.classList.remove('animate-bounce');
        }, 600);
    }
    
    // Feature option selection
    selectOption(e) {
        const type = e.currentTarget.parentElement.parentElement.id;
        const value = e.currentTarget.dataset[type.slice(0, -1)];
        
        // Visual feedback
        e.currentTarget.classList.add('animate-pulse');
        setTimeout(() => {
            e.currentTarget.classList.remove('animate-pulse');
        }, 2000);
        
        this.showToast(`${type.slice(0, -1)}: ${value} selected`, 'success');
        
        // Apply feature based on type
        this.applyFeature(type, value);
    }
    
    applyFeature(type, value) {
        if (!this.currentImage) {
            this.showToast('Please select an image first', 'error');
            return;
        }
        
        // This could be extended to apply actual effects
        console.log(`Applying ${type}: ${value}`);
    }
    
    // Photo strip functionality
    createPhotoStrip() {
        if (this.gallery.length < 2) {
            this.showToast('Need at least 2 photos for a strip', 'error');
            return;
        }
        
        this.showLoading('creating photo strip...');
        
        // Take last 4 images or all if less than 4
        const stripImages = this.gallery.slice(-4).map(item => item.data);
        
        setTimeout(() => {
            const stripContainer = document.getElementById('stripContainer');
            stripContainer.innerHTML = this.generateStripHTML(stripImages);
            
            this.stripImages = stripImages;
            this.updateStats('strips', 1);
            this.hideLoading();
            this.showToast('Photo strip created!', 'success');
            
            // Add strip creation animation
            stripContainer.classList.add('animate-glow');
            setTimeout(() => {
                stripContainer.classList.remove('animate-glow');
            }, 3000);
        }, 1500);
    }
    
    generateStripHTML(images) {
        const stripHTML = images.map((img, index) => 
            `<img src="${img}" alt="Strip image ${index + 1}" class="strip-image" 
             style="animation-delay: ${index * 0.2}s" />`
        ).join('');
        
        return `<div class="photo-strip animate-bounce">${stripHTML}</div>`;
    }
    
    downloadStrip() {
        if (this.stripImages.length === 0) {
            this.showToast('No strip to download', 'error');
            return;
        }
        
        this.showLoading('preparing download...');
        
        // Create composite image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set strip dimensions
        const stripWidth = 800;
        const stripHeight = 200;
        const imageWidth = stripWidth / this.stripImages.length;
        
        canvas.width = stripWidth;
        canvas.height = stripHeight;
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, stripWidth, stripHeight);
        
        let loadedImages = 0;
        this.stripImages.forEach((imgData, index) => {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, index * imageWidth, 0, imageWidth, stripHeight);
                loadedImages++;
                
                if (loadedImages === this.stripImages.length) {
                    // Download
                    const link = document.createElement('a');
                    link.download = `photo-strip-${this.sessionId}-${Date.now()}.jpg`;
                    link.href = canvas.toDataURL('image/jpeg', 0.9);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    this.hideLoading();
                    this.showToast('Strip downloaded!', 'success');
                }
            };
            img.src = imgData;
        });
    }
    
    shareStrip() {
        if (this.stripImages.length === 0) {
            this.showToast('No strip to share', 'error');
            return;
        }
        
        // Simple share functionality
        if (navigator.share) {
            navigator.share({
                title: 'My Photo Strip',
                text: 'Check out my photobooth strip!'
            }).then(() => {
                this.showToast('Shared successfully!', 'success');
            }).catch(() => {
                this.showToast('Share cancelled', 'info');
            });
        } else {
            // Fallback - copy link
            navigator.clipboard.writeText(window.location.href).then(() => {
                this.showToast('Link copied to clipboard!', 'success');
            });
        }
    }
    
    printStrip() {
        if (this.stripImages.length === 0) {
            this.showToast('No strip to print', 'error');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        const stripHTML = this.generateStripHTML(this.stripImages);
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Photo Strip</title>
                    <style>
                        body { margin: 0; padding: 20px; text-align: center; }
                        .photo-strip { display: flex; gap: 4px; justify-content: center; }
                        .strip-image { width: 150px; height: 200px; object-fit: cover; }
                        @media print { body { margin: 0; } }
                    </style>
                </head>
                <body>
                    ${stripHTML}
                </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        
        this.showToast('Printing...', 'info');
    }
    
    // Magic FAB functionality
    toggleMagicMenu() {
        const menu = document.querySelector('.menu-enhanced');
        const fab = document.getElementById('magicFab');
        
        menu.classList.toggle('active');
        
        if (menu.classList.contains('active')) {
            fab.classList.add('animate-bounce');
            setTimeout(() => fab.classList.remove('animate-bounce'), 600);
        }
    }
    
    handleMagicAction(e) {
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
        }
        
        // Close menu
        document.querySelector('.menu-enhanced').classList.remove('active');
    }
    
    applyRandomFilter() {
        const filters = ['vintage', 'bw', 'blur', 'enhance', 'retro'];
        const randomFilter = filters[Math.floor(Math.random() * filters.length)];
        
        // Select the filter
        document.querySelector(`[data-filter="${randomFilter}"]`).click();
        
        this.showToast(`Random filter: ${randomFilter}!`, 'success');
    }
    
    autoEnhance() {
        if (!this.currentImage) {
            this.showToast('Please select an image first', 'error');
            return;
        }
        
        // Apply enhance filter
        document.querySelector('[data-filter="enhance"]').click();
        this.showToast('Auto-enhanced!', 'success');
    }
    
    async surpriseMe() {
        const surprises = [
            () => this.createConfetti(),
            () => this.triggerRandomColorScheme(),
            () => this.addSparkleEffect(),
            () => this.bounceAllElements()
        ];
        
        const randomSurprise = surprises[Math.floor(Math.random() * surprises.length)];
        randomSurprise();
        
        this.showToast('Surprise!', 'success');
    }
    
    // Fun effects
    createConfetti() {
        const colors = ['#a8b5a0', '#c4967a', '#d4c4b0', '#e8ddd0'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = '10px';
            confetti.style.height = '10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * window.innerWidth + 'px';
            confetti.style.top = '-10px';
            confetti.style.zIndex = '9999';
            confetti.style.borderRadius = '50%';
            confetti.style.pointerEvents = 'none';
            
            document.body.appendChild(confetti);
            
            const fallDuration = Math.random() * 3 + 2;
            confetti.animate([
                { transform: 'translateY(0px) rotate(0deg)', opacity: 1 },
                { transform: `translateY(${window.innerHeight + 20}px) rotate(360deg)`, opacity: 0 }
            ], {
                duration: fallDuration * 1000,
                easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            });
            
            setTimeout(() => {
                document.body.removeChild(confetti);
            }, fallDuration * 1000);
        }
    }
    
    triggerRandomColorScheme() {
        const schemes = [
            { '--sage-accent': '#ff6b6b', '--terracotta': '#4ecdc4', '--taupe': '#45b7d1' },
            { '--sage-accent': '#96ceb4', '--terracotta': '#feca57', '--taupe': '#ff9ff3' },
            { '--sage-accent': '#fd79a8', '--terracotta': '#6c5ce7', '--taupe': '#a29bfe' }
        ];
        
        const randomScheme = schemes[Math.floor(Math.random() * schemes.length)];
        const root = document.documentElement;
        
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
        for (let i = 0; i < 20; i++) {
            const sparkle = document.createElement('div');
            sparkle.innerHTML = '✨';
            sparkle.style.position = 'fixed';
            sparkle.style.left = Math.random() * window.innerWidth + 'px';
            sparkle.style.top = Math.random() * window.innerHeight + 'px';
            sparkle.style.zIndex = '9999';
            sparkle.style.fontSize = Math.random() * 20 + 15 + 'px';
            sparkle.style.pointerEvents = 'none';
            
            document.body.appendChild(sparkle);
            
            sparkle.animate([
                { transform: 'scale(0) rotate(0deg)', opacity: 0 },
                { transform: 'scale(1) rotate(180deg)', opacity: 1 },
                { transform: 'scale(0) rotate(360deg)', opacity: 0 }
            ], {
                duration: 2000,
                easing: 'ease-in-out'
            });
            
            setTimeout(() => {
                document.body.removeChild(sparkle);
            }, 2000);
        }
    }
    
    bounceAllElements() {
        const elements = document.querySelectorAll('.panel, .btn, .filter-btn, .option-card');
        elements.forEach((el, index) => {
            setTimeout(() => {
                el.classList.add('animate-bounce');
                setTimeout(() => el.classList.remove('animate-bounce'), 600);
            }, index * 100);
        });
    }
    
    // Missing utility methods
    addCaptureFlash() {
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.backgroundColor = 'white';
        flash.style.opacity = '0.8';
        flash.style.zIndex = '9999';
        flash.style.pointerEvents = 'none';
        
        document.body.appendChild(flash);
        
        flash.animate([
            { opacity: 0 },
            { opacity: 0.8 },
            { opacity: 0 }
        ], {
            duration: 200,
            easing: 'ease-out'
        });
        
        setTimeout(() => {
            document.body.removeChild(flash);
        }, 200);
    }
    
    showLoading(message = 'loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = overlay.querySelector('.loading-text');
        text.textContent = message;
        overlay.style.display = 'flex';
    }
    
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'none';
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container toast-modern';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
        return container;
    }
    
    updateStats(type, increment) {
        this.stats[type] += increment;
        this.updateStatsDisplay();
    }
    
    updateStatsDisplay() {
        document.getElementById('photoCount').textContent = this.stats.photos;
        document.getElementById('filtersUsed').textContent = this.stats.filters;
        document.getElementById('stripsCreated').textContent = this.stats.strips;
    }
    
    loadGallery() {
        // Try to load from localStorage if available (for persistence)
        try {
            const saved = localStorage.getItem(`photobooth_${this.sessionId}`);
            if (saved) {
                const data = JSON.parse(saved);
                this.gallery = data.gallery || [];
                this.stats = data.stats || { photos: 0, filters: 0, strips: 0 };
                this.updateGalleryDisplay();
                this.updateStatsDisplay();
            }
        } catch (error) {
            console.log('No saved gallery data');
        }
    }
    
    saveGallery() {
        // Save to localStorage for persistence
        try {
            const data = {
                gallery: this.gallery,
                stats: this.stats,
                timestamp: Date.now()
            };
            localStorage.setItem(`photobooth_${this.sessionId}`, JSON.stringify(data));
        } catch (error) {
            console.warn('Could not save gallery data');
        }
    }
    
    newSession() {
        this.sessionId = this.generateSessionId();
        this.updateSessionId();
        this.gallery = [];
        this.stripImages = [];
        this.currentImage = null;
        this.stats = { photos: 0, filters: 0, strips: 0 };
        
        // Reset UI
        this.updateGalleryDisplay();
        this.updateStatsDisplay();
        document.getElementById('imagePreview').innerHTML = `
            <div class="preview-placeholder floating-placeholder">
                <div class="placeholder-content">
                    <span class="placeholder-icon breathing-circle">○</span>
                    <p class="placeholder-text">your image appears here</p>
                    <div class="placeholder-hint">upload or capture to begin</div>
                </div>
            </div>
        `;
        document.getElementById('stripContainer').innerHTML = `
            <div class="strip-placeholder placeholder-modern">
                <span class="strip-icon animated-strip">—</span>
                <p class="strip-text">create your first strip</p>
                <small class="strip-hint">combine multiple photos</small>
            </div>
        `;
        
        // Disable action buttons
        document.getElementById('processImage').disabled = true;
        document.getElementById('saveImage').disabled = true;
        document.getElementById('createStrip').disabled = true;
        
        this.showToast('New session started!', 'success');
    }
    
    initializeFeatures() {
        // Initialize any additional features
        this.setupKeyboardShortcuts();
    }
    
    setupKeyboardShortcuts() {
        // Already handled in bindEvents, but could add more here
    }
    
    handleKeyboardShortcuts(e) {
        // Space = capture photo (if camera is active)
        if (e.code === 'Space' && document.getElementById('capturePhoto').style.display !== 'none') {
            e.preventDefault();
            this.capturePhoto();
        }
        
        // Enter = process image
        if (e.code === 'Enter' && this.currentImage) {
            e.preventDefault();
            this.processImage();
        }
        
        // S = save image
        if (e.code === 'KeyS' && e.ctrlKey && this.currentImage) {
            e.preventDefault();
            this.saveImage();
        }
        
        // N = new session
        if (e.code === 'KeyN' && e.ctrlKey) {
            e.preventDefault();
            this.newSession();
        }
        
        // Numbers 1-6 = select filters
        const filterKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
        if (filterKeys.includes(e.code)) {
            e.preventDefault();
            const filterIndex = parseInt(e.code.slice(-1)) - 1;
            const filterBtns = document.querySelectorAll('.filter-btn');
            if (filterBtns[filterIndex]) {
                filterBtns[filterIndex].click();
            }
        }
    }
    
    handleResize() {
        // Handle window resize events
        if (this.stream) {
            // Adjust video preview if needed
            const video = document.getElementById('video');
            // Video will maintain aspect ratio automatically
        }
    }
    
    setupMagicEffects() {
        // Setup any initial magic effects or animations
        this.startFloatingAnimation();
    }
    
    startAmbientAnimations() {
        // Start ambient background animations
        const orbs = document.querySelectorAll('.bg-orb');
        orbs.forEach((orb, index) => {
            orb.style.animationDelay = `${index * 2}s`;
        });
        
        const floaters = document.querySelectorAll('.float-element');
        floaters.forEach((el, index) => {
            el.style.animationDelay = `${index * 1.5}s`;
        });
    }
    
    startFloatingAnimation() {
        // Additional floating animations for enhanced experience
        const elements = document.querySelectorAll('.floating-placeholder, .breathing-circle');
        elements.forEach(el => {
            el.style.animation = 'float 3s ease-in-out infinite';
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.photoboothApp = new PhotoboothApp();
});

// Auto-save gallery periodically
setInterval(() => {
    if (window.photoboothApp) {
        window.photoboothApp.saveGallery();
    }
}, 30000); // Save every 30 seconds