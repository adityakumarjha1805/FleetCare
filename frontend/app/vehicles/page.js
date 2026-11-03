import VehicleManagement from "../../components/vehicle-management";

export const metadata = {
  title: "Vehicles | FleetCare",
  description: "Search, manage, and register vehicles in your FleetCare fleet.",
};

export const instant = false;

export default function VehiclesPage() {
  return <VehicleManagement />;
}
