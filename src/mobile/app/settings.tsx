import { PermissionScreen } from "../components/PermissionScreen";
import { permissionService } from "../services/permissionService";

export interface SettingsScreen {
  title: string;
  permissions: ReturnType<typeof PermissionScreen>;
  error: string | null;
}

export default async function Settings(): Promise<SettingsScreen> {
  try {
    const [notifications, network] = await Promise.all([
      permissionService.check("notifications"),
      permissionService.check("network"),
    ]);
    return {
      title: "Settings",
      permissions: PermissionScreen(notifications && network),
      error: null,
    };
  } catch (error) {
    return {
      title: "Settings",
      permissions: PermissionScreen(false),
      error: error instanceof Error ? error.message : "Unable to check permissions",
    };
  }
}
