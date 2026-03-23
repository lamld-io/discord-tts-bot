# 📋 Báo Cáo Kỹ Thuật: Discord TTS Bot

> Cập nhật: 2026-03-23

---

## 1. Tổng Quan Dự Án

**Discord TTS Bot** là bot Discord chuyển đổi văn bản thành giọng nói (Text-to-Speech), hỗ trợ **5 TTS providers**, hệ thống phân quyền linh hoạt, tự động đọc tin nhắn, và **Web Dashboard** quản lý qua giao diện web.

| Thuộc tính | Chi tiết |
|---|---|
| **Ngôn ngữ** | TypeScript (ES2022, ESM modules) |
| **Runtime** | Node.js ≥ 22 |
| **Backend** | discord.js v14 + Express 5 |
| **Frontend** | React 19 + Vite 8 + react-router-dom v7 |
| **Database** | SQLite (better-sqlite3, WAL mode) |
| **Auth** | Discord OAuth2 + JWT (httpOnly cookie) |
| **Deployment** | Docker multi-stage (node:22-slim) |

---

## 2. Kiến Trúc Hệ Thống

Dự án có kiến trúc **modular layered**, gồm 2 phần chính: **Backend** (Bot + API Server) và **Frontend** (React SPA).

### 2.1. Cấu trúc thư mục

```
audio-bot/
├── src/                          # Backend (TypeScript)
│   ├── index.ts                  # Entry point
│   ├── config/
│   │   └── env.ts                # Biến môi trường (Discord, TTS, Web, JWT)
│   ├── database/
│   │   └── index.ts              # SQLite (3 bảng, auto-migration)
│   ├── bot/
│   │   ├── client.ts             # Discord Client + command router
│   │   ├── permissions.ts        # Permission middleware (3 cấp)
│   │   ├── auto-reader.ts        # Tự động đọc tin nhắn
│   │   └── commands/
│   │       ├── tts.ts            # /tts - Text-to-Speech
│   │       ├── voice.ts          # /voice - Cấu hình giọng đọc
│   │       ├── voice-channel.ts  # /join, /leave
│   │       ├── config.ts         # /config - Cấu hình server
│   │       ├── setup.ts          # /setup - Phân quyền
│   │       ├── bot-admin.ts      # /bot - Bảo trì
│   │       └── autotts.ts        # /autotts - Auto-read
│   ├── tts/
│   │   ├── provider.ts           # TTSProvider interface
│   │   ├── manager.ts            # Orchestrator + fallback
│   │   ├── cache.ts              # LRU Audio Cache (in-memory)
│   │   └── providers/
│   │       ├── edge-tts.ts       # Edge TTS (miễn phí)
│   │       ├── gtts.ts           # Google Translate TTS (miễn phí)
│   │       ├── elevenlabs.ts     # ElevenLabs (cần API key)
│   │       ├── google-cloud.ts   # Google Cloud TTS (cần API key)
│   │       └── openai.ts         # OpenAI TTS (cần API key)
│   ├── voice/
│   │   ├── connection.ts         # Voice Connection + DAVE E2EE
│   │   └── player.ts             # Audio Player (queue system)
│   ├── web/
│   │   ├── server.ts             # Express server + SPA serving
│   │   ├── middleware.ts         # Rate limit, CORS, JWT, security
│   │   └── routes/
│   │       ├── auth.ts           # Discord OAuth2 (login/callback/me/logout)
│   │       ├── guilds.ts         # Guild settings/allowlist/roles/channels
│   │       └── bot-status.ts     # Bot status API
│   └── utils/
│       ├── logger.ts             # Custom Logger (4 levels, ANSI colors)
│       └── text-processor.ts     # Sanitize, chunk, validate text
│
├── web/                          # Frontend (React SPA)
│   ├── src/
│   │   ├── main.tsx              # Entry point
│   │   ├── App.tsx               # AuthProvider, routing, layout
│   │   ├── index.css             # Global styles (dark theme)
│   │   ├── api/
│   │   │   └── client.ts         # API client (fetch wrapper)
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx     # Discord OAuth login
│   │   │   ├── DashboardPage.tsx # Server list
│   │   │   └── GuildPage.tsx     # Server settings (4 tabs)
│   │   └── types/
│   │       └── index.ts          # TypeScript interfaces
│   ├── vite.config.ts            # Vite + dev proxy
│   └── package.json              # React 19, Vite 8
│
├── Dockerfile                    # Multi-stage build (3 stages)
├── docker-compose.yml            # Production config
├── .dockerignore
├── .env.example
└── package.json                  # Backend dependencies
```

