# app.py - Updated Photobooth Backend with Static File Serving
import os
import io
import uuid
import base64
import numpy as np
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict
import json

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw, ImageFont
import chromadb
from chromadb.utils import embedding_functions
import cv2

# Create FastAPI app
app = FastAPI(title="Photobooth API", version="1.0.0")

# CORS middleware - IMPORTANT: Add this before other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain instead of "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (CSS, JS, images)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup templates for HTML serving
templates = Jinja2Templates(directory="templates")

# Vector database setup
chroma_client = chromadb.PersistentClient(path="./photobooth_db")
# Using default embedding function for image features
embedding_function = embedding_functions.DefaultEmbeddingFunction()

# Create or get collection
try:
    collection = chroma_client.create_collection(
        name="photo_collection",
        embedding_function=embedding_function
    )
except:
    collection = chroma_client.get_collection(
        name="photo_collection",
        embedding_function=embedding_function
    )

@dataclass
class PhotoMetadata:
    id: str
    filename: str
    timestamp: datetime
    filters_applied: List[str]
    dimensions: tuple
    file_size: int

class ImageProcessor:
    """Handle image processing and filter applications"""
    
    @staticmethod
    def apply_vintage_filter(image: Image.Image) -> Image.Image:
        """Apply a vintage/sepia filter"""
        # Convert to RGBA if not already
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        # Create sepia effect
        pixels = np.array(image)
        
        # Sepia transformation matrix
        sepia_filter = np.array([
            [0.393, 0.769, 0.189, 0],
            [0.349, 0.686, 0.168, 0],
            [0.272, 0.534, 0.131, 0],
            [0, 0, 0, 1]
        ])
        
        sepia_img = pixels @ sepia_filter.T
        sepia_img = np.clip(sepia_img, 0, 255).astype(np.uint8)
        
        return Image.fromarray(sepia_img, 'RGBA')
    
    @staticmethod
    def apply_black_white_filter(image: Image.Image) -> Image.Image:
        """Apply black and white filter"""
        return image.convert('L').convert('RGBA')
    
    @staticmethod
    def apply_blur_filter(image: Image.Image) -> Image.Image:
        """Apply blur filter"""
        return image.filter(ImageFilter.GaussianBlur(radius=2))
    
    @staticmethod
    def apply_enhance_filter(image: Image.Image) -> Image.Image:
        """Enhance colors and contrast"""
        enhancer = ImageEnhance.Color(image)
        image = enhancer.enhance(1.2)  # Boost color
        
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.1)  # Boost contrast
        
        return image
    
    @staticmethod
    def apply_retro_filter(image: Image.Image) -> Image.Image:
        """Apply retro filter with vignette"""
        # Convert to RGB if not already
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Reduce saturation slightly
        enhancer = ImageEnhance.Color(image)
        image = enhancer.enhance(0.8)
        
        # Add slight warmth
        pixels = np.array(image)
        pixels[:,:,0] = np.clip(pixels[:,:,0] * 1.1, 0, 255)  # Red
        pixels[:,:,2] = np.clip(pixels[:,:,2] * 0.9, 0, 255)  # Blue
        
        return Image.fromarray(pixels.astype(np.uint8), 'RGB')

