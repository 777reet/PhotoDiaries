document.addEventListener('DOMContentLoaded', () => {
    let selectedFiles = [];
    const minFiles = 1;
    const maxFiles = 4;

    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const processBtn = document.getElementById('processBtn');
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    const resultDiv = document.getElementById('result');
    const resultImage = document.getElementById('resultImage');
    const downloadBtn = document.getElementById('downloadBtn');
    const createAnotherBtn = document.getElementById('createAnotherBtn');

    // Upload area click handler
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Drag and drop handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    function handleFiles(files) {
        hideMessages();
        // Clear selected files if new files are being added (simulating fresh selection)
        selectedFiles = []; 
        fileList.innerHTML = ''; // Clear display list immediately

        if (files.length === 0) {
            showError('Please select at least one lovely photo. ✨');
            updateProcessButtonState();
            return;
        }

        // Validate number of files first
        if (files.length > maxFiles) {
            showError(`Oh dear! Please select a maximum of ${maxFiles} photos. You picked ${files.length}.`);
            updateProcessButtonState();
            return;
        }

        let allFilesValid = true;
        for (let file of files) {
            if (!file.type.startsWith('image/')) {
                showError('Oops! Only image files (like JPG, PNG, GIF) are allowed for this magic. 📸');
                allFilesValid = false;
                break;
            }
            if (file.size > 16 * 1024 * 1024) { // 16MB
                showError(`This photo is a bit too grand! Max size is 16MB. 🎈`);
                allFilesValid = false;
                break;
            }
            selectedFiles.push(file);
        }

        if (!allFilesValid) {
            selectedFiles = []; // Clear files if any invalid
        }
        updateFileList();
        updateProcessButtonState();
    }

    function updateFileList() {
        fileList.innerHTML = ''; // Clear current list

        if (selectedFiles.length > 0) {
            selectedFiles.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span>💖</span> <span class="filename">${file.name}</span>
                    <button class="remove-btn" data-index="${index}">×</button>
                `;
                fileList.appendChild(fileItem);
            });
            document.querySelectorAll('.remove-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const indexToRemove = parseInt(e.target.dataset.index);
                    removeFile(indexToRemove);
                });
            });
        }
    }

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updateFileList();
        updateProcessButtonState();
        hideMessages();
    }

    function updateProcessButtonState() {
        if (selectedFiles.length >= minFiles && selectedFiles.length <= maxFiles) {
            processBtn.disabled = false;
        } else {
            processBtn.disabled = true;
        }
    }

    // Process button handler
    processBtn.addEventListener('click', async () => {
        if (selectedFiles.length < minFiles || selectedFiles.length > maxFiles) {
            showError(`Psst! You need between ${minFiles} and ${maxFiles} photos to create magic. ✨`);
            return;
        }

        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('photos', file);
        });

        const colorMode = document.querySelector('input[name="color_mode"]:checked').value;
        formData.append('color_mode', colorMode);

        const frameStyle = document.querySelector('input[name="frame_style"]:checked').value;
        formData.append('frame_style', frameStyle);
        
        try {
            processBtn.disabled = true;
            loading.style.display = 'block';
            hideMessages();
            resultDiv.style.display = 'none';

            // Simulate API call for demonstration (replace with actual fetch to your backend)
            // In a real scenario, this would be:
            // const response = await fetch('/upload', {
            //     method: 'POST',
            //     body: formData
            // });
            // const data = await response.json();

            // --- SIMULATION START ---
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay
            const simulatedData = {
                success: true,
                image_url: 'https://via.placeholder.com/400x1200/FFB3D9/FFFFFF?text=Your+Beautiful+Photobooth+Strip', // Placeholder image
                download_url: 'https://via.placeholder.com/400x1200/FFB3D9/FFFFFF?text=Downloadable+Strip'
            };
            const data = simulatedData;
            // --- SIMULATION END ---

            if (data.success) {
                resultImage.src = data.image_url;
                downloadBtn.href = data.download_url;
                resultDiv.style.display = 'block';
                showSuccess('Voila! Your vintage photobooth strip is ready to shine! 💖');
                triggerConfetti();
            } else {
                showError(data.error || 'Oops! An unexpected enchantment failed. Let\'s try again?');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            showError('Network spell failed. Are you connected to the internet, sweetie? Try again!');
        } finally {
            loading.style.display = 'none';
            updateProcessButtonState();
        }
    });

    // Create another button
    createAnotherBtn.addEventListener('click', () => {
        location.reload(); // Simple reload to restart the process
    });

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        successDiv.style.display = 'none';
    }

    function showSuccess(message) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        errorDiv.style.display = 'none';
    }

    function hideMessages() {
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
    }

    function triggerConfetti() {
        const colors = ['#C78CC7', '#FFB3D9', '#FFE0F0', '#6A3B6A', '#ffffff'];
        const confettiCount = 100; // More confetti!

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti-piece');
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.animationDelay = (Math.random() * 2) + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            confetti.style.opacity = Math.random() * 0.5 + 0.5; // More subtle opacity
            confetti.style.width = confetti.style.height = (Math.random() * 8 + 6) + 'px'; // Varying sizes for charm

            // Random X offset for a wider spread
            confetti.style.setProperty('--rand-x', (Math.random() * 2 - 1).toFixed(2));

            document.body.appendChild(confetti);

            confetti.addEventListener('animationend', () => {
                confetti.remove();
            });
        }
    }
    
    // Initial state setup when the page loads
    updateProcessButtonState();
});