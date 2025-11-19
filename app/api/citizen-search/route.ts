import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getMySQLPool } from '@/lib/mysql';
import { correctIlForIlce } from '@/lib/turkiye-il-ilce';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Arama parametreleri
    const tckn = searchParams.get('tckn');
    const gsm = searchParams.get('gsm');
    const ad = searchParams.get('ad');
    const soyad = searchParams.get('soyad');
    const il = searchParams.get('il');
    const ilce = searchParams.get('ilce');
    const anneAdi = searchParams.get('anneAdi');
    const anneTc = searchParams.get('anneTc');
    const babaAdi = searchParams.get('babaAdi');
    const babaTc = searchParams.get('babaTc');
    const dogumTarihi = searchParams.get('dogumTarihi');
    const nameFilterActive = searchParams.get('nameFilterActive') === 'true';

    const pool = getMySQLPool();
    
    // TCKN ile direkt arama
    if (tckn) {
      return await searchByTckn(pool, tckn);
    }
    
    // GSM ile arama
    if (gsm) {
      const [rows] = await pool.query('SELECT TC FROM 195mgsm WHERE GSM = ? LIMIT 1', [gsm]);
      const gsmRows = rows as any[];
      if (gsmRows.length > 0) {
        return await searchByTckn(pool, gsmRows[0].TC);
      }
      return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
    }

    // Filtreli arama (109mtcpro tablosundan)
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (ad) {
      whereClauses.push(nameFilterActive ? 'AD LIKE ?' : 'AD = ?');
      params.push(nameFilterActive ? `${ad}%` : ad);
    }
    if (soyad) {
      whereClauses.push('SOYAD LIKE ?');
      params.push(`%${soyad}%`);
    }
    if (il) {
      whereClauses.push('ADRESIL LIKE ?');
      params.push(`%${il}%`);
    }
    if (ilce) {
      whereClauses.push('ADRESILCE LIKE ?');
      params.push(`%${ilce}%`);
    }
    if (anneAdi) {
      whereClauses.push('ANNEADI LIKE ?');
      params.push(`%${anneAdi}%`);
    }
    if (anneTc) {
      whereClauses.push('ANNETC = ?');
      params.push(anneTc);
    }
    if (babaAdi) {
      whereClauses.push('BABAADI LIKE ?');
      params.push(`%${babaAdi}%`);
    }
    if (babaTc) {
      whereClauses.push('BABATC = ?');
      params.push(babaTc);
    }
    if (dogumTarihi) {
      whereClauses.push('DOGUMTARIHI = ?');
      params.push(dogumTarihi);
    }

    if (whereClauses.length === 0) {
      return NextResponse.json({ error: 'En az bir arama kriteri girin' }, { status: 400 });
    }

    const whereSQL = whereClauses.join(' AND ');
    const [rows] = await pool.query(
      `SELECT TC, 
       CONVERT(AD USING utf8) as AD, 
       CONVERT(SOYAD USING utf8) as SOYAD, 
       DOGUMTARIHI, 
       CONVERT(CINSIYET USING utf8) as CINSIYET, 
       CONVERT(MEDENIHAL USING utf8) as MEDENIHAL, 
       CONVERT(ADRESIL USING utf8) as ADRESIL, 
       CONVERT(ADRESILCE USING utf8) as ADRESILCE,
       CONVERT(ANNEADI USING utf8) as ANNEADI,
       ANNETC,
       CONVERT(BABAADI USING utf8) as BABAADI,
       BABATC
       FROM 109mtcpro 
       WHERE ${whereSQL} 
       LIMIT 50`,
      params
    );

    const results = rows as any[];
    
    if (results.length === 0) {
      return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
    }

    // Sadece temel bilgileri döndür - detaylı bilgi tek kayıt sorgulanırken
    const simplifiedResults = results.map((r) => ({
      tckn: r.TC,
      ad: r.AD,
      soyad: r.SOYAD,
      dogumTarihi: r.DOGUMTARIHI,
      cinsiyet: r.CINSIYET,
      medeniHal: r.MEDENIHAL,
      adresIl: r.ADRESIL,
      adresIlce: r.ADRESILCE,
      anneAdi: r.ANNEADI,
      anneTc: r.ANNETC,
      babaAdi: r.BABAADI,
      babaTc: r.BABATC,
      aileSiraNo: r.AILESIRANO,
      bireySiraNo: r.BIREYSIRANO,
    }));

    return NextResponse.json({ success: true, data: simplifiedResults, multiple: true });
  } catch (error) {
    console.error('Citizen search error:', error);
    return NextResponse.json(
      { error: 'Arama yapılamadı', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

async function searchByTckn(pool: any, tckn: string) {
  // Tüm tablolardan bilgi çek - CONVERT ile encoding düzelt
  const [person109] = await pool.query(
    `SELECT TC, 
     CONVERT(AD USING utf8) as AD, 
     CONVERT(SOYAD USING utf8) as SOYAD, 
     DOGUMTARIHI, 
     CONVERT(CINSIYET USING utf8) as CINSIYET, 
     CONVERT(MEDENIHAL USING utf8) as MEDENIHAL, 
     CONVERT(ADRESIL USING utf8) as ADRESIL, 
     CONVERT(ADRESILCE USING utf8) as ADRESILCE, 
     CONVERT(ANNEADI USING utf8) as ANNEADI, 
     ANNETC, 
     CONVERT(BABAADI USING utf8) as BABAADI, 
     BABATC,
     AILESIRANO,
     BIREYSIRANO
     FROM 109mtcpro WHERE TC = ? LIMIT 1`,
    [tckn]
  );
  
  const [gsmRecords] = await pool.query(
    'SELECT GSM FROM 195mgsm WHERE TC = ? LIMIT 10',
    [tckn]
  );
  
  const [address] = await pool.query(
    `SELECT AdSoyad, 
     CONVERT(DogumYeri USING utf8) as DogumYeri, 
     CONVERT(Ikametgah USING utf8) as Ikametgah, 
     VergiNumarasi 
     FROM 83madres WHERE KimlikNo = ? LIMIT 1`,
    [tckn]
  );

  // 81madres2009_2024 - Güncel adres bilgileri (2009-2024)
  const [address2009_2024] = await pool.query(
    `SELECT TC,
     CONVERT(ADRES2024 USING utf8) as ADRES2024,
     CONVERT(ADRES2023 USING utf8) as ADRES2023,
     CONVERT(ADRES2017 USING utf8) as ADRES2017,
     CONVERT(ADRES2015 USING utf8) as ADRES2015,
     CONVERT(ADRES2009 USING utf8) as ADRES2009,
     ID
     FROM 81madres2009_2024 WHERE TC = ? LIMIT 1`,
    [tckn]
  );

  const [properties] = await pool.query(
    `SELECT 
     CONVERT(İlBilgisi USING utf8) as Il, 
     CONVERT(İlceBilgisi USING utf8) as Ilce, 
     CONVERT(MahalleBilgisi USING utf8) as Mahalle,
     CONVERT(ZeminTipBilgisi USING utf8) as ZeminTip,
     AdaBilgisi as Ada,
     ParselBilgisi as Parsel,
     YuzolcumBilgisi as Yuzolcum,
     CONVERT(AnaTasinmazNitelik USING utf8) as Nitelik,
     BlokBilgisi as Blok,
     BagimsizBolumNo,
     ArsaPay,
     ArsaPayda,
     CONVERT(BagimsizBolumNitelik USING utf8) as BolumNitelik
     FROM 97mtapu WHERE Identify = ? LIMIT 5`,
    [tckn]
  );

  const person = person109 as any[];
  const gsms = gsmRecords as any[];
  const addr = address as any[];
  const addr2009_2024 = address2009_2024 as any[];
  const props = properties as any[];

  if (person.length === 0 && gsms.length === 0 && addr.length === 0 && addr2009_2024.length === 0 && props.length === 0) {
    return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 });
  }

  // Sonucu birleştir
  const result: any = {
    tckn: tckn,
  };

  if (person.length > 0) {
    result.ad = person[0].AD;
    result.soyad = person[0].SOYAD;
    result.dogumTarihi = person[0].DOGUMTARIHI;
    result.cinsiyet = person[0].CINSIYET;
    result.medeniHal = person[0].MEDENIHAL;
    result.adresIl = person[0].ADRESIL;
    result.adresIlce = person[0].ADRESILCE;
    result.anneAdi = person[0].ANNEADI;
    result.anneTc = person[0].ANNETC;
    result.babaAdi = person[0].BABAADI;
    result.babaTc = person[0].BABATC;
    result.aileSiraNo = person[0].AILESIRANO;
    result.bireySiraNo = person[0].BIREYSIRANO;
    
    // Anne GSM numaralarını bul
    if (person[0].ANNETC) {
      const [anneGsms] = await pool.query(
        'SELECT GSM FROM 195mgsm WHERE TC = ? LIMIT 10',
        [person[0].ANNETC]
      );
      const anneGsmList = anneGsms as any[];
      if (anneGsmList.length > 0) {
        result.anneGsmNumaralari = anneGsmList.map((g: any) => ({ gsm: g.GSM }));
      }
    }
    
    // Baba GSM numaralarını bul
    if (person[0].BABATC) {
      const [babaGsms] = await pool.query(
        'SELECT GSM FROM 195mgsm WHERE TC = ? LIMIT 10',
        [person[0].BABATC]
      );
      const babaGsmList = babaGsms as any[];
      if (babaGsmList.length > 0) {
        result.babaGsmNumaralari = babaGsmList.map((g: any) => ({ gsm: g.GSM }));
      }
    }
  }

  if (addr.length > 0) {
    result.dogumYeri = addr[0].DogumYeri;
    result.ikametgah = addr[0].Ikametgah;
    result.vergiNumarasi = addr[0].VergiNumarasi;
  }

  // Güncel adres bilgileri (2009-2024)
  if (addr2009_2024.length > 0) {
    result.guncelAdresler = {
      adres2024: addr2009_2024[0].ADRES2024 || null,
      adres2023: addr2009_2024[0].ADRES2023 || null,
      adres2017: addr2009_2024[0].ADRES2017 || null,
      adres2015: addr2009_2024[0].ADRES2015 || null,
      adres2009: addr2009_2024[0].ADRES2009 || null,
    };
  }

  if (gsms.length > 0) {
    result.gsmNumaralari = gsms.map((g: any) => ({ gsm: g.GSM }));
  }

  if (props.length > 0) {
    result.tapuBilgileri = props.map((p: any) => {
      // İl bilgisini ilçeye göre doğrula ve düzelt (veritabanı hatası varsa otomatik düzeltilir)
      const correctedIl = correctIlForIlce(p.Il, p.Ilce);
      
      return {
        il: correctedIl,
        ilce: p.Ilce,
        mahalle: p.Mahalle,
        zeminTip: p.ZeminTip,
        ada: p.Ada,
        parsel: p.Parsel,
        yuzolcum: p.Yuzolcum,
        nitelik: p.Nitelik,
        blok: p.Blok,
        bagimsizBolumNo: p.BagimsizBolumNo,
        arsaPay: p.ArsaPay,
        arsaPayda: p.ArsaPayda,
        bolumNitelik: p.BolumNitelik,
      };
    });
  }

  // Aynı hanedeki kişileri bul (Anne/Baba TC ile)
  const householdMembers: any[] = [];
  
  if (person.length > 0 && (person[0].ANNETC || person[0].BABATC)) {
    const anneTc = person[0].ANNETC;
    const babaTc = person[0].BABATC;
    
    // Kardeşler: Aynı anne veya baba TC'sine sahip
    const [siblings] = await pool.query(
      `SELECT TC, 
       CONVERT(AD USING utf8) as AD, 
       CONVERT(SOYAD USING utf8) as SOYAD,
       DOGUMTARIHI,
       CONVERT(CINSIYET USING utf8) as CINSIYET,
       ANNETC,
       BABATC
       FROM 109mtcpro 
       WHERE (ANNETC = ? OR BABATC = ?) AND TC != ?
       LIMIT 50`,
      [anneTc || babaTc, babaTc || anneTc, tckn]
    );
    
    const siblingsList = siblings as any[];
    
    // Her kardeş için GSM numaralarını bul
    for (const s of siblingsList) {
      const [siblingGsms] = await pool.query(
        'SELECT GSM FROM 195mgsm WHERE TC = ? LIMIT 10',
        [s.TC]
      );
      
      const gsms = siblingGsms as any[];
      
      // İlişki türünü belirle
      const anneAyni = anneTc && s.ANNETC === anneTc;
      const babaAyni = babaTc && s.BABATC === babaTc;
      
      let iliski = '';
      if (anneAyni && babaAyni) {
        iliski = 'Kardeş (Anne ve Baba aynı)';
      } else if (anneAyni) {
        iliski = 'Kardeş (Anne aynı)';
      } else if (babaAyni) {
        iliski = 'Kardeş (Baba aynı)';
      } else {
        iliski = 'Kardeş (muhtemel)';
      }
      
      householdMembers.push({
        tckn: s.TC,
        ad: s.AD,
        soyad: s.SOYAD,
        dogumTarihi: s.DOGUMTARIHI,
        cinsiyet: s.CINSIYET,
        iliski,
        gsmNumaralari: gsms.map((g: any) => ({ gsm: g.GSM })),
      });
    }
  }

  console.log('Household members found:', householdMembers.length);
  
  if (householdMembers.length > 0) {
    result.kardesler = householdMembers;
  }

  // Aynı adreste yaşayanları bul
  const sameAddressMembers: any[] = [];
  
  if (addr.length > 0 && addr[0].Ikametgah) {
    const [sameAddr] = await pool.query(
      `SELECT a.KimlikNo as TC, a.AdSoyad
       FROM 83madres a
       WHERE a.Ikametgah = ? AND a.KimlikNo != ?
       LIMIT 20`,
      [addr[0].Ikametgah, tckn]
    );
    
    const sameAddrList = sameAddr as any[];
    
    // Her kişi için ek bilgi çek
    for (const sa of sameAddrList) {
      const [personInfo] = await pool.query(
        `SELECT CONVERT(AD USING utf8) as AD, 
         CONVERT(SOYAD USING utf8) as SOYAD,
         DOGUMTARIHI,
         CONVERT(CINSIYET USING utf8) as CINSIYET
         FROM 109mtcpro WHERE TC = ? LIMIT 1`,
        [sa.TC]
      );
      
      const pInfo = personInfo as any[];
      if (pInfo.length > 0) {
        // GSM numaralarını bul
        const [gsms] = await pool.query(
          'SELECT GSM FROM 195mgsm WHERE TC = ? LIMIT 10',
          [sa.TC]
        );
        
        const gsmList = gsms as any[];
        
        sameAddressMembers.push({
          tckn: sa.TC,
          ad: pInfo[0].AD,
          soyad: pInfo[0].SOYAD,
          dogumTarihi: pInfo[0].DOGUMTARIHI,
          cinsiyet: pInfo[0].CINSIYET,
          iliski: 'Aynı Adreste',
          gsmNumaralari: gsmList.map((g: any) => ({ gsm: g.GSM })),
        });
      }
    }
  }

  console.log('Same address members found:', sameAddressMembers.length);
  
  if (sameAddressMembers.length > 0) {
    result.ayniAdrestekiler = sameAddressMembers;
  }

  console.log('Final result keys:', Object.keys(result));

  return NextResponse.json({ success: true, data: result });
}
