import MaintenanceManagement from "../../components/maintenance-management";

export const instant = false;

export const metadata = {
  title: "Maintenance | FleetCare",
  description:
    "Track upcoming, overdue, and completed vehicle maintenance records.",
};

export default function MaintenancePage() {
  return <MaintenanceManagement />;
}
