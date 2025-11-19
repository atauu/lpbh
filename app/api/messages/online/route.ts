import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: Online kullanıcıları getir
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Son 30 saniye içinde aktif olan kullanıcıları online say
    const onlineThreshold = new Date(Date.now() - 30000); // 30 saniye öncesi

    const onlineUsers = await prisma.user.findMany({
      where: {
        lastActiveAt: {
          gte: onlineThreshold,
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

    return NextResponse.json(onlineUsers.map(user => ({
      id: user.id,
      username: user.username,
      rutbe: user.rutbe,
      isim: user.isim,
      soyisim: user.soyisim,
      lastActiveAt: user.lastActiveAt,
    })));
  } catch (error) {
    console.error('Online users fetch error:', error);
    return NextResponse.json(
      { error: 'Online kullanıcılar yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Kullanıcının aktif zamanını güncelle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastActiveAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update last active error:', error);
    return NextResponse.json(
      { error: 'Aktif zaman güncellenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



