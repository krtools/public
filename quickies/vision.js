function renderVisionTextAnnotations(visionResponse, fontSize = 16) {
  // nuke everything
  document.body.innerHTML = "";

  // root container
  const root = document.createElement("div");
  root.style.position = "relative";
  root.style.display = "inline-block";
  root.style.background = "#f8f8f8";
  root.style.padding = "10px";
  document.body.appendChild(root);

  // overlay layer
  const overlay = document.createElement("div");
  overlay.style.position = "relative"; // parent for absolute children
  overlay.style.width = "100%";
  root.appendChild(overlay);

  // text dump
  const dump = document.createElement("pre");
  dump.style.marginTop = "20px";
  dump.style.whiteSpace = "pre-wrap";
  document.body.appendChild(dump);

  // handle textAnnotations (the format you're using)
  const anns = Array.isArray(visionResponse.textAnnotations)
    ? visionResponse.textAnnotations
    : [];

  if (anns.length === 0) {
    dump.textContent = "(no textAnnotations found)";
    return;
  }

  // item 0 = full text
  const fullText = anns[0].description || "";
  dump.textContent = fullText;

  // items 1.. = words/fragments with boundingPoly
  for (let i = 1; i < anns.length; i++) {
    const a = anns[i];
    const verts = (a.boundingPoly && a.boundingPoly.vertices) || [];

    if (verts.length === 0) continue;

    // map vertices → simple box
    const xs = verts.map(v => v.x || 0);
    const ys = verts.map(v => v.y || 0);

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    const div = document.createElement("div");
    div.textContent = a.description || "";
    div.style.position = "absolute";
    div.style.left = minX + "px";
    div.style.top = minY + "px";
    div.style.width = width + "px";
    div.style.height = height + "px";
    div.style.fontFamily = "Courier New, monospace";
    div.style.fontSize = fontSize + "px";
    div.style.lineHeight = "1";
    div.style.whiteSpace = "nowrap";
    div.style.overflow = "hidden";
    div.style.pointerEvents = "auto";

    overlay.appendChild(div);
  }
}
