import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { normalizeName } from '@/lib/utils';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// PUT: Üye bilgilerini güncelle
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
    if (!hasPermission(permissions, 'users', 'update')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const userId = params.id;
    const body = await request.json();
    const {
      username,
      password,
      rutbe,
      isim,
      soyisim,
      tckn,
      telefon,
      evAdresi,
      yakiniIsmi,
      yakiniTelefon,
      ruhsatSeriNo,
      kanGrubu,
      plaka,
      ehliyetTuru,
    } = body;

    // Kullanıcının var olup olmadığını kontrol et
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Üye bulunamadı' },
        { status: 404 }
      );
    }

    // Kullanıcı adı değişiyorsa benzersizlik kontrolü
    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username },
      });

      if (usernameExists) {
        return NextResponse.json(
          { error: 'Bu kullanıcı adı zaten kullanılıyor' },
          { status: 400 }
        );
      }
    }

    // Güncelleme verilerini hazırla
    const updateData: any = {};

    if (username) updateData.username = username;
    if (password) {
      // Şifre varsa hash'le
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (rutbe !== undefined) updateData.rutbe = rutbe || null;
    if (isim !== undefined) updateData.isim = normalizeName(isim);
    if (soyisim !== undefined) updateData.soyisim = normalizeName(soyisim);
    if (tckn !== undefined) updateData.tckn = tckn || null;
    if (telefon !== undefined) updateData.telefon = telefon || null;
    if (evAdresi !== undefined) updateData.evAdresi = evAdresi || null;
    if (yakiniIsmi !== undefined) updateData.yakiniIsmi = normalizeName(yakiniIsmi);
    if (yakiniTelefon !== undefined) updateData.yakiniTelefon = yakiniTelefon || null;
    if (ruhsatSeriNo !== undefined) updateData.ruhsatSeriNo = ruhsatSeriNo || null;
    if (kanGrubu !== undefined) updateData.kanGrubu = kanGrubu || null;
    if (plaka !== undefined) {
      updateData.plaka = plaka && typeof plaka === 'string' && plaka.trim() ? plaka.trim().toUpperCase() : null;
    }
    if (ehliyetTuru !== undefined) {
      // Ehliyet türü array olarak gelmeli, değilse boş array yap
      if (Array.isArray(ehliyetTuru)) {
        updateData.ehliyetTuru = ehliyetTuru.filter(t => t && typeof t === 'string' && t.trim());
      } else {
        updateData.ehliyetTuru = [];
      }
    }

    // Kullanıcıyı güncelle
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        rutbe: true,
        isim: true,
        soyisim: true,
        tckn: true,
        telefon: true,
        evAdresi: true,
        yakiniIsmi: true,
        yakiniTelefon: true,
        ruhsatSeriNo: true,
        kanGrubu: true,
        plaka: true,
        ehliyetTuru: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Üye güncelleme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'user_update');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'user_update',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('User update error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'Üye güncellenemedi',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE: Üyeyi sil
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
    if (!hasPermission(permissions, 'users', 'delete')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const userId = params.id;

    // Kullanıcının var olup olmadığını kontrol et
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        isim: true,
        soyisim: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Üye bulunamadı' },
        { status: 404 }
      );
    }

    // Kullanıcıyı sil (Cascade ile ilişkili kayıtlar da silinecek)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Üye silme logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = (session as any)?.user?.isim && (session as any)?.user?.soyisim 
      ? `${(session as any).user.isim} ${(session as any).user.soyisim}` 
      : '';
    const deletedUserFullName = existingUser.isim && existingUser.soyisim 
      ? `${existingUser.isim} ${existingUser.soyisim}` 
      : '';
    const deletedUserInfo = deletedUserFullName || existingUser.username;
    const description = getActivityDescription(userNameDisplay, userFullName, 'user_delete');
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'user_delete',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json({
      message: 'Üye başarıyla silindi',
    }, { status: 200 });
  } catch (error) {
    console.error('User delete error:', error);
    return NextResponse.json(
      { error: 'Üye silinemedi' },
      { status: 500 }
    );
  }
}

