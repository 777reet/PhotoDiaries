document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const dropArea = document.getElementById('dropArea');
    const photoUploadInput = document.getElementById('photoUpload');
    const clickToSelectBtn = document.querySelector('.click-to-select-btn'); // New button
    const filePreviews = document.getElementById('filePreviews');
    const resultSection = document.getElementById('resultSection');
    const processedImage = document.getElementById('processedImage');
    const downloadLink = document.getElementById('downloadLink');
    const createAnotherButton = document.getElementById('createAnother');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorMessage = document.getElementById('errorMessage');

    let uploadedFiles = []; // Array to store files selected by user

    // --- Event Listeners ---
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

    // Clicking the "Or click to select" button
    clickToSelectBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent form submission if button is inside form
        photoUploadInput.click();
    });

    // Directly clicking the dropArea itself will also trigger the input
    // (This listener is for the overall dropArea, not just the button)
    dropArea.addEventListener('click', (e) => {
        // Only trigger if click is directly on dropArea or its children, but not the button itself
        if (e.target === dropArea || !clickToSelectBtn.contains(e.target)) {
            photoUploadInput.click();
        }
    });

    photoUploadInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    uploadForm.addEventListener('submit', handleSubmit);
    createAnotherButton.addEventListener('click', resetForm);


    // --- File Handling Functions ---
    function handleFiles(files) {
        errorMessage.classList.add('hidden'); // Hide any previous error

        const filesArray = Array.from(files); // Convert FileList to Array

        // Filter out existing files to prevent duplicates
        const newValidFiles = filesArray.filter(file => 
            file.type.startsWith('image/') && !uploadedFiles.some(existingFile => existingFile.name === file.name && existingFile.size === file.size)
        );

        const totalFilesAfterAdding = uploadedFiles.length + newValidFiles.length;

        if (totalFilesAfterAdding > 4) {
            displayError(`You can upload a maximum of 4 photos. You tried to add ${newValidFiles.length} new files, which would exceed the limit.`);
            return;
        }

        if (newValidFiles.length === 0 && filesArray.length > 0) {
            // This case handles attempts to re-upload existing files or invalid files
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
        
        // Clear the input so selecting same files again triggers change event (important for 'change' listener)
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
        // If all files are removed, you might want to show a message or adjust UI
        if (uploadedFiles.length === 0) {
            // Optionally, change dropArea text back to initial state
        }
    }

    // --- Form Submission Function ---
    async function handleSubmit(e) {
        e.preventDefault();

        if (uploadedFiles.length === 0) {
            displayError('Please upload at least one photo to conjure your strip!');
            return;
        }
        if (uploadedFiles.length > 4) { // This should ideally be caught by handleFiles, but as a double-check
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
    }

    // --- Reset Functionality ---
    function resetForm() {
        uploadedFiles = [];
        filePreviews.innerHTML = ''; // Clear previews
        uploadForm.reset(); // Reset form radio buttons etc.
        resultSection.classList.add('hidden');
        uploadForm.classList.remove('hidden'); // Show form again
        errorMessage.classList.add('hidden'); // Hide any errors
        photoUploadInput.value = ''; // Clear file input value for security
    }
});