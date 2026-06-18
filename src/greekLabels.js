const OPTION_GREEK_CODE_POINTS = Object.freeze({
  delta: 0x0394,
  gamma: 0x0393,
  theta: 0x0398,
  vega: 0x03bd,
  rho: 0x03c1,
});

export const OPTION_GREEK_LABELS = Object.freeze({
  delta: Object.freeze({
    key: 'delta',
    name: 'Delta',
    symbol: String.fromCharCode(OPTION_GREEK_CODE_POINTS.delta),
    codePoint: 'U+0394',
  }),
  gamma: Object.freeze({
    key: 'gamma',
    name: 'Gamma',
    symbol: String.fromCharCode(OPTION_GREEK_CODE_POINTS.gamma),
    codePoint: 'U+0393',
  }),
  theta: Object.freeze({
    key: 'theta',
    name: 'Theta',
    symbol: String.fromCharCode(OPTION_GREEK_CODE_POINTS.theta),
    codePoint: 'U+0398',
  }),
  vega: Object.freeze({
    key: 'vega',
    name: 'Vega',
    symbol: String.fromCharCode(OPTION_GREEK_CODE_POINTS.vega),
    codePoint: 'U+03BD',
  }),
  rho: Object.freeze({
    key: 'rho',
    name: 'Rho',
    symbol: String.fromCharCode(OPTION_GREEK_CODE_POINTS.rho),
    codePoint: 'U+03C1',
  }),
});

export const OPTION_GREEK_FILTERS = Object.freeze(Object.values(OPTION_GREEK_LABELS));

export const OPTION_GREEK_SYMBOLS = Object.freeze(
  Object.fromEntries(OPTION_GREEK_FILTERS.map(({ key, symbol }) => [key, symbol]))
);
