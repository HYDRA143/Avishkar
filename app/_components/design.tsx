import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { Animated, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export const COLORS = {
  blue: "#1A56DB",
  darkBlue: "#0B1B3A",
  gold: "#F5B301",
  background: "#070D1F",
  card: "#101A33",
  white: "#FFFFFF",
  secondary: "#94A3B8",
  green: "#22C55E",
  orange: "#F97316",
  red: "#EF4444",
  border: "rgba(148,163,184,0.16)",
};

export type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

export function AppIcon({
  name,
  size = 20,
  color = COLORS.secondary,
}: {
  name: MaterialIconName;
  size?: number;
  color?: string;
}) {
  return <MaterialIcons name={name} size={size} color={color} />;
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View style={styles.skeleton}>
      {Array.from({ length: lines }, (_, index) => (
        <Animated.View
          key={index}
          style={[styles.skeletonLine, { opacity, width: index === lines - 1 ? "62%" : "100%" }]}
        />
      ))}
    </View>
  );
}

export function AppHeader({
  back = false,
  liveStatus = "MONITOR",
}: {
  back?: boolean;
  liveStatus?: string;
}) {
  const statusColor = liveStatus === "OFFLINE"
    ? COLORS.red
    : liveStatus === "IDLE" || liveStatus === "PAUSED"
      ? COLORS.orange
      : COLORS.gold;
  return (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        {back ? (
          <Link href="/" asChild>
            <Pressable style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to devices">
              <AppIcon name="arrow-back" size={21} color={COLORS.white} />
            </Pressable>
          </Link>
        ) : null}
        <Image source={require("../../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>NetGuard</Text>
        <View style={styles.status}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{liveStatus}</Text>
        </View>
      </View>
      <Text style={styles.source}>Source: Main Network</Text>
      <View style={styles.divider} />
    </View>
  );
}

export function NetworkLineGraph({
  values,
  labels,
  color = COLORS.blue,
}: {
  values: ReadonlyArray<number>;
  labels: ReadonlyArray<string>;
  color?: string;
}) {
  const [width, setWidth] = useState(0);
  const height = 136;
  const onLayout = (event: LayoutChangeEvent): void => setWidth(event.nativeEvent.layout.width);
  const maximum = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: values.length < 2 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - (Math.max(0, value) / maximum) * (height - 16) - 8,
  }));
  const formatScale = (value: number): string =>
    value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M`
      : value >= 1_000 ? `${(value / 1_000).toFixed(1)}K`
        : `${Math.round(value)}`;

  return (
    <View style={styles.graphContainer}>
      <View style={styles.axisLabels}>
        <Text style={styles.axisText}>{formatScale(maximum)}</Text>
        <Text style={styles.axisText}>{formatScale(maximum / 2)}</Text>
        <Text style={styles.axisText}>0</Text>
      </View>
      <View style={styles.graphMain} onLayout={onLayout}>
        {[0, 0.5, 1].map((fraction) => (
          <View key={fraction} style={[styles.gridLine, { top: `${fraction * 100}%` }]} />
        ))}
        {points.slice(0, -1).map((point, index) => {
          const next = points[index + 1];
          if (!next) return null;
          const dx = next.x - point.x;
          const dy = next.y - point.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          return (
            <View
              key={`line-${index}`}
              style={[
                styles.graphSegment,
                {
                  left: (point.x + next.x) / 2 - length / 2,
                  top: (point.y + next.y) / 2 - 1,
                  width: length,
                  backgroundColor: color,
                  transform: [{ rotate: `${angle}rad` }],
                },
              ]}
            />
          );
        })}
        {points.map((point, index) => (
          <View
            key={`point-${index}`}
            style={[styles.graphPoint, { left: point.x - 4, top: point.y - 4, backgroundColor: color }]}
          />
        ))}
      </View>
      <View style={styles.graphLabels}>
        {labels.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.graphLabel} numberOfLines={1}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

export function ErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorCard}>
      <View style={styles.errorMessage}>
        <AppIcon name="error" size={22} color={COLORS.red} />
        <View style={styles.errorCopy}>
          <Text style={styles.errorTitle}>{title}</Text>
          <Text style={styles.errorText}>{message}</Text>
        </View>
      </View>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}>
        <Text style={styles.retryText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: { marginBottom: 18 },
  header: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 9 },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: COLORS.card },
  logo: { width: 32, height: 32 },
  brand: { flex: 1, color: COLORS.white, fontSize: 20, fontWeight: "800" },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.gold },
  statusText: { color: COLORS.gold, fontSize: 12, fontWeight: "700" },
  source: { marginTop: 6, color: COLORS.secondary, fontSize: 12 },
  divider: { height: 1, marginTop: 12, backgroundColor: COLORS.gold },
  graphContainer: { flexDirection: "row", alignItems: "stretch", minHeight: 170 },
  axisLabels: { width: 40, height: 132, justifyContent: "space-between", paddingVertical: 2 },
  axisText: { color: COLORS.secondary, fontSize: 12, textAlign: "right", paddingRight: 7 },
  graphMain: { flex: 1, height: 132, position: "relative", overflow: "hidden" },
  gridLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(148,163,184,0.15)" },
  graphSegment: { position: "absolute", height: 2 },
  graphPoint: { position: "absolute", width: 8, height: 8, borderRadius: 4 },
  graphLabels: { position: "absolute", left: 40, right: 0, bottom: 0, flexDirection: "row", justifyContent: "space-between", gap: 4 },
  graphLabel: { flex: 1, color: COLORS.secondary, fontSize: 12, textAlign: "center" },
  errorCard: { padding: 16, marginBottom: 14, borderRadius: 16, backgroundColor: "#2A111E", borderWidth: 1, borderColor: "rgba(239,68,68,0.5)" },
  errorMessage: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  errorCopy: { flex: 1 },
  errorTitle: { color: COLORS.red, fontSize: 14, fontWeight: "700" },
  errorText: { marginTop: 4, color: COLORS.secondary, fontSize: 12, lineHeight: 18 },
  retryButton: { minHeight: 42, alignItems: "center", justifyContent: "center", marginTop: 12, borderRadius: 12, backgroundColor: COLORS.blue },
  retryPressed: { opacity: 0.8 },
  retryText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  skeleton: { width: "100%", gap: 10, paddingVertical: 6 },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: "rgba(148,163,184,0.22)" },
});
