"use strict";
/* ============================================================
   수익화 모듈 (MONET) — 광고 전용 (인앱결제 없음)
   - 광고: Google AdMob (@capacitor-community/admob) — 서버 불필요
       · 배너: 화면 하단(또는 상단) 상시
       · 전면(인터스티셜): 게임오버 N번마다
       · 보상형(리워드): "광고 보고 점수 2배"
   - 네이티브(앱)에서만 진짜 광고가 뜨고, 웹/브라우저에서는 무해하게 우회.
   ⚠️ 출시 전: 아래 AD IDS를 본인 AdMob 계정의 실제 광고단위 ID로 교체.
   ============================================================ */

const MONET = (window.MONET = {
  native: false,
  adsRemoved: false,
  _overCount: 0,
  INTERSTITIAL_EVERY: 12,  // 게임오버 12번마다 전면광고 (배너 상시 + 보상형 별도)

  // Google 공식 "테스트" 광고단위 ID (개발 중 안전하게 사용)
  TEST_IDS: {
    android: { banner: "ca-app-pub-3940256099942544/6300978111", interstitial: "ca-app-pub-3940256099942544/1033173712", reward: "ca-app-pub-3940256099942544/5224354917" },
    ios:     { banner: "ca-app-pub-3940256099942544/2934735716", interstitial: "ca-app-pub-3940256099942544/4411468910", reward: "ca-app-pub-3940256099942544/1712485313" },
  },
  // 출시용 실제 ID (← 본인 것으로 교체)
  PROD_IDS: {
    android: { banner: "", interstitial: "", reward: "" },
    ios:     { banner: "", interstitial: "", reward: "" },
  },
  USE_TEST_ADS: true,      // 출시 직전 false 로 바꾸고 PROD_IDS 채우기
  BANNER_POSITION: "BOTTOM_CENTER",   // 하단: "BOTTOM_CENTER" / 상단: "TOP_CENTER"
  _bannerShown: false,

  _admob() { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob) || null; },
  _platform() { return (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || "web"; },
  _ids() {
    const p = this._platform();
    const set = this.USE_TEST_ADS ? this.TEST_IDS : this.PROD_IDS;
    return set[p] || set.android;
  },

  async init() {
    this.native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!this.native) return;                  // 웹: 광고 SDK 없음
    const AdMob = this._admob();
    if (AdMob) {
      try { await AdMob.initialize({ initializeForTesting: this.USE_TEST_ADS }); }
      catch (e) { console.warn("AdMob init 실패:", e); }
    }
    this.showBanner();          // 하단(또는 상단) 배너 표시
  },

  // 하단/상단 배너 광고
  async showBanner() {
    if (this.adsRemoved || !this.native || this._bannerShown) return;
    const AdMob = this._admob(); if (!AdMob) return;
    try {
      await AdMob.showBanner({
        adId: this._ids().banner,
        adSize: "ADAPTIVE_BANNER",
        position: this.BANNER_POSITION,
        margin: 0,
      });
      this._bannerShown = true;
    } catch (e) { console.warn("배너 표시 실패:", e); }
  },
  async hideBanner() {
    const AdMob = this._admob(); if (!AdMob || !this._bannerShown) return;
    try { await AdMob.removeBanner(); this._bannerShown = false; } catch (e) {}
  },

  // 게임오버마다 호출 → 일정 횟수마다 전면광고
  async onGameOver() {
    if (this.adsRemoved || !this.native) return;
    this._overCount++;
    if (this._overCount % this.INTERSTITIAL_EVERY !== 0) return;
    const AdMob = this._admob(); if (!AdMob) return;
    try {
      await AdMob.prepareInterstitial({ adId: this._ids().interstitial });
      await AdMob.showInterstitial();
    } catch (e) { console.warn("전면광고 실패:", e); }
  },

  // 보상형 광고 → 성공 시 true (점수 2배 등). 웹/실패 시에도 흐름이 끊기지 않게 처리.
  async showRewardDouble() {
    if (!this.native) return true;             // 웹 개발용: 보상 받은 것으로 처리
    const AdMob = this._admob(); if (!AdMob) return false;
    try {
      let rewarded = false;
      // 플러그인 버전에 따라 이벤트명이 다를 수 있어 여러 이름을 함께 청취
      const names = ["onRewardedVideoAdReward", "onRewardedVideoCompleted", "rewardAdRewarded"];
      const subs = names.map((n) => AdMob.addListener(n, () => { rewarded = true; }));
      await AdMob.prepareRewardVideoAd({ adId: this._ids().reward });
      const res = await AdMob.showRewardVideoAd();   // 일부 버전은 보상정보를 반환
      if (res) rewarded = true;
      for (const s of subs) { try { (await s).remove(); } catch (e) {} }
      return rewarded;
    } catch (e) { console.warn("보상형 광고 실패:", e); return false; }
  },

});

window.addEventListener("load", () => { MONET.init(); });
