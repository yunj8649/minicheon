"use strict";
/* 게임 5: 반응속도 — 초록으로 바뀌면 즉시 탭! 미리 누르거나 늦으면 끝. */
(function () {
  MG.register({
    id: "reflex",
    title: "반응속도",
    subtitle: "REFLEX",
    accent: "#7CFFA0",
    how: "초록이 되면 탭! (미리 X)",
    icon(api, x, y, t) {
      const on = Math.sin(t * 0.1) > 0;
      api.px(x - 9, y - 9, 18, 18, on ? "#2faf63" : "#7a2030");
      if (on) api.px(x - 3, y - 3, 6, 6, "#7CFFA0");
    },
    create(api) {
      const { VW, VH } = api;
      let phase, timer, goLimit;   // phase: 'wait' | 'go'

      function nextWait() { phase = "wait"; timer = Math.floor(api.rnd(40, 150)); }
      function reset() { api.score = 0; nextWait(); }

      function update() {
        timer--;
        if (phase === "wait" && timer <= 0) {
          phase = "go"; goLimit = Math.max(26, 54 - api.score * 0.6); timer = goLimit;
        } else if (phase === "go" && timer <= 0) {
          api.shake(6); api.flash(0.5); api.sound.die(); api.gameOver();  // 너무 느림
        }
      }

      function press() {
        if (phase === "wait") { api.shake(6); api.flash(0.5); api.sound.die(); api.gameOver(); }  // 성급
        else { api.addScore(1); api.sound.score(); api.flash(0.2); api.burst(VW / 2, VH / 2, "#7CFFA0", 10); nextWait(); }
      }

      function render() {
        const go = phase === "go";
        api.ctx.fillStyle = go ? "#1f7a45" : "#5a1622";
        api.ctx.fillRect(0, 0, VW, VH);
        api.ctx.fillStyle = go ? "#2faf63" : "#7a2030";
        api.ctx.fillRect(20, 110, VW - 40, VH - 220);
        // 신호등 얼굴 (대기=차분 / GO=놀람)
        const fy = VH / 2 - 18;
        api.ctx.fillStyle = go ? "#7CFFA0" : "#c0566a";
        api.ctx.beginPath(); api.ctx.arc(VW / 2, fy, 26, 0, Math.PI * 2); api.ctx.fill();
        api.face(VW / 2, fy + 2, 1.5, go ? "wow" : "happy");
        api.text(go ? "탭!" : "기다려…", VW / 2, VH / 2 + 34, go ? 24 : 14, go ? "#eaffea" : "#ffb3c0");
        api.text("성공 " + api.score, VW / 2, VH - 40, 9, "rgba(255,255,255,.6)");
      }

      return { reset, update, render, press };
    },
  });
})();
