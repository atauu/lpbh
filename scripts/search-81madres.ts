import mysql from 'mysql2/promise';

const tckns = ['14204248038', '28937513288', '16321502314'];

async function searchAll() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: '',
    database: 'citizen_db',
    charset: 'utf8mb4',
  });

  console.log('='.repeat(80));
  console.log('81madres2009_2024 VERİTABANINDA ARAMA');
  console.log('='.repeat(80));
  console.log(`Aranan TCKN'ler: ${tckns.join(', ')}\n`);

  for (const tckn of tckns) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TCKN: ${tckn}`);
    console.log('='.repeat(80));

    try {
      const [rows] = await pool.query(
        `SELECT 
         TC as TCKN,
         CONVERT(ADRES2024 USING utf8) as Adres2024,
         CONVERT(ADRES2023 USING utf8) as Adres2023,
         CONVERT(ADRES2017 USING utf8) as Adres2017,
         CONVERT(ADRES2015 USING utf8) as Adres2015,
         CONVERT(ADRES2009 USING utf8) as Adres2009,
         ID
         FROM 81madres2009_2024 
         WHERE TC = ? 
         LIMIT 10`,
        [tckn]
      );
      
      const results = rows as any[];
      
      if (results.length > 0) {
        console.log(`\n✅ ${results.length} kayıt bulundu:\n`);
        results.forEach((r: any, index: number) => {
          console.log(`--- Kayıt ${index + 1} ---`);
          console.log(`TCKN: ${r.TCKN}`);
          console.log(`ID: ${r.ID}`);
          if (r.Adres2024) console.log(`Adres 2024: ${r.Adres2024}`);
          if (r.Adres2023) console.log(`Adres 2023: ${r.Adres2023}`);
          if (r.Adres2017) console.log(`Adres 2017: ${r.Adres2017}`);
          if (r.Adres2015) console.log(`Adres 2015: ${r.Adres2015}`);
          if (r.Adres2009) console.log(`Adres 2009: ${r.Adres2009}`);
          console.log('');
        });
      } else {
        console.log('\n❌ Kayıt bulunamadı');
      }
    } catch (e: any) {
      console.log(`\n⚠️ Hata: ${e.message}`);
    }
  }

  await pool.end();
}

searchAll().catch(console.error);

