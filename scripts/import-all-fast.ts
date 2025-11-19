import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

function fixEncoding(text: string): string {
  return text
    .replace(/Ä°/g, 'İ')
    .replace(/Ã/g, 'Ü')
    .replace(/Ä/g, 'Ğ')
    .replace(/Å/g, 'Ş')
    .replace(/Ã/g, 'Ö')
    .replace(/Ã/g, 'Ç');
}

// 101m Parser
function parse101m(line: string): any | null {
  if (line.length < 30) return null;
  const tckn = line.substring(0, 11);
  if (!/^\d{11}$/.test(tckn)) return null;

  const rest = line.substring(11);
  const dateMatch = rest.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);

  let ad, soyad, dogumTarihi;
  if (dateMatch) {
    const dateIndex = rest.indexOf(dateMatch[1]);
    const names = fixEncoding(rest.substring(0, dateIndex)).replace(/[^A-ZÇĞİÖŞÜ ]/gi, ' ').trim();
    const nameWords = names.split(/\s+/).filter(w => w.length > 1);
    ad = nameWords[0];
    soyad = nameWords.slice(1).join(' ') || undefined;
    dogumTarihi = dateMatch[1];
  }

  return { tckn, ad, soyad, dogumTarihi };
}

// 195mgsm Parser
function parse195mgsm(line: string): any | null {
  const tcknMatch = line.match(/(\d{11})/);
  if (!tcknMatch) return null;
  
  const tckn = tcknMatch[1];
  const afterTckn = line.substring(line.indexOf(tckn) + 11);
  const gsmMatch = afterTckn.match(/(5\d{9})/);
  
  if (!gsmMatch) return null;
  return { tckn, gsm: gsmMatch[1] };
}

// 109mtcpro Parser
function parse109mtcpro(line: string): any | null {
  const tcknMatch = line.match(/(\d{11})/);
  if (!tcknMatch) return null;
  
  const tckn = tcknMatch[1];
  const fixed = fixEncoding(line);
  
  return {
    tckn,
    cinsiyet: fixed.includes('Erkek') ? 'Erkek' : fixed.includes('Kadın') ? 'Kadın' : undefined,
    medeniHal: fixed.includes('Evli') ? 'Evli' : fixed.includes('Bekâr') ? 'Bekâr' : undefined,
  };
}

// 83madres Parser
function parse83madres(line: string): any | null {
  const tcknMatch = line.match(/(\d{11})/);
  if (!tcknMatch) return null;
  
  const tckn = tcknMatch[1];
  const fixed = fixEncoding(line);
  const adresMatch = fixed.substring(11).match(/([A-ZÇĞİÖŞÜ0-9\s\.\-\/]{20,150})/);
  
  return {
    tckn,
    ikametgah: adresMatch ? adresMatch[1].trim() : undefined,
  };
}

async function importTable(
  mydPath: string,
  tableName: string,
  parser: (line: string) => any | null,
  processor: (records: any[]) => Promise<void>,
  maxRecords = 500000
): Promise<number> {
  if (!fs.existsSync(mydPath)) {
    console.log(`File not found: ${mydPath}`);
    return 0;
  }

  const fd = fs.openSync(mydPath, 'r');
  const chunkSize = 512 * 1024; // 512KB
  const buffer = Buffer.alloc(chunkSize);
  
  let current = '';
  let count = 0;
  let batch: any[] = [];
  const BATCH_SIZE = 1000;

  console.log(`\nImporting ${tableName}...`);
  let position = 0;

  while (count < maxRecords) {
    const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, position);
    if (bytesRead === 0) break;

    const text = current + buffer.slice(0, bytesRead).toString('latin1');
    const lines = text.split(/[\x00\x0A\x0D]/);
    
    current = lines.pop() || ''; // Son satır incomplete olabilir

    for (const line of lines) {
      if (count >= maxRecords) break;
      if (line.trim().length < 11) continue;

      const record = parser(line.trim());
      if (record) {
        batch.push(record);
        
        if (batch.length >= BATCH_SIZE) {
          await processor(batch);
          count += batch.length;
          if (count % 10000 === 0) {
            console.log(`  ${tableName}: ${count.toLocaleString()} records...`);
          }
          batch = [];
        }
      }
    }

    position += bytesRead;
  }

  // Son batch
  if (batch.length > 0) {
    await processor(batch);
    count += batch.length;
  }

  fs.closeSync(fd);
  console.log(`✓ ${tableName}: ${count.toLocaleString()} records imported`);
  return count;
}

async function main() {
  const dataRoot = path.join(process.cwd(), 'data');

  console.log('=== Fast Import to PostgreSQL ===');
  console.log('Importing 500K records from each table for fast queries...\n');

  // 1. Import 101m (Citizen base)
  await importTable(
    path.join(dataRoot, 'data', '101m', '101m.MYD'),
    '101m',
    parse101m,
    async (records) => {
      await prisma.citizen.createMany({
        data: records.map(r => ({
          tckn: r.tckn,
          ad: r.ad,
          soyad: r.soyad,
          dogumTarihi: r.dogumTarihi,
        })),
        skipDuplicates: true,
      });
    },
    500000
  );

  // 2. Import 195mgsm (GSM)
  await importTable(
    path.join(dataRoot, '19sw-g5w', '195mgsm', '195mgsm.MYD'),
    '195mgsm',
    parse195mgsm,
    async (records) => {
      await prisma.citizenGsm.createMany({
        data: records.map(r => ({
          tckn: r.tckn,
          gsm: r.gsm,
        })),
        skipDuplicates: true,
      });
    },
    1000000
  );

  // 3. Update Citizens with 109mtcpro data
  await importTable(
    path.join(dataRoot, '1o9w-7cdr0', '109mtcpro', '109mtcpro.MYD'),
    '109mtcpro',
    parse109mtcpro,
    async (records) => {
      for (const r of records) {
        if (r.tckn && (r.cinsiyet || r.medeniHal)) {
          await prisma.citizen.updateMany({
            where: { tckn: r.tckn },
            data: {
              cinsiyet: r.cinsiyet,
              medeniHal: r.medeniHal,
            },
          });
        }
      }
    },
    500000
  );

  // 4. Update Citizens with 83madres data
  await importTable(
    path.join(dataRoot, '83w-4dr35', '83madres', '83madres.MYD'),
    '83madres',
    parse83madres,
    async (records) => {
      for (const r of records) {
        if (r.tckn && r.ikametgah) {
          await prisma.citizen.updateMany({
            where: { tckn: r.tckn },
            data: {
              ikametgah: r.ikametgah,
            },
          });
        }
      }
    },
    500000
  );

  console.log('\n=== Import Complete! ===');
  
  // İstatistikler
  const totalCitizens = await prisma.citizen.count();
  const totalGsm = await prisma.citizenGsm.count();
  
  console.log(`\nStatistics:`);
  console.log(`- Citizens: ${totalCitizens.toLocaleString()}`);
  console.log(`- GSM Records: ${totalGsm.toLocaleString()}`);
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });






