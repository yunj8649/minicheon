"use strict";
/* 게임 11: 꼬리잡기(스네이크) — 화면 왼쪽 탭=좌회전, 오른쪽 탭=우회전.
   사과를 먹어 몸을 늘리고, 벽이나 자기 몸에 부딪히면 끝. */
(function () {
  MG.register({
    id: "snake",
    title: "꼬리잡기",
    subtitle: "SNAKE",
    accent: "#5bd96b",
    how: "왼쪽탭=좌, 오른쪽탭=우 / 사과를 먹어요",
    icon(api, x, y, t) {
      const w = Math.sin(t * 0.1) > 0 ? 1 : 0;
      api.px(x - 9, y - 2, 5, 5, "#5bd96b");
      api.px(x - 4, y - 2, 5, 5, "#5bd96b");
      api.px(x + 1, y - 2 - w, 5, 5, "#7CFFA0");   // 머리(까딱)
      api.px(x + 6, y + 3, 4, 4, "#ff5b6e");        // 사과
    },
    create(api) {
      const { ctx, VW } = api;
      const COLS = 20, ROWS = 28, CELL = 10, OY = 64;
      const cx = (gx) => gx * CELL, cy = (gy) => OY + gy * CELL;
      let snake, dir, pending, food, tick, moveEvery, grow, headCol;

      function placeFood() {
        let p;
        do { p = { x: Math.floor(api.rnd(COLS)), y: Math.floor(api.rnd(ROWS)) }; }
        while (snake.some((s) => s.x === p.x && s.y === p.y));
        food = p;
      }
      function reset() {
        snake = [{ x: 7, y: 14 }, { x: 6, y: 14 }, { x: 5, y: 14 }];
        dir = { x: 1, y: 0 }; pending = null;
        tick = 0; moveEvery = 12; grow = 0; api.score = 0;
        const sk = window.META ? window.META.equippedChar() : null;   // 장착 캐릭터 = 머리 색
        headCol = sk ? sk.body : "#9bff9b";
        placeFood();
      }

      function press(p) {
        // 왼쪽 절반 탭 = 좌회전(반시계), 오른쪽 = 우회전(시계)
        pending = p.x < VW / 2 ? "L" : "R";
        api.sound.jump();
      }

      function step() {
        if (pending === "L") dir = { x: dir.y, y: -dir.x };
        else if (pending === "R") dir = { x: -dir.y, y: dir.x };
        pending = null;

        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        // 벽 충돌
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return die();
        // 몸 충돌 (먹지 않을 땐 꼬리는 비켜주므로 제외)
        const willEat = head.x === food.x && head.y === food.y;
        const checkLen = willEat ? snake.length : snake.length - 1;
        for (let i = 0; i < checkLen; i++)
          if (snake[i].x === head.x && snake[i].y === head.y) return die();

        snake.unshift(head);
        if (willEat) {
          api.addScore(1); api.sound.score(); api.flash(0.18);
          api.burst(cx(head.x) + CELL / 2, cy(head.y) + CELL / 2, "#ff5b6e", 10);
          moveEvery = Math.max(6, 12 - Math.floor(api.score / 6));
          placeFood();
        } else {
          snake.pop();
        }
      }
      function die() { api.shake(7); api.flash(0.5); api.sound.die(); api.gameOver(); }

      function update() {
        tick++;
        if (tick >= moveEvery) { tick = 0; step(); }
      }

      function render() {
        ctx.fillStyle = "#0f1a12"; ctx.fillRect(0, 0, VW, api.VH);
        // 격자 영역
        ctx.fillStyle = "#13241a"; ctx.fillRect(0, OY, COLS * CELL, ROWS * CELL);
        ctx.fillStyle = "rgba(255,255,255,.03)";
        for (let i = 1; i < COLS; i++) ctx.fillRect(i * CELL, OY, 1, ROWS * CELL);
        for (let j = 1; j < ROWS; j++) ctx.fillRect(0, OY + j * CELL, COLS * CELL, 1);

        // 사과
        ctx.fillStyle = "#ff5b6e";
        ctx.beginPath(); ctx.arc(cx(food.x) + CELL / 2, cy(food.y) + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2); ctx.fill();
        api.px(cx(food.x) + CELL / 2, cy(food.y) + 1, 1, 2, "#5bd96b");   // 꼭지

        // 뱀
        for (let i = snake.length - 1; i >= 0; i--) {
          const s = snake[i];
          const col = i === 0 ? headCol : i === snake.length - 1 ? "#3fa84f" : "#5bd96b";
          api.px(cx(s.x) + 1, cy(s.y) + 1, CELL - 2, CELL - 2, col);
        }
        // 머리 표정
        const h = snake[0];
        api.face(cx(h.x) + CELL / 2, cy(h.y) + CELL / 2 - 1, 0.7, "happy");

        api.text("길이 " + snake.length, VW / 2, api.VH - 8, 8, "rgba(255,255,255,.5)");
      }

      return { reset, update, render, press };
    },
  });
})();
