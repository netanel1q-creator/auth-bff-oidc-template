# 🔐 Auth BFF OIDC Template

Production-ready SvelteKit template for OAuth/OIDC authentication using the Backend-for-Frontend (BFF) pattern.

## ✨ Features

- **🔒 Secure by Design**: Tokens never leave the server, only HTTP-only cookies in the browser
- **⚡ PKCE Flow**: Protection against authorization code interception attacks
- **📦 Flexible Session Storage**:
  - Memory Store (development)
  - Redis Store (production, recommended)
  - PostgreSQL Store (if you already use Postgres)
- **🛡️ Rate Limiting**: Built-in protection against brute-force attacks
- **🎯 Type-Safe**: Full TypeScript support with SvelteKit's generated types
- **🚀 Svelte 5**: Modern reactive patterns with runes
- **🔄 Token Refresh**: Automatic token renewal before expiration
- **🧹 Session Cleanup**: Automatic cleanup of expired sessions

## 📋 Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0 (or npm)
- OAuth/OIDC Provider (Keycloak, Auth0, Okta, etc.)

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/FrankFMY/auth-bff-oidc-template.git
cd auth-bff-oidc-template
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Create `.env` file in the project root:

```env
# OIDC Configuration
OIDC_ISSUER=https://your-oidc-provider.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=http://localhost:5173/auth/callback

# Session Configuration (optional)
# SESSION_SECRET=your-random-secret-key
```

### 4. Run the development server

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📦 Session Store Configuration

### Development: Memory Store (Default)

No additional setup required. Memory store is used by default.

⚠️ **Warning**: Memory store is NOT suitable for production. Sessions are lost on server restart.

### Production: Redis Store (Recommended)

1. Install Redis client:

```bash
pnpm add ioredis
```

2. Add Redis URL to `.env`:

```env
REDIS_URL=redis://localhost:6379
```

3. Edit `src/lib/server/auth/index.ts` and uncomment Redis configuration:

```typescript
// Uncomment this section
import { Redis } from "ioredis";
import { RedisSessionStore } from "./stores/redis.js";
import { REDIS_URL } from "$env/static/private";

const redis = new Redis(REDIS_URL || "redis://localhost:6379");
const sessionStore = new RedisSessionStore(redis);

export const authService = new BFFAuthService(
  {
    issuer: OIDC_ISSUER,
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
    redirectUri: OIDC_REDIRECT_URI,
    scopes: ["openid", "profile", "email"],
  },
  sessionStore,
);
```

### Production: PostgreSQL Store

1. Install PostgreSQL client:

```bash
pnpm add pg
```

2. Create sessions table:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

3. Add Database URL to `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

4. Edit `src/lib/server/auth/index.ts` and uncomment PostgreSQL configuration.

## 🏗️ Project Structure

```
src/
├── lib/
│   └── server/
│       └── auth/
│           ├── bff.ts              # Core BFF Auth Service
│           ├── index.ts            # Auth configuration
│           ├── middleware.ts       # Authentication middleware
│           ├── rate-limiter.ts     # Rate limiting
│           ├── session-store.ts    # Session store interface
│           ├── utils.ts            # Utility functions
│           └── stores/
│               ├── memory.ts       # Memory session store
│               ├── redis.ts        # Redis session store
│               └── postgres.ts     # PostgreSQL session store
├── routes/
│   ├── +layout.server.ts          # User data injection
│   ├── +page.svelte               # Home page
│   ├── auth/
│   │   ├── login/+server.ts       # Login endpoint
│   │   ├── callback/+server.ts    # OAuth callback
│   │   └── logout/+server.ts      # Logout endpoint
│   └── api/
│       └── user/
│           └── profile/+server.ts # Protected API example
└── hooks.server.ts                # Global hooks (auth middleware)
```

## 🔐 Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant BFF (SvelteKit)
    participant OIDC Provider

    Browser->>BFF: GET /auth/login
    BFF->>BFF: Generate PKCE challenge
    BFF->>OIDC Provider: Redirect to authorization URL
    OIDC Provider->>Browser: Login page
    Browser->>OIDC Provider: Enter credentials
    OIDC Provider->>BFF: Redirect to /auth/callback?code=...
    BFF->>OIDC Provider: Exchange code for tokens (with PKCE)
    OIDC Provider->>BFF: Return tokens
    BFF->>BFF: Store tokens in session
    BFF->>Browser: Set HTTP-only cookie, redirect to /
    Browser->>BFF: GET / (with cookie)
    BFF->>BFF: Validate session
    BFF->>Browser: Return protected page
```

