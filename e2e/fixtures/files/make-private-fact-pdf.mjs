// Writes private-fact.pdf next to this script: one page, Helvetica, a made-up
// fact no public corpus holds, so an answer that quotes it came from the
// private collection. No dependencies; run with `node` from the repo root.
import fs from "node:fs";
import path from "node:path";

export const PRIVATE_FACT_LINES = [
  "EVE end-to-end private collection fixture.",
  "The e2e probe Zorvath-17 was calibrated at 4.2 kelvin.",
  "Zorvath-17 is a fictional instrument used only by the EVE test suite.",
];

const escape = (text) => text.replace(/[\\()]/g, (c) => `\\${c}`);
const content = [
  "BT",
  "/F1 12 Tf",
  "72 720 Td",
  "16 TL",
  ...PRIVATE_FACT_LINES.map((line) => `(${escape(line)}) Tj T*`),
  "ET",
].join("\n");

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
    "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
];

let pdf = "%PDF-1.4\n";
const offsets = objects.map((body, i) => {
  const offset = Buffer.byteLength(pdf, "latin1");
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  return offset;
});
const xref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

const out = path.join(path.dirname(new URL(import.meta.url).pathname), "private-fact.pdf");
fs.writeFileSync(out, pdf, "latin1");
console.log(`wrote ${out} (${Buffer.byteLength(pdf, "latin1")} bytes)`);
