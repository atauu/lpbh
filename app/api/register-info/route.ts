import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeName } from '@/lib/utils';

// POST: Kullanıcının bilgilerini kaydet ve durumu pending_approval'a güncelle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token,
      isim,
      soyisim,
      tckn,
      telefon,
      evAdresi,
      yakiniIsmi,
      yakiniTelefon,
      ruhsatSeriNo,
      kanGrubu,
      plaka,
      ehliyetTuru,
    } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token gerekli' },
        { status: 400 }
      );
    }

    // Token ile kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { registrationToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Geçersiz token' },
        { status: 404 }
      );
    }

    if (user.membershipStatus !== 'pending_info') {
      return NextResponse.json(
        { error: 'Bu kullanıcı zaten bilgilerini girmiş' },
        { status: 400 }
      );
    }

    // Kullanıcı bilgilerini güncelle ve durumu pending_approval'a çek
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isim: normalizeName(isim),
        soyisim: normalizeName(soyisim),
        tckn: tckn || null,
        telefon: telefon || null,
        evAdresi: evAdresi || null,
        yakiniIsmi: normalizeName(yakiniIsmi),
        yakiniTelefon: yakiniTelefon || null,
        ruhsatSeriNo: ruhsatSeriNo || null,
        kanGrubu: kanGrubu || null,
        plaka: plaka ? plaka.toUpperCase() : null,
        ehliyetTuru: Array.isArray(ehliyetTuru) ? ehliyetTuru : [],
        membershipStatus: 'pending_approval', // Onay bekliyor durumuna geç
        registrationToken: null, // Token'ı temizle (güvenlik için)
      },
      select: {
        id: true,
        username: true,
        membershipStatus: true,
      },
    });

    return NextResponse.json({
      message: 'Bilgileriniz başarıyla kaydedildi. Onay bekleniyor.',
      user: updatedUser,
    }, { status: 200 });
  } catch (error) {
    console.error('Register info error:', error);
    return NextResponse.json(
      { error: 'Bilgiler kaydedilemedi' },
      { status: 500 }
    );
  }
}

// GET: Token ile kullanıcı bilgilerini getir (form için)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token gerekli' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { registrationToken: token },
      select: {
        id: true,
        username: true,
        membershipStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Geçersiz token' },
        { status: 404 }
      );
    }

    if (user.membershipStatus !== 'pending_info') {
      return NextResponse.json(
        { error: 'Bu kullanıcı zaten bilgilerini girmiş' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      username: user.username,
      status: user.membershipStatus,
    }, { status: 200 });
  } catch (error) {
    console.error('Get register info error:', error);
    return NextResponse.json(
      { error: 'Token kontrolü başarısız' },
      { status: 500 }
    );
  }
}

