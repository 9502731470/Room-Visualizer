import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateRoomEdit(
  floorImgBase64, tileImgBase64, sofaImgBase64, bedImgBase64, colorValue, targetObjects, sofaPlacement 
) {
  let specificTask = "";
  
  // ✅ TASK 1: FLOORING (Only changes if a tile is selected)
  if (tileImgBase64) {
    specificTask += `1. FLOOR: Replace the entire floor area from floor.jpg with the texture in tile.jpg. Ensure perspective and lighting match. `;
  } else {
    specificTask += `1. FLOOR: Do NOT change the floor. Keep the original floor from floor.jpg exactly as it is. `;
  }
  
  // ✅ TASK 2: WALLS (Ensures ALL walls are painted OR none at all)
  if (colorValue) {
    specificTask += `2. WALLS: Repaint EVERY visible wall surface in floor.jpg with the hex color ${colorValue}. 
    - Identify all planes: back walls, side walls, and small sections around the door/window. 
    - It is critical that NO original white/cream wall remains visible. `;
  } else {
    specificTask += `2. WALLS: Do NOT change the wall color. Keep the original walls from floor.jpg exactly as they are. `;
  }

  if (sofaImgBase64) {
    specificTask += `3. FURNITURE: Place the sofa from sofa.jpg ${sofaPlacement}. 
    - WALL SNAPPING: If a wall is specified, the furniture must be flush against it with no visible gap.
    - PERSPECTIVE: The sofa must be skewed and scaled to match the vanishing points of floor.jpg. 
    - REALISM: Ensure it sits naturally on the floor with realistic ambient occlusion and contact shadows where it touches the floor and wall. 
    - DO NOT alter any other part of the room while adding this sofa. `;
  }
  const promptText = `
You are a master interior designer. Your ONLY structural reference is "floor.jpg".
"tile.jpg" is for floor texture. "sofa.jpg" is the furniture.

TASK:
Combine these elements into one photorealistic image following these rules:
${specificTask}
- Maintain all original architectural details (door, trim, switches, windows).
- If no change is requested for walls or floors, they MUST be identical to floor.jpg.
- Lighting on the sofa must match the light source direction in floor.jpg.
- Provide ONLY the final image.
`;


  const cleanBase64 = (str) => (str ? str.replace(/^data:image\/\w+;base64,/, "") : null);
  const inputParts = [{ text: promptText }];

  inputParts.push({
    inlineData: { data: cleanBase64(floorImgBase64), mimeType: "image/jpeg" }
  });

  if (tileImgBase64) {
    inputParts.push({
      inlineData: { data: cleanBase64(tileImgBase64), mimeType: "image/jpeg" }
    });
  }

  const cleanedSofa = cleanBase64(sofaImgBase64);
  if (cleanedSofa) {
    inputParts.push({
      inlineData: { data: cleanedSofa, mimeType: "image/jpeg" }
    });
  }
  
  const cleanedBed = cleanBase64(bedImgBase64); 
  if (cleanedBed) inputParts.push({ inlineData: { data: cleanedBed, mimeType: "image/png" } });

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: inputParts }],
      config: { responseModalities: ["IMAGE"] }
    });

    const imagePart = result.candidates[0].content.parts.find(p => p.inlineData);
    if (imagePart) return imagePart.inlineData.data;
    throw new Error("Did not return an image.");
  } catch (error) {
    console.error("Generation Error:", error.message);
    throw error;
  }
}

export async function getCurrentModel() { 
  return { modelName: "gemini-2.5-flash-image" }; 
}