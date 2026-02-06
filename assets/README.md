# Assets

This folder contains application assets including icons and images.

## Required Icons

For building the application, you need to provide icons in the following formats:

### Windows
- `icon.ico` - Multi-size ICO file (16x16, 32x32, 48x48, 256x256)

### macOS
- `icon.icns` - macOS icon file

### Linux
- `icon.png` - 512x512 PNG image

## Generating Icons

You can use the provided `icon.svg` as a source and convert it using tools like:

1. **ImageMagick** (command line):
   ```bash
   # For PNG
   convert icon.svg -resize 512x512 icon.png
   
   # For ICO (Windows)
   convert icon.svg -resize 256x256 icon.ico
   ```

2. **Online converters**:
   - [CloudConvert](https://cloudconvert.com/svg-to-ico)
   - [ICO Convert](https://icoconvert.com/)

3. **electron-icon-builder** (npm package):
   ```bash
   npm install -g electron-icon-builder
   electron-icon-builder --input=icon.svg --output=./
   ```

## Screenshot

Add a `screenshot.png` for the README documentation showing the application interface.
