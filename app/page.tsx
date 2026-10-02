import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Crm from "./crm";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await getCurrentUser())) redirect("/login");

  return <Crm />;
}