### 2.2. Sơ đồ kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                      Discord Server                              │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐          │
│  │ /tts     │  │ /voice        │  │ /config /setup   │          │
│  │ /join    │  │ /autotts      │  │ /bot             │          │
│  └────┬─────┘  └───────┬───────┘  └────────┬─────────┘          │
│       └────────────────┼────────────────────┘                    │
│                        ▼                                         │
│              ┌──────────────────┐                                │
│              │   Bot Client     │←─ Event Handler                │
│              │  (client.ts)     │←─ Command Router               │
│              └──┬──────┬─────┬─┘                                 │
│    ┌────────────┘      │     └────────────┐                      │
│    ▼                   ▼                  ▼                      │
│ ┌──────────┐   ┌──────────────┐   ┌───────────┐                 │
│ │Permission│   │ TTS Manager  │   │  Voice    │                 │
│ │Middleware│   │  + Cache     │   │ Manager   │                 │
│ └────┬─────┘   └──────┬───────┘   │ + Player  │                 │
│      ▼                ▼           └───────────┘                 │
│ ┌──────────┐   ┌──────────────┐                                 │
│ │ Database │   │TTS Providers │                                 │
│ │ (SQLite) │   │ edge/gtts/   │                                 │
│ │ 3 tables │   │ 11labs/gc/ai │                                 │
│ └─────┬────┘   └──────────────┘                                 │
│       │                                                          │
│       │    ┌─────────────────────────────────────────────┐       │
│       │    │           Web Dashboard (:3000)              │       │
│       │    │                                             │       │
│       │    │  Express Server ──┬─ /api/auth  (OAuth2)    │       │
│       ├────│  (server.ts)     ├─ /api/guilds (CRUD)     │       │
│       │    │                  └─ /api/bot    (Status)    │       │
│       │    │                                             │       │
│       │    │  React SPA ──────┬─ LoginPage               │       │
│       │    │  (web/dist)      ├─ DashboardPage           │       │
│       │    │                  └─ GuildPage (4 tabs)      │       │
│       │    └─────────────────────────────────────────────┘       │
└───────┼─────────────────────────────────────────────────────────┘
        ▼
   ┌──────────┐
   │ bot.db   │ ← SQLite WAL
   └──────────┘
