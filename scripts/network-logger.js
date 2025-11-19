// Network trafiğini loglamak için tarayıcı açan script
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function startNetworkLogger() {
  console.log('🚀 Network Logger başlatılıyor...');
  console.log('📝 Tüm network trafiği loglanacak\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
    ],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  
  // Network trafiğini logla
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();
    
    // Tüm istekleri logla
    console.log(`\n🌐 [${method}] ${url}`);
    
    // Önemli header'ları göster
    if (headers['content-type']) {
      console.log(`   Content-Type: ${headers['content-type']}`);
    }
    if (headers['authorization']) {
      console.log(`   Authorization: ${headers['authorization'].substring(0, 50)}...`);
    }
    if (headers['cookie']) {
      console.log(`   Cookie: ${headers['cookie'].substring(0, 100)}...`);
    }
    
    // POST isteklerinde body'yi göster
    if (method === 'POST' && request.postData()) {
      try {
        const postData = request.postData();
        console.log(`   📤 POST Data: ${postData.substring(0, 500)}`);
        // JSON ise parse et
        if (postData.startsWith('{') || postData.startsWith('[')) {
          const json = JSON.parse(postData);
          console.log(`   📤 POST JSON:`, JSON.stringify(json, null, 2));
        }
      } catch (e) {
        // Parse hatası, devam et
      }
    }
  });
  
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const headers = response.headers();
    
    // Tüm yanıtları logla
    console.log(`\n📥 [${status}] ${url}`);
    
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
      } else if (contentType.includes('text/html')) {
        const text = await response.text().catch(() => null);
        if (text && text.length < 1000) {
          console.log(`   📄 Response HTML (ilk 500 karakter):`, text.substring(0, 500));
        }
      }
    } catch (e) {
      // Parse hatası, devam et
    }
  });
  
  // Sayfa yüklendiğinde bilgi ver
  page.on('load', () => {
    console.log(`\n✅ Sayfa yüklendi: ${page.url()}`);
  });
  
  // Ana sayfaya git
  console.log('\n🌐 PyroCheck ana sayfasına gidiliyor...');
  await page.goto('https://pyrocheck.xrent.store', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  
  console.log('\n✅ Tarayıcı hazır!');
  console.log('📝 Şimdi manuel olarak:');
  console.log('   1. Cloudflare challenge\'ı geçin (eğer görünüyorsa)');
  console.log('   2. Login sayfasına gidin: /query/signin');
  console.log('   3. Giriş yapın');
  console.log('   4. İkametgah sorgu sayfasına gidin');
  console.log('   5. Bir TCKN sorgulayın');
  console.log('\n💡 Tüm network trafiği burada loglanacak!');
  console.log('💡 Tarayıcıyı kapatmak için Ctrl+C basın\n');
  
  // Tarayıcıyı açık tut
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Tarayıcı kapatılıyor...');
    await browser.close();
    process.exit(0);
  });
}

startNetworkLogger().catch(console.error);




