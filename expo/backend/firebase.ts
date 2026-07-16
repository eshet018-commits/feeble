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
 * Push notifications use the FCM HTTP v1 API.
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
    );
  } else {
    console.warn(
      "[Backend Firebase] Missing FIREBASE_SERVICE_ACCOUNT_KEY or database URL — push service disabled",
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
  // Extract only the base64 content between PEM headers. The previous regex
  // /[^A-Za-z0-9+/=]/g kept header text like "BEGINPRIVATEKEY" (all letters
  // are valid base64 chars), corrupting the decoded key.
  const match = pem.match(
    /-----BEGIN[^-]*-----\s*([A-Za-z0-9+/=\s]+?)\s*-----END[^-]*-----/,
  );
  let b64: string;
  if (match) {
    b64 = match[1].replace(/[^A-Za-z0-9+/=]/g, "");
  } else {
    // Fallback: strip known PEM markers then filter to base64 only.
    b64 = pem
      .replace(/-----BEGIN[^-]*-----/g, "")
      .replace(/-----END[^-]*-----/g, "")
      .replace(/[^A-Za-z0-9+/=]/g, "");
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
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
      scope:
        "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/firebase.messaging",
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

const POLL_FALLBACK_INTERVAL = 3000; // 3 seconds (only used if SSE fails)
const SSE_RECONNECT_DELAY = 2000; // reconnect after 2s on stream drop

class DatabaseRef {
  private listening = false;
  private abortController: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSerialized: string | undefined;

  constructor(private path: string) {}

  private url(): string {
    return `${dbURL}/${this.path}.json`;
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
      throw new Error(`DB ${method} ${this.path}: 401 Unauthorized`);
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

        const serialized = JSON.stringify(value);
        if (serialized !== this.lastSerialized) {
          this.lastSerialized = serialized;
          callback(new DataSnapshot(value));
        }
      } catch (e) {
        if (this.listening && errorCallback) errorCallback(e);
      }

      if (this.listening) {
        this.pollTimer = setTimeout(poll, POLL_FALLBACK_INTERVAL);
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
// Messaging — FCM HTTP v1 API
// Sends data-only messages so the service worker's onBackgroundMessage
// handler has full control over notification display (no duplicates).
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
    const token = await getAccessToken();
    if (!token) throw new Error("No access token available");

    // Merge notification title/body into data for data-only web push.
    // The service worker extracts title/body from payload.data.
    const fullData: Record<string, string> = {
      title: params.notification.title,
      body: params.notification.body,
      ...(params.data || {}),
    };

    const responses: Array<{ success: boolean; error?: any }> = [];

    await Promise.all(
      params.tokens.map(async (tok) => {
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
                Authorization: `Bearer ${token}`,
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

    return { responses };
  }
}

// ---------------------------------------------------------------------------
// Exports — compatible with push-service, hono, db, and groups consumers
// ---------------------------------------------------------------------------

const database = isConfigured ? new Database() : null;
const messaging = isConfigured ? new Messaging() : null;

export { database, messaging, isConfigured };
