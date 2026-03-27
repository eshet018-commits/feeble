import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { groupsRouter } from "./routes/groups";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  groups: groupsRouter,
});

export type AppRouter = typeof appRouter;
