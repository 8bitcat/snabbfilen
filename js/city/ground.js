// PLATSHÅLLARE – ersätts av den riktiga markkonsten (väg, trottoarer, gränder, park).
// Kontrakt: paintGround(night) → canvas CITY.W × CITY.H; groundLive?(ctx, env, view)
import { Pix, mix } from '../core/floor-pix.js';
import { CITY, STREETS } from './map.js';

export function paintGround(night) {
  const P = new Pix(CITY.W, CITY.H);
  const k = night ? 0.7 : 1;
  const band = (y0, y1, c) => P.rect(0, y0, CITY.W, y1 - y0, c);
  band(0, CITY.BASE, 0x6a6258);
  band(CITY.SIDEWALK_N[0], CITY.SIDEWALK_N[1], 0xb5ac9c);
  band(CITY.ROAD[0], CITY.ROAD[1], 0x3e4048);
  band(CITY.SIDEWALK_S[0], CITY.SIDEWALK_S[1], 0xb5ac9c);
  band(CITY.PARK[0], CITY.PARK[1], 0x5a9a4a);
  for (const s of STREETS) if (s.kind === 'street') P.rect(s.x0, CITY.FOOT_TOP, s.x1 - s.x0, CITY.BASE - CITY.FOOT_TOP, 0x4a4c54);
  for (let x = 0; x < CITY.W; x += 30) P.rect(x, 246, 14, 2, 0xd8d2c0);
  if (night) P.rect(0, 0, CITY.W, CITY.H, mix(0, 0x101428, 0.5), 0.2 * k);
  return P.flush();
}
