#!/bin/bash

# LPBH FOP - Debian Sunucu Kurulum Scripti
# Bu script tüm gereksinimleri kurar ve uygulamayı production modda çalışır hale getirir

set -e  # Hata durumunda dur

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log fonksiyonu
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Root kontrolü
if [ "$EUID" -ne 0 ]; then 
    log_error "Bu script root yetkisi ile çalıştırılmalıdır."
    log_info "Kullanım: sudo bash debian-install.sh"
    exit 1
fi

log_info "LPBH FOP - Debian Sunucu Kurulum Scripti"
echo ""

# Kullanıcıdan bilgileri al
read -p "Proje dizini nerede kurulacak? (varsayılan: /opt/lpbh): " PROJECT_DIR
PROJECT_DIR=${PROJECT_DIR:-/opt/lpbh}

read -p "PostgreSQL kullanıcı adı (varsayılan: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "PostgreSQL şifresi: " DB_PASSWORD
echo ""

read -p "PostgreSQL veritabanı adı (varsayılan: lpbh_fop): " DB_NAME
DB_NAME=${DB_NAME:-lpbh_fop}

read -p "Domain adı (örn: example.com) [opsiyonel]: " DOMAIN

read -p "NEXTAUTH_URL (varsayılan: http://localhost:3000): " NEXTAUTH_URL
NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}

read -p "Uygulama çalışacak kullanıcı (varsayılan: lpbh): " APP_USER
APP_USER=${APP_USER:-lpbh}

read -p "Port numarası (varsayılan: 3000): " APP_PORT
APP_PORT=${APP_PORT:-3000}

# Git repository bilgisi (opsiyonel)
read -p "Git repository URL (zorunlu): " GIT_REPO
if [ -z "$GIT_REPO" ]; then
    log_error "Git repository URL zorunludur!"
    log_info "Örnek: https://github.com/kullaniciadi/lpbh.git"
    exit 1
fi

echo ""
log_info "Kurulum başlıyor..."

# 1. Sistem güncellemeleri
log_info "Sistem güncellemeleri yapılıyor..."
apt-get update
apt-get upgrade -y

# 2. Temel araçları kur
log_info "Temel araçlar kuruluyor..."
apt-get install -y curl wget git build-essential software-properties-common

# 3. Node.js kurulumu (NodeSource repository)
log_info "Node.js kuruluyor..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    log_warn "Node.js zaten kurulu: $(node --version)"
fi

log_info "Node.js versiyonu: $(node --version)"
log_info "npm versiyonu: $(npm --version)"

# 4. PostgreSQL kurulumu
log_info "PostgreSQL kuruluyor..."
if ! command -v psql &> /dev/null; then
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
else
    log_warn "PostgreSQL zaten kurulu"
    systemctl start postgresql || true
fi

# 5. PostgreSQL veritabanı ve kullanıcı oluştur
log_info "PostgreSQL veritabanı oluşturuluyor..."
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" 2>/dev/null || log_warn "Kullanıcı zaten mevcut"
sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH SUPERUSER;" 2>/dev/null || true
sudo -u postgres createdb ${DB_NAME} 2>/dev/null || log_warn "Veritabanı zaten mevcut"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

# 6. Uygulama kullanıcısı oluştur
log_info "Uygulama kullanıcısı oluşturuluyor..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash $APP_USER
    log_info "Kullanıcı $APP_USER oluşturuldu"
else
    log_warn "Kullanıcı $APP_USER zaten mevcut"
fi

# 7. Proje dizini oluştur ve GitHub'dan clone et
log_info "Proje dizini hazırlanıyor..."
mkdir -p $PROJECT_DIR
chown $APP_USER:$APP_USER $PROJECT_DIR

log_info "GitHub repository'den proje klonlanıyor..."
if sudo -u $APP_USER git clone $GIT_REPO $PROJECT_DIR; then
    log_info "Proje başarıyla klonlandı"
else
    log_error "Proje klonlanamadı! Git repository URL'ini kontrol edin."
    exit 1
fi

# 8. NEXTAUTH_SECRET oluştur
log_info "NEXTAUTH_SECRET oluşturuluyor..."
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# 9. .env dosyası oluştur
log_info ".env dosyası oluşturuluyor..."
cat > $PROJECT_DIR/.env << EOF
# Database
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"

# NextAuth
NEXTAUTH_URL="${NEXTAUTH_URL}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# Node Environment
NODE_ENV="production"
EOF

chown $APP_USER:$APP_USER $PROJECT_DIR/.env
chmod 600 $PROJECT_DIR/.env

# 10. Bağımlılıkları yükle
log_info "Bağımlılıklar yükleniyor..."
cd $PROJECT_DIR
sudo -u $APP_USER npm install --production=false

