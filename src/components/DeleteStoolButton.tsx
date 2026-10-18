"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteStoolButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!confirm("Supprimer cette entrée ?")) return;
    setBusy(true);
    const res = await fetch(`/api/stools?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
    else alert("Suppression impossible");
  }
  return (
    <button
      onClick={remove}
      disabled={busy}
      className="text-xs text-danger underline disabled:opacity-50"
    >
      Supprimer
    </button>
  );
}
