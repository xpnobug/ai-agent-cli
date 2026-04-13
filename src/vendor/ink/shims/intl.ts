// @ts-nocheck
/**
 * utils/intl shim
 */

let _segmenter: Intl.Segmenter | undefined;

export function getGraphemeSegmenter(): Intl.Segmenter {
  if (!_segmenter) {
    _segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  }
  return _segmenter;
}
