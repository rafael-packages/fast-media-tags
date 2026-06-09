# @rafaeldasilvadeveloper/fast-media-tags

An ultra-lightweight, zero-dependency, and extremely fast binary ID3v2 tag parser for Node.js, Bun, Edge, and browser environments.

[![NPM Version](https://img.shields.io/npm/v/@rafaeldasilvadeveloper/fast-media-tags.svg?style=flat-square)](https://www.npmjs.com/package/@rafaeldasilvadeveloper/fast-media-tags)
[![Discord Support](https://img.shields.io/discord/1111111111?color=7289da&label=Discord&logo=discord&style=flat-square)](https://discord.gg/7Fw7snafYS)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-blueviolet.svg?style=flat-square)](https://www.npmjs.com/package/@rafaeldasilvadeveloper/fast-media-tags)

## Features

*   🚀 **High Performance**: Parses ID3 tags by reading only the first few Kilobytes of the audio file, saving memory, bandwidth, and CPU cycles.
*   📦 **Zero Dependencies**: Pure TypeScript/JavaScript binary operations. Works out-of-the-box in Node.js, Bun, Edge/Serverless functions, and modern browsers.
*   🖼️ **Album Art (APIC)**: Decodes cover photos (MIME type, format, type, description) and automatically exposes base64 and binary array data.
*   🛡️ **TypeScript Definitions**: Strongly typed return signatures.

## Installation

```bash
npm install @rafaeldasilvadeveloper/fast-media-tags
```

## Usage

### Reading tags from an ArrayBuffer

```typescript
import { readAudioTags } from '@rafaeldasilvadeveloper/fast-media-tags';

// In browser or bun
const buffer = await file.arrayBuffer();
const tags = await readAudioTags(buffer);

console.log(tags.title);  // 'Synthwave Dreams'
console.log(tags.artist); // 'CyberRunner'
console.log(tags.album);  // 'Grid Horizons'
```

### Reading tags from a Blob / File (Browser or Bun)

```typescript
import { readAudioTags } from '@rafaeldasilvadeveloper/fast-media-tags';

// Directly pass a Blob or HTML5 File object
const tags = await readAudioTags(fileBlob);
if (tags.picture) {
  console.log(`Album Art format: ${tags.picture.format}`);
  // base64 ready for <img src="...">
  const imageSrc = tags.picture.base64;
}
```

### Reading tags from a local File Path (Node.js & Bun)

```typescript
import { readAudioTags } from '@rafaeldasilvadeveloper/fast-media-tags';

const tags = await readAudioTags('./music/track.mp3');
console.log(`Title: ${tags.title}, Year: ${tags.year}`);
```

## Supported Tags

*   `title` (`TIT2`)
*   `artist` (`TPE1`)
*   `album` (`TALB`)
*   `year` (`TYER` or `TDRC`)
*   `genre` (`TCON`)
*   `picture` (`APIC`)

## Support

For support, questions, or discussions, join our Discord server:

[![Discord Server](https://img.shields.io/discord/1111111111?color=7289da&label=Discord&logo=discord&style=for-the-badge)](https://discord.gg/7Fw7snafYS)

## License
MIT
