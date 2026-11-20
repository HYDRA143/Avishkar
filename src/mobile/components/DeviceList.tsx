import type { Device } from "../hooks/useDeviceUsage";

export interface DeviceListModel {
  title: string;
  empty: boolean;
  message: string | null;
  items: ReadonlyArray<{ id: string; label: string; detail: string }>;
}

export const DeviceList = (devices: ReadonlyArray<Device>): DeviceListModel => ({
  title: "Devices",
  empty: devices.length === 0,
  message: devices.length === 0 ? "No data yet" : null,
  items: devices.map((device) => ({
    id: device.id,
    label: device.name,
    detail: [
      device.address,
      device.connected === undefined ? undefined : device.connected ? "Connected" : "Disconnected",
    ].filter((value): value is string => Boolean(value)).join(" · "),
  })),
});
