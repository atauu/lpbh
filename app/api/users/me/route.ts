import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Mevcut kullanıcının bilgilerini getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        rutbe: true,
        membershipStatus: true,
        isim: true,
        soyisim: true,
        tckn: true,
        telefon: true,
        evAdresi: true,
        yakiniIsmi: true,
        yakiniTelefon: true,
        ruhsatSeriNo: true,
        kanGrubu: true,
        plaka: true,
        ehliyetTuru: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json(
      { error: 'Kullanıcı bilgileri yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

