/** Minimal PDF 1.4 writer for browser-rendered RGB JPEG pages.
 * No remote scripts, dependencies, or credentials. Offsets are byte offsets.
 */
export type PdfLink = { x: number; y: number; w: number; h: number; page: number };
export type PdfRasterPage = { jpeg: ArrayBuffer; width: number; height: number; links?: PdfLink[] };
const W = 595.28, H = 841.89;
export function makeCatalogPdf(pages: PdfRasterPage[]): Blob {
  if (!pages.length) throw new Error("No PDF pages to export.");
  const chunks: BlobPart[] = [];
  const enc = new TextEncoder();
  let offset = 0;
  const offsets: number[] = [0];
  const append = (data: string | ArrayBuffer) => {
    const bytes = typeof data === "string" ? enc.encode(data).buffer as ArrayBuffer : data;
    chunks.push(bytes); offset += bytes.byteLength;
  };
  const obj = (id: number, parts: (string | ArrayBuffer)[]) => {
    offsets[id] = offset; append(id + " 0 obj\n");
    parts.forEach(append); append("\nendobj\n");
  };
  const pageId = (index: number) => 3 + index * 3;
  append("%PDF-1.4\n");
  obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  obj(2, ["<< /Type /Pages /Count " + pages.length + " /Kids [" + pages.map((_,i) => pageId(i) + " 0 R").join(" ") + "] >>"]);
  pages.forEach((p,i) => {
    const id = pageId(i);
    const annotations = (p.links ?? []).filter(l => l.page >= 0 && l.page < pages.length).map(l => {
      const x = l.x * W / p.width, y = H - (l.y + l.h) * H / p.height;
      return "<< /Type /Annot /Subtype /Link /Rect [" + [x,y,x+l.w*W/p.width,y+l.h*H/p.height].map(v=>v.toFixed(2)).join(" ") + "] /Border [0 0 0] /Dest [" + pageId(l.page) + " 0 R /Fit] >>";
    });
    obj(id, ["<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /XObject << /Im0 " + (id+1) + " 0 R >> >> /Contents " + (id+2) + " 0 R" + (annotations.length ? " /Annots [" + annotations.join(" ") + "]" : "") + " >>"]);
    obj(id+1, ["<< /Type /XObject /Subtype /Image /Width " + p.width + " /Height " + p.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpeg.byteLength + " >>\nstream\n", p.jpeg, "\nendstream"]);
    const stream = "q " + W + " 0 0 " + H + " 0 0 cm /Im0 Do Q\n";
    obj(id+2, ["<< /Length " + enc.encode(stream).length + " >>\nstream\n" + stream + "endstream"]);
  });
  const xref = offset;
  append("xref\n0 " + offsets.length + "\n0000000000 65535 f \n");
  for (let i=1;i<offsets.length;i++) append(String(offsets[i]).padStart(10,"0") + " 00000 n \n");
  append("trailer\n<< /Size " + offsets.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
  return new Blob(chunks, { type: "application/pdf" });
}
