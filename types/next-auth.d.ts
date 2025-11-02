import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      rutbe?: string | null;
      isim?: string | null;
      soyisim?: string | null;
      twoFactorEnabled?: boolean;
      membershipStatus?: string;
      permissions?: any;
    };
  }

  interface User {
    id: string;
    username: string;
    rutbe?: string | null;
    isim?: string | null;
    soyisim?: string | null;
    twoFactorEnabled?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
    rutbe?: string | null;
    isim?: string | null;
    soyisim?: string | null;
    twoFactorEnabled?: boolean;
    membershipStatus?: string;
    permissions?: any;
  }
}

