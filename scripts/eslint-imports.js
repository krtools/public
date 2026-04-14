import { ESLint } from 'eslint';

async function run() {
  const patterns = process.argv.slice(2);
  if (!patterns.length) {
    console.error('Usage: node fix-imports.ts <glob...>');
    process.exit(1);
  }

  const eslint = new ESLint({
    fix: true,
    overrideConfig: {
      parser: '@typescript-eslint/parser',
      plugins: ['unused-imports'],
      rules: {
        'unused-imports/no-unused-imports': 'error',
      },
    },
    useEslintrc: false,
  });

  const results = await eslint.lintFiles(patterns);
  await ESLint.outputFixes(results);

  const formatter = await eslint.loadFormatter('stylish');
  console.log(formatter.format(results));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
