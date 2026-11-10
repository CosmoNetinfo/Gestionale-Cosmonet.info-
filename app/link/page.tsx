import LinkScanner from "@/components/LinkScanner";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function LinkPage() {
  return (
    <>
      <PageHeader title="Link e immagini" subtitle="Trova link che non funzionano e immagini senza testo alternativo" />
      <LinkScanner />
    </>
  );
}
