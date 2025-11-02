import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generateTwoFactorSecret, generateQRCodeDataUrl } from '@/lib/two-factor';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id) {
      console.error('2FA setup: No session or user ID');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      console.error('2FA setup: User not found', session.user.id);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Eğer zaten bir secret varsa ve 2FA aktif değilse, mevcut secret'ı kullan
    // Yeni secret oluşturma - kullanıcı QR kodunu zaten taramış olabilir
    if (user.twoFactorSecret && !user.twoFactorEnabled) {
      // Mevcut secret ile QR kod URL'ini oluştur
      const existingSecret = user.twoFactorSecret.trim();
      const qrCodeUrl = `otpauth://totp/LPBH%20FOP%20(${user.username || 'user'})?secret=${existingSecret}&issuer=LPBH%20FOP`;
      const qrCodeDataUrl = await generateQRCodeDataUrl(qrCodeUrl);
      
      return NextResponse.json({
        secret: existingSecret,
        qrCodeDataUrl,
        manualEntryKey: existingSecret,
        message: 'Mevcut secret kullanılıyor. Lütfen QR kodu tarayın ve token ile doğrulayın.',
      });
    }

    // Yeni secret oluştur (sadece secret yoksa veya 2FA aktifse)
    const { secret, qrCodeUrl, manualEntryKey } = generateTwoFactorSecret(
      user.username || 'user',
      'LPBH FOP'
    );

    // QR kod data URL'ini oluştur
    const qrCodeDataUrl = await generateQRCodeDataUrl(qrCodeUrl);

    // Secret'ı veritabanına kaydet (henüz aktif değil)
    const savedSecret = secret.trim();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: savedSecret,
        // twoFactorEnabled hala false - doğrulama sonrası aktif edilecek
      },
    });

    return NextResponse.json({
      secret,
      qrCodeDataUrl,
      manualEntryKey,
      message: '2FA secret oluşturuldu. Lütfen QR kodu tarayın ve token ile doğrulayın.',
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { 
        error: '2FA setup başarısız oldu',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

