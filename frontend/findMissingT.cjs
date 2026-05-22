const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('t(\"') || content.includes('t(')) {
    if (!content.includes('useTranslation')) {
      console.log('Missing useTranslation in', f);
    } else {
      if (!content.match(/\{\s*t\s*,?/s) && 
          !content.match(/,\s*t\s*\}/s) && 
          !content.match(/\{\s*t\s*\}/s) && 
          !content.match(/t\s*\}\s*=\s*useTranslation/s) && 
          !content.match(/t\s*,\s*i18n/s)) {
             console.log('Missing t extraction in', f);
      }
    }
  }
});