class PhotoStripGenerator:
    """Generate formatted photo strips"""
    
    def __init__(self):
        self.strip_width = 400
        self.strip_height = 1200
        self.photo_width = 350
        self.photo_height = 250
        self.margin = 25
        self.photos_per_strip = 4
    
    def create_photostrip(self, images: List[Image.Image], session_id: str) -> Image.Image:
        """Create a formatted photostrip from multiple images"""
        # Create strip canvas
        strip = Image.new('RGB', (self.strip_width, self.strip_height), 'white')
        draw = ImageDraw.Draw(strip)
        
        # Add header
        try:
            # Try to use a nice font, fall back to default if not available
            font = ImageFont.truetype("arial.ttf", 24)
            small_font = ImageFont.truetype("arial.ttf", 16)
        except:
            font = ImageFont.load_default()
            small_font = ImageFont.load_default()
        
        # Header text
        header_text = "PHOTOBOOTH"
        bbox = draw.textbbox((0, 0), header_text, font=font)
        text_width = bbox[2] - bbox[0]
        draw.text(
            ((self.strip_width - text_width) // 2, 10),
            header_text,
            fill='black',
            font=font
        )
        
        # Date
        date_text = datetime.now().strftime("%Y-%m-%d %H:%M")
        bbox = draw.textbbox((0, 0), date_text, font=small_font)
        text_width = bbox[2] - bbox[0]
        draw.text(
            ((self.strip_width - text_width) // 2, 40),
            date_text,
            fill='gray',
            font=small_font
        )
        
        # Add photos
        y_position = 80
        for i, img in enumerate(images[:self.photos_per_strip]):
            # Resize image to fit
            img_resized = img.resize((self.photo_width, self.photo_height), Image.Resampling.LANCZOS)
            
            # Calculate position to center the image
            x_position = (self.strip_width - self.photo_width) // 2
            
            # Paste image
            strip.paste(img_resized, (x_position, y_position))
            
            # Add border
            draw.rectangle([
                x_position - 2, y_position - 2,
                x_position + self.photo_width + 2, y_position + self.photo_height + 2
            ], outline='black', width=2)
            
            y_position += self.photo_height + self.margin
        
        # Add footer
        footer_text = f"Session: {session_id[:8]}"
        bbox = draw.textbbox((0, 0), footer_text, font=small_font)
        text_width = bbox[2] - bbox[0]
        draw.text(
            ((self.strip_width - text_width) // 2, self.strip_height - 30),
            footer_text,
            fill='gray',
            font=small_font
        )
        
        return strip

class VectorImageDatabase:
    """Handle vector database operations for images"""
    
    @staticmethod
    def extract_image_features(image: Image.Image) -> List[float]:
        """Extract features from image for vector embedding"""
        # Convert to RGB and resize for consistent feature extraction
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize to standard size
        image = image.resize((224, 224))
        
        # Convert to numpy array and flatten
        pixels = np.array(image).flatten()
        
        # Normalize pixel values
        pixels = pixels / 255.0
        
        # Reduce dimensionality by taking every nth pixel to avoid too large vectors
        step = len(pixels) // 512  # Reduce to ~512 dimensions
        features = pixels[::step][:512].tolist()
        
        return features
    
    @staticmethod
    def generate_image_description(metadata: PhotoMetadata) -> str:
        """Generate description for text embedding"""
        filters_str = ", ".join(metadata.filters_applied) if metadata.filters_applied else "none"
        return f"Image {metadata.filename} with filters: {filters_str}, size: {metadata.dimensions}, taken at {metadata.timestamp}"

# Initialize processors
image_processor = ImageProcessor()
strip_generator = PhotoStripGenerator()
vector_db = VectorImageDatabase()

# NEW: Main route to serve the HTML page
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """Serve the main photobooth application page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/upload-image/")
async def upload_image(
    file: UploadFile = File(...),
    filters: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None)
):
    """Upload and process a single image with optional filters"""
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Generate unique ID
        image_id = str(uuid.uuid4())
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Read and process image
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes))
        
        # Store original image info
        original_size = image.size
        file_size = len(image_bytes)
        
        # Apply filters if specified
        filters_applied = []
        if filters:
            filter_list = [f.strip() for f in filters.split(',')]
            for filter_name in filter_list:
                if filter_name == 'vintage':
                    image = image_processor.apply_vintage_filter(image)
                    filters_applied.append('vintage')
                elif filter_name == 'bw':
                    image = image_processor.apply_black_white_filter(image)
                    filters_applied.append('black_white')
                elif filter_name == 'blur':
                    image = image_processor.apply_blur_filter(image)
                    filters_applied.append('blur')
                elif filter_name == 'enhance':
                    image = image_processor.apply_enhance_filter(image)
                    filters_applied.append('enhance')
                elif filter_name == 'retro':
                    image = image_processor.apply_retro_filter(image)
                    filters_applied.append('retro')
        
        # Create metadata
        metadata = PhotoMetadata(
            id=image_id,
            filename=file.filename,
            timestamp=datetime.now(),
            filters_applied=filters_applied,
            dimensions=original_size,
            file_size=file_size
        )
        
        # Extract features for vector database
        image_features = vector_db.extract_image_features(image)
        image_description = vector_db.generate_image_description(metadata)
        
        # Convert processed image to base64 for storage and return
        img_buffer = io.BytesIO()
        image.save(img_buffer, format='PNG')
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
        
        # Store in vector database
        collection.add(
            embeddings=[image_features],
            documents=[image_description],
            metadatas=[{
                **asdict(metadata),
                'timestamp': metadata.timestamp.isoformat(),
                'session_id': session_id,
                'image_data': img_base64
            }],
            ids=[image_id]
        )
        
        return JSONResponse({
            "success": True,
            "image_id": image_id,
            "session_id": session_id,
            "filters_applied": filters_applied,
            "processed_image": f"data:image/png;base64,{img_base64}",
            "metadata": {
                "dimensions": original_size,
                "file_size": file_size,
                "timestamp": metadata.timestamp.isoformat()
            }
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@app.post("/create-photostrip/")
async def create_photostrip(session_id: str = Form(...)):
    """Create a photostrip from images in a session"""
    
    try:
        # Query vector database for images from this session
        results = collection.get(
            where={"session_id": session_id},
            include=["metadatas"]
        )
        
        if not results['metadatas']:
            raise HTTPException(status_code=404, detail="No images found for this session")
        
        # Load images from stored base64 data
        images = []
        for metadata in results['metadatas']:
            if 'image_data' in metadata:
                img_data = base64.b64decode(metadata['image_data'])
                image = Image.open(io.BytesIO(img_data))
                images.append(image)
        
        if not images:
            raise HTTPException(status_code=404, detail="No valid images found")
        
        # Create photostrip
        photostrip = strip_generator.create_photostrip(images, session_id)
        
        # Convert to base64
        strip_buffer = io.BytesIO()
        photostrip.save(strip_buffer, format='PNG')
        strip_base64 = base64.b64encode(strip_buffer.getvalue()).decode()
        
        # Store photostrip in vector database
        strip_id = str(uuid.uuid4())
        strip_features = vector_db.extract_image_features(photostrip)
        
        collection.add(
            embeddings=[strip_features],
            documents=[f"Photostrip for session {session_id} containing {len(images)} images"],
            metadatas=[{
                'id': strip_id,
                'type': 'photostrip',
                'session_id': session_id,
                'image_count': len(images),
                'timestamp': datetime.now().isoformat(),
                'image_data': strip_base64
            }],
            ids=[strip_id]
        )
        
        return JSONResponse({
            "success": True,
            "photostrip_id": strip_id,
            "session_id": session_id,
            "image_count": len(images),
            "photostrip": f"data:image/png;base64,{strip_base64}"
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating photostrip: {str(e)}")

@app.get("/search-similar/")
async def search_similar_images(image_id: str, limit: int = 5):
    """Find similar images using vector similarity search"""
    
    try:
        # Get the target image
        target_result = collection.get(
            ids=[image_id],
            include=["embeddings", "metadatas"]
        )
        
        if not target_result['embeddings']:
            raise HTTPException(status_code=404, detail="Image not found")
        
        # Query for similar images
        results = collection.query(
            query_embeddings=[target_result['embeddings'][0]],
            n_results=limit + 1,  # +1 because it will include the target image
            include=["metadatas", "distances"]
        )
        
        # Filter out the target image and prepare response
        similar_images = []
        for i, metadata in enumerate(results['metadatas'][0]):
            if metadata['id'] != image_id:  # Exclude the target image
                similar_images.append({
                    "image_id": metadata['id'],
                    "similarity_score": 1 - results['distances'][0][i],  # Convert distance to similarity
                    "filters_applied": metadata.get('filters_applied', []),
                    "timestamp": metadata.get('timestamp'),
                    "session_id": metadata.get('session_id')
                })
        
        return JSONResponse({
            "success": True,
            "target_image_id": image_id,
            "similar_images": similar_images[:limit]
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error searching similar images: {str(e)}")

@app.get("/get-image/{image_id}")
async def get_image(image_id: str):
    """Retrieve a specific image by ID"""
    
    try:
        result = collection.get(
            ids=[image_id],
            include=["metadatas"]
        )
        
        if not result['metadatas']:
            raise HTTPException(status_code=404, detail="Image not found")
        
        metadata = result['metadatas'][0]
        
        if 'image_data' not in metadata:
            raise HTTPException(status_code=404, detail="Image data not found")
        
        return JSONResponse({
            "success": True,
            "image_id": image_id,
            "image": f"data:image/png;base64,{metadata['image_data']}",
            "metadata": {
                "filename": metadata.get('filename'),
                "filters_applied": metadata.get('filters_applied', []),
                "timestamp": metadata.get('timestamp'),
                "session_id": metadata.get('session_id'),
                "dimensions": metadata.get('dimensions'),
                "type": metadata.get('type', 'single_image')
            }
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving image: {str(e)}")

@app.get("/list-sessions/")
async def list_sessions():
    """List all available sessions"""
    
    try:
        # Get all records
        results = collection.get(include=["metadatas"])
        
        sessions = {}
        for metadata in results['metadatas']:
            session_id = metadata.get('session_id')
            if session_id:
                if session_id not in sessions:
                    sessions[session_id] = {
                        'session_id': session_id,
                        'image_count': 0,
                        'photostrip_count': 0,
                        'latest_timestamp': None
                    }
                
                if metadata.get('type') == 'photostrip':
                    sessions[session_id]['photostrip_count'] += 1
                else:
                    sessions[session_id]['image_count'] += 1
                
                # Update latest timestamp
                timestamp = metadata.get('timestamp')
                if timestamp and (not sessions[session_id]['latest_timestamp'] or timestamp > sessions[session_id]['latest_timestamp']):
                    sessions[session_id]['latest_timestamp'] = timestamp
        
        return JSONResponse({
            "success": True,
            "sessions": list(sessions.values())
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing sessions: {str(e)}")

# NEW: Health check endpoint with API info
@app.get("/api/health")
async def api_health():
    """API health check and info"""
    return {
        "message": "Photobooth API",
        "version": "1.0.0",
        "status": "healthy",
        "endpoints": {
            "GET /": "Main photobooth application",
            "POST /upload-image/": "Upload and process an image with filters",
            "POST /create-photostrip/": "Create photostrip from session images",
            "GET /search-similar/{image_id}": "Find similar images",
            "GET /get-image/{image_id}": "Retrieve specific image",
            "GET /list-sessions/": "List all available sessions",
            "GET /docs": "API documentation"
        },
        "available_filters": ["vintage", "bw", "blur", "enhance", "retro"]
    }

if __name__ == "__main__":
    import uvicorn
    
    # Create necessary directories if they don't exist
    os.makedirs("./photobooth_db", exist_ok=True)
    os.makedirs("./static", exist_ok=True)
    os.makedirs("./templates", exist_ok=True)
    os.makedirs("./uploads", exist_ok=True)
    
    print("🚀 Starting Photobooth Server...")
    print("📸 Main App: http://localhost:8000")
    print("📖 API Docs: http://localhost:8000/docs")
    print("🏥 Health Check: http://localhost:8000/api/health")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)