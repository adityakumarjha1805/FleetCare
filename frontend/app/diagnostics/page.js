import DiagnosticManagement from "../../components/diagnostic-management";

export const instant = false;

export const metadata = {
  title: "Diagnostics | FleetCare",
  description:
    "Review vehicle diagnostic trouble codes and manage sample fleet fault records.",
};

export default function DiagnosticsPage() {
  return <DiagnosticManagement />;
}
