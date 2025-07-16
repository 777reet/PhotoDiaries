document.addEventListener('DOMContentLoaded', () => {
    let selectedFiles = [];
    const minFiles = 1; // New minimum number of files
    const maxFiles = 4; // Max number of files remains 4

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
        // Clear selected files but maintain the structure for new additions
        selectedFiles = []; 
        fileList.innerHTML = ''; // Clear display list immediately

        if (files.length === 0) {
            showError('Please select at least one photo. ✨');
            updateProcessButtonState(); // Update button state after clearing files
            return;
        }

        // Validate number of files first
        if (files.length > maxFiles) {
            showError(`Whoops! Please select a maximum of ${maxFiles} photos. You selected ${files.length}.`);
            updateProcessButtonState();
            return;
        }

        let allFilesValid = true;
        for (let file of files) {
            if (!file.type.startsWith('image/')) {
                showError('Oops! Only image files (JPG, PNG, GIF) are allowed. 📸');
                allFilesValid = false;
                break;
            }
            if (file.size > 16 * 1024 * 1024) { // 16MB
                showError(`This photo is a bit too big! Max size is 16MB. 🎈`);
                allFilesValid = false;
                break;
            }
            selectedFiles.push(file);
        }

        if (!allFilesValid) {
            selectedFiles = []; // Clear files if any invalid
        }
        updateFileList(); // Update the displayed list
        updateProcessButtonState(); // Update button state based on new selectedFiles
    }

    function updateFileList() {
        fileList.innerHTML = ''; // Clear current list

        if (selectedFiles.length > 0) {
            selectedFiles.forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span>📸</span>
                    <span class="filename">${file.name}</span>
                    <button class="remove-btn" data-index="${index}">×</button>
                `;
                fileList.appendChild(fileItem);
            });
            // Add event listeners to new remove buttons
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
        updateProcessButtonState(); // Crucial: Call this after removing a file
        hideMessages(); // Clear error/success messages
    }

    // New function to handle the button's disabled state
    function updateProcessButtonState() {
        // Button enabled if between minFiles and maxFiles
        if (selectedFiles.length >= minFiles && selectedFiles.length <= maxFiles) {
            processBtn.disabled = false;
        } else {
            processBtn.disabled = true;
        }
    }


    // Process button handler
    processBtn.addEventListener('click', async () => {
        // Client-side check before sending to backend
        if (selectedFiles.length < minFiles || selectedFiles.length > maxFiles) {
            showError(`Psst! You need between ${minFiles} and ${maxFiles} photos to create magic. ✨`);
            return;
        }

        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('photos', file);
        });

        // Add selected options
        const colorMode = document.querySelector('input[name="color_mode"]:checked').value;
        formData.append('color_mode', colorMode);

        const frameStyle = document.querySelector('input[name="frame_style"]:checked').value;
        formData.append('frame_style', frameStyle);
        
        try {
            processBtn.disabled = true; // Disable button immediately on click
            loading.style.display = 'block';
            hideMessages();
            resultDiv.style.display = 'none'; // Hide previous result

            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                resultImage.src = data.image_url;
                downloadBtn.href = data.download_url; // Use the dedicated download URL
                resultDiv.style.display = 'block';
                showSuccess('Voila! Your vintage photobooth strip is ready to shine! 💖');
                triggerConfetti(); // Fun confetti effect!
            } else {
                showError(data.error || 'Oops! An unexpected error occurred. Let\'s try again?');
            }
        } catch (err) {
            console.error('Fetch error:', err);
            showError('Network error. Are you connected to the internet, sweetie? Try again!');
        } finally {
            loading.style.display = 'none';
            // Re-enable process button only if conditions for processing are met (after a potential error)
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
        const colors = ['#A765A2', '#EE87B4', '#F8D8C0', '#4A0E4F', '#ffffff']; // Sabrina inspired colors
        const confettiCount = 100;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti-piece');
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.animationDelay = (Math.random() * 2) + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            confetti.style.opacity = Math.random() + 0.5;
            confetti.style.fontSize = (Math.random() * 1.5 + 0.8) + 'em'; // Varying sizes for charm

            document.body.appendChild(confetti);

            // Remove confetti after animation ends
            confetti.addEventListener('animationend', () => {
                confetti.remove();
            });
        }
    }
    
    // Initial state setup when the page loads
    updateProcessButtonState();
});