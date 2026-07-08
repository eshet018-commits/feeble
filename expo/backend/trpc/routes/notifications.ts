import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Backend router for remote push notifications.
 *
 * The Expo Push API (exp.host) does NOT send CORS headers, so a direct
 * `fetch` from the browser (where the Rork web preview runs) always fails
 * with a TypeError. By proxying the request through this server-side
 * mutation, we bypass CORS entirely — the server has no same-origin
 * restriction and can POST to exp.host freely.
 */
export const notificationsRouter = createTRPCRouter({
  /**
   * Send remote push notifications to a list of Expo push tokens.
   * Called from the client via tRPC so the browser never touches exp.host.
   */
  send: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            to: z.string(),
            title: z.string(),
            body: z.string(),
            data: z.record(z.string(), z.any()).optional(),
            sound: z.union([z.boolean(), z.string()]).optional(),
            badge: z.number().optional(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.messages.length === 0) return { success: true, sent: 0 };

      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input.messages),
        });
        const json = (await res.json()) as any;

        if (json?.errors) {
          console.warn("[Notifications] Expo Push API errors:", json.errors);
        }
        if (Array.isArray(json?.data)) {
          for (const ticket of json.data) {
            if (ticket?.status === "error") {
              console.warn(
                "[Notifications] Push ticket error:",
                ticket.message,
              );
            }
          }
        }
        return { success: true, sent: input.messages.length };
      } catch (error) {
        console.error("[Notifications] Backend send failed:", error);
        return { success: false, sent: 0, error: String(error) };
      }
    }),
});
