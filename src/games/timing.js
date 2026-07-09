"use strict";
/* 게임 2: 딱 멈춰! — 움직이는 바늘을 초록 칸 안에서 탭하면 성공.
   탭 타이밍 게임. 성공할수록 칸이 좁아지고 빨라진다. 빗나가면 끝. */
(function () {
  MG.register({
    id: "stopit",
    title: "딱 멈춰!",
    subtitle: "STOP IT",
    accent: "#7CFFA0",
    how: "초록 칸에서 탭하세요",
    icon(api, x, y, t) {
      api.px(x - 12, y - 3, 24, 6, "#0a1626");
      api.px(x + 2, y - 3, 8, 6, "#2faf63");          // 초록 칸
      const mx = x + Math.sin(t * 0.1) * 12;
      api.px(mx - 1, y - 6, 2, 12, "#ffd84d");         // 마커
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const C = {
        bg1: "#10233a", bg2: "#1c3a5e", track: "#0a1626",
        zone: "#7CFFA0", zoneDark: "#2faf63", marker: "#ffd84d", bad: "#ff5b6e",
      };
      const TX = 24, TW = VW - 48;          // 트랙 x, 폭
      const TY = 188, TH = 26;              // 트랙 y, 높이
      let t, dir, sp, c, hw, flashT;        // 위치(0~1), 방향, 속도, 칸중심, 칸반폭

      function newZone() {
        hw = Math.max(0.08, hw * 0.95);
        c = api.rnd(0.12, 0.88);
        sp = Math.min(0.028, sp + 0.0009);
      }
      function reset() {
        t = 0; dir = 1; sp = 0.009; hw = 0.24; c = api.rnd(0.2, 0.8); flashT = 0;
      }

      function update() {
        t += dir * sp;
        if (t >= 1) { t = 1; dir = -1; } else if (t <= 0) { t = 0; dir = 1; }
        if (flashT > 0) flashT--;
      }

      function press() {
        const mx = TX + t * TW;
        if (Math.abs(t - c) <= hw) {
          api.addScore(1); api.sound.score(); api.flash(0.2); flashT = 6;
          api.burst(mx, TY + TH / 2, C.zone, 10);
          newZone();
        } else {
          api.shake(6); api.flash(0.5); api.sound.die();
          api.burst(mx, TY + TH / 2, C.bad, 16);
          api.gameOver();
        }
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

        // 트랙
        api.px(TX - 3, TY - 3, TW + 6, TH + 6, "rgba(0,0,0,.4)");
        api.px(TX, TY, TW, TH, C.track);

        // 초록 목표 칸
        const zx = TX + (c - hw) * TW, zw = hw * 2 * TW;
        api.px(zx, TY, zw, TH, C.zoneDark);
        api.px(zx, TY, zw, 3, C.zone);
        api.px(zx, TY + TH - 3, zw, 3, C.zone);

        // 눈금
        ctx.fillStyle = "rgba(255,255,255,.08)";
        for (let i = 1; i < 10; i++) ctx.fillRect(TX + (i / 10) * TW, TY + 2, 1, TH - 4);

        // 바늘(마커) + 위에 귀여운 얼굴
        const mx = TX + t * TW;
        api.px(mx - 2, TY - 6, 4, TH + 12, flashT > 0 ? "#fff" : C.marker);
        api.roundRect(mx - 7, TY - 24, 14, 13, 4, C.marker);
        api.face(mx, TY - 15, 0.7, flashT > 0 ? "wow" : "happy");

        // 안내
        api.text("연속 " + api.score + "회", VW / 2, TY - 26, 9, "rgba(255,255,255,.6)");
        api.text("탭!", mx, TY + TH + 22, 9, "rgba(255,255,255,.4)");
      }

      return { reset, update, render, press };
    },
  });
})();
