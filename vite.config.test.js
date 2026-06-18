import { describe, expect, it } from 'vitest';

import { getVendorChunkName } from './vite.config';

const nodeModulePath = (packageName) => `C:/workspace/node_modules/${packageName}/index.js`;

describe('Vite manual chunk strategy', () => {
  it('splits chart dependencies by package family to avoid oversized chunks', () => {
    expect(getVendorChunkName(nodeModulePath('recharts'))).toBe('vendor-recharts');
    expect(getVendorChunkName(nodeModulePath('d3-scale'))).toBe('vendor-d3');
    expect(getVendorChunkName(nodeModulePath('victory-vendor'))).toBe('vendor-victory');
  });

  it('splits React, icons, and app code deliberately', () => {
    expect(getVendorChunkName(nodeModulePath('lucide-react'))).toBe('vendor-icons');
    expect(getVendorChunkName(nodeModulePath('react-dom'))).toBe('vendor-react');
    expect(getVendorChunkName(nodeModulePath('react'))).toBe('vendor-react');
    expect(getVendorChunkName('C:/workspace/src/App.jsx')).toBeUndefined();
  });
});
