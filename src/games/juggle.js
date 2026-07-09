"use strict";
/* 게임 14: 공 튕기기 — 떨어지는 공을 탭해서 계속 띄운다. 바닥에 떨어지면 끝.
   점수가 오르면 공이 늘어난다. */
(function () {
  const COLORS = ["#ffd84d", "#ff5b6e", "#5ec9ff", "#7CFFA0", "#ff9aa8"];
  MG.register({
    id: "juggle",
    title: "공 튕기기",
    subtitle: "JUGGLE",
    accent: "#ffd84d",
    how: "공을 탭해서 계속 띄워요",
    icon(api, x, y, t) {
      const by = y - Math.abs(Math.sin(t * 0.12)) * 8;
      api.ctx.fillStyle = "#ffd84d"; api.ctx.beginPath(); api.ctx.arc(x, by, 7, 0, Math.PI * 2); api.ctx.fill();
      api.face(x, by, 0.7, "happy");
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const R = 13, BOUNCE = -6.0;
      let balls, grav, nextAdd;

      function makeBall() {
        return { x: api.rnd(40, VW - 40), y: 120, vx: api.rnd(-0.8, 0.8), vy: -2, col: COLORS[Math.floor(api.rnd(COLORS.length))] };
      }
      function reset() { balls = [makeBall()]; grav = 0.12; nextAdd = 15; api.score = 0; }

      function update() {
        grav = Math.min(0.155, 0.11 + api.score / 1700);
        for (const b of balls) {
          b.vy += grav; b.x += b.vx; b.y += b.vy;
          if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
          if (b.x > VW - R) { b.x = VW - R; b.vx = -Math.abs(b.vx); }
          if (b.y > VH + R) { api.shake(7); api.flash(0.55); api.sound.die(); api.gameOver(); return; }
        }
        if (api.score >= nextAdd && balls.length < 4) { balls.push(makeBall()); nextAdd += 16 + balls.length * 6; }
      }

      function press(p) {
        // 공을 직접 안 맞춰도, 탭 지점 근처/위쪽의 공이면 너그럽게 튕김
        let hit = null, hd = 1e9;
        for (const b of balls) {
          const dx = p.x - b.x, dy = Math.max(0, b.y - p.y);   // 공이 탭보다 위면 가중치↓
          const d = Math.hypot(dx, dy * 0.6);
          if (d <= R + 18 && d < hd) { hd = d; hit = b; }
        }
        if (hit) {
          hit.vy = BOUNCE;
          hit.vx += (hit.x - p.x) * 0.12;
          hit.vx = Math.max(-2.6, Math.min(2.6, hit.vx));
          api.addScore(1); api.sound.score(); api.flash(0.12); api.sparkle(hit.x, hit.y, hit.col, 8);
        }
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, "#2a2440"); g.addColorStop(1, "#3e3360");
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        api.px(0, VH - 4, VW, 4, "#ff5b6e");   // 위험 바닥
        api.text("탭으로 띄우기", VW / 2, VH - 12, 8, "rgba(255,255,255,.4)");

        for (const b of balls) {
          ctx.fillStyle = "rgba(0,0,0,.25)";
          ctx.beginPath(); ctx.ellipse(b.x, VH - 8, R * 0.7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,.3)";
          ctx.beginPath(); ctx.arc(b.x - 4, b.y - 4, 3, 0, Math.PI * 2); ctx.fill();
          api.face(b.x, b.y, 0.9, b.vy < 0 ? "wow" : "happy");
        }
      }

      return { reset, update, render, press };
    },
  });
})();
