import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { groupsRouter } from "./routes/groups";
import { notificationsRouter } from "./routes/notifications";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  groups: groupsRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