## 🛡️ Security Features

- **No Token Exposure**: Access/refresh tokens never reach the browser
- **HTTP-Only Cookies**: Session IDs are stored in secure, HTTP-only cookies
- **PKCE**: Protection against authorization code interception
- **Rate Limiting**: Configurable limits on authentication endpoints
- **CSRF Protection**: Built-in SvelteKit CSRF protection
- **Token Refresh**: Automatic token renewal 5 minutes before expiration
- **Session Expiration**: Automatic cleanup of expired sessions

## 📝 Usage Examples

### Protected Page

```typescript
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(303, "/auth/login");
  }

  return {
    user: locals.user,
  };
};
```

### Protected API Endpoint

```typescript
// src/routes/api/posts/+server.ts
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    error(401, "Unauthorized");
  }

  const posts = await db.getPosts(locals.user.sub);
  return json(posts);
};
```

### User Data in Components

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

{#if data.user}
  <h1>Welcome, {data.user.name}!</h1>
  <a href="/auth/logout">Logout</a>
{:else}
  <a href="/auth/login">Login</a>
{/if}
```

## ⚙️ Configuration Options

### Rate Limiting

Configure in `src/lib/server/auth/rate-limiter.ts`:

```typescript
const limiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 requests per window
  keyGenerator: (request) => {
    // Generate unique key per IP
    return request.headers.get("x-forwarded-for") || "unknown";
  },
});
```

### Session TTL

Configure session expiration time:

```typescript
// Redis
const sessionStore = new RedisSessionStore(redis, {
  prefix: "session:",
  defaultTTL: 86400, // 24 hours in seconds
});

// PostgreSQL
const sessionStore = new PostgresSessionStore(pool, {
  tableName: "sessions",
  cleanupIntervalMs: 3600000, // Cleanup every hour
});
```

## 🧪 Development

```bash
# Run dev server
pnpm dev

# Type checking
pnpm check

# Linting
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 🚀 Deployment

### Environment Variables

Ensure these environment variables are set in production:

- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_REDIRECT_URI`
- `REDIS_URL` or `DATABASE_URL` (depending on session store)

### Build

```bash
pnpm build
```

The build output will be in the `.svelte-kit` directory. Configure your deployment platform to serve this directory.

### Popular Platforms

- **Vercel**: Zero-config deployment
- **Netlify**: Works out of the box
- **Cloudflare Pages**: Supported with adapter-cloudflare
- **Docker**: Use Node.js adapter and create Dockerfile

## 📚 Additional Resources

- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Svelte 5 Documentation](https://svelte.dev/docs/svelte/overview)
- [OAuth 2.0 PKCE RFC](https://datatracker.ietf.org/doc/html/rfc7636)
- [OIDC Specification](https://openid.net/specs/openid-connect-core-1_0.html)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [FrankFMY](https://github.com/FrankFMY)

## 📧 Contact

- GitHub: [@FrankFMY](https://github.com/FrankFMY)
- Email: Pryanishnikovartem@gmail.com

## 🙏 Acknowledgments

- Inspired by the BFF (Backend-for-Frontend) security pattern
- Built with [SvelteKit](https://kit.svelte.dev/) and [Svelte 5](https://svelte.dev/)
