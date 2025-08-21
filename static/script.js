// Photobooth App JavaScript
class PhotoboothApp {
    constructor() {
        this.apiUrl = 'http://localhost:8000';
        this.sessionId = this.generateSessionId();
        this.currentImage = null;
        this.selectedFilters = [];
        this.photoCount = 0;
        this.filtersUsed = 0;
        this.stripsCreated = 0;
        this.stream = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateSessionDisplay();
        this.loadGallery();
        this.initializeToast();
        this.initializeConfetti();
        this.startFloatingAnimations();
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    setupEventListeners() {
        // Header controls
        document.getElementById('newSession').addEventListener('click', () => this.startNewSession());
        
        // Camera controls
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('capturePhoto').addEventListener('click', () => this.capturePhoto());
        document.getElementById('stopCamera').addEventListener('click', () => this.stopCamera());
        
        // File upload
        const fileInput = document.getElementById('fileInput');
        const uploadZone = document.getElementById('uploadZone');
        
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));
        
        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            this.handleFileUpload(e.dataTransfer.files);
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectFilter(e.target.closest('.filter-btn')));
        });
        
        // Action buttons
        document.getElementById('processImage').addEventListener('click', () => this.processCurrentImage());
        document.getElementById('saveImage').addEventListener('click', () => this.saveCurrentImage());
        document.getElementById('createStrip').addEventListener('click', () => this.createPhotoStrip());
        
        // Gallery controls
        document.getElementById('refreshGallery').addEventListener('click', () => this.loadGallery());
        document.getElementById('clearGallery').addEventListener('click', () => this.clearGallery());
        
        // Tab controls
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Template/Frame/Sticker controls
        document.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', (e) => this.applyTemplate(e.target.closest('.template-item').dataset.template));
        });
        
        document.querySelectorAll('.frame-item').forEach(item => {
            item.addEventListener('click', (e) => this.applyFrame(e.target.closest('.frame-item').dataset.frame));
        });
        
        document.querySelectorAll('.sticker-item').forEach(item => {
            item.addEventListener('click', (e) => this.addSticker(e.target.dataset.sticker));
        });
        
        // Strip controls
        document.getElementById('downloadStrip').addEventListener('click', () => this.downloadStrip());
        document.getElementById('shareStrip').addEventListener('click', () => this.shareStrip());
        document.getElementById('printStrip').addEventListener('click', () => this.printStrip());
        
        // FAB controls
        document.getElementById('magicFab').addEventListener('click', () => this.toggleFabMenu());
        
        document.querySelectorAll('.fab-option').forEach(option => {
            option.addEventListener('click', (e) => this.handleFabAction(e.target.dataset.action));
        });
    }
    
    // Session Management
    startNewSession() {
        this.sessionId = this.generateSessionId();
        this.updateSessionDisplay();
        this.photoCount = 0;
        this.filtersUsed = 0;
        this.stripsCreated = 0;
        this.updateStats();
        this.clearGallery();
        this.showToast('🎉 New session started!', 'success');
        this.triggerConfetti();
    }
    
    updateSessionDisplay() {
        document.getElementById('sessionId').textContent = `Session: ${this.sessionId.split('_')[1]}`;
    }
    
    // Camera Functions
    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' },
                audio: false
            });
            
            const video = document.getElementById('video');
            video.srcObject = this.stream;
            
            document.getElementById('startCamera').style.display = 'none';
            document.getElementById('capturePhoto').style.display = 'inline-flex';
            document.getElementById('stopCamera').style.display = 'inline-flex';
            
            this.showToast('📹 Camera ready!', 'success');
        } catch (error) {
            this.showToast('❌ Camera access denied', 'error');
            console.error('Error accessing camera:', error);
        }
    }
    
    capturePhoto() {
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            this.handleFileUpload([file]);
            this.addCaptureEffect();
        }, 'image/jpeg', 0.9);
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        document.getElementById('startCamera').style.display = 'inline-flex';
        document.getElementById('capturePhoto').style.display = 'none';
        document.getElementById('stopCamera').style.display = 'none';
        
        const video = document.getElementById('video');
        video.srcObject = null;
    }
    
    addCaptureEffect() {
        const overlay = document.querySelector('.camera-overlay');
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: white;
            opacity: 0;
            pointer-events: none;
            z-index: 10;
        `;
        
        overlay.appendChild(flash);
        
        // Flash animation
        flash.animate([
            { opacity: 0 },
            { opacity: 0.8 },
            { opacity: 0 }
        ], {
            duration: 200,
            easing: 'ease-out'
        }).addEventListener('finish', () => {
            overlay.removeChild(flash);
        });
        
        // Camera sound effect (if desired)
        this.playCameraSound();
    }
    
    playCameraSound() {
        // Create audio context for camera shutter sound
        if (this.audioContext) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);
        }
    }
    
    // File Upload Functions
    async handleFileUpload(files) {
        this.showLoading('Processing images...');
        
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                await this.uploadSingleImage(file);
                this.photoCount++;
            }
        }
        
        this.updateStats();
        this.hideLoading();
        this.showToast(`📸 ${files.length} image(s) uploaded!`, 'success');
    }
    
    async uploadSingleImage(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('session_id', this.sessionId);
            
            const response = await fetch(`${this.apiUrl}/upload-image/`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Upload failed');
            }
            
            const result = await response.json();
            this.displayImage(result.processed_image);
            this.currentImage = result;
            this.loadGallery();
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('❌ Upload failed', 'error');
        }
    }
    
    // Image Display Functions
    displayImage(imageSrc) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = `<img src="${imageSrc}" alt="Preview" class="animate-bounce">`;
    }
    
    // Filter Functions
    selectFilter(filterBtn) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        filterBtn.classList.add('active');
        
        const filter = filterBtn.dataset.filter;
        this.selectedFilters = filter === 'none' ? [] : [filter];
        
        filterBtn.classList.add('animate-bounce');
        setTimeout(() => filterBtn.classList.remove('animate-bounce'), 500);
    }
    
    async processCurrentImage() {
        if (!this.currentImage || this.selectedFilters.length === 0) {
            this.showToast('🎨 Please select an image and filter', 'info');
            return;
        }
        
        this.showLoading('Applying magic...');
        
        try {
            const formData = new FormData();
            
            // Re-upload with filters
            const response = await fetch(this.currentImage.processed_image);
            const blob = await response.blob();
            const file = new File([blob], 'filtered_image.png', { type: 'image/png' });
            
            formData.append('file', file);
            formData.append('filters', this.selectedFilters.join(','));
            formData.append('session_id', this.sessionId);
            
            const uploadResponse = await fetch(`${this.apiUrl}/upload-image/`, {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Filter application failed');
            }
            
            const result = await uploadResponse.json();
            this.displayImage(result.processed_image);
            this.currentImage = result;
            this.filtersUsed++;
            this.updateStats();
            this.loadGallery();
            
            this.hideLoading();
            this.showToast('✨ Filter applied!', 'success');
            
        } catch (error) {
            console.error('Filter error:', error);
            this.hideLoading();
            this.showToast('❌ Filter application failed', 'error');
        }
    }
    
    // Gallery Functions
    async loadGallery() {
        try {
            const response = await fetch(`${this.apiUrl}/list-sessions/`);
            const data = await response.json();
            
            const currentSession = data.sessions.find(s => s.session_id === this.sessionId);
            if (currentSession) {
                // Load session images - this would need additional API endpoint
                // For now, we'll show placeholder
                this.displayGalleryPlaceholder();
            }
        } catch (error) {
            console.error('Gallery load error:', error);
        }
    }
    
    displayGalleryPlaceholder() {
        const gallery = document.getElementById('galleryGrid');
        gallery.innerHTML = '';
        
        // Add some sample gallery items
        for (let i = 0; i < this.photoCount; i++) {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `
                <div style="background: linear-gradient(45deg, #667eea, #764ba2); 
                           width: 100%; height: 100%; display: flex; 
                           align-items: center; justify-content: center; 
                           color: white; font-size: 2rem;">
                    📸
                </div>
            `;
            gallery.appendChild(item);
        }
    }
    
    clearGallery() {
        document.getElementById('galleryGrid').innerHTML = '';
    }
    
    // Photo Strip Functions
    async createPhotoStrip() {
        if (this.photoCount === 0) {
            this.showToast('📸 Take some photos first!', 'info');
            return;
        }
        
        this.showLoading('Creating photo strip...');
        
        try {
            const response = await fetch(`${this.apiUrl}/create-photostrip/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `session_id=${this.sessionId}`
            });
            
            if (!response.ok) {
                throw new Error('Strip creation failed');
            }
            
            const result = await response.json();
            this.displayPhotoStrip(result.photostrip);
            this.stripsCreated++;
            this.updateStats();
            
            this.hideLoading();
            this.showToast('🎞️ Photo strip created!', 'success');
            this.triggerConfetti();
            
        } catch (error) {
            console.error('Strip creation error:', error);
            this.hideLoading();
            this.showToast('❌ Strip creation failed', 'error');
        }
    }
    
    displayPhotoStrip(stripSrc) {
        const container = document.getElementById('stripContainer');
        container.innerHTML = `<img src="${stripSrc}" alt="Photo Strip" class="strip-image animate-bounce">`;
    }
    
    // Tab Functions
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }
    
    // Fun Features
    applyTemplate(template) {
        this.showToast(`🎨 ${template.charAt(0).toUpperCase() + template.slice(1)} template applied!`, 'info');
        // Template logic would go here
    }
    
    applyFrame(frame) {
        this.showToast(`🖼️ ${frame.charAt(0).toUpperCase() + frame.slice(1)} frame applied!`, 'info');
        // Frame logic would go here
    }
    
    addSticker(sticker) {
        const stickerEmojis = {
            heart: '💖',
            star: '⭐',
            rainbow: '🌈',
            party: '🎉',
            fire: '🔥',
            cool: '😎',
            cute: '🥰',
            sparkle: '✨'
        };
        
        this.showToast(`${stickerEmojis[sticker]} Sticker added!`, 'info');
        // Sticker logic would go here
    }
    
    // FAB Functions
    toggleFabMenu() {
        const menu = document.querySelector('.fab-menu');
        menu.classList.toggle('active');
    }
    
    handleFabAction(action) {
        this.toggleFabMenu();
        
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
    }
    
    applyRandomFilter() {
        const filters = ['vintage', 'bw', 'blur', 'enhance', 'retro'];
        const randomFilter = filters[Math.floor(Math.random() * filters.length)];
        
        const filterBtn = document.querySelector(`[data-filter="${randomFilter}"]`);
        if (filterBtn) {
            this.selectFilter(filterBtn);
            this.processCurrentImage();
        }
        
        this.showToast('🎲 Random filter applied!', 'success');
    }
    
    autoEnhance() {
        if (this.currentImage) {
            const enhanceBtn = document.querySelector('[data-filter="enhance"]');
            if (enhanceBtn) {
                this.selectFilter(enhanceBtn);
                this.processCurrentImage();
            }
        }
        this.showToast('🔮 Auto enhancement applied!', 'success');
    }
    
    surpriseMe() {
        // Surprise combination of effects
        const surprises = [
            () => this.triggerConfetti(),
            () => this.startRainbowMode(),
            () => this.applyRandomFilter(),
            () => this.showToast('🎉 Surprise! You look amazing!', 'success')
        ];
        
        const randomSurprise = surprises[Math.floor(Math.random() * surprises.length)];
        randomSurprise();
        
        // Add some visual flair
        document.body.style.animation = 'rainbow 2s ease-in-out';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 2000);
    }
    
    // Strip Actions
    downloadStrip() {
        const stripImg = document.querySelector('.strip-image');
        if (!stripImg) {
            this.showToast('📸 Create a photo strip first!', 'info');
            return;
        }
        
        const link = document.createElement('a');
        link.href = stripImg.src;
        link.download = `photostrip_${this.sessionId}_${Date.now()}.png`;
        link.click();
        
        this.showToast('📥 Photo strip downloaded!', 'success');
    }
    
    shareStrip() {
        const stripImg = document.querySelector('.strip-image');
        if (!stripImg) {
            this.showToast('📸 Create a photo strip first!', 'info');
            return;
        }
        
        if (navigator.share) {
            navigator.share({
                title: 'My Whimsical Photo Strip',
                text: 'Check out my awesome photo strip!',
                files: [new File([stripImg.src], 'photostrip.png', { type: 'image/png' })]
            }).then(() => {
                this.showToast('🔗 Photo strip shared!', 'success');
            }).catch(() => {
                this.fallbackShare(stripImg.src);
            });
        } else {
            this.fallbackShare(stripImg.src);
        }
    }
    
    fallbackShare(imageSrc) {
        // Fallback sharing - copy link to clipboard
        navigator.clipboard.writeText(imageSrc).then(() => {
            this.showToast('🔗 Image link copied to clipboard!', 'info');
        }).catch(() => {
            this.showToast('❌ Sharing not supported', 'error');
        });
    }
    
    printStrip() {
        const stripImg = document.querySelector('.strip-image');
        if (!stripImg) {
            this.showToast('📸 Create a photo strip first!', 'info');
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
                            padding: 20px; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh;
                            background: #f0f0f0;
                        }
                        img { 
                            max-width: 100%; 
                            height: auto; 
                            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        }
                        @media print {
                            body { background: white; }
                        }
                    </style>
                </head>
                <body>
                    <img src="${stripImg.src}" alt="Photo Strip">
                </body>
            </html>
        `);
        
        printWindow.document.close();
        
        printWindow.onload = () => {
            printWindow.print();
            printWindow.close();
        };
        
        this.showToast('🖨️ Printing photo strip...', 'info');
    }
    
    // Stats Management
    updateStats() {
        document.getElementById('photoCount').textContent = this.photoCount;
        document.getElementById('filtersUsed').textContent = this.filtersUsed;
        document.getElementById('stripsCreated').textContent = this.stripsCreated;
    }
    
    // Save Functions
    async saveCurrentImage() {
        if (!this.currentImage) {
            this.showToast('📸 No image to save!', 'info');
            return;
        }
        
        const link = document.createElement('a');
        link.href = this.currentImage.processed_image;
        link.download = `photo_${Date.now()}.png`;
        link.click();
        
        this.showToast('💾 Image saved!', 'success');
    }
    
    // Toast Notification System
    initializeToast() {
        this.toastContainer = document.getElementById('toastContainer');
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };
        
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close">&times;</button>
            </div>
        `;
        
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.removeToast(toast));
        
        this.toastContainer.appendChild(toast);
        
        // Auto-remove after 4 seconds
        setTimeout(() => this.removeToast(toast), 4000);
    }
    
    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }
    
    // Loading System
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const messageElement = overlay.querySelector('p');
        messageElement.textContent = message;
        overlay.classList.add('active');
    }
    
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.remove('active');
    }
    
    // Confetti System
    initializeConfetti() {
        this.confettiCanvas = document.getElementById('confetti');
        this.confettiCtx = this.confettiCanvas.getContext('2d');
        this.confettiParticles = [];
        
        this.resizeConfettiCanvas();
        window.addEventListener('resize', () => this.resizeConfettiCanvas());
    }
    
    resizeConfettiCanvas() {
        this.confettiCanvas.width = window.innerWidth;
        this.confettiCanvas.height = window.innerHeight;
    }
    
    triggerConfetti() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f093fb', '#feca57', '#48dbfb'];
        
        for (let i = 0; i < 50; i++) {
            this.confettiParticles.push({
                x: Math.random() * this.confettiCanvas.width,
                y: -10,
                dx: (Math.random() - 0.5) * 4,
                dy: Math.random() * 3 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                size: Math.random() * 8 + 4,
                life: 1.0
            });
        }
        
        this.animateConfetti();
    }
    
    animateConfetti() {
        this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
        
        for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
            const particle = this.confettiParticles[i];
            
            particle.x += particle.dx;
            particle.y += particle.dy;
            particle.rotation += particle.rotationSpeed;
            particle.life -= 0.01;
            
            if (particle.life <= 0 || particle.y > this.confettiCanvas.height) {
                this.confettiParticles.splice(i, 1);
                continue;
            }
            
            this.confettiCtx.save();
            this.confettiCtx.globalAlpha = particle.life;
            this.confettiCtx.translate(particle.x, particle.y);
            this.confettiCtx.rotate(particle.rotation * Math.PI / 180);
            this.confettiCtx.fillStyle = particle.color;
            this.confettiCtx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            this.confettiCtx.restore();
        }
        
        if (this.confettiParticles.length > 0) {
            requestAnimationFrame(() => this.animateConfetti());
        }
    }
    
    // Special Effects
    startRainbowMode() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes rainbow {
                0% { filter: hue-rotate(0deg); }
                100% { filter: hue-rotate(360deg); }
            }
            
            .rainbow-mode {
                animation: rainbow 2s linear infinite;
            }
        `;
        document.head.appendChild(style);
        
        document.body.classList.add('rainbow-mode');
        
        setTimeout(() => {
            document.body.classList.remove('rainbow-mode');
            document.head.removeChild(style);
        }, 6000);
        
        this.showToast('🌈 Rainbow mode activated!', 'success');
    }
    
    startFloatingAnimations() {
        // Add some random floating elements
        this.createFloatingEmojis();
    }
    
    createFloatingEmojis() {
        const emojis = ['✨', '🎉', '💖', '🌈', '⭐', '🎊'];
        
        setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every interval
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                this.createFloatingEmoji(emoji);
            }
        }, 2000);
    }
    
    createFloatingEmoji(emoji) {
        const element = document.createElement('div');
        element.textContent = emoji;
        element.style.cssText = `
            position: fixed;
            font-size: 2rem;
            pointer-events: none;
            z-index: 1;
            left: ${Math.random() * window.innerWidth}px;
            top: ${window.innerHeight}px;
            opacity: 0.7;
        `;
        
        document.body.appendChild(element);
        
        const animation = element.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 0.7 },
            { transform: `translateY(-${window.innerHeight + 100}px) rotate(360deg)`, opacity: 0 }
        ], {
            duration: 8000 + Math.random() * 4000,
            easing: 'ease-out'
        });
        
        animation.addEventListener('finish', () => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
    }
    
    // Utility Functions
    addStylesheet() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css';
        document.head.appendChild(link);
    }
    
    // Audio Context for Sound Effects
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Audio context not supported');
        }
    }
    
    // Close FAB menu when clicking outside
    handleOutsideClick(event) {
        const fabContainer = document.querySelector('.fab-container');
        const fabMenu = document.querySelector('.fab-menu');
        
        if (fabMenu.classList.contains('active') && 
            !fabContainer.contains(event.target)) {
            fabMenu.classList.remove('active');
        }
    }
    
    // Add keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveCurrentImage();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.startNewSession();
                        break;
                    case 'p':
                        e.preventDefault();
                        this.createPhotoStrip();
                        break;
                }
            }
            
            // Space bar for capture
            if (e.code === 'Space' && this.stream) {
                e.preventDefault();
                this.capturePhoto();
            }
        });
    }
    
    // Add error handling for failed API calls
    async makeApiCall(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            if (!response.ok) {
                throw new Error(`API call failed: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call error:', error);
            this.showToast('❌ Connection error. Please check if the server is running.', 'error');
            throw error;
        }
    }
}

// CSS animations for slideOut
const additionalStyles = `
@keyframes slideOut {
    to {
        transform: translateX(350px);
        opacity: 0;
    }
}
`;

// Add additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new PhotoboothApp();
    
    // Add global click handler for closing menus
    document.addEventListener('click', (e) => app.handleOutsideClick(e));
    
    // Setup keyboard shortcuts
    app.setupKeyboardShortcuts();
    
    // Initialize audio context on first user interaction
    document.addEventListener('click', () => {
        if (!app.audioContext) {
            app.initAudioContext();
        }
    }, { once: true });
    
    // Make app globally available for debugging
    window.photoboothApp = app;
});

// Service Worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
            console.log('SW registered: ', registration);
        }).catch((registrationError) => {
            console.log('SW registration failed: ', registrationError);
        });
    });
}