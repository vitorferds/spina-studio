export interface GoogleFontOption {
  family: string;
  category: string;
  weights: number[];
}

export const CURATED_GOOGLE_FONTS: GoogleFontOption[] = [
  { family: 'Syne', category: 'Experimental Display', weights: [400, 600, 700, 800] },
  { family: 'Unbounded', category: 'Neo-Brutalist', weights: [300, 400, 600, 800, 900] },
  { family: 'Cormorant Garamond', category: 'Editorial Serif', weights: [400, 600, 700] },
  { family: 'Bodoni Moda', category: 'High Fashion', weights: [400, 600, 800] },
  { family: 'Oswald', category: 'Condensed Gothic', weights: [300, 400, 600, 700] },
  { family: 'Archivo Black', category: 'Heavy Impact', weights: [400] },
  { family: 'Space Mono', category: 'Technical Mono', weights: [400, 700] },
  { family: 'JetBrains Mono', category: 'Precision Mono', weights: [400, 600, 800] },
  { family: 'Rubik Glitch', category: 'Experimental Glitch', weights: [400] },
  { family: 'Silkscreen', category: 'Pixel Bitmap', weights: [400, 700] },
  { family: 'Cinzel', category: 'Monumental Serif', weights: [400, 600, 800] },
  { family: 'Bricolage Grotesque', category: 'Quirky Sans', weights: [400, 600, 800] },
  { family: 'Antonio', category: 'Ultra Condensed', weights: [300, 500, 700] },
  { family: 'Instrument Serif', category: 'Sharp Editorial', weights: [400] },
  { family: 'Outfit', category: 'Geometric Clean', weights: [300, 500, 700, 900] },
  { family: 'Chakra Petch', category: 'Cybernetic', weights: [400, 600, 700] },
  { family: 'Orbitron', category: 'Futurist', weights: [400, 600, 800, 900] },
  { family: 'Playfair Display', category: 'Classic Editorial', weights: [400, 600, 800] },
  { family: 'Metal Mania', category: 'Tribal Gothic', weights: [400] },
  { family: 'Zen Dots', category: 'Cyber Display', weights: [400] },
];

const loadedFamilies = new Set<string>(['Syne', 'Plus Jakarta Sans', 'JetBrains Mono']);

export async function ensureGoogleFontLoaded(family: string, weight = 400): Promise<void> {
  const cleanFamily = family.trim();
  if (!cleanFamily) return;

  const key = `${cleanFamily}:${weight}`;
  if (!loadedFamilies.has(cleanFamily)) {
    loadedFamilies.add(cleanFamily);
    const encoded = encodeURIComponent(cleanFamily).replace(/%20/g, '+');
    const id = `gf-${cleanFamily.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700;800;900&display=swap`;
      document.head.appendChild(link);
    }
  }

  try {
    await document.fonts.load(`${weight} 36px "${cleanFamily}"`);
    await document.fonts.ready;
  } catch {
    // Font may only support weight 400; try fallback 400
    try {
      await document.fonts.load(`400 36px "${cleanFamily}"`);
    } catch {
      void key;
    }
  }
}
