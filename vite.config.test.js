import { describe, expect, it } from 'vitest';

import { getVendorChunkName } from './vite.config';

const nodeModulePath = (packageName) => `C:/workspace/node_modules/${packageName}/index.js`;

describe('Vite manual chunk strategy', () => {
  it('keeps chart libraries in their own vendor chunk', () => {
    expect(getVendorChunkName(nodeModulePath('recharts'))).toBe('vendor-charts');
    expect(getVendorChunkName(nodeModulePath('d3-scale'))).toBe('vendor-charts');
    expect(getVendorChunkName(nodeModulePath('victory-vendor'))).toBe('vendor-charts');
  });

  it('splits React, icons, and app code deliberately', () => {
    expect(getVendorChunkName(nodeModulePath('lucide-react'))).toBe('vendor-icons');
    expect(getVendorChunkName(nodeModulePath('react-dom'))).toBe('vendor-react');
    expect(getVendorChunkName(nodeModulePath('react'))).toBe('vendor-react');
    expect(getVendorChunkName('C:/workspace/src/App.jsx')).toBeUndefined();
  });
});
