import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default;

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    let foundUndeclared = false;
    traverse(ast, {
      Identifier(path) {
        if (path.node.name === 't') {
          // check if it's a variable usage (not a property or declaration)
          if (path.isReferencedIdentifier()) {
            if (!path.scope.hasBinding('t')) {
              console.log(`Undeclared 't' found in ${f} at line ${path.node.loc.start.line}`);
              foundUndeclared = true;
            }
          }
        }
      }
    });
  } catch(e) {
    // console.log("Parse error", f);
  }
}
