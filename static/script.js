document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const dropArea = document.getElementById('dropArea');
    const photoUploadInput = document.getElementById('photoUpload');
    const filePreviews = document.getElementById('filePreviews');
    const resultSection = document.getElementById('resultSection');
    const processedImage = document.getElementById('processedImage');
    const downloadLink = document.getElementById('downloadLink');
    const createAnotherButton = document.getElementById('createAnother');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorMessage = document.getElementById('errorMessage');

    let uploadedFiles = []; // Array to store files selected by user

    // --- Drag & Drop Functionality ---
    dropArea.addEventListener('click', () => photoUploadInput.click());

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

    photoUploadInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        errorMessage.classList.add('hidden'); // Hide any previous error
        const maxFiles = 4;
        const currentFileCount = uploadedFiles.length;
        const newFileCount = files.length;

        if (currentFileCount + newFileCount > maxFiles) {
            displayError(`You can upload a maximum of ${maxFiles} photos. Please remove some or upload fewer.`);
            return;
        }

        for (const file of files) {
            if (file.type.startsWith('image/') && uploadedFiles.length < maxFiles) {
                uploadedFiles.push(file);
                renderFilePreview(file);
            } else if (!file.type.startsWith('image/')) {
                displayError(`"${file.name}" is not a valid image file. Only JPG, PNG, GIF are allowed.`);
            } else if (uploadedFiles.length >= maxFiles) {
                 displayError(`Maximum of ${maxFiles} photos reached. "${file.name}" was not added.`);
            }
        }
        // Clear the input so selecting same files again triggers change event
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
                event.stopPropagation(); // Prevent triggering dropArea click
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
        errorMessage.classList.add('hidden'); // Clear error if files are removed
    }

    // --- Form Submission ---
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (uploadedFiles.length === 0) {
            displayError('Please upload at least one photo to conjure your strip!');
            return;
        }

        if (uploadedFiles.length > 4) {
             displayError('You can upload a maximum of 4 photos.');
             return;
        }

        showLoading();
        errorMessage.classList.add('hidden');
        resultSection.classList.add('hidden'); // Hide previous result

        const formData = new FormData();
        uploadedFiles.forEach(file => {
            formData.append('photos', file);
        });

        // Append selected options
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
                resultSection.classList.remove('hidden');
                uploadForm.classList.add('hidden'); // Hide form
            } else {
                displayError(data.error || 'An unknown error occurred.');
            }
        } catch (error) {
            console.error('Error:', error);
            displayError('Network error or server unavailable. Please try again later.');
        } finally {
            hideLoading();
        }
    });

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
    }

    // --- Reset Functionality ---
    createAnotherButton.addEventListener('click', () => {
        uploadedFiles = [];
        filePreviews.innerHTML = ''; // Clear previews
        uploadForm.reset(); // Reset form radio buttons etc.
        resultSection.classList.add('hidden');
        uploadForm.classList.remove('hidden'); // Show form again
        errorMessage.classList.add('hidden'); // Hide any errors
        photoUploadInput.value = ''; // Clear file input value
    });
});