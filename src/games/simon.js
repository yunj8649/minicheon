"use strict";
/* 게임 9: 기억! — 색 순서를 보여주면 똑같이 따라 탭. 한 단계씩 길어진다. */
(function () {
  const COLS = ["#ff5b6e", "#5ec9ff", "#7CFFA0", "#ffd84d"];
  const DIM  = ["#5a2730", "#244a5e", "#2a5a3a", "#5a4a1a"];
  MG.register({
    id: "simon",
    title: "기억!",
    subtitle: "SIMON",
    accent: "#c08cff",
    how: "색 순서를 기억해 따라 탭!",
    icon(api, x, y, t) {
      const lit = Math.floor(t * 0.06) % 4;
      const q = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (let i = 0; i < 4; i++)
        api.px(x + q[i][0] * 7 - 6 + (q[i][0] > 0 ? 1 : 0), y + q[i][1] * 7 - 6 + (q[i][1] > 0 ? 1 : 0), 11, 11, i === lit ? COLS[i] : DIM[i]);
    },
    create(api) {
      const { VW } = api;
      const X0 = 28, Y0 = 116, SZ = VW - 56, HALF = SZ / 2, GAP = 4;
      let seq, phase, st, inputIdx, flashQ, flashT, stepDur;

      function quadRect(i) {
        const c = i % 2, r = Math.floor(i / 2);
        return { x: X0 + c * HALF + GAP / 2, y: Y0 + r * HALF + GAP / 2, w: HALF - GAP, h: HALF - GAP };
      }
      function startShow() { phase = "show"; st = 0; flashQ = -1; flashT = 0; stepDur = Math.max(30, 46 - seq.length); }
      function reset() { seq = [Math.floor(api.rnd(4))]; api.score = 0; startShow(); }

      function update() {
        if (flashT > 0) flashT--;
        if (phase === "show") {
          st++;
          const i = Math.floor(st / stepDur), within = st % stepDur;
          if (i >= seq.length) { phase = "input"; inputIdx = 0; flashQ = -1; return; }
          if (within < stepDur * 0.62) { flashQ = seq[i]; } else { flashQ = -1; }
        } else if (phase === "wait") {
          st--; if (st <= 0) startShow();
        }
      }

      function press(p) {
        if (phase !== "input") return;
        if (p.x < X0 || p.x > X0 + SZ || p.y < Y0 || p.y > Y0 + SZ) return;
        const c = p.x < X0 + HALF ? 0 : 1, r = p.y < Y0 + HALF ? 0 : 1, q = r * 2 + c;
        flashQ = q; flashT = 12;
        if (q === seq[inputIdx]) {
          api.sound.select(); inputIdx++;
          if (inputIdx >= seq.length) {           // 한 바퀴 성공
            api.addScore(1); api.sound.score(); api.flash(0.2);
            seq.push(Math.floor(api.rnd(4)));
            phase = "wait"; st = 30; flashQ = -1;
          }
        } else {
          api.shake(6); api.flash(0.5); api.sound.die(); api.gameOver();
        }
      }

      function render() {
        api.ctx.fillStyle = "#15121f"; api.ctx.fillRect(0, 0, VW, api.VH);
        const showing = phase === "show";
        api.text(showing ? "잘 보세요…" : phase === "input" ? "따라 하세요!" : "준비…",
          VW / 2, 96, 10, showing ? "#c08cff" : "#fff7e6");
        for (let i = 0; i < 4; i++) {
          const r = quadRect(i);
          const on = flashQ === i && (showing || flashT > 0 || phase === "wait");
          api.px(r.x, r.y, r.w, r.h, on ? COLS[i] : DIM[i]);
          if (on) { api.px(r.x, r.y, r.w, 3, "rgba(255,255,255,.5)"); api.face(r.x + r.w / 2, r.y + r.h / 2, 1.4, "wow"); }
        }
        api.text("단계 " + seq.length, VW / 2, api.VH - 24, 9, "rgba(255,255,255,.6)");
      }

      return { reset, update, render, press };
    },
  });
})();
