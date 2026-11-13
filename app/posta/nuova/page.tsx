import Link from "next/link";
import { postaAttiva } from "@/lib/posta";
import { Card, PageHeader } from "@/components/ui";
import { NuovaMail } from "@/components/NuovaMail";

export const dynamic = "force-dynamic";

export default function Nuova() {
  return (
    <>
      <PageHeader title="Nuova mail" right={<Link href="/posta" className="text-sm text-primary hover:underline">← Posta</Link>} />
      {postaAttiva() ? <Card><NuovaMail /></Card> : <Card className="border-warn/30 bg-warn-soft text-sm">La posta non è collegata.</Card>}
    </>
  );
}
