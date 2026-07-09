"use strict";
/* ============================================================
   미니게임 엔진 (셸)
   - 가상 해상도 캔버스 + 정수 배율 스케일링
   - 씬 관리: HUB(허브) → READY → PLAY → OVER
   - 공통 기능: 사운드, 파티클, 화면 흔들림/플래시, 최고점수 저장
   - 게임 등록: window.MG.register({ id, title, subtitle, accent, create(api) })
   서버/외부 라이브러리 불필요. file:// 더블클릭으로 동작.
   ============================================================ */

const MG = (window.MG = window.MG || { games: [], register(g) { this.games.push(g); } });

// ---- 가상 해상도 (세로형 레트로) ----
const VW = 200, VH = 356;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let scale = 1;

function fit() {
  const maxW = window.innerWidth, maxH = window.innerHeight;
  scale = Math.max(1, Math.floor(Math.min(maxW / VW, maxH / VH)));
  canvas.width = VW; canvas.height = VH;
  canvas.style.width = VW * scale + "px";
  canvas.style.height = VH * scale + "px";
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", fit);
fit();

// ---- 공통 팔레트 ----
const PAL = {
  bg1: "#2a1f44", bg2: "#3a2a5e",
  text: "#fff7e6", textDim: "rgba(255,247,230,.55)",
  panel: "rgba(13,10,20,.6)", shadow: "rgba(0,0,0,.35)",
  ok: "#7CFFA0", bad: "#ff5b6e",
};

// ---- 사운드 (WebAudio) ----
let actx = null;
let muted = localStorage.getItem("mg_muted") === "1";
let bgmSuppressed = false;   // 특정 게임(리듬 등)에서 BGM 일시정지
function ensureAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  startBgm();
}
function beep(freq, dur, type = "square", vol = 0.14) {
  ensureAudio(); if (!actx || muted) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(actx.destination);
  const t = actx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur);
}
const SOUND = {
  jump:   () => beep(520, 0.12, "square", 0.12),
  score:  () => beep(880, 0.07, "square", 0.10),
  select: () => beep(660, 0.06, "square", 0.10),
  die:    () => { beep(200, 0.25, "sawtooth", 0.18); beep(120, 0.35, "sawtooth", 0.14); },
};

// ---- 배경음악 (잔잔한 펜타토닉 루프) ----
let bgmTimer = null, bgmStep = 0;
// C4 D4 E4 G4 A4 C5 ... 단순 펜타토닉 (쉼표=0)
const BGM_SEQ = [523, 0, 659, 784, 0, 587, 659, 0, 523, 0, 784, 659, 0, 587, 0, 440];
function bgmVoice(freq, dur, type, vol) {
  if (!actx || muted || !freq) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(actx.destination);
  const t = actx.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.04);     // 부드러운 어택(딸깍 방지)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur);
}
function bgmTick() {
  if (actx && !muted && !bgmSuppressed) {
    const n = BGM_SEQ[bgmStep % BGM_SEQ.length];
    bgmVoice(n, 0.32, "sine", 0.05);                 // 멜로디(낮은 볼륨)
    if (bgmStep % 4 === 0 && n) bgmVoice(n / 2, 0.55, "triangle", 0.035); // 베이스
    bgmStep++;
  }
  bgmTimer = setTimeout(bgmTick, 300);
}
function startBgm() { if (!bgmTimer) bgmTick(); }

// ---- 그리기 헬퍼 ----
function px(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w, h); }
function text(str, x, y, size, col, align = "center") {
  ctx.font = `${size}px monospace`;
  ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = col; ctx.fillText(str, x, y);
}
function blink(ms = 500) { return Math.floor(Date.now() / ms) % 2 === 0; }

// ---- 최고점수 저장 (게임별) ----
function bestKey(id) { return "mg_best_" + id; }
function getBest(id) { return parseInt(localStorage.getItem(bestKey(id)) || "0", 10); }
function setBest(id, v) { localStorage.setItem(bestKey(id), String(v)); }

