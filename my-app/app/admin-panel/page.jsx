import "./admin-panel.css";
import AdminPanelClient from "./AdminPanelClient";

export const metadata = {
  title: "Mapka — Admin: Clubs",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminPanelClient />;
}
