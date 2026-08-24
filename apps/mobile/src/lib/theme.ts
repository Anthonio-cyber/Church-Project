/**
 * The 𝒾Pastor palette, shared with the web application: gold on deep ink,
 * warm and burnished rather than neon.
 */
export const theme = {
  colors: {
    gold: '#c9922a',
    goldLight: '#e8c469',
    goldDark: '#89551d',
    ink: '#1c1b19',
    inkDeep: '#111110',
    inkSoft: '#2a2825',
    inkBorder: '#43403b',
    parchment: '#fdfcf9',
    parchmentSoft: '#f3ecdd',
    muted: '#827d76',
    danger: '#dc2626',
    success: '#059669',
    warning: '#d97706',
  },
  spacing: (n: number) => n * 4,
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
} as const;