// ---- 셸 상태 ----
const S = { HUB: 0, READY: 1, PLAY: 2, OVER: 3, COLLECT: 4, MISSIONS: 5, ROULETTE: 6 };
let state = S.HUB;
let current = null;      // 현재 게임 정의
let inst = null;         // 현재 게임 인스턴스
let score = 0, best = 0, overT = 0;
let frame = 0;
let rewardUsed = false;   // 게임오버당 "광고 보고 2배" 1회 제한
let toast = null, toastT = 0;   // 메타 토스트(별 획득·도전과제)
let missionsTab = 0;            // 미션 화면 탭: 0=오늘의 미션, 1=도전과제
let battle = null;              // 친구 대결 {def, p1, p2, turn, phase}
let pickForBattle = false;      // 허브에서 대결용 게임 선택 모드

// ---- 공통 이펙트 (셸이 관리) ----
let shake = 0, flash = 0;
let particles = [];

// ---- 게임에 넘겨주는 API ----
const api = {
  ctx, VW, VH, PAL,
  px, text, beep, blink, sound: SOUND,
  particles,
  rnd: (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
  addScore(n = 1) { score += n; },
  shake(n) { shake = Math.max(shake, n); },
  flash(n) { flash = Math.max(flash, n); },
  suppressBgm(v) { bgmSuppressed = !!v; },   // 게임이 BGM 일시정지 요청
  gameOver() {
    if (state !== S.PLAY) return;
    state = S.OVER; overT = 0; rewardUsed = false;
    if (battle) {   // 대결: 별/광고/최고점 없이 점수만 기록
      if (battle.turn === 1) { battle.p1 = score; battle.phase = "handoff"; }
      else { battle.p2 = score; battle.phase = "result"; }
      return;
    }
    if (score > best) { best = score; setBest(current.id, best); }
    if (window.META) window.META.onGameEnd(current.id, score);   // 별 획득 + 도전과제
    if (window.MONET) window.MONET.onGameOver();   // 전면광고(N번마다)
  },
  puff(x, y, col = "#bfae8a") {
    particles.push({ x, y, vx: (Math.random() - 0.5) * 1.4, vy: -Math.random() * 1.2, life: 1, col, g: 0.05 });
  },
  burst(x, y, col, n = 14) {
    for (let i = 0; i < n; i++)
      particles.push({ x, y, vx: (Math.random() - 0.5) * 3.2, vy: (Math.random() - 0.9) * 3.4, life: 1, col, g: 0.12 });
  },
  sparkle(x, y, col = "#fff7e6", n = 8) {
    for (let i = 0; i < n; i++)
      particles.push({ x, y, vx: (Math.random() - 0.5) * 2.6, vy: (Math.random() - 0.5) * 2.6, life: 1, col, g: 0 });
  },
  // 둥근 사각형 (귀여운 몸통)
  roundRect(x, y, w, h, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath(); ctx.fill();
  },
  // 귀여운 얼굴: 반짝 눈 + 발그레 볼 + 입. mood: happy | dead | wow
  face(x, y, s, mood) {
    s = s || 1; mood = mood || "happy";
    const eo = Math.round(3 * s);
    if (mood === "dead") {
      ctx.fillStyle = "#2a1f1a";
      for (const sx of [-eo, eo]) {
        ctx.fillRect(x + sx - 1, y - 2, 1, 1); ctx.fillRect(x + sx + 1, y - 2, 1, 1);
        ctx.fillRect(x + sx, y - 1, 1, 1);
        ctx.fillRect(x + sx - 1, y, 1, 1); ctx.fillRect(x + sx + 1, y, 1, 1);
      }
    } else {
      ctx.fillStyle = "#2a1f1a";
      ctx.fillRect(x - eo - 1, y - 2, 2, 3);
      ctx.fillRect(x + eo - 1, y - 2, 2, 3);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - eo - 1, y - 2, 1, 1);
      ctx.fillRect(x + eo - 1, y - 2, 1, 1);
    }
    ctx.fillStyle = "rgba(255,150,170,.8)";
    ctx.fillRect(x - eo - 2, y + 2, 3, 2);
    ctx.fillRect(x + eo - 1, y + 2, 3, 2);
    ctx.fillStyle = "#2a1f1a";
    if (mood === "wow") { ctx.fillRect(x - 1, y + 2, 3, 3); }
    else { ctx.fillRect(x - 1, y + 4, 2, 1); ctx.fillRect(x - 2, y + 3, 1, 1); ctx.fillRect(x + 1, y + 3, 1, 1); }
  },
  // 캐릭터(콩이 스킨) 그리기: char = {body, dark}
  mascot(x, y, s, char, mood) {
    char = char || { body: "#ffd84d", dark: "#e6a100" };
    const w = 14 * s, h = 14 * s;
    this.roundRect(x - w / 2, y - h / 2, w, h, 5 * s, char.body);
    this.px(x - w / 2 + 1, y + h / 2 - 3 * s, w - 2, 3 * s, char.dark);
    this.face(x, y - s, s, mood || "happy");
  },
};
Object.defineProperty(api, "score", { get: () => score, set: (v) => { score = v; } });

