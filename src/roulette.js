"use strict";
/* ============================================================
   운빨 대결 룰렛 — 두 모드
   1) 구슬 레이스(marble): 구슬이 핀 코스를 굴러 도착순 순위 (lazygyu 스타일)
   2) 돌림판(wheel): 돌림판을 돌려 당첨자 1명
   참가자는 A, B, C ... 로 표시.
   엔진이 state===S.ROULETTE 일 때 update()/render()/press() 호출.
   ============================================================ */
const ROULETTE = (window.ROULETTE = {
  api: null, ctx: null, VW: 200, VH: 356,
  mode: "marble",            // marble | wheel
  phase: "setup",            // setup | race | result
  n: 3, resultT: 0,
  LETTERS: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
  COLORS: ["#5ec9ff", "#ff5b6e", "#ffd84d", "#7CFFA0", "#b18cff", "#ff8a3d",
           "#ff9aa8", "#6ee0d0", "#c0e84a", "#e07be0", "#7a9aff", "#d0a060"],

  // 구슬 레이스
  marbles: [], pegs: [], finishOrder: [], cam: 0, timer: 0,
  WALL_L: 12, WALL_R: 188, WORLD_H: 0, FINISH_Y: 0,
  GRAV: 0.14, REST: 0.6, VCAP: 4.2,
  // 돌림판
  wheelAng: 0, wheelVel: 0, winner: -1,

  init(api) { this.api = api; this.ctx = api.ctx; this.VW = api.VW; this.VH = api.VH; },
  enter(mode) { this.mode = mode || "marble"; this.phase = "setup"; },

  // ================= 구슬 레이스 =================
  buildCourse() {
    this.pegs = [];
    let y = 150;
    for (let r = 0; r < 26; r++) {
      const off = (r % 2) * 16;
      for (let x = this.WALL_L + 14 + off; x < this.WALL_R - 8; x += 32) this.pegs.push({ x, y, r: 4 });
      y += 38;
    }
    this.WORLD_H = y + 90; this.FINISH_Y = this.WORLD_H - 50;
  },
  startRace() {
    this.buildCourse(); this.marbles = [];
    const rad = this.n > 8 ? 4.5 : this.n > 5 ? 5 : 6;
    const usable = this.WALL_R - this.WALL_L - 24;
    for (let i = 0; i < this.n; i++) {
      const x = this.WALL_L + 12 + (i + 0.5) * (usable / this.n);
      this.marbles.push({ x, y: 44 + (i % 3) * 12, vx: (Math.random() - 0.5) * 1.2, vy: 0, r: rad, col: this.COLORS[i], letter: this.LETTERS[i], fin: false, rank: 0 });
    }
    this.finishOrder = []; this.cam = 0; this.timer = 0; this.phase = "race";
    if (this.api) this.api.sound.select();
  },
  _stepMarble(m) {
    for (let s = 0; s < 2; s++) {
      m.vy += this.GRAV; m.vx *= 0.995;
      if (m.vy > this.VCAP) m.vy = this.VCAP;
      if (m.vx > this.VCAP) m.vx = this.VCAP; if (m.vx < -this.VCAP) m.vx = -this.VCAP;
      m.x += m.vx * 0.5; m.y += m.vy * 0.5;
      if (m.x < this.WALL_L + m.r) { m.x = this.WALL_L + m.r; m.vx = Math.abs(m.vx) * this.REST; }
      if (m.x > this.WALL_R - m.r) { m.x = this.WALL_R - m.r; m.vx = -Math.abs(m.vx) * this.REST; }
      for (const p of this.pegs) {
        if (Math.abs(p.y - m.y) > 16) continue;
        const dx = m.x - p.x, dy = m.y - p.y, dd = dx * dx + dy * dy, rr = m.r + p.r;
        if (dd < rr * rr) {
          const d = Math.sqrt(dd) || 0.01, nx = dx / d, ny = dy / d;
          m.x = p.x + nx * rr; m.y = p.y + ny * rr;
          const vn = m.vx * nx + m.vy * ny;
          m.vx -= (1 + this.REST) * vn * nx; m.vy -= (1 + this.REST) * vn * ny;
          m.vx += (Math.random() - 0.5) * 0.6;
        }
      }
    }
  },
  _marbleCollide() {
    const M = this.marbles;
    for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) {
      const a = M[i], b = M[j]; if (a.fin || b.fin) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy, rr = a.r + b.r;
      if (dd < rr * rr && dd > 0.01) {
        const d = Math.sqrt(dd), nx = dx / d, ny = dy / d, ov = (rr - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
        const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        a.vx -= p * nx; a.vy -= p * ny; b.vx += p * nx; b.vy += p * ny;
      }
    }
  },
  _updateRace() {
    this.timer++;
    let lead = 0;
    for (const m of this.marbles) {
      if (!m.fin) { this._stepMarble(m); if (m.y > this.FINISH_Y) { m.fin = true; m.rank = this.finishOrder.length + 1; this.finishOrder.push(m); if (this.api) this.api.sound.score(); } }
      if (m.y > lead) lead = m.y;
    }
    this._marbleCollide();
    this.cam = Math.max(0, Math.min(this.WORLD_H - this.VH, lead - 150));
    if (this.finishOrder.length >= this.n || this.timer > 3000) {
      if (this.finishOrder.length < this.n)
        this.marbles.filter((m) => !m.fin).sort((a, b) => b.y - a.y).forEach((m) => { m.rank = this.finishOrder.length + 1; this.finishOrder.push(m); });
      this.phase = "result"; this.resultT = 0; if (this.api) this.api.sound.select();
    }
  },

  // ================= 돌림판 =================
  startWheel() {
    this.wheelAng = Math.random() * Math.PI * 2;
    this.wheelVel = 0.34 + Math.random() * 0.16;
    this.winner = -1; this.phase = "race"; if (this.api) this.api.sound.select();
  },
  _updateWheel() {
    this.wheelAng += this.wheelVel;
    this.wheelVel *= 0.987; this.wheelVel -= 0.0004;
    if (this.wheelVel <= 0.004) {
      this.wheelVel = 0;
      const seg = (Math.PI * 2) / this.n;
      let local = (-Math.PI / 2 - this.wheelAng) % (Math.PI * 2);
      if (local < 0) local += Math.PI * 2;
      this.winner = Math.floor(local / seg) % this.n;
      this.phase = "result"; this.resultT = 0; if (this.api) this.api.sound.score();
    }
  },

  update() {
    if (this.phase === "result") { if (this.resultT < 120) this.resultT++; return; }
    if (this.phase !== "race") return;
    if (this.mode === "wheel") this._updateWheel(); else this._updateRace();
  },

  // ================= 입력 =================
  _rects() {
    const VW = this.VW;
    return {
      minus: { x: VW / 2 - 56, y: 168, w: 34, h: 34 },
      plus: { x: VW / 2 + 22, y: 168, w: 34, h: 34 },
      start: { x: VW / 2 - 54, y: 250, w: 108, h: 36 },
    };
  },
  _in(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; },
  _start() { this.mode === "wheel" ? this.startWheel() : this.startRace(); },
  press(p) {
    if (this.phase === "setup") {
      const R = this._rects();
      if (this._in(p, R.minus)) { this.n = Math.max(2, this.n - 1); if (this.api) this.api.sound.select(); return; }
      if (this._in(p, R.plus)) { this.n = Math.min(12, this.n + 1); if (this.api) this.api.sound.select(); return; }
      if (this._in(p, R.start)) { this._start(); return; }
      return;
    }
    if (this.phase === "result" && this.resultT > 20) { this._start(); return; }
    if (this.phase === "race" && this.mode === "wheel" && this.wheelVel > 0) { this.wheelVel += 0.06; }  // 탭으로 가속(재미)
  },

  // ================= 렌더 =================
  render() {
    const ctx = this.ctx, api = this.api, VW = this.VW, VH = this.VH;
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, "#141430"); g.addColorStop(1, "#26204a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    if (this.phase === "setup") { this._renderSetup(); return; }
    if (this.mode === "wheel") this._renderWheel(); else this._renderRace();
  },

  _renderSetup() {
    const api = this.api, ctx = this.ctx, VW = this.VW;
    api.text(this.mode === "wheel" ? "돌림판" : "구슬 레이스", VW / 2, 70, 20, "#ffd84d");
    api.text("인원을 정하고 " + (this.mode === "wheel" ? "돌려요!" : "출발!"), VW / 2, 96, 9, "rgba(255,255,255,.6)");
    const R = this._rects();
    api.roundRect(R.minus.x, R.minus.y, R.minus.w, R.minus.h, 8, "rgba(255,255,255,.12)");
    api.text("−", R.minus.x + R.minus.w / 2, R.minus.y + 24, 22, "#fff");
    api.roundRect(R.plus.x, R.plus.y, R.plus.w, R.plus.h, 8, "rgba(255,255,255,.12)");
    api.text("+", R.plus.x + R.plus.w / 2, R.plus.y + 24, 20, "#fff");
    api.text(this.n + "명", VW / 2, R.minus.y + 23, 18, "#fff");
    const sp = Math.min(22, (VW - 24) / this.n), rad = Math.max(4, Math.min(8, sp * 0.4));
    for (let i = 0; i < this.n; i++) {
      const x = VW / 2 - (this.n - 1) * sp / 2 + i * sp;
      ctx.fillStyle = this.COLORS[i]; ctx.beginPath(); ctx.arc(x, 224, rad, 0, Math.PI * 2); ctx.fill();
      api.text(this.LETTERS[i], x, 224 + rad * 0.5, Math.min(8, rad + 1), "#1a1228");
    }
    api.roundRect(R.start.x, R.start.y, R.start.w, R.start.h, 10, "#ffd84d");
    api.text(this.mode === "wheel" ? "돌리기!" : "출발!", VW / 2, R.start.y + 24, 18, "#1a1228");
  },

  _renderRace() {
    const ctx = this.ctx, api = this.api, VW = this.VW, VH = this.VH;
    ctx.save(); ctx.translate(0, -this.cam);
    api.px(this.WALL_L - 4, 0, 4, this.WORLD_H, "#3a2f5e");
    api.px(this.WALL_R, 0, 4, this.WORLD_H, "#3a2f5e");
    ctx.fillStyle = "#6a5a9e";
    for (const p of this.pegs) { if (p.y < this.cam - 10 || p.y > this.cam + VH + 10) continue; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    for (let x = this.WALL_L; x < this.WALL_R; x += 12) api.px(x, this.FINISH_Y, 6, 4, x / 12 % 2 ? "#ffd84d" : "#1a1228");
    for (const m of this.marbles) {
      ctx.fillStyle = m.col; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      api.text(m.letter, m.x, m.y + 3, 8, "#1a1228");
    }
    ctx.restore();
    // 상단 범례
    api.px(0, 0, VW, 16, "rgba(13,10,20,.6)");
    const n = this.marbles.length, lsp = Math.min(18, (VW - 44) / n), lr = Math.min(6, lsp * 0.42);
    for (let i = 0; i < n; i++) { const lx = 38 + i * lsp; ctx.fillStyle = this.COLORS[i]; ctx.beginPath(); ctx.arc(lx, 8, lr, 0, Math.PI * 2); ctx.fill(); api.text(this.LETTERS[i], lx, 11, 7, "#1a1228"); }
    if (this.phase === "result") this._renderResultList("도착 순위");
  },

  _renderWheel() {
    const ctx = this.ctx, api = this.api, VW = this.VW;
    const cx = VW / 2, cy = 184, Rr = 84, seg = (Math.PI * 2) / this.n;
    // 세그먼트
    for (let i = 0; i < this.n; i++) {
      const a0 = this.wheelAng + i * seg;
      ctx.fillStyle = this.COLORS[i];
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, Rr, a0, a0 + seg); ctx.closePath(); ctx.fill();
      const am = a0 + seg / 2, lx = cx + Math.cos(am) * Rr * 0.66, ly = cy + Math.sin(am) * Rr * 0.66;
      const lsize = this.n > 8 ? 11 : this.n > 5 ? 14 : 18;
      api.text(this.LETTERS[i], lx, ly + lsize * 0.35, lsize, "#1a1228");
    }
    ctx.strokeStyle = "#1a1228"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff7e6"; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    // 포인터(위쪽, 아래를 가리킴)
    ctx.fillStyle = "#ff5b6e";
    ctx.beginPath(); ctx.moveTo(cx, cy - Rr + 12); ctx.lineTo(cx - 11, cy - Rr - 8); ctx.lineTo(cx + 11, cy - Rr - 8); ctx.closePath(); ctx.fill();

    if (this.phase === "race") api.text("두근두근…", VW / 2, 300, 11, "rgba(255,255,255,.6)");
    if (this.phase === "result" && this.winner >= 0) {
      api.text("당첨!", VW / 2, 300, 16, this.COLORS[this.winner]);
      api.text(this.LETTERS[this.winner] + " 당첨!", VW / 2, 326, 20, this.COLORS[this.winner]);
      if (this.resultT > 20 && api.blink()) api.text("탭하면 다시", VW / 2, 348, 9, "#fff");
    }
  },

  _renderResultList(title) {
    const ctx = this.ctx, api = this.api, VW = this.VW, VH = this.VH;
    ctx.fillStyle = "rgba(13,10,20,.82)"; ctx.fillRect(0, 0, VW, VH);
    const win = this.finishOrder[0], many = this.n > 7;
    api.text("1등!", VW / 2, many ? 34 : 72, many ? 16 : 26, win ? win.col : "#ffd84d");
    const hcy = many ? 56 : 110, hr = many ? 12 : 18;
    ctx.fillStyle = win ? win.col : "#fff"; ctx.beginPath(); ctx.arc(VW / 2, hcy, hr, 0, Math.PI * 2); ctx.fill();
    api.text(win ? win.letter : "A", VW / 2, hcy + hr * 0.4, many ? 13 : 20, "#1a1228");
    let y = many ? 88 : 168; const rowH = many ? 17 : 24, fs = many ? 10 : 12, dr = many ? 6 : 7;
    this.finishOrder.forEach((m, i) => {
      ctx.fillStyle = m.col; ctx.beginPath(); ctx.arc(VW / 2 - 46, y - 4, dr, 0, Math.PI * 2); ctx.fill();
      api.text(m.letter, VW / 2 - 46, y - 1, 8, "#1a1228");
      api.text((i + 1) + "등   " + m.letter, VW / 2 + 6, y, fs, i === 0 ? "#ffd84d" : "rgba(255,255,255,.8)");
      y += rowH;
    });
    if (this.resultT > 20 && api.blink()) api.text("탭하면 다시", VW / 2, VH - 16, 10, "#fff");
  },
});
