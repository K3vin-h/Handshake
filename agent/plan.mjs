import { Type } from "@google/genai";

const MAX_TURNS = 4;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_stats",
        description: "The learner's accuracy per day and their weakest letters over the last 14 days.",
        parameters: { type: Type.OBJECT, properties: {} },
      },
      {
        name: "get_practice_words",
        description: "Practice words that use only letters the learner knows, favouring the focus letters.",
        parameters: { type: Type.OBJECT, properties: { focus: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["focus"] },
      },
    ],
  },
];

// Gemini may wrap its JSON in prose or a markdown fence: parse from the first { to the last }.
const parseFinal = (text) => JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

/**
 * Plans one practice session. The learner id and known letters live in this closure: the model can't
 * supply or change them. The calling server re-checks the reply, so this only has to return JSON.
 */
export async function planSession({ ai, model, appUrl, learnerId, candidates, knownLetters, fetch: f = fetch, signal = AbortSignal.timeout(7000) }) {
  const tools = {
    get_stats: async () => (await f(`${appUrl}/api/stats/${learnerId}`, { signal })).json(),
    get_practice_words: async ({ focus = [] }) =>
      (
        await f(`${appUrl}/api/words`, {
          signal, method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knownLetters, weakLetters: (Array.isArray(focus) ? focus : []).filter((l) => knownLetters.includes(l)).slice(0, 5) }),
        })
      ).json(),
  };
  const lessons = candidates.map((c) => `${c.id} (letters ${c.letters.join("") || "none"})`).join("; ");
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `You plan one short ASL fingerspelling practice session. Lesson options: ${lessons}. The learner knows the letters: ${knownLetters.join("")}.
Call get_stats to see their accuracy and weakest letters, then get_practice_words for their weak letters.
Pick ONE lesson id from the options (the first option is the next new lesson; the others are reviews).
Reply with only JSON: {"lessonId": string, "focus": string[] (up to 3 weak letters), "words": string[] (from get_practice_words), "tip": string (one encouraging sentence, no emojis)}.`,
        },
      ],
    },
  ];
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await ai.models.generateContent({ model, contents, config: { tools: TOOLS, abortSignal: signal, httpOptions: { retryOptions: { attempts: 1 } } } });
    const calls = res.functionCalls ?? [];
    if (!calls.length) return parseFinal(res.text);
    contents.push(res.candidates[0].content);
    const parts = [];
    for (const c of calls) {
      const fn = tools[c.name];
      const result = fn ? await fn(c.args ?? {}).catch((e) => ({ error: String(e.message) })) : { error: "unknown_tool" };
      parts.push({ functionResponse: { name: c.name, response: { result } } });
    }
    contents.push({ role: "user", parts });
  }
  throw new Error("agent_turn_limit");
}
