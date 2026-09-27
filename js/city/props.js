// PLATSHÅLLARE – ersätts av riktig rekvisita (träd, blommor, bänkar, lyktor, fontän …).
// Kontrakt: createProps(env) → { items(), obstacles, update?(dt), glow?(ctx) }
export function createProps(env) {
  return { items: () => [], obstacles: [], update() {}, glow() {} };
}
