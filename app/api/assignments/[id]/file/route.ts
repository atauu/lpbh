import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// GET: Görevlendirme dosyasını döndür
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

    const { searchParams } = new URL(request.url);
    const fileIndex = parseInt(searchParams.get('index') || '0');

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      select: {
        files: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Görevlendirme bulunamadı' },
        { status: 404 }
      );
    }

    if (fileIndex < 0 || fileIndex >= assignment.files.length) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 404 }
      );
    }

    const filePath = assignment.files[fileIndex];
    const fullPath = join(process.cwd(), filePath);

    if (!existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(fullPath);
    const fileName = filePath.split('/').pop() || 'file';

    // Dosya tipini belirle (basit kontrol)
    const contentType = fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';

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


