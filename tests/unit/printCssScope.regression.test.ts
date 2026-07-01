import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression: CUR-103 — global `@media print` rules unconditionally hid every
// element outside `#card-preview`, which only exists while the Export modal is
// open. Ctrl/Cmd+P anywhere else printed a blank sheet. The rules must be
// scoped to `body:has([data-export-modal])` so normal pages fall back to the
// browser default print rendering.

const REPO_ROOT = resolve(__dirname, '../..');
const SCOPE = 'body:has([data-export-modal])';

const readSource = (relativePath: string) => readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');

/** Collapse whitespace so the assertion tolerates Prettier reflow. */
const normalise = (text: string) => text.replace(/\s+/g, ' ');

describe('print stylesheet scope (CUR-103)', () => {
  const css = normalise(readSource('src/index.css'));

  it('scopes the visibility-hidden rule to the Export modal so other screens print normally', () => {
    expect(css).toContain(`${SCOPE} * { visibility: hidden !important; }`);
  });

  it('scopes the #card-preview visibility + layout overrides to the Export modal', () => {
    // Both "make the card visible" and "pin the card at the print origin" must
    // live behind the same scope; otherwise the card selector matches nothing
    // and the scope has no anchor.
    expect(css).toContain(`${SCOPE} #card-preview, ${SCOPE} #card-preview *`);
    expect(css).toMatch(
      new RegExp(
        `${SCOPE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} #card-preview \\{[^}]*position: fixed`,
      ),
    );
  });

  it('keeps `data-export-modal` on the ExportModal root as the scope anchor', () => {
    // The CSS scope resolves via this attribute; renaming it silently breaks
    // print from the modal, which is why the guard lives beside the CSS check.
    const source = readSource('src/components/ExportModal.tsx');
    expect(source).toMatch(/data-export-modal(\s|>|=)/);
  });
});
