import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST: Mesajı okundu işaretle
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

    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Mesaj bulunamadı' },
        { status: 404 }
      );
    }

    // Okundu bilgisi oluştur (varsa güncelleme)
    await prisma.readReceipt.upsert({
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
      update: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json(
      { error: 'Mesaj okundu işaretlenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



