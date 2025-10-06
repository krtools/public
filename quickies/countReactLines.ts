// countReactLines.ts
import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const projectDir = process.argv[2] || process.cwd();

function getAllFiles(dir: string, exts = ['.tsx', '.jsx']): string[] {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  return files.flatMap((f) => {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) return getAllFiles(full, exts);
    return exts.includes(path.extname(f.name)) ? [full] : [];
  });
}

function countReactComponentLines(sourceFile: ts.SourceFile) {
  let lines = 0;

  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      const jsxFinder = (n: ts.Node): boolean => {
        if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n))
          return true;
        return n.forEachChild(jsxFinder) ?? false;
      };

      if (jsxFinder(node)) {
        const { line: start } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const { line: end } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        lines += end - start + 1;
      }
    }
    node.forEachChild(visit);
  }

  visit(sourceFile);
  return lines;
}

let total = 0;
for (const file of getAllFiles(projectDir)) {
  const code = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  total += countReactComponentLines(source);
}

console.log(`Total React component lines: ${total}`);
