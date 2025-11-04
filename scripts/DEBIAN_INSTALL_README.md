# Debian Sunucu Kurulum Kılavuzu

Bu kılavuz, LPBH FOP uygulamasını Debian tabanlı bir sunucuda production modda çalıştırmak için gereken adımları açıklar.

## Ön Gereksinimler

- Debian 11+ (Bullseye veya üzeri)
- Root veya sudo yetkileri
- İnternet bağlantısı
- En az 2GB RAM (önerilen: 4GB+)
- En az 10GB boş disk alanı

## Hızlı Kurulum

1. Script'i indirin veya projeyi klonlayın:
```bash
git clone <repository-url>
cd lpbh
```

2. Script'i çalıştırılabilir yapın:
```bash
chmod +x scripts/debian-install.sh
```

3. Script'i root yetkisi ile çalıştırın:
```bash
sudo bash scripts/debian-install.sh
```

## Kurulum Sırasında Sorulacak Sorular

Script çalıştırıldığında aşağıdaki bilgiler sorulacaktır:

1. **Proje dizini**: Uygulamanın kurulacağı dizin (varsayılan: `/opt/lpbh`)
2. **PostgreSQL kullanıcı adı**: Veritabanı kullanıcısı (varsayılan: `postgres`)
3. **PostgreSQL şifresi**: Veritabanı şifresi (güvenli bir şifre seçin)
4. **PostgreSQL veritabanı adı**: Veritabanı adı (varsayılan: `lpbh_fop`)
5. **Domain adı**: Eğer bir domain kullanacaksanız (opsiyonel)
6. **NEXTAUTH_URL**: Uygulamanın URL'i (varsayılan: `http://localhost:3000`)
7. **Uygulama kullanıcısı**: Uygulamanın çalışacağı sistem kullanıcısı (varsayılan: `lpbh`)
8. **Port numarası**: Uygulamanın dinleyeceği port (varsayılan: `3000`)
9. **Git repository URL**: GitHub repository URL'i (zorunlu)
   - Örnek: `https://github.com/kullaniciadi/lpbh.git`
   - Örnek: `git@github.com:kullaniciadi/lpbh.git`

## Script'in Yaptığı İşlemler

1. ✅ Sistem güncellemeleri
2. ✅ Temel araçların kurulumu (curl, wget, git, build-essential)
3. ✅ Node.js 20.x kurulumu
4. ✅ PostgreSQL kurulumu ve yapılandırması
5. ✅ Veritabanı ve kullanıcı oluşturma
6. ✅ Uygulama kullanıcısı oluşturma
7. ✅ GitHub repository'den proje klonlanması
8. ✅ NEXTAUTH_SECRET oluşturma
9. ✅ .env dosyası oluşturma
10. ✅ npm bağımlılıklarının yüklenmesi
11. ✅ Prisma client oluşturma
12. ✅ Veritabanı migration
13. ✅ Veritabanı seed (ilk kullanıcı)
14. ✅ Production build
15. ✅ PM2 kurulumu ve yapılandırması
16. ✅ PM2 ile uygulama başlatma
17. ✅ Nginx kurulumu ve yapılandırması (domain varsa)
18. ✅ Firewall ayarları (UFW)
19. ✅ Upload dizinlerinin oluşturulması

## Kurulum Sonrası

### Uygulama Durumu

```bash
# PM2 ile uygulama durumunu kontrol et
sudo -u lpbh pm2 status

# Logları görüntüle
sudo -u lpbh pm2 logs lpbh-fop

# Uygulamayı yeniden başlat
sudo -u lpbh pm2 restart lpbh-fop

# Uygulamayı durdur
sudo -u lpbh pm2 stop lpbh-fop
```

### İlk Giriş

Kurulum sonrası ilk kullanıcı bilgileri:
- **Kullanıcı adı**: `ata`
- **Şifre**: `ata`

⚠️ **ÖNEMLİ**: İlk girişten sonra mutlaka şifreyi değiştirin!

### SSL Sertifikası (Domain varsa)

Eğer domain kullandıysanız, SSL sertifikası kurmak için:

```bash
# Certbot kurulumu
sudo apt-get install certbot python3-certbot-nginx

# SSL sertifikası al
sudo certbot --nginx -d yourdomain.com

# Otomatik yenileme testi
sudo certbot renew --dry-run
```

### Nginx Yapılandırması

Nginx config dosyası: `/etc/nginx/sites-available/lpbh`

Değişiklik yaptıktan sonra:
```bash
sudo nginx -t  # Yapılandırmayı test et
sudo systemctl reload nginx  # Nginx'i yeniden yükle
```

### Firewall

UFW firewall kurallarını aktifleştirmek için:

```bash
sudo ufw enable
sudo ufw status
```

### Veritabanı Yedekleme

Düzenli yedekleme için:

```bash
# Yedek al
sudo -u postgres pg_dump lpbh_fop > backup_$(date +%Y%m%d).sql

# Yedekten geri yükle
sudo -u postgres psql lpbh_fop < backup_YYYYMMDD.sql
```

Otomatik yedekleme için cron job ekleyebilirsiniz:

```bash
# Crontab düzenle
sudo crontab -e

# Her gece 02:00'da yedek al
0 2 * * * sudo -u postgres pg_dump lpbh_fop > /backups/lpbh_fop_$(date +\%Y\%m\%d).sql
```

## Sorun Giderme

### Uygulama başlamıyor

1. Logları kontrol edin:
```bash
sudo -u lpbh pm2 logs lpbh-fop
```

2. .env dosyasını kontrol edin:
```bash
sudo cat /opt/lpbh/.env
```

3. Veritabanı bağlantısını test edin:
```bash
sudo -u postgres psql -U postgres -d lpbh_fop
```

### Port zaten kullanımda

Farklı bir port kullanmak için:
1. `ecosystem.config.js` dosyasını düzenleyin
2. Nginx config'i güncelleyin (varsa)
3. PM2'yi yeniden başlatın

### PM2 startup script hatası

PM2 çıktısında gösterilen komutu çalıştırın:
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u lpbh --hp /home/lpbh
```

## Güncelleme

Uygulamayı güncellemek için:

```bash
cd /opt/lpbh
sudo -u lpbh git pull
sudo -u lpbh npm install
sudo -u lpbh npm run db:generate
sudo -u lpbh npm run db:push
sudo -u lpbh npm run build
sudo -u lpbh pm2 restart lpbh-fop
```

## Manuel Kurulum

Script kullanmak istemiyorsanız, yukarıdaki adımları manuel olarak takip edebilirsiniz. Script'in yaptığı tüm işlemler yukarıda listelenmiştir.

## Destek

Sorun yaşarsanız:
1. Log dosyalarını kontrol edin: `/opt/lpbh/logs/`
2. PM2 loglarını kontrol edin: `sudo -u lpbh pm2 logs`
3. Nginx loglarını kontrol edin: `/var/log/nginx/`

