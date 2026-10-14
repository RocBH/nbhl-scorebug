import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getControlUser, isControlAdmin } from "@/lib/control-access";
import ControlPanel from "@/components/control-panel";

export const dynamic = "force-dynamic";

export default async function ControlPage() {
  const user = await requireChatGPTUser("/control");
  const member = await getControlUser(user);
  if (!member) return <main className="control-page"><section className="control-card"><h1>Access required</h1><p>Ask an admin to add {user.email} to the control board.</p><a href="/signout-with-chatgpt?return_to=%2Fcontrol" target="_top">Sign in with another account</a></section></main>;
  return <ControlPanel displayName={user.displayName} isAdmin={isControlAdmin(member)} />;
}
