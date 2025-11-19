import fs from 'fs';
import path from 'path';

const TARGET_TCKN = '16321502314';

function searchInFile(filePath: string, fileName: string): void {
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] ${fileName} - file not found`);
    return;
  }

  const stats = fs.statSync(filePath);
  console.log(`\nSearching in ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

  const fd = fs.openSync(filePath, 'r');
  const chunkSize = 1024 * 1024;
  const buffer = Buffer.alloc(chunkSize);
  let position = 0;

  while (position < stats.size) {
    const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, position);
    if (bytesRead === 0) break;

    const text = buffer.slice(0, bytesRead).toString('latin1');
    const index = text.indexOf(TARGET_TCKN);

    if (index !== -1) {
      const line = text.substring(Math.max(0, index - 20), Math.min(index + 200, text.length));
      console.log(`\n✓✓✓ FOUND in ${fileName}!`);
      console.log(`Position: ${(position + index) / 1024 / 1024} MB`);
      console.log(`Line: ${line.split(/[\x00\x0A\x0D]/)[0]}`);
      fs.closeSync(fd);
      return;
    }

    position += chunkSize;
  }

  fs.closeSync(fd);
  console.log(`  Not found in ${fileName}`);
}

async function main() {
  const dataRoot = path.join(process.cwd(), 'data');

  console.log(`Searching for TCKN: ${TARGET_TCKN}`);
  console.log('Expected result: ATA UYAROĞLU\n');
  console.log('='.repeat(60));

  searchInFile(path.join(dataRoot, 'data', '101m', '101m.MYD'), '101m (Person info)');
  searchInFile(path.join(dataRoot, '19sw-g5w', '195mgsm', '195mgsm.MYD'), '195mgsm (GSM)');
  searchInFile(path.join(dataRoot, '1o9w-7cdr0', '109mtcpro', '109mtcpro.MYD'), '109mtcpro (TC Pro)');
  searchInFile(path.join(dataRoot, '83w-4dr35', '83madres', '83madres.MYD'), '83madres (Address)');
  searchInFile(path.join(dataRoot, '97w-74du', '97mtapu', '97mtapu.MYD'), '97mtapu (Property)');

  console.log('\n' + '='.repeat(60));
  console.log('Search complete');
}

main().catch(console.error);






