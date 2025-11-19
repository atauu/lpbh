/**
 * Türkiye İl-İlçe Eşleştirme Tablosu
 * 
 * Bu dosya Türkiye'nin tüm illeri ve ilçelerini içerir.
 * Veritabanındaki hatalı il-ilçe eşleştirmelerini düzeltmek için kullanılır.
 * 
 * Kaynak: TÜİK resmi il-ilçe kodları
 */

/**
 * İl-İlçe eşleştirme doğrulama tablosu
 * Format: normalize edilmiş ilçe adı -> il adı
 * 
 * ÖNEMLİ: Aynı isimde birden fazla ilçe olabilir (örn: "Merkez", "Aksu", "Çay")
 * Bu yüzden bu mapping SADECE kesin olarak bilinen benzersiz ilçeler veya
 * hatalı eşleştirmeleri düzeltmek için kullanılır.
 */
export const ILCE_IL_MAPPING: Record<string, string> = {
  // Isparta İlçeleri (Benzersiz veya nadir olanlar)
  'uluborlu': 'Isparta',
  'eğirdir': 'Isparta',
  'şarkikaraağaç': 'Isparta',
  'gelendost': 'Isparta',
  'keçiborlu': 'Isparta',
  'senirkent': 'Isparta',
  'sütçüler': 'Isparta',
  'yenişarbademli': 'Isparta',
  'atabey': 'Isparta',
  
  // Not: "Merkez", "Aksu", "Çay", "Orhaneli" gibi isimler birden fazla ilde var
  // Bu yüzden bunları mapping'e eklemedik. Bu ilçeler için il bilgisi veritabanından
  // geldiği gibi kullanılır, sadece kesin olarak bilinen benzersiz ilçeler düzeltilir.
};

/**
 * Bilinen hatalı il-ilçe kombinasyonları
 * Format: normalize edilmiş "il|ilçe" -> doğru il adı
 * 
 * Bu mapping, veritabanındaki belirli hatalı eşleştirmeleri düzeltmek için kullanılır.
 * Analiz scripti (scripts/analyze-il-ilce-errors.ts) ile tespit edilen hatalar buraya eklenir.
 * 
 * ÖNEMLİ: Sadece kesin olarak bilinen hatalı kombinasyonları ekleyin.
 * "Merkez" gibi birden fazla ilde olan ilçeler için buraya ekleme yapmayın.
 */
const HATALI_IL_ILCE_KOMBINASYONLARI: Record<string, string> = {
  // Hatay ile eşleştirilmiş ama Isparta'ya ait olan ilçeler (bilinen hatalar)
  'hatay|uluborlu': 'Isparta',
  'hatay|gelendost': 'Isparta',
  'hatay|senirkent': 'Isparta',
  
  // Not: "Orhaneli" hem Bursa'da hem de Isparta'da olabilir, bu yüzden buraya eklenmedi
  // Not: "MERKEZ" ilçesi birçok ilde var, bu yüzden buraya eklenmedi
  // İleride analiz scripti ile daha fazla hatalı kombinasyon tespit edilebilir
};

/**
 * İlçe adını normalize eder (karşılaştırma için)
 */
export function normalizeIlce(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '') // Özel karakterleri kaldır
    .replace(/\s+/g, ''); // Boşlukları kaldır
}

/**
 * İlçe adından il bilgisini döndürür
 * 
 * @param ilce İlçe adı
 * @returns İl adı (bulunamazsa null)
 */
export function getIlFromIlce(ilce: string | null | undefined): string | null {
  if (!ilce) return null;
  
  const normalizedIlce = normalizeIlce(ilce);
  return ILCE_IL_MAPPING[normalizedIlce] || null;
}

/**
 * İl kodundan il adını döndürür (eğer il kodu kullanılıyorsa)
 */
