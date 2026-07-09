"use strict";
/* 게임: 칼 꽂기 — 돌아가는 통나무에 칼을 던져 꽂는다. 칼끼리 부딪히면 끝.
   탭 = 던지기. 각도/회전 기반이라 다른 게임들과 메커니즘이 겹치지 않음. */
(function () {
  const PI = Math.PI, TAU = PI * 2, MIN_GAP = 0.3;
  function norm(a) { while (a < -PI) a += TAU; while (a > PI) a -= TAU; return a; }

  MG.register({
    id: "knife",
    title: "칼 꽂기",
    subtitle: "KNIFE",
    accent: "#d7dde6",
    how: "탭 = 칼 던지기 / 칼끼리 부딪히면 끝",
    icon(api, x, y, t) {
      const ctx = api.ctx;
      ctx.fillStyle = "#9c6b3f"; ctx.beginPath(); ctx.arc(x, y - 1, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = "#6e4a28"; ctx.beginPath(); ctx.arc(x, y - 1, 3, 0, TAU); ctx.fill();
      const a = t * 0.12;
      api.px(x + Math.cos(a) * 7 - 1, y - 1 + Math.sin(a) * 7 - 1, 2, 2, "#eef2f7");
      api.px(x - 1, y + 8, 2, 5, "#cfd8e3");   // 아래 대기 칼
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const CX = VW / 2, CY = 128, R = 44;
      let rot, dir, mag, knives, flying, flipT;

      function reset() {
        rot = 0; dir = 1; mag = 0.02; knives = []; flying = null; flipT = api.rnd(120, 280);
        api.score = 0;
      }

      function press() { if (!flying) { flying = { y: VH - 44 }; api.sound.jump(); } }

      function resolve() {
        const local = norm(PI / 2 - rot);     // 통나무 아래(바닥)에 꽂힘
        for (const k of knives) {
          if (Math.abs(norm(local - k)) < MIN_GAP) {   // 다른 칼과 충돌
            api.shake(8); api.flash(0.5); api.sound.die();
            api.burst(CX, CY + R, "#d7dde6", 16);
            api.gameOver(); flying = null; return;
          }
        }
        knives.push(local);
        api.addScore(1); api.sound.score(); api.flash(0.16);
        api.burst(CX, CY + R, "#ffd84d", 6);
        mag = Math.min(0.048, 0.02 + api.score * 0.0009);
        flying = null;
      }

      function update() {
        rot = norm(rot + dir * mag);
        if (api.score > 3) { flipT--; if (flipT <= 0) { if (Math.random() < 0.6) dir = -dir; flipT = api.rnd(110, 240); } }
        if (flying) { flying.y -= 13; if (flying.y <= CY + R) resolve(); }
      }

      function drawKnife(a, len) {
        const cos = Math.cos(a), sin = Math.sin(a);
        ctx.strokeStyle = "#eef2f7"; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(CX + cos * (R - 5), CY + sin * (R - 5));
        ctx.lineTo(CX + cos * (R + len), CY + sin * (R + len));
        ctx.stroke();
        ctx.fillStyle = "#6e4a28";   // 손잡이
        ctx.fillRect(CX + cos * (R + len) - 2, CY + sin * (R + len) - 2, 4, 4);
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, "#241c14"); g.addColorStop(1, "#3a2c1c");
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

        // 통나무
        ctx.fillStyle = "#9c6b3f"; ctx.beginPath(); ctx.arc(CX, CY, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#7a5230"; ctx.lineWidth = 2;
        for (let rr = R - 8; rr > 8; rr -= 10) { ctx.beginPath(); ctx.arc(CX, CY, rr, 0, TAU); ctx.stroke(); }

        // 꽂힌 칼 (회전)
        for (const k of knives) drawKnife(k + rot, 14);
        // 통나무 얼굴
        api.face(CX, CY - 2, 1.6, "happy");

        // 날아가는 칼 + 대기 칼
        if (flying) { ctx.fillStyle = "#cfd8e3"; ctx.fillRect(CX - 1, flying.y, 3, 18); ctx.fillStyle = "#6e4a28"; ctx.fillRect(CX - 2, flying.y + 16, 5, 5); }
        else { ctx.fillStyle = "#cfd8e3"; ctx.fillRect(CX - 1, VH - 40, 3, 18); ctx.fillStyle = "#6e4a28"; ctx.fillRect(CX - 2, VH - 24, 5, 5); }

        api.text("칼 " + api.score, CX, VH - 8, 8, "rgba(255,255,255,.5)");
      }

      return { reset, update, render, press };
    },
  });
})();