```

---

## 3. Tech Stack

### Backend Dependencies

| Package | Version | Mục đích |
|---|---|---|
| `discord.js` | ^14.25.1 | Discord bot framework |
| `@discordjs/voice` | ^0.19.2 | Voice channel (join, play) |
| `@discordjs/opus` | ^0.10.0 | Mã hóa audio Opus |
| `sodium-native` | ^5.1.0 | Encryption cho voice |
| `@snazzah/davey` | ^0.1.10 | DAVE E2EE protocol (Discord 2026) |
| `better-sqlite3` | ^12.8.0 | SQLite database |
| `express` | ^5.2.1 | Web API server |
| `jsonwebtoken` | ^9.0.3 | JWT authentication |
| `cors` | ^2.8.6 | CORS middleware |
| `cookie-parser` | ^1.4.7 | Cookie parsing |
| `express-rate-limit` | ^8.3.1 | Rate limiting |
| `dotenv` | ^17.3.1 | Environment variables |
| `edge-tts-universal` | ^1.4.0 | Edge TTS (miễn phí) |
| `google-tts-api` | ^2.0.2 | Google Translate TTS (miễn phí) |

### Frontend Dependencies

| Package | Version | Mục đích |
|---|---|---|
| `react` | ^19.2.4 | UI framework |
| `react-dom` | ^19.2.4 | DOM rendering |
| `react-router-dom` | ^7.13.1 | Client-side routing |
| `vite` | ^8.0.1 | Build tool + dev server |
| `@vitejs/plugin-react` | ^6.0.1 | React HMR |

---

## 4. Modules Chi Tiết

### 4.1. Bot Module (`src/bot/`)

**`client.ts`** — Lớp `Bot`:
- Khởi tạo Discord Client với 4 intents: `Guilds`, `GuildVoiceStates`, `GuildMessages`, `MessageContent`
- 3 service: `TTSManager`, `VoiceConnectionManager`, `VoicePlayer`
- Command router: switch-case điều hướng 8 slash commands
- `registerCommands()`: Đăng ký commands lên Discord API qua REST

**`permissions.ts`** — Hệ thống phân quyền 3 cấp:

| Cấp | Commands | Mô tả |
|---|---|---|
| `everyone` | `/voice` | Ai cũng dùng được |
| `dj` | `/tts`, `/join`, `/leave` | Phụ thuộc `permission_mode` |
| `admin` | `/config`, `/setup`, `/bot`, `/autotts` | Chỉ Administrator |

3 chế độ phân quyền cho `dj`:
- **open**: Ai cũng dùng
- **role**: Chỉ user có DJ role
- **allowlist**: Chỉ user/role trong danh sách

> Admin Discord (Administrator hoặc Owner) luôn **bypass** mọi kiểm tra.

**`auto-reader.ts`** — Tự động đọc tin nhắn:
- Lắng nghe `MessageCreate`, bộ lọc: bỏ qua bot/DM/emoji/prefix
- Rate limit: 1 tin nhắn / 2 giây / guild
- Prepend tên user: `"displayName nói: nội dung"`
- Sử dụng cấu hình TTS cá nhân mỗi user

### 4.2. TTS Module (`src/tts/`)

**`provider.ts`** — Interface contract:
- `TTSProvider`: `synthesize()`, `getVoices()`, `isAvailable()`
- `TTSOptions`: language, speed, voiceId
- `TTSResult`: audio Buffer, format, latencyMs

**`manager.ts`** — Orchestrator:
- Đăng ký 5 providers vào `Map<string, TTSProvider>`
- **Cache check** trước khi synthesis (latency = 0ms nếu cache hit)
- **Fallback chain**: `elevenlabs → google → openai → edge → gtts`

**`cache.ts`** — LRU Audio Cache:
- Key: SHA-256 hash `provider:voiceId:speed:text`
- LRU eviction khi đầy, TTL 60 phút (configurable)
- Max 100MB (configurable), auto cleanup mỗi 5 phút

**TTS Providers:**

| Provider | API Key? | Đặc điểm |
|---|---|---|
| **Edge TTS** | ❌ | Microsoft Neural Voices, streaming, 9 ngôn ngữ |
| **gTTS** | ❌ | Google Translate, tự chia text >200 ký tự |
| **ElevenLabs** | ✅ | Chất lượng cao nhất, model `eleven_flash_v2_5` |
| **Google Cloud** | ✅ | Neural2, 24kHz, 1M ký tự/tháng miễn phí |
| **OpenAI** | ✅ | Model `tts-1`, 9 giọng |

### 4.3. Voice Module (`src/voice/`)

**`connection.ts`** — Voice Connection Manager:
- Quản lý kết nối theo guild, hỗ trợ **DAVE E2EE** protocol
- Auto-reconnect (5s timeout), join timeout 15s
- `getActiveConnections()` cho API status

**`player.ts`** — Queue-based Audio Player:
- Mỗi guild có queue riêng + 1 AudioPlayer
- Promise-based: resolve khi phát xong
- `skip()`, `clearQueue()`, `cleanup()`

### 4.4. Web Dashboard (`src/web/` + `web/`)

#### Backend API (Express 5)

**`server.ts`** — Express server:
- Middleware: security headers, CORS, rate limit, JSON parser, cookie parser
- API routes: `/api/auth`, `/api/guilds`, `/api/bot`
- Serve React SPA từ `web/dist/` (production)
- SPA fallback: mọi route → `index.html`

**`middleware.ts`** — Bảo mật:
- **Rate limit**: 100 req/min (general), 10 req/min (auth)
- **CORS**: Chỉ cho phép `WEB_FRONTEND_URL`
- **Security headers**: nosniff, DENY frame, XSS protection, strict referrer
- **JWT Auth**: httpOnly cookie, 7 ngày expiry
- **Guild Admin Check**: Kiểm tra user có Administrator/ManageGuild trong guild

**API Routes:**

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| `GET` | `/api/auth/login` | ❌ | Redirect đến Discord OAuth2 |
| `GET` | `/api/auth/callback` | ❌ | Nhận code, đổi token, tạo JWT |
| `GET` | `/api/auth/me` | ✅ | User info từ JWT |
| `POST` | `/api/auth/logout` | ❌ | Xóa cookie |
| `GET` | `/api/guilds` | ✅ | Danh sách guilds (user là admin + bot đang ở) |
| `GET` | `/api/guilds/:id/settings` | ✅👑 | Lấy guild settings |
| `PATCH` | `/api/guilds/:id/settings` | ✅👑 | Cập nhật settings (validation) |
| `GET` | `/api/guilds/:id/allowlist` | ✅👑 | Lấy allowlist |
| `POST` | `/api/guilds/:id/allowlist` | ✅👑 | Thêm user/role vào allowlist |
| `DELETE` | `/api/guilds/:id/allowlist/:targetId` | ✅👑 | Xóa khỏi allowlist |
| `GET` | `/api/guilds/:id/roles` | ✅👑 | Danh sách roles |
| `GET` | `/api/guilds/:id/channels` | ✅👑 | Danh sách channels (text/voice) |
| `GET` | `/api/bot/status` | ✅🔑 | Bot status (chỉ bot owner) |

> ✅ = Cần JWT, 👑 = Guild Admin, 🔑 = Bot Owner only

#### Frontend (React 19 SPA)

**Routing:**
| Route | Page | Mô tả |
|---|---|---|
| `/login` | `LoginPage` | Đăng nhập Discord OAuth |
| `/` | `DashboardPage` | Danh sách servers (protected) |
| `/guild/:id` | `GuildPage` | Cấu hình server - 4 tabs (protected) |

**GuildPage Tabs:**
1. **🛠️ Tổng quan**: Provider, ngôn ngữ, giới hạn ký tự (range slider)
2. **🔐 Phân quyền**: Radio buttons (open/role/allowlist), DJ role select
3. **📖 Auto-Read**: Toggle bật/tắt, chọn kênh text, prefix bỏ qua
4. **📋 Allowlist**: Thêm/xóa user/role, bảng danh sách

**API Client** (`web/src/api/client.ts`):
- Fetch wrapper với `credentials: 'include'`
- Auto redirect `/api/auth/login` khi 401
- Typed generic `request<T>()`

### 4.5. Database (`src/database/`)

- File: `bot.db` (đường dẫn configurable via `DB_PATH`)
- WAL mode, foreign keys ON
- Auto-migration: ALTER TABLE try-catch cho backward compatibility
- Migration v2: Reset user_settings `provider`/`language` thành NULL → tự động kế thừa guild defaults

**3 bảng:**

```
┌─────────────────────────────────────────────────────┐
│                 user_settings                        │
├──────────────┬──────┬───────────────────────────────┤
│ user_id      │ TEXT │ PK                            │
│ guild_id     │ TEXT │ NOT NULL                      │
│ provider     │ TEXT │ NULL = follow guild default   │
│ voice_id     │ TEXT │ NULL or voice ID              │
│ language     │ TEXT │ NULL = follow guild default   │
│ speed        │ REAL │ NULL = 1.0                    │
│ updated_at   │ INT  │ DEFAULT unixepoch()           │
└──────────────┴──────┴───────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                 guild_settings                       │
├─────────────────────────┬──────┬────────────────────┤
│ guild_id                │ TEXT │ PK                  │
│ default_provider        │ TEXT │ DEFAULT 'gtts'      │
│ default_language        │ TEXT │ DEFAULT 'vi'        │
│ text_limit              │ INT  │ DEFAULT 500         │
│ permission_mode         │ TEXT │ DEFAULT 'open'      │
│ dj_role_id              │ TEXT │ DEFAULT ''          │
│ auto_read_enabled       │ INT  │ DEFAULT 0           │
│ auto_read_channel_id    │ TEXT │ DEFAULT ''          │
│ auto_read_ignore_prefix │ TEXT │ DEFAULT '!,/'       │
│ updated_at              │ INT  │ DEFAULT unixepoch() │
└─────────────────────────┴──────┴────────────────────┘

