import os
from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import uuid
from datetime import datetime
import random # Needed for grain and glitter effects

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

def create_vintage_photobooth_strip(image_paths, output_path, color_mode='bw', frame_style='classic', effect_filter='none'):
    """
    Create a vintage photobooth strip from 4 images with enhanced options.
    """
    strip_width = 700  # Slightly wider for more aesthetic borders
    strip_height = 2800 # Taller to accommodate more details
    photo_width = 580
    photo_height = 580

    # Vintage cream or soft pastel background
    background_color = '#FAEBD7' # Antique White (matches Sabrina's vibe)

    strip = Image.new('RGB', (strip_width, strip_height), color=background_color)
    draw = ImageDraw.Draw(strip)

    # --- Handle varying number of input images ---
    processed_image_objects = [] # Store PIL Image objects
    
    # Open all provided images first
    for image_path in image_paths:
        if os.path.exists(image_path):
            img = Image.open(image_path).convert('RGB')
            processed_image_objects.append(img)
    
    # If fewer than 4 images were uploaded, duplicate the last one
    num_uploaded = len(processed_image_objects)
    if num_uploaded == 0:
        raise ValueError("No valid images provided for strip creation.")
        
    if num_uploaded < 4:
        # Use the last image uploaded to fill the remaining slots
        last_image = processed_image_objects[-1] 
        for _ in range(4 - num_uploaded):
            processed_image_objects.append(last_image.copy())
    # --- End image duplication logic ---

    final_images_for_strip = []
    for img_obj in processed_image_objects:
        # Resize/thumbnail the image while maintaining aspect ratio
        img_obj.thumbnail((photo_width, photo_height), Image.Resampling.LANCZOS)

        # Create a square canvas for the image
        square_img = Image.new('RGB', (photo_width, photo_height), color='white')
        paste_x = (photo_width - img_obj.width) // 2
        paste_y = (photo_height - img_obj.height) // 2
        square_img.paste(img_obj, (paste_x, paste_y))

        # Apply selected vintage effects (color mode, grain, blur)
        square_img = apply_vintage_effects(square_img, color_mode)
        
        # Apply new special effects/filters
        if effect_filter == 'glitter':
            square_img = apply_glitter_effect(square_img)
        elif effect_filter == 'bokeh':
            square_img = apply_bokeh_effect(square_img)
        
        final_images_for_strip.append(square_img)

    # Position images on the strip
    # These Y positions give space for branding at top/bottom and between photos
    y_positions = [150, 750, 1350, 1950] 

    for i, img in enumerate(final_images_for_strip):
        if i < len(y_positions):
            x = (strip_width - photo_width) // 2
            y = y_positions[i]
            strip.paste(img, (x, y))
            
            # Add subtle frame around each photo based on style
            if frame_style == 'polaroid':
                add_polaroid_frame(strip, x, y, photo_width, photo_height)
            elif frame_style == 'distressed': # New distressed frame style
                add_distressed_frame(strip, x, y, photo_width, photo_height)
            else: # Classic border (default)
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

    # Adjust contrast and brightness for a softer, vintage look
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(0.9) # Slightly reduced contrast

    enhancer = ImageEnhance.Brightness(image)
    image = enhancer.enhance(1.05) # A touch brighter

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
    pixels = image.load()
    width, height = image.size

    for x in range(width):
        for y in range(height):
            r, g, b = pixels[x, y]
            grain = random.randint(-10, 10) # Finer, less intense grain
            r = max(0, min(255, r + grain))
            g = max(0, min(255, g + grain))
            b = max(0, min(255, b + grain))
            pixels[x, y] = (r, g, b)
    return image

def add_polaroid_frame(strip, x, y, photo_width, photo_height):
    """Adds a Polaroid-style frame around an image."""
    draw = ImageDraw.Draw(strip)
    frame_color = (255, 255, 255) # White frame
    top_border = 20
    side_border = 20
    bottom_border = 80 # Thicker bottom border for text

    # Draw the white frame
    draw.rectangle([x - side_border, y - top_border,
                    x + photo_width + side_border, y + photo_height + bottom_border],
                    fill=frame_color)
    # Paste the image onto the frame area
    img_to_paste = strip.crop((x, y, x + photo_width, y + photo_height))
    strip.paste(img_to_paste, (x, y))

    # Optional: Add a subtle shadow to the polaroid frame
    draw.line([x - side_border, y + photo_height + bottom_border,
               x + photo_width + side_border, y + photo_height + bottom_border], fill=(200, 200, 200), width=3) # Softer shadow
    draw.line([x + photo_width + side_border, y - top_border,
               x + photo_width + side_border, y + photo_height + bottom_border], fill=(200, 200, 200), width=3)

