"use strict";
/* 게임: 좌우 피하기 — 탭하면 좌/우 차선 전환. 떨어지는 블록을 피하라. */
(function () {
  MG.register({
    id: "dodge",
    title: "좌우 피하기",
    subtitle: "DODGE",
    accent: "#5ec9ff",
    how: "탭 = 좌우 전환 / 블록을 피하세요",
    icon(api, x, y, t) {
      const side = Math.sin(t * 0.08) > 0 ? 5 : -5;
      api.px(x - 9, y - 10, 6, 6, "#ff5b6e");        // 떨어지는 블록
      api.px(x + side - 4, y + 6, 8, 6, "#5ec9ff");  // 좌우로 움직이는 플레이어
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const C = { bg1: "#141430", bg2: "#26204a", lane: "rgba(255,255,255,.05)", player: "#5ec9ff", playerDark: "#2f8fc0", block: "#ff5b6e", blockDark: "#c0334a" };
      const LANES = [VW * 0.34, VW * 0.66];
      const PLAYER_Y = VH - 60;
      let lane, px_, blocks, spawnT, speed, scrollY;

      function reset() {
        const sk = window.META ? window.META.equippedChar() : null;   // 장착 캐릭터 스킨
        if (sk) { C.player = sk.body; C.playerDark = sk.dark; }
        lane = 0; px_ = LANES[0]; blocks = []; spawnT = 30; speed = 2.0; scrollY = 0;
      }
      function press() { lane = 1 - lane; api.sound.jump(); api.puff(px_, PLAYER_Y + 8, C.player); }

      function update() {
        px_ += (LANES[lane] - px_) * 0.35;       // 부드러운 전환
        speed = Math.min(3.7, 1.9 + api.score / 50);
        scrollY = (scrollY + speed) % 24;

        spawnT -= 1;
        if (spawnT <= 0) {
          blocks.push({ lane: Math.floor(api.rnd(2)), y: -14, scored: false });
          spawnT = Math.max(36, 58 - api.score * 0.22);
        }
        for (const b of blocks) {
          b.y += speed;
          if (!b.scored && b.y > PLAYER_Y + 10) { b.scored = true; api.addScore(1); api.sound.score(); }
          if (b.lane === lane && Math.abs(b.y - PLAYER_Y) < 11) {
            api.shake(7); api.flash(0.55); api.sound.die();
            api.burst(px_, PLAYER_Y, C.player, 16); api.gameOver(); break;
          }
        }
        blocks = blocks.filter((b) => b.y < VH + 20);
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

        // 차선 + 스크롤 점선
        for (const lx of LANES) {
          api.px(lx - 22, 0, 44, VH, C.lane);
          ctx.fillStyle = "rgba(255,255,255,.10)";
          for (let y = -24 + scrollY; y < VH; y += 24) ctx.fillRect(lx - 1, y, 2, 12);
        }

        for (const b of blocks) {
          const bx = LANES[b.lane];
          api.roundRect(bx - 13, b.y - 11, 26, 22, 6, C.block);
          api.px(bx - 13, b.y + 6, 26, 5, C.blockDark);
          // 뾰로통한 눈 (작은 몬스터)
          api.px(bx - 7, b.y - 3, 4, 2, "#3a0a12");
          api.px(bx + 3, b.y - 3, 4, 2, "#3a0a12");
          api.px(bx - 6, b.y - 4, 2, 2, "#fff");
          api.px(bx + 4, b.y - 4, 2, 2, "#fff");
          api.px(bx - 2, b.y + 4, 4, 2, "#3a0a12");
        }

        // 플레이어 (둥글둥글 캐릭터)
        const pop = Math.abs(LANES[lane] - px_) > 3;
        api.roundRect(px_ - 11, PLAYER_Y - 11, 22, 22, 7, C.player);
        api.px(px_ - 10, PLAYER_Y + 6, 20, 5, C.playerDark);
        api.face(px_, PLAYER_Y - 1, 1, pop ? "wow" : "happy");
      }

      return { reset, update, render, press };
    },
  });
})();
