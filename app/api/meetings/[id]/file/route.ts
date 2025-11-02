import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// GET: Toplantı PDF dosyasını döndür
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

    const meetingId = params.id;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      return NextResponse.json(
        { error: 'Toplantı kaydı bulunamadı' },
        { status: 404 }
      );
    }

    // Dosya yolunu oluştur (relative path ise absolute'a çevir)
    let filePath: string;
    if (meeting.filePath.startsWith('uploads/')) {
      filePath = join(process.cwd(), meeting.filePath);
    } else if (meeting.filePath.startsWith('/')) {
      filePath = meeting.filePath;
    } else {
      filePath = join(process.cwd(), meeting.filePath);
    }

    console.log('File path check:', {
      dbPath: meeting.filePath,
      resolvedPath: filePath,
      exists: existsSync(filePath),
    });

    // Dosya kontrolü
    if (!existsSync(filePath)) {
      console.error('File not found:', filePath);
      return NextResponse.json(
        { error: 'Dosya bulunamadı', path: filePath },
        { status: 404 }
      );
    }

    // Dosyayı oku
    const fileBuffer = await readFile(filePath);

    // PDF dosyasını döndür
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(meeting.fileName)}"`,
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

