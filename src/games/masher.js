"use strict";
/* 게임 8: 연타! — 제한시간(약 5초) 안에 최대한 많이 탭. 탭 수가 점수. */
(function () {
  MG.register({
    id: "masher",
    title: "연타!",
    subtitle: "MASHER",
    accent: "#ff8a3d",
    how: "제한시간 안에 최대한 많이 탭!",
    icon(api, x, y, t) {
      const pulse = (Math.sin(t * 0.3) + 1) / 2;
      api.ctx.fillStyle = "#ff8a3d";
      api.ctx.beginPath(); api.ctx.arc(x, y, 7 + pulse * 3, 0, Math.PI * 2); api.ctx.fill();
      api.px(x - 2, y - 2, 4, 4, "#fff2e0");
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const TOTAL = 300;   // 약 5초 (60fps 기준)
      let timeLeft, bump;

      function reset() { api.score = 0; timeLeft = TOTAL; bump = 0; }

      function update() {
        timeLeft--;
        if (bump > 0) bump *= 0.8;
        if (timeLeft <= 0) { api.sound.die(); api.flash(0.4); api.gameOver(); }
      }

      function press() {
        api.addScore(1); api.sound.score(); api.flash(0.12); bump = 1;
        api.burst(VW / 2, VH / 2 + 10, "#ff8a3d", 6);
      }

      function render() {
        ctx.fillStyle = "#2a1606"; ctx.fillRect(0, 0, VW, VH);
        // 시간 게이지
        const w = (VW - 40) * (timeLeft / TOTAL);
        api.px(20, 72, VW - 40, 6, "rgba(0,0,0,.4)");
        api.px(20, 72, Math.max(0, w), 6, timeLeft < TOTAL * 0.25 ? "#ff5b6e" : "#ff8a3d");
        api.text((timeLeft / 60).toFixed(1) + "s", VW / 2, 96, 9, "rgba(255,255,255,.6)");

        // 큰 버튼
        const r = 56 + bump * 8;
        ctx.fillStyle = "#5a2c0e"; ctx.beginPath(); ctx.arc(VW / 2, VH / 2 + 10, r + 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ff8a3d"; ctx.beginPath(); ctx.arc(VW / 2, VH / 2 + 10, r, 0, Math.PI * 2); ctx.fill();
        api.face(VW / 2, VH / 2 + 4, 2.6, bump > 0.4 ? "wow" : "happy");
        api.text("연타하세요", VW / 2, VH - 40, 9, "rgba(255,255,255,.6)");
      }

      return { reset, update, render, press };
    },
  });
})();
