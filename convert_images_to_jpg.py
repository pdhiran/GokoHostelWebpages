#!/usr/bin/env python3
"""
Convert all images in event directories to JPG format.
Supports: HEIC, PNG, JPEG, JPG, and other common formats.
"""

import os
import sys
from pathlib import Path
from PIL import Image
import glob

def convert_to_jpg(input_path, output_path, quality=85):
    """Convert an image to JPG format."""
    import subprocess
    
    # Try using macOS sips for HEIC files first (faster and more reliable)
    if input_path.suffix.upper() in ('.HEIC', '.HEIF'):
        try:
            result = subprocess.run(
                ['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', str(quality), 
                 str(input_path), '--out', str(output_path)],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0 and output_path.exists():
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
            # Fall back to PIL if sips fails
            pass
    
    # Use PIL for other formats or if sips fails
    try:
        # Register HEIF opener if available
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
        except:
            pass
        
        # Open image
        img = Image.open(input_path)
        
        # Convert RGBA to RGB if necessary (for PNG with transparency)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Create a white background
            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = rgb_img
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Save as JPG
        img.save(output_path, 'JPEG', quality=quality, optimize=True)
        return True
    except Exception as e:
        print(f"Error converting {input_path}: {e}")
        return False

def convert_directory_images(directory_path):
    """Convert all images in a directory to JPG."""
    directory = Path(directory_path)
    if not directory.exists():
        print(f"Directory not found: {directory_path}")
        return []
    
    # Supported input formats
    image_extensions = ['*.heic', '*.HEIC', '*.png', '*.PNG', '*.jpeg', '*.JPEG', '*.jpg', '*.JPG', 
                       '*.webp', '*.WEBP', '*.gif', '*.GIF']
    
    converted_files = []
    
    # Find all image files
    image_files = []
    for ext in image_extensions:
        image_files.extend(directory.glob(ext))
    
    # Filter out already converted JPG files
    image_files = [f for f in image_files if f.suffix.upper() not in ('.JPG', '.JPEG')]
    
    if not image_files:
        print(f"No images to convert in {directory_path}")
        return []
    
    print(f"\nConverting images in {directory_path}:")
    for img_file in image_files:
        # Create output filename (same name, .jpg extension)
        output_file = img_file.with_suffix('.jpg')
        
        # Skip if JPG already exists
        if output_file.exists():
            print(f"  ✓ {img_file.name} -> {output_file.name} (already exists)")
            converted_files.append(str(output_file))
            continue
        
        # Convert
        print(f"  Converting {img_file.name}...", end=' ')
        if convert_to_jpg(img_file, output_file):
            print(f"✓ -> {output_file.name}")
            converted_files.append(str(output_file))
        else:
            print(f"✗ Failed")
    
    return converted_files

def main():
    """Main function to convert all event images."""
    base_dir = Path(__file__).parent / 'new_images'
    
    if not base_dir.exists():
        print(f"Error: {base_dir} directory not found!")
        sys.exit(1)
    
    print("=" * 60)
    print("Image Converter: Converting all images to JPG format")
    print("=" * 60)
    
    # Find all event directories
    event_dirs = [d for d in base_dir.iterdir() if d.is_dir() and d.name.startswith('goko-')]
    
    if not event_dirs:
        print("No event directories found!")
        sys.exit(1)
    
    all_converted = {}
    
    for event_dir in sorted(event_dirs):
        converted = convert_directory_images(event_dir)
        if converted:
            all_converted[event_dir.name] = converted
    
    print("\n" + "=" * 60)
    print("Conversion Summary:")
    print("=" * 60)
    
    for event_name, files in all_converted.items():
        print(f"\n{event_name}:")
        for f in files:
            print(f"  - {Path(f).name}")
    
    print(f"\n✅ Conversion complete! {sum(len(files) for files in all_converted.values())} images ready.")
    print("\nNext step: Update the JavaScript in events.html with these JPG filenames.")

if __name__ == '__main__':
    # Check if PIL/Pillow is installed
    try:
        from PIL import Image
    except ImportError:
        print("Error: PIL/Pillow is not installed!")
        print("Install it with: pip install Pillow")
        print("For HEIC support, also install: pip install pillow-heif")
        sys.exit(1)
    
    main()

