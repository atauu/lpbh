// Mevcut Chrome tarayıcısına bağlanıp network trafiğini loglayan script
const puppeteer = require('puppeteer-core');

async function connectToExistingBrowser() {
  console.log('🔌 Mevcut Chrome tarayıcısına bağlanılıyor...\n');
  
  // Chrome'u remote debugging port ile başlatmanız gerekiyor
  // Windows'ta Chrome'u şu komutla başlatın:
  // "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug"
  
  try {
    // Remote debugging port'a bağlan
    const browser = await puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null,
    });
    
    console.log('✅ Chrome tarayıcısına bağlandı!\n');
    
    // Tüm sayfaları al
    const pages = await browser.pages();
    console.log(`📄 Açık sayfa sayısı: ${pages.length}\n`);
    
    // Her sayfaya network listener ekle
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageUrl = page.url();
      console.log(`📝 Sayfa ${i + 1} dinleniyor: ${pageUrl}`);
      
      setupNetworkLogging(page, i + 1);
    }
    
    // Yeni sayfalar açıldığında da dinle
    browser.on('targetcreated', async (target) => {
      const page = await target.page();
      if (page) {
        console.log(`\n📝 Yeni sayfa açıldı: ${page.url()}`);
        setupNetworkLogging(page, 'NEW');
      }
    });
    
    console.log('\n✅ Network logging aktif!');
    console.log('📝 Şimdi tarayıcınızda:');
    console.log('   1. https://pyrocheck.xrent.store adresine gidin');
    console.log('   2. Cloudflare challenge\'ı geçin');
    console.log('   3. Login yapın');
    console.log('   4. İkametgah sorgu yapın');
    console.log('\n💡 Tüm network trafiği burada loglanacak!\n');
    
    // Bağlantıyı açık tut
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Bağlantı kapatılıyor...');
      await browser.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Chrome tarayıcısına bağlanılamadı!');
    console.error('Hata:', error.message);
    console.error('\n📋 Chrome\'u remote debugging ile başlatmak için:');
    console.error('   1. Tüm Chrome pencerelerini kapatın');
    console.error('   2. PowerShell\'de şu komutu çalıştırın:');
    console.error('      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\temp\\chrome-debug"');
    console.error('   3. Chrome açıldıktan sonra bu script\'i tekrar çalıştırın\n');
    process.exit(1);
  }
}

function setupNetworkLogging(page, pageNum) {
  // Cookie'leri al ve göster
  page.on('load', async () => {
    try {
      const cookies = await page.cookies();
      if (cookies.length > 0) {
        console.log(`\n🍪 [Sayfa ${pageNum}] COOKIE'LER:`);
        console.log('═══════════════════════════════════════════════════════════');
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        console.log(cookieString);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n💡 Bu cookie string\'ini kopyalayıp .env dosyasına ekleyebilirsiniz:');
        console.log(`   PYROCHECK_COOKIES="${cookieString}"`);
        console.log('\n');
      }
    } catch (e) {
      // Cookie alınamadı, devam et
    }
  });
  
  // Network trafiğini logla
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    
    // Sadece önemli istekleri logla (API, query, vb.)
    if (url.includes('pyrocheck.xrent.store') || 
        url.includes('/api/') || 
        url.includes('/query/') ||
        method === 'POST') {
      console.log(`\n🌐 [Sayfa ${pageNum}] [${method}] ${url}`);
      
      // Önemli header'ları göster
      if (headers['content-type']) {
        console.log(`   Content-Type: ${headers['content-type']}`);
      }
      if (headers['authorization']) {
        console.log(`   Authorization: ${headers['authorization'].substring(0, 50)}...`);
      }
      if (headers['cookie']) {
        const cookies = headers['cookie'];
        console.log(`\n🍪 [Sayfa ${pageNum}] REQUEST COOKIE'LER:`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log(cookies);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n💡 Bu cookie string\'ini kopyalayıp .env dosyasına ekleyebilirsiniz:');
        console.log(`   PYROCHECK_COOKIES="${cookies}"`);
        console.log('\n');
      }
      
      // POST isteklerinde body'yi göster
      if (method === 'POST' && request.postData()) {
        try {
          const postData = request.postData();
          console.log(`   📤 POST Data: ${postData.substring(0, 500)}`);
          // JSON ise parse et
          if (postData.startsWith('{') || postData.startsWith('[')) {
            try {
              const json = JSON.parse(postData);
              console.log(`   📤 POST JSON:`, JSON.stringify(json, null, 2));
            } catch (e) {
              // JSON parse hatası, devam et
            }
          }
        } catch (e) {
          // Parse hatası, devam et
        }
      }
    }
  });
  
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();
    
    // Sadece önemli yanıtları logla
    if (url.includes('pyrocheck.xrent.store') || 
        url.includes('/api/') || 
        url.includes('/query/')) {
      console.log(`\n📥 [Sayfa ${pageNum}] [${status}] ${url}`);
      
      // Content-Type göster
      if (headers['content-type']) {
        console.log(`   Content-Type: ${headers['content-type']}`);
      }
      
      // JSON yanıtları göster
      try {
        const contentType = headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          const json = await response.json().catch(() => null);
          if (json) {
            console.log(`   📄 Response JSON:`, JSON.stringify(json, null, 2));
          }
        } else if (contentType.includes('text/html') && url.includes('/query/')) {
          // HTML yanıtlarını da göster (query sayfaları için)
          const text = await response.text().catch(() => null);
          if (text && text.length < 2000) {
            console.log(`   📄 Response HTML (ilk 1000 karakter):`, text.substring(0, 1000));
          }
        }
      } catch (e) {
        // Parse hatası, devam et
      }
    }
  });
}

connectToExistingBrowser().catch(console.error);

