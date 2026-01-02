# Room Visualizer 

This is of a room visualizer:
- Top bar with **Add My Room**
- Left **Menu** (Flooring / Walls / Pricing / Rooms)
- Center preview canvas
- Right "Similar Floors" product list

> Note: This is an original implementation. Do not copy Lowe’s assets/code directly.

---

## 1) Prerequisites
- Node.js 18+ (recommended)
- npm

## 2) Install
```bash
npm install
```

## 3) Run (dev)
```bash
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173)

## 4) How to use
1. Click **Add My Room** (top-right) and upload a room photo.
2. Click any item in **Similar Floors** to apply a repeating texture overlay.
3. Adjust:
   - Opacity (left panel)
   - Floor rectangle X/Y/W/H (left panel)
4. Click **Save Image** to download a PNG.

## 5) Replace demo products with real catalog
In `src/App.tsx`, replace the `products` list with your API results:
- `thumbDataUrl` = thumbnail URL
- `textureDataUrl` = repeating texture URL (ideally seamless)

## 6) Next improvements (recommended)
- Polygon floor selection (click points)
- Floor masking (OpenCV / segmentation model)
- Perspective warp (canvas drawImage with transform pipeline)
