/**
 * Backend Firebase using REST APIs — bypasses firebase-admin / google-auth-library.
 *
 * google-auth-library has a compatibility bug in this runtime:
 *   "config.headers.has is not a function"
 * This prevents firebase-admin from authenticating, silently breaking every
 * database operation and FCM send.
 *
 * Instead, we self-mint an OAuth2 access token by:
 *   1. Signing a JWT with the service account private key (Web Crypto API)
 *   2. Exchanging it at Google's token endpoint for an access token
 *
 * Database operations use the Firebase Realtime Database REST API.
 * Push notifications use the FCM HTTP v1 API (for web/FCM tokens) and
 * direct APNs sending (for iOS device tokens, using the .p8 key).
 * Both bypass google-auth-library entirely.
 */

interface ServiceAccount {
  private_key: string;
  client_email: string;
  token_uri: string;
  project_id: string;
  private_key_id?: string;
}

let serviceAccount: ServiceAccount | null = null;
let dbURL: string | null | undefined = null;
let projId: string | null = null;
let isConfigured = false;

// APNs direct-sending configuration (bypasses FCM for iOS tokens).
let apnsKeyId: string | null = null;
let apnsTeamId: string | null = null;
let apnsPrivateKeyPem: string | null = null;
let apnsBundleId: string | null = null;
let apnsSandbox = true; // development builds use sandbox
let apnsConfigured = false;

try {
  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  dbURL =
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ||
    process.env.FIREBASE_DATABASE_URL;

  if (rawKey && dbURL) {
    const parsed = typeof rawKey === "string" ? JSON.parse(rawKey) : rawKey;
    serviceAccount = parsed as ServiceAccount;
    projId = parsed.project_id;
    isConfigured = true;
    console.log(
      "[Backend Firebase] REST API mode configured for project:",
      projId,
      "dbURL:",
      dbURL,
    );
  } else {
    console.warn(
      "[Backend Firebase] Missing FIREBASE_SERVICE_ACCOUNT_KEY or database URL — push service disabled",
      "hasKey:", !!rawKey, "hasDbURL:", !!dbURL,
    );
  }

  // Load APNs direct-sending credentials.
  apnsKeyId = process.env.APNS_KEY_ID || null;
  apnsTeamId = process.env.APNS_TEAM_ID || process.env.EXPO_PUBLIC_TEAM_ID || null;
  apnsPrivateKeyPem = process.env.APNS_PRIVATE_KEY || null;
  apnsBundleId = process.env.APNS_BUNDLE_ID || "app.rork.feeble";
  apnsSandbox = (process.env.APNS_SANDBOX || "true") !== "false";

  // Validate the team ID: Apple Developer Team IDs are exactly 10
  // alphanumeric characters (e.g. "A1B2C3D4E5"). A UUID here means the
  // wrong value was picked up (e.g. a project UUID) — APNs would reject
  // every JWT with 403 InvalidProviderToken.
  const teamIdLooksValid = !!apnsTeamId && /^[A-Z0-9]{10}$/i.test(apnsTeamId);
  if (apnsTeamId && !teamIdLooksValid) {
    console.error(
      `[Backend APNs] INVALID TEAM ID: "${apnsTeamId}" is not an Apple Developer Team ID (must be 10 alphanumeric chars, e.g. A1B2C3D4E5). Set the APNS_TEAM_ID env var to your real Apple Team ID (top-right of developer.apple.com/account).`,
    );
  }

  if (apnsKeyId && apnsTeamId && apnsPrivateKeyPem && teamIdLooksValid) {
    apnsConfigured = true;
    // Detect common format issues with the private key.
    const hasLiteralNewlines = apnsPrivateKeyPem.includes('\\n');
    const hasRealNewlines = apnsPrivateKeyPem.includes('\n');
    const hasPemHeaders = apnsPrivateKeyPem.includes('-----BEGIN');
    console.log(
      `[Backend APNs] Direct APNs sending configured (v3-auth-header): team=${apnsTeamId}, key=${apnsKeyId}, bundle=${apnsBundleId}, sandbox=${apnsSandbox}`,
    );
    console.log(
      `[Backend APNs] Key format: len=${apnsPrivateKeyPem.length}, hasPEMHeaders=${hasPemHeaders}, hasRealNewlines=${hasRealNewlines}, hasLiteralNewlines=${hasLiteralNewlines}`,
    );
    if (hasLiteralNewlines && !hasRealNewlines) {
      console.warn('[Backend APNs] WARNING: Private key contains literal \\n instead of real newlines — normalizing...');
    }
  } else {
    console.warn(
      "[Backend APNs] Direct APNs NOT configured — hasKeyId:", !!apnsKeyId, "hasTeamId:", !!apnsTeamId, "teamIdValid:", teamIdLooksValid, "hasPrivateKey:", !!apnsPrivateKeyPem,
    );
  }
} catch (e) {
  console.warn("[Backend Firebase] Init failed:", e);
}

