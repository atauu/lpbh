/**
 * Veritabanındaki il-ilçe eşleştirme hatalarını analiz eder
 * 
 * Bu script 97mtapu tablosundaki tüm il-ilçe kombinasyonlarını analiz ederek
 * hatalı eşleştirmeleri tespit eder.
 */

import { getMySQLPool } from '../lib/mysql';
import { correctIlForIlce, normalizeIlce } from '../lib/turkiye-il-ilce';

interface IlIlceCombo {
  il: string;
  ilce: string;
  count: number;
  correctedIl?: string;
  isError: boolean;
}

async function analyzeIlIlceErrors() {
  const pool = getMySQLPool();
  
  console.log('🔍 Veritabanındaki il-ilçe eşleştirmeleri analiz ediliyor...\n');
  
  try {
    // Tüm benzersiz il-ilçe kombinasyonlarını getir
    const [rows] = await pool.query(
      `SELECT DISTINCT 
       CONVERT(İlBilgisi USING utf8) as Il,
       CONVERT(İlceBilgisi USING utf8) as Ilce,
       COUNT(*) as count
       FROM 97mtapu
       WHERE İlBilgisi IS NOT NULL 
         AND İlceBilgisi IS NOT NULL
         AND TRIM(İlBilgisi) != ''
         AND TRIM(İlceBilgisi) != ''
       GROUP BY İlBilgisi, İlceBilgisi
       ORDER BY count DESC
       LIMIT 1000`
    );
    
    const combinations = rows as Array<{ Il: string; Ilce: string; count: number }>;
    
    console.log(`📊 Toplam ${combinations.length} benzersiz il-ilçe kombinasyonu bulundu\n`);
    
    const errors: IlIlceCombo[] = [];
    const correct: IlIlceCombo[] = [];
    
    // Her kombinasyonu kontrol et
    for (const combo of combinations) {
      const correctedIl = correctIlForIlce(combo.Il, combo.Ilce);
      const isError = correctedIl && normalizeIlce(combo.Il || '') !== normalizeIlce(correctedIl);
      
      const record: IlIlceCombo = {
        il: combo.Il || '',
        ilce: combo.Ilce || '',
        count: combo.count,
        correctedIl: correctedIl || undefined,
        isError: isError || false,
      };
      
      if (isError) {
        errors.push(record);
      } else {
        correct.push(record);
      }
    }
    
    // Hatalı eşleştirmeleri göster
    console.log(`❌ ${errors.length} hatalı il-ilçe eşleştirmesi bulundu:\n`);
    console.log('='.repeat(100));
    console.log('HATALI EŞLEŞTİRMELER:');
    console.log('='.repeat(100));
    console.log('İl (Veritabanı)'.padEnd(25) + 'İlçe'.padEnd(30) + 'Doğru İl'.padEnd(25) + 'Kayıt Sayısı');
    console.log('-'.repeat(100));
    
    errors.slice(0, 50).forEach((error) => {
      console.log(
        (error.il || '(boş)').padEnd(25) +
        (error.ilce || '(boş)').padEnd(30) +
        (error.correctedIl || '(bulunamadı)').padEnd(25) +
        error.count.toString()
      );
    });
    
    if (errors.length > 50) {
      console.log(`\n... ve ${errors.length - 50} tane daha hatalı eşleştirme var\n`);
    }
    
    // İstatistikler
    console.log('\n' + '='.repeat(100));
    console.log('İSTATİSTİKLER:');
    console.log('='.repeat(100));
    console.log(`✅ Doğru eşleştirme: ${correct.length}`);
    console.log(`❌ Hatalı eşleştirme: ${errors.length}`);
    console.log(`📊 Toplam kayıt sayısı (hatalı): ${errors.reduce((sum, e) => sum + e.count, 0)}`);
    
    // En çok hata olan il-ilçe kombinasyonları
    if (errors.length > 0) {
      console.log('\n' + '='.repeat(100));
      console.log('EN ÇOK HATA OLAN KOMBİNASYONLAR (Top 10):');
      console.log('='.repeat(100));
      
      const topErrors = [...errors]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      topErrors.forEach((error, index) => {
        console.log(
          `${(index + 1).toString().padStart(2)}. ` +
          `${error.il} + ${error.ilce} -> ${error.correctedIl} (${error.count} kayıt)`
        );
      });
    }
    
    // Öneriler
    console.log('\n' + '='.repeat(100));
    console.log('ÖNERİLER:');
    console.log('='.repeat(100));
    console.log('1. Hatalı eşleştirmeler için lib/turkiye-il-ilce.ts dosyasına ilçe-il mapping eklenmelidir.');
    console.log('2. Veritabanındaki verilerin kaynağı kontrol edilmeli (veri import sırasında hata olabilir).');
    console.log('3. İl kodları (31, 32 gibi) kullanılıyorsa, bunların string\'e dönüştürülmesi gerekebilir.');
    
    console.log('\n✅ Analiz tamamlandı!\n');
    
  } catch (error) {
    console.error('❌ Analiz hatası:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Script'i çalıştır
analyzeIlIlceErrors()
  .then(() => {
    console.log('Script başarıyla tamamlandı.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script hatası:', error);
    process.exit(1);
  });



