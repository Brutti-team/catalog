import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import MaterialsContent from "../src/components/MaterialsContent";

describe("customer materials formatting", () => {
  it("renders the existing quick-view material markers as bold labels on separate lines", () => {
    const html = renderToStaticMarkup(createElement(MaterialsContent, { value: "**Top :** Solid Pine Fingerjoint board with clear Finishing\n**Structure & body :** Solid Pine Wood and plywood with paint finishing" }));
    expect(html).toContain("<strong>Top :</strong>");
    expect(html).toContain("<strong>Structure &amp; body :</strong>");
    expect(html).not.toContain("**");
    expect(html.match(/<p>/g)).toHaveLength(2);
  });
  it("preserves lists and italic formatting without interpreting HTML", () => {
    const html = renderToStaticMarkup(createElement(MaterialsContent, { value: "• *Satin finish*\n• <script>example</script>" }));
    expect(html).toContain("<ul>");
    expect(html).toContain("<em>Satin finish</em>");
    expect(html).not.toContain("<script>");
  });
});