def add_distressed_frame(strip, x, y, photo_width, photo_height):
    """Adds a distressed, slightly irregular frame around an image."""
    draw = ImageDraw.Draw(strip)
    frame_color = '#C0B2B2' # Muted greyish-brown for distressed look
    border_width = 8 # Slightly thicker for emphasis

    # Draw a rectangle with the distressed color
    draw.rectangle([x - border_width, y - border_width,
                    x + photo_width + border_width, y + photo_height + border_width],
                    fill=frame_color)
    
    # Paste the original image back over, leaving the border
    img_to_paste = strip.crop((x, y, x + photo_width, y + photo_height))
    strip.paste(img_to_paste, (x, y))

    # Add subtle irregularities (simulated cracks/wear) to the border
    # This is a very basic simulation; more advanced effects would involve overlaying textures
    for _ in range(10): # Add a few random "scratches"
        start_x = random.randint(x - border_width, x + photo_width + border_width)
        start_y = random.randint(y - border_width, y + photo_height + border_width)
        end_x = start_x + random.randint(-5, 5)
        end_y = start_y + random.randint(-5, 5)
        draw.line([(start_x, start_y), (end_x, end_y)], fill=(150, 150, 150), width=1)


def apply_glitter_effect(image):
    """Applies a subtle glitter/sparkle overlay."""
    width, height = image.size
    glitter_img = Image.new('RGBA', (width, height), (0, 0, 0, 0)) # Transparent layer
    glitter_draw = ImageDraw.Draw(glitter_img)

    for _ in range(200): # Number of glitter spots
        x = random.randint(0, width)
        y = random.randint(0, height)
        radius = random.randint(1, 3) # Size of glitter speck
        alpha = random.randint(50, 150) # Transparency

        # Randomize glitter color slightly (pink, gold, white)
        color_choices = [(255, 192, 203, alpha), (255, 215, 0, alpha), (255, 255, 255, alpha)] # Pink, Gold, White
        glitter_color = random.choice(color_choices)

        glitter_draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=glitter_color)
    
    # Composite the glitter layer onto the original image
    image = Image.alpha_composite(image.convert('RGBA'), glitter_img).convert('RGB')
    return image