// ---- 화면 좌표 → 가상 좌표 ----
function toVirtual(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
}

// ---- 허브(메뉴) 레이아웃 ----
// 허브: 2열 그리드 + 세로 스크롤 (게임 개수 무제한)
const GCOLS = 2, GCW = 78, GCH = 56, GGX = 12, GGY = 8, GX0 = 16, GY0 = 62;
const LIST_TOP = 60, LIST_BOT = VH - 34;
let hubScroll = 0;
function hubRows() { return Math.ceil(MG.games.length / GCOLS); }
function hubScrollMax() {
  const contentBottom = GY0 + hubRows() * GCH + (hubRows() - 1) * GGY;
  return Math.max(0, contentBottom - LIST_BOT + 6);
}
function cardRect(i) {
  const c = i % GCOLS, r = Math.floor(i / GCOLS);
  return { x: GX0 + c * (GCW + GGX), y: GY0 + r * (GCH + GGY) - hubScroll, w: GCW, h: GCH };
}
const HOME_BTN = { x: 6, y: 6, w: 24, h: 16 };
const REWARD_BTN = { x: 26, y: 234, w: VW - 52, h: 26 };       // 게임오버: 광고보고 2배
const MUTE_BTN = { x: 6, y: 6, w: 26, h: 16 };                 // 허브: 음소거
const BATTLE_BTN = { x: 10, y: VH - 28, w: 56, h: 22 };        // 허브: 대결
const COLLECT_BTN = { x: 72, y: VH - 28, w: 56, h: 22 };       // 허브: 도감
const MISSIONS_BTN = { x: 134, y: VH - 28, w: 56, h: 22 };     // 허브: 도전
const MARBLE_BTN = { x: 72, y: VH - 28, w: 57, h: 22 };        // 대결중: 구슬레이스
const WHEEL_BTN = { x: 133, y: VH - 28, w: 57, h: 22 };        // 대결중: 돌림판
const GACHA_BTN = { x: VW - 92, y: 26, w: 82, h: 22 };         // 도감: 뽑기
const MTAB_DAILY = { x: 18, y: 30, w: 82, h: 20 };             // 미션: 오늘 탭
const MTAB_ACH = { x: 100, y: 30, w: 82, h: 20 };              // 미션: 도전과제 탭
function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
function charCell(i) { const c = i % 3, r = Math.floor(i / 3); return { x: 16 + c * 58, y: 74 + r * 62, w: 52, h: 56 }; }

function toggleMute() {
  muted = !muted;
  localStorage.setItem("mg_muted", muted ? "1" : "0");
  if (!muted) { ensureAudio(); SOUND.select(); }
}
function doGacha() {
  const r = window.META.gachaRoll();
  if (r.poor) { window.META.toast("별이 부족해요", "#ff5b6e"); flash = 0.2; }
  else if (r.soldOut) { window.META.toast("모든 캐릭터 보유!", "#7CFFA0"); }
  else { flash = 0.35; SOUND.score(); }
}

// ---- 수익화 동작 ----
async function doReward() {
  rewardUsed = true;                                   // 즉시 잠금(중복 방지)
  const ok = window.MONET ? await window.MONET.showRewardDouble() : false;
  if (ok) {
    score *= 2;
    if (score > best) { best = score; setBest(current.id, best); }
    flash = 0.4; SOUND.score();
  } else { rewardUsed = false; }                       // 실패 시 재시도 허용
}