// ---------------------------------------------------------------------------
// OAuth2 token management
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let tokenExpiry = 0;

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  // Normalize literal "\n" (backslash-n) to actual newlines. When PEM keys
  // are pasted into environment variable fields, newlines are often encoded
  // as the literal two-character sequence \n instead of real newline chars.
  // This corrupts base64 parsing because the fallback regex keeps "n" (a
  // valid base64 char) but drops "\", shifting the entire base64 string.
  let normalized = pem.replace(/\\n/g, "\n").replace(/\\r/g, "");

  // Extract only the base64 content between PEM headers.
  const match = normalized.match(
    /-----BEGIN[^-]*-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END[^-]*-----/,
  );
  let b64: string;
  if (match) {
    b64 = match[1].replace(/[^A-Za-z0-9+/=]/g, "");
  } else {
    // Fallback: strip known PEM markers then filter to base64 only.
    b64 = normalized
      .replace(/-----BEGIN[^-]*-----/g, "")
      .replace(/-----END[^-]*-----/g, "")
      .replace(/[^A-Za-z0-9+/=]/g, "");
  }

  if (!b64 || b64.length < 10) {
    throw new Error(
      `pemToDer: extracted base64 is too short (${b64.length} chars). Key may be malformed. First 50 chars of input: ${pem.slice(0, 50)}`,
    );
  }

  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  } catch (e) {
    throw new Error(
      `pemToDer: base64 decode failed (${b64.length} chars, first 30: ${b64.slice(0, 30)}): ${e}`,
    );
  }
}

/**
 * Convert an ECDSA signature to the raw R||S format expected by JWT (ES256).
 *
 * Web Crypto API in browsers and Node.js produces DER-encoded signatures
 * (ASN.1 SEQUENCE of two INTEGERs), but Bun returns raw R||S (64 bytes)
 * directly. This function handles both formats:
 *   - If the signature is 64 bytes and doesn't start with 0x30, it's already
 *     raw R||S — return as-is.
 *   - If it starts with 0x30, parse the DER structure and extract R and S.
 */
function derToRawSignature(sig: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(sig);

  // Already raw R||S (64 bytes for P-256) — Bun and some other runtimes
  // return this format directly from crypto.subtle.sign().
  if (bytes.length === 64 && bytes[0] !== 0x30) {
    return sig;
  }

  // Also handle 66-byte raw (unlikely but safe) or other non-DER formats.
  if (bytes[0] !== 0x30) {
    // If it's not DER and not 64 bytes, throw with a helpful message.
    if (bytes.length < 64) {
      throw new Error(
        `derToRawSignature: unexpected signature format — length=${bytes.length}, firstByte=0x${bytes[0].toString(16)}. Not DER (no 0x30) and not raw R||S (not 64 bytes).`,
      );
    }
    // Assume raw R||S, take first 64 bytes.
    return bytes.slice(0, 64).buffer;
  }

  // DER-encoded: parse ASN.1 SEQUENCE { r INTEGER, s INTEGER }
  let offset = 0;
  if (bytes[offset++] !== 0x30) throw new Error("Invalid DER: expected SEQUENCE");
  // Read SEQUENCE length (simplified — handles short form only)
  offset++; // seqLen — not needed for parsing
  // r
  if (bytes[offset++] !== 0x02) throw new Error("Invalid DER: expected INTEGER for r");
  const rLen = bytes[offset++];
  const rBytes = bytes.slice(offset, offset + rLen);
  offset += rLen;
  // s
  if (bytes[offset++] !== 0x02) throw new Error("Invalid DER: expected INTEGER for s");
  const sLen = bytes[offset++];
  const sBytes = bytes.slice(offset, offset + sLen);

  // Each value must be exactly 32 bytes, zero-padded on the left.
  const raw = new Uint8Array(64);
  const rStart = rBytes.length > 32 ? rBytes.length - 32 : 0;
  const rSrc = rBytes.slice(rStart);
  raw.set(rSrc, 32 - rSrc.length);
  const sStart = sBytes.length > 32 ? sBytes.length - 32 : 0;
  const sSrc = sBytes.slice(sStart);
  raw.set(sSrc, 32 + (32 - sSrc.length));
  return raw.buffer;
}

