'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { FiltersEngine, Request } = require('@ghostery/adblocker');
class Addons {
  constructor(file, browser, player) {
    this.file = file; this.browser = browser; this.player = player; this.settings = { sponsorblock: false, adblock: false }; this.cache = new Map(); this.running = false;
    try { const stored = JSON.parse(fs.readFileSync(file,'utf8')); for (const key of Object.keys(this.settings)) this.settings[key] = stored[key] === true; } catch {}
    this.engine = FiltersEngine.parse('||doubleclick.net^\n||googlesyndication.com^\n||googleadservices.com^\n||youtube.com/pagead/\n||youtube.com/api/stats/ads');
    browser.session.webRequest.onBeforeRequest((details, callback) => {
      let cancel = false;
      if (this.settings.adblock && details.resourceType !== 'mainFrame') try { cancel = this.engine.match(Request.fromRawDetails({ url: details.url, sourceUrl: details.referrer || browser.getURL(), type: details.resourceType })).match; } catch {}
      callback({ cancel });
    });
    this.timer = setInterval(() => this.tick().catch(() => {}), 700);
  }
  view() { return { ...this.settings }; }
  async configure() {
    if (this.script)try{await this.browser.debugger.sendCommand('Page.removeScriptToEvaluateOnNewDocument', { identifier: this.script });}catch{}
    const source = `window.__jamstormAdblock=${this.settings.adblock};`;
    this.script = (await this.browser.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source })).identifier;
    await this.browser.executeJavaScript(source);
  }
  async set(key, value) { if (!Object.hasOwn(this.settings,key) || typeof value !== 'boolean') throw new Error('Unknown addon'); this.settings[key] = value; await this.configure(); fs.writeFileSync(this.file, JSON.stringify(this.settings)); return this.view(); }
  async segments(id) {
    const cached = this.cache.get(id); if (cached && cached.expires > Date.now()) return cached.segments;
    const prefix = createHash('sha256').update(id).digest('hex').slice(0,4);
    const response = await fetch(`https://sponsor.ajay.app/api/skipSegments/${prefix}?categories=${encodeURIComponent(JSON.stringify(['sponsor','selfpromo','interaction','music_offtopic']))}`, { signal: AbortSignal.timeout(7000) });
    if (!response.ok && response.status !== 404) throw new Error('SponsorBlock unavailable');
    const body = response.status === 404 ? [] : await response.json();
    const segments = (Array.isArray(body) ? body : []).find(row=>row.videoID===id)?.segments?.filter(s=>s.actionType==='skip' && Array.isArray(s.segment) && s.segment.length===2 && s.segment.every(Number.isFinite) && s.segment[0]>=0 && s.segment[1]>s.segment[0]) || [];
    if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(id,{ segments, expires:Date.now()+30*60*1000 });return segments;
  }
  async tick() {
    if (this.running || this.browser.isDestroyed() || !this.settings.adblock && !this.settings.sponsorblock) return;
    this.running = true;
    try {
      const media = await this.player.sample(); if (!media?.playing || !/^[\w-]{11}$/.test(media.videoId || '')) return;
      if (this.settings.adblock) await this.browser.executeJavaScript(`(() => { const p=document.querySelector('.html5-video-player'); if(!p?.classList.contains('ad-showing'))return; document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern')?.click(); })()`);
      if (!this.settings.sponsorblock || media.advertisement) return;
      let segments;
      try { segments = await this.segments(media.videoId); } catch { this.cache.set(media.videoId,{segments:[],expires:Date.now()+60000}); return; }
      if (!this.settings.sponsorblock) return;
      const segment = segments.find(s=>media.position/1000 >= s.segment[0] && media.position/1000 < s.segment[1]-.25);
      if (segment) await this.browser.executeJavaScript(`(() => {const p=document.querySelector('.html5-video-player'),d=p?.getVideoData?.(),v=document.querySelector('video');const id=d?.video_id||d?.videoId||new URL(location.href).searchParams.get('v');if(id===${JSON.stringify(media.videoId)}&&v&&!v.paused&&v.currentTime>=${segment.segment[0]}&&v.currentTime<${segment.segment[1]})v.currentTime=${segment.segment[1]};})()`);
    } finally { this.running = false; }
  }
  stop() { clearInterval(this.timer); }
}
module.exports = { Addons };
