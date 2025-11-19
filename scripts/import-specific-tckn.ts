import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';

const TARGET_TCKN = '16321502314';

function fixEncoding(text: string): string {
  return text
    .replace(/Ä°/g, 'İ')
    .replace(/Ã/g, 'Ü')
    .replace(/Ä/g, 'Ğ')
    .replace(/Å/g, 'Ş')
    .replace(/Ã/g, 'Ö')
    .replace(/Ä/g, 'Ç');
}

function extractFrom101m(): any | null {
  const filePath = path.join(process.cwd(), 'data', 'data', '101m', '101m.MYD');
  const fd = fs.openSync(filePath, 'r');
  const chunkSize = 2 * 1024 * 1024;
  const buffer = Buffer.alloc(chunkSize);
  let position = 0;

  while (true) {
    const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, position);
    if (bytesRead === 0) break;

    const text = buffer.slice(0, bytesRead).toString('latin1');
    const index = text.indexOf(TARGET_TCKN);

    if (index !== -1) {
      const line = text.substring(index, index + 250).split(/[\x00\x0A\x0D]/)[0];
      console.log('\n101m RAW:', line);
      
      const rest = line.substring(11);
      const dateMatch = rest.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);

      if (dateMatch) {
        const dateIndex = rest.indexOf(dateMatch[1]);
        const namesRaw = rest.substring(0, dateIndex);
        const names = fixEncoding(namesRaw).replace(/[^A-ZÇĞİÖŞÜ ]/gi, ' ').trim();
        console.log('Names extracted:', names);
        
        const nameWords = names.split(/\s+/).filter(w => w.length > 1);
        
        fs.closeSync(fd);
        return {
          tckn: TARGET_TCKN,
          ad: nameWords[0],
          soyad: nameWords[1],
          dogumTarihi: dateMatch[1],
        };
      }
    }

    position += chunkSize;
  }

  fs.closeSync(fd);
  return null;
}

function extractFrom109mtcpro(): any | null {
  const filePath = path.join(process.cwd(), 'data', '1o9w-7cdr0', '109mtcpro', '109mtcpro.MYD');
  const fd = fs.openSync(filePath, 'r');
  const chunkSize = 2 * 1024 * 1024;
  const buffer = Buffer.alloc(chunkSize);
  let position = 0;

  while (true) {
    const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, position);
    if (bytesRead === 0) break;

    const text = buffer.slice(0, bytesRead).toString('latin1');
    const index = text.indexOf(TARGET_TCKN);

    if (index !== -1) {
      const line = text.substring(index, index + 400).split(/[\x00\x0A\x0D]/)[0];
      console.log('\n109mtcpro RAW:', line);
      
      const fixed = fixEncoding(line);
      
      fs.closeSync(fd);
      return {
        cinsiyet: fixed.includes('Erkek') ? 'Erkek' : fixed.includes('Kadın') ? 'Kadın' : fixed.includes('KadÄ±n') ? 'Kadın' : undefined,
        medeniHal: fixed.includes('Evli') ? 'Evli' : fixed.includes('Bekâr') ? 'Bekâr' : fixed.includes('Bekar') ? 'Bekâr' : undefined,
      };
    }

    position += chunkSize;
  }

  fs.closeSync(fd);
  return null;
}

function extractFrom83madres(): any | null {
  const filePath = path.join(process.cwd(), 'data', '83w-4dr35', '83madres', '83madres.MYD');
  const fd = fs.openSync(filePath, 'r');
  const chunkSize = 2 * 1024 * 1024;
  const buffer = Buffer.alloc(chunkSize);
  let position = 0;

  while (true) {
    const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, position);
    if (bytesRead === 0) break;

    const text = buffer.slice(0, bytesRead).toString('latin1');
    const index = text.indexOf(TARGET_TCKN);

    if (index !== -1) {
      const line = text.substring(index, index + 500).split(/[\x00\x0A\x0D]/)[0];
      console.log('\n83madres RAW:', line.substring(0, 200));
      
      const fixed = fixEncoding(line);
      const afterTckn = fixed.substring(11);
      
      fs.closeSync(fd);
      return {
        ikametgah: afterTckn.trim().substring(0, 150),
      };
    }

    position += chunkSize;
  }

  fs.closeSync(fd);
  return null;
}

async function main() {
  console.log(`Extracting data for TCKN: ${TARGET_TCKN}`);
  console.log('Expected: ATA UYAROĞLU\n');

  const person = extractFrom101m();
  const tcpro = extractFrom109mtcpro();
  const adres = extractFrom83madres();

  console.log('\n' + '='.repeat(60));
  console.log('Extracted Data:');
  console.log('='.repeat(60));
  console.log('Person:', JSON.stringify(person, null, 2));
  console.log('TC Pro:', JSON.stringify(tcpro, null, 2));
  console.log('Address:', JSON.stringify(adres, null, 2));

  if (person) {
    console.log('\nInserting into database...');
    
    await prisma.citizen.upsert({
      where: { tckn: TARGET_TCKN },
      create: {
        tckn: TARGET_TCKN,
        ad: person.ad,
        soyad: person.soyad,
        dogumTarihi: person.dogumTarihi,
        cinsiyet: tcpro?.cinsiyet,
        medeniHal: tcpro?.medeniHal,
        ikametgah: adres?.ikametgah,
      },
      update: {
        ad: person.ad,
        soyad: person.soyad,
        dogumTarihi: person.dogumTarihi,
        cinsiyet: tcpro?.cinsiyet,
        medeniHal: tcpro?.medeniHal,
        ikametgah: adres?.ikametgah,
      },
    });

    console.log('✓ Record inserted/updated');
    
    const result = await prisma.citizen.findUnique({
      where: { tckn: TARGET_TCKN },
      include: { gsmNumbers: true },
    });
    
    console.log('\nFinal record:');
    console.log(JSON.stringify(result, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());






