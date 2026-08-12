export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/* Obscene or hateful usernames are blocked. Normalisation catches leetspeak
   and separators; the stems intentionally over-block edge cases. */
export const BLOCKED_STEMS = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "wank",
  "twat",
  "prick",
  "bollock",
  "cock",
  "dick",
  "penis",
  "vagina",
  "boob",
  "tits",
  "jizz",
  "dildo",
  "whore",
  "slut",
  "porn",
  "rape",
  "nonce",
  "pedo",
  "paedo",
  "nigg",
  "fagg",
  "spic",
  "kike",
  "chink",
  "paki",
  "tranny",
  "retard",
  "nazi",
  "hitler",
];

export const LEET: Record<string, string> = {
  4: "a",
  "@": "a",
  8: "b",
  3: "e",
  6: "g",
  9: "g",
  1: "i",
  "!": "i",
  0: "o",
  5: "s",
  $: "s",
  7: "t",
  "+": "t",
  2: "z",
};

export function usernameProblem(u: string): string | null {
  if (!USERNAME_RE.test(u)) return "Usernames are 3 to 20 letters, numbers or underscores.";
  const lower = u.toLowerCase();
  const leeted = lower
    .split("")
    .map((c) => LEET[c] || c)
    .join("")
    .replace(/[^a-z]/g, "");
  const candidates = [
    leeted,
    leeted.replace(/(.)\1+/g, "$1"), // collapse doubled letters: fuuck
    lower.replace(/[^a-z]/g, ""), // digits stripped entirely: f0o0ul words hiding behind separators
  ];
  if (BLOCKED_STEMS.some((stem) => candidates.some((c) => c.includes(stem)))) return "That username is not available.";
  return null;
}
