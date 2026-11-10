"use server";

import { revalidatePath } from "next/cache";
import { agendaComplete } from "@/lib/agenda";

export async function fatto(fd: FormData) {
  await agendaComplete(String(fd.get("id")));
  revalidatePath("/agenda");
}
