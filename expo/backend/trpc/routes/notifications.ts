import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";
import { messaging, isConfigured } from "../../firebase";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Backend router for remote push notifications.
 *
 * Handles two types of push tokens:
 *   - FCM tokens (web) — sent via Firebase Cloud Messaging HTTP v1 API
 *   - Expo push tokens (native iOS/Android) — sent via the Expo Push API
 *
 * The Expo Push API and FCM API don't send CORS headers, so browsers
 * can't POST to them directly. By proxying through this server-side
 * mutation, we bypass CORS entirely.
 */
export const notificationsRouter = createTRPCRouter({
  /**
   * Send remote push notifications to a list of push tokens.
   * FCM tokens (web) are sent via FCM; Expo tokens (native) via Expo Push API.
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

      const isExpoToken = (t: string) => t.startsWith("ExponentPushToken");
      const expoMessages = input.messages.filter((m) => isExpoToken(m.to));
      const fcmMessages = input.messages.filter((m) => !isExpoToken(m.to));

      let sent = 0;

      // Send FCM pushes (web tokens) via the FCM HTTP v1 API.
      if (fcmMessages.length > 0 && messaging && isConfigured) {
        try {
          const tokens = fcmMessages.map((m) => m.to);
          const firstMsg = fcmMessages[0];

          // Build data payload — data-only messages give the service worker
          // full control over notification display (no duplicates).
          const data: Record<string, string> = {
            title: firstMsg.title,
            body: firstMsg.body,
          };
          if (firstMsg.data) {
            for (const [k, v] of Object.entries(firstMsg.data)) {
              data[k] = typeof v === "string" ? v : JSON.stringify(v);
            }
          }

          const response = await messaging.sendEachForMulticast({
            tokens,
            notification: { title: firstMsg.title, body: firstMsg.body },
            data,
            android: { priority: "high" },
          });

          for (const r of response.responses) {
            if (r.success) sent++;
          }
        } catch (error) {
          console.warn("[Notifications] FCM send failed:", error);
        }
      }

      // Send Expo pushes (native tokens) via the Expo Push API.
      if (expoMessages.length > 0) {
        try {
          const res = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(expoMessages),
          });
          const json = (await res.json()) as any;

          if (json?.errors) {
            console.warn("[Notifications] Expo Push API errors:", json.errors);
          }
          if (Array.isArray(json?.data)) {
            for (const ticket of json.data) {
              if (ticket?.status !== "error") sent++;
            }
          }
        } catch (error) {
          console.warn("[Notifications] Expo push failed:", error);
        }
      }

      return { success: true, sent };
    }),
});
