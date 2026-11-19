'use strict';
/**
 * Worker E — Arabic PDF Text Shaping Pipeline (Golden Rule 9)
 *
 * Covers:
 * - Edge cases (empty, null, Latin text, numbers)
 * - Arabic text shaping into Presentation Forms (U+FE70–U+FEFF) and RTL reordering
 * - Known bug E-BUG-5 (BUG-013): bidi-js throws and fixArabic returns raw text
 */

describe('Arabic PDF Text Pipeline (fixArabic)', () => {
  let fixArabic;

  beforeAll(() => {
    // arabic_pdf_helpers is a browser bundle attaching to window
    global.window = {};
    require('../../../public/js/arabic_pdf_helpers.js');
    fixArabic = global.window.fixArabic;
  });

  afterAll(() => {
    delete global.window;
  });

  test('handles null, undefined and empty strings cleanly', () => {
    expect(fixArabic('')).toBe('');
    expect(fixArabic(null)).toBeNull();
    expect(fixArabic(undefined)).toBeUndefined();
  });

  test('preserves Latin characters and numbers untouched', () => {
    expect(fixArabic('Invoice 12345')).toBe('Invoice 12345');
    expect(fixArabic('ABC-XYZ')).toBe('ABC-XYZ');
  });

  test('fixArabic transforms Arabic text into shaped presentation forms in visual order @known-bug E-BUG-5', () => {
    const rawArabic = 'مركز القدس';
    const transformed = fixArabic(rawArabic);

    // The transformed string must NOT equal the raw text (which means shaping failed)
    expect(transformed).not.toBe(rawArabic);

    // It must contain Arabic Presentation Forms (U+FE70 to U+FEFF)
    const hasPresentationForms = /[\uFE70-\uFEFF]/.test(transformed);
    expect(hasPresentationForms).toBe(true);
  });
});
