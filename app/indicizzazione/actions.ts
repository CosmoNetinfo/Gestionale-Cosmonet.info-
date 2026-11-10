"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { submitSitemap } from "@/lib/gsc";

export async function inviaSitemap(formData: FormData) {
  const path = String(formData.get("path") ?? "").trim();
  const r = await submitSitemap(path);
  revalidatePath("/indicizzazione");
  redirect(`/indicizzazione?${r.ok ? "ok" : "errore"}=${encodeURIComponent(r.message)}`);
}
