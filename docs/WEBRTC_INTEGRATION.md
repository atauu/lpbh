# WebRTC Entegrasyonu - Gereksinimler ve Implementasyon Planı

## 1. Gerekli NPM Paketleri

### Backend için:
```bash
npm install socket.io
```

### Frontend için:
```bash
npm install socket.io-client simple-peer
```

## 2. STUN/TURN Sunucuları

### STUN Sunucuları (Ücretsiz)
- Google STUN: `stun:stun.l.google.com:19302`
- Stunserver.org: `stun:stunserver.org:3478`

### TURN Sunucuları (Production için gerekli)
- **Twilio** (Ücretli, önerilen)
- **Coturn** (Self-hosted, ücretsiz)
- **Metered.ca** (Ücretsiz tier mevcut)

## 3. Database Schema Değişiklikleri

Prisma schema'ya `Call` modeli eklenmeli:

```prisma
model Call {
  id            String   @id @default(cuid())
  callerId      String   @map("caller_id")
  receiverId    String   @map("receiver_id")
  groupId       String?  @map("group_id")
  type          String   // "audio" | "video"
  status        String   @default("pending") // "pending" | "active" | "ended" | "missed" | "rejected"
  startedAt     DateTime? @map("started_at")
  endedAt       DateTime? @map("ended_at")
  duration      Int?     // Saniye cinsinden
  caller        User     @relation("CallerCalls", fields: [callerId], references: [id])
  receiver      User     @relation("ReceiverCalls", fields: [receiverId], references: [id])
  group         RoleGroup? @relation(fields: [groupId], references: [id])
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("calls")
}
```

User model'ine ilişkiler eklenmeli:
```prisma
model User {
  // ... mevcut alanlar
  callerCalls      Call[] @relation("CallerCalls")
  receiverCalls    Call[] @relation("ReceiverCalls")
}
```

## 4. Backend API Endpoints

### Yeni API route'ları:
- `/api/calls/route.ts` - Call oluşturma ve listeleme
- `/api/calls/[id]/route.ts` - Call detayları ve güncelleme
- `/api/calls/[id]/accept/route.ts` - Call kabul etme
- `/api/calls/[id]/reject/route.ts` - Call reddetme
- `/api/calls/[id]/end/route.ts` - Call bitirme

### Socket.IO Server (Yeni dosya)
- `lib/socket-server.ts` - Socket.IO server kurulumu
- Signaling için Socket.IO events:
  - `call:initiate` - Yeni çağrı başlatma
  - `call:offer` - WebRTC offer gönderme
  - `call:answer` - WebRTC answer gönderme
  - `call:ice-candidate` - ICE candidate exchange
  - `call:reject` - Çağrı reddetme
  - `call:end` - Çağrı bitirme
  - `call:accept` - Çağrı kabul etme

## 5. Frontend Implementasyonu

### Yeni dosyalar:
- `hooks/useWebRTC.ts` - WebRTC logic hook
- `hooks/useSocket.ts` - Socket.IO connection hook
- `components/CallDialog.tsx` - Çağrı UI komponenti
- `components/VideoCall.tsx` - Video çağrı komponenti
- `components/AudioCall.tsx` - Sesli çağrı komponenti

### State Management:
- Call state (active call, incoming call, etc.)
- Media streams (local/remote video/audio)
- Connection state (connecting, connected, disconnected)

## 6. WebRTC API Kullanımı

### Gerekli API'ler:
- `navigator.mediaDevices.getUserMedia()` - Kamera/mikrofon erişimi
- `RTCPeerConnection` - Peer-to-peer bağlantı
- `RTCSessionDescription` - Offer/Answer exchange
- `RTCIceCandidate` - ICE candidate exchange

### İzinler:
- Camera permission
- Microphone permission
- HTTPS gereksinimi (production'da)

## 7. Implementasyon Adımları

### Adım 1: NPM Paketlerini Yükle
```bash
npm install socket.io socket.io-client simple-peer
npm install --save-dev @types/simple-peer
```

### Adım 2: Database Schema'yı Güncelle
- Prisma schema'ya Call modelini ekle
- Migration oluştur: `npx prisma db push`

### Adım 3: Socket.IO Server Kurulumu
- Next.js API route'unda Socket.IO server başlat
- Authentication middleware ekle
- Signaling events'leri handle et

### Adım 4: Backend API Endpoints
- Call CRUD operations
- Call status management
- Call history

### Adım 5: Frontend Hooks
- useWebRTC hook (RTCPeerConnection management)
- useSocket hook (Socket.IO connection)
- Media stream management

### Adım 6: UI Components
- Incoming call dialog
- Active call UI (video/audio)
- Call controls (mute, video toggle, end call)

### Adım 7: STUN/TURN Konfigürasyonu
- Environment variables (.env)
- RTCPeerConnection configuration

## 8. Environment Variables

`.env` dosyasına ekle:
```env
# STUN/TURN Servers
STUN_SERVER_URL=stun:stun.l.google.com:19302
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-password

# Socket.IO
SOCKET_IO_PATH=/api/socket
```

## 9. Güvenlik Önlemleri

1. **Authentication**: Tüm Socket.IO events için authentication kontrolü
2. **Authorization**: Kullanıcılar sadece kendi çağrılarını yönetebilmeli
3. **Rate Limiting**: Çağrı başlatma için rate limiting
4. **Input Validation**: Tüm input'ları validate et
5. **HTTPS**: Production'da HTTPS zorunlu (WebRTC için)

## 10. Test Senaryoları

1. ✅ One-to-one audio call
2. ✅ One-to-one video call
3. ✅ Group audio call
4. ✅ Group video call
5. ✅ Call rejection
6. ✅ Call missed
7. ✅ Call history
8. ✅ Reconnection handling
9. ✅ Network failure handling
10. ✅ Permission denial handling

## 11. Performance Optimizasyonları

1. **Codec Seçimi**: VP8/VP9 (video), Opus (audio)
2. **Bandwidth Management**: Adaptive bitrate
3. **ICE Candidate Filtering**: Gereksiz candidate'ları filtrele
4. **Connection Pooling**: TURN server connection pooling
5. **Media Stream Optimization**: Resolution/framerate ayarları

## 12. Monitoring ve Logging

1. **Call Metrics**: Başarılı/başarısız çağrı sayıları
2. **Connection Quality**: Packet loss, jitter, latency
3. **Error Tracking**: WebRTC hataları
4. **Performance Monitoring**: CPU/Memory kullanımı

## Kaynaklar

- [WebRTC Documentation](https://webrtc.org/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Simple Peer Documentation](https://github.com/feross/simple-peer)
- [Next.js Socket.IO Example](https://github.com/vercel/next.js/tree/canary/examples/with-socket.io)



