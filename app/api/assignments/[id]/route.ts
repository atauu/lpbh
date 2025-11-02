import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tek bir görevlendirme detayını getir
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

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: {
        assigner: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
        assignee: {
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

    if (!assignment) {
      return NextResponse.json(
        { error: 'Görevlendirme bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Assignment fetch error:', error);
    return NextResponse.json(
      { error: 'Görevlendirme yüklenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT: Görevlendirmeyi güncelle (detaylar, dosyalar, status)
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

    const assignmentId = params.id;

    // Mevcut görevlendirmeyi kontrol et
    const existingAssignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Görevlendirme bulunamadı' },
        { status: 404 }
      );
    }

    // Sadece görevlendirilen kişi güncelleyebilir
    if (existingAssignment.assigneeId !== session.user.id) {
      return NextResponse.json(
        { error: 'Bu görevi sadece görevlendirilen kişi güncelleyebilir' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const details = formData.get('details') as string;
    const status = formData.get('status') as string;
    const newFiles = formData.getAll('newFiles') as File[];
    const filesToDelete = formData.get('filesToDelete') as string; // JSON array string

    let updatedFiles = [...existingAssignment.files];

    // Silinecek dosyaları işle
    if (filesToDelete) {
      try {
        const filesToDeleteArray = JSON.parse(filesToDelete) as string[];
        for (const filePath of filesToDeleteArray) {
          // Dosyayı fiziksel olarak sil
          const fullPath = join(process.cwd(), filePath);
          if (existsSync(fullPath)) {
            await unlink(fullPath).catch(() => {});
          }
          // Array'den kaldır
          updatedFiles = updatedFiles.filter(f => f !== filePath);
        }
      } catch (e) {
        // JSON parse hatası - görmezden gel
      }
    }

    // Yeni dosyaları ekle
    if (newFiles && newFiles.length > 0) {
      const uploadsDir = join(process.cwd(), 'uploads', 'assignments');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      for (const file of newFiles) {
        if (file.size > 0) {
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName = `${Date.now()}-${sanitizedFileName}`;
          const filePath = join(uploadsDir, fileName);

          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          await writeFile(filePath, buffer);

          updatedFiles.push(`uploads/assignments/${fileName}`);
        }
      }
    }

    // Status güncellemesi
    let finalStatus = existingAssignment.status;
    let actualDelivery = existingAssignment.actualDelivery;

    if (status === 'completed') {
      finalStatus = 'completed';
      actualDelivery = new Date();
    } else if (status === 'cancelled') {
      finalStatus = 'cancelled';
    }

    // Görevlendirmeyi güncelle
    const assignment = await prisma.assignment.update({
      where: { id: assignmentId },
      data: {
        details: details || existingAssignment.details,
        status: finalStatus,
        actualDelivery: actualDelivery || existingAssignment.actualDelivery,
        files: updatedFiles,
      },
      include: {
        assigner: {
          select: {
            id: true,
            username: true,
            rutbe: true,
            isim: true,
            soyisim: true,
          },
        },
        assignee: {
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

    // Görevlendirme güncelleme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'assignment_update');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'assignment_update',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(assignment, { status: 200 });
  } catch (error) {
    console.error('Assignment update error:', error);
    return NextResponse.json(
      { error: 'Görevlendirme güncellenemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: Görevlendirmeyi sil
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
    if (!hasPermission(permissions, 'assignments', 'delete')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const assignmentId = params.id;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        files: true,
        task: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Görevlendirme bulunamadı' },
        { status: 404 }
      );
    }

    // Dosyaları sil
    for (const filePath of assignment.files) {
      const fullPath = join(process.cwd(), filePath);
      if (existsSync(fullPath)) {
        await unlink(fullPath).catch(() => {});
      }
    }

    await prisma.assignment.delete({
      where: { id: assignmentId },
    });

    // Görevlendirme silme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'assignment_delete');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'assignment_delete',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      { message: 'Görevlendirme başarıyla silindi.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Assignment deletion error:', error);
    return NextResponse.json(
      { error: 'Görevlendirme silinemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

