/**
 * Manual UTF-8 encode/decode. Figma's plugin sandbox is a restricted JS VM
 * that does not provide `TextEncoder`/`TextDecoder` (those exist in browsers
 * and Node, but not in the plugin main-thread sandbox), so byte-accurate
 * storage chunking can't rely on them.
 */

export function utf8Encode(input: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let codePoint = input.codePointAt(i);
    if (codePoint === undefined) continue;
    if (codePoint > 0xffff) i++; // consumed a low surrogate as part of this code point

    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

export function utf8Decode(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i] ?? 0;

    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
      i += 1;
    } else if ((byte1 & 0xe0) === 0xc0 && i + 1 < bytes.length) {
      const byte2 = bytes[i + 1] ?? 0;
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
      i += 2;
    } else if ((byte1 & 0xf0) === 0xe0 && i + 2 < bytes.length) {
      const byte2 = bytes[i + 1] ?? 0;
      const byte3 = bytes[i + 2] ?? 0;
      result += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
      i += 3;
    } else if ((byte1 & 0xf8) === 0xf0 && i + 3 < bytes.length) {
      const byte2 = bytes[i + 1] ?? 0;
      const byte3 = bytes[i + 2] ?? 0;
      const byte4 = bytes[i + 3] ?? 0;
      const codePoint =
        ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);
      result += String.fromCodePoint(codePoint);
      i += 4;
    } else {
      // Malformed/truncated byte sequence — skip the offending byte rather
      // than throw, consistent with the rest of DSLog's storage layer
      // treating corruption as "return something parseable, or undefined".
      i += 1;
    }
  }
  return result;
}
