import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST: Mesaja reaksiyon ekle/kaldır
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
    const { emoji, remove } = body; // emoji: string, remove: boolean

    if (!emoji) {
      return NextResponse.json(
        { error: 'Emoji gereklidir' },
        { status: 400 }
      );
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Mesaj bulunamadı' },
        { status: 404 }
      );
    }

    if (remove) {
      // Reaksiyonu kaldır
      await prisma.messageReaction.deleteMany({
        where: {
          messageId,
          userId: session.user.id,
          emoji,
        },
      });
    } else {
      // Reaksiyon ekle (varsa güncelle, yoksa oluştur)
      await prisma.messageReaction.upsert({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId: session.user.id,
            emoji,
          },
        },
        create: {
          messageId,
          userId: session.user.id,
          emoji,
        },
        update: {},
      });
    }

    const updatedMessage = await prisma.message.findUnique({
      where: { id: messageId },
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

    if (!updatedMessage) {
      return NextResponse.json(
        { error: 'Mesaj bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('Reaction error:', error);
    return NextResponse.json(
      { error: 'Reaksiyon eklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



