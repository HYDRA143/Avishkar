export type PermissionName = "notifications" | "network";

interface PermissionBridge {
  check(name: PermissionName): Promise<boolean>;
  request?(name: PermissionName): Promise<boolean>;
}

const bridge = (): PermissionBridge | undefined =>
  (globalThis as typeof globalThis & { __NETGUARD_PERMISSION_BRIDGE__?: PermissionBridge })
    .__NETGUARD_PERMISSION_BRIDGE__;

const check = async (name: PermissionName): Promise<boolean> => {
  const native = bridge();
  if (native) return native.check(name);
  if (name === "notifications" && "Notification" in globalThis) {
    return Notification.permission === "granted";
  }
  return false;
};

const request = async (name: PermissionName): Promise<boolean> => {
  const native = bridge();
  if (native?.request) return native.request(name);
  if (name === "notifications" && "Notification" in globalThis) {
    return (await Notification.requestPermission()) === "granted";
  }
  return false;
};

export const permissionService = { check, request };
