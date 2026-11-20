import { useReports } from "../hooks/useReports";

export interface ReportsScreen {
  title: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  message: string | null;
  reports: Awaited<ReturnType<typeof useReports>>["reports"];
}

export default async function Reports(): Promise<ReportsScreen> {
  const state = await useReports();
  return {
    title: "Reports",
    loading: state.loading,
    error: state.error,
    empty: state.reports.length === 0,
    message: state.reports.length === 0 ? "No data yet" : null,
    reports: state.reports,
  };
}
