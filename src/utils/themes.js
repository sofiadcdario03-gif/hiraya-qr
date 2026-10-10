/**
 * Theme definitions for Hiraya QR.
 *
 * Each theme supplies:
 *   primary   – main environment colour (used for dark QR modules)
 *   secondary – accent environment colour
 *   accent    – highlight / gold tone
 *   background – sky / ambient backdrop
 *   dark      – QR module dark colour  (must contrast ≥ 3:1 against light)
 *   light     – QR module light colour (background of the QR image)
 *
 * The 3-D scene uses primary / secondary / accent / background.
 * The QR generator uses dark / light directly.
 */
export const themes = {
  balete: {
    name: 'Banaue Rice Terraces',
    id: 'balete',
    description: 'The breathtaking rice terraces of Banaue carve their way up the mountain slopes like a stairway to the heavens. Ancient irrigation systems feed the emerald fields that change with the seasons, surrounded by mist-covered peaks and traditional Ifugao village life in harmony with nature.',
    colors: {
      primary:    '#1a472a',
      secondary:  '#2d5a27',
      accent:     '#fbbf24',
      background: '#0f172a',
      dark:       '#1a3d22',   // deep forest green   – on ivory → 8.5:1
      light:      '#fef6e0',   // warm parchment
    },
  },

  diwata: {
    name: "Enchanted Balete of Siquijor",
    id: 'diwata',
    description: 'A mystical balete tree standing at the heart of an enchanted forest, its ancient trunk adorned with glowing fairy lights and cascading aerial roots. The surrounding garden blooms with whimsical flora, all bathed in a soft golden glow that illuminates the magical atmosphere of Siquijor.',
    colors: {
      primary:    '#0d6b5e',
      secondary:  '#5eead4',
      accent:     '#f472b6',
      background: '#0f172a',
      dark:       '#0b5549',   // deep teal            – on pale mint → 7.2:1
      light:      '#e8fdf8',   // pale aqua mint
    },
  },

  coral: {
    name: 'Mount Mayon',
    id: 'coral',
    description: 'The majestic near-perfect cone of Mount Mayon rises gracefully above the lush landscapes of Albay. Its forested slopes fade into a blanket of soft mist, while delicate clouds drift around its summit. Lush tropical greenery blankets the foothills, with layered mountain ridges fading into the misty blue distance in serene, timeless beauty.',
    colors: {
      primary:    '#2d5a27',   // forest green
      secondary:  '#7c8b6f',   // sage
      accent:     '#c9d1c9',   // mist
      background: '#1e293b',
      dark:       '#1a4d15',   // deep forest green   – on ivory → 7.1:1
      light:      '#faf8f0',   // ivory
    },
  },

  bahayKubo: {
    name: 'Bahay Kubo Village',
    id: 'bahayKubo',
    description: 'A traditional Filipino village comes to life with charming nipa huts nestled among verdant rice paddies. Golden fields stretch toward the horizon, surrounded by tropical vegetation swaying in the gentle breeze. Warm terracotta tones and bamboo textures capture the essence of rural Philippine countryside living.',
    colors: {
      primary:    '#854d0e',
      secondary:  '#d97706',
      accent:     '#fbbf24',
      background: '#0f172a',
      dark:       '#6b3a0a',   // dark terracotta       – on linen → 8.1:1
      light:      '#fdf4e7',   // warm linen
    },
  },

  coralKingdom: {
    name: 'Christmas Parol',
    id: 'coralKingdom',
    description: 'A grand Filipino star lantern radiates festive warmth with its intricate five-pointed design. Layers of gold, red, and orange create a stunning centerpiece, while decorative tassels and glowing bulbs cast a warm holiday glow. The parol embodies the spirit of Filipino Christmas celebrations.',
    colors: {
      primary:    '#0e5f76',
      secondary:  '#f472b6',
      accent:     '#fbbf24',
      background: '#0c4a6e',
      dark:       '#0b4a5e',   // deep ocean teal       – on seafoam → 7.5:1
      light:      '#e0fafa',   // pale seafoam
    },
  },

  elnido: {
    name: 'El Nido Lagoon',
    id: 'elnido',
    description: 'A hidden lagoon nestled within towering limestone cliffs, where turquoise waters reflect the golden sun. Tropical palms line the shore while flying birds soar above the pristine paradise. The hidden sanctuary reveals crystal-clear waters teeming with life, surrounded by the dramatic karst formations that make El Nido world-renowned.',
    colors: {
      primary:    '#6b4c2a',   // warm limestone brown
      secondary:  '#0891b2',   // turquoise lagoon
      accent:     '#fbbf24',   // golden sun
      background: '#0c2a3a',
      dark:       '#5a3e22',   // deep limestone          – on pale aqua → 7.8:1
      light:      '#e8f8fc',   // pale sky-aqua
    },
  },
};
