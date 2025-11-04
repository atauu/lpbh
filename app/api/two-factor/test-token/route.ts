import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import speakeasy from 'speakeasy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        username: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
      },
    });

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: '2FA secret not found' },
        { status: 404 }
      );
    }

    const cleanSecret = String(user.twoFactorSecret).trim();
    
    // Mevcut token'ı oluştur
    const currentToken = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32',
      step: 30,
    });

    // Önceki ve sonraki token'ları da oluştur
    const time = Math.floor(Date.now() / 1000);
    const previousToken = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32',
      step: 30,
      time: time - 30,
    });
    
    const nextToken = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32',
      step: 30,
      time: time + 30,
    });

    // ±2 window için token'lar
    const tokens = [];
    for (let i = -3; i <= 3; i++) {
      const token = speakeasy.totp({
        secret: cleanSecret,
        encoding: 'base32',
        step: 30,
        time: time + (i * 30),
      });
      tokens.push({
        offset: i,
        token,
        timeWindow: `${i * 30}s`,
      });
    }

    return NextResponse.json({
      username: user.username,
      twoFactorEnabled: user.twoFactorEnabled,
      secretPreview: cleanSecret.substring(0, 20) + '...',
      secretLength: cleanSecret.length,
      secretIsBase32: /^[A-Z2-7]+$/.test(cleanSecret),
      currentToken,
      previousToken,
      nextToken,
      currentTime: new Date().toISOString(),
      allTokens: tokens,
      instruction: 'Microsoft Authenticator\'dan gösterilen token ile bu listedeki token\'ları karşılaştırın. Eğer hiçbiri eşleşmiyorsa, cihazınızın saat ayarını kontrol edin veya QR kodunu yeniden tarayın.',
    });
  } catch (error) {
    console.error('Test token API error:', error);
    return NextResponse.json(
      { 
        error: 'Test token API failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}


