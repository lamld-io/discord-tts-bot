# 📋 Báo Cáo Kỹ Thuật: Discord TTS Bot

> **Phiên bản:** 1.0.0  
> **Ngày phân tích:** 2026-03-24  
> **License:** MIT

---

## 1. Mô Tả Kỹ Thuật

### 1.1 Tổng Quan

Discord TTS Bot là ứng dụng chuyển đổi văn bản thành giọng nói (Text-to-Speech) cho Discord. Bot hỗ trợ đa nhà cung cấp TTS, tự động đọc tin nhắn, hệ thống phân quyền linh hoạt, và web dashboard quản lý.

### 1.2 Tech Stack

| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| **Runtime** | Node.js | ≥ 22.0.0 |
| **Ngôn ngữ** | TypeScript | 5.9.x |
| **Discord SDK** | discord.js | 14.25.x |
| **Voice** | @discordjs/voice + @discordjs/opus | 0.19.x |
| **E2EE** | @snazzah/davey (DAVE protocol) | 0.1.x |
| **Database** | SQLite (better-sqlite3) | 12.8.x |
| **Web Server** | Express | 5.2.x |
| **Frontend** | React + Vite + TypeScript | — |
| **Auth** | Discord OAuth2 + JWT | — |
| **TTS Miễn phí** | gTTS, Edge TTS (Microsoft Neural) | — |
| **TTS Trả phí** | ElevenLabs, Google Cloud TTS, OpenAI | — |
| **Container** | Docker (multi-stage build) | — |
| **Module System** | ESM (`"type": "module"`) | — |

### 1.3 Kiến Trúc Tổng Quan

```
discord-tts-bot/
├── src/                    # Backend source code
│   ├── index.ts            # Entry point - khởi tạo app
│   ├── bot/                # Discord bot module
│   │   ├── client.ts       # Bot class chính
│   │   ├── auto-reader.ts  # Tự động đọc tin nhắn
│   │   ├── permissions.ts  # Hệ thống phân quyền
│   │   └── commands/       # Slash commands (7 files)
│   │       ├── tts.ts          # /tts - Đọc văn bản
│   │       ├── voice-channel.ts# /join, /leave
│   │       ├── voice.ts        # /voice - Cấu hình giọng đọc
│   │       ├── config.ts       # /config - Cấu hình server
│   │       ├── setup.ts        # /setup - Phân quyền
│   │       ├── autotts.ts      # /autotts - Auto-read
│   │       └── bot-admin.ts    # /bot - Bảo trì
│   ├── tts/                # Text-to-Speech engine
│   │   ├── manager.ts      # TTSManager - orchestrator
│   │   ├── provider.ts     # Interface chung
│   │   ├── cache.ts        # LRU audio cache
│   │   └── providers/      # 5 TTS providers
│   │       ├── gtts.ts         # Google TTS (miễn phí)
│   │       ├── edge-tts.ts     # Edge TTS (Microsoft Neural)
│   │       ├── elevenlabs.ts   # ElevenLabs (cao cấp)
│   │       ├── google-cloud.ts # Google Cloud TTS
│   │       └── openai.ts       # OpenAI TTS
│   ├── voice/              # Voice connection & playback
│   │   ├── connection.ts   # VoiceConnectionManager
│   │   └── player.ts       # VoicePlayer (queue system)
│   ├── database/           # SQLite data layer
│   │   └── index.ts        # Schema + CRUD operations
│   ├── web/                # Web Dashboard API
│   │   ├── server.ts       # Express server setup
│   │   ├── middleware.ts   # Auth, CORS, Rate Limit
│   │   └── routes/         # API routes
│   │       ├── auth.ts         # Discord OAuth2 login
│   │       ├── guilds.ts       # Guild settings CRUD
│   │       └── bot-status.ts   # Bot status endpoint
│   ├── config/
│   │   └── env.ts          # Environment variables
│   └── utils/
│       ├── logger.ts       # Custom logger (4 levels)
│       └── text-processor.ts # Text sanitize/chunk/validate
├── web/                    # Frontend (React + Vite)
│   ├── src/                # React components
│   ├── index.html          # HTML entry
│   ├── vite.config.ts      # Vite config
│   └── package.json        # Frontend dependencies
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker Compose config
├── package.json            # Backend dependencies
├── tsconfig.json           # TypeScript config
├── .env.example            # Env template
└── bot.db                  # SQLite database file
```

