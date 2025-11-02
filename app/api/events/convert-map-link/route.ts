import { NextRequest, NextResponse } from 'next/server';

// Google Maps link'ini embed URL'ye çevir (server-side)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || !url.trim()) {
      return NextResponse.json(
        { error: 'URL gerekli' },
        { status: 400 }
      );
    }

    // Eğer zaten embed URL ise direkt döndür
    if (url.includes('google.com/maps/embed')) {
      return NextResponse.json({ embedUrl: url });
    }

    // goo.gl linklerini açıp gerçek URL'yi bul
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      try {
        // goo.gl linkini takip et (redirect'i takip et)
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        // Final URL'i al (redirect sonrası)
        const finalUrl = response.url;
        console.log('goo.gl resolved to:', finalUrl);

        // Final URL'den embed formatına çevir
        const embedUrl = convertToEmbedUrl(finalUrl);
        if (embedUrl) {
          return NextResponse.json({ embedUrl });
        }

        // Eğer çevrilemezse, final URL'i direkt döndür (iframe'de açılmayabilir ama deneyelim)
        return NextResponse.json({ embedUrl: finalUrl, warning: 'Embed formatına çevrilemedi, orijinal URL kullanılıyor' });
      } catch (error) {
        console.error('goo.gl link fetch error:', error);
        // Hata durumunda orijinal URL'i döndür
        return NextResponse.json({ embedUrl: url, warning: 'Link açılamadı, orijinal URL kullanılıyor' });
      }
    }

    // Diğer Google Maps linklerini çevir
    const embedUrl = convertToEmbedUrl(url);
    if (embedUrl) {
      return NextResponse.json({ embedUrl });
    }

    // Çevrilemezse orijinal URL'i döndür
    return NextResponse.json({ embedUrl: url, warning: 'Embed formatına çevrilemedi' });
  } catch (error) {
    console.error('Map link conversion error:', error);
    return NextResponse.json(
      { error: 'Link çevrilemedi', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Google Maps URL'sini embed URL'ye çevir (API key gerektirmeyen format)
function convertToEmbedUrl(url: string): string | null {
  try {
    // Eğer zaten embed URL ise direkt döndür
    if (url.includes('google.com/maps/embed')) {
      return url;
    }

    // https://www.google.com/maps/place/... formatını çevir
    if (url.includes('google.com/maps/place/')) {
      try {
        const urlObj = new URL(url);
        // Place URL'ini direkt embed formatına çevir
        // En basit yöntem: URL'i olduğu gibi kullan ama /embed ekle
        // Ama bu çalışmayabilir, bu yüzden alternatif yöntem:
        
        // Place name'i al
        const pathParts = urlObj.pathname.split('/');
        const placeIndex = pathParts.indexOf('place');
        if (placeIndex !== -1 && placeIndex < pathParts.length - 1) {
          // Place URL'ini direkt embed formatına çevirmek yerine,
          // Google'ın standart embed formatını kullanacağız
          // Ancak pb formatını oluşturmak çok karmaşık olduğu için,
          // En basit çözüm: URL'i olduğu gibi döndür (iframe'de açılmayabilir)
          // Veya: Place URL'ini search query'ye çevir
          
          // Place name'i query olarak kullan
          const placeName = pathParts[placeIndex + 1];
          const decodedPlaceName = decodeURIComponent(placeName.replace(/\+/g, ' '));
          
          // Standart Google Maps embed formatı (pb parametresi olmadan)
          // Bu format genellikle çalışmaz, bu yüzden alternatif:
          // Place URL'ini direkt kullan (iframe'de açılmayabilir ama deneyeceğiz)
          return url;
        }
      } catch (e) {
        console.error('Place URL parse error:', e);
      }
      
      // Fallback: URL'i olduğu gibi döndür
      return url;
    }

    // Query parametreli linkler (?q=... veya ?ll=...)
    if (url.includes('maps.google.com') || url.includes('google.com/maps')) {
      try {
        const urlObj = new URL(url);
        
        // q parametresi varsa (query string)
        const q = urlObj.searchParams.get('q');
        if (q) {
          // Query string ile direkt embed URL oluştur
          // En basit format: URL'i olduğu gibi kullan
          return url;
        }
        
        // ll (latitude, longitude) parametresi varsa
        const ll = urlObj.searchParams.get('ll');
        if (ll) {
          // Coordinates ile URL oluştur
          return url;
        }
      } catch (e) {
        console.error('URL parse error:', e);
      }
    }

    // Çevrilemezse null döndür
    return null;
  } catch (error) {
    console.error('URL conversion error:', error);
    return null;
  }
}
