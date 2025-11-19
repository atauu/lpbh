import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST: Yazıyor... durumu gönder
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { groupId, typing } = body; // typing: boolean

    // Kullanıcının son aktif zamanını güncelle
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastActiveAt: new Date(),
      },
    });

    // Typing indicator için geçici bir cache mekanizması
    // Bu endpoint sadece "yazıyor" durumunu kaydetmek için
    // Gerçek zamanlı güncellemeler için polling veya WebSocket kullanılabilir

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Typing indicator error:', error);
    return NextResponse.json(
      { error: 'Yazıyor durumu güncellenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET: Yazıyor... durumlarını getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    // Son 5 saniye içinde aktif olan kullanıcıları getir (basit typing indicator)
    const activeThreshold = new Date(Date.now() - 5000); // 5 saniye öncesi

    const activeUsers = await prisma.user.findMany({
      where: {
        lastActiveAt: {
          gte: activeThreshold,
        },
        id: {
          not: session.user.id, // Kendini hariç tut
        },
      },
      select: {
        id: true,
        username: true,
        rutbe: true,
        isim: true,
        soyisim: true,
        lastActiveAt: true,
      },
    });

    return NextResponse.json(activeUsers.map(user => ({
      id: user.id,
      username: user.username,
      rutbe: user.rutbe,
      isim: user.isim,
      soyisim: user.soyisim,
      lastActiveAt: user.lastActiveAt,
    })));
  } catch (error) {
    console.error('Typing indicator fetch error:', error);
    return NextResponse.json(
      { error: 'Yazıyor durumları yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



