import fs from 'fs';
import path from 'path';

function analyzeFRM(frmPath: string, tableName: string): void {
  if (!fs.existsSync(frmPath)) {
    console.log(`File not found: ${frmPath}`);
    return;
  }
  
  const buffer = fs.readFileSync(frmPath);
  const text = buffer.toString('latin1');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TABLE: ${tableName}`);
  console.log(`File: ${frmPath}`);
  console.log(`Size: ${buffer.length} bytes`);
  console.log('='.repeat(60));
  
  // Alan adlarını bul
  const fields: string[] = [];
  let current = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || (code >= 48 && code <= 57)) {
      current += char;
    } else if (current.length >= 2) {
      if (!fields.includes(current) && current.length <= 50) {
        fields.push(current);
      }
      current = '';
    } else {
      current = '';
    }
  }
  
  const likelyFields = fields.filter(f => 
    f.length >= 2 && 
    f.length <= 30 &&
    !f.match(/^[0-9]+$/) &&
    !f.includes('MyISAM') &&
    !f.includes('latin') &&
    !f.includes('CHARSET') &&
    !f.includes('ENGINE')
  );
  
  console.log(`\nPotential Fields (${likelyFields.length}):`);
  likelyFields.slice(0, 20).forEach((field, i) => {
    console.log(`  ${(i + 1).toString().padStart(2, ' ')}. ${field}`);
  });
}

function analyzeMYDSample(mydPath: string, tableName: string, sampleSize = 50000): void {
  if (!fs.existsSync(mydPath)) {
    console.log(`File not found: ${mydPath}`);
    return;
  }
  
  const stats = fs.statSync(mydPath);
  console.log(`\nData File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  
  const buffer = Buffer.alloc(sampleSize);
  const fd = fs.openSync(mydPath, 'r');
  fs.readSync(fd, buffer, 0, sampleSize, 0);
  fs.closeSync(fd);
  
  const text = buffer.toString('latin1');
  
  const lines: string[] = [];
  let current = '';
  
  for (let i = 0; i < text.length && lines.length < 10; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    if ((code >= 32 && code < 127) || code >= 160) {
      current += char;
    } else if (code === 0 || code === 10 || code === 13) {
      if (current.trim().length > 10) {
        lines.push(current.trim());
      }
      current = '';
    }
  }
  
  console.log(`\nSample Data (first ${lines.length} lines):`);
  lines.forEach((line, i) => {
    const preview = line.substring(0, 120);
    console.log(`  ${i + 1}. ${preview}${line.length > 120 ? '...' : ''}`);
  });
}

async function main() {
  const dataRoot = path.join(process.cwd(), 'data');
  
  const tables = [
    { name: '101m', path: path.join(dataRoot, 'data', '101m') },
    { name: '195mgsm', path: path.join(dataRoot, '19sw-g5w', '195mgsm') },
    { name: '109mtcpro', path: path.join(dataRoot, '1o9w-7cdr0', '109mtcpro') },
    { name: '83madres', path: path.join(dataRoot, '83w-4dr35', '83madres') },
    { name: '97mtapu', path: path.join(dataRoot, '97w-74du', '97mtapu') },
  ];
  
  for (const table of tables) {
    const frmFile = path.join(table.path, `${table.name}.frm`);
    const mydFile = path.join(table.path, `${table.name}.MYD`);
    
    if (fs.existsSync(frmFile)) {
      analyzeFRM(frmFile, table.name);
      if (fs.existsSync(mydFile)) {
        analyzeMYDSample(mydFile, table.name);
      }
    } else {
      console.log(`\n[SKIP] ${table.name} - .frm file not found`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Analysis Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);






