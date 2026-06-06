const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const utilsDir = path.join(srcDir, 'utils');

// 1. Create src/utils/date.ts
if (!fs.existsSync(utilsDir)) {
  fs.mkdirSync(utilsDir, { recursive: true });
}

const dateTsContent = `export function getISTDate(date: Date = new Date()): Date {
  const time = date.getTime();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(time + istOffset);
}

export function getISTDateString(date: Date = new Date()): string {
  const istDate = getISTDate(date);
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');
  
  const year = istDate.getUTCFullYear();
  const month = pad(istDate.getUTCMonth() + 1);
  const day = pad(istDate.getUTCDate());
  const hours = pad(istDate.getUTCHours());
  const minutes = pad(istDate.getUTCMinutes());
  const seconds = pad(istDate.getUTCSeconds());
  const ms = pad3(istDate.getUTCMilliseconds());

  return \`\${year}-\${month}-\${day}T\${hours}:\${minutes}:\${seconds}.\${ms}+05:30\`;
}

export function todayISTDateString(): string {
  return getISTDateString().split('T')[0];
}
`;

fs.writeFileSync(path.join(utilsDir, 'date.ts'), dateTsContent);

// 2. Process all files
function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      if (fullPath === path.join(utilsDir, 'date.ts')) continue;
      
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      if (content.includes('new Date().toISOString().split("T")[0]')) {
        content = content.replace(/new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\]/g, 'todayISTDateString()');
        changed = true;
      }
      if (content.includes('new Date().toISOString().split(\\\'T\\\')[0]')) {
        content = content.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, 'todayISTDateString()');
        changed = true;
      }
      if (content.includes('new Date().toISOString()')) {
        content = content.replace(/new Date\(\)\.toISOString\(\)/g, 'getISTDateString()');
        changed = true;
      }
      
      if (changed) {
        // compute relative path to src/utils/date
        const relPath = path.relative(path.dirname(fullPath), utilsDir).replace(/\\/g, '/');
        const importPath = relPath.startsWith('.') ? relPath : './' + relPath;
        
        const importStmt = `import { getISTDateString, todayISTDateString } from "${importPath}/date";\n`;
        
        // Add import after other imports if it's not there
        if (!content.includes('getISTDateString')) {
          // Find last import statement
          const lines = content.split('\n');
          let lastImportIdx = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('import ')) {
              lastImportIdx = i;
            }
          }
          if (lastImportIdx !== -1) {
            lines.splice(lastImportIdx + 1, 0, importStmt);
            content = lines.join('\n');
          } else {
            content = importStmt + '\n' + content;
          }
        }
        
        fs.writeFileSync(fullPath, content);
        console.log('Updated: ' + fullPath);
      }
    }
  }
}

processDir(srcDir);
console.log('Done!');
