"use strict";
/* 게임 13: 블록 쌓기 — 좌우로 움직이는 블록을 탭해서 떨군다.
   아래 블록과 겹친 부분만 남고 삐져나온 만큼 잘린다. 안 겹치면 끝. */
(function () {
  const COLORS = ["#ff5b6e", "#ff8a3d", "#ffd84d", "#7CFFA0", "#5ec9ff", "#9b6bff", "#ff9aa8"];
  MG.register({
    id: "stack",
    title: "블록 쌓기",
    subtitle: "STACK",
    accent: "#5ec9ff",
    how: "탭해서 정확히 쌓아요",
    icon(api, x, y, t) {
      const s = Math.sin(t * 0.1) * 5;
      api.roundRect(x - 8, y + 3, 16, 5, 1, "#5ec9ff");
      api.roundRect(x - 7, y - 2, 14, 5, 1, "#7CFFA0");
      api.roundRect(x - 6 + s, y - 7, 12, 5, 1, "#ffd84d");
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const H = 15, FLOORY = VH - 24, TARGET = 150;
      let stack, cur, offset;

      function spawnNext() {
        const last = stack[stack.length - 1];
        cur = {
          x: 0, w: last.w, dir: 1,
          speed: Math.min(3.0, 1.5 + stack.length * 0.075),
          col: COLORS[stack.length % COLORS.length],
        };
      }
      function reset() {
        stack = [{ x: VW / 2 - 34, w: 68, col: COLORS[0] }];
        offset = 0; api.score = 0; spawnNext();
      }

      function update() {
        cur.x += cur.dir * cur.speed;
        if (cur.x <= 0) { cur.x = 0; cur.dir = 1; }
        if (cur.x + cur.w >= VW) { cur.x = VW - cur.w; cur.dir = -1; }
        const targetOff = Math.max(0, TARGET - (FLOORY - stack.length * H));
        offset += (targetOff - offset) * 0.2;
      }

      function press() {
        const last = stack[stack.length - 1];
        const left = Math.max(cur.x, last.x), right = Math.min(cur.x + cur.w, last.x + last.w);
        if (right <= left) {            // 안 겹침 → 끝
          api.shake(7); api.flash(0.5); api.sound.die();
          api.burst(cur.x + cur.w / 2, blockTopY(stack.length), cur.col, 16);
          api.gameOver(); return;
        }
        const w = right - left;
        const perfect = cur.w - w < 3;
        // 잘려나간 부분 파편
        if (cur.x < left) api.burst(cur.x, blockTopY(stack.length) + H / 2, cur.col, 6);
        if (cur.x + cur.w > right) api.burst(cur.x + cur.w, blockTopY(stack.length) + H / 2, cur.col, 6);
        stack.push({ x: left, w: perfect ? last.w : w, col: cur.col });
        api.addScore(1); api.sound.score(); api.flash(perfect ? 0.3 : 0.15);
        if (perfect) api.sparkle(left + w / 2, blockTopY(stack.length - 1), "#fff7e6", 10);
        spawnNext();
      }

      function blockTopY(level) { return FLOORY - (level + 1) * H + offset; }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, "#0e2030"); g.addColorStop(1, "#1c3a52");
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

        for (let i = 0; i < stack.length; i++) {
          const b = stack[i], ty = blockTopY(i);
          if (ty > VH || ty + H < 0) continue;
          api.roundRect(b.x, ty, b.w, H - 1, 2, b.col);
          api.px(b.x, ty, b.w, 2, "rgba(255,255,255,.25)");
        }
        // 움직이는 블록
        const ty = blockTopY(stack.length);
        api.roundRect(cur.x, ty, cur.w, H - 1, 2, cur.col);
        api.px(cur.x, ty, cur.w, 2, "rgba(255,255,255,.3)");
        api.face(cur.x + cur.w / 2, ty + 7, 1, "happy");
      }

      return { reset, update, render, press };
    },
  });
})();
