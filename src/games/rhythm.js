"use strict";
/* 게임 7: 리듬 탭 — 노트가 판정선에 닿을 때 탭. 놓치거나 헛탭하면 끝. */
(function () {
  MG.register({
    id: "rhythm",
    title: "리듬 탭",
    subtitle: "RHYTHM",
    accent: "#b18cff",
    how: "비트에 맞춰 노트가 선에 닿을 때 탭!",
    icon(api, x, y, t) {
      api.px(x - 12, y + 7, 24, 2, "#b18cff");                 // 판정선
      const ny = y - 8 + ((t * 0.7) % 16);
      api.ctx.fillStyle = "#d9c2ff"; api.ctx.beginPath();
      api.ctx.arc(x, ny, 4, 0, Math.PI * 2); api.ctx.fill();
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const LINE_Y = VH - 72, HIT = 26, RADIUS = 9;
      const BEAT = 38;                                  // 프레임/박 (고정 템포 ≈ 110 BPM)
      const FALL_BEATS = 5;                             // 노트가 4박 동안 낙하 → 박자에 정확히 도착
      const FALL = (LINE_Y + 12) / (FALL_BEATS * BEAT);
      // 게임 전용 BGM (펜타토닉 16스텝 루프) — 노트가 도착하는 정박에 멜로디가 울림
      const MELODY = [659, 0, 659, 784, 880, 0, 784, 659, 587, 587, 659, 784, 880, 0, 784, 0];
      const BASS = [165, 0, 0, 0, 220, 0, 0, 0, 147, 0, 0, 0, 196, 0, 0, 0];
      let notes, beatT, beatCount, judge, judgeT, beatFlash;

      function reset() {
        api.suppressBgm(true);                          // 충돌하는 BGM 끄고 전용 비트에 집중
        notes = []; beatT = BEAT - 1; beatCount = 0; judge = ""; judgeT = 0; beatFlash = 0;
      }
      function die() { api.shake(6); api.flash(0.5); api.sound.die(); api.gameOver(); }

      function update() {
        beatT++;
        if (beatT >= BEAT) {                            // 정박
          beatT -= BEAT; beatCount++; beatFlash = 1;
          const step = beatCount % 16;
          if (MELODY[step]) api.beep(MELODY[step], 0.2, "square", 0.07);    // 멜로디(도착하는 노트와 동시에 울림)
          if (BASS[step]) api.beep(BASS[step], 0.34, "triangle", 0.05);     // 베이스
          // FALL_BEATS 뒤에 도착 → 그때 그 음이 울리도록, 멜로디 음이 있는 박에만 노트 생성 (쉼표엔 노트 없음)
          if (MELODY[(beatCount + FALL_BEATS) % 16]) notes.push({ y: -12 });
        }
        for (const n of notes) { n.y += FALL; if (n.y > LINE_Y + HIT && !n.dead) { die(); return; } }
        notes = notes.filter((n) => !n.dead);
        if (judgeT > 0) judgeT--;
        if (beatFlash > 0) beatFlash -= 0.08;
      }

      function press() {
        let best = null, bd = 1e9;
        for (const n of notes) { const d = Math.abs(n.y - LINE_Y); if (d < bd) { bd = d; best = n; } }
        if (best && bd <= HIT) {
          best.dead = true;
          const perfect = bd <= 12;
          api.addScore(perfect ? 2 : 1); api.sound.score(); api.flash(perfect ? 0.3 : 0.18);
          api.burst(VW / 2, LINE_Y, perfect ? "#ffd84d" : "#b18cff", perfect ? 14 : 9);
          judge = perfect ? "PERFECT!" : "GOOD"; judgeT = 24;
        } else { die(); }
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, "#241a3a"); g.addColorStop(1, "#3a2a5e");
        ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

        api.px(VW / 2 - 30, 0, 60, VH, "rgba(255,255,255,.04)");
        // 판정 범위 + 선 (박자에 맞춰 깜빡)
        api.px(VW / 2 - 30, LINE_Y - HIT, 60, HIT * 2, `rgba(177,140,255,${0.1 + beatFlash * 0.18})`);
        api.px(VW / 2 - 34, LINE_Y - 1, 68, 3, beatFlash > 0.3 ? "#e0c8ff" : "#b18cff");

        for (const n of notes) {
          ctx.fillStyle = "#d9c2ff";
          ctx.beginPath(); ctx.arc(VW / 2, n.y, RADIUS, 0, Math.PI * 2); ctx.fill();
          api.face(VW / 2, n.y, 0.6, "happy");
        }
        if (judgeT > 0) api.text(judge, VW / 2, LINE_Y - 28, 11, judge[0] === "P" ? "#ffd84d" : "#d9c2ff");
      }

      return { reset, update, render, press };
    },
  });
})();
