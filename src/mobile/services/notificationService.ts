interface NotificationBridge {
  notify(message: string): Promise<void>;
}

const nativeBridge = (): NotificationBridge | undefined =>
  (globalThis as typeof globalThis & { __NETGUARD_NOTIFICATION_BRIDGE__?: NotificationBridge })
    .__NETGUARD_NOTIFICATION_BRIDGE__;

const notify = async (message: string): Promise<void> => {
  if (!message.trim()) throw new Error("Notification message is required");
  const native = nativeBridge();
  if (native) {
    await native.notify(message);
    return;
  }
  if ("Notification" in globalThis && Notification.permission === "granted") {
    new Notification("NetGuard", { body: message });
    return;
  }
  throw new Error("Notification permission is not available");
};

export const notificationService = { notify };
