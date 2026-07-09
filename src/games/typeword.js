"use strict";
/* 게임: 타자 게임 (PC 전용) — 떨어지는 단어를 타이핑해 없앤다.
   들어가면 먼저 한/영을 선택하고 시작. 한글은 조합(IME) 입력이라 숨은 <input>으로 받아 비교.
   키보드가 필요하므로 데스크톱(pointer:fine)에서만 등록. */
(function () {
  const fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  if (!fine) return;

  const WORDS = {
    en: ["cat", "dog", "sun", "star", "game", "play", "jump", "cool", "moon", "fire", "wind",
      "gold", "blue", "fish", "bird", "tree", "cake", "milk", "rain", "snow", "king", "love",
      "hero", "rock", "note", "time", "cloud", "light", "happy", "apple", "water", "music",
      "tiger", "robot", "sweet", "brave", "pixel", "space", "candy", "ghost"],
    ko: ["사과", "바다", "하늘", "구름", "사랑", "친구", "학교", "가방", "노래", "여행", "토끼",
      "포도", "딸기", "김밥", "라면", "우유", "연필", "의자", "시계", "기차", "우주", "무지개",
      "고양이", "강아지", "호랑이", "바나나", "자동차", "비행기", "눈사람", "선물", "행복", "나무"],
  };

  let inputEl = null, current = null;
  function ensureInput() {
    if (inputEl) return inputEl;
    inputEl = document.createElement("input");
    inputEl.setAttribute("autocomplete", "off");
    inputEl.setAttribute("autocapitalize", "off");
    inputEl.setAttribute("spellcheck", "false");
    inputEl.style.cssText = "position:fixed;left:-1000px;top:0;width:10px;height:10px;opacity:0;";
    document.body.appendChild(inputEl);
    inputEl.addEventListener("input", () => { if (current) current.onInput(inputEl.value); });
    return inputEl;
  }

  MG.register({
    id: "type",
    title: "타자 게임",
    subtitle: "TYPING",
    accent: "#7CFFA0",
    skipReady: true,        // 엔진 "탭하면 시작" 건너뛰고 바로 언어 선택 화면으로
    how: "떨어지는 단어 타이핑 · 시작할 때 한/영 선택 (PC 전용)",
    icon(api, x, y, t) {
      const on = Math.floor(t * 0.1) % 2;
      api.roundRect(x - 11, y - 6, 8, 8, 2, on ? "#7CFFA0" : "#3a4a3a");
      api.roundRect(x - 1, y - 6, 8, 8, 2, on ? "#3a4a3a" : "#7CFFA0");
      api.px(x - 8, y - 3, 2, 2, "#1a1228"); api.px(x + 2, y - 3, 2, 2, "#1a1228");
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const FS = 13, TOP = 62, BOTTOM = VH - 40;
      const KO_BTN = { x: VW / 2 - 66, y: 150, w: 60, h: 48 };
      const EN_BTN = { x: VW / 2 + 6, y: 150, w: 60, h: 48 };
      let phase, words, spawnT, fallSpeed, buffer, lang, playing;
      let keystrokes, startT;    // 타자속도(타/분) 측정

      const ctrl = {
        onInput(val) {
          if (phase !== "play") return;
          buffer = val;
          let hit = null;
          for (const w of words) if (w.text === val && (!hit || w.y > hit.y)) hit = w;
          if (hit) {
            api.addScore(Math.max(2, hit.text.length));
            api.sound.score(); api.flash(0.18);
            api.burst(hit.x, hit.y, "#7CFFA0", 12);
            words = words.filter((w) => w !== hit);
            buffer = ""; inputEl.value = "";
          }
        },
      };
      function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

      function reset() {                    // 들어오면 언어 선택 화면
        phase = "choose"; words = []; buffer = ""; playing = false;
        lang = localStorage.getItem("type_lang") || "ko";
        current = ctrl; ensureInput();
      }
      function begin(l) {                    // 언어 선택 → 시작
        lang = l; localStorage.setItem("type_lang", l);
        phase = "play"; words = []; buffer = ""; spawnT = 20; fallSpeed = 0.42;
        keystrokes = 0; startT = 0;
        const el = ensureInput(); el.value = ""; el.focus();
        api.sound.select();
      }
      function kpm() {                        // 분당 타수(평균)
        if (!startT || keystrokes < 1) return 0;
        const mins = (performance.now() - startT) / 60000;
        return mins > 0 ? Math.round(keystrokes / mins) : 0;
      }

      function spawn() {
        const list = WORDS[lang];
        const text = list[Math.floor(api.rnd(list.length))];
        ctx.font = FS + "px monospace";
        const w = ctx.measureText(text).width, half = w / 2;
        const x = api.rnd(10 + half, VW - 10 - half);
        words.push({ text, x, y: TOP, w });
      }

      function update() {
        playing = true;                      // 엔진 PLAY 상태 표시 (READY와 겹침 방지)
        if (phase !== "play") return;
        fallSpeed = Math.min(1.0, 0.42 + api.score / 110);
        spawnT--;
        if (spawnT <= 0) { spawn(); spawnT = Math.max(55, 100 - api.score * 0.6); }
        for (const w of words) {
          w.y += fallSpeed;
          if (w.y >= BOTTOM) { if (inputEl) inputEl.blur(); api.shake(7); api.flash(0.5); api.sound.die(); api.gameOver(); return; }
        }
      }

      function key(e) {
        // 실제 글자 입력은 숨은 input이 받음. 여기선 타수만 카운트(한글 조합키 포함).
        if (phase !== "play" || !e) return;
        const printable = e.key && e.key.length === 1 && e.key !== " ";
        if (printable || e.keyCode === 229) {   // 229 = IME 조합 중 키다운(한글 자모)
          keystrokes++;
          if (!startT) startT = performance.now();
        }
      }

      function press(p) {
        if (phase === "choose") {
          if (inRect(p, KO_BTN)) begin("ko");
          else if (inRect(p, EN_BTN)) begin("en");
          return;
        }
        ensureInput().focus();               // 클릭 시 입력 포커스 유지
      }

      function bg() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, "#0e2018"); g.addColorStop(1, "#14301f");
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
      }
      function langBtn(r, label, on) {
        api.roundRect(r.x, r.y, r.w, r.h, 8, on ? "#7CFFA0" : "rgba(255,255,255,.1)");
        api.text(label, r.x + r.w / 2, r.y + 30, 15, on ? "#0e2018" : "#eafff0");
      }

      function render() {
        bg();
        if (!playing) return;                 // READY 단계는 엔진 오버레이만 그림 (겹침 방지)
        if (phase === "choose") {
          api.text("타자 게임", VW / 2, 90, 20, "#7CFFA0");
          api.text("언어를 선택하세요", VW / 2, 120, 10, "rgba(255,255,255,.6)");
          langBtn(KO_BTN, "한글", lang === "ko");
          langBtn(EN_BTN, "ENG", lang === "en");
          if (api.blink()) api.text("한글 / ENG 를 탭하면 시작!", VW / 2, 240, 10, "#fff");
          return;
        }
        api.px(0, BOTTOM, VW, 2, "rgba(255,91,110,.5)");        // 위험선
        api.text("평균 " + (startT ? kpm() : "--") + " 타/분", 6, 18, 8, "rgba(255,255,255,.75)", "left");
        ctx.font = FS + "px monospace"; ctx.textBaseline = "alphabetic";
        for (const w of words) {
          const startX = w.x - w.w / 2;
          if (buffer && w.text.startsWith(buffer)) {
            ctx.textAlign = "left";
            const pre = w.text.slice(0, buffer.length), rest = w.text.slice(buffer.length);
            ctx.fillStyle = "#3fa84f"; ctx.fillText(pre, startX, w.y);
            ctx.fillStyle = "#eafff0"; ctx.fillText(rest, startX + ctx.measureText(pre).width, w.y);
          } else {
            api.text(w.text, w.x, w.y, FS, "#cfe8d8");
          }
        }
        api.text(buffer ? "▸ " + buffer : "타이핑하세요", VW / 2, VH - 14, 12, buffer ? "#ffd84d" : "rgba(255,255,255,.4)");
      }

      return { reset, update, render, press, key };
    },
  });
})();
