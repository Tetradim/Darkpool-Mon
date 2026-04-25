// Color Themes Configuration
// Theme inspired by TradingView, Sentinel Edge, Set Trader

export const THEMES = {
  DEFAULT: {
    name: 'Default (TradingView)',
    background: '#1a1a2e',
    backgroundAlt: '#16213e',
    card: '#1f2937',
    cardHover: '#374151',
    text: '#ffffff',
    textSecondary: '#9ca3af',
    accent: '#00d4ff',      // Cyan
    accentGreen: '#22c55e',  // Green (bullish)
    accentRed: '#ef4444',     // Red (bearish)
    accentYellow: '#f59e0b',
    border: '#374151',
  },
  CYBERPUNK: {
    name: 'Cyberpunk',
    background: '#0d0d1a',
    backgroundAlt: '#1a0d2e',
    card: '#1a1a2e',
    cardHover: '#2a2a4e',
    text: '#e0e0ff',
    textSecondary: '#8080a0',
    accent: '#ff00ff',      // Magenta
    accentGreen: '#00ff88', // Neon green
    accentRed: '#ff0044',  // Neon red
    accentYellow: '#ffff00',
    border: '#4a4a8a',
  },
  MATRIX: {
    name: 'Matrix',
    background: '#000000',
    backgroundAlt: '#001800',
    card: '#0a0a0a',
    cardHover: '#151515',
    text: '#00ff00',
    textSecondary: '#00aa00',
    accent: '#00ff00',
    accentGreen: '#00cc00',
    accentRed: '#ff0000',
    accentYellow: '#ffff00',
    border: '#003300',
  },
  FIRE: {
    name: 'Fire/Ice',
    background: '#1a0505',
    backgroundAlt: '#2a0a15',
    card: '#2a1010',
    cardHover: '#4a1a1a',
    text: '#ffffff',
    textSecondary: '#ffa0a0',
    accent: '#ff6600',
    accentGreen: '#ff4400',
    accentRed: '#ff0000',
    accentYellow: '#ffaa00',
    border: '#5a2020',
  },
  MONOCHROME: {
    name: 'Monochrome',
    background: '#0a0a0a',
    backgroundAlt: '#151515',
    card: '#1a1a1a',
    cardHover: '#252525',
    text: '#ffffff',
    textSecondary: '#808080',
    accent: '#ffffff',
    accentGreen: '#cccccc',
    accentRed: '#666666',
    accentYellow: '#999999',
    border: '#333333',
  },
};

// Chart Types
export const CHART_TYPES = {
  AREA: 'area',
  BAR: 'bar', 
  LINE: 'line',
  CANDLESTICK: 'candlestick',
};

// Layout Types
export const LAYOUTS = {
  GRID: 'grid',
  LIST: 'list',
  HEATMAP: 'heatmap',
};

// Card Sizes
export const CARD_SIZES = {
  COMPACT: 'compact',
  NORMAL: 'normal',
  EXPANDED: 'expanded',
};

// Providers
export const PROVIDERS = {
  FINRA: 'finra',
  POLYGON: 'polygon',
  INTRINIO: 'intrinio',
};

// Default Settings
export const DEFAULT_SETTINGS = {
  theme: 'DEFAULT',
  chartType: CHART_TYPES.AREA,
  layout: LAYOUTS.GRID,
  cardSize: CARD_SIZES.NORMAL,
  provider: PROVIDERS.FINRA,
  whaleThreshold: 50,
  minTradeSize: 1,
  timeframe: '1H',
  soundEnabled: true,
  desktopAlerts: false,
  grafanaUrl: '',
  plotlyUrl: '',
};

// Greek letters for options/greeks display
export const GREEK_SYMBOLS = {
  delta: 'Δ',
  gamma: 'Γ',
  theta: 'Θ',
  vega: 'ν',  // Using nu for vega
  rho: 'ρ',
};

export const GREEK_NAMES = {
  delta: 'Delta',
  gamma: 'Gamma', 
  theta: 'Theta',
  vega: 'Vega',
  rho: 'Rho',
};

// Helper to get CSS variables from theme
export const getThemeCSS = (themeName) => {
  const theme = THEMES[themeName] || THEMES.DEFAULT;
  return `
    --color-bg: ${theme.background};
    --color-bg-alt: ${theme.backgroundAlt};
    --color-card: ${theme.card};
    --color-card-hover: ${theme.cardHover};
    --color-text: ${theme.text};
    --color-text-secondary: ${theme.textSecondary};
    --color-accent: ${theme.accent};
    --color-accent-green: ${theme.accentGreen};
    --color-accent-red: ${theme.accentRed};
    --color-accent-yellow: ${theme.accentYellow};
    --color-border: ${theme.border};
  `;
};