┌─────────────────────────────────────────────────────┐
│                guild_allowlist                        │
├────────────────┬──────┬─────────────────────────────┤
│ id             │ INT  │ PK AUTOINCREMENT            │
│ guild_id       │ TEXT │ NOT NULL                    │
│ target_id      │ TEXT │ NOT NULL                    │
│ target_type    │ TEXT │ CHECK IN ('user', 'role')   │
│ added_at       │ INT  │ DEFAULT unixepoch()         │
│ UNIQUE         │      │ (guild_id, target_id)       │
└────────────────┴──────┴─────────────────────────────┘
```

---

## 5. Luồng Dữ Liệu (Data Flow)

### 5.1. Luồng `/tts` command

```
User gõ /tts "Xin chào"
         │
         ▼
┌──────────────────────┐
│ Discord API Gateway  │ ← InteractionCreate event
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ checkPermission()    │ ← Admin bypass? permission_mode?
└──────────┬───────────┘
           ▼ (OK)
┌──────────────────────┐
│ tts.execute()        │ ← Kiểm tra voice channel, lấy settings
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ sanitizeText()       │ ← Loại mentions, emoji, markdown, URL
│ validateText()       │ ← Kiểm tra text_limit
│ chunkText()          │ ← Chia chunks ≤ 500 ký tự
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ VoiceConnectionMgr   │ ← Join channel (15s timeout, DAVE E2EE)
└──────────┬───────────┘
           ▼ (mỗi chunk)
