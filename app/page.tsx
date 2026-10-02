import { redirect } from "next/navigation";
import { chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import Crm from "./crm";

export default async function Page() {
  const user = await getChatGPTUser();
  if (!user) redirect("/login");

  return <Crm signOutHref={chatGPTSignOutPath("/login")} />;
}
