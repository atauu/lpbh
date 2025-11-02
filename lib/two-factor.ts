import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export interface TwoFactorSetupResult {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

/**
 * 2FA için yeni secret oluşturur
 */
export function generateTwoFactorSecret(username: string, serviceName: string = 'LPBH FOP'): TwoFactorSetupResult {
  const secret = speakeasy.generateSecret({
    name: `${serviceName} (${username})`,
    issuer: serviceName,
    length: 32,
  });

  return {
    secret: secret.base32 || '',
    qrCodeUrl: secret.otpauth_url || '',
    manualEntryKey: secret.base32 || '',
  };
}

/**
 * QR kod URL'ini data URL'e çevirir (base64 PNG)
 */
export async function generateQRCodeDataUrl(otpauthUrl: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(otpauthUrl);
    return dataUrl;
  } catch (error) {
    throw new Error('QR kod oluşturulamadı');
  }
}

/**
 * TOTP token'ı doğrular
 */
export function verifyTwoFactorToken(secret: string, token: string): boolean {
  try {
    // Token'ı string'e çevir (eğer number ise)
    const tokenString = String(token).trim().replace(/\D/g, '').slice(0, 6);
    
    // Secret'ı temizle - sadece başta/sonda boşlukları kaldır, format değiştirme
    // Veritabanında nasıl kaydedildiyse öyle kullan (speakeasy zaten base32 formatını bekliyor)
    const cleanSecret = String(secret || '').trim();
    
    // Secret'ın base32 formatında olduğundan emin ol
    const isValidBase32 = /^[A-Z2-7]+$/.test(cleanSecret);
    
    if (!isValidBase32) {
      console.error('Secret is not valid base32 format');
      return false;
    }
    
    if (!cleanSecret || !tokenString || tokenString.length !== 6) {
      return false;
    }

    // TOTP token'ı doğrula
    // Window 2 = ±2 token window (±60 saniye) - güvenlik ve zaman senkronizasyonu dengesi
    const verified = speakeasy.totp.verify({
      secret: cleanSecret,
      encoding: 'base32',
      token: tokenString,
      window: 2,
      step: 30,
    });
    
    // Verified true VEYA number ise başarılı
    const isValid = verified === true || (typeof verified === 'number' && Number.isInteger(verified) && verified >= 0 && verified <= 2);
    
    return isValid;
  } catch (error) {
    console.error('2FA Verification error:', error);
    return false;
  }
}

