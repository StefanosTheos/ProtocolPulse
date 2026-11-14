// Contract spans are zero-based, end-exclusive Unicode code-point offsets. JavaScript strings
// index UTF-16 code units, which differ whenever a supplementary-plane character precedes the
// offset. Always convert at the boundary; never slice a page with raw contract offsets.

export function codePointToUtf16Index(text: string, codePointOffset: number): number {
  if (codePointOffset < 0) throw new RangeError('negative code-point offset');
  let cp = 0;
  let i = 0;
  while (i < text.length && cp < codePointOffset) {
    const code = text.codePointAt(i)!;
    i += code > 0xffff ? 2 : 1;
    cp += 1;
  }
  if (cp < codePointOffset) throw new RangeError(`code-point offset ${codePointOffset} beyond text length ${cp}`);
  return i;
}

export function utf16ToCodePointIndex(text: string, utf16Offset: number): number {
  if (utf16Offset < 0 || utf16Offset > text.length) throw new RangeError('UTF-16 offset out of range');
  let cp = 0;
  for (let i = 0; i < utf16Offset; ) {
    const code = text.codePointAt(i)!;
    i += code > 0xffff ? 2 : 1;
    cp += 1;
  }
  return cp;
}

export function sliceByCodePoints(text: string, start: number, end: number): string {
  return text.slice(codePointToUtf16Index(text, start), codePointToUtf16Index(text, end));
}

// Split text into [before, highlighted, after] for a code-point span.
export function splitAtCodePointSpan(text: string, start: number, end: number): [string, string, string] {
  const a = codePointToUtf16Index(text, start);
  const b = codePointToUtf16Index(text, end);
  return [text.slice(0, a), text.slice(a, b), text.slice(b)];
}
