// PLATSHÅLLARE – ersätts av riktig trafik (bilar + trafikljus).
// Kontrakt: createTraffic(env) → { items(), obstacles, update(dt), glow?(ctx), pedGreen(i) }
export function createTraffic(env) {
  return { items: () => [], obstacles: [], update() {}, glow() {}, pedGreen: () => true };
}
