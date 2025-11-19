import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PUT: Mesajı güncelle
export async function PUT(
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

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Mesaj bulunamadı' },
        { status: 404 }
      );
    }

    // İzin kontrolü
    const permissions = (session as any)?.user?.permissions;
    const hasMessagePermission = permissions?.messages;
    
    // Kendi mesajını düzenleyebilir veya messages.update yetkisi varsa
    if (message.senderId !== session.user.id && !hasMessagePermission?.update) {
      return NextResponse.json(
        { error: 'Bu mesajı düzenleme yetkiniz yok' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (message.type !== 'text') {
      return NextResponse.json(
        { error: 'Sadece metin mesajları düzenlenebilir' },
        { status: 400 }
      );
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content || null,
        editedAt: new Date(),
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
        repliedTo: {
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
    console.error('Message update error:', error);
    return NextResponse.json(
      { error: 'Mesaj güncellenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: Mesajı sil (soft delete)
export async function DELETE(
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

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Mesaj bulunamadı' },
        { status: 404 }
      );
    }

    // İzin kontrolü
    const permissions = (session as any)?.user?.permissions;
    const hasMessagePermission = permissions?.messages;
    
    // Kendi mesajını silebilir veya messages.delete yetkisi varsa
    if (message.senderId !== session.user.id && !hasMessagePermission?.delete) {
      return NextResponse.json(
        { error: 'Bu mesajı silme yetkiniz yok' },
        { status: 403 }
      );
    }

    // Soft delete
    await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: null, // İçeriği temizle
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Message delete error:', error);
    return NextResponse.json(
      { error: 'Mesaj silinemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