### 1.4 Modules & Components Chi Tiết

#### 🤖 Bot Module (`src/bot/`)

**`client.ts` — Bot Class**
- Class `Bot` là trung tâm điều khiển, quản lý `TTSManager`, `VoiceConnectionManager`, và `VoicePlayer`
- Đăng ký 8 slash commands lên Discord API qua REST
- Xử lý interaction events, kiểm tra quyền trước khi thực thi
- Gateway intents: `Guilds`, `GuildVoiceStates`, `GuildMessages`, `MessageContent`

**`auto-reader.ts` — Auto-Read Module**
- Lắng nghe event `MessageCreate`, tự động đọc tin nhắn text
- Chỉ đọc tin nhắn từ user đang ở **cùng voice channel** với bot
- Rate limiting: 1 tin nhắn / 2 giây / guild
- Bộ lọc: bỏ qua bot messages, tin nhắn có prefix bỏ qua, chỉ emoji, attachment
- Prepend tên user: `"User nói: [nội dung]"`

**`permissions.ts` — Permission System**
- 3 cấp quyền: `everyone` → `dj` → `admin`
- 3 chế độ phân quyền cho lệnh DJ:
  - **Open**: Ai cũng dùng được
  - **Role**: Chỉ user có DJ role
  - **Allowlist**: Chỉ user/role trong allowlist
- Admin Discord luôn bypass quyền

#### 🎤 TTS Module (`src/tts/`)

**`provider.ts` — TTSProvider Interface**
```typescript
interface TTSProvider {
  info: TTSProviderInfo;
  isAvailable(): boolean;
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;
  getVoices(language?: string): Promise<VoiceInfo[]>;
}
```
- `TTSOptions`: `language`, `speed` (0.5-2.0), `voiceId`
- `TTSResult`: `audio` (Buffer), `format` (mp3/opus/ogg/pcm/wav), `latencyMs`

**`manager.ts` — TTSManager (Orchestrator)**
- Đăng ký 5 providers, kiểm tra availability
- **Fallback chain**: ElevenLabs → Google Cloud → OpenAI → Edge TTS → gTTS
- Tích hợp `AudioCache` cho caching kết quả

**`cache.ts` — AudioCache (LRU)**
- In-memory LRU cache với SHA-256 key
- Cấu hình: `CACHE_MAX_SIZE_MB` (mặc định 100MB), `CACHE_TTL_MINUTES` (mặc định 60 phút)
- Tự động cleanup entries hết hạn mỗi 5 phút
- Eviction: xóa entry cũ nhất khi cache đầy

**5 TTS Providers:**

| Provider | API Key? | Chất lượng | Ngôn ngữ | Ghi chú |
|---|---|---|---|---|
| **gTTS** | Không | Trung bình | Nhiều | Google Translate TTS |
| **Edge TTS** | Không | Cao | 9+ | Microsoft Neural Voices |
| **ElevenLabs** | Có | Rất cao | Nhiều | Giọng tự nhiên nhất |
| **Google Cloud** | Có | Cao | Nhiều | WaveNet/Neural2 |
| **OpenAI** | Có | Cao | Nhiều | Alloy, Echo, Fable... |

#### 🔊 Voice Module (`src/voice/`)

**`connection.ts` — VoiceConnectionManager**
- Quản lý kết nối voice channel per-guild
- Hỗ trợ **DAVE E2EE** (Discord Audio/Video Encryption) qua `@snazzah/davey`
- Auto-reconnect khi bị disconnect (timeout 5s)
- Join/Leave/Get/IsConnected operations

**`player.ts` — VoicePlayer (Queue System)**
- Hàng đợi (queue) audio per-guild
- Promise-based: `enqueue()` trả về Promise resolve khi phát xong
- Tự động xử lý item tiếp theo khi phát xong (event-driven)
- Operations: `skip()`, `clearQueue()`, `cleanup()`

#### 💾 Database Module (`src/database/`)

