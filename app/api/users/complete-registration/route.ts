import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeName } from '@/lib/utils';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// POST: Kullanıcının bilgilerini kaydet ve durumu pending_approval'a güncelle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Kullanıcının durumunu kontrol et
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    if (user.membershipStatus !== 'pending_info') {
      return NextResponse.json(
        { error: 'Bu kullanıcı zaten bilgilerini girmiş' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      isim,
      soyisim,
      tckn,
      telefon,
      evAdresi,
      yakiniIsmi,
      yakiniTelefon,
      ruhsatSeriNo,
      kanGrubu,
    } = body;

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
        membershipStatus: 'pending_approval', // Onay bekliyor durumuna geç
      },
      select: {
        id: true,
        username: true,
        membershipStatus: true,
      },
    });

    // Bilgi gönderme logunu kaydet
    const fullName = normalizeName(isim) && normalizeName(soyisim) 
      ? `${normalizeName(isim)} ${normalizeName(soyisim)}` 
      : '';
    const description = getActivityDescription(user.username, fullName, 'user_info_submitted');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      user.id,
      'user_info_submitted',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json({
      message: 'Bilgileriniz başarıyla kaydedildi. Onay bekleniyor.',
      user: updatedUser,
    }, { status: 200 });
  } catch (error) {
    console.error('Complete registration error:', error);
    return NextResponse.json(
      { error: 'Bilgiler kaydedilemedi' },
      { status: 500 }
    );
  }
}

