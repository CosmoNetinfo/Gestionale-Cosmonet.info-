"use client";

export default function FormDiscord({ action, forum }: { action: (fd: FormData) => void | Promise<void>; forum: boolean }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Pubblicare ora questo post su Discord?")) e.preventDefault();
      }}
      className="space-y-4"
    >
      {forum && (
        <label className="block text-sm font-medium">
          Titolo del thread (max 100 caratteri)
          <input name="titolo" maxLength={100} required placeholder="Il titolo dell'articolo" className="mt-1 w-full rounded-md border border-line bg-surface p-2.5 text-sm font-normal" />
        </label>
      )}
      <label className="block text-sm font-medium">
        Testo del post
        <textarea
          name="testo"
          required
          rows={10}
          maxLength={1900}
          placeholder="Incolla qui lo stesso testo di LinkedIn e Facebook"
          className="mt-1 w-full rounded-md border border-line bg-surface p-3 text-sm font-normal"
        />
      </label>
      <label className="block text-sm font-medium">
        Link dell&apos;articolo (Discord mostra l&apos;anteprima)
        <input name="link" type="url" placeholder="https://www.cosmonet.info/..." className="mt-1 w-full rounded-md border border-line bg-surface p-2.5 text-sm font-normal" />
      </label>
      <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Pubblica su Discord</button>
    </form>
  );
}
