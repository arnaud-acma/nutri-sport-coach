"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";

interface Proposal {
  slug: string;
  ancien_texte: string;
  nouveau_texte: string;
  raison: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content_md: string;
  proposal: Proposal | null;
  proposal_status: "proposee" | "acceptee" | "refusee" | null;
  model_used: string | null;
  created_at: string;
}

const FICHES: Record<string, string> = {
  profil: "Profil",
  objectifs: "Objectifs et priorités",
  positions: "Mes positions",
  regime: "Régime et habitudes",
  sante: "Santé",
};

async function fetchThread(
  mealId: string | null
): Promise<{ messages: Message[]; error?: string }> {
  const qs = mealId ? `?meal_id=${mealId}` : "";
  const res = await fetch(`/api/coach${qs}`);
  const data = await res.json();
  if (!res.ok) return { messages: [], error: data.error ?? `Erreur ${res.status}` };
  return { messages: data.messages };
}

/** Fil de discussion avec le coach. mealId null = discussion libre. */
export default function CoachThread({
  mealId,
  placeholder,
}: {
  mealId: string | null;
  placeholder: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetchThread(mealId);
    if (r.error) setError(r.error);
    else setMessages(r.messages);
    setLoaded(true);
  }, [mealId]);

  useEffect(() => {
    let alive = true;
    fetchThread(mealId).then((r) => {
      if (!alive) return;
      if (r.error) setError(r.error);
      else setMessages(r.messages);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [mealId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setError("");
    setMessages((m) => [
      ...m,
      {
        id: `tmp-${Date.now()}`,
        role: "user",
        content_md: msg,
        proposal: null,
        proposal_status: null,
        model_used: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setText("");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ meal_id: mealId, message: msg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      await load();
      setSending(false);
    }
  }

  async function decide(id: string, action: "accepter" | "refuser") {
    setError("");
    const res = await fetch("/api/coach/proposition", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message_id: id, action }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? `Erreur ${res.status}`);
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      {loaded && messages.length === 0 && (
        <p className="text-sm text-muted">Aucun échange pour l&apos;instant.</p>
      )}

      {messages.map((m) =>
        m.role === "user" ? (
          <div
            key={m.id}
            className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-accent text-white px-4 py-2 text-sm whitespace-pre-wrap"
          >
            {m.content_md}
          </div>
        ) : (
          <div
            key={m.id}
            className="self-start max-w-[92%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm flex flex-col gap-2"
          >
            <Markdown md={m.content_md} />
            {m.proposal && (
              <ProposalCard
                p={m.proposal}
                status={m.proposal_status}
                onDecide={(a) => decide(m.id, a)}
              />
            )}
            {m.model_used && (
              <p className="text-[11px] text-muted">Modèle : {m.model_used}</p>
            )}
          </div>
        )
      )}

      {sending && (
        <p className="self-start text-sm text-muted">Le coach réfléchit…</p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div ref={endRef} />

      <form onSubmit={send} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="rounded-lg border border-border bg-card px-4 py-3 text-base"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-lg bg-accent text-white py-3 font-semibold disabled:opacity-60"
        >
          {sending ? "Envoi…" : "Envoyer"}
        </button>
      </form>
    </div>
  );
}

function ProposalCard({
  p,
  status,
  onDecide,
}: {
  p: Proposal;
  status: Message["proposal_status"];
  onDecide: (a: "accepter" | "refuser") => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-accent bg-accent-soft p-3 flex flex-col gap-2">
      <p className="font-semibold">
        📝 Proposition pour la fiche « {FICHES[p.slug] ?? p.slug} »
      </p>
      {p.raison && <p className="text-muted">{p.raison}</p>}
      {p.ancien_texte.trim() ? (
        <>
          <p>
            <span className="font-semibold">Remplacer :</span>{" "}
            <span className="line-through">{p.ancien_texte}</span>
          </p>
          <p>
            <span className="font-semibold">Par :</span> {p.nouveau_texte}
          </p>
        </>
      ) : (
        <p>
          <span className="font-semibold">Ajouter :</span> {p.nouveau_texte}
        </p>
      )}
      {status === "proposee" ? (
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onDecide("accepter");
              setBusy(false);
            }}
            className="flex-1 rounded-lg bg-accent text-white py-2 font-semibold disabled:opacity-60"
          >
            Accepter
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onDecide("refuser");
              setBusy(false);
            }}
            className="flex-1 rounded-lg border border-border bg-card py-2 disabled:opacity-60"
          >
            Refuser
          </button>
        </div>
      ) : (
        <p className="font-semibold">
          {status === "acceptee" ? "✅ Acceptée, fiche mise à jour" : "❌ Refusée"}
        </p>
      )}
    </div>
  );
}
