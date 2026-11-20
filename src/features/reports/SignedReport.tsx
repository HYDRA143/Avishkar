export interface SignedReportData {
  signature: string;
  verified: boolean;
  report: Record<string, unknown>;
}

export interface SignedReportView {
  label: string;
  color: "green" | "red" | "neutral";
  report: Record<string, unknown> | null;
}

export const SignedReport = (data: SignedReportData | null): SignedReportView => {
  if (data === null) {
    return { label: "No report yet", color: "neutral", report: null };
  }
  if (!data.signature.trim()) {
    return { label: "Tampered", color: "red", report: data.report };
  }
  return {
    label: data.verified ? "✓ Verified" : "Tampered",
    color: data.verified ? "green" : "red",
    report: data.report,
  };
};