def apply_bokeh_effect(image):
    """Applies a soft bokeh blur to the background (simplified for a single image)."""
    # For a true bokeh effect, you'd need depth maps or object detection
    # This is a simplification: apply a subtle radial blur or a general soft blur
    width, height = image.size
    
    # Create a gradient mask for radial blur effect (simulated)
    mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    for i in range(min(width, height) // 2):
        alpha = int(255 * (i / (min(width, height) // 2))**2) # Quadratic falloff
        mask_draw.ellipse([i, i, width - i, height - i], fill=alpha)
    
    # Invert mask for blur to be stronger towards edges
    mask = ImageEnhance.Brightness(mask).enhance(-1.0).convert("L")

    # Apply a larger Gaussian blur to the image
    blurred_image = image.filter(ImageFilter.GaussianBlur(radius=5)) # Adjust radius for intensity

    # Blend the original image with the blurred image using the mask
    # This is an approximation; true bokeh is more complex.
    # We'll blend the original image with the blurred version based on a soft mask
    image = Image.composite(image, blurred_image, mask)

    # You could also just apply a very subtle overall Gaussian blur for a "soft dream" effect
    # image = image.filter(ImageFilter.GaussianBlur(radius=2)) 

    return image


def add_sabrina_branding(strip, width, height):
    """
    Add Sabrina Carpenter inspired branding and date.
    """
    draw = ImageDraw.Draw(strip)

    # Attempt to load a custom font for the Sabrina Carpenter aesthetic
    # Make sure 'static/GrandHotel-Regular.ttf' (or similar) exists
    # If using 'GrandHotel', it's often a .ttf file.
    # Fallback to a common script-like font if custom font not found
    try:
        font_path = os.path.join('static', 'GrandHotel-Regular.ttf') # Assuming you downloaded this font
        if not os.path.exists(font_path):
            # Fallback to a system font that is likely to be present and has a script/cursive style
            # On Windows, "Script MT Bold", "Brush Script MT" might be available.
            # On Linux/macOS, "Chalkboard", "Zapfino" are options.
            # For cross-platform safety, 'arial.ttf' is very common, but less aesthetic.
            # Let's try to simulate 'Grand Hotel' with something widely available or a sensible default.
            # For simplicity, if GrandHotel isn't there, we'll use a standard serif font which looks okay
            # or you can specifically instruct users to add GrandHotel-Regular.ttf to the static folder.
            font_path = ImageFont.load_default() # Fallback to PIL's default if custom not found/specified.
            # A better fallback if you have control over the system fonts:
            # font_path = "C:/Windows/Fonts/BRUSHSCI.TTF" # Example for Windows Brush Script MT
            app.logger.warning(f"Custom font {os.path.join('static', 'GrandHotel-Regular.ttf')} not found. Using default/fallback font.")
        else:
            font_large = ImageFont.truetype(font_path, 60)
            font_medium = ImageFont.truetype(font_path, 40)
            font_small = ImageFont.truetype(font_path, 30)
            
    except Exception as e:
        app.logger.error(f"Error loading custom font: {e}. Using default PIL font.", exc_info=True)
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # If font_large/medium/small are not set due to fallback, set them
    if not isinstance(font_large, ImageFont.FreeTypeFont): # Check if it's a loaded .ttf font
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()


    text_color = '#4A0E4F' # Deep plum, inspired by the Sabrina UI

    # Helper to calculate text width safely (handling older Pillow versions)
    def get_text_width(text, font):
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
            return bbox[2] - bbox[0]
        except AttributeError: # Fallback for older Pillow versions
            return draw.textlength(text, font=font)

    # Top Branding: "Sabrina's Dream Booth" or similar
    header_text = "Sabrina's Dream Booth ✨"
    text_width_header = get_text_width(header_text, font_large)
    x_header = (width - text_width_header) // 2
    draw.text((x_header, 30), header_text, fill=text_color, font=font_large)

    # Add a romantic/vintage quote
    quote = "Capture your sweetest moments."
    text_width_quote = get_text_width(quote, font_medium)
    x_quote = (width - text_width_quote) // 2
    draw.text((x_quote, 90), quote, fill=text_color, font=font_medium)

    # Bottom Branding: Date and a fun tagline
    date_text = datetime.now().strftime("%B %d, %Y")
    text_width_date = get_text_width(date_text, font_small)
    x_date = (width - text_width_date) // 2
    draw.text((x_date, height - 100), date_text, fill=text_color, font=font_small)

    tagline = "#VintageVibes"
    text_width_tagline = get_text_width(tagline, font_small)
    x_tagline = (width - text_width_tagline) // 2
    draw.text((x_tagline, height - 60), tagline, fill=text_color, font=font_small)

    # Decorative elements
    # Add subtle heart or star elements
    try:
        star_char = "★"
        heart_char = "♡"
        star_width = get_text_width(star_char, font_medium)
        heart_width = get_text_width(heart_char, font_medium)

        draw.text((50, 40), star_char, fill=text_color, font=font_medium)
        draw.text((width - 50 - heart_width, 40), heart_char, fill=text_color, font=font_medium)
    except Exception as e:
        app.logger.warning(f"Could not render decorative characters: {e}")
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
        return jsonify({'error': 'No photos uploaded. Please select your magical moments!'}), 400

    files = request.files.getlist('photos')

    # Validate the number of files (1 to 4)
    if not (1 <= len(files) <= 4):
        return jsonify({'error': f'Please upload between 1 and 4 photos. You sent {len(files)}.'}), 400

    saved_files = []
    session_id = str(uuid.uuid4())

    for i, file in enumerate(files):
        if file and allowed_file(file.filename):
            filename = f"{session_id}_{i}.jpg"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            try:
                # Open image with PIL to check for corruption/validity before saving
                img_check = Image.open(file.stream)
                img_check.verify() # Verify if it's a valid image file
                # Reset stream position after verification
                file.stream.seek(0) 
                file.save(filepath)
                saved_files.append(filepath)
            except Exception as e:
                app.logger.error(f"File verification/saving failed for {file.filename}: {e}", exc_info=True)
                # If any file is invalid, clean up already saved files and return error
                for fp in saved_files:
                    if os.path.exists(fp):
                        os.remove(fp)
                return jsonify({'error': f'Failed to process file "{file.filename}". It might be corrupted or an unsupported format.'}), 400
        else:
            for fp in saved_files:
                if os.path.exists(fp):
                    os.remove(fp)
            return jsonify({'error': 'All files must be valid images (PNG, JPG, JPEG, GIF) and under 16MB each.'}), 400

    output_filename = f"photobooth_strip_{session_id}.jpg"
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], output_filename)

    try:
        color_mode = request.form.get('color_mode', 'bw')
        frame_style = request.form.get('frame_style', 'classic')
        effect_filter = request.form.get('effect_filter', 'none') # Get the new effect filter

        create_vintage_photobooth_strip(saved_files, output_path, color_mode, frame_style, effect_filter)

        # Clean up uploaded files
        for file_path in saved_files:
            if os.path.exists(file_path):
                os.remove(file_path)

        return jsonify({
            'success': True,
            'image_url': f'/preview/{output_filename}',
            'download_url': f'/download/{output_filename}',
            'session_id': session_id
        })

    except Exception as e:
        app.logger.error(f"Error processing images: {e}", exc_info=True)
        # Clean up uploaded files even if processing fails
        for file_path in saved_files:
            if os.path.exists(file_path):
                os.remove(file_path)
        return jsonify({'error': f'Oops! Something went wrong while conjuring your strip: {str(e)}. Please try again!'}), 500

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
        return send_file(file_path, mimetype='image/jpeg')
    return "File not found", 404

if __name__ == '__main__':
    app.run(debug=True)