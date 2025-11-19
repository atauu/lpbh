import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { normalizeName } from '@/lib/utils';
import { hasPermission } from '@/lib/auth';
import { logActivity, getActivityDescription } from '@/lib/activityLogger';

// GET: Tüm üyeleri listele
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Kullanıcının izinlerini al (session'dan)
    const permissions = (session as any)?.user?.permissions;
    
    // Okunabilir alanları belirle
    let readableFields: string[] = [];
    if (permissions?.users?.read) {
      const readPerm = permissions.users.read;
      if (typeof readPerm === 'object' && readPerm.enabled && readPerm.readableFields) {
        readableFields = readPerm.readableFields;
      } else if (readPerm === true) {
        // Tüm alanlar okunabilir
        readableFields = ['id', 'username', 'rutbe', 'membershipStatus', 'isim', 'soyisim', 'tckn', 'telefon', 'evAdresi', 'yakiniIsmi', 'yakiniTelefon', 'ruhsatSeriNo', 'kanGrubu', 'plaka', 'ehliyetTuru', 'createdAt', 'updatedAt'];
      }
    }

    // Tüm üyeleri getir (şifre hariç)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        rutbe: true,
        membershipStatus: true,
        isim: true,
        soyisim: true,
        tckn: true,
        telefon: true,
        evAdresi: true,
        yakiniIsmi: true,
        yakiniTelefon: true,
        ruhsatSeriNo: true,
        kanGrubu: true,
        plaka: true,
        ehliyetTuru: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('Fetched users count:', users.length);
    console.log('Sample user:', users[0] ? { id: users[0].id, username: users[0].username, status: users[0].membershipStatus } : 'No users');
    console.log('Readable fields:', readableFields);

    // İzinlere göre alanları filtrele
    const usersFiltered = users.map((user: any) => {
      const filtered: any = { id: user.id }; // id her zaman gösterilmeli (silme/düzenleme için)
      
      // Okunabilir alanları ekle
      if (readableFields.length === 0) {
        // Hiç izin yoksa sadece id döndür
        return filtered;
      }
      
      if (readableFields.includes('username')) filtered.username = user.username;
      if (readableFields.includes('rutbe')) filtered.rutbe = user.rutbe;
      if (readableFields.includes('membershipStatus')) filtered.membershipStatus = user.membershipStatus || 'approved';
      if (readableFields.includes('isim')) filtered.isim = user.isim;
      if (readableFields.includes('soyisim')) filtered.soyisim = user.soyisim;
      if (readableFields.includes('tckn')) filtered.tckn = user.tckn;
      if (readableFields.includes('telefon')) filtered.telefon = user.telefon;
      if (readableFields.includes('evAdresi')) filtered.evAdresi = user.evAdresi;
      if (readableFields.includes('yakiniIsmi')) filtered.yakiniIsmi = user.yakiniIsmi;
      if (readableFields.includes('yakiniTelefon')) filtered.yakiniTelefon = user.yakiniTelefon;
      if (readableFields.includes('ruhsatSeriNo')) filtered.ruhsatSeriNo = user.ruhsatSeriNo;
      if (readableFields.includes('kanGrubu')) filtered.kanGrubu = user.kanGrubu;
      // plaka ve ehliyetTuru her zaman eklenmeli (yeni alanlar)
      filtered.plaka = user.plaka;
      filtered.ehliyetTuru = user.ehliyetTuru || [];
      if (readableFields.includes('createdAt')) filtered.createdAt = user.createdAt;
      if (readableFields.includes('updatedAt')) filtered.updatedAt = user.updatedAt;
      
      // membershipStatus null olanları approved yap (backward compatibility)
      if (!filtered.membershipStatus && 'membershipStatus' in user) {
        filtered.membershipStatus = user.membershipStatus || 'approved';
      }
      
      return filtered;
    });

    return NextResponse.json(usersFiltered);
  } catch (error: any) {
    console.error('Users fetch error:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        error: 'Üyeler yüklenemedi',
        details: error?.message || 'Bilinmeyen hata'
      },
      { status: 500 }
    );
  }
}

// POST: Yeni üye ekle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // İzin kontrolü
    const permissions = (session as any)?.user?.permissions;
    if (!hasPermission(permissions, 'users', 'create')) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz bulunmuyor' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      username,
      password,
      rutbe,
      isim,
      soyisim,
      tckn,
      telefon,
      evAdresi,
      yakiniIsmi,
      yakiniTelefon,
      ruhsatSeriNo,
      kanGrubu,
      plaka,
      ehliyetTuru,
    } = body;

    // Kullanıcı adı ve şifre zorunlu
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Kullanıcı adı ve şifre zorunludur' },
        { status: 400 }
      );
    }

    // Kullanıcı adının benzersiz olduğunu kontrol et
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Bu kullanıcı adı zaten kullanılıyor' },
        { status: 400 }
      );
    }

    // Şifreyi hash'le
    const hashedPassword = await bcrypt.hash(password, 10);

    // Yeni kullanıcı oluştur (pending_info durumunda)
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        rutbe: rutbe || null,
        membershipStatus: 'pending_info', // Bilgilerini girmesi gerekiyor
        registrationToken: null, // Artık token kullanmıyoruz, normal giriş yapacak
        isim: null, // Kullanıcı kendisi girecek
        soyisim: null,
        tckn: null,
        telefon: null,
        evAdresi: null,
        yakiniIsmi: null,
        yakiniTelefon: null,
        ruhsatSeriNo: null,
        kanGrubu: null,
        plaka: null,
        ehliyetTuru: [],
      },
      select: {
        id: true,
        username: true,
        rutbe: true,
        membershipStatus: true,
        registrationToken: true,
        isim: true,
        soyisim: true,
        tckn: true,
        telefon: true,
        evAdresi: true,
        yakiniIsmi: true,
        yakiniTelefon: true,
        ruhsatSeriNo: true,
        kanGrubu: true,
        plaka: true,
        ehliyetTuru: true,
        createdAt: true,
      },
    });

    // Üye oluşturma logunu kaydet
    const userNameDisplay = session?.user?.username || '';
    const userFullName = session?.user?.isim && session?.user?.soyisim 
      ? `${session.user.isim} ${session.user.soyisim}` 
      : '';
    const description = getActivityDescription(userNameDisplay, userFullName, 'user_create', {
      createdUserInfo: `"${username}" kullanıcı adı ile ${rutbe || 'rütbesiz'}`
    });
    
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    await logActivity(
      session.user.id,
      'user_create',
      description,
      {},
      ipAddress,
      userAgent
    );

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: 'Üye eklenemedi' },
      { status: 500 }
    );
  }
}