// ---- 게임 시작/전환 ----
function selectGame(g) {
  current = g; best = getBest(g.id);
  inst = g.create(api);
  score = 0; particles.length = 0; shake = 0; flash = 0; bgmSuppressed = false;
  inst.reset();
  state = S.READY;
  SOUND.select();
}
function startPlay() { score = 0; particles.length = 0; inst.reset(); state = S.PLAY; }
function gotoHub() {
  state = S.HUB; current = null; inst = null; battle = null; pickForBattle = false; bgmSuppressed = false;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();  // 타자게임 숨은 입력창 포커스 해제
  SOUND.select();
}

// ---- 친구 대결 (같은 폰 2인 번갈아) ----
function startBattle(def) {
  battle = { def, p1: 0, p2: 0, turn: 1, phase: "play" };
  pickForBattle = false;
  current = def; best = getBest(def.id); inst = def.create(api);
  score = 0; particles.length = 0; shake = 0; flash = 0;
  inst.reset(); state = S.PLAY; SOUND.select();
}
function battleNext() { battle.turn = 2; battle.phase = "play"; score = 0; particles.length = 0; inst.reset(); state = S.PLAY; }
function battleRestart() { battle.p1 = 0; battle.p2 = 0; battle.turn = 1; battle.phase = "play"; score = 0; particles.length = 0; inst.reset(); state = S.PLAY; }

// ---- 입력 ----
function onPress(p) {
  ensureAudio();
  if (state === S.HUB) {
    if (inRect(p, MUTE_BTN)) { toggleMute(); return; }
    if (inRect(p, BATTLE_BTN)) { pickForBattle = !pickForBattle; SOUND.select(); return; }
    if (pickForBattle && inRect(p, MARBLE_BTN)) { pickForBattle = false; state = S.ROULETTE; window.ROULETTE.enter("marble"); SOUND.select(); return; }
    if (pickForBattle && inRect(p, WHEEL_BTN)) { pickForBattle = false; state = S.ROULETTE; window.ROULETTE.enter("wheel"); SOUND.select(); return; }
    if (!pickForBattle && inRect(p, COLLECT_BTN)) { state = S.COLLECT; SOUND.select(); return; }
    if (!pickForBattle && inRect(p, MISSIONS_BTN)) { state = S.MISSIONS; SOUND.select(); return; }
    if (p.y < LIST_TOP || p.y > LIST_BOT) return;     // 목록 영역 밖 무시
    for (let i = 0; i < MG.games.length; i++)
      if (inRect(p, cardRect(i))) { pickForBattle ? startBattle(MG.games[i]) : selectGame(MG.games[i]); return; }
    return;
  }
  if (state === S.COLLECT) {
    if (inRect(p, HOME_BTN)) { state = S.HUB; SOUND.select(); return; }
    if (inRect(p, GACHA_BTN)) { doGacha(); return; }
    const chars = window.META ? window.META.CHARS : [];
    for (let i = 0; i < chars.length; i++)
      if (inRect(p, charCell(i))) { if (META.owns(chars[i].id)) { META.equip(chars[i].id); SOUND.select(); } return; }
    return;
  }
  if (state === S.MISSIONS) {
    if (inRect(p, HOME_BTN)) { state = S.HUB; SOUND.select(); return; }
    if (inRect(p, MTAB_DAILY)) { missionsTab = 0; SOUND.select(); return; }
    if (inRect(p, MTAB_ACH)) { missionsTab = 1; SOUND.select(); return; }
    return;
  }
  if (state === S.ROULETTE) {
    if (inRect(p, HOME_BTN)) { gotoHub(); return; }
    window.ROULETTE.press(p);
    return;
  }
  // 게임 안: 홈 버튼 (PLAY 중에는 숨김)
  if (state !== S.PLAY && inRect(p, HOME_BTN)) { gotoHub(); return; }

  if (state === S.READY) { startPlay(); return; }
  if (state === S.PLAY) { if (inst.press) inst.press(p); return; }
  if (state === S.OVER && overT > 24) {
    if (battle) { battle.phase === "handoff" ? battleNext() : battleRestart(); return; }
    if (!rewardUsed && score > 0 && inRect(p, REWARD_BTN)) { doReward(); return; }
    startPlay(); return;
  }
}
// 입력: 게임 중에는 누르는 즉시 반응, 허브에서는 드래그 스크롤 + 탭(놓을 때) 구분
let isDown = false, dragStart = null, dragScroll0 = 0, dragging = false;
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = toVirtual(e);
  isDown = true; dragging = false; dragStart = p; dragScroll0 = hubScroll;
  if (state !== S.HUB) onPress(p);
});
canvas.addEventListener("pointermove", (e) => {
  if (!isDown || state !== S.HUB) return;
  const p = toVirtual(e), dy = p.y - dragStart.y;
  if (Math.abs(dy) > 4) dragging = true;
  hubScroll = Math.max(0, Math.min(hubScrollMax(), dragScroll0 - dy));
});
function endDrag(e) {
  if (isDown && state === S.HUB && !dragging) onPress(dragStart);
  isDown = false;
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", () => { isDown = false; });
canvas.addEventListener("wheel", (e) => {
  if (state !== S.HUB) return;
  e.preventDefault();
  hubScroll = Math.max(0, Math.min(hubScrollMax(), hubScroll + e.deltaY));
}, { passive: false });
window.addEventListener("keydown", (e) => {
  if (state === S.PLAY && inst && inst.key) { inst.key(e); return; }   // 타자게임 등 키보드 입력 전달
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); onPress({ x: VW / 2, y: VH / 2 }); }
  if (e.code === "Escape" && state !== S.HUB && state !== S.PLAY) gotoHub();
});

