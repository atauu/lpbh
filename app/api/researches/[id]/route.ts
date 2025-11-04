import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

export const dynamic = 'force-dynamic';

// GET: Tek bir araştırmayı getir
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

    // İzin kontrolü
    const permissions = (session as any)?.user?.permissions;
    if (!hasPermission(permissions, 'researches', 'read')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const research = await prisma.research.findUnique({
      where: { id: params.id },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
            rutbe: true,
          },
        },
      },
    });

    if (!research) {
      return NextResponse.json(
        { error: 'Araştırma bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(research);
  } catch (error) {
    console.error('Research fetch error:', error);
    return NextResponse.json(
      { error: 'Araştırma yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT: Araştırmayı güncelle
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

    // İzin kontrolü
    const permissions = (session as any)?.user?.permissions;
    if (!hasPermission(permissions, 'researches', 'update')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const existingResearch = await prisma.research.findUnique({
      where: { id: params.id },
    });

    if (!existingResearch) {
      return NextResponse.json(
        { error: 'Araştırma bulunamadı' },
        { status: 404 }
      );
    }

    // Sadece oluşturan kişi veya yetkili kullanıcılar güncelleyebilir
    // (Burada herkes güncelleyebilir - yetki kontrolü zaten yukarıda yapıldı)

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const file = formData.get('file') as File | null;
    const removeFile = formData.get('removeFile') === 'true';

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Başlık ve içerik zorunludur' },
        { status: 400 }
      );
    }

    let filePath = existingResearch.filePath;
    let fileName = existingResearch.fileName;
    let fileSize = existingResearch.fileSize;
    let fileContent = existingResearch.fileContent;

    // Dosya kaldırma
    if (removeFile && existingResearch.filePath) {
      const fullPath = join(process.cwd(), existingResearch.filePath);
      if (existsSync(fullPath)) {
        await unlink(fullPath).catch(() => {});
      }
      filePath = null;
      fileName = null;
      fileSize = null;
      fileContent = null;
    }

    // Yeni dosya ekleme
    if (file && file.size > 0) {
      // Eski dosyayı sil
      if (existingResearch.filePath) {
        const oldFullPath = join(process.cwd(), existingResearch.filePath);
        if (existsSync(oldFullPath)) {
          await unlink(oldFullPath).catch(() => {});
        }
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Dosya boyutu 10MB\'dan küçük olmalıdır' },
          { status: 400 }
        );
      }

      const uploadsDir = join(process.cwd(), 'uploads', 'researches');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const savedFileName = `${Date.now()}-${sanitizedFileName}`;
      const fullFilePath = join(uploadsDir, savedFileName);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(fullFilePath, buffer);

      filePath = `uploads/researches/${savedFileName}`;
      fileName = file.name;
      fileSize = file.size;
      fileContent = null;

      // PDF içeriği parse etme
      if (file.type === 'application/pdf') {
        try {
          const pdfParse = require('pdf-parse');
          let parseFunction: any = null;

          if (typeof pdfParse === 'function') {
            parseFunction = pdfParse;
          } else if (pdfParse.default && typeof pdfParse.default === 'function') {
            parseFunction = pdfParse.default;
          } else if (pdfParse.PDFParse) {
            const PDFParseClass = pdfParse.PDFParse;
            const parser = new PDFParseClass({ data: buffer });
            const pdfData = await parser.getText({});
            fileContent = pdfData.text || '';
          }

          if (parseFunction && typeof parseFunction === 'function') {
            const pdfData = await parseFunction(buffer);
            fileContent = pdfData.text || '';
          }
        } catch (error: any) {
          console.error('PDF parse error:', error?.message || error);
        }
      }
    }

    // Araştırmayı güncelle
    const research = await prisma.research.update({
      where: { id: params.id },
      data: {
        title,
        content,
        filePath,
        fileName,
        fileSize,
        fileContent,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            isim: true,
            soyisim: true,
            rutbe: true,
          },
        },
      },
    });

    // Güncelleme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}`
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'research_update');

    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logActivity(
      session.user.id,
      'research_update',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(research);
  } catch (error) {
    console.error('Research update error:', error);
    return NextResponse.json(
      {
        error: 'Araştırma güncellenemedi',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE: Araştırmayı sil
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

    // İzin kontrolü
    const permissions = (session as any)?.user?.permissions;
    if (!hasPermission(permissions, 'researches', 'delete')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const research = await prisma.research.findUnique({
      where: { id: params.id },
    });

    if (!research) {
      return NextResponse.json(
        { error: 'Araştırma bulunamadı' },
        { status: 404 }
      );
    }

    // Dosyayı sil
    if (research.filePath) {
      const fullPath = join(process.cwd(), research.filePath);
      if (existsSync(fullPath)) {
        await unlink(fullPath).catch(() => {});
      }
    }

    // Araştırmayı sil
    await prisma.research.delete({
      where: { id: params.id },
    });

    // Silme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}`
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'research_delete');

    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logActivity(
      session.user.id,
      'research_delete',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Research delete error:', error);
    return NextResponse.json(
      {
        error: 'Araştırma silinemedi',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