**SQLite + WAL mode** với 3 bảng:

```sql
-- Cấu hình cá nhân từng user
user_settings (
  user_id TEXT PRIMARY KEY,
  guild_id TEXT,
  provider TEXT,         -- TTS provider override
  voice_id TEXT,         -- Voice ID override
  language TEXT,         -- Ngôn ngữ override
  speed REAL DEFAULT 1.0
)

-- Cấu hình server
guild_settings (
  guild_id TEXT PRIMARY KEY,
  default_provider TEXT DEFAULT 'gtts',
  default_language TEXT DEFAULT 'vi',
  text_limit INTEGER DEFAULT 500,
  permission_mode TEXT DEFAULT 'open',  -- open|role|allowlist
  dj_role_id TEXT,
  auto_read_enabled INTEGER DEFAULT 0,
  auto_read_channel_id TEXT,
  auto_read_ignore_prefix TEXT DEFAULT '!,/'
)

-- Danh sách phép (allowlist)
guild_allowlist (
  guild_id TEXT,
  target_id TEXT,
  target_type TEXT  -- 'user' | 'role'
)
```

- User settings fallback (merge) với guild defaults khi giá trị NULL
- Migration tự động khi schema thay đổi (ALTER TABLE)
- UPSERT pattern cho cả user và guild settings

#### 🌐 Web Module (`src/web/`)

**`server.ts` — Express Server**
- Health check: `GET /api/health` (dùng cho Docker healthcheck)
- API routes: `/api/auth`, `/api/guilds`, `/api/bot`
- Static file serving cho frontend React build
- SPA fallback: catch-all trả về `index.html`

**`middleware.ts` — Security Stack**
- **Rate Limiting**: 100 req/phút (general), 10 req/phút (auth)
- **CORS**: Chỉ cho phép `WEB_FRONTEND_URL`
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- **JWT Auth**: Cookie-based + Bearer token, verify + decode
- **Guild Admin Check**: Kiểm tra quyền Administrator/ManageGuild, bot owner bypass

**Web Routes:**
- `auth.ts`: Discord OAuth2 login/callback, JWT token generation
- `guilds.ts`: Guild settings CRUD (require auth + guild admin)
- `bot-status.ts`: Bot status info (uptime, cache, connections)

#### 🛠️ Utilities (`src/utils/`)

**`logger.ts`**: Custom console logger với 4 levels (debug/info/warn/error), color-coded output, timestamp prefix

**`text-processor.ts`**:
- `sanitizeText()`: Loại bỏ Discord mentions, emoji, markdown, URLs, code blocks, spoiler tags
- `chunkText()`: Chia text dài tại ranh giới câu (ưu tiên: dấu chấm → dấu hỏi → dấu phẩy → khoảng trắng)
- `validateText()`: Kiểm tra độ dài, nội dung trống sau sanitize

### 1.5 Slash Commands

| Lệnh | Quyền | Mô tả |
|---|---|---|
| `/tts <text>` | DJ | Chuyển văn bản thành giọng nói và phát |
| `/join` | DJ | Bot tham gia voice channel |
| `/leave` | DJ | Bot rời voice channel |
| `/voice provider\|list\|set\|speed\|language\|info` | Everyone | Cấu hình giọng đọc cá nhân |
| `/config limit\|provider\|language\|info` | Admin | Cấu hình server |
| `/setup mode\|dj-role\|allow\|deny\|list` | Admin | Phân quyền sử dụng bot |
| `/autotts on\|off\|channel\|ignore-prefix\|status` | Admin | Quản lý auto-read |
| `/bot status\|cache\|reconnect\|leave-all` | Admin | Bảo trì bot |

---

## 2. Luồng Dữ Liệu (Data Flow)

### 2.1 Luồng TTS Command (`/tts`)

