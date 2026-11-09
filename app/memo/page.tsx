import { ComingSoon, PageHeader } from "@/components/ui";

export default function Memo() {
  return (
    <>
      <PageHeader title="Cosmo Memo" subtitle="La memoria esterna, dentro il gestionale" />
      <ComingSoon
        phase="Fase 4"
        text="Qui vedrai le pagine di Cosmo Memo in sola lettura, senza uscire dal gestionale."
      />
    </>
  );
}
