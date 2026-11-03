import AIDiagnosticAgent from "../../components/ai-diagnostic-agent";

export const instant = false;

export const metadata = {
  title: "AI Diagnostic Agent | FleetCare",
  description:
    "Review clearly labeled sample diagnostic explanations and maintenance suggestions.",
};

export default function AIDiagnosticAgentPage() {
  return <AIDiagnosticAgent />;
}
