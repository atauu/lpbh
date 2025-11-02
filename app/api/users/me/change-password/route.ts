import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Şifre güvenlik kontrolü
function validatePassword(password: string): { valid: boolean; error?: string } {
  // Minimum 8 karakter
  if (password.length < 8) {
    return { valid: false, error: 'Şifre en az 8 karakter olmalıdır' };
  }

  // En az bir büyük harf
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Şifre en az bir büyük harf içermelidir' };
  }

  // En az bir küçük harf
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Şifre en az bir küçük harf içermelidir' };
  }

  // En az bir rakam
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Şifre en az bir rakam içermelidir' };
  }

  // En az bir özel karakter
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Şifre en az bir özel karakter içermelidir' };
  }

  return { valid: true };
}

// POST: Şifre değiştir
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { oldPassword, newPassword, confirmPassword } = body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Eski şifre, yeni şifre ve şifre tekrarı zorunludur' },
        { status: 400 }
      );
    }

    // Yeni şifre ve tekrarı eşleşmeli
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Yeni şifre ve tekrarı eşleşmiyor' },
        { status: 400 }
      );
    }

    // Yeni şifre eski şifre ile aynı olamaz
    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: 'Yeni şifre eski şifre ile aynı olamaz' },
        { status: 400 }
      );
    }

    // Şifre güvenlik kontrolü
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Mevcut kullanıcıyı ve şifresini getir
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      );
    }

    // Eski şifreyi doğrula
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return NextResponse.json(
        { error: 'Eski şifre yanlış' },
        { status: 401 }
      );
    }

    // Yeni şifreyi hashle
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Şifreyi güncelle
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      { message: 'Şifre başarıyla değiştirildi' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: 'Şifre değiştirilemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


