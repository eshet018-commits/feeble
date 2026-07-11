import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { startPushService } from "./push-service";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const app = new Hono();

app.use("*", cors());

// Simple REST push endpoint — more reliable than tRPC for a single fire-and-
// forget proxy. The Expo Push API doesn't send CORS headers, so browsers
// can't POST to it directly. This endpoint forwards the request server-side.
app.post("/api/push", async (c) => {
  try {
    const body = await c.req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    if (messages.length === 0) {
      return c.json({ success: true, sent: 0 });
    }

    // Batch in groups of 100 (Expo Push API limit per request).
    let sent = 0;
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
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
          if (ticket?.status === "error") {
            console.warn("[PushEndpoint] Ticket error:", ticket.message, ticket.details);
          } else {
            sent++;
          }
        }
      }
    }
    return c.json({ success: true, sent });
  } catch (error) {
    console.warn("[PushEndpoint] Failed:", error);
    return c.json({ success: false, sent: 0, error: String(error) }, 500);
  }
});

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    onError({ error, path }) {
      console.error(`tRPC Error on ${path}:`, error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        cause: error.cause,
        stack: error.stack,
      });
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

// Start the backend push notification service — listens to Firebase for
// new chat messages, announcements, and events, and sends real Expo push
// notifications to group members' devices. This runs on the always-on backend
// so notifications are delivered even when no client app is open.
// The backend authenticates to Firebase using a custom token minted from the
// service account key, bypassing all security rules.
startPushService();

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
