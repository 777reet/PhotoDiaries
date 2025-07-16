import os
from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import uuid
from datetime import datetime

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create necessary directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)
os.makedirs('static', exist_ok=True)
os.makedirs('templates', exist_ok=True) # Ensure templates directory exists

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_vintage_photobooth_strip(image_paths, output_path, color_mode='bw', frame_style='classic'):
    """
    Create a vintage photobooth strip from 4 images with enhanced options.
    """
    strip_width = 700  # Slightly wider for more aesthetic borders
    strip_height = 2800 # Taller to accommodate more details
    photo_width = 580
    photo_height = 580

    # Vintage cream or soft pastel background
    background_color = '#FAEBD7' # Antique White

    strip = Image.new('RGB', (strip_width, strip_height), color=background_color)
    draw = ImageDraw.Draw(strip)

    processed_images = []

    for i, image_path in enumerate(image_paths):
        if not os.path.exists(image_path):
            continue

        img = Image.open(image_path).convert('RGB')
        img.thumbnail((photo_width, photo_height), Image.Resampling.LANCZOS)

        square_img = Image.new('RGB', (photo_width, photo_height), color='white')
        paste_x = (photo_width - img.width) // 2
        paste_y = (photo_height - img.height) // 2
        square_img.paste(img, (paste_x, paste_y))

        # Apply selected vintage effects
        square_img = apply_vintage_effects(square_img, color_mode)
        processed_images.append(square_img)

    # Position images on the strip
    y_positions = [150, 750, 1350, 1950]  # Adjusted positions for 4 photos

    for i, img in enumerate(processed_images):
        if i < len(y_positions):
            x = (strip_width - photo_width) // 2
            y = y_positions[i]
            strip.paste(img, (x, y))
            # Add subtle frame around each photo
            if frame_style == 'polaroid':
                add_polaroid_frame(strip, draw, x, y, photo_width, photo_height)
            else: # Classic border
                draw.rectangle([x-5, y-5, x+photo_width+5, y+photo_height+5], outline='#A9A9A9', width=3)


    # Add vintage photobooth branding/text with Sabrina Carpenter flair
    add_sabrina_branding(strip, strip_width, strip_height)

    strip.save(output_path, 'JPEG', quality=90)
    return output_path

def apply_vintage_effects(image, color_mode):
    """
    Apply vintage effects (sepia, grayscale, grain, slight blur)
    """
    if color_mode == 'bw':
        image = image.convert('L').convert('RGB') # Convert to grayscale then back to RGB for tinting
    elif color_mode == 'sepia':
        image = apply_sepia_tint(image)

    # Adjust contrast and brightness
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.1) # Slightly less contrast for softer look

    enhancer = ImageEnhance.Brightness(image)
    image = enhancer.enhance(0.95) # A touch darker

    # Add slight blur for soft vintage feel
    image = image.filter(ImageFilter.GaussianBlur(radius=0.7))

    # Add noise/grain effect
    image = add_grain_effect(image)

    return image

def apply_sepia_tint(image):
    """Applies a sepia tone to an image."""
    width, height = image.size
    pixels = image.load()
    for py in range(height):
        for px in range(width):
            r, g, b = pixels[px, py]
            tr = int(0.393 * r + 0.769 * g + 0.189 * b)
            tg = int(0.349 * r + 0.686 * g + 0.168 * b)
            tb = int(0.272 * r + 0.534 * g + 0.131 * b)
            pixels[px, py] = (min(255, tr), min(255, tg), min(255, tb))
    return image

def add_grain_effect(image):
    """Add film grain effect to image."""
    import random
    pixels = image.load()
    width, height = image.size

    for x in range(width):
        for y in range(height):
            r, g, b = pixels[x, y]
            grain = random.randint(-15, 15) # Less intense grain
            r = max(0, min(255, r + grain))
            g = max(0, min(255, g + grain))
            b = max(0, min(255, b + grain))
            pixels[x, y] = (r, g, b)
    return image

def add_polaroid_frame(strip, draw, x, y, photo_width, photo_height):
    """Adds a Polaroid-style frame around an image."""
    frame_color = (255, 255, 255) # White frame
    top_border = 20
    side_border = 20
    bottom_border = 80 # Thicker bottom border for text

    # Draw the white frame
    draw.rectangle([x - side_border, y - top_border,
                    x + photo_width + side_border, y + photo_height + bottom_border],
                   fill=frame_color)
    # Paste the image onto the frame
    img_to_paste = strip.crop((x, y, x + photo_width, y + photo_height))
    strip.paste(img_to_paste, (x, y))

    # Optional: Add a subtle shadow to the polaroid frame
    draw.line([x - side_border, y + photo_height + bottom_border,
               x + photo_width + side_border, y + photo_height + bottom_border], fill=(200, 200, 200), width=5)
    draw.line([x + photo_width + side_border, y - top_border,
               x + photo_width + side_border, y + photo_height + bottom_border], fill=(200, 200, 200), width=5)