```
┌──────────────┐
│  User gõ     │
│  /tts "xin   │
│   chào"      │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│              Discord Gateway (InteractionCreate)          │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────┐    Không     ┌──────────────────────┐
│  Permission      │──────────────►│  Reply: "🔒 Từ chối" │
│  Check           │              └──────────────────────┘
└──────┬───────────┘
       │ OK
       ▼
┌──────────────────┐    Không     ┌──────────────────────┐
│  User ở voice    │──────────────►│  Reply: "❌ Cần vào  │
│  channel?        │              │  voice channel"      │
└──────┬───────────┘              └──────────────────────┘
       │ Có
       ▼
┌──────────────────┐
│  sanitizeText()  │─── Loại bỏ mentions, emoji, markdown
│  validateText()  │─── Kiểm tra độ dài, nội dung
│  chunkText()     │─── Chia thành các đoạn ≤500 ký tự
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Lấy User &     │◄── SQLite: user_settings + guild_settings
│  Guild Settings  │    (merge: user override → guild default)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐    Cache Hit  ┌─────────────────────┐
│  AudioCache      │───────────────►│  Return cached      │
│  .get(key)       │               │  Buffer (0ms)       │
└──────┬───────────┘               └──────────┬──────────┘
       │ Cache Miss                            │
       ▼                                       │
┌──────────────────┐                           │
│  TTSManager      │                           │
│  .synthesize()   │                           │
│                  │                           │
│  Provider chọn   │                           │
│  ↓ fallback      │                           │
│  ElevenLabs →    │                           │
│  Google Cloud →  │                           │
│  OpenAI →        │                           │
│  Edge TTS →      │                           │
│  gTTS            │                           │
└──────┬───────────┘                           │
       │ audio Buffer                          │
       │                                       │
       │  ┌─────────────────┐                  │
       ├──►│ Cache .set(key) │                  │
       │  └─────────────────┘                  │
       │                                       │
       ▼◄──────────────────────────────────────┘
┌──────────────────┐
│  VoiceConnection │◄── Join voice channel (nếu chưa)
│  Manager         │    DAVE E2EE handshake
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  VoicePlayer     │
│  .enqueue()      │─── Thêm vào queue
│                  │
│  Queue: [A][B].. │─── Phát tuần tự
│                  │
│  AudioPlayer     │─── createAudioResource()
│  .play()         │─── Stream → Discord Voice
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Discord Voice   │──► User nghe trong voice channel
│  Channel         │
└──────────────────┘
```

### 2.2 Luồng Auto-Read

```
┌──────────────┐
│  User gửi    │
│  tin nhắn    │
│  trong text  │
│  channel     │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────────────────────┐
│            MessageCreate Event                  │
└──────┬─────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Bộ lọc (filter pipeline):              │
│  1. Bỏ qua bot messages                 │
│  2. Bỏ qua DM                           │
│  3. Kiểm tra auto_read_enabled          │
│  4. Kiểm tra channel (nếu cấu hình)    │
│  5. Bot đang ở voice channel?           │
│  6. User cùng voice channel với bot?    │
│  7. Bỏ qua prefix (!,/ ...)            │
│  8. Bỏ qua chỉ emoji                   │
│  9. Rate limit (2s/guild)               │
└──────┬───────────────────────────────────┘
       │ Passed
       ▼
┌──────────────────┐
│  sanitizeText()  │
│  Prepend tên:    │
│  "User nói: ..." │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  TTSManager      │──► (Giống luồng TTS ở trên)
│  .synthesize()   │
│  VoicePlayer     │
│  .enqueue()      │
└──────────────────┘
```

### 2.3 Luồng Web Dashboard Auth

```
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│  Browser │────►│ GET /api/auth │────►│ Redirect Discord │
│          │     │   /login      │     │ OAuth2 URL       │
└──────────┘     └───────────────┘     └────────┬─────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │ User đăng nhập   │
                                       │ Discord          │
                                       └────────┬─────────┘
                                                │ callback
                                                ▼
┌──────────┐     ┌───────────────┐     ┌──────────────────┐
│  Browser │◄────│ Set JWT       │◄────│ GET /api/auth    │
│  (cookie)│     │ Cookie        │     │  /callback       │
└────┬─────┘     └───────────────┘     │ Exchange code →  │
     │                                  │ access token     │
     │                                  └──────────────────┘
     ▼
┌──────────────────────┐
│ API calls với JWT    │
│ Cookie/Bearer token  │
│                      │
│ GET /api/guilds      │──► Danh sách guilds user quản lý
│ PATCH /api/guilds/:id│──► Cập nhật guild settings
│ GET /api/bot/status  │──► Thông tin bot
└──────────────────────┘
```

