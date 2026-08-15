import { Notification } from "../models/Notification.js";

export async function notify(input: {
  userId: string;
  title: string;
  body: string;
  href?: string;
}): Promise<void> {
  if (!input.userId) return;
  try {
    await Notification.create({
      userId: input.userId,
      title: input.title,
      body: input.body,
      href: input.href ?? "/home",
      read: false,
    });
  } catch (error) {
    console.error("[notify] Failed to create notification:", error);
  }
}
