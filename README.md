# Photobooth Studio

A modern web-based photobooth application with AI-powered image similarity search. Features a FastAPI backend with ChromaDB vector database for intelligent photo management and discovery.

## Features

- **Camera Integration**: Live webcam capture with viewfinder overlay
- **File Upload**: Drag-and-drop or browse to upload multiple images
- **Real-time Filters**: Apply vintage, black & white, blur, enhance, and retro effects
- **Photo Strips**: Combine multiple photos into classic photobooth strips
- **Vector Search**: Find similar images using AI-powered similarity matching
- **Session Management**: Persistent sessions with unique IDs and cross-session search
- **Interactive Effects**: Confetti, sparkles, and dynamic color schemes
- **API Integration**: Full backend processing with metadata storage

## Tech Stack

**Frontend:**
- Pure JavaScript (ES6+) with Canvas API for image processing
- HTML5 MediaDevices API for camera access
- CSS3 animations and modern UI components

**Backend:**
- FastAPI with automatic API documentation
- ChromaDB vector database for image embeddings
- PIL/Pillow for server-side image processing
- NumPy for advanced filter algorithms

**Features:**
- Vector similarity search for finding related photos
- Persistent storage across sessions
- RESTful API with JSON responses
- Automatic image feature extraction and indexing

## Usage

1. Start the FastAPI server: `python app.py`
2. Open `http://localhost:8000` in a modern web browser
3. Grant camera permissions or upload images to start editing
4. Images are automatically indexed for similarity search

## Outputs 