---

## 3. Hướng Dẫn Sử Dụng

### 3.1 Yêu Cầu Hệ Thống

- **Node.js** ≥ 22.0.0
- **npm** (đi kèm Node.js)
- **ffmpeg** (cho xử lý audio — cần cài riêng nếu chạy local)
- **Python 3 + build tools** (cho native modules: better-sqlite3, sodium-native, @discordjs/opus)

### 3.2 Cài Đặt & Cấu Hình

#### Bước 1: Clone & Install

```bash
git clone <repo-url>
cd discord-tts-bot
npm install
```

#### Bước 2: Cấu hình biến môi trường

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
# [BẮT BUỘC] Discord Bot
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# [TÙY CHỌN] API Keys cho TTS providers trả phí
ELEVENLABS_API_KEY=your_elevenlabs_api_key
GOOGLE_CLOUD_TTS_KEY=your_google_cloud_api_key
OPENAI_API_KEY=your_openai_api_key

# [TÙY CHỌN] TTS mặc định
DEFAULT_TTS_PROVIDER=gtts     # gtts | edge | elevenlabs | google | openai
DEFAULT_LANGUAGE=vi            # vi | en | ja | ko | zh
DEFAULT_TEXT_LIMIT=500         # Giới hạn ký tự / lần

# [TÙY CHỌN] Cache
CACHE_MAX_SIZE_MB=100
CACHE_TTL_MINUTES=60

# [TÙY CHỌN] Logging
LOG_LEVEL=info                 # debug | info | warn | error

# [TÙY CHỌN] Web Dashboard
WEB_ENABLED=true
WEB_PORT=3000
WEB_FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_random_secret_here
DISCORD_OAUTH_CLIENT_SECRET=your_oauth_client_secret
DISCORD_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
BOT_OWNER_ID=your_discord_user_id
```

> **Lưu ý:** Tối thiểu chỉ cần `DISCORD_TOKEN` và `DISCORD_CLIENT_ID`. Bot sẽ sử dụng gTTS/Edge TTS (miễn phí, không cần API key).

### 3.3 Chạy Project

#### Development (có hot-reload)

```bash
npm run dev
```

Sử dụng `tsx watch` để tự động restart khi thay đổi code.

#### Production

```bash
npm run build    # Compile TypeScript → dist/
npm run start    # Chạy node dist/index.js
```

#### Docker (Khuyến nghị cho Production)

```bash
# Build và chạy
docker compose up -d --build

# Xem logs
docker compose logs -f

