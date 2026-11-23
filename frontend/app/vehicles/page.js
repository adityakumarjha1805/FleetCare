import VehicleManagement from "../../components/vehicle-management";

export const metadata = {
  title: "Vehicles | Telfay",
  description: "Search, manage, and register vehicles in your Telfay fleet.",
};

export const instant = false;

export default function VehiclesPage() {
  return <VehicleManagement />;
}
