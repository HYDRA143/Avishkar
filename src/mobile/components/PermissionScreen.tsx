export interface PermissionScreenModel {
  title: string;
  granted: boolean;
  message: string;
  actionLabel: string;
  canContinue: boolean;
}

export const PermissionScreen = (granted: boolean): PermissionScreenModel => ({
  title: "Permissions",
  granted,
  message: granted
    ? "Required permissions are available."
    : "Allow notifications and network access to receive NetGuard updates.",
  actionLabel: granted ? "Permissions ready" : "Grant permissions",
  canContinue: granted,
});

export const permissionStatusText = (screen: PermissionScreenModel): string =>
  screen.canContinue ? "Ready to continue" : "Action required";

export const requiresPermissionAction = (screen: PermissionScreenModel): boolean =>
  !screen.canContinue;
