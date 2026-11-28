import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateUsageTotals,
  counterDelta,
  evaluateUsageAlerts,
  type UsageAlertSettings,
  type UsageSample,
} from "./usageMetrics.ts";

const current = new Date(2026, 10, 28, 12, 30).getTime();
const dayStart = new Date(2026, 10, 28).getTime();
const yesterdayStart = new Date(2026, 10, 27).getTime();
const hourStart = new Date(2026, 10, 28, 12).getTime();

const settings: UsageAlertSettings = {
  enabled: true,
  hourlyCapBytes: 50,
  dailyCapBytes: 100,
  weeklyCapBytes: 120,
  anomalyEnabled: true,
  anomalyMultiplier: 2,
};

test("counter resets are not counted as negative or invented usage", () => {
  assert.equal(counterDelta(900, 100), 0);
  assert.equal(counterDelta(100, 150), 50);
  assert.throws(() => counterDelta(-1, 1), RangeError);
});

test("usage totals use local hour, day, week, and previous-day windows", () => {
  const samples: UsageSample[] = [
    { at: hourStart + 1, bytes: 10, gapMs: 60_000 },
    { at: dayStart + 1, bytes: 20, gapMs: 60_000 },
    { at: yesterdayStart + 1, bytes: 30, gapMs: 60_000 },
  ];
  const totals = calculateUsageTotals(samples, current);
  assert.deepEqual(totals, {
    hourlyBytes: 10,
    dailyBytes: 30,
    weeklyBytes: 60,
    previousDayBytes: 30,
  });
});

test("caps and a 2x daily increase alert once per period", () => {
  const samples: UsageSample[] = [
    { at: yesterdayStart + 1, bytes: 30, gapMs: 60_000 },
    { at: dayStart + 1, bytes: 70, gapMs: 60_000 },
    { at: hourStart + 1, bytes: 70, gapMs: 60_000 },
  ];
  const alerts = evaluateUsageAlerts(samples, settings, current, new Set());
  assert.deepEqual(alerts.map((alert) => alert.period), ["hourly", "daily", "weekly", "anomaly"]);
  const repeated = evaluateUsageAlerts(
    samples,
    settings,
    current,
    new Set(alerts.map((alert) => alert.id)),
  );
  assert.deepEqual(repeated, []);
});

test("no anomaly is inferred without a measured prior-day baseline", () => {
  const samples: UsageSample[] = [
    { at: dayStart + 1, bytes: 800, gapMs: 60_000 },
  ];
  const alerts = evaluateUsageAlerts(samples, settings, current, new Set());
  assert.equal(alerts.some((alert) => alert.period === "anomaly"), false);
});
