import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/settings/2fa/global-status - Global 2FA durumunu getir (public, herkes görebilir)
export async function GET() {
  try {
    // Global 2FA ayarını getir - cache'i bypass etmek için raw query kullan
    const settingResult = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT value FROM system_settings WHERE key = 'twoFactorEnabled' LIMIT 1
    `;
    
    const isEnabled = settingResult.length > 0 && settingResult[0].value === 'true';

    return NextResponse.json({
      enabled: isEnabled,
    });
  } catch (error) {
    console.error('Get global 2FA status error:', error);
    // Hata durumunda kapalı kabul et
    return NextResponse.json({
      enabled: false,
    });
  }
}



