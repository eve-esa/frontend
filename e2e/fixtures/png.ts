import { deflateSync } from "node:zlib";

/** A file Playwright can hand to a file input or a multipart body. */
export type FilePayload = { name: string; mimeType: string; buffer: Buffer };

type Rgb = readonly [number, number, number];

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/**
 * A real PNG, built in memory so no binary sits in the repo: the left half in `left`, the right
 * half in `right`. The backend sniffs the magic bytes, so a renamed text file would be refused.
 */
export function twoTonePng(width: number, height: number, left: Rgb, right: Rgb): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour RGB
  const row = Buffer.alloc(1 + width * 3); // filter byte 0, then the pixels
  for (let x = 0; x < width; x += 1) {
    const [r, g, b] = x < width / 2 ? left : right;
    row.set([r, g, b], 1 + x * 3);
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Size of the test image: larger than the lightbox's minimum canvas, so a zoomed image pans. */
export const TEST_IMAGE = { width: 640, height: 480 } as const;

/** A uniquely named PNG for one run, so the UI and the API can find this upload among older ones. */
export function testImage(prefix: string): FilePayload {
  return {
    name: `${prefix}-${Date.now()}.png`,
    mimeType: "image/png",
    buffer: twoTonePng(TEST_IMAGE.width, TEST_IMAGE.height, [0x00, 0x32, 0x47], [0x00, 0xae, 0x9d]),
  };
}
