/**
 * PhotoboothApp — rewritten for correct image pipeline
 *
 * KEY DESIGN:
 *  - this.gallery  = array of { id, data, timestamp, filter, label }
 *    where `data` is ALWAYS the latest processed base64 (what you see in preview)
 *  - When a filter / template / frame / effect is applied we call
 *    this._updateGalleryItem(id, newData) so the gallery stays in sync
 *  - createPhotoStrip() always reads from this.gallery so strips get processed images
 */

class PhotoboothApp {
    constructor() {
        this.currentImage   = null;   // base64 of what is shown in preview
        this.currentGalleryId = null; // id of the gallery item currently in preview
        this.currentFilter  = 'none';
        this.gallery        = [];     // [{ id, data, timestamp, filter, label }]
        this.stripImages    = [];     // base64 array used for last generated strip
        this.sessionId      = this._generateId(6, true);
        this.stats          = { photos: 0, filters: 0, strips: 0 };
        this.stream         = null;
        this.canvas         = null;
        this.ctx            = null;
        this.isProcessing   = false;
        this.magicMenuOpen  = false;

        this._init();
    }

    /* ─── Bootstrap ──────────────────────────────────────────────── */

    _init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._boot(), { once: true });
        } else {
            this._boot();
        }
    }

    _boot() {
        this.canvas = document.getElementById('canvas');
        if (this.canvas) this.ctx = this.canvas.getContext('2d');

        this._bindAll();
        this._updateSessionDisplay();
        this._updateStatsDisplay();
        this._setupKeyboard();
    }

    /* ─── Helpers ────────────────────────────────────────────────── */

    _generateId(len = 8, upper = false) {
        const chars = upper
            ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            : 'abcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    _el(id) { return document.getElementById(id); }

    _on(id, ev, fn) {
        const el = this._el(id);
        if (el) el.addEventListener(ev, fn);
        else console.warn(`#${id} not found`);
    }

    /* ─── Event wiring ───────────────────────────────────────────── */

    _bindAll() {
        // Camera
        this._on('startCamera',  'click', () => this.startCamera());
        this._on('capturePhoto', 'click', () => this.capturePhoto());
        this._on('stopCamera',   'click', () => this.stopCamera());

        // Upload
        this._setupUpload();

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn =>
            btn.addEventListener('click', e => this._selectFilter(e)));

        // Actions
        this._on('processImage', 'click', () => this.processImage());
        this._on('saveImage',    'click', () => this.saveImage());
        this._on('createStrip',  'click', () => this.createPhotoStrip());

        // Gallery
        this._on('refreshGallery', 'click', () => this._renderGallery());
        this._on('clearGallery',   'click', () => this._clearGallery());

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn =>
            btn.addEventListener('click', e => this._switchTab(e)));

        // Template / frame / effect cards
        document.querySelectorAll('.option-card').forEach(card =>
            card.addEventListener('click', e => this._handleOptionCard(e)));

        // Strip
        this._on('downloadStrip', 'click', () => this._downloadStrip());
        this._on('shareStrip',    'click', () => this._shareStrip());
        this._on('printStrip',    'click', () => this._printStrip());

        // Magic FAB
        this._on('magicFab', 'click', () => this._toggleMagicMenu());
        document.querySelectorAll('.fab-option').forEach(opt =>
            opt.addEventListener('click', e => this._handleMagicAction(e)));

        // Session
        this._on('newSession', 'click', () => this._newSession());

        // Close magic menu on outside click
        document.addEventListener('click', e => {
            if (!e.target.closest('.fab-container') && this.magicMenuOpen) this._closeMagicMenu();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768 && this.magicMenuOpen) this._closeMagicMenu();
        });
    }

    _setupUpload() {
        const zone  = this._el('uploadZone');
        const input = this._el('fileInput');
        if (!zone || !input) return;

        zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('dragover'); });
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            this._processFiles(Array.from(e.dataTransfer.files));
        });
        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', e => {
            this._processFiles(Array.from(e.target.files));
            e.target.value = '';
        });
    }

    _setupKeyboard() {
        document.addEventListener('keydown', e => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 's') { e.preventDefault(); this.saveImage(); }
                if (e.key.toLowerCase() === 'n') { e.preventDefault(); this._newSession(); }
            }
            if (e.key === ' ') { e.preventDefault(); this.capturePhoto(); }
            if (e.key === 'Escape') this._closeMagicMenu();
        });
    }

    /* ─── Camera ─────────────────────────────────────────────────── */

    async startCamera() {
        try {
            this._showLoading('Starting camera…');
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' }
            });
            const video = this._el('video');
            video.srcObject = this.stream;
            await new Promise((res, rej) => { video.onloadedmetadata = () => video.play().then(res).catch(rej); video.onerror = rej; });
            this._setCameraUI(true);
            this._hideLoading();
            this._toast('Camera ready!', 'success');
        } catch (err) {
            this._hideLoading();
            const msgs = { NotFoundError: 'No camera found', NotAllowedError: 'Camera access denied', NotReadableError: 'Camera in use by another app' };
            this._toast(msgs[err.name] || 'Camera error', 'error');
        }
    }

    capturePhoto() {
        const video = this._el('video');
        if (!video || !this.canvas || video.videoWidth === 0) { this._toast('Camera not ready', 'error'); return; }

        const offscreen = document.createElement('canvas');
        offscreen.width  = video.videoWidth;
        offscreen.height = video.videoHeight;
        const offCtx = offscreen.getContext('2d');
        this._flashEffect();
        offCtx.drawImage(video, 0, 0);
        const imageData = offscreen.toDataURL('image/jpeg', 0.92);

        this._addToGallery(imageData, 'original');
        this._loadPreview(imageData, this.gallery[0].id);
        this._updateStats('photos');
        this._toast('Photo captured!', 'success');
    }

    stopCamera() {
        if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
        const video = this._el('video');
        if (video) video.srcObject = null;
        this._setCameraUI(false);
        this._toast('Camera stopped', 'info');
    }

    _setCameraUI(on) {
        const show = (id, v) => { const el = this._el(id); if (el) el.style.display = v ? 'block' : 'none'; };
        show('startCamera',  !on);
        show('capturePhoto',  on);
        show('stopCamera',    on);
    }

    /* ─── File upload ────────────────────────────────────────────── */

    async _processFiles(files) {
        const imgs = files.filter(f => f.type.startsWith('image/'));
        if (!imgs.length) { this._toast('Images only please', 'error'); return; }
        this._showLoading(`Loading ${imgs.length} image(s)…`);
        let ok = 0;
        for (const f of imgs) {
            try {
                const data = await this._fileToDataURL(f);
                this._addToGallery(data, 'uploaded');
                if (!this.currentImage) this._loadPreview(data, this.gallery[0].id);
                this._updateStats('photos');
                ok++;
            } catch { /* skip */ }
        }
        this._hideLoading();
        this._toast(`${ok} image(s) loaded`, 'success');
    }

    _fileToDataURL(file) {
        return new Promise((res, rej) => {
            if (file.size > 15 * 1024 * 1024) { rej(new Error('File >15 MB')); return; }
            const r = new FileReader();
            r.onload = e => res(e.target.result);
            r.onerror = () => rej(new Error('Read failed'));
            r.readAsDataURL(file);
        });
    }

    /* ─── Gallery management ─────────────────────────────────────── */

    _addToGallery(data, label = 'photo') {
        const item = { id: `img-${Date.now()}-${this._generateId(6)}`, data, timestamp: Date.now(), filter: this.currentFilter, label };
        this.gallery.unshift(item);
        if (this.gallery.length > 50) this.gallery.length = 50;
        this._renderGallery();
        return item.id;
    }

    /**
     * Update an existing gallery item's image data (after filter/effect applied).
     * This keeps the gallery in sync with what the user sees in the preview.
     */
    _updateGalleryItem(id, newData, label) {
        const item = this.gallery.find(g => g.id === id);
        if (!item) return;
        item.data = newData;
        if (label) item.label = label;
        this._renderGallery();
    }

    _renderGallery() {
        const grid = this._el('galleryGrid');
        if (!grid) return;
        if (!this.gallery.length) {
            grid.innerHTML = '<div class="gallery-empty">No photos yet</div>';
            return;
        }
        grid.innerHTML = '';
        this.gallery.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'gallery-item interactive' + (item.id === this.currentGalleryId ? ' gallery-item--active' : '');
            div.style.animationDelay = `${i * 0.04}s`;
            div.innerHTML = `<img src="${item.data}" alt="Gallery ${i + 1}" loading="lazy" />
                             <div class="gallery-item__label">${item.label || ''}</div>`;
            div.addEventListener('click', () => {
                this._loadPreview(item.data, item.id);
                this._toast('Loaded from gallery', 'success');
            });
            grid.appendChild(div);
        });
    }

    _clearGallery() {
        if (!this.gallery.length) { this._toast('Gallery is empty', 'info'); return; }
        if (!confirm('Clear the gallery? This cannot be undone.')) return;
        this.gallery = [];
        this.stats.photos = 0;
        this._renderGallery();
        this._updateStatsDisplay();
        this._toast('Gallery cleared', 'success');
    }

    /* ─── Preview ────────────────────────────────────────────────── */

    _loadPreview(data, galleryId = null) {
        const preview = this._el('imagePreview');
        if (!preview) return;
        const img = document.createElement('img');
        img.src = data;
        img.alt = 'Preview';
        img.style.animation = 'fadeInContent 0.35s ease-out';
        preview.innerHTML = '';
        preview.appendChild(img);
        this.currentImage     = data;
        this.currentGalleryId = galleryId;
        this._enableActions(true);
        this._renderGallery(); // refresh active highlight
    }

    _enableActions(on) {
        ['processImage', 'saveImage', 'createStrip'].forEach(id => {
            const el = this._el(id);
            if (el) el.disabled = !on;
        });
    }

    /* ─── Filter selection ───────────────────────────────────────── */

    _selectFilter(e) {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentFilter = e.currentTarget.dataset.filter || 'none';
        // Auto-apply if image loaded
        if (this.currentImage && !this.isProcessing) setTimeout(() => this.processImage(), 150);
    }

    /* ─── Process image (filter via backend) ─────────────────────── */

    async processImage() {
        if (!this.currentImage || this.isProcessing) return;
        this.isProcessing = true;
        this._showLoading(`Applying ${this.currentFilter}…`);

        try {
            const blob = await this._b64toBlob(this.currentImage);
            const fd   = new FormData();
            fd.append('file', blob, 'image.jpg');
            fd.append('filters', this.currentFilter);
            fd.append('session_id', this.sessionId);

            const res  = await fetch('/upload-image/', { method: 'POST', body: fd });
            if (!res.ok) throw new Error('Server error');
            const json = await res.json();

            const processed = json.processed_image;

            // Update preview
            this._loadPreview(processed, this.currentGalleryId);

            // KEY FIX: update gallery item so strip gets the processed version
            if (this.currentGalleryId) {
                this._updateGalleryItem(this.currentGalleryId, processed, this.currentFilter);
            } else {
                // Image came from somewhere without a gallery slot — add one
                const id = this._addToGallery(processed, this.currentFilter);
                this.currentGalleryId = id;
            }

            this._updateStats('filters');
            this._toast(`${this.currentFilter} applied!`, 'success');
        } catch {
            this._toast('Filter failed — try again', 'error');
        } finally {
            this._hideLoading();
            this.isProcessing = false;
        }
    }

    /* ─── Templates / Frames / Effects ───────────────────────────── */

    _handleOptionCard(e) {
        const card = e.currentTarget;
        if (!this.currentImage) { this._toast('Load an image first', 'error'); return; }

        // Determine type from closest tab-content id
        const tabContent = card.closest('.tab-enhanced');
        const type       = tabContent ? tabContent.id : null;
        const value      = card.dataset.template || card.dataset.frame || card.dataset.effect;

        if (!type || !value) return;

        // Active state
        tabContent.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        this._applyOption(type, value);
    }

    async _applyOption(type, value) {
        this._showLoading(`Applying ${value}…`);
        try {
            let result;
            if (type === 'templates') result = await this._applyTemplate(value);
            else if (type === 'frames') result = await this._applyFrame(value);
            else if (type === 'effects') result = await this._applyEffect(value);
            else throw new Error('Unknown type');

            // Update preview AND gallery
            this._loadPreview(result, this.currentGalleryId);
            if (this.currentGalleryId) {
                this._updateGalleryItem(this.currentGalleryId, result, `${type.slice(0,-1)}:${value}`);
            } else {
                const id = this._addToGallery(result, `${type.slice(0,-1)}:${value}`);
                this.currentGalleryId = id;
            }

            this._toast(`${value} applied!`, 'success');
        } catch (err) {
            console.error(err);
            this._toast('Could not apply — try again', 'error');
        } finally {
            this._hideLoading();
        }
    }

    /* canvas helper */
    _renderToCanvas(imageData, paintFn) {
        return new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => {
                const c   = document.createElement('canvas');
                const ctx = c.getContext('2d');
                c.width   = img.width;
                c.height  = img.height;
                paintFn(ctx, c, img);
                res(c.toDataURL('image/png'));
            };
            img.onerror = () => rej(new Error('Image load failed'));
            img.src = imageData;
        });
    }

    _applyTemplate(name) {
        return this._renderToCanvas(this.currentImage, (ctx, c, img) => {
            const W = c.width, H = c.height;
            switch (name) {
                case 'mirror':
                    ctx.drawImage(img, 0, 0, W / 2, H);
                    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(img, -W, 0, W, H); ctx.restore();
                    break;
                case 'split':
                    ctx.drawImage(img, 0, 0, W / 2, H);
                    ctx.drawImage(img, W / 2, 0, W / 2, H);
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillRect(W / 2 - 2, 0, 4, H);
                    break;
                case 'grid':
                    for (let r = 0; r < 2; r++)
                        for (let col = 0; col < 2; col++)
                            ctx.drawImage(img, col * W / 2, r * H / 2, W / 2, H / 2);
                    break;
                default: // collage
                    ctx.fillStyle = '#f7f3ee'; ctx.fillRect(0, 0, W, H);
                    const s = W / 2;
                    ctx.drawImage(img, 0, 0, s, s); ctx.drawImage(img, s, 0, s, s);
                    ctx.drawImage(img, 0, s, s, s); ctx.drawImage(img, s, s, s, s);
            }
        });
    }

    _applyFrame(name) {
        return this._renderToCanvas(this.currentImage, (ctx, c, img) => {
            ctx.drawImage(img, 0, 0, c.width, c.height);
            const W = c.width, H = c.height;
            ctx.lineWidth = 24;
            switch (name) {
                case 'minimal':
                    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
                    ctx.strokeRect(12, 12, W - 24, H - 24);
                    break;
                case 'modern':
                    ctx.strokeStyle = '#7c8c74';
                    ctx.strokeRect(18, 18, W - 36, H - 36);
                    ctx.fillStyle = 'rgba(124,140,116,0.15)';
                    ctx.fillRect(0, 0, W, 24); ctx.fillRect(0, H - 24, W, 24);
                    break;
                case 'film':
                    ctx.strokeStyle = '#222'; ctx.strokeRect(20, 20, W - 40, H - 40);
                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    for (let y = 40; y < H - 40; y += 40) {
                        ctx.fillRect(8, y, 18, 18); ctx.fillRect(W - 26, y, 18, 18);
                    }
                    break;
                default: // classic
                    ctx.strokeStyle = '#fff'; ctx.strokeRect(12, 12, W - 24, H - 24);
                    ctx.strokeStyle = '#8b6c4b'; ctx.lineWidth = 10;
                    ctx.strokeRect(22, 22, W - 44, H - 44);
            }
        });
    }

    _applyEffect(name) {
        return this._renderToCanvas(this.currentImage, (ctx, c, img) => {
            const W = c.width, H = c.height;
            switch (name) {
                case 'glow':
                    // Draw base first, then glowing overlay
                    ctx.drawImage(img, 0, 0, W, H);
                    ctx.shadowColor = 'rgba(255,220,150,0.7)';
                    ctx.shadowBlur  = 40;
                    ctx.globalAlpha = 0.5;
                    ctx.drawImage(img, 0, 0, W, H);
                    ctx.globalAlpha = 1;
                    ctx.shadowBlur  = 0;
                    break;
                case 'shadow':
                    ctx.fillStyle = '#e8ddd0'; ctx.fillRect(0, 0, W, H);
                    ctx.shadowColor   = 'rgba(0,0,0,0.4)';
                    ctx.shadowBlur    = 30;
                    ctx.shadowOffsetX = 16;
                    ctx.shadowOffsetY = 16;
                    ctx.drawImage(img, 0, 0, W - 16, H - 16);
                    ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
                    break;
                case 'texture': {
                    ctx.drawImage(img, 0, 0, W, H);
                    // Grain overlay
                    const id2 = ctx.createImageData(W, H);
                    for (let i = 0; i < id2.data.length; i += 4) {
                        const noise = (Math.random() - 0.5) * 30;
                        id2.data[i]   = 128 + noise;
                        id2.data[i+1] = 128 + noise;
                        id2.data[i+2] = 128 + noise;
                        id2.data[i+3] = 18;
                    }
                    ctx.putImageData(id2, 0, 0);
                    // also put the drawn image back on top at slightly reduced opacity
                    ctx.globalAlpha = 0.92;
                    ctx.drawImage(img, 0, 0, W, H);
                    ctx.globalAlpha = 1;
                    break;
                }
                default: // fade
                    ctx.filter = 'brightness(0.9) contrast(0.92) saturate(0.82)';
                    ctx.drawImage(img, 0, 0, W, H);
                    ctx.filter = 'none';
            }
        });
    }

    /* ─── Save ────────────────────────────────────────────────────── */

    saveImage() {
        if (!this.currentImage) { this._toast('No image to save', 'error'); return; }
        const a = document.createElement('a');
        a.download = `photobooth-${this.sessionId}-${Date.now()}.jpg`;
        a.href = this.currentImage;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        this._toast('Saved!', 'success');
    }

    /* ─── Photo strip ─────────────────────────────────────────────── */

    createPhotoStrip() {
        if (this.gallery.length < 2) { this._toast('Need ≥ 2 photos for a strip', 'error'); return; }
        this._showLoading('Building strip…');
        const images = this.gallery.slice(0, 4).map(g => g.data);  // uses processed data
        setTimeout(() => {
            this._renderStrip(images);
            this.stripImages = images;
            this._updateStats('strips');
            this._hideLoading();
            this._toast('Strip created!', 'success');
        }, 400);
    }

    _renderStrip(images) {
        const container = this._el('stripContainer');
        if (!container) return;
        const items = images.map((src, i) =>
            `<div class="strip-photo" style="animation-delay:${i * 0.08}s">
                <img src="${src}" alt="Strip ${i + 1}" />
                <div class="strip-photo__num">${i + 1}</div>
             </div>`
        ).join('');
        container.innerHTML = `
            <div class="photo-strip">
                <div class="strip-header-deco">
                    <span class="strip-logo">● photobooth</span>
                    <span class="strip-date">${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
                </div>
                <div class="strip-photos">${items}</div>
                <div class="strip-footer-deco">
                    <span>session ${this.sessionId}</span>
                    <span>✦</span>
                    <span>${images.length} photos</span>
                </div>
            </div>`;
    }

    async _downloadStrip() {
        if (!this.stripImages.length) { this._toast('No strip yet', 'error'); return; }
        this._showLoading('Preparing…');
        try {
            const canvas = await this._buildStripCanvas();
            const a = document.createElement('a');
            a.download = `strip-${this.sessionId}-${Date.now()}.jpg`;
            a.href = canvas.toDataURL('image/jpeg', 0.92);
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            this._toast('Strip downloaded!', 'success');
        } catch { this._toast('Download failed', 'error'); }
        finally { this._hideLoading(); }
    }

    _buildStripCanvas() {
        return new Promise((res, rej) => {
            const PHOTO_W  = 320, PHOTO_H = 420, GAP = 10, PAD = 24;
            const n        = this.stripImages.length;
            const CW       = PAD * 2 + n * PHOTO_W + (n - 1) * GAP;
            const CH       = PAD * 2 + PHOTO_H + 80; // 80 for header/footer
            const c        = document.createElement('canvas');
            c.width = CW; c.height = CH;
            const ctx = c.getContext('2d');

            // Background
            const bg = ctx.createLinearGradient(0, 0, CW, CH);
            bg.addColorStop(0, '#faf8f5'); bg.addColorStop(1, '#ede6db');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);

            // Header text
            ctx.fillStyle = '#2a2926';
            ctx.font = '500 16px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('● photobooth studio', PAD, PAD + 18);
            ctx.fillStyle = '#6b645c'; ctx.font = '300 13px system-ui, sans-serif';
            ctx.fillText(new Date().toLocaleDateString(), CW - PAD - 80, PAD + 18);

            let loaded = 0;
            this.stripImages.forEach((src, idx) => {
                const img = new Image();
                img.onload = () => {
                    const x = PAD + idx * (PHOTO_W + GAP);
                    const y = PAD + 36;
                    // White card background
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.roundRect(x - 4, y - 4, PHOTO_W + 8, PHOTO_H + 8, 8);
                    ctx.fill();
                    // Shadow
                    ctx.shadowColor = 'rgba(42,41,38,0.15)';
                    ctx.shadowBlur  = 12;
                    ctx.shadowOffsetY = 4;
                    // Draw photo
                    ctx.drawImage(img, x, y, PHOTO_W, PHOTO_H);
                    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

                    loaded++;
                    if (loaded === n) {
                        // Footer
                        ctx.fillStyle = '#6b645c'; ctx.font = '300 12px system-ui, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(`session ${this.sessionId}  ✦  ${n} photos`, CW / 2, CH - 10);
                        res(c);
                    }
                };
                img.onerror = () => rej(new Error(`Failed img ${idx}`));
                img.src = src;
            });
        });
    }

    _shareStrip() {
        if (!this.stripImages.length) { this._toast('No strip yet', 'error'); return; }
        if (navigator.share) {
            navigator.share({ title: 'My Photobooth Strip', url: window.location.href })
                .then(() => this._toast('Shared!', 'success'))
                .catch(() => this._copyLink());
        } else { this._copyLink(); }
    }

    _copyLink() {
        navigator.clipboard?.writeText(window.location.href)
            .then(() => this._toast('Link copied!', 'success'))
            .catch(() => this._toast('Sharing not supported', 'info'));
    }

    _printStrip() {
        if (!this.stripImages.length) { this._toast('No strip yet', 'error'); return; }
        const w = window.open('', '_blank');
        const imgs = this.stripImages.map((s, i) => `<img src="${s}" alt="Strip ${i+1}" />`).join('');
        w.document.write(`<!DOCTYPE html><html><head><title>Photobooth Strip</title>
            <style>
                body { margin:20px; font-family:system-ui; text-align:center; background:#faf8f5; }
                h2 { font-weight:200; letter-spacing:2px; text-transform:lowercase; color:#2a2926; }
                .strip { display:flex; gap:6px; justify-content:center; margin:20px 0; }
                .strip img { width:150px; height:200px; object-fit:cover; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,.12); }
                .info { font-size:11px; color:#6b645c; margin-top:12px; }
                @media print { body { margin:10px; } }
            </style></head><body>
            <h2>● photobooth studio</h2>
            <div class="strip">${imgs}</div>
            <div class="info">session ${this.sessionId} · ${new Date().toLocaleDateString()}</div>
            </body></html>`);
        w.document.close();
        w.onload = () => { w.focus(); w.print(); };
        this._toast('Opening print dialog…', 'info');
    }

    /* ─── Tab switching ──────────────────────────────────────────── */

    _switchTab(e) {
        const name = e.currentTarget.dataset.tab;
        if (!name) return;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-enhanced').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const content = this._el(name);
        if (content) content.classList.add('active');
    }

    /* ─── Magic FAB ──────────────────────────────────────────────── */

    _toggleMagicMenu() {
        const menu = document.querySelector('.fab-menu');
        if (!menu) return;
        this.magicMenuOpen = !this.magicMenuOpen;
        menu.classList.toggle('active', this.magicMenuOpen);
    }

    _closeMagicMenu() {
        const menu = document.querySelector('.fab-menu');
        if (menu) menu.classList.remove('active');
        this.magicMenuOpen = false;
    }

    _handleMagicAction(e) {
        const action = e.currentTarget.dataset.action;
        if (action === 'random-filter') {
            const filters = ['vintage', 'bw', 'blur', 'enhance', 'retro'];
            const f = filters[Math.floor(Math.random() * filters.length)];
            document.querySelector(`[data-filter="${f}"]`)?.click();
        } else if (action === 'auto-enhance') {
            document.querySelector('[data-filter="enhance"]')?.click();
        } else if (action === 'surprise-me') {
            this._surpriseMe();
        }
        this._closeMagicMenu();
    }

    _surpriseMe() {
        const choices = [
            () => this._confetti(),
            () => this._sparkles(),
        ];
        choices[Math.floor(Math.random() * choices.length)]();
        this._toast('✨ Surprise!', 'success');
    }

    _confetti() {
        const colors = ['#a8b5a0','#c4967a','#d4c4b0','#e8ddd0'];
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const el = document.createElement('div');
                Object.assign(el.style, {
                    position:'fixed', width: (Math.random()*7+4)+'px', height: (Math.random()*7+4)+'px',
                    background: colors[Math.floor(Math.random()*colors.length)],
                    left: Math.random()*window.innerWidth+'px', top:'-20px',
                    zIndex:'9999', pointerEvents:'none', borderRadius: Math.random()>.5 ? '50%':'2px'
                });
                document.body.appendChild(el);
                const dur = Math.random()*2500+2000;
                el.animate([
                    { transform:`translateY(0) rotate(0deg)`, opacity:1 },
                    { transform:`translateY(${window.innerHeight+40}px) rotate(360deg)`, opacity:0 }
                ], { duration: dur, easing:'ease-in' });
                setTimeout(() => el.parentNode && el.parentNode.removeChild(el), dur);
            }, i * 40);
        }
    }

    _sparkles() {
        const emojis = ['✨','⭐','🌟','💫'];
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const el = document.createElement('div');
                Object.assign(el.style, {
                    position:'fixed', left:Math.random()*window.innerWidth+'px',
                    top:Math.random()*window.innerHeight+'px',
                    zIndex:'9999', fontSize:(Math.random()*14+14)+'px', pointerEvents:'none'
                });
                el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
                document.body.appendChild(el);
                el.animate([
                    { transform:'scale(0) rotate(0deg)', opacity:0 },
                    { transform:'scale(1.2) rotate(180deg)', opacity:1, offset:0.5 },
                    { transform:'scale(0) rotate(360deg)', opacity:0 }
                ], { duration:2200, easing:'ease-in-out' });
                setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 2200);
            }, i * 70);
        }
    }

    /* ─── Session ─────────────────────────────────────────────────── */

    _newSession() {
        if (!confirm('Start fresh? Gallery and stats will reset.')) return;
        this.sessionId       = this._generateId(6, true);
        this.gallery         = [];
        this.stripImages     = [];
        this.currentImage    = null;
        this.currentGalleryId = null;
        this.currentFilter   = 'none';
        this.stats           = { photos: 0, filters: 0, strips: 0 };
        this.stopCamera();
        this._updateSessionDisplay();
        this._updateStatsDisplay();
        this._renderGallery();
        this._resetPreview();
        this._enableActions(false);
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-filter="none"]')?.classList.add('active');
        this._toast('New session started!', 'success');
    }

    _resetPreview() {
        const p = this._el('imagePreview');
        if (!p) return;
        p.innerHTML = `<div class="preview-placeholder floating-placeholder">
            <div class="placeholder-content">
                <span class="placeholder-icon breathing-circle">○</span>
                <p class="placeholder-text">your image appears here</p>
                <div class="placeholder-hint">upload or capture to begin</div>
            </div></div>`;
    }

    /* ─── Stats ───────────────────────────────────────────────────── */

    _updateStats(key) {
        if (key in this.stats) this.stats[key]++;
        this._updateStatsDisplay();
    }

    _updateStatsDisplay() {
        const map = { photoCount: this.stats.photos, filtersUsed: this.stats.filters, stripsCreated: this.stats.strips };
        Object.entries(map).forEach(([id, val]) => { const el = this._el(id); if (el) el.textContent = val; });
    }

    _updateSessionDisplay() {
        const el = this._el('sessionId');
        if (el) el.textContent = `session: ${this.sessionId}`;
    }

    /* ─── Loading / Toast ─────────────────────────────────────────── */

    _showLoading(msg = 'Loading…') {
        const ov = this._el('loadingOverlay');
        if (!ov) return;
        const t = ov.querySelector('.loading-text');
        if (t) t.textContent = msg;
        ov.classList.add('active');
    }

    _hideLoading() { this._el('loadingOverlay')?.classList.remove('active'); }

    _toast(msg, type = 'info') {
        const container = this._el('toastContainer') || (() => {
            const d = document.createElement('div');
            d.id = 'toastContainer'; d.className = 'toast-container';
            document.body.appendChild(d); return d;
        })();
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.innerHTML = `<span class="toast-message">${msg}</span>
                       <button class="toast-close" onclick="this.parentNode.remove()">×</button>`;
        container.appendChild(t);
        requestAnimationFrame(() => (t.style.transform = 'translateX(0)'));
        setTimeout(() => {
            t.style.opacity = '0'; t.style.transform = 'translateX(320px)';
            setTimeout(() => t.parentNode && t.parentNode.removeChild(t), 320);
        }, 4000);
    }

    /* ─── Misc utils ─────────────────────────────────────────────── */

    _flashEffect() {
        const f = document.createElement('div');
        Object.assign(f.style, { position:'fixed', inset:'0', background:'rgba(255,255,255,.85)', zIndex:'9999', pointerEvents:'none' });
        document.body.appendChild(f);
        f.animate([{ opacity:0 },{ opacity:.85 },{ opacity:0 }], { duration:160, easing:'ease-out' });
        setTimeout(() => f.parentNode?.removeChild(f), 160);
    }

    _b64toBlob(dataURL) {
        return new Promise((res, rej) => {
            try {
                const [header, data] = dataURL.split(',');
                const mime = header.match(/:(.*?);/)[1];
                const bin  = atob(data);
                const arr  = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                res(new Blob([arr], { type: mime }));
            } catch (e) { rej(e); }
        });
    }

    cleanup() {
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    }
}

// Boot
const app = new PhotoboothApp();
window.photobooth = app;
window.addEventListener('beforeunload', () => app.cleanup());