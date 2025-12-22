import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

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

app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;
