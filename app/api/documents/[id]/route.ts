import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { existsSync } from 'fs';
import { join } from 'path';
import { unlink } from 'fs/promises';

export const dynamic = 'force-dynamic';

// DELETE: Belgeyi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: params.id },
    });

    if (!doc) {
      return NextResponse.json(
        { error: 'Belge bulunamadı' },
        { status: 404 }
      );
    }

    let filePath: string;
    if (doc.filePath.startsWith('uploads/')) {
      filePath = join(process.cwd(), doc.filePath);
    } else if (doc.filePath.startsWith('/')) {
      filePath = doc.filePath;
    } else {
      filePath = join(process.cwd(), doc.filePath);
    }

    await prisma.document.delete({
      where: { id: params.id },
    });

    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Document deletion error:', error);
    return NextResponse.json(
      { error: 'Belge silinemedi' },
      { status: 500 }
    );
  }
}


