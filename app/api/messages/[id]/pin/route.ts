import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST: Mesajı sabitle
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const messageId = params.id;
    const body = await request.json();
    const { pin } = body; // true = sabitle, false = sabitlemeyi kaldır

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Mesaj bulunamadı' },
        { status: 404 }
      );
    }

    // İzin kontrolü - mesaj sahibi veya admin sabitleyebilir
    const permissions = (session as any)?.user?.permissions;
    const hasMessagePermission = permissions?.messages;
    
    if (message.senderId !== session.user.id && !hasMessagePermission?.update) {
      return NextResponse.json(
        { error: 'Bu mesajı sabitleme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Aynı grupta başka sabitli mesaj varsa kaldır
    if (pin) {
      await prisma.message.updateMany({
        where: {
          groupId: message.groupId,
          pinned: true,
          id: { not: messageId },
        },
        data: {
          pinned: false,
          pinnedAt: null,
          pinnedBy: null,
        },
      });
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        pinned: pin || false,
        pinnedAt: pin ? new Date() : null,
        pinnedBy: pin ? session.user.id : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            order: true,
          },
        },
        forwardedFrom: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                rutbe: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                rutbe: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                rutbe: true,
                isim: true,
                soyisim: true,
              },
            },
          },
        },
        starredBy: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('Pin message error:', error);
    return NextResponse.json(
      { error: 'Mesaj sabitlenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



