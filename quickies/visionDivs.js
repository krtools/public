function renderVisionFlow(visionResponse, fontSize = 16, lineGap = 4) {
  document.body.innerHTML = "";

  const root = document.createElement("div");
  root.style.fontFamily = "Courier New, monospace";
  root.style.fontSize = fontSize + "px";
  root.style.lineHeight = "1.2";
  root.style.display = "inline-block";
  document.body.appendChild(root);

  const anns = Array.isArray(visionResponse.textAnnotations)
    ? visionResponse.textAnnotations.slice(1) // skip full text
    : [];

  if (anns.length === 0) {
    root.textContent = "(no textAnnotations found)";
    return;
  }

  // Sort words top→bottom, left→right
  anns.sort((a, b) => {
    const aY = Math.min(...(a.boundingPoly?.vertices?.map(v => v.y || 0) || [0]));
    const bY = Math.min(...(b.boundingPoly?.vertices?.map(v => v.y || 0) || [0]));
    if (Math.abs(aY - bY) < fontSize * 0.8) {
      const aX = Math.min(...(a.boundingPoly?.vertices?.map(v => v.x || 0) || [0]));
      const bX = Math.min(...(b.boundingPoly?.vertices?.map(v => v.x || 0) || [0]));
      return aX - bX;
    }
    return aY - bY;
  });

  let currentLineY = -Infinity;
  let lineDiv;

  anns.forEach(a => {
    const verts = a.boundingPoly?.vertices || [];
    if (verts.length === 0) return;

    const minY = Math.min(...verts.map(v => v.y || 0));

    // new line if y jumps
    if (minY - currentLineY > fontSize) {
      lineDiv = document.createElement("div");
      lineDiv.style.display = "flex";
      lineDiv.style.gap = "4px"; // horizontal space between words
      lineDiv.style.marginBottom = lineGap + "px";
      root.appendChild(lineDiv);
      currentLineY = minY;
    }

    const wordDiv = document.createElement("div");
    wordDiv.textContent = a.description || "";
    lineDiv.appendChild(wordDiv);
  });
}
