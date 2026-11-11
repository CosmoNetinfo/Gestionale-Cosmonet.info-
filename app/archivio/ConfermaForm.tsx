"use client";

export default function ConfermaForm({ action, domanda, children, nome }: { action: (fd: FormData) => void | Promise<void>; domanda: string; children: React.ReactNode; nome?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(domanda)) e.preventDefault();
      }}
    >
      {nome && <input type="hidden" name="nome" value={nome} />}
      {children}
    </form>
  );
}