┌──────────────────────┐
│ TTSManager.synth()   │ ← Cache check (SHA-256) → Provider → Fallback
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ VoicePlayer.enqueue()│ ← Buffer → Stream → AudioResource → play()
└──────────┬───────────┘
           ▼
      Audio phát trong voice channel 🔊
```

### 5.2. Luồng Auto-Read

```
User gửi tin nhắn
   │
   ▼
 Bộ lọc: bot? DM? auto_read off? sai kênh?
          bot ko ở voice? user ko cùng voice?
          prefix bỏ qua? chỉ emoji? rate limit?
   │ (pass)
   ▼
 Prepend "TênUser nói: nội dung"
   │
   ▼
 TTSManager.synthesize() → VoicePlayer.enqueue()
   │
   ▼
 Audio phát 🔊
```

### 5.3. Luồng Web Dashboard

```
User truy cập Dashboard
         │
         ▼
┌────────────────────┐
│ GET /api/auth/login│ ← Redirect Discord OAuth2
└────────┬───────────┘
         ▼
┌────────────────────┐
│ Discord OAuth2     │ ← User authorize → redirect callback
└────────┬───────────┘
         ▼
┌────────────────────┐
│ GET /callback      │ ← Exchange code → access_token
│                    │ ← Fetch user info → Create JWT
│                    │ ← Set httpOnly cookie (7 days)
└────────┬───────────┘
         ▼
