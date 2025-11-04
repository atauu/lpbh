import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// GET: Mesaj medya dosyasını döndür
export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const filename = params.filename;
    const filePath = join(process.cwd(), 'uploads', 'messages', filename);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(filePath);
    const fileExtension = filename.toLowerCase().split('.').pop();

    // Content-Type belirleme
    let contentType = 'application/octet-stream';
    if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
      contentType = 'image/jpeg';
    } else if (fileExtension === 'png') {
      contentType = 'image/png';
    } else if (fileExtension === 'gif') {
      contentType = 'image/gif';
    } else if (fileExtension === 'webp') {
      contentType = 'image/webp';
    } else if (fileExtension === 'mp4') {
      contentType = 'video/mp4';
    } else if (fileExtension === 'webm') {
      contentType = 'video/webm';
    } else if (fileExtension === 'ogg') {
      contentType = 'video/ogg';
    } else if (fileExtension === 'mov') {
      contentType = 'video/quicktime';
    } else if (fileExtension === 'mp3' || fileExtension === 'mpeg') {
      contentType = 'audio/mpeg';
    } else if (fileExtension === 'wav') {
      contentType = 'audio/wav';
    } else if (fileExtension === 'ogg' || fileExtension === 'oga') {
      contentType = 'audio/ogg';
    } else if (fileExtension === 'webm') {
      contentType = 'audio/webm';
    }

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Media fetch error:', error);
    return NextResponse.json(
      { error: 'Medya yüklenemedi' },
      { status: 500 }
    );
  }
}


