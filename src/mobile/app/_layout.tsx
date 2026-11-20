export interface MobileRoute {
  name: string;
  path: string;
  title: string;
}

export interface MobileLayout {
  initialRoute: string;
  routes: ReadonlyArray<MobileRoute>;
}

const routes: ReadonlyArray<MobileRoute> = [
  { name: "Home", path: "/", title: "NetGuard" },
  { name: "Graph", path: "/graph", title: "Usage graph" },
  { name: "Reports", path: "/reports", title: "Reports" },
  { name: "Status", path: "/status", title: "System status" },
  { name: "Settings", path: "/settings", title: "Settings" },
];

export default function MobileLayout(): MobileLayout {
  return { initialRoute: "/", routes };
}
