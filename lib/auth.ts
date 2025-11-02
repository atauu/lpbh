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

        // 2FA kontrolü - username/password doğru, şimdi 2FA kontrolü yap
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          // 2FA aktifse, token zorunlu
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
        // 2FA kurulmamışsa normal şekilde devam et

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
    maxAge: 60 * 60 * 24, // 24 saat (pencere kapandığında client-side'da temizlenecek)
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
        
        // Rütbe yetkilerini ekle
        if (user.rutbe) {
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
            },
          });
          if (dbUser) {
            token.twoFactorEnabled = dbUser.twoFactorEnabled;
            token.membershipStatus = dbUser.membershipStatus;
            token.isim = dbUser.isim;
            token.soyisim = dbUser.soyisim;
            token.rutbe = dbUser.rutbe;
            
            // Yetkileri yeniden çek
            if (dbUser.rutbe) {
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
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.rutbe = token.rutbe as string | null;
        session.user.isim = token.isim as string | null;
        session.user.soyisim = token.soyisim as string | null;
        session.user.membershipStatus = token.membershipStatus as string;
        session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
        session.user.permissions = token.permissions as any;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

