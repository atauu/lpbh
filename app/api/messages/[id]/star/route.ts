import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST: Mesajı yıldızla/yıldızdan çıkar
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
    const { star } = body; // true = yıldızla, false = yıldızdan çıkar

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Mesaj bulunamadı' },
        { status: 404 }
      );
    }

    if (star) {
      // Yıldızla
      await prisma.starredMessage.upsert({
        where: {
          messageId_userId: {
            messageId,
            userId: session.user.id,
          },
        },
        create: {
          messageId,
          userId: session.user.id,
        },
        update: {},
      });
    } else {
      // Yıldızdan çıkar
      await prisma.starredMessage.deleteMany({
        where: {
          messageId,
          userId: session.user.id,
        },
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

    (updatedMessage as any).isStarred = star;

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('Star message error:', error);
    return NextResponse.json(
      { error: 'Mesaj yıldızlanamadı', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



