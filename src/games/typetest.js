"use strict";
/* 게임: 타자 연습 (PC 전용) — 60초 동안 문장을 정확히 타이핑. 실제 타자 검정 스타일.
   완성한 문장의 글자수가 점수, 평균 타/분 표시. 한/영 선택. 데스크톱에서만 등록. */
(function () {
  const fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  if (!fine) return;

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
  function sentences(lang) {
    const d = window.WORDS_DATA && window.WORDS_DATA.sentences;
    return (d && d[lang]) || ["typing practice"];
  }

  MG.register({
    id: "typetest",
    title: "타자 연습",
    subtitle: "TYPING TEST",
    accent: "#5ec9ff",
    skipReady: true,
    how: "60초 동안 문장을 정확히! 한/영 선택 (PC 전용)",
    icon(api, x, y, t) {
      api.roundRect(x - 9, y - 8, 18, 16, 2, "#eef4ff");
      const bl = Math.floor(t * 0.12) % 3;
      for (let i = 0; i < 3; i++) api.px(x - 6, y - 4 + i * 4, i === bl ? 12 : 8, 2, i === bl ? "#5ec9ff" : "#9fb2cc");
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const FS = 13, TIME = 60;
      const KO_BTN = { x: VW / 2 - 66, y: 150, w: 60, h: 48 };
      const EN_BTN = { x: VW / 2 + 6, y: 150, w: 60, h: 48 };
      let phase, lang, playing, target, buffer, keystrokes, startT, doneCount, finalKpm;

      const ctrl = {
        onInput(val) {
          if (phase !== "play") return;
          buffer = val;
          if (val === target) {                 // 문장 완성
            api.addScore(target.length);
            doneCount++; api.sound.score(); api.flash(0.15);
            api.burst(VW / 2, 120, "#5ec9ff", 12);
            nextSentence();
          }
        },
      };
      function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
      function kpm() {
        if (!startT || keystrokes < 1) return 0;
        const mins = (performance.now() - startT) / 60000;
        return mins > 0 ? Math.round(keystrokes / mins) : 0;
      }
      function remainMs() { return startT ? Math.max(0, TIME * 1000 - (performance.now() - startT)) : TIME * 1000; }
      function nextSentence() {
        const list = sentences(lang);
        target = list[Math.floor(api.rnd(list.length))];
        buffer = ""; ensureInput().value = "";
      }

      function reset() {
        phase = "choose"; playing = false;
        lang = localStorage.getItem("type_lang") || "ko";
        current = ctrl; ensureInput();
      }
      function begin(l) {
        lang = l; localStorage.setItem("type_lang", l);
        phase = "play"; keystrokes = 0; startT = 0; doneCount = 0; finalKpm = 0;
        nextSentence();
        const el = ensureInput(); el.value = ""; el.focus();
        api.sound.select();
      }

      function update() {
        playing = true;
        if (phase !== "play") return;
        if (startT && remainMs() <= 0) { finalKpm = kpm(); if (inputEl) inputEl.blur(); api.sound.die(); api.gameOver(); }
      }

      function key(e) {
        if (phase !== "play" || !e) return;
        const printable = e.key && e.key.length === 1 && e.key !== " ";
        if (printable || e.keyCode === 229 || e.code === "Space") {
          keystrokes++;
          if (!startT) startT = performance.now();   // 첫 타에 타이머 시작
        }
      }

      function press(p) {
        if (phase === "choose") {
          if (inRect(p, KO_BTN)) begin("ko");
          else if (inRect(p, EN_BTN)) begin("en");
          return;
        }
        ensureInput().focus();
      }

      function bg() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, "#10233a"); g.addColorStop(1, "#1c2f4a");
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
      }
      function langBtn(r, label, on) {
        api.roundRect(r.x, r.y, r.w, r.h, 8, on ? "#5ec9ff" : "rgba(255,255,255,.1)");
        api.text(label, r.x + r.w / 2, r.y + 30, 15, on ? "#10233a" : "#eaf3ff");
      }

      function render() {
        bg();
        if (!playing) return;
        if (phase === "choose") {
          api.text("타자 연습", VW / 2, 90, 20, "#5ec9ff");
          api.text("60초 동안 문장 입력!", VW / 2, 120, 10, "rgba(255,255,255,.6)");
          langBtn(KO_BTN, "한글", lang === "ko");
          langBtn(EN_BTN, "ENG", lang === "en");
          if (api.blink()) api.text("한글 / ENG 를 탭하면 시작!", VW / 2, 240, 10, "#fff");
          api.text("ESC = 나가기", VW / 2, 290, 8, "rgba(255,255,255,.4)");
          return;
        }

        // 타이머 바 + 속도
        const rem = remainMs(), frac = rem / (TIME * 1000);
        api.px(14, 64, VW - 28, 6, "rgba(0,0,0,.4)");
        api.px(14, 64, (VW - 28) * frac, 6, frac < 0.25 ? "#ff5b6e" : "#5ec9ff");
        api.text(Math.ceil(rem / 1000) + "초", 14, 88, 10, "#eaf3ff", "left");
        api.text((startT ? kpm() : "--") + " 타/분", VW - 14, 88, 10, "#9fffc0", "right");

        // 문장 (글자별 색: 맞음=초록, 틀림=빨강, 안침=회색, 현재위치 캐럿)
        ctx.font = FS + "px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        let x = 14, y = 146; const lh = 30;
        for (let i = 0; i < target.length; i++) {
          const ch = target[i], cw = ctx.measureText(ch).width;
          if (x + cw > VW - 14) { x = 14; y += lh; }
          if (i === buffer.length) api.px(x, y - FS + 2, 2, FS, "#ffd84d");   // 캐럿
          const wrong = i < buffer.length && buffer[i] !== ch;
          ctx.fillStyle = i < buffer.length ? (wrong ? "#ff5b6e" : "#7CFFA0") : "#7a8a9e";
          ctx.fillText(ch, x, y);
          if (wrong) { ctx.fillStyle = "#ff8a3d"; ctx.fillText(buffer[i], x, y - FS - 3); }  // 잘못 친 글자를 위에 표시
          x += cw;
        }
        api.text("완성 " + doneCount + "문장 · 위 주황색 = 오타 · ESC 나가기", VW / 2, VH - 14, 8, "rgba(255,255,255,.5)");
      }

      function overInfo() { return finalKpm ? "평균 " + finalKpm + " 타/분" : ""; }

      return { reset, update, render, press, key, overInfo };
    },
  });
})();
