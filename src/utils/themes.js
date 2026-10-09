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
    name: 'Enchanted Balete',
    id: 'balete',
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
    name: "Diwata's Garden",
    id: 'diwata',
    colors: {
      primary:    '#0d6b5e',
      secondary:  '#5eead4',
      accent:     '#f472b6',
      background: '#0f172a',
      dark:       '#0b5549',   // deep teal            – on pale mint → 7.2:1
      light:      '#e8fdf8',   // pale aqua mint
    },
  },

  sarimanok: {
    name: 'Sarimanok Sanctuary',
    id: 'sarimanok',
    colors: {
      primary:    '#9b1c1c',
      secondary:  '#fbbf24',
      accent:     '#16a34a',
      background: '#0f172a',
      dark:       '#7f1d1d',   // deep crimson          – on gold tint → 6.8:1
      light:      '#fffbeb',   // warm cream
    },
  },

  bahayKubo: {
    name: 'Bahay Kubo Village',
    id: 'bahayKubo',
    colors: {
      primary:    '#854d0e',
      secondary:  '#d97706',
      accent:     '#fbbf24',
      background: '#0f172a',
      dark:       '#6b3a0a',   // dark terracotta       – on linen → 8.1:1
      light:      '#fdf4e7',   // warm linen
    },
  },

  mariaMakiling: {
    name: "Maria Makiling's Mountain",
    id: 'mariaMakiling',
    colors: {
      primary:    '#1e3a5f',
      secondary:  '#3b82f6',
      accent:     '#fbbf24',
      background: '#0f172a',
      dark:       '#172d4a',   // midnight blue          – on sky tint → 9.2:1
      light:      '#eef5ff',   // pale sky blue
    },
  },

  coralKingdom: {
    name: 'Philippine Coral Kingdom',
    id: 'coralKingdom',
    colors: {
      primary:    '#0e5f76',
      secondary:  '#f472b6',
      accent:     '#fbbf24',
      background: '#0c4a6e',
      dark:       '#0b4a5e',   // deep ocean teal       – on seafoam → 7.5:1
      light:      '#e0fafa',   // pale seafoam
    },
  },
};
