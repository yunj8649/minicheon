"use strict";
/* ============================================================
   메타 진행 시스템 (META) — 서버 불필요, localStorage 저장
   - ⭐별: 게임 점수에 비례해 획득 (메타 화폐)
   - 캐릭터 수집(도감): 별로 뽑기 / 도전과제 보상으로 해금, 장착 가능
   - 히든 도전과제: 조건 달성 시 공개 + 별/캐릭터 보상
   ============================================================ */
const META = (window.META = {
  // 캐릭터(스킨): 기본 'kong' 보유. hidden=뽑기 풀 제외(도전과제 전용)
  CHARS: [
    { id: "kong",   name: "콩이",   body: "#ffd84d", dark: "#e6a100" },
    { id: "ddalgi", name: "딸기",   body: "#ff5b6e", dark: "#c0334a" },
    { id: "soda",   name: "소다",   body: "#5ec9ff", dark: "#2f8fc0" },
    { id: "mint",   name: "민트",   body: "#7CFFA0", dark: "#2faf63" },
    { id: "grape",  name: "포도",   body: "#b18cff", dark: "#7a4ddb" },
    { id: "choco",  name: "초코",   body: "#b5794a", dark: "#7a4f2a" },
    { id: "peach",  name: "피치",   body: "#ff9aa8", dark: "#e0708a" },
    { id: "cloud",  name: "구름",   body: "#eaeef5", dark: "#b8c0cc" },
    { id: "gold",   name: "황금콩", body: "#ffe14d", dark: "#c9a400", hidden: true },
    { id: "shadow", name: "그림자", body: "#7a7a9e", dark: "#3a3a52", hidden: true },
  ],
  GACHA_COST: 50,

  // 도전과제 (cond(ctx)->bool). hidden=달성 전 ??? 표시.
  ACH: [
    { id: "first",     title: "첫 발걸음",     desc: "아무 게임이나 한 판",        reward: { stars: 20 },               cond: (c) => c.plays >= 1 },
    { id: "score30",   title: "고득점",        desc: "한 게임에서 30점",           reward: { stars: 50 },               cond: (c) => c.score >= 30 },
    { id: "collect5",  title: "수집가",        desc: "캐릭터 5종 보유",            reward: { stars: 50 },               cond: (c) => c.owned >= 5 },
    { id: "snake15",   title: "긴 꼬리",       desc: "꼬리잡기 15점",              reward: { stars: 30 },  hidden: true, cond: (c) => c.gameId === "snake" && c.score >= 15 },
    { id: "knife12",   title: "칼잡이",        desc: "칼 꽂기 12개",               reward: { stars: 30 },  hidden: true, cond: (c) => c.gameId === "knife" && c.score >= 12 },
    { id: "playall",   title: "전부 맛보기",   desc: "14종 모두 플레이",           reward: { stars: 100, char: "gold" }, hidden: true, cond: (c) => c.distinct >= 14 },
    { id: "stars300",  title: "별 부자",       desc: "별 누적 300개",              reward: { char: "shadow" }, hidden: true, cond: (c) => c.earned >= 300 },
    { id: "games50",   title: "오락실 죽돌이", desc: "총 50판 플레이",             reward: { stars: 80 },  hidden: true, cond: (c) => c.plays >= 50 },
  ],

  // 데일리 미션 풀 (매일 3개 선택, 자정 갱신)
  DAILY_POOL: [
    { id: "play3", title: "미니게임 3판 플레이", type: "play", goal: 3, reward: 15 },
    { id: "play5", title: "미니게임 5판 플레이", type: "play", goal: 5, reward: 25 },
    { id: "distinct3", title: "서로 다른 게임 3종", type: "distinct", goal: 3, reward: 20 },
    { id: "score20", title: "한 게임 20점 이상", type: "score", min: 20, goal: 1, reward: 20 },
    { id: "stars40", title: "오늘 별 40개 모으기", type: "stars", goal: 40, reward: 20 },
    { id: "gacha1", title: "캐릭터 1번 뽑기", type: "gacha", goal: 1, reward: 15 },
    { id: "g_whack", title: "두더지 잡기 플레이", type: "game", gameId: "whack", goal: 1, reward: 15 },
    { id: "g_snake", title: "꼬리잡기 플레이", type: "game", gameId: "snake", goal: 1, reward: 15 },
    { id: "g_rhythm", title: "리듬 탭 플레이", type: "game", gameId: "rhythm", goal: 1, reward: 15 },
  ],

  toasts: [],
  _stars: 0, _earned: 0, _plays: 0, _played: null, _owned: null, _equipped: "kong", _done: null,
  // 데일리 상태
  _dDate: "", _dIds: [], _dDone: null, _dPlays: 0, _dDistinct: null, _dStars: 0, _dGacha: 0, _dBest: 0, _dGames: null,

  load() {
    const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
    this._stars = j("meta_stars", 0);
    this._earned = j("meta_earned", 0);
    this._plays = j("meta_plays", 0);
    this._played = new Set(j("meta_played", []));
    this._owned = new Set(j("meta_owned", ["kong"]));
    this._equipped = localStorage.getItem("meta_equipped") || "kong";
    this._done = new Set(j("meta_done", []));
    const d = j("meta_daily", {});
    this._dDate = d.date || ""; this._dIds = d.ids || []; this._dDone = new Set(d.done || []);
    this._dPlays = d.plays || 0; this._dDistinct = new Set(d.distinct || []); this._dStars = d.stars || 0;
    this._dGacha = d.gacha || 0; this._dBest = d.best || 0; this._dGames = d.games || {};
    this.ensureToday();
  },
  save() {
    localStorage.setItem("meta_stars", this._stars);
    localStorage.setItem("meta_earned", this._earned);
    localStorage.setItem("meta_plays", this._plays);
    localStorage.setItem("meta_played", JSON.stringify([...this._played]));
    localStorage.setItem("meta_owned", JSON.stringify([...this._owned]));
    localStorage.setItem("meta_equipped", this._equipped);
    localStorage.setItem("meta_done", JSON.stringify([...this._done]));
    localStorage.setItem("meta_daily", JSON.stringify({ date: this._dDate, ids: this._dIds, done: [...this._dDone], plays: this._dPlays, distinct: [...this._dDistinct], stars: this._dStars, gacha: this._dGacha, best: this._dBest, games: this._dGames }));
  },

  stars() { return this._stars; },
  addStars(n) { this._stars += n; if (n > 0) this._earned += n; },
  toast(text, color) { this.toasts.push({ text, color: color || "#ffd84d" }); },

  charById(id) { return this.CHARS.find((c) => c.id === id) || this.CHARS[0]; },
  owns(id) { return this._owned.has(id); },
  ownedCount() { return this._owned.size; },
  equippedChar() { return this.charById(this._equipped); },
  equip(id) { if (this.owns(id)) { this._equipped = id; this.save(); } },

  // 게임 종료 시 호출
  onGameEnd(gameId, score) {
    this.ensureToday();
    const earned = Math.min(25, 1 + Math.floor(score / 4));
    this.addStars(earned);
    this._plays++; this._played.add(gameId);
    this._dPlays++; this._dDistinct.add(gameId); this._dStars += earned;
    if (score > this._dBest) this._dBest = score;
    this._dGames[gameId] = (this._dGames[gameId] || 0) + 1;
    this.toast("+" + earned + "★", "#ffd84d");
    this._check({ gameId, score });
    this._checkDaily();
    this.save();
  },

  _ctx(extra) {
    return Object.assign({
      plays: this._plays, distinct: this._played.size, earned: this._earned,
      owned: this._owned.size, score: 0, gameId: "",
    }, extra || {});
  },
  _check(extra) {
    const ctx = this._ctx(extra);
    for (const a of this.ACH) {
      if (this._done.has(a.id)) continue;
      if (a.cond(ctx)) {
        this._done.add(a.id);
        let msg = "도전과제! " + a.title;
        if (a.reward.stars) { this.addStars(a.reward.stars); msg += " +" + a.reward.stars + "★"; }
        if (a.reward.char && !this._owned.has(a.reward.char)) { this._owned.add(a.reward.char); msg += " +" + this.charById(a.reward.char).name; }
        this.toast(msg, "#7CFFA0");
        ctx.owned = this._owned.size;   // 연쇄 달성 반영
      }
    }
  },
  achDone(id) { return this._done.has(id); },

  // 캐릭터 뽑기 → {char} 성공 / {poor:true} 별부족 / {soldOut:true} 다 모음
  gachaRoll() {
    const pool = this.CHARS.filter((c) => !c.hidden && !this._owned.has(c.id));
    if (!pool.length) return { soldOut: true };
    if (this._stars < this.GACHA_COST) return { poor: true };
    this.ensureToday();
    this.addStars(-this.GACHA_COST);
    const char = pool[Math.floor(Math.random() * pool.length)];
    this._owned.add(char.id);
    this._dGacha++;
    this.toast("획득! " + char.name, char.body);
    this._check({});
    this._checkDaily();
    this.save();
    return { char };
  },

  // ---- 데일리 미션 ----
  _today() { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); },
  _hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
  pickDaily(date) {
    const avail = this.DAILY_POOL.map((_, i) => i); let h = this._hash(date); const out = [];
    while (out.length < 3 && avail.length) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; out.push(this.DAILY_POOL[avail.splice(h % avail.length, 1)[0]].id); }
    return out;
  },
  ensureToday() {
    const t = this._today();
    if (this._dDate === t) return;
    this._dDate = t; this._dIds = this.pickDaily(t); this._dDone = new Set();
    this._dPlays = 0; this._dDistinct = new Set(); this._dStars = 0; this._dGacha = 0; this._dBest = 0; this._dGames = {};
    this.addStars(10); this.toast("오늘 접속 보상 +10★", "#ffd84d");
    this.save();
  },
  _dpById(id) { return this.DAILY_POOL.find((m) => m.id === id); },
  _dailyProg(m) {
    switch (m.type) {
      case "play": return this._dPlays;
      case "distinct": return this._dDistinct.size;
      case "score": return this._dBest >= m.min ? 1 : 0;
      case "stars": return this._dStars;
      case "gacha": return this._dGacha;
      case "game": return this._dGames[m.gameId] || 0;
    }
    return 0;
  },
  dailyMissions() {
    return this._dIds.map((id) => { const m = this._dpById(id); return { id, title: m.title, goal: m.goal, reward: m.reward, prog: Math.min(m.goal, this._dailyProg(m)), done: this._dDone.has(id) }; });
  },
  dailyIncomplete() { return this.dailyMissions().some((m) => !m.done); },
  _checkDaily() {
    for (const id of this._dIds) {
      if (this._dDone.has(id)) continue;
      const m = this._dpById(id);
      if (this._dailyProg(m) >= m.goal) { this._dDone.add(id); this.addStars(m.reward); this.toast("데일리 완료! +" + m.reward + "★", "#5ec9ff"); }
    }
  },
});
META.load();
