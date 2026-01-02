import { useMemo, useState } from "react";
import { Stage, Layer, Image as KImage, Rect } from "react-konva";

type Tab = "flooring" | "walls" | "pricing" | "rooms";

type Product = {
  id: string;
  name: string;
  subtitle?: string;
  thumbDataUrl: string;
  textureDataUrl: string;
};

// --- Helper Functions ---

function useHtmlImage(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useMemo(() => {
    if (!src) return;
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);
  return img;
}

async function imageToBase64(imageSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context error"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

function PatternFill({
  x, y, w, h, texture,
  opacity = 1,
}: { x: number; y: number; w: number; h: number; texture?: HTMLImageElement | null; opacity?: number }) {
  return (
    <Rect
      x={x}
      y={y}
      width={w}
      height={h}
      opacity={opacity}
      listening={false}
      fillPatternImage={texture ?? undefined}
      fillPatternRepeat="repeat"
      fillPatternScaleX={texture ? 0.35 : 1}
      fillPatternScaleY={texture ? 0.35 : 1}
    />
  );
}

// --- Main Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("flooring");
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  // Selection States
  const [roomSrc, setRoomSrc] = useState<string | null>(null);
  const roomImg = useHtmlImage(roomSrc ?? undefined);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedWallColor, setSelectedWallColor] = useState<string | null>(null);
  const [selectedSofaId, setSelectedSofaId] = useState<string | null>(null);
  const [sofaPos, setSofaPos] = useState<{ x: number; y: number } | null>(null);
  
  const [generatedImageSrc, setGeneratedImageSrc] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Overlay States
  const [floorRect, setFloorRect] = useState({ x: 190, y: 340, w: 520, h: 260 });
  const [overlayOpacity, setOverlayOpacity] = useState(0.82);

  const wallColors = [
    { name: "Red", hex: "#EF4444" },
    { name: "Green", hex: "#10B981" },
    { name: "Blue", hex: "#3B82F6" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Yellow", hex: "#FBBF24" }
  ];

  const products: Product[] = useMemo(() => {
    const mkGrid = (a: string, b: string) =>
      `data:image/svg+xml;utf8,` +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><rect width="140" height="140" fill="${a}"/><path d="M0 35H140M0 70H140M0 105H140" stroke="${b}" stroke-width="6" opacity="0.35"/><path d="M35 0V140M70 0V140M105 0V140" stroke="${b}" stroke-width="6" opacity="0.25"/></svg>`
      );
    return [
      { id: "p1", name: "Warm Stone Tile", subtitle: "Matte • 12x12", thumbDataUrl: mkGrid("#d7d2c7", "#6b5b4a"), textureDataUrl: mkGrid("#d7d2c7", "#6b5b4a") },
      { id: "p2", name: "Cool Slate Tile", subtitle: "Textured • 24x24", thumbDataUrl: mkGrid("#cfd7db", "#2f4858"), textureDataUrl: mkGrid("#cfd7db", "#2f4858") },
      { id: "p3", name: "Classic Oak", subtitle: "Plank • Natural", thumbDataUrl: mkGrid("#d0a77f", "#6b3e1e"), textureDataUrl: mkGrid("#d0a77f", "#6b3e1e") },
      { id: "p4", name: "Modern Ash", subtitle: "Plank • Light", thumbDataUrl: mkGrid("#bfc4b8", "#475342"), textureDataUrl: mkGrid("#bfc4b8", "#475342") },
    ];
  }, []);

  const sofas = [
    { id: "s1", name: "Small Sized Sofa", thumb: "/images/sofa_image.png" },
    { id: "s2", name: "Medium Sized Sofa", thumb: "/images/sofa_image1.jpg" },
    { id: "s3", name: "Large Sized Sofa", thumb: "/images/sofa_image2.png" },
  ];

  const selectedProduct = products.find(p => p.id === selectedProductId) ?? null;
  const textureImg = useHtmlImage(selectedProduct?.textureDataUrl);

  // ✅ Triggered when user picks a sofa from the menu
  const handleSofaSelect = (sofaId: string) => {
    setSelectedSofaId(sofaId);
    setSofaPos(null); // Clear position to show instruction prompt
    setGeneratedImageSrc(null); // Return to original image so user sees where to click
  };

  // ✅ Triggered when user clicks the floor to place the selected sofa
  const handleStageClick = (e: any) => {
    if (!selectedSofaId || !roomSrc) return;
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (pointerPos) {
      const coords = { x: Math.round(pointerPos.x), y: Math.round(pointerPos.y) };
      setSofaPos(coords);
      performAiUpdate(selectedProductId, selectedWallColor, selectedSofaId, coords);
    }
  };

  async function performAiUpdate(pId: string | null, wColor: string | null, sId: string | null, coords?: { x: number, y: number } | null) {
    if (!roomSrc) return;
    setIsGenerating(true);
    try {
      const roomBase64 = await imageToBase64(roomSrc);
      const prod = products.find(p => p.id === pId);
      const tileBase64 = prod ? await imageToBase64(prod.textureDataUrl) : null;
      const sObj = sofas.find(s => s.id === sId);
      const sofaBase64 = sObj ? await imageToBase64(sObj.thumb) : null;


      let sofaPlacementDescription = "centered in the room";
      if (coords) {
        const stageWidth = 1200; // Based on your VisualizerStage width
        const side = coords.x < stageWidth / 2 ? "LEFT" : "RIGHT";
        
        // Construct a detailed instruction for the AI
        sofaPlacementDescription = `at coordinates X: ${coords.x}, Y: ${coords.y}. 
        It MUST be placed flush against the ${side} wall, aligned parallel to that wall's perspective. 
        The back of the sofa should touch the ${side} wall, facing the center of the room.`;

      }
      const response = await fetch("http://localhost:5000/api/edit-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floorImgBase64: roomBase64,
          tileImgBase64: tileBase64,
          sofaImgBase64: sofaBase64,
          colorValue: wColor,
          targetObjects: "both",
          sofaPlacement: sofaPlacementDescription
        }),
      });
      const data = await response.json();
      if (data.success && data.image) {
        setGeneratedImageSrc(`data:image/jpeg;base64,${data.image}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col font-sans">
      <header className="h-14 border-b bg-white flex items-center px-6 justify-between z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-black" />
          <span className="font-bold text-sm uppercase tracking-tight">Room Visualizer</span>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-1.5 border rounded text-xs font-medium" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? "Hide Menu" : "Show Menu"}
          </button>
          <label className="px-4 py-1.5 bg-black text-white rounded text-xs font-medium cursor-pointer">
            Add My Room
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setRoomSrc(URL.createObjectURL(f));
                setGeneratedImageSrc(null);
                setSelectedProductId(null);
                setSelectedSofaId(null);
                setSelectedWallColor(null);
                setSofaPos(null);
              }
            }} />
          </label>
        </div>
      </header>
      
      <div className="flex flex-1 min-h-0">
        <aside className={`${isMenuOpen ? "w-72" : "w-0"} border-r bg-white transition-all overflow-hidden flex-shrink-0`}>
          <div className="p-4 w-72 h-full flex flex-col">
            <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-4">Menu</div>
            <nav className="space-y-1 mb-8">
              <MenuItem label="Flooring" active={activeTab === "flooring"} onClick={() => setActiveTab("flooring")} />
              <div>
                <MenuItem label="Walls" active={activeTab === "walls"} onClick={() => setActiveTab("walls")} />
                {activeTab === "walls" && (
                  <div className="mt-2 ml-2 space-y-1 border-l-2 border-neutral-100 pl-2">
                    {wallColors.map((color) => (
                      <button key={color.name} onClick={() => { setSelectedWallColor(color.hex); performAiUpdate(selectedProductId, color.hex, selectedSofaId, sofaPos); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs hover:bg-neutral-50 ${selectedWallColor === color.hex ? "bg-neutral-100 font-bold" : ""}`}>
                        <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: color.hex }} />
                        <span>{color.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <MenuItem label="Pricing" active={activeTab === "pricing"} onClick={() => setActiveTab("pricing")} />
              <MenuItem label="Rooms" active={activeTab === "rooms"} onClick={() => setActiveTab("rooms")} />
            </nav>

            <div className="p-4 rounded-xl border bg-neutral-50 shadow-sm mb-8">
              <div className="font-bold text-xs uppercase tracking-tight">Want to see it in your space?</div>
              <div className="text-[11px] text-neutral-500 mt-1 leading-relaxed">Upload a photo of your room to preview products.</div>
              <label className="mt-4 inline-flex w-full justify-center px-3 py-2.5 rounded-lg bg-black text-white text-[11px] font-bold uppercase tracking-widest cursor-pointer hover:opacity-90">
                Browse Photos
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                   const f = e.target.files?.[0];
                   if (f) setRoomSrc(URL.createObjectURL(f));
                }} />
              </label>
              <div className="text-[9px] text-neutral-400 mt-2 text-center uppercase font-bold tracking-tighter">Format: jpeg, png, HEIC</div>
            </div>

            {/* Overlay Section */}
            <div className="border-t pt-6 ">
              <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-4">Overlay</div>
              <div className="space-y-5">
                <input 
                  type="range" 
                  min={0} max={1} step={0.01} 
                  value={overlayOpacity} 
                  onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))} 
                  className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#3B82F6] hover:accent-[#2563EB] transition-all" 
                  style={{
                    WebkitAppearance: 'none',
                    background: `linear-gradient(to right, #3B82F6 ${overlayOpacity * 100}%, #E5E7EB ${overlayOpacity * 100}%)`
                  }}
                />
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <NumberField label="X" value={floorRect.x} onChange={(v) => setFloorRect(r => ({ ...r, x: v }))} />
                  <NumberField label="Y" value={floorRect.y} onChange={(v) => setFloorRect(r => ({ ...r, y: v }))} />
                  <NumberField label="W" value={floorRect.w} onChange={(v) => setFloorRect(r => ({ ...r, w: v }))} />
                  <NumberField label="H" value={floorRect.h} onChange={(v) => setFloorRect(r => ({ ...r, h: v }))} />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="bg-neutral-50 flex-1 min-w-0 p-6 flex flex-col relative">
          <div className="flex-1 rounded-2xl border bg-white overflow-hidden flex flex-col shadow-sm relative">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <span className="font-medium text-sm text-neutral-600 tracking-tight uppercase tracking-tight">Preview Room</span>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg border text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors" 
                  onClick={() => { setGeneratedImageSrc(null); setSelectedProductId(null); setSelectedWallColor(null); setSelectedSofaId(null); setSofaPos(null); }}>
                  Reset
                </button>
                <button className="px-3 py-1.5 rounded-lg border bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors">
                  Save Image
                </button>
              </div>
            </div>

            <div className="flex-1 relative flex items-center justify-center bg-neutral-50 overflow-hidden">
                {/* ✅ CENTRAL INSTRUCTION PROMPT: Appears immediately when sofa is selected */}
                {selectedSofaId && !sofaPos && !isGenerating && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                    <div className="bg-[#3B82F6] text-white px-8 py-5 rounded-2xl shadow-2xl animate-pulse border-4 border-white flex flex-col items-center">
                      <p className="font-black text-lg uppercase tracking-widest text-center whitespace-nowrap">Click on the floor</p>
                      <p className="text-xs font-bold opacity-80 uppercase tracking-wider">to place your sofa</p>
                    </div>
                  </div>
                )}

                {isGenerating && (
                  <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black"></div>
                    <p className="font-bold text-black text-[10px] uppercase tracking-widest">Processing Design...</p>
                  </div>
                )}
                <div className="relative w-full h-full flex items-center justify-center">
                  {generatedImageSrc ? (
                    <img src={generatedImageSrc} className="max-w-full max-h-full object-contain shadow-2xl rounded-sm" />
                  ) : (
                    <VisualizerStage roomImg={roomImg} textureImg={textureImg} floorRect={floorRect} overlayOpacity={overlayOpacity} onStageClick={handleStageClick} />
                  )}
                </div>
            </div>
          </div>
        </main>

        <aside className="w-80 border-l bg-white overflow-y-auto flex-shrink-0 p-4">
          <div className="flex items-center mb-4">
            <span className="font-bold text-sm uppercase tracking-tight">Similar Floors</span>
            <span className="ml-auto text-[10px] text-neutral-400 font-bold uppercase tracking-tight">4 items</span>
          </div>
          <div className="space-y-2 mb-10">
            {products.map((p) => (
              <button key={p.id} onClick={() => { setSelectedProductId(p.id); performAiUpdate(p.id, selectedWallColor, selectedSofaId, sofaPos); }}
                className={`w-full flex gap-3 items-center p-3 rounded-xl border text-left transition-all ${selectedProductId === p.id ? "border-black bg-neutral-50 shadow-sm" : "border-neutral-100 hover:bg-neutral-50"}`}>
                <img src={p.thumbDataUrl} className="h-12 w-12 rounded-lg object-cover border border-neutral-100" />
                <div className="min-w-0">
                  <div className="font-bold text-[11px] truncate uppercase tracking-tight">{p.name}</div>
                  <div className="text-[10px] text-neutral-400 font-medium truncate italic">{p.subtitle}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center mb-4 border-t pt-6">
            <span className="font-bold text-sm uppercase tracking-tight">Sofa Selection</span>
            <span className="ml-auto text-[10px] text-neutral-400 font-bold uppercase tracking-tight">3 items</span>
          </div>
          <div className="space-y-3">
            {sofas.map((s) => (
              <button key={s.id} onClick={() => handleSofaSelect(s.id)} // ✅ Triggers prompt
                className={`w-full flex gap-4 items-center p-3 rounded-2xl border transition-all ${selectedSofaId === s.id ? "border-[#3B82F6] bg-blue-50/50" : "border-neutral-100 hover:bg-neutral-50 shadow-sm"}`}>
                <img src={s.thumb} className="h-14 w-14 rounded-xl object-cover border bg-white" />
                <div className="min-w-0 flex-1">
                  <div className={`font-bold text-[11px] truncate uppercase tracking-tight ${selectedSofaId === s.id ? "text-[#3B82F6]" : "text-neutral-800"}`}>{s.name}</div>
                  <div className="text-[9px] text-neutral-400 mt-0.5 font-bold italic tracking-tighter uppercase">Furniture Layer</div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// Support Components
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5 flex-1">
      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{label}</div>
      <input 
        type="number" 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value || "0"))} 
        className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs font-bold text-neutral-700 focus:border-[#3B82F6] focus:ring-1 focus:ring-blue-500 outline-none transition-all shadow-sm"
      />
    </div>
  );
}

function MenuItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${active ? "bg-black text-white" : "hover:bg-neutral-50 text-neutral-700"}`}>
      <span className="font-bold text-[12px] tracking-tight">{label}</span>
      <span className={`text-[10px] transition-transform ${active ? "opacity-100 translate-x-1" : "opacity-30"}`}>▸</span>
    </button>
  );
}

function VisualizerStage({ roomImg, textureImg, floorRect, overlayOpacity, onStageClick }: any) {
  const W = 1200; const H = 800;
  return (
    <Stage width={W} height={H} className="w-full h-full" onClick={onStageClick} ref={(r) => { if (r) (window as any).__stageRef = r.getStage(); }}>
      <Layer>
        {roomImg ? <KImage image={roomImg} x={0} y={0} width={W} height={H} /> : <Rect x={0} y={0} width={W} height={H} fill="#f8f8f8" />}
        {roomImg && <PatternFill x={floorRect.x} y={floorRect.y} w={floorRect.w} h={floorRect.h} texture={textureImg} opacity={textureImg ? overlayOpacity : 0} />}
      </Layer>
    </Stage>
  );
}