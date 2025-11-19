import * as fs from 'fs';
import * as readline from 'readline';

const tckn = '14204248038';
const jsonFile = 'data/new1/adres.adres.json';

console.log(`Aranıyor: ${tckn}`);
console.log(`Dosya: ${jsonFile}`);

// JSON dosyasını stream olarak oku
const fileStream = fs.createReadStream(jsonFile, { encoding: 'utf8' });
const rl = readline.createInterface({
  input: fileStream,
  crlfDelay: Infinity,
});

let lineNumber = 0;
let found = false;
let buffer = '';
let braceCount = 0;
let inString = false;
let escapeNext = false;

let currentObject = '';
let inObject = false;

rl.on('line', (line) => {
  lineNumber++;
  
  // JSON objelerini birleştir
  currentObject += line;
  
  // Obje tamamlandı mı kontrol et
  if (line.trim().endsWith('},') || line.trim().endsWith('}')) {
    // TCKN'yi ara - hem direkt hem de $numberLong formatında
    if (currentObject.includes(`"$numberLong": "${tckn}"`) || 
        currentObject.includes(`"KimlikNo": "${tckn}"`) ||
        currentObject.includes(`"KimlikNo":{ "$numberLong": "${tckn}"`)) {
      console.log(`\n✅ BULUNDU! Satır ${lineNumber}:`);
      console.log(currentObject);
      found = true;
      
      // JSON'u parse et ve düzenli göster
      try {
        const obj = JSON.parse(currentObject.replace(/,$/, ''));
        console.log('\n📋 Düzenlenmiş Bilgiler:');
        console.log(JSON.stringify(obj, null, 2));
      } catch (e) {
        // Parse edilemezse ham veriyi göster
      }
    }
    
    // Buffer'ı temizle
    currentObject = '';
  }
  
  // Her 100000 satırda bir ilerleme göster
  if (lineNumber % 100000 === 0) {
    process.stdout.write(`\rİşlenen satır: ${lineNumber.toLocaleString()}`);
  }
});

rl.on('close', () => {
  console.log(`\n\nToplam işlenen satır: ${lineNumber.toLocaleString()}`);
  if (!found) {
    console.log(`❌ ${tckn} TCKN'si bulunamadı.`);
  } else {
    console.log(`✅ ${tckn} TCKN'si bulundu!`);
  }
});

