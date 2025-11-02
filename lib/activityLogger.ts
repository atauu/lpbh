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
      return `${nameDisplay} kullanıcısı başarılı bir şekilde giriş yaptı.`;
    
    case 'login_failed':
      const reason = metadata?.reason || 'bilinmeyen neden';
      return `${nameDisplay} kullanıcısı giriş yapamadı. (${reason})`;
    
    case 'logout':
      return `${nameDisplay} kullanıcısı çıkış yaptı.`;
    
    case 'profile_update':
      return `${nameDisplay} kullanıcısı bilgilerini güncelledi.`;
    
    case 'password_change':
      return `${nameDisplay} kullanıcısı şifresini değiştirdi.`;
    
    case '2fa_setup':
      return `${nameDisplay} kullanıcısı 2FA'yı etkinleştirdi.`;
    
    case '2fa_disable':
      return `${nameDisplay} kullanıcısı 2FA'yı devre dışı bıraktı.`;
    
    case 'meeting_create':
      return `${nameDisplay} kullanıcısı yeni bir toplantı kaydı ekledi.`;
    
    case 'meeting_delete':
      return `${nameDisplay} kullanıcısı bir toplantı kaydını sildi.`;
    
    case 'event_create':
      return `${nameDisplay} kullanıcısı yeni bir etkinlik oluşturdu.`;
    
    case 'event_delete':
      return `${nameDisplay} kullanıcısı bir etkinliği sildi.`;
    
    case 'event_rsvp':
      const rsvpStatus = metadata?.status === 'attending' ? 'katılıyor' : 'katılmıyor';
      return `${nameDisplay} kullanıcısı bir etkinliğe ${rsvpStatus} olarak cevap verdi.`;
    
    case 'assignment_create':
      return `${nameDisplay} kullanıcısı yeni bir görevlendirme oluşturdu.`;
    
    case 'assignment_update':
      const status = metadata?.status;
      if (status === 'completed') {
        return `${nameDisplay} kullanıcısı bir görevi tamamladı.`;
      } else if (status === 'cancelled') {
        return `${nameDisplay} kullanıcısı bir görevi iptal etti.`;
      }
      return `${nameDisplay} kullanıcısı bir görevi güncelledi.`;
    
    case 'assignment_delete':
      return `${nameDisplay} kullanıcısı bir görevlendirmeyi sildi.`;
    
    case 'route_create':
      return `${nameDisplay} kullanıcısı yeni bir rota ekledi.`;
    
    case 'route_delete':
      return `${nameDisplay} kullanıcısı bir rotayı sildi.`;
    
    case 'announcement_create':
      return `${nameDisplay} kullanıcısı yeni bir duyuru oluşturdu.`;
    
    case 'announcement_update':
      return `${nameDisplay} kullanıcısı bir duyuruyu güncelledi.`;
    
    case 'announcement_delete':
      return `${nameDisplay} kullanıcısı bir duyuruyu sildi.`;
    
    case 'user_create':
      return `${nameDisplay} kullanıcısı yeni bir üye ekledi.`;
    
    case 'user_update':
      return `${nameDisplay} kullanıcısı bir üye bilgisini güncelledi.`;
    
    case 'user_delete':
      return `${nameDisplay} kullanıcısı bir üyeyi sildi.`;
    
    case 'role_create':
      return `${nameDisplay} kullanıcısı yeni bir rütbe oluşturdu.`;
    
    case 'role_update':
      return `${nameDisplay} kullanıcısı bir rütbe bilgisini güncelledi.`;
    
    case 'role_delete':
      return `${nameDisplay} kullanıcısı bir rütbeyi sildi.`;
    
    case 'meeting_update':
      return `${nameDisplay} kullanıcısı bir toplantı kaydını güncelledi.`;
    
    case 'event_update':
      return `${nameDisplay} kullanıcısı bir etkinliği güncelledi.`;
    
    case 'route_update':
      return `${nameDisplay} kullanıcısı bir rotayı güncelledi.`;
    
    case 'user_approval_approve':
      const approvedUserInfo = metadata?.userInfo || 'bir üye';
      return `${nameDisplay} kullanıcısı ${approvedUserInfo} adlı üyeyi onayladı.`;
    
    case 'user_approval_reject':
      const rejectedUserInfo = metadata?.userInfo || 'bir üye';
      return `${nameDisplay} kullanıcısı ${rejectedUserInfo} adlı üyenin kaydını reddetti.`;
    
    case 'user_info_submitted':
      return `${nameDisplay} kullanıcısı üyelik bilgilerini gönderdi ve onay bekliyor.`;
    
    case 'user_registration_start':
      return `${nameDisplay} kullanıcısı üyelik kaydı oluşturuldu.`;
    
    default:
      return `${nameDisplay} kullanıcısı bir işlem gerçekleştirdi. (${action})`;
  }
}

