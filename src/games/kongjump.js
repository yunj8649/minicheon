"use strict";
/* 게임 1: 콩콩 점프 — 탭하면 점프해서 가시를 피하는 러너 */
(function () {
  MG.register({
    id: "kongjump",
    title: "콩콩 점프",
    subtitle: "KONG JUMP",
    accent: "#ffd84d",
    how: "탭 = 점프 / 가시를 피하세요",
    icon(api, x, y, t) {
      const ctx = api.ctx;
      const by = y - Math.abs(Math.sin(t * 0.13)) * 7;   // 통통 튀는 콩
      ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(x, y + 7, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
      api.px(x - 5, by - 5, 10, 10, "#ffd84d");
      api.px(x - 5, by + 1, 10, 4, "#e6a100");
      api.px(x - 3, by - 3, 2, 2, "#2a1f1a"); api.px(x + 1, by - 3, 2, 2, "#2a1f1a");
    },
    create(api) {
      const { ctx, VW, VH } = api;
      const GROUND_Y = VH - 46;
      const GRAV = 0.42, JUMP_V = -7.1;
      const C = {
        sky1: "#2a1f44", sky2: "#3a2a5e", ground: "#4a3a2a", groundTop: "#6b5236",
        bean: "#ffd84d", beanDark: "#e6a100", spike: "#ff5b6e", spikeDark: "#c0334a",
        cloud: "#5a4a7e", star: "#fff3b0", shadow: "rgba(0,0,0,.35)",
      };
      let bean, obstacles, clouds, speed, dist, spawnTimer;

      function reset() {
        // 장착한 캐릭터 스킨 적용
        const sk = window.META ? window.META.equippedChar() : null;
        if (sk) { C.bean = sk.body; C.beanDark = sk.dark; }
        bean = { x: 44, y: GROUND_Y, vy: 0, onGround: true, anim: 0 };
        obstacles = [];
        clouds = [];
        for (let i = 0; i < 4; i++)
          clouds.push({ x: api.rnd(VW), y: 24 + api.rnd(70), sp: api.rnd(0.15, 0.35), s: 1 + (i % 2) });
        speed = 1.7; dist = 0; spawnTimer = 60;
      }

      function spawn() {
        const n = Math.random() < 0.25 ? 2 : 1;
        let gx = VW + 6;
        for (let i = 0; i < n; i++) { obstacles.push({ x: gx, w: 10, h: 14, passed: false }); gx += 11; }
      }

      function update() {
        dist += speed;
        speed = Math.min(3.3, 1.6 + dist / 2800);

        bean.vy += GRAV; bean.y += bean.vy;
        if (bean.y >= GROUND_Y) {
          if (!bean.onGround) for (let i = 0; i < 5; i++) api.puff(bean.x, GROUND_Y + 4);
          bean.y = GROUND_Y; bean.vy = 0; bean.onGround = true;
        }
        bean.anim += 0.3;

        spawnTimer -= speed;
        if (spawnTimer <= 0) { spawn(); spawnTimer = 100 + api.rnd(60) - Math.min(18, dist / 360); }

        for (const cl of clouds) { cl.x -= cl.sp * speed * 0.6; if (cl.x < -24) { cl.x = VW + 10; cl.y = 24 + api.rnd(70); } }

        for (const o of obstacles) {
          o.x -= speed;
          if (!o.passed && o.x + o.w < bean.x - 4) { o.passed = true; api.addScore(1); api.sound.score(); api.flash(0.25); }
          const bx = bean.x - 6, by = bean.y - 12, bw = 12, bh = 12;
          const ox = o.x, oy = GROUND_Y - o.h, ow = o.w, oh = o.h;
          if (bx < ox + ow - 1 && bx + bw > ox + 1 && by < oy + oh && by + bh > oy + 2) {
            api.shake(6); api.flash(0.6); api.sound.die(); api.burst(bean.x, bean.y - 6, C.bean);
            api.gameOver(); break;
          }
        }
        obstacles = obstacles.filter((o) => o.x > -16);
      }

      function press() {
        if (bean.onGround) {
          bean.vy = JUMP_V; bean.onGround = false; api.sound.jump();
          for (let i = 0; i < 6; i++) api.puff(bean.x, GROUND_Y + 4);
        }
      }

      function drawBean(x, y, squash) {
        ctx.fillStyle = C.shadow;
        ctx.beginPath();
        ctx.ellipse(x, GROUND_Y + 6, 9 - (GROUND_Y - y) * 0.04, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        const w = 14 * (1 - squash * 0.15), h = 14 * (1 + squash * 0.15);
        api.roundRect(x - w / 2, y - h, w, h, 5, C.bean);
        api.px(x - w / 2 + 1, y - 3, w - 2, 3, C.beanDark);
        api.face(x, y - h + 7, 1, bean.onGround ? "happy" : "wow");
      }

      function drawSpike(o) {
        const baseY = GROUND_Y;
        ctx.fillStyle = C.spike;
        ctx.beginPath();
        ctx.moveTo(o.x, baseY); ctx.lineTo(o.x + o.w / 2, baseY - o.h); ctx.lineTo(o.x + o.w, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.spikeDark;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, baseY - o.h); ctx.lineTo(o.x + o.w, baseY); ctx.lineTo(o.x + o.w * 0.7, baseY);
        ctx.closePath(); ctx.fill();
      }

      function render() {
        const g = ctx.createLinearGradient(0, 0, 0, VH);
        g.addColorStop(0, C.sky1); g.addColorStop(1, C.sky2);
        ctx.fillStyle = g; ctx.fillRect(-8, -8, VW + 16, VH + 16);

        ctx.fillStyle = C.star;
        for (let i = 0; i < 18; i++) {
          const sxp = (i * 53) % VW, syp = (i * 31) % (GROUND_Y - 40);
          if ((i + Math.floor(dist / 30)) % 7 !== 0) ctx.fillRect(sxp, syp + 6, 1, 1);
        }
        for (const cl of clouds) {
          ctx.fillStyle = C.cloud;
          ctx.fillRect(cl.x, cl.y, 14 * cl.s, 5 * cl.s);
          ctx.fillRect(cl.x + 4 * cl.s, cl.y - 3 * cl.s, 8 * cl.s, 4 * cl.s);
        }
        api.px(-8, GROUND_Y + 4, VW + 16, VH, C.ground);
        api.px(-8, GROUND_Y + 4, VW + 16, 3, C.groundTop);
        ctx.fillStyle = "rgba(0,0,0,.18)";
        const off = dist % 12;
        for (let x = -off; x < VW; x += 12) ctx.fillRect(x, GROUND_Y + 10, 6, 2);

        for (const o of obstacles) drawSpike(o);

        const squash = bean.onGround ? 0 : Math.max(-0.6, Math.min(0.6, -bean.vy * 0.06));
        let by = bean.y;
        if (bean.onGround) by += Math.sin(bean.anim) * 0.6;
        drawBean(bean.x, by, squash);
      }

      return { reset, update, render, press };
    },
  });
})();
