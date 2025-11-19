import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST: Mesajı ilet
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
    const { groupId } = body;

    // Orijinal mesajı al
    const originalMessage = await prisma.message.findUnique({
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
      },
    });

    if (!originalMessage) {
      return NextResponse.json(
        { error: 'Mesaj bulunamadı' },
        { status: 404 }
      );
    }

    // Grup erişim kontrolü
    if (groupId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { rutbe: true },
      });

      let userGroupOrder: number | null = null;
      if (user?.rutbe) {
        const role = await prisma.role.findUnique({
          where: { name: user.rutbe },
          include: { group: true },
        });
        userGroupOrder = role?.group?.order ?? null;
      }

      const targetGroup = await prisma.roleGroup.findUnique({
        where: { id: groupId },
        select: { order: true },
      });

      if (targetGroup) {
        let hasAccess = false;
        
        if (targetGroup.order === 2) {
          hasAccess = userGroupOrder === 2;
        } else if (targetGroup.order === 1) {
          hasAccess = userGroupOrder !== null && userGroupOrder >= 1;
        } else if (targetGroup.order === 0) {
          hasAccess = userGroupOrder !== null && userGroupOrder >= 0;
        }

        if (!hasAccess) {
          return NextResponse.json(
            { error: 'Bu sohbete mesaj gönderme yetkiniz bulunmuyor' },
            { status: 403 }
          );
        }
      }
    }

    // Yeni mesaj oluştur (iletme)
    const forwardedMessage = await prisma.message.create({
      data: {
        type: originalMessage.type,
        content: originalMessage.content,
        mediaPath: originalMessage.mediaPath,
        mediaUrl: originalMessage.mediaUrl,
        fileName: originalMessage.fileName,
        fileSize: originalMessage.fileSize,
        fileType: originalMessage.fileType,
        latitude: originalMessage.latitude,
        longitude: originalMessage.longitude,
        locationName: originalMessage.locationName,
        liveLocationExpiresAt: originalMessage.liveLocationExpiresAt,
        forwardedFromId: originalMessage.id,
        groupId: groupId || null,
        senderId: session.user.id,
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

    // Okundu bilgisi oluştur
    await prisma.readReceipt.create({
      data: {
        messageId: forwardedMessage.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json(forwardedMessage);
  } catch (error) {
    console.error('Forward message error:', error);
    return NextResponse.json(
      { error: 'Mesaj iletilenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



