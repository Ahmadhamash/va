import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import traverseModule from '@babel/traverse';
const traverse = traverseModule.default || traverseModule;

const dirPages = 'src/pages';
const dirComponents = 'src/components';
const files = [];

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.jsx')) {
      files.push(p);
    }
  }
}
walk(dirPages);
walk(dirComponents);

const arabicRegex = /[\u0600-\u06FF]/;
const extracted = new Set();

files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  
  traverse(ast, {
    StringLiteral(path) {
      if (arabicRegex.test(path.node.value)) {
        extracted.add(path.node.value.trim());
      }
    },
    JSXText(path) {
      if (arabicRegex.test(path.node.value)) {
        extracted.add(path.node.value.trim());
      }
    },
    TemplateElement(path) {
      if (arabicRegex.test(path.node.value.raw)) {
        extracted.add(path.node.value.raw.trim());
      }
    }
  });
});

fs.writeFileSync('extracted.json', JSON.stringify(Array.from(extracted), null, 2));
console.log('Extracted ' + extracted.size + ' strings.');