# 11. Prisma client oluştur
log_info "Prisma client oluşturuluyor..."
sudo -u $APP_USER npm run db:generate

# 12. Veritabanı migration
log_info "Veritabanı migration yapılıyor..."
sudo -u $APP_USER npm run db:push

# 13. Seed (opsiyonel - ilk kullanıcı)
log_info "Veritabanı seed ediliyor..."
sudo -u $APP_USER npm run db:seed || log_warn "Seed işlemi başarısız oldu (opsiyonel)"

# 14. Build
log_info "Production build yapılıyor..."
sudo -u $APP_USER npm run build

# 15. PM2 kurulumu ve yapılandırma
log_info "PM2 kuruluyor..."
npm install -g pm2

# PM2 ecosystem dosyası oluştur
cat > $PROJECT_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'lpbh-fop',
    script: 'npm',
    args: 'run server',
    cwd: '$PROJECT_DIR',
    interpreter: 'none',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT
    },
    error_file: '$PROJECT_DIR/logs/pm2-error.log',
    out_file: '$PROJECT_DIR/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
EOF

chown $APP_USER:$APP_USER $PROJECT_DIR/ecosystem.config.js

# Log dizini oluştur
mkdir -p $PROJECT_DIR/logs
chown $APP_USER:$APP_USER $PROJECT_DIR/logs

# 16. PM2'yi başlat
log_info "PM2 ile uygulama başlatılıyor..."
sudo -u $APP_USER pm2 start $PROJECT_DIR/ecosystem.config.js
sudo -u $APP_USER pm2 save

# PM2 startup script
log_info "PM2 startup script oluşturuluyor..."
STARTUP_CMD=$(sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER | grep "sudo")
if [ -n "$STARTUP_CMD" ]; then
    log_warn "PM2 startup komutu çalıştırılıyor..."
    eval "$STARTUP_CMD"
    log_info "PM2 startup script kuruldu."
else
    log_warn "PM2 startup script otomatik kurulamadı. Manuel olarak çalıştırmanız gerekebilir."
fi

# 17. Nginx kurulumu ve yapılandırma (opsiyonel - domain varsa)
if [ -n "$DOMAIN" ]; then
    log_info "Nginx kuruluyor..."
    apt-get install -y nginx

    # Nginx config oluştur
    cat > /etc/nginx/sites-available/lpbh << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Proxy ayarları
    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Upload limit
    client_max_body_size 50M;
}
EOF

    # Nginx config'i aktifleştir
    ln -sf /etc/nginx/sites-available/lpbh /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # Nginx'i test et ve başlat
    nginx -t
    systemctl restart nginx
    systemctl enable nginx

    log_info "Nginx yapılandırıldı. SSL sertifikası için Let's Encrypt kullanabilirsiniz:"
    log_info "apt-get install certbot python3-certbot-nginx"
    log_info "certbot --nginx -d ${DOMAIN}"
fi

# 18. Firewall ayarları (ufw)
if command -v ufw &> /dev/null; then
    log_info "Firewall ayarları yapılıyor..."
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow ${APP_PORT}/tcp
    log_warn "UFW kuralları eklendi. 'ufw enable' ile aktifleştirin."
fi

# 19. Upload dizini oluştur
log_info "Upload dizinleri oluşturuluyor..."
sudo -u $APP_USER mkdir -p $PROJECT_DIR/uploads/{assignments,meetings,messages,researches}
chmod -R 755 $PROJECT_DIR/uploads

# Kurulum özeti
echo ""
log_info "=========================================="
log_info "Kurulum Tamamlandı!"
log_info "=========================================="
echo ""
log_info "Proje dizini: $PROJECT_DIR"
log_info "Veritabanı: $DB_NAME"
log_info "Kullanıcı: $APP_USER"
log_info "Port: $APP_PORT"
echo ""
log_info "Uygulama durumu kontrol etmek için:"
log_info "  sudo -u $APP_USER pm2 status"
echo ""
log_info "Uygulama loglarını görmek için:"
log_info "  sudo -u $APP_USER pm2 logs lpbh-fop"
echo ""
log_info "Uygulamayı yeniden başlatmak için:"
log_info "  sudo -u $APP_USER pm2 restart lpbh-fop"
echo ""

if [ -n "$DOMAIN" ]; then
    log_info "Web sitesi: http://${DOMAIN}"
else
    log_info "Web sitesi: http://localhost:${APP_PORT}"
fi

echo ""
log_info "İlk kullanıcı bilgileri:"
log_info "  Kullanıcı adı: ata"
log_info "  Şifre: ata"
echo ""
log_warn "ÖNEMLİ: İlk girişten sonra şifreyi değiştirin!"
echo ""
log_info "Kurulum tamamlandı. İyi çalışmalar!"