┌────────────────────┐
│ React SPA          │ ← GET /api/auth/me → AuthContext
│ DashboardPage      │ ← GET /api/guilds → Server list
│ GuildPage          │ ← GET /api/guilds/:id/settings
│                    │ ← PATCH settings → Save changes
└────────────────────┘
```

### 5.4. Luồng phân quyền

```
Command nhận được
    │
    ├─ Admin/Owner?     → ✅ BYPASS
    ├─ Cần 'admin'?     → ❌ CHẶN
    ├─ Cần 'everyone'?  → ✅ OK
    └─ Cần 'dj'?
         ├─ mode='open'      → ✅ OK
         ├─ mode='role'      → Có DJ role? ✅/❌
         └─ mode='allowlist' → Trong list? ✅/❌
```

---

## 6. Slash Commands

### Everyone

| Lệnh | Mô tả |
|---|---|
| `/voice provider <name>` | Chọn TTS provider |
| `/voice list` | Danh sách giọng đọc |
| `/voice set <voice_id>` | Đặt giọng đọc |
| `/voice speed <0.5-2.0>` | Tốc độ đọc |
| `/voice language <lang>` | Ngôn ngữ (vi/en/ja/ko/zh) |
| `/voice info` | Xem cấu hình hiện tại |

### DJ (phụ thuộc permission_mode)

| Lệnh | Mô tả |
|---|---|
| `/tts <text>` | Chuyển text → giọng nói |
| `/join` | Bot vào voice channel |
| `/leave` | Bot rời voice channel |

### Admin

| Lệnh | Mô tả |
|---|---|
| `/config limit <100-5000>` | Giới hạn ký tự |
| `/config provider <name>` | Provider mặc định server |
| `/config language <lang>` | Ngôn ngữ mặc định server |
| `/config info` | Xem cấu hình server |
| `/setup mode <open\|role\|allowlist>` | Chế độ phân quyền |
| `/setup dj-role <role>` | Đặt DJ role |
| `/setup allow <user\|role>` | Thêm allowlist |
| `/setup deny <user\|role>` | Xóa allowlist |
| `/setup list` | Xem phân quyền |
| `/bot status` | Trạng thái bot |
| `/bot cache stats\|clear` | Quản lý cache |
| `/bot reconnect` | Reconnect voice |
| `/bot leave-all` | Rời tất cả voice |
| `/autotts on\|off` | Bật/tắt auto-read |
| `/autotts channel <#ch>` | Giới hạn kênh |
| `/autotts ignore-prefix <...>` | Prefix bỏ qua |
| `/autotts status` | Trạng thái auto-read |

---

## 7. Hướng Dẫn Cài Đặt & Sử Dụng

### 7.1. Yêu cầu

- **Node.js** ≥ 22.0.0
- **ffmpeg** (cho audio processing)
- **Python3, make, g++** (cho native modules)

### 7.2. Cài đặt

```bash
# Clone & install
git clone <repo-url>
cd audio-bot
npm install

# Frontend
cd web
npm install
cd ..

# Cấu hình
cp .env.example .env
# Sửa .env với thông tin Discord Bot
```

### 7.3. Biến môi trường (`.env`)

