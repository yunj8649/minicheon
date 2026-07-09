"use strict";
/* 게임 10: 풍선 터뜨리기 — 올라오는 풍선을 탭해서 터뜨려라. 하나라도 놓치면 끝. */
(function () {
  const COLORS = ["#ff5b6e", "#5ec9ff", "#7CFFA0", "#ffd84d", "#ff9aa8"];
  MG.register({
    id: "pop",
    title: "풍선 터뜨리기",
    subtitle: "POP",
    accent: "#ff5b6e",
    how: "올라오는 풍선을 탭! 놓치면 끝",
    icon(api, x, y, t) {
      const by = y + 6 - ((t * 0.5) % 22);
      const ctx = api.ctx;
      ctx.fillStyle = "#ff5b6e"; ctx.beginPath(); ctx.ellipse(x, by, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
      api.px(x, by + 6, 1, 5, "rgba(255,255,255,.4)");
    },
    create(api) {
      const { ctx, VW, VH } = api;
      let balloons, spawnT, speed;

      function reset() { balloons = []; spawnT = 24; speed = 0.9; }

      function update() {
        speed = Math.min(1.8, 0.85 + api.score / 75);
        spawnT--;
        if (spawnT <= 0) {
          balloons.push({
            x: api.rnd(26, VW - 26), y: VH + 14, r: api.rnd(13, 18),
            col: COLORS[Math.floor(api.rnd(COLORS.length))],
            sway: api.rnd(0, 6.28), vy: speed * api.rnd(0.85, 1.2),
          });
          spawnT = Math.max(30, 54 - api.score * 0.28);
        }
        for (const b of balloons) {
          b.y -= b.vy; b.sway += 0.05;
          if (b.y < -b.r) { api.shake(7); api.flash(0.55); api.sound.die(); api.gameOver(); return; }
        }
        balloons = balloons.filter((b) => !b.dead);
      }

      function press(p) {
        let hit = null;
        for (let i = balloons.length - 1; i >= 0; i--) {
          const b = balloons[i], bx = b.x + Math.sin(b.sway) * 6;
          if (Math.hypot(p.x - bx, p.y - b.y) <= b.r + 4) { hit = b; break; }
        }
        if (hit) {
          hit.dead = true; api.addScore(1); api.sound.score(); api.flash(0.15);
          api.burst(hit.x, hit.y, hit.col, 14);
        }
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, "#123a4a"); g.addColorStop(1, "#1f5a6e");
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        // 위쪽 위험선
        api.px(0, 6, VW, 2, "rgba(255,91,110,.4)");

        for (const b of balloons) {
          const bx = b.x + Math.sin(b.sway) * 6;
          ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(bx, b.y + b.r); ctx.lineTo(bx, b.y + b.r + 8); ctx.stroke();
          ctx.fillStyle = b.col; ctx.beginPath(); ctx.ellipse(bx, b.y, b.r * 0.85, b.r, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(bx - b.r * 0.3, b.y - b.r * 0.35, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
          api.face(bx, b.y + 1, 0.8, "happy");
        }
      }

      return { reset, update, render, press };
    },
  });
})();
