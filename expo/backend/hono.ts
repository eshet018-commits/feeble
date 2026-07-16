import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { startPushService } from "./push-service";
import { messaging, database, isConfigured, isApnsToken, sendApnsPush, getDbUrl, getProjId } from "./firebase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const app = new Hono();

app.use("*", cors());

/**
 * REST push endpoint — forwards push notifications to the appropriate service:
 *   - FCM tokens (web) via FCM HTTP v1 API
 *   - APNs tokens (iOS) via direct APNs HTTP/2 API using .p8 key
 *   - Expo push tokens (legacy) via the Expo Push API
 *
 * The Expo Push API and FCM API don't send CORS headers, so browsers can't
 * POST to them directly. This endpoint forwards the request server-side.
 *
 * Note: The Hono app is mounted at /api, so this route is /api/push.
 */
app.post("/push", async (c) => {
  try {
    const body = await c.req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return c.json({ success: true, sent: 0 });
    }

    const isExpoToken = (t: string) => t.startsWith("ExponentPushToken");
    // Expo tokens go to the Expo Push API; everything else (FCM tokens AND
    // raw APNs tokens) goes through the backend messaging class, which sends
    // APNs tokens directly via APNs HTTP/2 and FCM tokens via FCM HTTP v1.
    const expoMessages = messages.filter((m: any) => isExpoToken(m.to));
    const fcmOrApnsMessages = messages.filter((m: any) => !isExpoToken(m.to));

    const apnsCount = fcmOrApnsMessages.filter((m: any) => isApnsToken(m.to)).length;
    const fcmCount = fcmOrApnsMessages.length - apnsCount;
    if (fcmOrApnsMessages.length > 0) {
      console.log(`[PushEndpoint] Token breakdown: ${fcmCount} FCM, ${apnsCount} APNs, ${expoMessages.length} Expo`);
    }

    let sent = 0;
    const errors: string[] = [];

    // Send pushes — APNs tokens go directly via APNs HTTP/2 (bypasses
    // Firebase entirely), FCM tokens go via FCM HTTP v1 API.
    // This decoupling ensures APNs pushes work even if Firebase auth is broken.
    if (fcmOrApnsMessages.length > 0) {
      const msg = fcmOrApnsMessages[0];
      const data: Record<string, string> = {};
      if (msg.data) {
        for (const [k, v] of Object.entries(msg.data)) {
          data[k] = typeof v === "string" ? v : JSON.stringify(v);
        }
      }

      // Separate APNs tokens from FCM tokens.
      const apnsTokens: string[] = [];
      const fcmTokens: string[] = [];
      for (const m of fcmOrApnsMessages) {
        if (isApnsToken(m.to)) apnsTokens.push(m.to);
        else fcmTokens.push(m.to);
      }

      // Send APNs tokens directly — no Firebase dependency at all.
      if (apnsTokens.length > 0) {
        console.log(`[PushEndpoint] Sending ${apnsTokens.length} push(es) via direct APNs (bypassing Firebase)`);
        await Promise.all(
          apnsTokens.map(async (tok) => {
            try {
              const success = await sendApnsPush({
                token: tok,
                title: msg.title,
                body: msg.body,
                data,
                priority: 'high',
              });
              if (success) sent++;
              else errors.push(`APNs push failed for ${tok.slice(0, 12)}...`);
            } catch (e) {
              errors.push(`APNs error: ${String(e).slice(0, 200)}`);
            }
          }),
        );
      }

      // Send FCM tokens via FCM HTTP v1 API (requires Firebase auth).
      if (fcmTokens.length > 0 && messaging) {
        try {
          const response = await messaging.sendEachForMulticast({
            tokens: fcmTokens,
            notification: { title: msg.title, body: msg.body },
            data,
            android: { priority: "high" },
          });
          for (const r of response.responses) {
            if (r.success) sent++;
            else if (r.error) errors.push(String(r.error).slice(0, 200));
          }
        } catch (error) {
          console.warn("[PushEndpoint] FCM send failed:", error);
          errors.push(String(error).slice(0, 200));
        }
      } else if (fcmTokens.length > 0 && !messaging) {
        errors.push("FCM messaging not configured (Firebase auth issue)");
      }
    }

    // Send Expo pushes via Expo Push API.
    if (expoMessages.length > 0) {
      for (let i = 0; i < expoMessages.length; i += 100) {
        const batch = expoMessages.slice(i, i + 100);
        try {
          const res = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(batch),
          });
          const json = (await res.json()) as any;
          if (json?.errors) {
            console.warn("[PushEndpoint] Expo Push API errors:", json.errors);
            for (const e of json.errors) {
              errors.push(`Expo Push API: ${typeof e === 'string' ? e : JSON.stringify(e).slice(0, 200)}`);
            }
          }
          if (Array.isArray(json?.data)) {
            for (const ticket of json.data) {
              if (ticket?.status === "error") {
                const ticketErr = ticket.message || ticket.details || 'Unknown Expo push ticket error';
                console.warn("[PushEndpoint] Push ticket error:", ticketErr);
                errors.push(`Expo ticket: ${String(ticketErr).slice(0, 200)}`);
              } else {
                sent++;
              }
            }
          }
        } catch (error) {
          console.warn("[PushEndpoint] Expo push failed:", error);
        }
      }
    }

    if (sent === 0 && errors.length > 0) {
      return c.json({ success: false, sent: 0, error: errors.join("; ") });
    }
    return c.json({ success: true, sent, ...(errors.length > 0 ? { warnings: errors } : {}) });
  } catch (error) {
    console.warn("[PushEndpoint] Failed:", error);
    return c.json({ success: false, sent: 0, error: String(error) }, 500);
  }
});

// tRPC routes — mounted at /api/trpc/* (Hono is mounted at /api).
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC Error on ${path}:`, error);
    },
    responseMeta() {
      return {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      };
    },
  }),
);

// Start the backend push notification service — uses Firebase Admin SDK
// to listen for new content and send FCM/Expo push notifications.
startPushService();

app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "API is running",
    pushService: isConfigured,
    dbConfigured: isConfigured,
    apnsConfigured: !!(process.env.APNS_KEY_ID && process.env.APNS_PRIVATE_KEY),
    hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    dbURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ? 'set' : 'not set',
  });
});

/** Diagnostic endpoint — tests DB access and APNs config in one call. */
app.get("/push-diagnostics", async (c) => {
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    firebase: {
      configured: isConfigured,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      dbURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ? 'set' : 'not set',
      projectId: getProjId(),
    },
    apns: {
      configured: !!(process.env.APNS_KEY_ID && process.env.APNS_PRIVATE_KEY),
      hasKeyId: !!process.env.APNS_KEY_ID,
      hasPrivateKey: !!process.env.APNS_PRIVATE_KEY,
      teamId: process.env.EXPO_PUBLIC_TEAM_ID ? 'set' : 'not set',
      bundleId: process.env.APNS_BUNDLE_ID || 'app.rork.feeble',
      sandbox: (process.env.APNS_SANDBOX || 'true') !== 'false',
    },
  };

  // Test DB read
  if (database) {
    try {
      const snap = await database.ref('groups').get();
      result.dbTest = {
        success: true,
        exists: snap.exists(),
        childCount: snap.exists() ? Object.keys(snap.val() || {}).length : 0,
      };
    } catch (error: any) {
      result.dbTest = {
        success: false,
        error: String(error).slice(0, 300),
      };
    }
  } else {
    result.dbTest = { success: false, error: 'database not initialized' };
  }

  return c.json(result);
});

export default app;
