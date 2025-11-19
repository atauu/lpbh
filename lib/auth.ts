import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { verifyTwoFactorToken } from './two-factor';
import { logActivity, getActivityDescription } from './activityLogger';

// Helper function to check if user has permission for a resource
export function hasPermission(permissions: any, resource: string, action?: string): boolean {
  if (!permissions) return false;
  
  const resourcePerms = permissions[resource];
  if (!resourcePerms) return false;
  
  if (!action) {
    // Eğer action belirtilmemişse, resource için herhangi bir izin olup olmadığını kontrol et
    // Özel durumlar için kontrol yap
    if (resource === 'userApproval') {
      return Boolean(resourcePerms.approve || resourcePerms.reject);
    }
    // Genel olarak herhangi bir izin var mı kontrol et
    return Object.values(resourcePerms).some(v => Boolean(v));
  }
  
  // Özel durumlar
  if (resource === 'users' && action === 'read') {
    // users.read obje olabilir
    const readValue = typeof resourcePerms.read === 'object' ? resourcePerms.read.enabled : resourcePerms.read;
    return Boolean(readValue);
  }
  
  // userApproval için approve/reject kontrolü
  if (resource === 'userApproval') {
    if (action === 'approve' || action === 'reject') {
      return Boolean(resourcePerms[action]);
    }
    return false;
  }
  
  return Boolean(resourcePerms[action]);
}

