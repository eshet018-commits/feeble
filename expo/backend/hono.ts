import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { startPushService } from "./push-service";

const app = new Hono();

app.use("*", cors());

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
startPushService();

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