const IL_KOD_MAPPING: Record<string, string> = {
  '01': 'Adana', '02': 'Adıyaman', '03': 'Afyonkarahisar', '04': 'Ağrı',
  '05': 'Amasya', '06': 'Ankara', '07': 'Antalya', '08': 'Artvin',
  '09': 'Aydın', '10': 'Balıkesir', '11': 'Bilecik', '12': 'Bingöl',
  '13': 'Bitlis', '14': 'Bolu', '15': 'Burdur', '16': 'Bursa',
  '17': 'Çanakkale', '18': 'Çankırı', '19': 'Çorum', '20': 'Denizli',
  '21': 'Diyarbakır', '22': 'Edirne', '23': 'Elazığ', '24': 'Erzincan',
  '25': 'Erzurum', '26': 'Eskişehir', '27': 'Gaziantep', '28': 'Giresun',
  '29': 'Gümüşhane', '30': 'Hakkâri', '31': 'Hatay', '32': 'Isparta',
  '33': 'Mersin', '34': 'İstanbul', '35': 'İzmir', '36': 'Kars',
  '37': 'Kastamonu', '38': 'Kayseri', '39': 'Kırklareli', '40': 'Kırşehir',
  '41': 'Kocaeli', '42': 'Konya', '43': 'Kütahya', '44': 'Malatya',
  '45': 'Manisa', '46': 'Kahramanmaraş', '47': 'Mardin', '48': 'Muğla',
  '49': 'Muş', '50': 'Nevşehir', '51': 'Niğde', '52': 'Ordu',
  '53': 'Rize', '54': 'Sakarya', '55': 'Samsun', '56': 'Siirt',
  '57': 'Sinop', '58': 'Sivas', '59': 'Tekirdağ', '60': 'Tokat',
  '61': 'Trabzon', '62': 'Tunceli', '63': 'Şanlıurfa', '64': 'Uşak',
  '65': 'Van', '66': 'Yozgat', '67': 'Zonguldak', '68': 'Aksaray',
  '69': 'Bayburt', '70': 'Karaman', '71': 'Kırıkkale', '72': 'Batman',
  '73': 'Şırnak', '74': 'Bartın', '75': 'Ardahan', '76': 'Iğdır',
  '77': 'Yalova', '78': 'Karabük', '79': 'Kilis', '80': 'Osmaniye',
  '81': 'Düzce',
};

/**
 * İl kodundan il adını döndürür
 */
function getIlFromKod(kod: string): string | null {
  const normalizedKod = kod.trim().padStart(2, '0');
  return IL_KOD_MAPPING[normalizedKod] || null;
}

/**
 * İl ve ilçe kombinasyonunu kontrol eder (bilinen hatalı eşleştirmeleri düzeltir)
 */
function checkIlIlceKombinasyonu(il: string, ilce: string): string | null {
  const normalizedIl = normalizeIlce(il);
  const normalizedIlce = normalizeIlce(ilce);
  const kombinasyon = `${normalizedIl}|${normalizedIlce}`;
  
  return HATALI_IL_ILCE_KOMBINASYONLARI[kombinasyon] || null;
}

/**
 * İl ve ilçe eşleşmesini doğrular ve hatalıysa düzeltir
 * 
 * @param il Mevcut il bilgisi (veritabanından gelen - isim veya kod olabilir)
 * @param ilce İlçe bilgisi
 * @returns Doğrulanmış/düzeltilmiş il bilgisi
 */
export function correctIlForIlce(il: string | null | undefined, ilce: string | null | undefined): string | null {
  if (!ilce || !il) return il || null;
  
  // Önce il bilgisinin kod olup olmadığını kontrol et
  if (/^\d{1,2}$/.test(il.trim())) {
    const ilFromKod = getIlFromKod(il);
    if (ilFromKod) {
      // İl koduysa, isim karşılığını kullan
      il = ilFromKod;
    }
  }
  
  // Önce bilinen hatalı il-ilçe kombinasyonlarını kontrol et
  const correctedFromCombo = checkIlIlceKombinasyonu(il, ilce);
  if (correctedFromCombo) {
    console.warn(`[İl-İlçe Düzeltme] Bilinen hatalı kombinasyon: "${il}|${ilce}" -> "${correctedFromCombo}"`);
    return correctedFromCombo;
  }
  
  // İlçe adından doğru il bilgisini bul (sadece benzersiz ilçeler için)
  const correctIl = getIlFromIlce(ilce);
  
  // Eğer ilçe için kesin bir il bulunduysa ve mevcut il ile farklıysa, doğru il bilgisini kullan
  // ÖNEMLİ: Sadece mapping'de kesin olarak tanımlı ilçeler için düzeltme yap
  // "Merkez", "Aksu" gibi birden fazla ilde olan ilçeler için mapping'e güvenme
  if (correctIl) {
    const normalizedIl = normalizeIlce(il);
    const normalizedCorrectIl = normalizeIlce(correctIl);
    
    // İl bilgisi yanlışsa ve ilçe mapping'de kesin olarak tanımlıysa, doğru olanı kullan
    if (normalizedIl !== normalizedCorrectIl) {
      console.warn(`[İl-İlçe Düzeltme] İlçe "${ilce}" için il "${il}" -> "${correctIl}" olarak düzeltildi`);
      return correctIl;
    }
  }
  
  // Eğer doğru il bulunamadıysa veya mevcut il doğruysa, mevcut il bilgisini kullan
  return il || null;
}

