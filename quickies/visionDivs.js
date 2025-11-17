function renderVisionAsLines(visionResponse, fontSize = 16, lineGap = 4) {
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

  // Sort top→bottom, left→right
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
  let currentWords = [];

  anns.forEach(a => {
    const verts = a.boundingPoly?.vertices || [];
    if (verts.length === 0) return;

    const minY = Math.min(...verts.map(v => v.y || 0));

    // new line if y jumps
    if (minY - currentLineY > fontSize) {
      if (currentWords.length) {
        const lineDiv = document.createElement("div");
        lineDiv.textContent = currentWords.join(" ");
        lineDiv.style.display = "block";
        lineDiv.style.marginBottom = lineGap + "px";
        root.appendChild(lineDiv);
      }
      currentWords = [];
      currentLineY = minY;
    }

    currentWords.push(a.description || "");
  });

  // append last line
  if (currentWords.length) {
    const lineDiv = document.createElement("div");
    lineDiv.textContent = currentWords.join(" ");
    lineDiv.style.display = "block";
    root.appendChild(lineDiv);
  }
}


function renderVisionAsLinesWithNewlines(visionResponse, fontSize = 16, doubleGapFactor = 1.5) {
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

  // Sort top→bottom, left→right
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
  let currentWords = [];
  const textLines = [];

  anns.forEach(a => {
    const verts = a.boundingPoly?.vertices || [];
    if (verts.length === 0) return;

    const minY = Math.min(...verts.map(v => v.y || 0));

    if (minY - currentLineY > fontSize) {
      if (currentWords.length) {
        // join words for this line
        textLines.push(currentWords.join(""));

        // add extra blank line if gap is large
        if (minY - currentLineY > fontSize * doubleGapFactor) {
          textLines.push(""); // double newline
        }
      }
      currentWords = [];
      currentLineY = minY;
    }

    currentWords.push(a.description || "");
  });

  // append last line
  if (currentWords.length) {
    textLines.push(currentWords.join(""));
  }

  // Render lines visually
  textLines.forEach(line => {
    const div = document.createElement("div");
    div.textContent = line;
    div.style.display = "block";
    root.appendChild(div);
  });

  // Also dump as <pre> for copy/paste
  const dump = document.createElement("pre");
  dump.style.marginTop = "20px";
  dump.style.whiteSpace = "pre-wrap";
  dump.textContent = textLines.join("\n");
  document.body.appendChild(dump);
}
