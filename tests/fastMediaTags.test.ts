import { describe, it, expect } from 'bun:test';
import { readAudioTags } from '../src/fastMediaTags';

function createTextFrame(
  id: string,
  text: string,
  encoding: number
): { id: string; data: Uint8Array } {
  if (encoding === 0) {
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    const data = new Uint8Array(1 + textBytes.length);
    data[0] = 0;
    data.set(textBytes, 1);
    return { id, data };
  } else {
    // UTF-16LE with BOM
    const data = new Uint8Array(1 + 2 + text.length * 2);
    data[0] = 1;
    data[1] = 0xff; // BOM LE
    data[2] = 0xfe; // BOM LE
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      data[3 + i * 2] = code & 0xff;
      data[4 + i * 2] = (code >> 8) & 0xff;
    }
    return { id, data };
  }
}

function createApicFrame(
  mime: string,
  type: number,
  desc: string,
  imgData: Uint8Array
): { id: string; data: Uint8Array } {
  const encoder = new TextEncoder();
  const mimeBytes = encoder.encode(mime);
  const descBytes = encoder.encode(desc);

  const totalLength = 1 + (mimeBytes.length + 1) + 1 + (descBytes.length + 1) + imgData.length;
  const data = new Uint8Array(totalLength);

  let offset = 0;
  data[offset++] = 0; // Encoding = 0 (ASCII/UTF-8)

  data.set(mimeBytes, offset);
  offset += mimeBytes.length;
  data[offset++] = 0; // MIME null terminator

  data[offset++] = type; // Picture Type

  data.set(descBytes, offset);
  offset += descBytes.length;
  data[offset++] = 0; // Description null terminator

  data.set(imgData, offset);

  return { id: 'APIC', data };
}

function createID3Buffer(
  frames: { id: string; data: Uint8Array }[],
  version: number = 3
): ArrayBuffer {
  let totalFrameSize = 0;
  for (const f of frames) {
    totalFrameSize += 10 + f.data.length;
  }

  const header = new Uint8Array(10);
  header[0] = 0x49; // I
  header[1] = 0x44; // D
  header[2] = 0x33; // 3
  header[3] = version;
  header[4] = 0;
  header[5] = 0;

  header[6] = (totalFrameSize >> 21) & 0x7f;
  header[7] = (totalFrameSize >> 14) & 0x7f;
  header[8] = (totalFrameSize >> 7) & 0x7f;
  header[9] = totalFrameSize & 0x7f;

  const buffer = new Uint8Array(10 + totalFrameSize);
  buffer.set(header, 0);

  let offset = 10;
  for (const f of frames) {
    // Frame ID
    for (let i = 0; i < 4; i++) {
      buffer[offset + i] = f.id.charCodeAt(i);
    }

    const size = f.data.length;
    if (version === 3) {
      buffer[offset + 4] = (size >> 24) & 0xff;
      buffer[offset + 5] = (size >> 16) & 0xff;
      buffer[offset + 6] = (size >> 8) & 0xff;
      buffer[offset + 7] = size & 0xff;
    } else {
      buffer[offset + 4] = (size >> 21) & 0x7f;
      buffer[offset + 5] = (size >> 14) & 0x7f;
      buffer[offset + 6] = (size >> 7) & 0x7f;
      buffer[offset + 7] = size & 0x7f;
    }

    buffer[offset + 8] = 0;
    buffer[offset + 9] = 0;

    buffer.set(f.data, offset + 10);
    offset += 10 + size;
  }

  return buffer.buffer;
}

describe('fast-media-tags', () => {
  it('should return empty object if ID3 header is missing', async () => {
    const emptyBuffer = new Uint8Array([0, 0, 0, 0, 0]).buffer;
    const tags = await readAudioTags(emptyBuffer);
    expect(tags).toEqual({});
  });

  it('should parse ID3v2.3 text frames and APIC frame', async () => {
    const frames = [
      createTextFrame('TIT2', 'Sample Title', 0),
      createTextFrame('TPE1', 'Sample Artist', 1), // Test UTF-16 encoding path
      createTextFrame('TALB', 'Sample Album', 0),
      createTextFrame('TYER', '2026', 0),
      createTextFrame('TCON', 'Synthwave', 0),
      createApicFrame('image/png', 3, 'Front Cover', new Uint8Array([10, 20, 30, 40])),
    ];

    const buffer = createID3Buffer(frames, 3);
    const tags = await readAudioTags(buffer);

    expect(tags.title).toBe('Sample Title');
    expect(tags.artist).toBe('Sample Artist');
    expect(tags.album).toBe('Sample Album');
    expect(tags.year).toBe('2026');
    expect(tags.genre).toBe('Synthwave');
    expect(tags.picture).toBeDefined();
    expect(tags.picture?.format).toBe('image/png');
    expect(tags.picture?.type).toBe('Cover (front)');
    expect(tags.picture?.description).toBe('Front Cover');
    expect(tags.picture?.data).toEqual(new Uint8Array([10, 20, 30, 40]));
    expect(tags.picture?.base64).toBe('data:image/png;base64,ChQeKA==');
  });

  it('should parse ID3v2.4 frames with syncsafe sizes', async () => {
    const frames = [
      createTextFrame('TIT2', 'Song 2.4', 0),
      createTextFrame('TDRC', '2027-01-01', 0),
    ];
    const buffer = createID3Buffer(frames, 4);
    const tags = await readAudioTags(buffer);

    expect(tags.title).toBe('Song 2.4');
    expect(tags.year).toBe('2027');
  });

  it('should parse from Blob', async () => {
    const frames = [createTextFrame('TIT2', 'Blob Song', 0)];
    const buffer = createID3Buffer(frames, 3);
    const blob = new Blob([buffer], { type: 'audio/mpeg' });

    const tags = await readAudioTags(blob);
    expect(tags.title).toBe('Blob Song');
  });
});
