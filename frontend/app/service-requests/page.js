import ServiceRequestManagement from "../../components/service-request-management";

export const instant = false;

export const metadata = {
  title: "Service Requests | Telfay",
  description:
    "Create and track fleet vehicle service requests with Telfay.",
};

export default function ServiceRequestsPage() {
  return <ServiceRequestManagement />;
}
