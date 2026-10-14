import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getControlUser, isControlAdmin } from "@/lib/control-access";
import AdminUsers from "@/components/admin-users";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const identity = await requireChatGPTUser("/admin");
  const user = await getControlUser(identity);
  if (!isControlAdmin(user)) return <main className="control-page"><section className="control-card"><h1>Admin access required</h1><p>Your account does not have permission to manage users.</p><a href="/control">Back to control board</a></section></main>;
  return <AdminUsers currentEmail={identity.email.toLowerCase()} />;
}
