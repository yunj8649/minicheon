"use strict";
/* 게임 3: 두더지 잡기 — 튀어나온 두더지를 시간 안에 탭. 놓치면 끝. */
(function () {
  MG.register({
    id: "whack",
    title: "두더지 잡기",
    subtitle: "WHACK",
    accent: "#c98a5e",
    how: "튀어나온 두더지를 탭!",
    icon(api, x, y, t) {
      const ctx = api.ctx;
      const ph = (Math.sin(t * 0.12) + 1) / 2;
      ctx.fillStyle = "#1a120c"; ctx.beginPath(); ctx.ellipse(x, y + 6, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(x - 11, y - 12, 22, 18); ctx.clip();
      ctx.fillStyle = "#9c6b3f"; ctx.beginPath(); ctx.ellipse(x, y + 6 - ph * 10, 8, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    create(api) {
      const { ctx } = api;
      const C = { bg1: "#1d3a1d", bg2: "#2e5a2e", hole: "#1a120c", dirt: "#3a2418", mole: "#9c6b3f", moleDark: "#6e4a28" };
      // 3x3 구멍 좌표
      const HOLES = [];
      const cols = [52, 100, 148], rows = [150, 215, 280];
      for (const ry of rows) for (const cx of cols) HOLES.push({ x: cx, y: ry });
      let active, timer, maxTimer, pop;

      function pick() {
        let n; do { n = Math.floor(api.rnd(HOLES.length)); } while (n === active);
        active = n;
        maxTimer = Math.max(44, 95 - api.score * 0.9);
        timer = maxTimer; pop = 0;
      }
      function reset() { active = -1; api.score = 0; pick(); }

      function update() {
        if (pop < 1) pop = Math.min(1, pop + 0.18);
        timer--;
        if (timer <= 0) { api.shake(6); api.flash(0.5); api.sound.die(); api.gameOver(); }
      }

      function press(p) {
        const h = HOLES[active];
        const r = 6 + pop * 14;
        if (Math.hypot(p.x - h.x, p.y - (h.y - r * 0.4)) <= 20) {
          api.addScore(1); api.sound.score(); api.flash(0.18);
          api.burst(h.x, h.y - 6, C.mole, 10);
          pick();
        }
      }

      function drawMole(h, ph) {
        const r = 6 + ph * 14;
        ctx.save();
        ctx.beginPath(); ctx.rect(h.x - 16, h.y - 30, 32, 30); ctx.clip(); // 구멍 위로만 보이게
        const my = h.y - r * 0.4;
        ctx.fillStyle = C.mole;
        ctx.beginPath(); ctx.ellipse(h.x, my, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.moleDark;
        ctx.fillRect(h.x - 12, my, 24, 8);
        ctx.fillStyle = "#f0b89a";                   // 주둥이
        ctx.beginPath(); ctx.ellipse(h.x, my + 4, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        api.face(h.x, my, 1, "happy");
        ctx.restore();
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, api.VH);
        g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, api.VW, api.VH);

        for (let i = 0; i < HOLES.length; i++) {
          const h = HOLES[i];
          ctx.fillStyle = C.dirt; ctx.beginPath(); ctx.ellipse(h.x, h.y, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = C.hole; ctx.beginPath(); ctx.ellipse(h.x, h.y - 1, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
          if (i === active) drawMole(h, pop);
        }
        // 남은 시간 게이지
        const w = (api.VW - 40) * (timer / maxTimer);
        api.px(20, api.VH - 22, api.VW - 40, 4, "rgba(0,0,0,.4)");
        api.px(20, api.VH - 22, Math.max(0, w), 4, timer < maxTimer * 0.3 ? C.moleDark : "#ffd84d");
      }

      return { reset, update, render, press };
    },
  });
})();
