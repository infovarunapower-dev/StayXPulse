#!/usr/bin/env python3
"""
StayXPulse Brand Rename Script
Replaces all HotelIQ references with StayXPulse across the entire project
Run from your project root: python3 rename_brand.py
"""

import os
import sys

# ── Replacements (order matters — longest first) ──────────────────────────────
REPLACEMENTS = [
    # Brand name variations
    ('HotelIQ',          'StayXPulse'),
    ('hoteliq',          'stayxpulse'),
    ('HOTELIQ',          'STAYXPULSE'),
    ('Hotel IQ',         'StayXPulse'),
    ('hotel-iq',         'stayxpulse'),

    # Package names
    ('hoteliq-frontend', 'stayxpulse-frontend'),
    ('hoteliq-backend',  'stayxpulse-backend'),

    # Email references
    ('support@hoteliq.com',   'support@stayxpulse.com'),
    ('noreply@hoteliq.com',   'noreply@stayxpulse.com'),
    ('www.hoteliq.com',       'www.stayxpulse.com'),

    # DB name
    ('mongodb://localhost:27017/hoteliq', 'mongodb://localhost:27017/stayxpulse'),

    # PM2 process name
    ('hoteliq-backend',  'stayxpulse-backend'),

    # Page titles
    ('HotelIQ — Smart Hotel Management', 'StayXPulse — Smart Hotel Management'),
    ('Smart Hotel Management Platform',   'Smart Hotel Management Platform'),
]

# ── File extensions to process ────────────────────────────────────────────────
EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.json', '.env', '.md', '.html', '.css', '.conf', '.sh'}

# ── Folders to skip ───────────────────────────────────────────────────────────
SKIP_DIRS = {'node_modules', '.git', 'build', 'dist', '.next', 'coverage', '__pycache__'}

def rename_in_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        original = content
        for old, new in REPLACEMENTS:
            content = content.replace(old, new)
        
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"  ⚠️  Could not process {filepath}: {e}")
        return False

def process_directory(root_dir):
    changed = []
    skipped = []
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip unwanted directories
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in EXTENSIONS:
                continue
            
            filepath = os.path.join(dirpath, filename)
            rel_path = os.path.relpath(filepath, root_dir)
            
            if rename_in_file(filepath):
                changed.append(rel_path)
                print(f"  ✅ {rel_path}")
            else:
                skipped.append(rel_path)
    
    return changed, skipped

def main():
    # Run from project root (where backend/ and frontend/ folders are)
    root = os.getcwd()
    
    print("\n" + "="*55)
    print("  StayXPulse Brand Rename")
    print("  HotelIQ → StayXPulse")
    print("="*55)
    print(f"\n📁 Processing: {root}\n")
    
    # Check we're in the right place
    if not os.path.exists(os.path.join(root, 'backend')) and \
       not os.path.exists(os.path.join(root, 'frontend')):
        print("❌ ERROR: Run this script from your project root folder")
        print("   (the folder that contains 'backend' and 'frontend')")
        sys.exit(1)
    
    changed, skipped = process_directory(root)
    
    print("\n" + "="*55)
    print(f"  ✅ Files updated : {len(changed)}")
    print(f"  ⏭  Files skipped : {len(skipped)}")
    print("="*55)
    print("\n🎉 Brand rename complete!")
    print("\nNext steps:")
    print("  1. Update browser tab title in frontend/public/index.html")
    print("  2. Update app name in frontend/package.json")
    print("  3. Restart backend: npm run dev")
    print("  4. Restart frontend: npm start")
    print("  5. Clear browser cache (Ctrl+Shift+R)\n")

if __name__ == '__main__':
    main()
