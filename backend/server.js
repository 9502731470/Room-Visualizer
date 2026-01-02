import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { generateRoomEdit, getCurrentModel } from "./gemini.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// ✅ High limit to handle multiple high-res Base64 images
app.use(express.json({ limit: "50mb" }));  

const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath, { fallthrough: true }));

// --- API ROUTES ---

app.post("/api/edit-room", async (req, res) => {
    try {
        const { 
            floorImgBase64,      // Base Room
            tileImgBase64,       // ✅ Selected Tile Texture
            sofaImgBase64,
            bedImgBase64,
            colorValue,
            targetObjects,
            sofaPlacement
        } = req.body;

        if (!floorImgBase64) {
            return res.status(400).json({ error: "Missing floorImgBase64." });
        }

        // ✅ Calls the blending logic
        const editedImage = await generateRoomEdit(
            floorImgBase64, 
            tileImgBase64 || null, 
            sofaImgBase64 || null, 
            bedImgBase64 || null, 
            colorValue || null, 
            targetObjects,
            sofaPlacement
        );

        res.json({ success: true, image: editedImage });

    } catch (err) {
        console.error("Server Design Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/current-model", async (req, res) => {
    try {
      const modelInfo = await getCurrentModel();
      res.json({ success: true, currentModel: modelInfo.modelName });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));