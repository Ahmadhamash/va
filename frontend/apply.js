import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import traverseModule from '@babel/traverse';
import generatorModule from '@babel/generator';

const traverse = traverseModule.default || traverseModule;
const generate = generatorModule.default || generatorModule;

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

const map = JSON.parse(fs.readFileSync('map.json', 'utf8'));
const arJsonPath = 'src/locales/ar.json';
const enJsonPath = 'src/locales/en.json';

const arData = JSON.parse(fs.readFileSync(arJsonPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));

// Build key map: text -> key
const keyMap = {};
let counter = 0;
for (const [arText, enText] of Object.entries(map)) {
  const key = 'txt_' + counter++;
  keyMap[arText] = key;
  arData[key] = arText;
  enData[key] = enText;
}

fs.writeFileSync(arJsonPath, JSON.stringify(arData, null, 2));
fs.writeFileSync(enJsonPath, JSON.stringify(enData, null, 2));

const arabicRegex = /[\u0600-\u06FF]/;

files.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    console.log('Skipping ' + f + ' due to parse error.');
    return;
  }
  
  let modified = false;
  let hasUseTranslationImport = false;
  let useTranslationDeclarations = new Set();
  let reactComponents = [];

  traverse(ast, {
    ImportDeclaration(p) {
      if (p.node.source.value === 'react-i18next') {
        hasUseTranslationImport = true;
      }
    },
    FunctionDeclaration(p) {
      // Very basic check if it's a React component
      if (p.node.id && p.node.id.name[0] === p.node.id.name[0].toUpperCase()) {
        reactComponents.push(p);
      }
    },
    VariableDeclarator(p) {
      if (p.node.id.type === 'ObjectPattern') {
        const hasT = p.node.id.properties.some(prop => prop.key && prop.key.name === 't');
        if (hasT && p.node.init && p.node.init.callee && p.node.init.callee.name === 'useTranslation') {
          // Find the parent function
          let current = p;
          while (current && current.node.type !== 'FunctionDeclaration' && current.node.type !== 'ArrowFunctionExpression') {
            current = current.parentPath;
          }
          if (current) useTranslationDeclarations.add(current.node);
        }
      }
    },
    StringLiteral(p) {
      const val = p.node.value.trim();
      if (arabicRegex.test(val) && keyMap[val]) {
        const key = keyMap[val];
        // If it's a JSX attribute: placeholder="مرحبا" -> placeholder={t('key')}
        if (p.parent.type === 'JSXAttribute') {
          p.replaceWith({
            type: 'JSXExpressionContainer',
            expression: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 't' },
              arguments: [{ type: 'StringLiteral', value: key }]
            }
          });
        } else {
          // Regular string -> t('key')
          p.replaceWith({
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 't' },
            arguments: [{ type: 'StringLiteral', value: key }]
          });
        }
        modified = true;
      }
    },
    JSXText(p) {
      const val = p.node.value.trim();
      if (arabicRegex.test(val) && keyMap[val]) {
        const key = keyMap[val];
        p.replaceWith({
          type: 'JSXExpressionContainer',
          expression: {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 't' },
            arguments: [{ type: 'StringLiteral', value: key }]
          }
        });
        modified = true;
      }
    }
  });

  if (modified) {
    // Add import if needed
    if (!hasUseTranslationImport) {
      ast.program.body.unshift(
        parser.parse('import { useTranslation } from "react-i18next";', { sourceType: 'module' }).program.body[0]
      );
    }
    
    // Add const { t } = useTranslation(); to all React components that don't have it
    reactComponents.forEach(comp => {
      if (!useTranslationDeclarations.has(comp.node)) {
        comp.node.body.body.unshift(
          parser.parse('const { t } = useTranslation();', { sourceType: 'module' }).program.body[0]
        );
      }
    });

    const output = generate(ast, {}, code);
    // Babel generator sometimes removes line breaks or messes up formatting slightly, but it works
    fs.writeFileSync(f, output.code);
    console.log('Updated ' + f);
  }
});
