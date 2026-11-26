import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './helpers.mjs';

test('voice settings use shrinkable tracks and wrap translated labels', () => {
  const css = read('public/css/style.css');
  assert.match(css, /\.voice-pick \{[^}]*grid-template-columns: minmax\(0, 1fr\)[^}]*min-width: 0/);
  assert.match(css, /\.voice-pick \.seg button \{[^}]*white-space: normal[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.set-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(css, /\.set-ctl \{ min-width: 0; max-width: 100%;/);
  assert.match(css, /\.voice-pick \.seg \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[^}]*width: 100%;[^}]*\}/);
});
