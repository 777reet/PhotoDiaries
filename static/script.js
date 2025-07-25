document.addEventListener('DOMContentLoaded', () => {
    const horizontalScrollContainer = document.querySelector('.horizontal-scroll-container');
    const uploadForm = document.getElementById('uploadForm');
    const dropArea = document.getElementById('dropArea');
    const photoUploadInput = document.getElementById('photoUpload');
    const clickToSelectBtn = document.querySelector('.click-to-select-btn');
    const filePreviews = document.getElementById('filePreviews');
    const resultSection = document.getElementById('resultPanel'); // This is now a panel
    const processedImage = document.getElementById('processedImage');
    const downloadLink = document.getElementById('downloadLink');
    const createAnotherButton = document.getElementById('createAnother');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorMessage = document.getElementById('errorMessage');

    // Navigation Buttons
    const goToOptionsButton = document.getElementById('goToOptions');
    const goToWelcomeButton = document.getElementById('goToWelcome');
    const goToOptionsFromResultButton = document.getElementById('goToOptionsFromResult'); // New button

    let uploadedFiles = []; // Array to store files selected by user

    // --- Panel Navigation Functions ---
    function scrollToPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            horizontalScrollContainer.scrollTo({
                left: panel.offsetLeft,
                behavior: 'smooth'
            });
            // Hide error message when navigating
            errorMessage.classList.add('hidden');
        }
    }

    goToOptionsButton.addEventListener('click', () => {
        if (uploadedFiles.length === 0) {
            displayError('Please upload at least one photo before choosing your magic!');
            return;
        }
        scrollToPanel('optionsPanel');
    });

    goToWelcomeButton.addEventListener('click', () => {
        scrollToPanel('welcomeUploadPanel');
    });

    goToOptionsFromResultButton.addEventListener('click', () => {
        scrollToPanel('optionsPanel');
    });


    // --- File Handling Event Listeners ---
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('hover');
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('hover');
    });

    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('hover');
        handleFiles(e.dataTransfer.files);
    });

    clickToSelectBtn.addEventListener('click', () => {
        photoUploadInput.click();
    });

    photoUploadInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });


    // --- File Handling Functions ---
    function handleFiles(files) {
        errorMessage.classList.add('hidden'); // Hide any previous error

        const filesArray = Array.from(files); // Convert FileList to Array

        const newValidFiles = filesArray.filter(file =>
            file.type.startsWith('image/') && !uploadedFiles.some(existingFile => existingFile.name === file.name && existingFile.size === file.size)
        );

        const totalFilesAfterAdding = uploadedFiles.length + newValidFiles.length;

        if (totalFilesAfterAdding > 4) {
            displayError(`You can upload a maximum of 4 photos. You tried to add ${newValidFiles.length} new files, which would exceed the limit.`);
            return;
        }

        if (newValidFiles.length === 0 && filesArray.length > 0) {
            if (filesArray.some(file => !file.type.startsWith('image/'))) {
                displayError("Some selected files were not valid image types (JPG, PNG, GIF).");
            } else if (filesArray.every(file => uploadedFiles.some(existingFile => existingFile.name === file.name && existingFile.size === file.size))) {
                 displayError("You've already added these photos. Please select new ones or proceed!");
            }
            return;
        }

        uploadedFiles.push(...newValidFiles);

        newValidFiles.forEach(file => {
            renderFilePreview(file);
        });

        photoUploadInput.value = '';
    }

    function renderFilePreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.classList.add('file-preview-item');

            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            previewItem.appendChild(img);

            const removeButton = document.createElement('span');
            removeButton.classList.add('remove-file');
            removeButton.textContent = 'X';
            removeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                removeFile(file, previewItem);
            });
            previewItem.appendChild(removeButton);

            filePreviews.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    }

    function removeFile(fileToRemove, previewItem) {
        uploadedFiles = uploadedFiles.filter(file => file !== fileToRemove);
        filePreviews.removeChild(previewItem);
        errorMessage.classList.add('hidden');
    }

    // --- Form Submission Function ---
    uploadForm.addEventListener('submit', handleSubmit);

    async function handleSubmit(e) {
        e.preventDefault();

        if (uploadedFiles.length === 0) {
            displayError('Please upload at least one photo to conjure your strip!');
            scrollToPanel('welcomeUploadPanel'); // Go back to upload panel
            return;
        }
        if (uploadedFiles.length > 4) {
             displayError('You can upload a maximum of 4 photos.');
             scrollToPanel('welcomeUploadPanel');
             return;
        }

        showLoading();
        errorMessage.classList.add('hidden');
        // resultSection.classList.add('hidden'); // Not needed as it's a panel now

        const formData = new FormData();
        uploadedFiles.forEach(file => {
            formData.append('photos', file);
        });

        formData.append('color_mode', document.querySelector('input[name="color_mode"]:checked').value);
        formData.append('frame_style', document.querySelector('input[name="frame_style"]:checked').value);
        formData.append('effect_filter', document.querySelector('input[name="effect_filter"]:checked').value);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                processedImage.src = data.image_url;
                downloadLink.href = data.download_url;
                scrollToPanel('resultPanel'); // Scroll to result panel
            } else {
                displayError(data.error || 'An unknown error occurred.');
                scrollToPanel('optionsPanel'); // Stay on options if error occurs
            }
        } catch (error) {
            console.error('Error:', error);
            displayError('Network error or server unavailable. Please try again later.');
            scrollToPanel('optionsPanel'); // Stay on options if network error
        } finally {
            hideLoading();
        }
    }

    // --- Reset Functionality ---
    createAnotherButton.addEventListener('click', resetForm);

    function resetForm() {
        uploadedFiles = [];
        filePreviews.innerHTML = '';
        uploadForm.reset();
        processedImage.src = ''; // Clear image
        downloadLink.href = '#'; // Clear download link
        errorMessage.classList.add('hidden');
        photoUploadInput.value = '';
        scrollToPanel('welcomeUploadPanel'); // Go back to the first panel
    }

    // --- UI State Management ---
    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function displayError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        // Auto-hide error after a few seconds
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000);
    }
});