// ---- 공통 업데이트 ----
function update() {
  frame++;
  if (state === S.PLAY && inst) inst.update();
  if (state === S.ROULETTE && window.ROULETTE) window.ROULETTE.update();
  if (state === S.OVER) overT++;
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= 0.03; }
  particles = particles.filter((p) => p.life > 0);
  api.particles = particles;
  if (shake > 0) shake *= 0.85;
  if (flash > 0) flash -= 0.04;
  // 메타 토스트 큐
  if (!toast && window.META && window.META.toasts.length) { toast = window.META.toasts.shift(); toastT = 130; }
  if (toastT > 0) toastT--; else toast = null;
}

// ---- 렌더 ----
function drawHomeBtn() {
  px(HOME_BTN.x, HOME_BTN.y, HOME_BTN.w, HOME_BTN.h, "rgba(0,0,0,.4)");
  text("◀", HOME_BTN.x + HOME_BTN.w / 2, HOME_BTN.y + 12, 10, PAL.text);
}
function drawTabBtn(b, label, accent, active) {
  api.roundRect(b.x, b.y, b.w, b.h, 6, active ? accent : "rgba(255,255,255,.08)");
  if (!active) px(b.x, b.y, b.w, 2, accent || "#ffd84d");
  text(label, b.x + b.w / 2, b.y + 15, 10, active ? "#1a1228" : PAL.text);
}

