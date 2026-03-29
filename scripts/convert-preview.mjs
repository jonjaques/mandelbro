import sharp from "sharp";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, "assets", "preview.png");
const output = path.join(root, "public", "preview.jpg");

await sharp(input).jpeg({ quality: 90, mozjpeg: true }).toFile(output);

const { width, height } = await sharp(output).metadata();
const { size } = await stat(output);
console.log(`${output} — ${width}x${height}, ${(size / 1024).toFixed(0)} KB`);