// Server epoch: changes on each server start to invalidate existing JWTs
const SERVER_SESSION_EPOCH = process.env.SESSION_EPOCH || `${Date.now()}`;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Kullanıcı Adı', type: 'text' },
        password: { label: 'Şifre', type: 'password' },
        twoFactorToken: { label: '2FA Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Önce username ile kullanıcıyı bul (twoFactorSecret dahil)
        const user = await prisma.user.findUnique({
          where: {
            username: credentials.username,
          },
          select: {
            id: true,
            username: true,
            password: true,
            rutbe: true,
            isim: true,
            soyisim: true,
            membershipStatus: true,
            twoFactorEnabled: true,
            twoFactorSecret: true, // Explicitly select secret
          },
        });


        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Üyelik durumu kontrolü
        // pending_info ve pending_approval durumlarında login'e izin ver
        // Ama session'a durumu ekleyip yönlendirme yapacağız
        // rejected durumu artık olamaz çünkü reddedilen üyeler siliniyor
        // Ama yine de kontrol edelim
        if (user.membershipStatus === 'rejected') {
          throw new Error('MEMBERSHIP_REJECTED');
        }

        // approved, pending_info, pending_approval durumlarında login başarılı
        // Yönlendirme frontend'de yapılacak

        // Global 2FA ayarını kontrol et - cache'i bypass etmek için raw query kullan
        // Bu sayede sunucuyu yeniden başlatmaya gerek kalmadan anında değişiklikler yansır
        let isGlobal2FAEnabled = false;
        try {
          const global2FASettingResult = await prisma.$queryRaw<Array<{ value: string }>>`
            SELECT value FROM system_settings WHERE key = 'twoFactorEnabled' LIMIT 1
          `;
          isGlobal2FAEnabled = global2FASettingResult.length > 0 && global2FASettingResult[0]?.value === 'true';
        } catch (error) {
          // Eğer tablo yoksa veya hata varsa, global 2FA kapalı kabul et
          console.error('Error checking global 2FA setting:', error);
          isGlobal2FAEnabled = false;
        }

        // Debug: 2FA durumunu logla
        console.log('2FA Check:', {
          username: user.username,
          global2FAEnabled: isGlobal2FAEnabled,
          userTwoFactorEnabled: user.twoFactorEnabled,
          userHasSecret: !!user.twoFactorSecret,
        });

        // ÖNEMLİ: Sadece global 2FA açıksa 2FA kontrolü yap
        // Eğer global 2FA kapalıysa, kullanıcının kendi 2FA'sı olsa bile kontrol etme
        if (isGlobal2FAEnabled) {
          // Global 2FA aktifse kontrol yap
          
          // Kullanıcının 2FA'sı kurulu mu kontrol et
          if (!user.twoFactorEnabled || !user.twoFactorSecret) {
            // Kullanıcının 2FA'sı yoksa, kurmasını iste
            console.error('2FA required but not setup:', {
              username: user.username,
              global2FAEnabled: isGlobal2FAEnabled,
              userTwoFactorEnabled: user.twoFactorEnabled,
              userHasSecret: !!user.twoFactorSecret,
            });
            throw new Error('2FA_REQUIRED_BUT_NOT_SETUP');
          }

          // Kullanıcının 2FA'sı var, token zorunlu
          if (!credentials.twoFactorToken) {
            // Token yoksa özel bir hata fırlat
            // Bu durumda kullanıcı verification sayfasına yönlendirilecek
            throw new Error('2FA_TOKEN_REQUIRED');
          }

          // Token doğrula - token'ı temizle
          const cleanToken = String(credentials.twoFactorToken || '').trim().replace(/\D/g, '').slice(0, 6);
          
          if (cleanToken.length !== 6) {
            throw new Error('2FA_TOKEN_INVALID');
          }

          // Secret'ı temizle
          if (!user.twoFactorSecret) {
            throw new Error('2FA_TOKEN_INVALID');
          }
          
          const cleanSecret = String(user.twoFactorSecret).trim();
          
          if (!cleanSecret || cleanSecret.length === 0) {
            throw new Error('2FA_TOKEN_INVALID');
          }

          const isValidToken = verifyTwoFactorToken(cleanSecret, cleanToken);

          if (!isValidToken) {
            throw new Error('2FA_TOKEN_INVALID');
          }
        }
        // Global 2FA kapalıysa hiçbir 2FA kontrolü yapma, direkt geç

        // Başarılı login'i logla (IP/UA sonra eklenecek)
        const fullName = user.isim && user.soyisim ? `${user.isim} ${user.soyisim}` : '';
        const description = getActivityDescription(user.username, fullName, 'login_success');
        await logActivity(
          user.id,
          'login_success',
          description
        );

        return {
          id: user.id,
          username: user.username,
          rutbe: user.rutbe,
          isim: user.isim,
          soyisim: user.soyisim,
          membershipStatus: user.membershipStatus,
          twoFactorEnabled: user.twoFactorEnabled,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    // Standard session duration
    maxAge: 60 * 60 * 24, // 24 hours
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.rutbe = user.rutbe;
        token.isim = (user as any).isim;
        token.soyisim = (user as any).soyisim;
        token.membershipStatus = (user as any).membershipStatus;
        token.twoFactorEnabled = (user as any).twoFactorEnabled || false;
        token.isSystemAdmin = (user as any).isSystemAdmin || false;
        
        // Sistem görevlisi kontrolü - tüm izinleri ver
        if ((user as any).isSystemAdmin) {
          token.permissions = {
            users: {
              create: true,
              read: {
                enabled: true,
                readableFields: ['id', 'username', 'rutbe', 'membershipStatus', 'isim', 'soyisim', 'tckn', 'telefon', 'evAdresi', 'yakiniIsmi', 'yakiniTelefon', 'ruhsatSeriNo', 'kanGrubu', 'createdAt', 'updatedAt'],
              },
              update: true,
              delete: true,
            },
            userApproval: { approve: true, reject: true },
            meetings: { create: true, read: true, update: true, delete: true },
            documents: { create: true, read: true, update: true, delete: true },
            polls: { create: true, read: true, update: true, delete: true },
            events: { create: true, read: true, update: true, delete: true },
            assignments: { create: true, read: true, update: true, delete: true },
            routes: { create: true, read: true, update: true, delete: true },
            roles: { create: true, read: true, update: true, delete: true },
            announcements: { create: true, read: true, update: true, delete: true },
            activityLogs: { read: true },
            researches: { create: true, read: true, update: true, delete: true },
            messages: { create: true, read: true, update: true, delete: true },
            citizenDatabase: { read: true },
          };
        } else if (user.rutbe) {
          // Rütbe yetkilerini ekle
          try {
            const role = await prisma.role.findUnique({
              where: { name: user.rutbe },
              select: { permissions: true },
            });
            if (role) {
              token.permissions = role.permissions;
            }
          } catch (error) {
            console.error('Error fetching role permissions:', error);
          }
        }
      }
      
      // Session update tetiklendiğinde veritabanından 2FA durumunu kontrol et
      if (trigger === 'update' && token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { 
              twoFactorEnabled: true,
              membershipStatus: true,
              isim: true,
              soyisim: true,
              rutbe: true,
              isSystemAdmin: true,
            },
          });
          if (dbUser) {
            token.twoFactorEnabled = dbUser.twoFactorEnabled;
            token.membershipStatus = dbUser.membershipStatus;
            token.isim = dbUser.isim;
            token.soyisim = dbUser.soyisim;
            token.rutbe = dbUser.rutbe;
            token.isSystemAdmin = dbUser.isSystemAdmin || false;
            
            // Sistem görevlisi kontrolü - tüm izinleri ver
            if (dbUser.isSystemAdmin) {
              token.permissions = {
                users: {
                  create: true,
                  read: {
                    enabled: true,
                    readableFields: ['id', 'username', 'rutbe', 'membershipStatus', 'isim', 'soyisim', 'tckn', 'telefon', 'evAdresi', 'yakiniIsmi', 'yakiniTelefon', 'ruhsatSeriNo', 'kanGrubu', 'createdAt', 'updatedAt'],
                  },
                  update: true,
                  delete: true,
                },
                userApproval: { approve: true, reject: true },
                meetings: { create: true, read: true, update: true, delete: true },
                documents: { create: true, read: true, update: true, delete: true },
                polls: { create: true, read: true, update: true, delete: true },
                events: { create: true, read: true, update: true, delete: true },
                assignments: { create: true, read: true, update: true, delete: true },
                routes: { create: true, read: true, update: true, delete: true },
                roles: { create: true, read: true, update: true, delete: true },
                announcements: { create: true, read: true, update: true, delete: true },
                activityLogs: { read: true },
                researches: { create: true, read: true, update: true, delete: true },
                messages: { create: true, read: true, update: true, delete: true },
              };
            } else if (dbUser.rutbe) {
              // Yetkileri yeniden çek
              const role = await prisma.role.findUnique({
                where: { name: dbUser.rutbe },
                select: { permissions: true },
              });
              if (role) {
                token.permissions = role.permissions;
              }
            }
          }
        } catch (error) {
          // Hata durumunda token'daki değeri koru
          console.error('Error updating user status in JWT:', error);
        }
      }
      
      // Attach the server epoch to token. If server restarts, epoch changes and token becomes invalid.
      (token as any).epoch = SERVER_SESSION_EPOCH;
      return token;
    },
    async session({ session, token }) {
      // If token epoch mismatches current server epoch, force session invalidation by clearing critical fields
      if ((token as any)?.epoch !== SERVER_SESSION_EPOCH) {
        // Clearing user id will cause middleware authorized() to fail and redirect to /login
        delete (session as any).user;
        return session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.rutbe = token.rutbe as string | null;
        session.user.isim = token.isim as string | null;
        session.user.soyisim = token.soyisim as string | null;
        session.user.membershipStatus = token.membershipStatus as string;
        session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
        session.user.isSystemAdmin = token.isSystemAdmin as boolean;
        session.user.permissions = token.permissions as any;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

