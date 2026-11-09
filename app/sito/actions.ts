"use server";

import { revalidatePath } from "next/cache";
import { markReviewed } from "@/lib/supabase";

export async function segnaRivisto(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await markReviewed(id);
  revalidatePath("/sito");
  revalidatePath(`/sito/${id}`);
  revalidatePath("/");
}