async function getAccessToken(): Promise<string | null> {
  if (!serviceAccount) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiry > now + 120) {
    return cachedToken;
  }

  try {
    const header: Record<string, string> = { alg: "RS256", typ: "JWT" };
    if (serviceAccount.private_key_id) header.kid = serviceAccount.private_key_id;

    const payload = {
      iss: serviceAccount.client_email,
      // The Realtime Database REST API requires BOTH the userinfo.email
      // scope AND the firebase.database scope. Without userinfo.email, RTDB
      // returns 401 "Unauthorized request." even with a valid access token.
      // cloud-platform covers FCM HTTP v1 as well.
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/firebase.database",
        "https://www.googleapis.com/auth/firebase.messaging",
      ].join(" "),
      aud: serviceAccount.token_uri,
      iat: now,
      exp: now + 3600,
    };

    const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64url(
      new TextEncoder().encode(JSON.stringify(payload)),
    );
    const unsigned = `${headerB64}.${payloadB64}`;

    const keyData = pemToDer(serviceAccount.private_key);
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(unsigned),
    );

    const jwt = `${unsigned}.${base64url(signature)}`;

    const res = await fetch(serviceAccount.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Token exchange failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in || 3600);
    console.log(
      "[Backend Firebase] OAuth2 token minted, expires in",
      data.expires_in,
      "seconds",
    );
    return cachedToken;
  } catch (e) {
    console.warn("[Backend Firebase] Failed to mint OAuth2 token:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// DataSnapshot — matches Admin SDK snapshot interface
// ---------------------------------------------------------------------------

class DataSnapshot {
  private value_: any;

  constructor(value: any) {
    this.value_ = value;
  }

  exists(): boolean {
    return this.value_ !== null && this.value_ !== undefined;
  }

  val(): any {
    return this.value_;
  }
}

// ---------------------------------------------------------------------------
// DatabaseRef — REST API wrapper.
// .on() uses Server-Sent Events (SSE) for real-time updates (the Firebase
// REST API supports `Accept: text/event-stream`). Falls back to polling if
// SSE isn't available or the stream drops.
// ---------------------------------------------------------------------------

const POLL_FALLBACK_INTERVAL = 3000; // initial poll interval (only used if SSE fails)
const SSE_RECONNECT_DELAY = 2000; // reconnect after 2s on stream drop
const POLL_MAX_INTERVAL = 60000; // max backoff: 60 seconds
const POLL_MAX_CONSECUTIVE_ERRORS = 10; // stop polling after this many consecutive errors

class DatabaseRef {
  private listening = false;
  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSerialized: string | undefined;
  private consecutiveErrors = 0;
  private currentPollInterval = POLL_FALLBACK_INTERVAL;

  constructor(private path: string) {}

  private url(): string {
    // Sanitize: strip trailing slashes from dbURL to avoid double-slash URLs.
    const base = (dbURL || '').replace(/\/+$/, '');
    return `${base}/${this.path}.json`;
  }

  private async restCall(method: string, body?: any): Promise<any> {
    const token = await getAccessToken();
    if (!token) throw new Error("No access token available");

    const res = await fetch(this.url(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      // Token might be invalid — clear cache so next call re-mints.
      cachedToken = null;
      tokenExpiry = 0;
      const errBody = await res.text().catch(() => '');
      // Log the full URL to help diagnose wrong database URL issues.
      console.warn(`[Backend Firebase] DB 401 on ${method} ${this.path}: ${errBody.slice(0, 300)} | URL: ${this.url().slice(0, 120)}`);
      throw new Error(`DB ${method} ${this.path}: 401 Unauthorized — ${errBody.slice(0, 200)}`);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DB ${method} ${this.path}: ${res.status} ${text}`);
    }

    if (method === "DELETE") return null;
    return await res.json();
  }

  async get(): Promise<DataSnapshot> {
    const value = await this.restCall("GET");
    return new DataSnapshot(value);
  }

  async set(value: any): Promise<void> {
    await this.restCall("PUT", value);
  }

  async update(updates: any): Promise<void> {
    await this.restCall("PATCH", updates);
  }

  async remove(): Promise<void> {
    await this.restCall("DELETE");
  }

  /**
   * Real-time "value" listener using SSE streaming. The Firebase REST API
   * sends `event: put\ndata: {"path":"/","data":<value>}` events whenever
   * data changes. Falls back to polling if SSE fails.
   */
  on(
    event: string,
    callback: (snapshot: DataSnapshot) => void,
    errorCallback?: (error: any) => void,
  ): void {
    if (event !== "value") return;
    this.listening = true;
    this.startSSE(callback, errorCallback);
  }

  /**
   * Start SSE stream. Reconnects automatically on disconnect.
   */
  private async startSSE(
    callback: (snapshot: DataSnapshot) => void,
    errorCallback?: (error: any) => void,
  ): Promise<void> {
    if (!this.listening) return;

    this.abortController = new AbortController();

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("No access token for SSE");
      if (!this.listening) return;

      const res = await fetch(this.url(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: this.abortController.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (this.listening) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines.
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventStr of events) {
          if (!this.listening) break;
          this.parseSSEEvent(eventStr, callback);
        }
      }
    } catch (e: any) {
      if (this.listening) {
        // If it was an abort, don't report the error.
        if (e?.name !== "AbortError" && errorCallback) {
          errorCallback(e);
        }
        // Fall back to polling while attempting SSE reconnection.
        this.startPolling(callback, errorCallback);
      }
      return;
    }

    // Stream ended normally — reconnect if still listening.
    if (this.listening) {
      this.reconnectTimer = setTimeout(() => {
        this.startSSE(callback, errorCallback);
      }, SSE_RECONNECT_DELAY);
    }
  }

  /**
   * Parse a single SSE event and invoke the callback if data changed.
   */
  private parseSSEEvent(
    eventStr: string,
    callback: (snapshot: DataSnapshot) => void,
  ): void {
    const lines = eventStr.split("\n");
    let eventType = "";
    let dataStr = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) eventType = line.slice(7).trim();
      if (line.startsWith("data: ")) dataStr = line.slice(6);
    }

    if (eventType === "put" && dataStr) {
      try {
        const parsed = JSON.parse(dataStr) as { path: string; data: any };
        // For "value" listeners, we only care about root path events
        // (which contain the full data). Patch events have partial paths.
        if (parsed.path === "/") {
          const serialized = JSON.stringify(parsed.data);
          if (serialized !== this.lastSerialized) {
            this.lastSerialized = serialized;
            callback(new DataSnapshot(parsed.data));
          }
        } else {
          // Partial update — re-fetch full data to get a complete snapshot.
          this.restCall("GET")
            .then((fullValue) => {
              const serialized = JSON.stringify(fullValue);
              if (serialized !== this.lastSerialized) {
                this.lastSerialized = serialized;
                callback(new DataSnapshot(fullValue));
              }
            })
            .catch(() => {});
        }
      } catch {}
    } else if (eventType === "patch" && dataStr) {
      // Patch events contain a partial diff — re-fetch full data.
      this.restCall("GET")
        .then((fullValue) => {
          const serialized = JSON.stringify(fullValue);
          if (serialized !== this.lastSerialized) {
            this.lastSerialized = serialized;
            callback(new DataSnapshot(fullValue));
          }
        })
        .catch(() => {});
    }
  }

  /**
   * Polling fallback — used when SSE streaming isn't available.
   */
  private startPolling(
    callback: (snapshot: DataSnapshot) => void,
    errorCallback?: (error: any) => void,
  ): void {
    const poll = async () => {
      if (!this.listening) return;

      try {
        const value = await this.restCall("GET");
        if (!this.listening) return;

        // Reset error state on success.
        this.consecutiveErrors = 0;
        this.currentPollInterval = POLL_FALLBACK_INTERVAL;

        const serialized = JSON.stringify(value);
        if (serialized !== this.lastSerialized) {
          this.lastSerialized = serialized;
          callback(new DataSnapshot(value));
        }
      } catch (e) {
        this.consecutiveErrors++;
        if (this.listening && errorCallback) errorCallback(e);

        // Exponential backoff: double the interval on each consecutive error,
        // capped at POLL_MAX_INTERVAL. Stop after too many consecutive errors.
        if (this.consecutiveErrors >= POLL_MAX_CONSECUTIVE_ERRORS) {
          console.error(
            `[Backend Firebase] Giving up on ${this.path} after ${this.consecutiveErrors} consecutive errors`,
          );
          this.listening = false;
          return;
        }

        this.currentPollInterval = Math.min(
          this.currentPollInterval * 2,
          POLL_MAX_INTERVAL,
        );
      }

      if (this.listening) {
        this.pollTimer = setTimeout(poll, this.currentPollInterval);
      }
    };

    poll();
  }

  off(_event?: string, _callback?: any): void {
    this.listening = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

class Database {
  ref(path: string): DatabaseRef {
    return new DatabaseRef(path);
  }
}

// ---------------------------------------------------------------------------
// Direct APNs sending (bypasses FCM entirely for iOS tokens)
//
// On iOS, getDevicePushTokenAsync() returns a raw APNs token (hex string).
// Instead of converting these to FCM tokens via the deprecated Instance ID
// batchImport API, we send pushes directly to APNs using the HTTP/2 API
// with a .p8 provider JWT for authentication.
//
// This requires three env vars:
//   APNS_KEY_ID     — the Key ID from your Apple Developer .p8 key
//   APNS_TEAM_ID    — your Apple Developer Team ID (or EXPO_PUBLIC_TEAM_ID)
//   APNS_PRIVATE_KEY — the full PEM contents of the .p8 file
//
// Optional:
//   APNS_BUNDLE_ID  — defaults to "app.rork.feeble"
//   APNS_SANDBOX    — "true" (default) for dev, "false" for production
// ---------------------------------------------------------------------------

// Cache of APNs provider JWT tokens (valid for 30 minutes).
let apnsJwtCache: string | null = null;
let apnsJwtExpiry = 0;

/**
 * Mint a provider JWT token for APNs HTTP/2 API.
 * This signs a JWT with the .p8 private key (ES256 algorithm).
 * The JWT authenticates us to send pushes directly via APNs.
 */
async function getApnsProviderToken(): Promise<string | null> {
  if (!apnsConfigured || !apnsKeyId || !apnsTeamId || !apnsPrivateKeyPem) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (apnsJwtCache && apnsJwtExpiry > now + 60) {
    return apnsJwtCache;
  }

  try {
    const header = { alg: 'ES256', kid: apnsKeyId, typ: 'JWT' };
    const payload = {
      iss: apnsTeamId,
      iat: now,
    };

    const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
    const unsigned = `${headerB64}.${payloadB64}`;

    const keyData = pemToDer(apnsPrivateKeyPem);
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyData,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );

    const derSignature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      new TextEncoder().encode(unsigned),
    );

    // Web Crypto produces DER-encoded ECDSA signatures, but JWT needs raw R||S.
    const rawSignature = derToRawSignature(derSignature);
    const jwt = `${unsigned}.${base64url(rawSignature)}`;

    apnsJwtCache = jwt;
    apnsJwtExpiry = now + 30 * 60; // 30 minutes
    return jwt;
  } catch (e) {
    console.warn('[Backend APNs] Failed to mint provider JWT:', e);
    return null;
  }
}

/**
 * Send a push notification directly to an APNs token (iOS device).
 * Uses the APNs HTTP/2 API with a .p8 provider JWT for authentication.
 * This bypasses FCM entirely — no batchImport, no FCM conversion needed.
 *
 * Returns true if the push was accepted by APNs, false otherwise.
 */
async function sendApnsPush(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  priority?: string;
}): Promise<boolean> {
  const { token, title, body, data, priority } = params;

  const jwt = await getApnsProviderToken();
  if (!jwt) {
    console.warn('[Backend APNs] No provider JWT available — cannot send direct APNs push');
    return false;
  }

  const host = apnsSandbox
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';
  const url = `${host}/3/device/${token}`;

  const apsPayload: Record<string, any> = {
    alert: { title, body },
    sound: 'default',
    badge: 1,
  };

  const payload: Record<string, any> = {
    aps: apsPayload,
  };

  // Merge custom data at the top level (APNs allows arbitrary keys alongside 'aps').
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (k !== 'aps') payload[k] = v;
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `bearer ${jwt}`,
        'apns-push-type': 'alert',
        'apns-priority': priority === 'high' ? '10' : '5',
        'apns-topic': apnsBundleId!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log(`[Backend APNs] Push accepted for token ${token.slice(0, 12)}... (${apnsSandbox ? 'sandbox' : 'production'})`);
      return true;
    } else {
      const text = await res.text();
      console.warn(`[Backend APNs] Push rejected: ${res.status} ${text.slice(0, 300)}`);

      // If we get a 403 withExpiredProviderToken, refresh the JWT and retry once.
      if (res.status === 403 && text.includes('ExpiredProviderToken')) {
        apnsJwtCache = null;
        apnsJwtExpiry = 0;
        const newJwt = await getApnsProviderToken();
        if (newJwt) {
          const retryRes = await fetch(url, {
            method: 'POST',
            headers: {
              authorization: `bearer ${newJwt}`,
              'apns-push-type': 'alert',
              'apns-priority': priority === 'high' ? '10' : '5',
              'apns-topic': apnsBundleId!,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          if (retryRes.ok) {
            console.log(`[Backend APNs] Retry succeeded for token ${token.slice(0, 12)}...`);
            return true;
          } else {
            const retryText = await retryRes.text();
            console.warn(`[Backend APNs] Retry also failed: ${retryRes.status} ${retryText.slice(0, 200)}`);
          }
        }
      }

      // If sandbox fails with DeviceTokenNotForTopic, try production and vice versa.
      if (res.status === 400 && text.includes('DeviceTokenNotForTopic')) {
        const altHost = apnsSandbox
          ? 'https://api.push.apple.com'
          : 'https://api.sandbox.push.apple.com';
        console.warn(`[Backend APNs] Token mismatch — trying ${apnsSandbox ? 'production' : 'sandbox'} APNs...`);
        const altRes = await fetch(`${altHost}/3/device/${token}`, {
          method: 'POST',
          headers: {
            authorization: `bearer ${jwt}`,
            'apns-push-type': 'alert',
            'apns-priority': priority === 'high' ? '10' : '5',
            'apns-topic': apnsBundleId!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (altRes.ok) {
          console.log(`[Backend APNs] Alternate APNs endpoint accepted push for ${token.slice(0, 12)}...`);
          return true;
        } else {
          const altText = await altRes.text();
          console.warn(`[Backend APNs] Alternate endpoint also rejected: ${altRes.status} ${altText.slice(0, 200)}`);
        }
      }

      return false;
    }
  } catch (e) {
    console.warn(`[Backend APNs] Send error for token ${token.slice(0, 12)}...:`, e);
    return false;
  }
}

/**
 * Determine if a token is a raw APNs token (hex string, typically 64 chars
 * on iOS). These need to be converted to FCM registration tokens before
 * we can send via FCM.
 */
function isApnsToken(token: string): boolean {
  // Expo push tokens start with 'ExponentPushToken'
  if (token.startsWith('ExponentPushToken')) return false;
  // FCM tokens contain colons or are very long (>100 chars)
  // APNs tokens are hex strings (0-9a-f), typically 64 chars
  return /^[0-9a-fA-F]{32,}$/.test(token);
}

// ---------------------------------------------------------------------------
// Messaging — FCM HTTP v1 API
// Sends data-only messages so the service worker's onBackgroundMessage
// handler has full control over notification display (no duplicates).
// Handles FCM tokens directly, and converts APNs tokens to FCM first.
// ---------------------------------------------------------------------------

interface MulticastResponse {
  responses: Array<{ success: boolean; error?: any }>;
}

class Messaging {
  async sendEachForMulticast(params: {
    tokens: string[];
    notification: { title: string; body: string };
    data?: Record<string, string>;
    android?: { priority: string };
  }): Promise<MulticastResponse> {
    if (!projId) throw new Error("Project ID not configured");
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error("No access token available");

    // Merge notification title/body into data for data-only web push.
    const fullData: Record<string, string> = {
      title: params.notification.title,
      body: params.notification.body,
      ...(params.data || {}),
    };

    const responses: Array<{ success: boolean; error?: any }> = [];

    // Separate tokens by type: APNs tokens go via direct APNs, FCM tokens via FCM API.
    const apnsTokens: string[] = [];
    const fcmTokens: string[] = [];

    for (const tok of params.tokens) {
      if (isApnsToken(tok)) {
        apnsTokens.push(tok);
      } else {
        fcmTokens.push(tok);
      }
    }

    // Send APNs tokens directly via APNs HTTP/2 API (no FCM conversion needed).
    if (apnsTokens.length > 0) {
      if (apnsConfigured) {
        console.log(`[Backend Messaging] Sending ${apnsTokens.length} push(es) via direct APNs`);
        await Promise.all(
          apnsTokens.map(async (tok) => {
            const success = await sendApnsPush({
              token: tok,
              title: params.notification.title,
              body: params.notification.body,
              data: fullData,
              priority: params.android?.priority || 'high',
            });
            responses.push({ success, error: success ? undefined : new Error(`APNs push failed for ${tok.slice(0, 12)}...`) });
          }),
        );
      } else {
        console.warn(`[Backend Messaging] ${apnsTokens.length} APNs token(s) but direct APNs not configured — set APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY env vars`);
        for (const tok of apnsTokens) {
          responses.push({ success: false, error: new Error('Direct APNs not configured — set APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY') });
        }
      }
    }

    // Send FCM tokens via FCM HTTP v1 API.
    if (fcmTokens.length > 0) {
      await Promise.all(
        fcmTokens.map(async (tok) => {
          try {
            const message: Record<string, any> = {
              token: tok,
              data: fullData,
              android: { priority: params.android?.priority || "high" },
              webpush: {
                headers: {
                  Urgency: "high",
                  TTL: "86400",
                },
              },
            };

            const res = await fetch(
              `https://fcm.googleapis.com/v1/projects/${projId}/messages:send`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ message }),
              },
            );

            if (res.ok) {
              responses.push({ success: true });
            } else {
              const text = await res.text();
              responses.push({ success: false, error: new Error(text) });
            }
          } catch (e) {
            responses.push({ success: false, error: e });
          }
        }),
      );
    }

    return { responses };
  }
}

// ---------------------------------------------------------------------------
// Exports — compatible with push-service, hono, db, and groups consumers
// ---------------------------------------------------------------------------

const database = isConfigured ? new Database() : null;
const messaging = isConfigured ? new Messaging() : null;

// One-time startup diagnostic: test DB access and log the result.
if (isConfigured && database) {
  (async () => {
    try {
      const snap = await database.ref('groups').get();
      console.log(
        `[Backend Firebase] Startup DB test OK — groups exists: ${snap.exists()}, count: ${snap.exists() ? Object.keys(snap.val() || {}).length : 0}`,
      );
    } catch (e: any) {
      console.error(
        `[Backend Firebase] Startup DB test FAILED: ${String(e).slice(0, 400)}`,
      );
      console.error(
        `[Backend Firebase] DB URL: ${dbURL?.slice(0, 80)}... | Project: ${projId}`,
      );
    }
  })();
}

// Accessor functions for diagnostics endpoints.
export function getDbUrl(): string | null {
  return dbURL ?? null;
}
export function getProjId(): string | null {
  return projId;
}

export { database, messaging, isConfigured, isApnsToken, sendApnsPush };
