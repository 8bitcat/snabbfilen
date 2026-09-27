// PLATSHÅLLARE – ersätts av riktigt stadsliv (fotgängare, duvor, fjärilar …).
// Kontrakt: createLife(env, traffic) → { items(), update(dt), positions(), glow?(ctx) }
export function createLife(env, traffic) {
  return { items: () => [], update() {}, positions: () => [], glow() {} };
}
