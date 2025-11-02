import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Helper function to check if user has permission for a resource
// Middleware'de kullanmak için basitleştirilmiş sürüm
function hasPermission(permissions: any, resource: string, action?: string): boolean {
  if (!permissions) return false;
  
  const resourcePerms = permissions[resource];
  if (!resourcePerms) return false;
  
  if (!action) {
    // userApproval için özel kontrol
    if (resource === 'userApproval') {
      return Boolean(resourcePerms.approve || resourcePerms.reject);
    }
    // Genel olarak herhangi bir izin var mı kontrol et
    return Object.values(resourcePerms).some(v => Boolean(v));
  }
  
  // Özel durumlar
  if (resource === 'users' && action === 'read') {
    const readValue = typeof resourcePerms.read === 'object' ? resourcePerms.read.enabled : resourcePerms.read;
    return Boolean(readValue);
  }
  
  if (resource === 'userApproval') {
    if (action === 'approve' || action === 'reject') {
      return Boolean(resourcePerms[action]);
    }
    return false;
  }
  
  return Boolean(resourcePerms[action]);
}

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    
    // Dashboard'a erişim için 2FA zorunlu kontrolü
    if (req.nextUrl.pathname.startsWith('/dashboard')) {
      // Token yoksa login sayfasına yönlendir
      if (!token || !token.id) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('error', 'SessionExpired');
        return NextResponse.redirect(loginUrl);
      }
      
      // Üyelik durumu kontrolü - bazı sayfalar için izin ver
      const membershipStatus = (token.membershipStatus as string) || 'approved';
      const pathname = req.nextUrl.pathname;
      
      // Bilgi tamamlama ve onay bekliyor sayfalarına izin ver
      if (pathname === '/dashboard/complete-registration' || pathname === '/dashboard/pending-approval') {
        // Bu sayfalar için 2FA kontrolü yapmıyoruz (henüz onaylanmadı)
        return NextResponse.next();
      }
      
      // Diğer dashboard sayfaları için:
      // - approved olmalı
      if (membershipStatus === 'pending_info') {
        return NextResponse.redirect(new URL('/dashboard/complete-registration', req.url));
      }
      
      if (membershipStatus === 'pending_approval') {
        return NextResponse.redirect(new URL('/dashboard/pending-approval', req.url));
      }
      
      if (membershipStatus !== 'approved') {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('error', 'MembershipNotApproved');
        return NextResponse.redirect(loginUrl);
      }
      
      // Session token'ından 2FA durumunu kontrol et (Prisma Edge Runtime'da çalışmaz)
      const twoFactorEnabled = (token.twoFactorEnabled as boolean) ?? false;
      
      // 2FA kurulmamış veya aktif değilse setup sayfasına yönlendir
      if (!twoFactorEnabled) {
        return NextResponse.redirect(new URL('/settings/two-factor?required=true', req.url));
      }
      
      // Sayfa bazlı izin kontrolü
      const permissions = token.permissions as any;
      if (permissions) {
        let requiredResource: string | null = null;
        let requiredAction: string | null = null;
        
        // Path'e göre gerekli izinleri belirle
        if (pathname === '/dashboard/uyeler') {
          requiredResource = 'users';
          requiredAction = 'read';
        } else if (pathname === '/dashboard/uyeler/onay') {
          requiredResource = 'userApproval';
          requiredAction = null; // Herhangi bir yetki yeterli
        } else if (pathname === '/dashboard/toplanti-kayitlari') {
          requiredResource = 'meetings';
          requiredAction = 'read';
        } else if (pathname === '/dashboard/etkinlikler') {
          requiredResource = 'events';
          requiredAction = 'read';
        } else if (pathname === '/dashboard/gorevlendirmeler') {
          requiredResource = 'assignments';
          requiredAction = 'read';
        } else if (pathname === '/dashboard/rotalar') {
          requiredResource = 'routes';
          requiredAction = 'read';
        } else if (pathname === '/dashboard/duyurular') {
          requiredResource = 'announcements';
          requiredAction = 'read';
        } else if (pathname === '/dashboard/yetkilendirme') {
          requiredResource = 'roles';
          requiredAction = 'read';
        }
        
        // İzin kontrolü
        if (requiredResource && !hasPermission(permissions, requiredResource, requiredAction as string | undefined)) {
          return NextResponse.redirect(new URL('/dashboard?error=insufficient_permissions', req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/login',
    },
    callbacks: {
      authorized: ({ token, req }) => {
        // Dashboard ve settings sayfaları için token zorunlu
        if (req.nextUrl.pathname.startsWith('/dashboard') || req.nextUrl.pathname.startsWith('/settings')) {
          return !!token && !!token.id;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};

