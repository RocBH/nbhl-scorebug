import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getControlUser } from "@/lib/control-access";
import ExcelDownloads from "@/components/excel-downloads";
export const dynamic = "force-dynamic";
export default async function DownloadsPage() {
  const identity=await requireChatGPTUser("/downloads");
  if (!(await getControlUser(identity))) return <main className="control-page"><section className="control-card"><h1>Access required</h1><p>Ask an admin to add your account to the control board.</p><a href="/control">Back to control board</a></section></main>;
  return <ExcelDownloads />;
}
