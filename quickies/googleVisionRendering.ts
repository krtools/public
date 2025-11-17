// container: HTMLElement where the image+overlays go
// annotation: result.fullTextAnnotation from Vision
// imgSrc: original image URL
// fontSize: px size to render text overlays
export function renderVisionOverlay({
  container,
  annotation,
  imgSrc,
  fontSize = 14
}: {
  container: HTMLElement;
  annotation: any;
  imgSrc: string;
  fontSize?: number;
}) {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";

  const img = document.createElement("img");
  img.src = imgSrc;
  img.style.display = "block";
  wrapper.appendChild(img);

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.pointerEvents = "none";
  wrapper.appendChild(overlay);

  container.appendChild(wrapper);

  const textDump = document.createElement("pre");
  textDump.style.marginTop = "20px";
  textDump.style.whiteSpace = "pre-wrap";
  container.appendChild(textDump);

  img.onload = () => {
    const page = annotation.pages?.[0];
    if (!page) return;

    const dumpLines: string[] = [];

    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        const words: string[] = [];

        for (const w of para.words ?? []) {
          const text = (w.symbols ?? []).map((s: any) => s.text).join("");
          words.push(text);

          const v = w.boundingBox?.vertices ?? [];
          if (v.length === 4) {
            const x = v[0].x || 0;
            const y = v[0].y || 0;
            const width = (v[1].x || 0) - x;
            const height = (v[2].y || 0) - y;

            const div = document.createElement("div");
            div.textContent = text;
            div.style.position = "absolute";
            div.style.left = x + "px";
            div.style.top = y + "px";
            div.style.width = width + "px";
            div.style.height = height + "px";
            div.style.fontFamily = "Courier New, monospace";
            div.style.fontSize = fontSize + "px";
            div.style.lineHeight = "1";
            div.style.whiteSpace = "nowrap";
            div.style.overflow = "hidden";

            overlay.appendChild(div);
          }
        }

        dumpLines.push(words.join(" "));
      }
      dumpLines.push(""); // blank line between blocks
    }

    textDump.textContent = dumpLines.join("\n");
  };
}
