import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PUT: Oylamayı güncelle (başlık, açıklama, allowCustomOption)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pollId = params.id;
    const body = await request.json();
    const { title, description, allowCustomOption } = body as {
      title?: string;
      description?: string | null;
      allowCustomOption?: boolean;
    };

    const existing = await prisma.poll.findUnique({ where: { id: pollId } });
    if (!existing) {
      return NextResponse.json({ error: 'Oylama bulunamadı' }, { status: 404 });
    }

    // Sadece oluşturan veya polls.update izni olan güncelleyebilir
    const isOwner = existing.createdBy === session.user.id;
    const hasUpdate = (session.user as any)?.permissions?.polls?.update;
    if (!isOwner && !hasUpdate) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 });
    }

    const updated = await prisma.poll.update({
      where: { id: pollId },
      data: {
        ...(typeof title === 'string' ? { title } : {}),
        ...(typeof description !== 'undefined' ? { description: description || null } : {}),
        ...(typeof allowCustomOption !== 'undefined' ? { allowCustomOption: !!allowCustomOption } : {}),
      },
      include: { options: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Poll update error:', error);
    return NextResponse.json({ error: 'Oylama güncellenemedi' }, { status: 500 });
  }
}

// DELETE: Oylamayı sil
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pollId = params.id;
    const poll = await prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) {
      return NextResponse.json({ error: 'Oylama bulunamadı' }, { status: 404 });
    }

    // Sadece oluşturan veya polls.delete izni olan silebilir
    const isOwner = poll.createdBy === session.user.id;
    const hasDelete = (session.user as any)?.permissions?.polls?.delete;
    if (!isOwner && !hasDelete) {
      return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 });
    }

    // İlişkili oy ve seçenekleri temizle
    await prisma.pollVote.deleteMany({ where: { pollId } });
    await prisma.pollOption.deleteMany({ where: { pollId } });
    await prisma.poll.delete({ where: { id: pollId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Poll delete error:', error);
    return NextResponse.json({ error: 'Oylama silinemedi' }, { status: 500 });
  }
}