function renderHub() {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, PAL.bg1); g.addColorStop(1, PAL.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // 별 (살짝 반짝)
  for (let i = 0; i < 24; i++) {
    const a = 0.4 + 0.4 * Math.sin(frame * 0.05 + i);
    ctx.fillStyle = `rgba(255,243,176,${a})`;
    ctx.fillRect((i * 47) % VW, (i * 37) % 60 + 4, 1, 1);
  }

  // 타이틀 (살짝 둥실)
  const ty = 38 + Math.sin(frame * 0.05) * 2;
  text("미니 천국", VW / 2, ty, 22, "#ffd84d");
  text(pickForBattle ? "대결할 게임을 고르세요!" : "MINI GAMES", VW / 2, 52, 7, pickForBattle ? "#ff5b6e" : PAL.textDim);

  // 음소거 버튼
  {
    const b = MUTE_BTN;
    api.roundRect(b.x, b.y, b.w, b.h, 4, "rgba(255,255,255,.1)");
    text(muted ? "♪/" : "♪", b.x + b.w / 2, b.y + 11, 9, muted ? PAL.textDim : "#ffd84d");
  }
  // 장착 캐릭터 아바타 + 별 보유량 (우상단)
  if (window.META) {
    api.mascot(VW - 84, 11, 0.85, window.META.equippedChar());
    text("★ " + window.META.stars(), VW - 8, 17, 11, "#ffd84d", "right");
  }

  let totalBest = 0;
  MG.games.forEach((gm, i) => { totalBest += getBest(gm.id); });

  // 카드 목록 (스크롤 영역만 클립)
  ctx.save();
  ctx.beginPath(); ctx.rect(0, LIST_TOP, VW, LIST_BOT - LIST_TOP); ctx.clip();
  MG.games.forEach((gm, i) => {
    const r = cardRect(i), cx = r.x + r.w / 2;
    if (r.y > LIST_BOT || r.y + r.h < LIST_TOP) return;  // 화면 밖 스킵
    px(r.x, r.y, r.w, r.h, "rgba(13,10,20,.5)");
    px(r.x, r.y, r.w, 3, gm.accent);                 // 상단 액센트 바
    px(r.x, r.y + 3, r.w, 1, "rgba(255,255,255,.12)");
    if (gm.icon) gm.icon(api, cx, r.y + 20, frame + i * 20);
    else px(cx - 8, r.y + 12, 16, 16, gm.accent);
    text(gm.title, cx, r.y + 40, 10, PAL.text);
    text("BEST " + getBest(gm.id), cx, r.y + 51, 7, gm.accent);
  });
  ctx.restore();

  // 스크롤 가능 표시 (▾)
  if (hubScroll < hubScrollMax() - 1 && blink(600)) text("▾", VW / 2, LIST_BOT - 2, 10, PAL.textDim);

  // 하단 메뉴: 대결 / 도감 / 도전 (대결 선택중이면 빨갛게 + 구슬레이스 옵션)
  drawTabBtn(BATTLE_BTN, pickForBattle ? "대결중" : "대결", "#ff5b6e", pickForBattle);
  if (pickForBattle) {
    drawTabBtn(MARBLE_BTN, "구슬", "#ffd84d");
    drawTabBtn(WHEEL_BTN, "돌림판", "#ff8a3d");
  } else {
    drawTabBtn(COLLECT_BTN, "도감", "#b18cff");
    drawTabBtn(MISSIONS_BTN, "도전", "#7CFFA0");
    if (window.META && window.META.dailyIncomplete()) {
      ctx.fillStyle = "#ff5b6e"; ctx.beginPath(); ctx.arc(MISSIONS_BTN.x + MISSIONS_BTN.w - 5, MISSIONS_BTN.y + 4, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 대결 선택중 강조: 빨간 테두리
  if (pickForBattle) {
    ctx.strokeStyle = "#ff5b6e"; ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, VW - 4, VH - 4);
  }
}

function renderGame() {
  ctx.save();
  ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  inst.render();   // 게임이 배경+월드를 직접 그림

  for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); px(p.x, p.y, 2, 2, p.col); }
  ctx.globalAlpha = 1;
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, flash)})`; ctx.fillRect(-8, -8, VW + 16, VH + 16); }
  ctx.restore();

  // HUD
  if (state === S.PLAY || state === S.OVER) {
    text(String(score), VW / 2, 36, 22, PAL.text);
    if (battle) text((battle.turn === 1 ? "1P" : "2P") + " 차례", VW / 2, 52, 9, battle.turn === 1 ? "#5ec9ff" : "#ff9aa8");
    else text("BEST " + best, VW / 2, 52, 8, PAL.textDim);
  }

  if (state === S.READY) {
    ctx.fillStyle = PAL.panel; ctx.fillRect(0, 0, VW, VH);
    if (current.icon) current.icon(api, VW / 2, 104, frame);
    text(current.title, VW / 2, 142, 24, current.accent);
    text(current.subtitle, VW / 2, 158, 8, PAL.textDim);
    // 설명 패널
    if (current.how) {
      api.roundRect(18, 178, VW - 36, 36, 7, "rgba(255,255,255,.07)");
      px(18, 178, 3, 36, current.accent);
      text("이렇게 해요", VW / 2, 192, 7, current.accent);
      text(current.how, VW / 2, 205, 9, PAL.text);
    }
    if (blink()) text("탭하면 시작", VW / 2, 248, 12, PAL.text);
    text("BEST " + best, VW / 2, 292, 9, current.accent);
    drawHomeBtn();
  } else if (state === S.OVER) {
    ctx.fillStyle = PAL.panel; ctx.fillRect(0, 0, VW, VH);
    if (battle) {
      renderBattleOver();
    } else {
      text("GAME OVER", VW / 2, 144, 18, PAL.bad);
      text("점수  " + score, VW / 2, 178, 12, PAL.text);
      text("최고  " + best, VW / 2, 198, 12, score >= best ? current.accent : PAL.textDim);
      if (score >= best && score > 0) text("★ 신기록! ★", VW / 2, 220, 10, current.accent);
      // 광고 보고 점수 2배 버튼
      if (!rewardUsed && score > 0) {
        const b = REWARD_BTN;
        api.roundRect(b.x, b.y, b.w, b.h, 6, "rgba(124,255,160,.16)");
        px(b.x, b.y, 3, b.h, "#7CFFA0");
        text("▶ 광고 보고 점수 2배", VW / 2, b.y + 17, 9, "#7CFFA0");
      } else if (rewardUsed) {
        text("점수 2배 완료!", VW / 2, REWARD_BTN.y + 17, 9, current.accent);
      }
      if (overT > 24 && blink()) text("탭하면 다시", VW / 2, 282, 12, PAL.text);
    }
    drawHomeBtn();
  }
}

// ---- 루프 ----
function bgFill() {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, PAL.bg1); g.addColorStop(1, PAL.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
}

function renderCollect() {
  bgFill();
  text("도감", VW / 2, 20, 16, "#b18cff");
  text("★ " + META.stars(), 12, GACHA_BTN.y + 15, 11, "#ffd84d", "left");
  api.roundRect(GACHA_BTN.x, GACHA_BTN.y, GACHA_BTN.w, GACHA_BTN.h, 6, "rgba(177,140,255,.2)");
  px(GACHA_BTN.x, GACHA_BTN.y, GACHA_BTN.w, 2, "#b18cff");
  text("뽑기 ★" + META.GACHA_COST, GACHA_BTN.x + GACHA_BTN.w / 2, GACHA_BTN.y + 15, 8, PAL.text);

  const chars = META.CHARS;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i], cell = charCell(i);
    const owned = META.owns(c.id), eq = META._equipped === c.id;
    api.roundRect(cell.x, cell.y, cell.w, cell.h, 8, eq ? "rgba(177,140,255,.28)" : "rgba(13,10,20,.5)");
    if (eq) px(cell.x, cell.y, cell.w, 2, "#b18cff");
    const mx = cell.x + cell.w / 2, my = cell.y + 22;
    if (owned) {
      api.mascot(mx, my, 1.8, c, "happy");
      text(c.name, mx, cell.y + cell.h - 8, 8, eq ? "#b18cff" : PAL.text);
    } else {
      api.mascot(mx, my, 1.8, { body: "#3a3550", dark: "#2a2540" }, "happy");
      text("???", mx, cell.y + cell.h - 8, 8, PAL.textDim);
    }
  }
  drawHomeBtn();
}

function renderMissions() {
  bgFill();
  text("미션", VW / 2, 18, 15, "#7CFFA0");
  drawTabBtn(MTAB_DAILY, "오늘의 미션", "#5ec9ff", missionsTab === 0);
  drawTabBtn(MTAB_ACH, "도전과제", "#7CFFA0", missionsTab === 1);

  if (missionsTab === 0) {
    text("매일 자정 갱신 · 접속 보상 +10★", VW / 2, 64, 7, PAL.textDim);
    let y = 74;
    const dms = window.META ? window.META.dailyMissions() : [];
    for (const m of dms) {
      const rowH = 32;
      api.roundRect(14, y, VW - 28, rowH - 4, 5, m.done ? "rgba(94,201,255,.18)" : "rgba(13,10,20,.5)");
      px(14, y, 3, rowH - 4, m.done ? "#5ec9ff" : "rgba(255,255,255,.25)");
      text((m.done ? "✓ " : "") + m.title, 26, y + 14, 9, PAL.text, "left");
      text(m.prog + " / " + m.goal, 26, y + 25, 7, m.done ? "#5ec9ff" : PAL.textDim, "left");
      text("★" + m.reward, VW - 20, y + 18, 10, m.done ? "#5ec9ff" : "#ffd84d", "right");
      y += rowH;
    }
  } else {
    let y = 64;
    for (const a of META.ACH) {
      const done = META.achDone(a.id), rowH = 30;
      api.roundRect(14, y, VW - 28, rowH - 4, 5, "rgba(13,10,20,.5)");
      if (done) {
        px(14, y, 3, rowH - 4, "#7CFFA0");
        text("✓", 27, y + 18, 12, "#7CFFA0");
        text(a.title, 42, y + 13, 9, PAL.text, "left");
        text(a.desc, 42, y + 23, 7, PAL.textDim, "left");
        let rw = a.reward.stars ? "★" + a.reward.stars : "";
        if (a.reward.char) rw += (rw ? " " : "") + META.charById(a.reward.char).name;
        text(rw, VW - 22, y + 16, 8, "#ffd84d", "right");
      } else if (a.hidden) {
        text("?", 27, y + 18, 12, PAL.textDim);
        text("??? 숨겨진 도전과제", 42, y + 16, 8, PAL.textDim, "left");
      } else {
        px(14, y, 3, rowH - 4, "rgba(255,255,255,.2)");
        text(a.title, 42, y + 13, 9, PAL.text, "left");
        text(a.desc, 42, y + 23, 7, PAL.textDim, "left");
        let rw = a.reward.stars ? "★" + a.reward.stars : "";
        text(rw, VW - 22, y + 16, 8, "rgba(255,255,255,.4)", "right");
      }
      y += rowH;
    }
  }
  drawHomeBtn();
}

function renderBattleOver() {
  if (battle.phase === "handoff") {
    text("1P 끝!", VW / 2, 128, 22, "#5ec9ff");
    text("점수  " + battle.p1, VW / 2, 160, 14, PAL.text);
    text("이제 2P 차례", VW / 2, 198, 13, "#ff9aa8");
    if (overT > 24 && blink()) text("탭하면 2P 시작", VW / 2, 250, 12, PAL.text);
  } else {
    const tie = battle.p1 === battle.p2, p1win = battle.p1 > battle.p2;
    text(tie ? "무승부!" : p1win ? "1P 승리!" : "2P 승리!", VW / 2, 118, 24, tie ? PAL.text : p1win ? "#5ec9ff" : "#ff9aa8");
    text("1P    " + battle.p1, VW / 2, 158, 15, "#5ec9ff");
    text("2P    " + battle.p2, VW / 2, 184, 15, "#ff9aa8");
    if (overT > 24 && blink()) text("탭하면 다시", VW / 2, 242, 12, PAL.text);
    text("◀ 로 홈", VW / 2, 272, 8, PAL.textDim);
  }
}

function drawToast() {
  if (!toast) return;
  const a = Math.min(1, toastT / 18);
  const w = Math.min(VW - 16, 24 + toast.text.length * 9);
  ctx.globalAlpha = a;
  api.roundRect(VW / 2 - w / 2, 60, w, 22, 6, "rgba(13,10,20,.88)");
  px(VW / 2 - w / 2, 60, w, 2, toast.color);
  text(toast.text, VW / 2, 75, 9, toast.color);
  ctx.globalAlpha = 1;
}

function loop() {
  update();
  if (state === S.HUB) renderHub();
  else if (state === S.COLLECT) renderCollect();
  else if (state === S.MISSIONS) renderMissions();
  else if (state === S.ROULETTE) { window.ROULETTE.render(); drawHomeBtn(); }
  else renderGame();
  drawToast();
  requestAnimationFrame(loop);
}

window.addEventListener("load", () => { fit(); if (window.ROULETTE) window.ROULETTE.init(api); loop(); });
