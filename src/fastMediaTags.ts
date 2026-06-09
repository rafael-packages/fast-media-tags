import type { AudioTags } from './types';

function readString(bytes: Uint8Array, start: number, end: number, encoding: number): string {
  const slice = bytes.subarray(start, end);
  if (encoding === 1 || encoding === 2) {
    let offset = 0;
    if (slice[0] === 0xff && slice[1] === 0xfe) offset = 2; // UTF-16LE BOM
    if (slice[0] === 0xfe && slice[1] === 0xff) offset = 2; // UTF-16BE BOM

    let str = '';
    for (let i = offset; i < slice.length - 1; i += 2) {
      const code = slice[i] | (slice[i + 1] << 8);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str;
  } else {
    let str = '';
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) break;
      str += String.fromCharCode(slice[i]);
    }
    try {
      return decodeURIComponent(escape(str));
    } catch (_) {
      return str;
    }
  }
}

function parseID3v2(buffer: ArrayBuffer): AudioTags {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return {};
  }

  const version = bytes[3];
  if (version < 3 || version > 4) {
    return {};
  }

  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const tags: AudioTags = {};
  let offset = 10;

  const tagEnd = Math.min(offset + tagSize, bytes.length);

  while (offset < tagEnd - 10) {
    const frameId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    if (frameId.charCodeAt(0) === 0 || !/^[A-Z0-9]{4}$/.test(frameId)) {
      break;
    }

    let frameSize = 0;
    if (version === 3) {
      frameSize =
        (bytes[offset + 4] << 24) |
        (bytes[offset + 5] << 16) |
        (bytes[offset + 6] << 8) |
        bytes[offset + 7];
    } else {
      frameSize =
        ((bytes[offset + 4] & 0x7f) << 21) |
        ((bytes[offset + 5] & 0x7f) << 14) |
        ((bytes[offset + 6] & 0x7f) << 7) |
        (bytes[offset + 7] & 0x7f);
    }

    if (frameSize <= 0 || offset + 10 + frameSize > tagEnd) {
      break;
    }

    const frameStart = offset + 10;
    const frameEnd = frameStart + frameSize;

    if (frameId.startsWith('T') && frameId !== 'TXXX') {
      const encoding = bytes[frameStart];
      const text = readString(bytes, frameStart + 1, frameEnd, encoding);

      if (frameId === 'TIT2') tags.title = text;
      else if (frameId === 'TPE1') tags.artist = text;
      else if (frameId === 'TALB') tags.album = text;
      else if (frameId === 'TYER' || frameId === 'TDRC') tags.year = text.substring(0, 4);
      else if (frameId === 'TCON') tags.genre = text;
    } else if (frameId === 'APIC') {
      const encoding = bytes[frameStart];
      let mimeEnd = frameStart + 1;
      while (bytes[mimeEnd] !== 0 && mimeEnd < frameEnd) mimeEnd++;
      const format = String.fromCharCode(...bytes.subarray(frameStart + 1, mimeEnd));

      const typeCode = bytes[mimeEnd + 1];
      const type = getPictureType(typeCode);

      let descEnd = mimeEnd + 2;
      if (encoding === 1 || encoding === 2) {
        while ((bytes[descEnd] !== 0 || bytes[descEnd + 1] !== 0) && descEnd < frameEnd - 1)
          descEnd += 2;
        descEnd += 2;
      } else {
        while (bytes[descEnd] !== 0 && descEnd < frameEnd) descEnd++;
        descEnd += 1;
      }

      const description = readString(bytes, mimeEnd + 2, descEnd, encoding);
      const imgData = bytes.subarray(descEnd, frameEnd);

      let binary = '';
      for (let i = 0; i < imgData.length; i++) {
        binary += String.fromCharCode(imgData[i]);
      }
      const base64 = btoa(binary);

      tags.picture = {
        format,
        type,
        description,
        data: new Uint8Array(imgData),
        base64: `data:${format};base64,${base64}`,
      };
    }

    offset = frameEnd;
  }

  return tags;
}

function getPictureType(code: number): string {
  const types = [
    'Other',
    '32x32 pixels file icon',
    'Other file icon',
    'Cover (front)',
    'Cover (back)',
    'Leaflet page',
    'Media (e.g. label side of CD)',
    'Lead artist/lead performer/soloist',
    'Artist/performer',
    'Conductor',
    'Band/Orchestra',
    'Composer',
    'Lyricist/text writer',
    'Recording Location',
    'During recording',
    'During performance',
    'Movie/video screen capture',
    'A bright coloured fish',
    'Illustration',
    'Band/artist logotype',
    'Publisher/Studio logotype',
  ];
  return types[code] || 'Unknown';
}

/**
 * Parses ID3v2 tags from audio bytes or files.
 */
export async function readAudioTags(file: Blob | ArrayBuffer | string): Promise<AudioTags> {
  if (file instanceof ArrayBuffer) {
    return parseID3v2(file);
  }

  if (typeof Blob !== 'undefined' && file instanceof Blob) {
    const buffer = await file.slice(0, 131072).arrayBuffer();
    return parseID3v2(buffer);
  }

  if (typeof file === 'string') {
    try {
      const fs = await import('fs/promises');
      const handle = await fs.open(file, 'r');
      const buffer = Buffer.alloc(131072);
      await handle.read(buffer, 0, 131072, 0);
      await handle.close();
      return parseID3v2(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      );
    } catch (err: any) {
      throw new Error(`Failed to read file path: ${err.message}`);
    }
  }

  throw new Error('Unsupported file type. Expected Blob, ArrayBuffer, or file path string.');
}
