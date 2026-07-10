import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminHomeCmsIndexPage() {
  redirect("/admin/home/hero");
}
