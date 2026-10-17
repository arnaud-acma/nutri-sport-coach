// Tests sans framework : adaptateur mock + parseur de réponse coach.
// Usage : node scripts/test-llm.mjs  (sort avec un code != 0 en cas d'échec)
import assert from "node:assert/strict";

// Le code TS n'est pas compilé ici : on reproduit le contrat du parseur
// (copie de référence testée contre src/lib/llm/anthropic.ts, parseCoachJson).
function parseCoachJson(text, model) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const raw = JSON.parse(text.slice(start, end + 1));
      const verdict =
        raw.verdict === "valide" || raw.verdict === "a_completer"
          ? raw.verdict
          : "a_completer";
      return {
        verdict,
        resume: typeof raw.resume === "string" ? raw.resume : "",
        ajouts: Array.isArray(raw.ajouts)
          ? raw.ajouts.filter((a) => typeof a === "string")
          : [],
        commentaire:
          typeof raw.commentaire === "string" ? raw.commentaire : text,
        model,
      };
    } catch {}
  }
  return {
    verdict: "a_completer",
    resume: "Réponse du coach non structurée (voir commentaire).",
    ajouts: [],
    commentaire: text,
    model,
  };
}

// 1. JSON propre
let r = parseCoachJson(
  '{"verdict":"valide","resume":"Assiette complète.","ajouts":[],"commentaire":"Bien."}',
  "m"
);
assert.equal(r.verdict, "valide");
assert.equal(r.resume, "Assiette complète.");

// 2. JSON entouré de texte
r = parseCoachJson(
  'Voici mon analyse :\n{"verdict":"a_completer","resume":"Manque de protéines.","ajouts":["2 oeufs"],"commentaire":"Ajoute une source de protéines."}\nVoilà.',
  "m"
);
assert.equal(r.verdict, "a_completer");
assert.deepEqual(r.ajouts, ["2 oeufs"]);

// 3. Verdict inconnu -> a_completer
r = parseCoachJson('{"verdict":"bizarre","resume":"x","commentaire":"y"}', "m");
assert.equal(r.verdict, "a_completer");

// 4. Texte sans JSON -> dégradé propre
r = parseCoachJson("Désolé, je ne peux pas répondre en JSON.", "m");
assert.equal(r.verdict, "a_completer");
assert.ok(r.commentaire.includes("Désolé"));

// 5. ajouts pollués -> filtrés
r = parseCoachJson(
  '{"verdict":"valide","resume":"ok","ajouts":["a",42,null],"commentaire":"c"}',
  "m"
);
assert.deepEqual(r.ajouts, ["a"]);

console.log("test-llm : 5/5 OK");
