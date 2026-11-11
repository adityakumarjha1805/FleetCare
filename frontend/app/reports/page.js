import ReportsManagement from "../../components/reports-management";

export const instant = false;

export const metadata = {
  title: "Reports & Analytics | FleetCare",
  description: "Review organization fleet and maintenance activity.",
};

export default function ReportsPage() {
  return <ReportsManagement />;
}
