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
  console.log('NEW2 VERİTABANLARINDA ARAMA');
  console.log('='.repeat(80));
  console.log(`Aranan TCKN'ler: ${tckns.join(', ')}\n`);

  for (const tckn of tckns) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TCKN: ${tckn}`);
    console.log('='.repeat(80));

    // 116mgsm
    try {
      const [rows116] = await pool.query(
        'SELECT * FROM 116mgsm WHERE TC = ? LIMIT 10',
        [tckn]
      );
      if ((rows116 as any[]).length > 0) {
        console.log('\n✅ 116mgsm:');
        (rows116 as any[]).forEach((r: any) => {
          console.log(JSON.stringify(r, null, 2));
        });
      } else {
        console.log('\n❌ 116mgsm: Bulunamadı');
      }
    } catch (e: any) {
      console.log(`\n⚠️ 116mgsm: Hata - ${e.message}`);
    }

    // 120mgsm
    try {
      const [rows120] = await pool.query(
        'SELECT * FROM 120mgsm WHERE TC = ? LIMIT 10',
        [tckn]
      );
      if ((rows120 as any[]).length > 0) {
        console.log('\n✅ 120mgsm:');
        (rows120 as any[]).forEach((r: any) => {
          console.log(JSON.stringify(r, null, 2));
        });
      } else {
        console.log('\n❌ 120mgsm: Bulunamadı');
      }
    } catch (e: any) {
      console.log(`\n⚠️ 120mgsm: Hata - ${e.message}`);
    }

    // 135mgsm
    try {
      const [rows135] = await pool.query(
        'SELECT * FROM 135mgsm WHERE TC = ? LIMIT 10',
        [tckn]
      );
      if ((rows135 as any[]).length > 0) {
        console.log('\n✅ 135mgsm:');
        (rows135 as any[]).forEach((r: any) => {
          console.log(JSON.stringify(r, null, 2));
        });
      } else {
        console.log('\n❌ 135mgsm: Bulunamadı');
      }
    } catch (e: any) {
      console.log(`\n⚠️ 135mgsm: Hata - ${e.message}`);
    }

    // 81madres2009_2024
    try {
      const [rows81] = await pool.query(
        `SELECT CONVERT(KimlikNo USING utf8) as TCKN,
         CONVERT(AdSoyad USING utf8) as AdSoyad,
         CONVERT(DogumYeri USING utf8) as DogumYeri,
         CONVERT(VergiNumarasi USING utf8) as VergiNo,
         CONVERT(Ikametgah USING utf8) as Adres
         FROM 81madres2009_2024 WHERE KimlikNo = ? LIMIT 10`,
        [tckn]
      );
      if ((rows81 as any[]).length > 0) {
        console.log('\n✅ 81madres2009_2024:');
        (rows81 as any[]).forEach((r: any) => {
          console.log(JSON.stringify(r, null, 2));
        });
      } else {
        console.log('\n❌ 81madres2009_2024: Bulunamadı');
      }
    } catch (e: any) {
      console.log(`\n⚠️ 81madres2009_2024: Hata - ${e.message}`);
    }
  }

  await pool.end();
}

searchAll().catch(console.error);