| Biến | Bắt buộc | Mặc định | Mô tả |
|---|---|---|---|
| `DISCORD_TOKEN` | ✅ | — | Bot token |
| `DISCORD_CLIENT_ID` | ✅ | — | Bot client ID |
| `ELEVENLABS_API_KEY` | ❌ | — | ElevenLabs API key |
| `GOOGLE_CLOUD_TTS_KEY` | ❌ | — | Google Cloud TTS key |
| `OPENAI_API_KEY` | ❌ | — | OpenAI API key |
| `DEFAULT_TTS_PROVIDER` | ❌ | `gtts` | Provider mặc định |
| `DEFAULT_LANGUAGE` | ❌ | `vi` | Ngôn ngữ mặc định |
| `DEFAULT_TEXT_LIMIT` | ❌ | `500` | Giới hạn ký tự |
| `CACHE_MAX_SIZE_MB` | ❌ | `100` | Max cache (MB) |
| `CACHE_TTL_MINUTES` | ❌ | `60` | Cache TTL (phút) |
| `LOG_LEVEL` | ❌ | `info` | Log level |
| `WEB_ENABLED` | ❌ | `false` | Bật Web Dashboard |
| `WEB_PORT` | ❌ | `3000` | Port web server |
| `WEB_FRONTEND_URL` | ❌ | `http://localhost:5173` | Frontend URL (CORS) |
| `JWT_SECRET` | ❌* | — | Secret cho JWT (*bắt buộc nếu web bật) |
| `DISCORD_OAUTH_CLIENT_SECRET` | ❌* | — | OAuth2 client secret |
| `DISCORD_OAUTH_REDIRECT_URI` | ❌ | `http://localhost:3000/api/auth/callback` | OAuth redirect |
| `BOT_OWNER_ID` | ❌ | — | Discord user ID của owner |
| `DB_PATH` | ❌ | `./bot.db` | Đường dẫn database |

> Bot hoạt động được ngay chỉ với `DISCORD_TOKEN` + `DISCORD_CLIENT_ID`. Edge TTS và gTTS miễn phí, không cần API key.

### 7.4. Chạy Development

```bash
# Backend (hot reload)
npm run dev

# Frontend (dev server + proxy)
cd web
npm run dev
```

### 7.5. Chạy Production

```bash
# Build
npm run build       # Backend: TypeScript → dist/
cd web && npm run build  # Frontend: React → web/dist/

# Start
npm start           # Chạy backend + serve frontend
```

### 7.6. Chạy Docker

```bash
docker compose up -d --build    # Build & run
docker logs -f discord-tts-bot  # Xem logs
docker compose down             # Dừng
```

**Docker Compose features:**
- Multi-stage build (3 stages: builder → frontend → runtime)
- Volume: `./data:/app/data` (SQLite WAL cần mount thư mục)
- Memory limit: 512MB (reservation 128MB)
- Log rotation: max 10MB × 3 files
- Healthcheck: `curl http://localhost:3000/api/bot/status`
- Non-root user (`node`)
- Port: `3000:3000`

---

## 8. Hướng Dẫn Deploy Lên Coolify

### 8.1. Chuẩn bị

#### Trên Coolify dashboard:
1. Đảm bảo đã kết nối **server** (VPS/Dedicated)
2. Đảm bảo đã kết nối **source** (GitHub/GitLab/Gitea hoặc direct Git)

