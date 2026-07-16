import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { startPushService } from "./push-service";
import { messaging, isConfigured, isApnsToken } from "./firebase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const app = new Hono();

app.use("*", cors());

/**
 * REST push endpoint — forwards push notifications to the appropriate service:
 *   - FCM tokens (web) via Firebase Admin SDK messaging
 *   - Expo push tokens (native) via the Expo Push API
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
    // raw APNs tokens) goes through FCM messaging, which auto-converts
    // APNs tokens via Instance ID batchImport.
    const expoMessages = messages.filter((m: any) => isExpoToken(m.to));
    const fcmOrApnsMessages = messages.filter((m: any) => !isExpoToken(m.to));

    const apnsCount = fcmOrApnsMessages.filter((m: any) => isApnsToken(m.to)).length;
    const fcmCount = fcmOrApnsMessages.length - apnsCount;
    if (fcmOrApnsMessages.length > 0) {
      console.log(`[PushEndpoint] Token breakdown: ${fcmCount} FCM, ${apnsCount} APNs, ${expoMessages.length} Expo`);
    }

    let sent = 0;

    // Send FCM/APNs pushes via backend messaging (handles APNs→FCM conversion).
    if (fcmOrApnsMessages.length > 0 && messaging) {
      const tokens = fcmOrApnsMessages.map((m: any) => m.to);
      const batchChunks: string[][] = [];
      for (let i = 0; i < tokens.length; i += 500) {
        batchChunks.push(tokens.slice(i, i + 500));
      }

      for (const chunk of batchChunks) {
        // Use the first message's title/body/data (all messages in a batch
        // have the same content, just different recipients).
        const msg = fcmOrApnsMessages[0];
        const data: Record<string, string> = {};
        if (msg.data) {
          for (const [k, v] of Object.entries(msg.data)) {
            data[k] = typeof v === "string" ? v : JSON.stringify(v);
          }
        }

        try {
          const response = await messaging.sendEachForMulticast({
            tokens: chunk,
            notification: { title: msg.title, body: msg.body },
            data,
            android: { priority: "high" },
          });
          for (const r of response.responses) {
            if (r.success) sent++;
          }
        } catch (error) {
          console.warn("[PushEndpoint] FCM send failed:", error);
        }
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
          }
          if (Array.isArray(json?.data)) {
            for (const ticket of json.data) {
              if (ticket?.status !== "error") sent++;
            }
          }
        } catch (error) {
          console.warn("[PushEndpoint] Expo push failed:", error);
        }
      }
    }

    return c.json({ success: true, sent });
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
  return c.json({ status: "ok", message: "API is running", pushService: isConfigured });
});

export default app;
