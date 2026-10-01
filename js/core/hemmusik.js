// MUSIK HEMMA (Carl 2026-10-01: "sätt på musik hemma om man har den typen av elektronik – lägg in
// allting du har där"): skivspelaren (skivsamlingen), TV:n, datorn, laptopen och konsolen spelar
// ALLA spelets låtar – de tio från staden, butikerna och dinern (js/core/music.js, CC0-låtarna i
// assets/audio/CREDITS.md) och fotbollsfilmernas två (js/scenes/bio/filmmusik.js, syntade).
//
// A.hemMusik = { id, dev, sub, k, decoIdx } medan något spelar (låten, sorten som spelar och vilken
// möbel i vilket rum – room.js ritar noter som stiger ur den).
// I den egna bostaden tar låten hemma-låtens plats: hemPick(A) → pickMusic({ hem }) (music.js) för
// MP3-låtarna, hemMusikTick(A) startar/stoppar filmlåtarna. Musiken står på när man går mellan
// rummen och ut och in igen, men man stänger av den när man lägger sig (room.js sömnen).
// Klangen följer prylen: skivspelaren låter fullt och högre, TV:n och datorn som högtalare i
// rummet, laptopen och den gamla TV:n smalt som en radio. Högst +6 lycka om dagen.
import { filmMusic } from '../scenes/bio/filmmusik.js';
import { isMusicOn, setMusic } from './music.js';
import { isMuted, play } from './sound.js';
import { openModal, closeModal, toast, esc } from './ui.js';

export const LATAR = [
  { id: 'hemma', namn: 'A Place I Call Home', av: 'Juhani Junkala', fran: 'hemma' },
  { id: 'centrum', namn: 'Sunshine Coast', av: 'Juhani Junkala', fran: 'centrum' },
  { id: 'soder', namn: 'Home Town', av: 'Juhani Junkala', fran: 'Söder' },
  { id: 'parken', namn: 'Peaceful Days', av: 'Juhani Junkala', fran: 'parken' },
  { id: 'natt', namn: 'Innocence', av: 'Juhani Junkala', fran: 'staden på natten' },
  { id: 'fororten', namn: 'Cue', av: 'TAD', fran: 'förorten' },
  { id: 'kafe', namn: 'Cat caffe', av: 'TAD', fran: 'caféet' },
  { id: 'klader', namn: 'Florist', av: 'TAD', fran: 'klädaffären' },
  { id: 'butik', namn: 'Buy Something!', av: 'Cleyton Kauffman', fran: 'stormarknaden' },
  { id: 'jukebox', namn: 'Catchy Swing', av: 'Doge', fran: 'Burgarbarens jukebox' },
  { id: 'film-intro', namn: 'KBK-signaturen', av: 'Bio Pixel', fran: 'fotbollsfilmerna', film: 'intro' },
  { id: 'film-traning', namn: 'Träningslåten', av: 'Bio Pixel', fran: 'fotbollsfilmerna', film: 'traning' },
];
export const latOf = (id) => LATAR.find((l) => l.id === id) || null;
// prylarna som kan spela musik: namnet i dialogen, klangen (music.js FX) och nivån (lvl; hemma-låten
// ligger på 0,9 i bakgrunden – det man själv sätter på hörs mer)
export const SPELARE = {
  skivor: { namn: 'skivspelaren', icon: '💿', fx: 'none', lvl: 1.4 },
  tv: { namn: 'TV:n', icon: '📺', fx: 'inne', lvl: 1.3 },
  spelkonsol: { namn: 'konsolen', icon: '🎮', fx: 'inne', lvl: 1.3 },
  dator: { namn: 'datorn', icon: '🖥️', fx: 'inne', lvl: 1.25 },
  laptop: { namn: 'laptopen', icon: '💻', fx: 'radio', lvl: 1.15 },
  retrotv: { namn: 'den gamla TV:n', icon: '📺', fx: 'radio', lvl: 1.1 },
};
export const kanSpela = (kind) => !!SPELARE[kind];

// låten som ska gå i den egna bostaden just nu (null = vanliga hemma-låten). Filmlåtarna spelas av
// hemMusikTick – då ska stadens låt tystna (track null).
export function hemPick(A) {
  const h = A?.sceneName === 'room' ? A.hemMusik : null;
  const L = h && latOf(h.id);
  if (!L) return null;
  const S = SPELARE[h.dev] || SPELARE.tv;
  return L.film ? { track: null, fx: 'none', lvl: 0 } : { track: L.id, fx: S.fx, lvl: S.lvl };
}
let filmOn = false;
export function hemMusikTick(A) {
  const h = A?.sceneName === 'room' ? A.hemMusik : null;
  const L = h && latOf(h.id);
  if (L?.film) { filmMusic(L.film); filmOn = true; }
  else if (filmOn) { filmMusic(null); filmOn = false; }
}
export function stopHemMusik(A) { A.hemMusik = null; hemMusikTick(A); }

// dialogen vid prylen: alla låtar, den som spelar markerad
export function openMusik(A, dev, at = {}) {
  const g = A.game, S = SPELARE[dev] || SPELARE.tv;
  const draw = () => {
    const cur = A.hemMusik?.id || null;
    const tyst = !isMusicOn() || isMuted();
    const rows = LATAR.map((L) => `<div class="prow ${cur === L.id ? 'here' : ''}"><span style="font-size:26px;text-align:center">${cur === L.id ? '🔊' : L.film ? '🎬' : '🎵'}</span>
      <span class="nm">${esc(L.namn)}<br><small class="sp">${esc(L.av)} · från ${esc(L.fran)}</small></span>
      ${cur === L.id ? '<button class="btn btn-small" data-stop="1">⏹ Stäng av</button>' : `<button class="btn btn-small btn-go" data-lat="${L.id}">▶ Spela</button>`}</div>`).join('');
    const note = tyst ? `<p class="wk-bad" style="margin-top:0">🔇 ${isMuted() ? 'Ljudet är avstängt' : 'Musiken är avstängd'} i spelet – slå på den för att höra något.</p>` : '';
    const btns = [];
    if (!isMuted() && !isMusicOn()) btns.push({ label: '🔊 Slå på musiken', cls: 'btn-gold', onClick: () => { setMusic(true); draw(); } });
    if (cur) btns.push({ label: '⏹ Stäng av', onClick: () => { stopHemMusik(A); play('click'); toast(`🎵 Du stängde av ${S.namn}.`); draw(); } });
    btns.push({ label: 'Stäng', onClick: closeModal });
    const dlg = openModal(`${S.icon} Musik på ${S.namn}`, `${note}<p style="font-size:var(--f2);margin-top:0">Välj en låt – den går hemma tills du stänger av eller lägger dig. Alla låtar i Pixelstaden finns här.</p><div class="plist">${rows}</div>`, btns);
    dlg.querySelectorAll('[data-lat]').forEach((b) => (b.onclick = () => {
      const L = latOf(b.dataset.lat);
      A.hemMusik = { id: L.id, dev, sub: A.roomSub | 0, k: at.k ?? dev, decoIdx: at.decoIdx ?? null };
      hemMusikTick(A);
      play('click');
      const h = g.glad ? g.glad(2, '', 'musik', 6) : 0;   // musik gör en glad – högst +6 om dagen
      g.save();
      toast(`🎵 ${L.namn} på ${S.namn}${h ? ` +${h} 😊` : ''}`, 'good');
      draw();
    }));
    dlg.querySelectorAll('[data-stop]').forEach((b) => (b.onclick = () => { stopHemMusik(A); play('click'); toast(`🎵 Du stängde av ${S.namn}.`); draw(); }));
  };
  draw();
}
