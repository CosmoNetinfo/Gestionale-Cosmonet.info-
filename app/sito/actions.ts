"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markReviewed } from "@/lib/supabase";

export async function segnaRivisto(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  try {
    await markReviewed(id);
  } catch (e) {
    const m = e instanceof Error ? e.message : "errore";
    redirect(`/sito/${id}?errore=${encodeURIComponent(m)}`);
  }
  revalidatePath("/sito");
  revalidatePath(`/sito/${id}`);
  revalidatePath("/");
}
