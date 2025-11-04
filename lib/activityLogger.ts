import { prisma } from '@/lib/prisma';

export interface ActivityLogMetadata {
  reason?: string;
  [key: string]: any;
}

/**
 * İşlem kaydı oluştur
 */
export async function logActivity(
  userId: string,
  action: string,
  description: string,
  metadata?: ActivityLogMetadata,
  ipAddress?: string,
  userAgent?: string
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        description,
        metadata: metadata || {},
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Activity log creation error:', error);
    // Log hatası uygulamanın çalışmasını engellememeli
  }
}

/**
 * İşlem türleri için description fonksiyonları
 */
export function getActivityDescription(
  username: string,
  fullName: string,
  action: string,
  metadata?: ActivityLogMetadata
): string {
  const nameDisplay = fullName || username;
  
  switch (action) {
    case 'login_success':
      return `Başarılı bir şekilde giriş yapıldı.`;
    
    case 'login_failed':
      const reason = metadata?.reason || 'bilinmeyen neden';
      return `Giriş yapılamadı. (${reason})`;
    
    case 'logout':
      return `Çıkış yapıldı.`;
    
    case 'profile_update':
      return `Bilgiler güncellendi.`;
    
    case 'password_change':
      return `Şifre değiştirildi.`;
    
    case '2fa_setup':
      return `2FA etkinleştirildi.`;
    
    case '2fa_disable':
      return `2FA devre dışı bırakıldı.`;
    
    case 'meeting_create':
      return `Yeni bir toplantı kaydı eklendi.`;
    
    case 'meeting_delete':
      return `Bir toplantı kaydı silindi.`;
    
    case 'event_create':
      return `Yeni bir etkinlik oluşturuldu.`;
    
    case 'event_delete':
      return `Bir etkinlik silindi.`;
    
    case 'event_rsvp':
      const rsvpStatus = metadata?.status === 'attending' ? 'katılıyor' : 'katılmıyor';
      return `Bir etkinliğe ${rsvpStatus} olarak cevap verildi.`;
    
    case 'assignment_create':
      return `Yeni bir görevlendirme oluşturuldu.`;
    
    case 'assignment_update':
      const status = metadata?.status;
      if (status === 'completed') {
        return `Bir görev tamamlandı.`;
      } else if (status === 'cancelled') {
        return `Bir görev iptal edildi.`;
      }
      return `Bir görev güncellendi.`;
    
    case 'assignment_delete':
      return `Bir görevlendirme silindi.`;
    
    case 'route_create':
      return `Yeni bir rota eklendi.`;
    
    case 'route_delete':
      return `Bir rota silindi.`;
    
    case 'announcement_create':
      return `Yeni bir duyuru oluşturuldu.`;
    
    case 'announcement_update':
      return `Bir duyuru güncellendi.`;
    
    case 'announcement_delete':
      return `Bir duyuru silindi.`;
    
    case 'user_create':
      return `Yeni bir üye eklendi.`;
    
    case 'user_update':
      return `Bir üye bilgisi güncellendi.`;
    
    case 'user_delete':
      return `Bir üye silindi.`;
    
    case 'role_create':
      return `Yeni bir rütbe oluşturuldu.`;
    
    case 'role_update':
      return `Bir rütbe bilgisi güncellendi.`;
    
    case 'role_delete':
      return `Bir rütbe silindi.`;
    
    case 'meeting_update':
      return `Bir toplantı kaydı güncellendi.`;
    
    case 'event_update':
      return `Bir etkinlik güncellendi.`;
    
    case 'route_update':
      return `Bir rota güncellendi.`;
    
    case 'user_approval_approve':
      const approvedUserInfo = metadata?.userInfo || 'bir üye';
      return `${approvedUserInfo} adlı üye onaylandı.`;
    
    case 'user_approval_reject':
      const rejectedUserInfo = metadata?.userInfo || 'bir üye';
      return `${rejectedUserInfo} adlı üyenin kaydı reddedildi.`;
    
    case 'user_info_submitted':
      return `Üyelik bilgileri gönderildi ve onay bekleniyor.`;
    
    case 'user_registration_start':
      return `Üyelik kaydı oluşturuldu.`;
    
    case 'research_create':
      return `Yeni bir araştırma eklendi.`;
    
    case 'research_update':
      return `Bir araştırma güncellendi.`;
    
    case 'research_delete':
      return `Bir araştırma silindi.`;
    
    default:
      return `Bir işlem gerçekleştirildi. (${action})`;
  }
}

