import PartsManagement from "../../components/parts-management";

export const instant = false;

export const metadata = {
  title: "Parts Management | FleetCare",
  description: "Browse parts and manage organization parts requests.",
};

export default function PartsPage() {
  return <PartsManagement />;
}
