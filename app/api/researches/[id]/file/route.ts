import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// GET: Araştırma dosyasını döndür
export async function GET(
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

    const research = await prisma.research.findUnique({
      where: { id: params.id },
      select: {
        filePath: true,
        fileName: true,
      },
    });

    if (!research || !research.filePath) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 404 }
      );
    }

    const fullPath = join(process.cwd(), research.filePath);

    if (!existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(fullPath);
    const fileName = research.fileName || research.filePath.split('/').pop() || 'file';

    // Dosya tipini belirle
    let contentType = 'application/octet-stream';
    const fileExtension = fileName.toLowerCase().split('.').pop();

    if (fileExtension === 'pdf') {
      contentType = 'application/pdf';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '')) {
      contentType = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;
    } else if (['mp4', 'webm', 'ogg'].includes(fileExtension || '')) {
      contentType = `video/${fileExtension}`;
    } else if (fileExtension === 'mov') {
      contentType = 'video/quicktime';
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('File fetch error:', error);
    return NextResponse.json(
      { error: 'Dosya yüklenemedi' },
      { status: 500 }
    );
  }
}