# Dừng
docker compose down
```

**Docker Compose** cấu hình sẵn:
- Port mapping: `3000:3000` (Web Dashboard)
- Volume: `./data:/app/data` (SQLite database persistent)
- Memory limit: 512MB (reservation 128MB)
- Healthcheck: `GET /api/health` mỗi 30 giây
- Logging: JSON file, max 10MB × 3 files
- Non-root user (`node`)
- Auto-restart: `unless-stopped`

### 3.4 Discord Bot Setup

1. Tạo application tại [Discord Developer Portal](https://discord.com/developers/applications)
2. Tạo Bot, lấy `DISCORD_TOKEN`
3. Lấy `DISCORD_CLIENT_ID` từ trang General Information
4. Bật các **Privileged Gateway Intents**:
   - `MESSAGE CONTENT INTENT` (cho auto-read)
   - `SERVER MEMBERS INTENT`
5. Mời bot vào server bằng OAuth2 URL với scopes `bot` + `applications.commands` và permissions:
   - Connect, Speak (voice)
   - Send Messages, Read Message History (text)

### 3.5 Commands Chi Tiết

#### `/tts <text>` — Đọc văn bản
```
/tts text:Xin chào mọi người
```
- Bot tự động join voice channel của bạn (nếu chưa)
- Sử dụng provider và giọng đọc cá nhân của bạn

#### `/join` / `/leave` — Quản lý voice
```
/join        # Bot join voice channel của bạn
/leave       # Bot rời voice channel
```

#### `/voice` — Cấu hình giọng đọc cá nhân
```
/voice provider name:edge       # Chọn TTS provider
/voice list                     # Xem giọng đọc có sẵn
/voice set voice_id:vi-VN-HoaiMyNeural  # Đặt giọng cụ thể
/voice speed value:1.5          # Tốc độ đọc (0.5-2.0)
/voice language lang:en         # Đặt ngôn ngữ
/voice info                     # Xem cấu hình hiện tại
```

#### `/config` — Cấu hình server (Admin)
```
/config limit chars:1000        # Giới hạn ký tự
/config provider name:edge      # Provider mặc định
/config language lang:vi        # Ngôn ngữ mặc định
/config info                    # Xem cấu hình server
```

#### `/setup` — Phân quyền (Admin)
```
/setup mode type:open           # Ai cũng dùng được
/setup mode type:role           # Chỉ DJ role
/setup mode type:allowlist      # Chỉ allowlist
/setup dj-role role:@DJ         # Đặt DJ role
/setup allow user:@someone      # Thêm vào allowlist
/setup deny user:@someone       # Xóa khỏi allowlist
/setup list                     # Xem phân quyền
```

#### `/autotts` — Auto-Read (Admin)
```
/autotts on                     # Bật auto-read
/autotts off                    # Tắt auto-read
/autotts channel text_channel:#general  # Đọc từ kênh cụ thể
/autotts ignore-prefix prefixes:!,/,?   # Prefix bỏ qua
/autotts status                 # Xem trạng thái
```

#### `/bot` — Bảo trì (Admin)
```
/bot status                     # Uptime, RAM, cache, connections
/bot cache action:stats         # Thống kê cache
/bot cache action:clear         # Xóa cache
/bot reconnect                  # Reconnect voice channel
/bot leave-all                  # Rời tất cả voice channels
```

### 3.6 API Endpoints (Web Dashboard)

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check |
| `GET` | `/api/auth/login` | — | Redirect Discord OAuth2 |
| `GET` | `/api/auth/callback` | — | OAuth2 callback → JWT |
| `GET` | `/api/auth/me` | JWT | Thông tin user hiện tại |
| `POST` | `/api/auth/logout` | JWT | Đăng xuất (xóa cookie) |
| `GET` | `/api/guilds` | JWT | Danh sách guilds quản lý |
| `GET` | `/api/guilds/:id` | JWT + Admin | Chi tiết guild settings |
| `PATCH` | `/api/guilds/:id` | JWT + Admin | Cập nhật guild settings |
| `GET` | `/api/bot/status` | JWT | Trạng thái bot |

### 3.7 Ngôn Ngữ Hỗ Trợ

| Mã | Ngôn ngữ | Providers |
|---|---|---|
| `vi` | Tiếng Việt | gTTS, Edge TTS, ElevenLabs, Google Cloud, OpenAI |
| `en` | English | Tất cả |
| `ja` | 日本語 | gTTS, Edge TTS, Google Cloud |
| `ko` | 한국어 | gTTS, Edge TTS, Google Cloud |
| `zh` | 中文 | gTTS, Edge TTS, Google Cloud |
| `fr` | Français | Edge TTS |
| `de` | Deutsch | Edge TTS |
| `es` | Español | Edge TTS |
| `th` | ภาษาไทย | Edge TTS |

---

## 4. Ghi Chú Kỹ Thuật

### Bảo mật
- JWT token lưu trong HttpOnly cookie
- Security headers đầy đủ (CSP, X-Frame-Options, etc.)
- Rate limiting trên tất cả API endpoints
- CORS whitelist chỉ frontend URL
- Non-root Docker container
- Guild admin check cho mọi thao tác guild settings

### Hiệu suất
- SQLite WAL mode cho concurrent reads
- LRU audio cache giảm API calls
- Text chunking tránh timeout TTS requests
- Queue system tránh audio overlap
- Docker multi-stage build giảm image size

### DAVE E2EE
- `@snazzah/davey` patch cho `@discordjs/voice` hỗ trợ Discord Audio/Video End-to-End Encryption
- Bắt buộc từ Discord 2026 cho voice connections
