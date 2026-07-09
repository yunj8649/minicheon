"use strict";
/* 게임 6: 색 맞추기 — 목표 색이 나올 때만 탭. 아니면 탭 금지. */
(function () {
  const COLORS = ["#ff5b6e", "#5ec9ff", "#7CFFA0", "#ffd84d"];
  MG.register({
    id: "match",
    title: "색 맞추기",
    subtitle: "MATCH",
    accent: "#ff9aa8",
    how: "목표 색일 때만 탭!",
    icon(api, x, y, t) {
      const c = COLORS[Math.floor(t * 0.04) % COLORS.length];
      api.px(x - 9, y - 9, 18, 18, c);
      api.px(x - 9, y - 9, 18, 2, "rgba(255,255,255,.4)");
    },
    create(api) {
      const { VW, VH } = api;
      let target, cur, window_, maxWindow, isMatch;

      function nextRound() {
        maxWindow = Math.max(55, 115 - api.score * 1.0);
        window_ = maxWindow;
        isMatch = Math.random() < 0.45;
        if (isMatch) cur = target;
        else { do { cur = COLORS[Math.floor(api.rnd(COLORS.length))]; } while (cur === target); }
      }
      function reset() {
        api.score = 0;
        target = COLORS[Math.floor(api.rnd(COLORS.length))];
        nextRound();
      }

      function update() {
        window_--;
        if (window_ <= 0) {
          if (isMatch) { api.shake(6); api.flash(0.5); api.sound.die(); api.gameOver(); } // 놓침
          else nextRound();  // 안 누르고 잘 참음
        }
      }

      function press() {
        if (isMatch) { api.addScore(1); api.sound.score(); api.flash(0.2); api.burst(VW / 2, 150, target, 10); nextRound(); }
        else { api.shake(6); api.flash(0.5); api.sound.die(); api.burst(VW / 2, 150, "#fff", 12); api.gameOver(); }
      }

      function render() {
        api.ctx.fillStyle = "#15121f"; api.ctx.fillRect(0, 0, VW, VH);
        api.text("이 색일 때만 탭", VW / 2, 86, 9, "rgba(255,255,255,.6)");
        api.px(VW / 2 - 16, 96, 32, 16, target);   // 목표 색 스와치
        api.px(VW / 2 - 16, 96, 32, 2, "rgba(255,255,255,.4)");

        // 현재 색 패널 (귀여운 얼굴 — 표정은 항상 동일해서 정답 힌트가 되지 않음)
        api.roundRect(40, 150, VW - 80, VW - 80, 14, cur);
        api.px(40, 150, VW - 80, 3, "rgba(255,255,255,.3)");
        api.face(VW / 2, 150 + (VW - 80) / 2, 1.7, "happy");
        // 남은 시간 게이지
        const w = (VW - 80) * (window_ / maxWindow);
        api.px(40, 150 + (VW - 80) + 8, VW - 80, 4, "rgba(0,0,0,.4)");
        api.px(40, 150 + (VW - 80) + 8, Math.max(0, w), 4, isMatch ? "#7CFFA0" : "rgba(255,255,255,.3)");
        api.text("연속 " + api.score, VW / 2, VH - 24, 9, "rgba(255,255,255,.6)");
      }

      return { reset, update, render, press };
    },
  });
})();
