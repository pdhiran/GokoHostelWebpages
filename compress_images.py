#!/usr/bin/env python3
"""
Image Compression Script for Goko Web
Compresses and resizes images in new_images directory to reduce file sizes
while maintaining good quality for web display.
"""

import os
import sys
from pathlib import Path
from PIL import Image
import shutil

# Supported image formats
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'}

# Compression settings
MAX_WIDTH = 1920  # Maximum width for images (Full HD)
MAX_HEIGHT = 1920  # Maximum height for images
JPEG_QUALITY = 85  # JPEG quality (85 is a good balance)
PNG_OPTIMIZE = True  # Optimize PNG files

def compress_image(input_path, output_path, max_width=MAX_WIDTH, max_height=MAX_HEIGHT, quality=JPEG_QUALITY):
    """
    Compress and resize an image file.
    
    Args:
        input_path: Path to input image
        output_path: Path to save compressed image
        max_width: Maximum width in pixels
        max_height: Maximum height in pixels
        quality: JPEG quality (1-100)
    
    Returns:
        tuple: (original_size, compressed_size, saved_bytes, saved_percent)
    """
    try:
        # Open image
        with Image.open(input_path) as img:
            # Convert RGBA to RGB for JPEG
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create white background
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Get original size
            original_width, original_height = img.size
            
            # Calculate new size maintaining aspect ratio
            if original_width > max_width or original_height > max_height:
                ratio = min(max_width / original_width, max_height / original_height)
                new_width = int(original_width * ratio)
                new_height = int(original_height * ratio)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Get original file size
            original_size = os.path.getsize(input_path)
            
            # Save compressed image
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Determine format from extension
            ext = output_path.suffix.lower()
            if ext in ['.jpg', '.jpeg']:
                img.save(output_path, 'JPEG', quality=quality, optimize=True)
            elif ext == '.png':
                img.save(output_path, 'PNG', optimize=PNG_OPTIMIZE)
            else:
                # Default to JPEG
                output_path = output_path.with_suffix('.jpg')
                img.save(output_path, 'JPEG', quality=quality, optimize=True)
            
            # Get compressed file size
            compressed_size = os.path.getsize(output_path)
            saved_bytes = original_size - compressed_size
            saved_percent = (saved_bytes / original_size * 100) if original_size > 0 else 0
            
            return (original_size, compressed_size, saved_bytes, saved_percent)
    
    except Exception as e:
        print(f"Error compressing {input_path}: {e}")
        return None

def format_size(size_bytes):
    """Format bytes to human readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"

def process_directory(directory, backup=True):
    """
    Process all images in a directory and subdirectories.
    
    Args:
        directory: Root directory to process
        backup: Whether to create backup of original files
    """
    directory = Path(directory)
    if not directory.exists():
        print(f"Directory not found: {directory}")
        return
    
    total_files = 0
    total_original_size = 0
    total_compressed_size = 0
    total_saved = 0
    
    # Find all image files
    image_files = []
    for ext in IMAGE_EXTENSIONS:
        image_files.extend(directory.rglob(f'*{ext}'))
    
    if not image_files:
        print(f"No image files found in {directory}")
        return
    
    print(f"Found {len(image_files)} image files to process...")
    print("=" * 70)
    
    # Process each image
    for img_path in image_files:
        total_files += 1
        
        # Skip if already processed (check for _compressed suffix)
        if '_compressed' in img_path.stem:
            continue
        
        print(f"\n[{total_files}/{len(image_files)}] Processing: {img_path.relative_to(directory)}")
        
        # Create backup if requested
        if backup:
            backup_path = img_path.with_suffix(img_path.suffix + '.backup')
            if not backup_path.exists():
                shutil.copy2(img_path, backup_path)
                print(f"  Backup created: {backup_path.name}")
        
        # Compress image (overwrite original)
        result = compress_image(img_path, img_path)
        
        if result:
            original_size, compressed_size, saved_bytes, saved_percent = result
            total_original_size += original_size
            total_compressed_size += compressed_size
            total_saved += saved_bytes
            
            print(f"  Original: {format_size(original_size)}")
            print(f"  Compressed: {format_size(compressed_size)}")
            print(f"  Saved: {format_size(saved_bytes)} ({saved_percent:.1f}%)")
        else:
            print(f"  ⚠️  Failed to compress")
    
    # Print summary
    print("\n" + "=" * 70)
    print("COMPRESSION SUMMARY")
    print("=" * 70)
    print(f"Total files processed: {total_files}")
    print(f"Total original size: {format_size(total_original_size)}")
    print(f"Total compressed size: {format_size(total_compressed_size)}")
    print(f"Total saved: {format_size(total_saved)} ({total_saved/total_original_size*100:.1f}%)")
    print("=" * 70)
    
    # Clean up backup files if compression was successful
    if backup and total_saved > 0:
        print("\nBackup files created with .backup extension")
        print("You can delete them after verifying the compressed images look good.")

if __name__ == '__main__':
    # Default to new_images directory
    target_dir = Path('new_images')
    
    # Allow command line argument
    if len(sys.argv) > 1:
        target_dir = Path(sys.argv[1])
    
    if not target_dir.exists():
        print(f"Error: Directory not found: {target_dir}")
        print(f"Usage: python3 compress_images.py [directory]")
        sys.exit(1)
    
    print("=" * 70)
    print("GOKO WEB - IMAGE COMPRESSION TOOL")
    print("=" * 70)
    print(f"Target directory: {target_dir.absolute()}")
    print(f"Max dimensions: {MAX_WIDTH}x{MAX_HEIGHT}px")
    print(f"JPEG quality: {JPEG_QUALITY}%")
    print("=" * 70)
    
    # Ask for confirmation
    response = input("\nThis will compress all images in the directory. Continue? (y/n): ")
    if response.lower() != 'y':
        print("Cancelled.")
        sys.exit(0)
    
    # Process directory
    process_directory(target_dir, backup=True)
    
    print("\n✅ Compression complete!")