def add_sabrina_branding(strip, width, height):
    """
    Add Sabrina Carpenter inspired branding and date.
    """
    draw = ImageDraw.Draw(strip)

    # Attempt to load a custom font for the Sabrina Carpenter aesthetic
    # Make sure 'static/sabrina-font.ttf' exists or change to a web-safe font
    try:
        font_path = os.path.join('static', 'sabrina-font.ttf')
        if not os.path.exists(font_path):
            # Fallback to a more generic script font if custom font not found
            font_path = "arialbd.ttf" # Bold Arial as a common fallback
        font_large = ImageFont.truetype(font_path, 60)
        font_medium = ImageFont.truetype(font_path, 40)
        font_small = ImageFont.truetype(font_path, 30)
    except Exception:
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    text_color = '#4A0E4F' # Deep purple/maroon, inspired by vintage aesthetics

    # Top Branding: "Sabrina's Dream Booth" or similar
    header_text = "Sabrina's Dream Booth ✨"
    bbox_header = draw.textbbox((0, 0), header_text, font=font_large)
    text_width_header = bbox_header[2] - bbox_header[0]
    x_header = (width - text_width_header) // 2
    draw.text((x_header, 30), header_text, fill=text_color, font=font_large)

    # Add a romantic/vintage quote
    quote = "Capture your sweetest moments."
    bbox_quote = draw.textbbox((0, 0), quote, font=font_medium)
    text_width_quote = bbox_quote[2] - bbox_quote[0]
    x_quote = (width - text_width_quote) // 2
    draw.text((x_quote, 90), quote, fill=text_color, font=font_medium)


    # Bottom Branding: Date and a fun tagline
    date_text = datetime.now().strftime("%B %d, %Y")
    bbox_date = draw.textbbox((0, 0), date_text, font=font_small)
    text_width_date = bbox_date[2] - bbox_date[0]
    x_date = (width - text_width_date) // 2
    draw.text((x_date, height - 100), date_text, fill=text_color, font=font_small)

    tagline = "#VintageVibes"
    bbox_tagline = draw.textbbox((0, 0), tagline, font=font_small)
    text_width_tagline = bbox_tagline[2] - bbox_tagline[0]
    x_tagline = (width - text_width_tagline) // 2
    draw.text((x_tagline, height - 60), tagline, fill=text_color, font=font_small)

    # Decorative elements
    # Add subtle heart or star elements
    try:
        # Assuming you have a small decorative font or can draw shapes
        # For simplicity, we'll draw small circles/stars
        star_char = "★"
        heart_char = "♡"
        draw.text((50, 40), star_char, fill=text_color, font=font_medium)
        draw.text((width - 80, 40), heart_char, fill=text_color, font=font_medium)
    except:
        pass # If special characters don't render, just skip

    # Add a thin, elegant border around the entire strip
    border_color = '#C0C0C0' # Silver or light gray
    draw.rectangle([10, 10, width - 10, height - 10], outline=border_color, width=5)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_files():
    if 'photos' not in request.files:
        return jsonify({'error': 'No photos uploaded'}), 400

    files = request.files.getlist('photos')

    if len(files) != 4:
        return jsonify({'error': 'Please upload exactly 4 photos'}), 400

    saved_files = []
    session_id = str(uuid.uuid4())

    for i, file in enumerate(files):
        if file and allowed_file(file.filename):
            filename = f"{session_id}_{i}.jpg"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            saved_files.append(filepath)
        else:
            # If any file is invalid, clean up already saved files and return error
            for fp in saved_files:
                if os.path.exists(fp):
                    os.remove(fp)
            return jsonify({'error': 'All files must be valid images (PNG, JPG, JPEG, GIF) and under 16MB each.'}), 400

    if len(saved_files) != 4:
        return jsonify({'error': 'Failed to save all 4 valid images.'}), 400

    output_filename = f"photobooth_strip_{session_id}.jpg"
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], output_filename)

    try:
        color_mode = request.form.get('color_mode', 'bw')
        frame_style = request.form.get('frame_style', 'classic')
        create_vintage_photobooth_strip(saved_files, output_path, color_mode, frame_style)

        # Clean up uploaded files
        for file_path in saved_files:
            if os.path.exists(file_path):
                os.remove(file_path)

        return jsonify({
            'success': True,
            'image_url': f'/preview/{output_filename}',
            'download_url': f'/download/{output_filename}', # Separate download URL
            'session_id': session_id
        })

    except Exception as e:
        # Log the error for debugging
        app.logger.error(f"Error processing images: {e}", exc_info=True)
        return jsonify({'error': f'Oops! Something went wrong while creating your strip: {str(e)}. Please try again!'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    file_path = os.path.join(app.config['PROCESSED_FOLDER'], filename)
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)
    return "File not found", 404

@app.route('/preview/<filename>')
def preview_file(filename):
    file_path = os.path.join(app.config['PROCESSED_FOLDER'], filename)
    if os.path.exists(file_path):
        return send_file(file_path, mimetype='image/jpeg') # Ensure correct MIME type
    return "File not found", 404

if __name__ == '__main__':
    app.run(debug=True)