#### Trên Discord Developer Portal:
1. Vào [Discord Developer Portal](https://discord.com/developers/applications)
2. Chọn application → **OAuth2** → **Redirects**
3. Thêm redirect URI: `https://your-domain.com/api/auth/callback`
4. Copy **Client ID** và **Client Secret**

### 8.2. Tạo Resource trên Coolify

1. **Vào Coolify** → Projects → Chọn/tạo project → Add Resource
2. Chọn **Docker Based** → **Dockerfile**
3. Kết nối repository chứa code

### 8.3. Cấu hình Build

| Setting | Giá trị |
|---|---|
| **Build Pack** | Dockerfile |
| **Dockerfile Location** | `./Dockerfile` |
| **Port Exposes** | `3000` |
| **Health Check Path** | `/api/bot/status` |

### 8.4. Cấu hình Environment Variables

Trong Coolify → Resource → **Environment Variables**, thêm:

```env
# === BẮT BUỘC ===
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# === WEB DASHBOARD ===
WEB_ENABLED=true
WEB_PORT=3000
JWT_SECRET=random_secret_string_min_32_chars
DISCORD_OAUTH_CLIENT_SECRET=your_oauth_client_secret
DISCORD_OAUTH_REDIRECT_URI=https://your-domain.com/api/auth/callback
WEB_FRONTEND_URL=https://your-domain.com
BOT_OWNER_ID=your_discord_user_id

# === DATABASE ===
DB_PATH=/app/data/bot.db

# === TTS (tuỳ chọn) ===
DEFAULT_TTS_PROVIDER=edge
DEFAULT_LANGUAGE=vi
# ELEVENLABS_API_KEY=...
# GOOGLE_CLOUD_TTS_KEY=...
# OPENAI_API_KEY=...
```

> **Lưu ý quan trọng**: `WEB_FRONTEND_URL` và `DISCORD_OAUTH_REDIRECT_URI` phải dùng domain thực tế (HTTPS) mà Coolify sẽ expose.

### 8.5. Cấu hình Storage (Persistent Volume)

SQLite cần persistent storage để dữ liệu không mất khi redeploy:

1. Vào **Storages** tab trong resource settings
2. Thêm volume mount:
   - **Source Path (Host)**: Để Coolify tự tạo, hoặc chỉ định ví dụ `/data/tts-bot`
   - **Destination Path**: `/app/data`

### 8.6. Cấu hình Domain & SSL

1. Vào **General** tab → **Domains**
2. Thêm domain: `https://tts-bot.your-domain.com`
3. Coolify sẽ tự động cấp SSL qua Let's Encrypt
4. Port mapping: `3000` (container) → `443` (HTTPS)

### 8.7. Cấu hình Resource Limits (Tuỳ chọn)

Trong **Advanced** tab:
- **Memory Limit**: `512M` (khuyến nghị)
- **Memory Reservation**: `128M`
- **CPU Limit**: `1.0` (1 core)

### 8.8. Deploy

1. Click **Deploy** hoặc bật **Auto Deploy** (tự deploy khi push code)
2. Theo dõi build logs trong Coolify
3. Kiểm tra healthcheck: `https://your-domain.com/api/bot/status`

### 8.9. Sau khi deploy

1. **Đăng nhập Dashboard**: Truy cập `https://your-domain.com` → Login with Discord
2. **Kiểm tra bot**: Bot tự online trên Discord sau khi container start
3. **Xem logs**: Coolify → Resource → Logs tab
4. **Redeploy**: Push code mới → Coolify tự build lại (nếu bật auto deploy)

### 8.10. Troubleshooting

| Vấn đề | Giải pháp |
|---|---|
| Bot không online | Kiểm tra `DISCORD_TOKEN` trong env variables |
| OAuth2 không redirect | Kiểm tra `DISCORD_OAUTH_REDIRECT_URI` khớp Discord Portal |
| Database mất khi redeploy | Kiểm tra volume mount `/app/data` |
| 502 Bad Gateway | Kiểm tra port `3000` expose đúng |
| Memory limit exceeded | Tăng memory limit lên 768M hoặc 1G |
| Build fail native modules | Dockerfile đã cài `python3 make g++`, check build logs |

---

## 9. Điểm Nổi Bật Thiết Kế

1. **Multi-provider + Fallback tự động**: Provider fail → thử provider tiếp theo, đảm bảo uptime
2. **LRU Cache thông minh**: SHA-256 hash key, auto-cleanup, giảm API cost
3. **Queue-based Audio Player**: Promise-based, mỗi guild 1 queue riêng
4. **DAVE E2EE**: Hỗ trợ mã hóa end-to-end Discord 2026
5. **Web Dashboard**: React SPA + Express API, Discord OAuth2, JWT httpOnly cookie
6. **Security layers**: Rate limiting (2 tiers), CORS, security headers, Guild admin check
7. **Multi-stage Docker**: 3 stages (builder → frontend → runtime), non-root user, healthcheck
8. **Database migration**: Backward-compatible schema evolution, NULL merge với guild defaults
9. **Auto-Reader**: Rate limiting, bộ lọc thông minh, cá nhân hóa TTS per-user
10. **Text Sanitization**: Loại mentions/markdown/URL/code blocks trước TTS
