"use strict";
/* 게임: 타자 게임 (PC 전용) — 떨어지는 영어 단어를 타이핑해서 없앤다.
   키보드가 필요하므로 데스크톱(pointer:fine)에서만 허브에 등록됨. */
(function () {
  const fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  if (!fine) return;   // 모바일/터치 전용 기기에선 등록 안 함

  const WORDS = ["cat", "dog", "sun", "star", "game", "play", "jump", "cool", "moon", "fire",
    "wind", "gold", "blue", "fish", "bird", "tree", "cake", "milk", "rain", "snow", "king",
    "love", "hero", "rock", "note", "time", "door", "road", "cloud", "light", "happy", "apple",
    "water", "music", "tiger", "robot", "sweet", "brave", "pixel", "space", "candy", "ghost"];

  MG.register({
    id: "type",
    title: "타자 게임",
    subtitle: "TYPING",
    accent: "#7CFFA0",
    how: "키보드로 단어를 입력! (PC 전용)",
    icon(api, x, y, t) {
      const on = Math.floor(t * 0.1) % 2;
      api.roundRect(x - 11, y - 6, 8, 8, 2, on ? "#7CFFA0" : "#3a4a3a");
      api.roundRect(x - 1, y - 6, 8, 8, 2, on ? "#3a4a3a" : "#7CFFA0");
      api.px(x - 8, y - 3, 2, 2, "#1a1228"); api.px(x + 2, y - 3, 2, 2, "#1a1228");
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const CW = 7, FS = 12, TOP = 60, BOTTOM = VH - 34;
      let words, active, spawnT, fallSpeed;

      function reset() {
        words = []; active = null; spawnT = 20; fallSpeed = 0.42;
      }
      function spawn() {
        const w = WORDS[Math.floor(api.rnd(WORDS.length))];
        const halfW = (w.length * CW) / 2;
        const x = api.rnd(12 + halfW, VW - 12 - halfW);
        words.push({ text: w, x, y: TOP, typed: 0 });
      }

      function update() {
        fallSpeed = Math.min(1.0, 0.42 + api.score / 90);
        spawnT--;
        if (spawnT <= 0) { spawn(); spawnT = Math.max(50, 95 - api.score * 0.7); }
        for (const w of words) {
          w.y += fallSpeed;
          if (w.y >= BOTTOM) { api.shake(7); api.flash(0.5); api.sound.die(); api.gameOver(); return; }
        }
      }

      function key(e) {
        if (!e.key || e.key.length !== 1) return;
        const c = e.key.toLowerCase();
        if (c < "a" || c > "z") return;
        if (!active) {                 // 타깃 없으면: 그 글자로 시작하는 가장 아래 단어를 잡음
          let best = null;
          for (const w of words) if (w.text[0] === c && (!best || w.y > best.y)) best = w;
          if (!best) return;
          active = best; active.typed = 1;
        } else {
          if (active.text[active.typed] === c) active.typed++;
          else return;                 // 오타는 무시(관대)
        }
        api.sound.select();
        if (active.typed >= active.text.length) {   // 단어 완성
          api.addScore(active.text.length);
          api.sound.score(); api.flash(0.18);
          api.burst(active.x, active.y, "#7CFFA0", 12);
          words = words.filter((w) => w !== active);
          active = null;
        }
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, "#0e2018"); g.addColorStop(1, "#14301f");
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
        // 위험선
        api.px(0, BOTTOM, VW, 2, "rgba(255,91,110,.5)");
        ctx.font = FS + "px monospace"; ctx.textBaseline = "alphabetic";

        for (const w of words) {
          if (w === active) {          // 진행 중: 글자별 색
            const startX = w.x - (w.text.length * CW) / 2;
            ctx.textAlign = "left";
            for (let i = 0; i < w.text.length; i++) {
              ctx.fillStyle = i < w.typed ? "#3fa84f" : i === w.typed ? "#ffd84d" : "#eafff0";
              ctx.fillText(w.text[i], startX + i * CW, w.y);
            }
          } else {
            api.text(w.text, w.x, w.y, FS, "#cfe8d8");
          }
        }
        api.text("떨어지는 단어를 타이핑", VW / 2, VH - 12, 8, "rgba(255,255,255,.4)");
      }

      return { reset, update, render, key };
    },
  });
})();
