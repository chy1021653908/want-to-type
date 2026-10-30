const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup(saved, audioState) {
  const events = new Map(), rafs = new Map(), timers = new Map(); let next = 1, now = 1000;
  const ctx = { setTransform() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, rect() {}, clip() {}, drawImage() {} };
  function element(tag) {
    return { tagName: tag.toUpperCase(), style: { setProperty(key, value) { this[key] = value; } }, children: [], isConnected: true,
      get childElementCount() { return this.children.length; },
      querySelectorAll(selectors) {
        const classes = selectors.split(',').map(s => s.trim().slice(1)), found = [];
        const walk = node => node.children.forEach(child => {
          if (classes.some(name => (child.className || '').split(' ').includes(name))) found.push(child);
          walk(child);
        });
        walk(this); return found;
      },
      animate(keyframes, options) {
        const animation = { keyframes, options, currentTime: 0, playState: 'idle', playCount: 0, cancelled: false,
          cancel() { this.cancelled = true; this.playState = 'idle'; },
          play() { this.cancelled = false; this.playState = 'running'; this.playCount++; } };
        animation.effect = { setKeyframes(frames) { animation.keyframes = frames; }, updateTiming(timing) { Object.assign(animation.options, timing); } };
        return animation;
      },
      setAttribute() {}, addEventListener() {}, getContext: () => ctx,
      appendChild(n) { if (n.tagName === 'FRAGMENT') n.children.splice(0).forEach(child => this.appendChild(child)); else { this.children.push(n); n.parentNode = this; } },
      removeChild(n) { this.children = this.children.filter(c => c !== n); },
      remove() { this.isConnected = false; if (this.parentNode) this.parentNode.removeChild(this); },
    };
  }
  const body = element('body'), head = element('head');
  const document = { body, head, hidden: false, createElement: element, createDocumentFragment: () => element('fragment'),
    addEventListener(n, fn) { events.set(n, fn); }, removeEventListener(n) { events.delete(n); } };
  const React = { Component: class {}, createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity).filter(child => child != null) }; },
    useState: initial => [initial, () => {}], useEffect() {} };
  let stored = saved ? JSON.stringify(saved) : null;
  const window = { atob: value => Buffer.from(value, 'base64').toString('binary'), innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2,
    localStorage: { getItem: () => stored, setItem(key, value) { stored = value; } },
    matchMedia: () => ({ matches: false }), addEventListener(n, fn) { events.set(n, fn); },
    removeEventListener(n) { events.delete(n); },
    requestAnimationFrame(fn) { const id = next++; rafs.set(id, fn); return id; }, cancelAnimationFrame(id) { rafs.delete(id); },
    setTimeout(fn, delay) { const id = next++; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    __ModuleLoader__: { load(m) { m.factory(n => { if (n === 'react') return React; return {}; }); } },
  };
  const audioContexts = [];
  if (audioState) window.AudioContext = class {
    constructor() { this.state = audioState; this.sampleRate = 48000; this.destination = {}; this.nodes = []; audioContexts.push(this); }
    get currentTime() { return now / 1000; }
    param() { return { value: 1, events: [],
      setValueAtTime(value, at) { this.events.push(['set', value, at]); this.value = value; },
      linearRampToValueAtTime(value, at) { this.events.push(['linear', value, at]); this.value = value; },
      exponentialRampToValueAtTime(value, at) { this.events.push(['exp', value, at]); this.value = value; },
      cancelScheduledValues(at) { this.events.push(['cancel', at]); } }; }
    node(kind) { const node = { kind, gain: this.param(), frequency: this.param(), Q: this.param(),
      connect() {}, disconnect() { this.disconnected = true; },
      start(at) { this.started = at; }, stop(at) { this.stopped = at; },
    }; this.nodes.push(node); return node; }
    createGain() { return this.node('gain'); }
    createOscillator() { return this.node('oscillator'); }
    createBufferSource() { return this.node('noise'); }
    createBiquadFilter() { return this.node('filter'); }
    createBuffer(channels, length, rate) { const data = new Float32Array(length); return { duration: length / rate, getChannelData: () => data }; }
    resume() { this.resumes = (this.resumes || 0) + 1; this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  };
  let source = fs.readFileSync(path.join(__dirname, '../client.js'), 'utf8');
  source = source.replace("    return {\n      inject: ['slots'],", "    window.__test = { PIANO_PIECES, TypingSound, PetChase, TypingPets, WantToType, physicalKeyX, petBounds, updateConfig, getConfig: () => config, PET_ATLASES, bubbleFlight, emitIn, ConfigControls, effectPalette, fullscreenLook, drawWhaleOutline, selectThemePart, sceneId };\n    return {\n      inject: ['slots'],");
  vm.runInNewContext(source, { window, document, navigator: { language: 'zh' }, performance: { now: () => now }, console, Image: class {} });
  return { ...window.__test, audioContexts, window, document, events, rafs, timers, ctx, setNow: n => { now = n; },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at; timers.delete(due[0]); due[1].fn();
      }
      now = until;
    } };
}
test('physical keys use typing companion positions and ignore navigation', () => {
  const { physicalKeyX: x } = setup();
  assert.equal(x('Space'), .5); assert.equal(x('Backspace'), .97);
  assert.ok(x('KeyA') < x('KeyL')); assert.equal(x('KeyQ'), 1.2 / 14);
  assert.equal(x('ArrowLeft'), null); assert.equal(x('Enter'), null);
});
test('three sizes, speeds and reaction times remain independent', () => {
  const { PetChase } = setup(); const chase = new PetChase(); chase.retarget(.95, 1);
  const [a,b,c] = chase.runners;
  assert.equal(a.p.size, 1); assert.equal(b.p.size, .84); assert.equal(c.p.size, .68);
  assert.equal(a.born, 1.12); assert.equal(b.born, 1.025); assert.equal(c.born, 1.085);
  assert.ok(chase.position(b, 1.2) > chase.position(a, 1.2));
  chase.retarget(.8, 1.03); assert.equal(chase.runners[0].born, 1.12);
});
test('reversal turns, arrival jumps, reduced motion idles', () => {
  const { PetChase } = setup(); const chase = new PetChase(); chase.retarget(.95, 1);
  chase.retarget(.05, 1.3); const r = chase.runners[1];
  assert.equal(chase.pose(r, r.born + .01, 0, false).row, 1);
  assert.equal(chase.pose(r, r.born + r.duration + .05, 0, false).row, 3);
  assert.equal(chase.pose(r, r.born + .01, 0, true).row, 2);
});
test('bottom key events are separate from typing input and combo counts', () => {
  const t = setup(), p = new t.WantToType({}); let hits = 0;
  p.pets = { hit() { hits++; } };
  const editor = { tagName: 'TEXTAREA' };
  p.onKeyDown({ target: editor, code: 'KeyA', isComposing: true });
  assert.equal(p.acc, 0);
  p.onInput({ target: editor, inputType: 'insertText', data: 'a' });
  for (const patch of [{ repeat: true }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { code: 'Enter' }, { target: { tagName: 'INPUT' } }])
    p.onKeyDown({ target: editor, code: 'KeyA', ...patch });
  assert.equal(hits, 1); assert.equal(p.acc, 1);
  t.updateConfig({ bottomEnabled: false });
  p.onKeyDown({ target: editor, code: 'KeyA' }); assert.equal(hits, 1);
});
test('bottom canvas respects main pane, stops at idle, hides and cleans up', () => {
  const t = setup(), root = t.document.createElement('div'), pets = new t.TypingPets(root, false);
  pets.frames = Array.from({ length: 3 }, () => Array.from({ length: 24 }, () => ({ tile: {}, left: 0, top: 0, right: 256, bottom: 256, baseline: 240 })));
  pets.hit(.8, { closest: () => ({ isConnected: true, getBoundingClientRect: () => ({ left: 240, right: 1200, bottom: 800 }) }) });
  assert.equal(pets.canvas.style.left, '240px'); assert.equal(pets.canvas.style.bottom, '0px');
  assert.equal(pets.canvas.width, 1920); assert.ok(pets.raf);
  t.setNow(4000); pets.tick(); assert.equal(pets.raf, 0);
  t.setNow(4100); pets.hit(.3, null); t.document.hidden = true; t.events.get('visibilitychange')(); assert.equal(pets.raf, 0);
  pets.destroy(); assert.equal(root.children.length, 0); assert.equal(t.events.has('visibilitychange'), false);
});
test('legacy presets migrate into independent categories and bottom can stop alone', () => {
  const t = setup({ preset: 'fireworks', combo: false, lang: 'en' });
  assert.equal(t.getConfig().typingPreset, 'fireworks');
  assert.equal(t.getConfig().typingEnabled, true); assert.equal(t.getConfig().bottomEnabled, false);
  assert.equal(t.getConfig().fullscreenEnabled, false); assert.equal(t.getConfig().combo, false);
  t.updateConfig({ bottomEnabled: true, bottomPreset: 'buddies' });
  const pets = new t.TypingPets(t.document.createElement('div'), false);
  pets.chase.retarget(.8, 1); t.updateConfig({ bottomEnabled: false });
  assert.equal(pets.chase.lastInput, -Infinity);
  assert.equal(t.getConfig().typingEnabled, true); pets.destroy();
});
test('category settings persist independently', () => {
  const t = setup({ typingEnabled: true, typingPreset: 'magic', bottomEnabled: true,
    bottomPreset: 'matrix', fullscreenEnabled: false, combo: false });
  assert.equal(t.getConfig().typingPreset, 'magic'); assert.equal(t.getConfig().bottomPreset, 'matrix');
  t.updateConfig({ fullscreenEnabled: true });
  assert.equal(t.getConfig().typingEnabled, true); assert.equal(t.getConfig().bottomEnabled, true);
  assert.equal(t.getConfig().combo, false);
});
test('all transparent source atlases are embedded and correctly sized', () => {
  const { PET_ATLASES } = setup(); assert.equal(PET_ATLASES.length, 3);
  for (const uri of PET_ATLASES) {
    const png = Buffer.from(uri.split(',')[1], 'base64');
    assert.equal(png.readUInt32BE(16), 1536); assert.equal(png.readUInt32BE(20), 1024);
    assert.equal(png[25], 6); // RGBA PNG
  }
});
test('bounds reject transparent cells and adjacent-cell debris', () => {
  const { petBounds } = setup(), data = new Uint8ClampedArray(256 * 256 * 4);
  for (let y = 60; y < 230; y++) for (let x = 60; x < 180; x++) data[(y * 256 + x) * 4 + 3] = 255;
  for (let y = 250; y < 256; y++) for (let x = 0; x < 20; x++) data[(y * 256 + x) * 4 + 3] = 255;
  const bounds = petBounds(data); assert.equal(bounds.baseline, 230); assert.equal(bounds.left, 58);
});


test('combo style defaults preserve existing settings and invalid presets fall back', () => {
  for (const saved of [undefined, { combo: false }, { comboPreset: 'missing' }]) {
    const t = setup(saved);
    assert.equal(t.getConfig().comboPreset, saved ? 'classic' : 'cute');
    if (saved && saved.combo === false) assert.equal(t.getConfig().combo, false);
  }
  const t = setup({ comboPreset: 'heat', fullscreenEnabled: false, bottomPreset: 'matrix' });
  assert.equal(t.getConfig().comboPreset, 'heat');
  assert.equal(t.getConfig().fullscreenEnabled, false);
  assert.equal(t.getConfig().bottomPreset, 'matrix');
});

test('heat combo reuses animation, switches cleanly and obeys the combo toggle', () => {
  const t = setup({ comboPreset: 'heat', fullscreenEnabled: false, bottomEnabled: false });
  const p = new t.WantToType({}); p.componentDidMount();
  const editor = { tagName: 'TEXTAREA', getBoundingClientRect: () => ({ top: 300, bottom: 400, right: 600 }) };
  p.fire(editor, 3);
  assert.equal(p.box.className, 'wtt-combo wtt-combo-heat');
  assert.equal(p.box.style.opacity, '1');
  assert.equal(p.num.textContent, '3');
  assert.equal(p.comboCaption.textContent, '漂亮的连击');
  const animation = p.heatAnim;
  t.setNow(1100); p.fire(editor, 2);
  assert.equal(p.heatAnim, animation);
  assert.equal(p.comboCaption.textContent, '手感火热');
  assert.equal(p.heatArt.style['--combo-color'], '#b4a3ff');
  assert.equal(p.heatNum.textContent, '5');
  p.previewCombo(); assert.equal(p.combo, 5);
  t.updateConfig({ comboPreset: 'classic' });
  assert.equal(animation.cancelled, true);
  assert.equal(p.box.className, 'wtt-combo wtt-combo-pixel');
  assert.equal(p.comboLabel.textContent, 'COMBO');
  t.updateConfig({ combo: false });
  assert.equal(p.box.style.opacity, '0');
  assert.equal(p.popAnim, null); assert.equal(p.barAnim, null);
  p.componentWillUnmount(); assert.equal(p.root, null);
});

test('reduced-motion heat preview does not animate or alter live combo state', () => {
  const t = setup({ comboPreset: 'heat', fullscreenEnabled: false });
  const p = new t.WantToType({}); p.componentDidMount(); p.reduced = true;
  p.combo = 10; p.paint();
  assert.equal(p.comboCaption.textContent, '势不可挡');
  assert.equal(p.heatAnim, null); assert.equal(p.barAnim, null);
  p.previewCombo(); assert.equal(p.combo, 10); assert.equal(p.num.textContent, '5');
  p.componentWillUnmount();
});


test('cute combo is persisted, localized, animated and cleaned up independently', () => {
  const t = setup({ comboPreset: 'cute', fullscreenEnabled: false });
  assert.equal(t.getConfig().comboPreset, 'cute');
  const p = new t.WantToType({}); p.componentDidMount(); p.combo = 12; p.paint();
  assert.equal(p.box.className, 'wtt-combo wtt-combo-cute');
  assert.equal(p.cuteNum.textContent, '12'); assert.equal(p.cuteWord.textContent, '连击');
  assert.equal(p.cuteCard.style['--wtt-cute-tint'], '#b9a7d2');
  assert.ok(p.cuteCat.style.backgroundImage.includes(t.PET_ATLASES[0]));
  assert.ok(p.cuteAnim.keyframes.every(frame => !('transform' in frame) && frame.opacity === 1));
  assert.ok(p.cuteNumAnim.keyframes.some(frame => 'transform' in frame));
  assert.equal(p.cuteCatAnim, null); assert.equal(p.cuteDogAnim, null);
  const animation = p.cuteAnim;
  p.combo = 13; p.paint(); assert.equal(p.cuteAnim, animation);
  t.updateConfig({ lang: 'en' }); assert.equal(p.cuteWord.textContent, 'COMBO');
  assert.equal(t.getConfig().bottomEnabled, true);
  t.updateConfig({ comboPreset: 'heat' });
  assert.equal(animation.cancelled, true); assert.equal(p.cuteAnim, null);
  p.componentWillUnmount();
});

test('cute combo respects reduced motion and preview does not change live count', () => {
  const t = setup({ comboPreset: 'cute', fullscreenEnabled: false });
  const p = new t.WantToType({}); p.componentDidMount(); p.reduced = true;
  p.combo = 10; p.paint(); assert.equal(p.cuteAnim, null); assert.equal(p.cuteCatAnim, null);
  p.previewCombo(); assert.equal(p.combo, 10); assert.equal(p.cuteNum.textContent, '5');
  t.updateConfig({ combo: false }); assert.equal(p.box.style.opacity, '0');
  p.componentWillUnmount();
});


test('DeepSeek combo reuses blue whale artwork and bounded water animations', () => {
  const t = setup({ comboPreset: 'deepseek', bottomEnabled: false, fullscreenEnabled: false });
  assert.equal(t.getConfig().comboPreset, 'deepseek');
  const p = new t.WantToType({}); p.componentDidMount(); p.combo = 12; p.paint();
  assert.equal(p.box.className, 'wtt-combo wtt-combo-deepseek');
  assert.equal(p.waterNum.textContent, '12'); assert.equal(p.waterWord.textContent, '连击');
  assert.ok(decodeURIComponent(p.waterWhale.style.backgroundImage).includes('#4d6bfe'));
  assert.equal(p.waterParticleAnims.length, 12);
  assert.ok(p.waterParticles.every(particle => Math.abs(parseFloat(particle.node.style.left)) < 5));
  assert.ok(p.waterParticles.filter(particle => !particle.drop).every(particle => {
    const size = parseFloat(particle.node.style.width); return size >= 2.4 && size <= 5.2;
  }));
  const emitter = { ...p.waterEmitter.style };
  assert.equal(p.waterParticles.filter(particle => particle.node.style.visibility === 'visible').length, 12);
  assert.ok(p.waterAnim.keyframes.every(frame => !('transform' in frame) && frame.opacity === 1));
  assert.equal(p.waterWhaleAnim, null);
  assert.ok(p.waterJetAnim);
  const background = p.waterAnim;
  const animations = p.waterParticleAnims;
  p.waterJetAnim.currentTime = 400; animations[0].currentTime = 250;
  p.combo = 13; p.paint(); assert.equal(p.waterParticleAnims, animations);
  assert.equal(p.waterJetAnim.currentTime, 400); assert.equal(animations[0].currentTime, 250);
  assert.equal(p.waterJetAnim.playCount, 1);
  p.waterJetAnim.playState = 'finished'; animations[0].playState = 'finished';
  p.combo = 14; p.paint();
  assert.equal(p.waterJetAnim.currentTime, 0); assert.equal(animations[0].currentTime, 0);
  assert.equal(p.waterJetAnim.playCount, 2);
  assert.equal(p.waterAnim, background);
  assert.equal(p.waterEmitter.style.left, emitter.left);
  assert.equal(p.waterEmitter.style.top, emitter.top);
  assert.ok(background.keyframes.every(frame => frame.opacity === 1));
  t.updateConfig({ lang: 'en' }); assert.equal(p.waterWord.textContent, 'COMBO');
  t.updateConfig({ combo: false }); assert.equal(p.box.style.opacity, '0');
  assert.ok(animations.every(animation => animation.cancelled));
  assert.equal(p.waterParticleAnims.length, 0);
  p.componentWillUnmount();
});

test('DeepSeek combo reduced motion stays static without particles', () => {
  const t = setup({ comboPreset: 'deepseek', fullscreenEnabled: false });
  const p = new t.WantToType({}); p.componentDidMount(); p.reduced = true;
  p.combo = 5; p.paint(); assert.equal(p.waterAnim, null);
  assert.equal(p.waterParticleAnims.length, 0);
  assert.ok(p.waterParticles.every(particle => particle.node.style.visibility === 'hidden'));
  p.previewCombo(); assert.equal(p.combo, 5);
  t.updateConfig({ comboPreset: 'cute' }); assert.equal(p.box.className, 'wtt-combo wtt-combo-cute');
  p.componentWillUnmount();
});


test('natural bubble flights vary size and speed within bounds and only float upward', () => {
  const t = setup();
  const small = t.bubbleFlight(.8, () => 0), large = t.bubbleFlight(.8, () => .9);
  assert.ok(small.size < large.size); assert.ok(small.duration < large.duration);
  for (const flight of [small, large]) {
    assert.ok(flight.size >= 2.4 && flight.size <= 5.2);
    assert.ok(flight.duration >= 1050 && flight.duration <= 1700);
    const ys = flight.frames.map(frame => Number(frame.transform.match(/translate\([^,]+,(-?[\d.]+)px/)[1]));
    assert.ok(ys.every((y, i) => !i || y < ys[i - 1]));
  }
});

test('bubble typing preset persists, emits at the caret and stays bounded', () => {
  const t = setup({ typingEnabled: true, typingPreset: 'bubbles', combo: false });
  assert.equal(t.getConfig().typingPreset, 'bubbles');
  const root = t.document.createElement('div');
  t.emitIn(root, 5, { x: 100, y: 200 });
  assert.equal(root.children.length, 2);
  assert.ok(root.children.every(node => node.className === 'wtt-spark wtt-bubble' && node.style.cssText.includes('wtt-bubble-rise')));
  for (let i = 0; i < 70; i++) t.emitIn(root, 60, { x: 100, y: 200 });
  assert.ok(root.childElementCount <= 160);
  t.updateConfig({ typingEnabled: false });
  const count = root.childElementCount;
  t.emitIn(root, 5, { x: 100, y: 200 }); assert.equal(root.childElementCount, count);
});


test('new users start with the journal theme and named themes apply atomically', () => {
  const t = setup();
  assert.equal(t.getConfig().theme, 'buddies');
  assert.equal(t.getConfig().comboPreset, 'cute');
  assert.equal(t.getConfig().typingEnabled, true);
  assert.equal(t.getConfig().typingPreset, 'cookies');
  assert.equal(t.getConfig().fullscreenEnabled, true);
  t.updateConfig({ theme: 'whale' });
  const c = t.getConfig();
  assert.equal(c.bottomPreset, 'whale'); assert.equal(c.typingPreset, 'bubbles');
  assert.equal(c.typingEnabled, true); assert.equal(c.comboPreset, 'deepseek');
  assert.equal(c.bottomEnabled, true); assert.equal(c.combo, true);
  assert.equal(c.fullscreenEnabled, true);
  t.updateConfig({ theme: 'flow' });
  assert.equal(t.getConfig().bottomPreset, 'flow'); assert.equal(t.getConfig().comboPreset, 'heat');
  assert.equal(t.getConfig().fullscreenEnabled, true);
});

test('layer switches and language preserve the selected theme and survive reload', () => {
  const t = setup(); t.updateConfig({ theme: 'flow' });
  t.updateConfig({ lang: 'en' }); assert.equal(t.getConfig().theme, 'flow');
  t.updateConfig({ fullscreenEnabled: false });
  assert.equal(t.getConfig().theme, 'flow'); assert.equal(t.getConfig().themeBase, 'flow');
  assert.equal(t.getConfig().bottomPreset, 'flow'); assert.equal(t.getConfig().comboPreset, 'heat');
  const saved = JSON.parse(t.window.localStorage.getItem('dsh.want-to-type.config.v1'));
  const restored = setup(saved).getConfig();
  assert.equal(restored.theme, 'flow'); assert.equal(restored.themeBase, 'flow');
  assert.equal(restored.lang, 'en'); assert.equal(restored.fullscreenEnabled, false);
  t.updateConfig({ theme: t.getConfig().bottomPreset });
  assert.equal(t.getConfig().theme, 'flow'); assert.equal(t.getConfig().fullscreenEnabled, true);
});

test('existing custom mixes keep every effect and exact matches get recognized', () => {
  const saved = { typingEnabled: true, typingPreset: 'fireworks', bottomEnabled: false,
    bottomPreset: 'whale', fullscreenEnabled: false, combo: false, comboPreset: 'heat', lang: 'en' };
  const c = setup(saved).getConfig();
  for (const key of Object.keys(saved)) assert.equal(c[key], saved[key]);
  assert.equal(c.theme, 'custom'); assert.equal(c.themeBase, null);
  const matched = setup({ typingEnabled: true, typingPreset: 'bubbles', bottomEnabled: true,
    bottomPreset: 'whale', fullscreenEnabled: true, combo: true, comboPreset: 'deepseek' }).getConfig();
  assert.equal(matched.theme, 'whale'); assert.equal(matched.themeBase, 'whale');
});

test('matrix uses original colored particles and aurora uses compact fireworks', () => {
  const t = setup(), root = t.document.createElement('div');
  t.updateConfig({ theme: 'matrix' }); t.emitIn(root, 10, { x: 100, y: 200 });
  assert.equal(root.children.length, 1); assert.equal(root.children[0].className, 'wtt-sprite');
  assert.ok(root.children[0].style.cssText.includes('mask-image:url('));
  assert.ok(t.effectPalette().some(ink => root.children[0].style.cssText.includes('background:' + ink + ';')));
  root.children.length = 0;
  t.updateConfig({ theme: 'flow' }); assert.equal(t.getConfig().typingPreset, 'fireworks');
  t.emitIn(root, 10, { x: 100, y: 200 });
  const halo = root.children.find(n => n.className === 'wtt-core');
  assert.ok(halo); assert.ok(Number(halo.style.cssText.match(/width:(\d+)px/)[1]) <= 28);
  assert.ok(root.children.some(n => n.className === 'wtt-spark'));
  const p = new t.WantToType({}); p.componentDidMount(); p.combo = 5; p.paint();
  assert.equal(p.heatArt.style['--combo-color'], '#b4a3ff');
  t.updateConfig({ theme: 'buddies' }); assert.equal(p.box.className, 'wtt-combo wtt-combo-cute');
  p.componentWillUnmount();
});

function nodes(tree) {
  const found = [];
  const walk = node => { if (!node || typeof node !== 'object') return; found.push(node); (node.children || []).forEach(walk); };
  walk(tree); return found;
}
test('settings and popover only expose themes, switches, preview and language', () => {
  const t = setup();
  for (const compact of [true, false]) {
    const all = nodes(t.ConfigControls({ compact }));
    assert.equal(all.filter(n => n.type === 'details').length, 0);
    assert.equal(all.filter(n => n.props.className === 'wtt-effect-group').length, 0);
    assert.equal(all.filter(n => n.props.role === 'switch').length, 5);
    assert.equal(all.filter(n => n.type === 'input' && n.props.type === 'radio').length, 0);
    assert.ok(all.some(n => n.props.className === 'wtt-segments'));
    assert.ok(all.some(n => n.props.className === 'wtt-preview'));
    const cards = all.filter(n => n.type === 'button' && (n.props.className || '').startsWith('wtt-theme wtt-theme-'));
    assert.equal(cards.length, 4); assert.equal(cards[0].props['aria-pressed'], true);
    cards[1].props.onClick(); assert.equal(t.getConfig().theme, 'whale');
    t.updateConfig({ theme: 'buddies' });
  }
});


function typeSpeedKeys(t, p, count, interval = 150) {
  for (let i = 0; i < count; i++) {
    p.onKeyDown({ target: { tagName: 'TEXTAREA' }, code: 'KeyA', isComposing: true });
    t.advance(interval);
  }
}

test('fullscreen requires sustained typing speed and remains visible until speed falls', () => {
  const t = setup({ fullscreenEnabled: true, bottomEnabled: false, typingEnabled: false, combo: false });
  const p = new t.WantToType({}); p.componentDidMount();
  typeSpeedKeys(t, p, 10);
  assert.equal(p.fullscreenActive, false); // Fast, but not held for one second yet.
  typeSpeedKeys(t, p, 1);
  assert.equal(p.fullscreenActive, true); assert.equal(p.vignette.style.opacity, '1');
  const shadow = p.vignette.style.boxShadow;
  typeSpeedKeys(t, p, 30);
  assert.equal(p.fullscreenActive, true); assert.equal(p.fullscreenAnim, null);
  assert.equal(p.vignette.style.boxShadow, shadow); assert.equal(p.combo, 0);
  typeSpeedKeys(t, p, 5, 350); // Keep typing, but too slowly.
  assert.equal(p.fullscreenActive, false); assert.equal(p.vignette.style.opacity, '0');
  typeSpeedKeys(t, p, 25); assert.equal(p.fullscreenActive, true);
  t.advance(1100); // Stops without needing another key/input event.
  assert.equal(p.fullscreenActive, false); assert.equal(p.speedTimer, 0);
  p.combo = 75; p.paint(); assert.equal(p.fullscreenActive, false); assert.equal(p.fullscreenAnim, null);
  p.componentWillUnmount();
});

test('brief bursts and threshold-speed typing do not qualify; paste and repeat do not count', () => {
  const t = setup({ fullscreenEnabled: true, bottomEnabled: false }), p = new t.WantToType({}); p.componentDidMount();
  typeSpeedKeys(t, p, 9, 25); t.advance(2100); assert.equal(p.fullscreenActive, false);
  typeSpeedKeys(t, p, 30, 340); assert.equal(p.fullscreenActive, false);
  p.resetTypingSpeed();
  const editor = { tagName: 'TEXTAREA' };
  for (const patch of [{ repeat: true }, { metaKey: true }, { ctrlKey: true }, { altKey: true }, { code: 'ArrowLeft' }])
    p.onKeyDown({ target: editor, code: 'KeyA', ...patch });
  p.onInput({ target: editor, inputType: 'insertFromPaste', data: 'a'.repeat(1000) });
  assert.equal(p.speedSamples.length, 0);
  p.onKeyDown({ target: editor, code: 'KeyA', isComposing: true });
  p.onCompositionUpdate({ target: editor, data: 'ni' });
  p.onCompositionEnd({ target: editor, data: '你' });
  assert.equal(p.speedSamples.length, 1);
  p.componentWillUnmount();
});

test('speed fullscreen resets on disable, blur, hidden document and unmount', () => {
  const t = setup({ fullscreenEnabled: true, bottomEnabled: false }), p = new t.WantToType({}); p.componentDidMount();
  typeSpeedKeys(t, p, 25); assert.equal(p.fullscreenActive, true);
  t.updateConfig({ theme: 'matrix', bottomEnabled: false });
  assert.equal(p.fullscreenActive, true); assert.equal(p.vignette.style.opacity, '1');
  assert.ok(t.effectPalette('particles', 'fullscreen').filter(color => p.vignette.style.boxShadow.includes(color)).length >= 5);
  t.updateConfig({ fullscreenEnabled: false });
  assert.equal(p.fullscreenActive, false); assert.equal(p.speedTimer, 0); assert.equal(p.speedSamples.length, 0);
  t.updateConfig({ fullscreenEnabled: true }); assert.equal(p.fullscreenActive, false);
  typeSpeedKeys(t, p, 25); assert.equal(p.fullscreenActive, true);
  t.events.get('blur')(); assert.equal(p.fullscreenActive, false); assert.equal(p.speedSince, null);
  typeSpeedKeys(t, p, 25); assert.equal(p.fullscreenActive, true);
  t.document.hidden = true; t.events.get('visibilitychange')();
  assert.equal(p.fullscreenActive, false); assert.equal(p.speedTimer, 0);
  t.document.hidden = false; p.reduced = true; typeSpeedKeys(t, p, 25); assert.equal(p.fullscreenActive, false);
  p.reduced = false; typeSpeedKeys(t, p, 25); assert.equal(p.fullscreenActive, true);
  const timer = p.speedTimer; p.componentWillUnmount();
  assert.equal(p.speedTimer, 0); assert.equal(t.timers.has(timer), false); assert.equal(p.fullscreenActive, false);
});

test('fullscreen scene palettes apply immediately, rainbow stays at edges and old flashes cancel', () => {
  const t = setup(), p = new t.WantToType({}); p.componentDidMount();
  for (const theme of ['buddies', 'whale', 'matrix', 'flow']) {
    const previous = p.fullscreenAnim;
    t.updateConfig({ theme }); assert.equal(t.getConfig().fullscreenEnabled, true);
    if (previous) assert.equal(previous.cancelled, true);
    p.tierFlash(1);
    assert.equal(p.vignette.style.background, 'transparent');
    assert.equal(p.vignette.style.maskImage, 'none');
    assert.ok(p.vignette.style.boxShadow.includes('inset'));
    assert.ok(t.effectPalette('particles', 'fullscreen').some(color => p.vignette.style.boxShadow.includes(color)));
    assert.equal(p.fullscreenAnim.options.duration, 460);
    assert.equal(p.fullscreenAnim.keyframes[1].opacity, 1);
    if (theme === 'flow' || theme === 'matrix') assert.ok(t.effectPalette('particles', 'fullscreen').filter(color => p.vignette.style.boxShadow.includes(color)).length >= 5);
  }
  const animation = p.fullscreenAnim; t.updateConfig({ fullscreenEnabled: false });
  assert.equal(animation.cancelled, true); assert.equal(p.fullscreenAnim, null);
  p.reduced = true; t.updateConfig({ fullscreenEnabled: true }); p.tierFlash(1);
  assert.equal(p.fullscreenAnim, null); p.componentWillUnmount();
});

test('journal theme emits warm bone cookies and keeps nodes bounded', () => {
  const t = setup(), root = t.document.createElement('div');
  assert.equal(t.getConfig().typingPreset, 'cookies');
  t.emitIn(root, 6, { x: 100, y: 200 }); assert.equal(root.children.length, 2);
  assert.ok(root.children.every(node => node.className === 'wtt-spark wtt-cookie'));
  assert.ok(root.children.every(node => node.style.cssText.includes('data:image/svg+xml,') && node.style.cssText.includes('wtt-cookie-float')));
  assert.ok(root.children.every(node => t.effectPalette().some(ink => decodeURIComponent(node.style.cssText).includes(ink))));
  for (let i = 0; i < 60; i++) t.emitIn(root, 60, { x: 100, y: 200 });
  assert.ok(root.childElementCount <= 160);
  const saved = JSON.parse(t.window.localStorage.getItem('dsh.want-to-type.config.v1') || '{}');
  t.updateConfig({ typingPreset: 'cookies' });
  assert.equal(t.getConfig().theme, 'buddies'); assert.equal(t.getConfig().themeBase, 'buddies');
  assert.equal(setup({ typingPreset: 'cookies', typingEnabled: true }).getConfig().typingPreset, 'cookies');
});


test('bottom whale fills its belly and eye white using the same moving outline', () => {
  const t = setup(), fills = [], state = [];
  let path = [];
  const ctx = { fillStyle: '#4d6bfe', shadowBlur: 3,
    beginPath() { path = []; }, closePath() {},
    moveTo(...p) { path.push(['M', ...p]); }, lineTo(...p) { path.push(['L', ...p]); },
    bezierCurveTo(...p) { path.push(['C', ...p]); },
    fill() { fills.push({ color: this.fillStyle, shadow: this.shadowBlur, path }); },
    save() { state.push({ fillStyle: this.fillStyle, shadowBlur: this.shadowBlur }); },
    restore() { Object.assign(this, state.pop()); },
  };
  t.drawWhaleOutline(ctx, 0, 0);
  assert.equal(fills.length, 3); assert.equal(fills[0].color, '#4d6bfe');
  assert.equal(fills[1].color, '#ffffff'); assert.equal(fills[1].shadow, 0);
  assert.equal(fills[1].path.filter(p => p[0] === 'M').length, 1);
  assert.ok(Math.abs(fills[1].path[0][1] - (13.0143 - 13.5)) < .00001);
  assert.equal(fills[2].color, '#ffffff'); assert.equal(fills[2].shadow, 0);
  assert.equal(fills[2].path.filter(p => p[0] === 'M').length, 2);
  assert.ok(Math.abs(fills[2].path[0][1] - (14.1252 - 13.5)) < .00001);
  assert.ok(fills[2].path.some(p => p[0] === 'M' && Math.abs(p[1] - (17.5759 - 13.5)) < .00001));
  assert.equal(ctx.fillStyle, '#4d6bfe'); assert.equal(ctx.shadowBlur, 3);
});

test('pixel combo bar loses whole cells without scaling and clears on theme switch', () => {
  const t = setup({ theme: 'matrix' }), p = new t.WantToType({}); p.componentDidMount();
  p.combo = 8; p.paint();
  assert.equal(p.box.className, 'wtt-combo wtt-combo-pixel');
  assert.equal(p.barAnim.options.easing, 'steps(12,end)');
  assert.ok(p.barAnim.keyframes.every(frame => 'clipPath' in frame && !('transform' in frame)));
  const pixelAnimation = p.barAnim;
  t.updateConfig({ theme: 'whale' }); t.selectThemePart('combo', 'flow');
  assert.equal(pixelAnimation.cancelled, true); assert.equal(p.box.className, 'wtt-combo wtt-combo-heat');
  assert.equal(p.barAnim, null);
  p.componentWillUnmount();
});


test('dogs slow down while repeated targets retain continuous motion', () => {
  const { PetChase } = setup(), chase = new PetChase(); chase.retarget(.95, 1);
  const [cat, dog, puff] = chase.runners;
  assert.equal(cat.p.travel, 1.8); assert.equal(cat.p.runFPS, 9);
  assert.ok(dog.duration > Math.abs(dog.target - dog.origin) * .9);
  assert.ok(puff.duration > Math.abs(puff.target - puff.origin) * 1.3);
  const before = chase.runners.map(r => ({ born: r.born, duration: r.duration, origin: r.origin }));
  const position = chase.position(dog, 1.1);
  chase.retarget(.95, 1.1);
  chase.runners.forEach((r, i) => {
    assert.equal(r.born, before[i].born); assert.equal(r.duration, before[i].duration);
    assert.equal(r.origin, before[i].origin);
  });
  assert.ok(chase.position(chase.runners[1], 1.15) > position);
  chase.retarget(.05, 1.2); const turned = chase.runners[1];
  assert.equal(turned.direction, -1);
  assert.equal(chase.pose(turned, turned.born + .01, 0, false).row, 1);
});


test('glow size follows the viewport, stays fixed across milestones and has soft negative spread', () => {
  const t = setup(); t.updateConfig({ theme: 'whale' });
  for (const milestone of [1, 2, 50]) {
    assert.ok(t.fullscreenLook(milestone).boxShadow.startsWith('inset 0 0 72px -13px '));
  }
  assert.equal(t.fullscreenLook(1).maskImage, 'none');
  t.window.innerWidth = 375; t.window.innerHeight = 812;
  assert.ok(t.fullscreenLook(1).boxShadow.startsWith('inset 0 0 36px -6px '));
  t.window.innerWidth = 2560; t.window.innerHeight = 1440;
  assert.ok(t.fullscreenLook(1).boxShadow.startsWith('inset 0 0 80px -14px '));
  t.updateConfig({ theme: 'flow' });
  assert.ok(t.fullscreenLook(1).boxShadow.includes('80px -42px '));
});


test('theme parts match their actual effects and never recolor another layer', () => {
  const t = setup(); t.updateConfig({ theme: 'flow' });
  t.updateConfig({ typingEnabled: false, fullscreenEnabled: false });
  t.selectThemePart('typing', 'matrix');
  let c = t.getConfig();
  assert.equal(c.theme, 'custom'); assert.equal(c.typingPreset, 'particles');
  assert.equal(c.typingScene, 'matrix'); assert.equal(c.fullscreenScene, 'flow');
  assert.equal(c.comboScene, 'flow'); assert.equal(c.bottomPreset, 'flow');
  assert.equal(c.typingEnabled, false); assert.equal(c.fullscreenEnabled, false);
  assert.equal(t.effectPalette().length, 3);
  assert.ok(t.fullscreenLook(1).boxShadow.includes('#ff9fc5'));
  t.selectThemePart('fullscreen', 'whale');
  assert.equal(t.sceneId('fullscreen'), 'whale'); assert.equal(t.sceneId('typing'), 'matrix');
  assert.ok(t.fullscreenLook(1).boxShadow.includes('#9edcff'));
  t.selectThemePart('combo', 'whale'); assert.equal(t.getConfig().comboPreset, 'deepseek');
  t.selectThemePart('bottom', 'whale'); assert.equal(t.getConfig().typingPreset, 'particles');
  t.selectThemePart('typing', 'whale'); c = t.getConfig();
  assert.equal(c.theme, 'whale'); assert.equal(c.typingPreset, 'bubbles');
  assert.equal(c.typingEnabled, false); assert.equal(c.fullscreenEnabled, false);
  const restored = setup(JSON.parse(t.window.localStorage.getItem('dsh.want-to-type.config.v1'))).getConfig();
  assert.equal(restored.theme, 'whale'); assert.equal(restored.typingEnabled, false);
  assert.equal(restored.fullscreenEnabled, false); assert.equal(restored.comboScene, 'whale');
});

test('legacy mixes keep working with switches and can return to a full theme', () => {
  const t = setup(); t.updateConfig({ bottomEnabled: false });
  t.selectThemePart('typing', 'flow');
  const all = nodes(t.ConfigControls({ compact: true }));
  assert.equal(t.getConfig().typingPreset, 'fireworks');
  assert.equal(all.filter(n => n.type === 'input' && n.props.type === 'radio').length, 0);
  const toggle = all.find(n => n.props.role === 'switch' && n.props['aria-label'] === '连击计数');
  toggle.props.onChange({ target: { checked: false } });
  const saved = setup(JSON.parse(t.window.localStorage.getItem('dsh.want-to-type.config.v1'))).getConfig();
  assert.equal(saved.typingScene, 'flow'); assert.equal(saved.combo, false); assert.equal(saved.bottomEnabled, false);
  const theme = all.find(n => n.props.className === 'wtt-theme wtt-theme-whale');
  theme.props.onClick();
  assert.equal(t.getConfig().theme, 'whale'); assert.equal(t.getConfig().typingPreset, 'bubbles');
  assert.equal(t.getConfig().combo, true); assert.equal(t.getConfig().bottomEnabled, true);
});


test('sound is an independent saved preference and each theme produces a distinct voice', () => {
  const t = setup(undefined, 'running');
  assert.equal(t.getConfig().soundEnabled, false);
  const sound = new t.TypingSound(); sound.play('whale'); assert.equal(t.audioContexts.length, 0);
  t.updateConfig({ soundEnabled: true });
  for (const scene of ['buddies', 'whale', 'matrix', 'flow']) {
    t.updateConfig({ theme: scene }); assert.equal(t.getConfig().soundEnabled, true);
    const before = t.audioContexts[0]?.nodes.length || 0;
    sound.play(scene, .5);
    const nodes = t.audioContexts[0].nodes.slice(before);
    const oscillators = nodes.filter(n => n.kind === 'oscillator');
    if (scene === 'buddies') assert.deepEqual(oscillators.map(n => n.type), ['sine', 'sine', 'sine', 'sine', 'sine']);
    if (scene === 'whale') assert.ok(oscillators.every(n => n.frequency.events[1][1] > n.frequency.events[0][1]));
    if (scene === 'matrix') { assert.equal(nodes.filter(n => n.kind === 'noise').length, 1); assert.equal(oscillators.length, 0); }
    if (scene === 'flow') assert.ok(oscillators.every(n => n.frequency.events[1][1] < n.frequency.events[0][1]));
    t.advance(40);
  }
  assert.equal(t.audioContexts.length, 1);
  const saved = JSON.parse(t.window.localStorage.getItem(''));
  assert.equal(setup(saved).getConfig().soundEnabled, true);
  t.updateConfig({ soundEnabled: false, theme: 'whale' }); assert.equal(t.getConfig().soundEnabled, false);
  sound.destroy(); assert.equal(t.audioContexts[0].state, 'closed');
});

test('sound plays once per physical key, independently of visuals, and stops with its switch', () => {
  const t = setup({ soundEnabled: true, bottomEnabled: false, typingEnabled: false, fullscreenEnabled: false, combo: false }, 'running');
  const p = new t.WantToType({}); p.componentDidMount(); const editor = { tagName: 'TEXTAREA' };
  p.onKeyDown({ target: editor, code: 'KeyA', isComposing: true });
  const sound = p.typingSound; assert.equal(sound.voices.size, 1);
  p.onCompositionUpdate({ target: editor, data: 'ni' }); p.onCompositionEnd({ target: editor, data: '你' });
  t.advance(40);
  for (const patch of [{ repeat: true }, { ctrlKey: true }, { code: 'ArrowLeft' }]) p.onKeyDown({ target: editor, code: 'KeyA', ...patch });
  assert.equal(sound.voices.size, 1);
  t.updateConfig({ soundEnabled: false });
  const voice = [...sound.voices][0]; assert.ok(voice.bus.gain.events.some(e => e[0] === 'linear' && e[1] === 0));
  p.onKeyDown({ target: editor, code: 'KeyA' }); assert.equal(sound.voices.size, 1);
  t.updateConfig({ soundEnabled: true }); t.advance(1500);
  p.onKeyDown({ target: editor, code: 'KeyA' }); assert.equal(sound.voices.size, 2);
  t.events.get('blur')(); assert.ok([...sound.voices].every(v => v.bus.gain.value === 0));
  p.componentWillUnmount(); assert.equal(sound.voices.size, 0); assert.equal(t.audioContexts[0].state, 'closed');
});

test('sound bounds polyphony, releases finished nodes and ignores missing audio support', () => {
  const t = setup({ soundEnabled: true }, 'running'), sound = new t.TypingSound();
  for (let i = 0; i < 40; i++) { sound.play('matrix'); t.advance(30); }
  assert.equal(sound.voices.size, 8);
  const voice = [...sound.voices][0];
  voice.sources.forEach(source => source.onended());
  assert.equal(sound.voices.size, 7); assert.ok(voice.nodes.every(node => node.disconnected));
  const count = sound.voices.size; sound.play('flow'); sound.play('flow'); assert.equal(sound.voices.size, count + 1);
  sound.destroy(); assert.equal(sound.voices.size, 0);
  const unsupported = setup({ soundEnabled: true }); assert.doesNotThrow(() => new unsupported.TypingSound().play('whale'));
});

test('cancelled audio resume does not replay a note after sound stops', async () => {
  const t = setup({ soundEnabled: true }, 'suspended'), sound = new t.TypingSound();
  sound.play('whale'); sound.stop(); await Promise.resolve();
  assert.equal(sound.voices.size, 0);
  t.advance(40); sound.play('flow'); assert.equal(sound.voices.size, 1);
  sound.destroy();
});


test('piano follows complete scores and preserves rhythm instead of mapping keys to random pitches', () => {
  const t = setup({ soundEnabled: true }, 'running'), sound = new t.TypingSound();
  sound.play('buddies', .01);
  const piece = t.PIANO_PIECES[sound.pianoPiece], context = t.audioContexts[0];
  const firstIndex = sound.pianoIndex;
  t.advance(35); sound.play('buddies', .99);
  assert.equal(sound.pianoIndex, firstIndex); // Extra keys sustain the current scored note.
  t.advance(1500);
  for (let index = 1; index < piece.notes.length; index++) {
    const before = context.nodes.length;
    sound.play('buddies', index % 2 ? .01 : .99);
    const fundamental = context.nodes.slice(before).find(node => node.kind === 'oscillator');
    assert.ok(Math.abs(fundamental.frequency.events[0][1] - 440 * 2 ** ((piece.notes[index].midi - 69) / 12)) < .001);
    t.advance(piece.notes[index].beats * 60000 / piece.bpm + 1);
  }
  assert.equal(sound.pianoIndex, 0); assert.equal(t.timers.size, 0); // No autonomous playback.
  const selected = sound.pianoPiece; sound.play('buddies');
  assert.equal(sound.pianoPiece, selected); assert.equal(sound.pianoIndex, 1);
  for (const score of t.PIANO_PIECES) {
    assert.equal(score.notes.reduce((sum, step) => sum + step.beats, 0), 32);
    assert.equal(score.notes.filter(step => step.bass !== null).length, 8);
  }
  sound.destroy();
});

test('piano resumes within thirty seconds and starts a different phrase after a longer pause', () => {
  const t = setup({ soundEnabled: true }, 'running'), sound = new t.TypingSound();
  sound.play('buddies'); const selected = sound.pianoPiece;
  t.advance(30000); sound.play('buddies');
  assert.equal(sound.pianoPiece, selected); assert.equal(sound.pianoIndex, 2);
  t.advance(30001); sound.play('buddies');
  assert.notEqual(sound.pianoPiece, selected); assert.equal(sound.pianoIndex, 1);
  const resumed = sound.pianoPiece; sound.stop(); t.advance(1500); sound.play('buddies');
  assert.equal(sound.pianoPiece, resumed); assert.equal(sound.pianoIndex, 2);
  const cursor = sound.pianoIndex, lastInput = sound.pianoLastInputAt;
  t.advance(1000); sound.play('buddies', .5, true);
  assert.equal(sound.pianoIndex, cursor); assert.equal(sound.pianoLastInputAt, lastInput);
  sound.destroy();
});

test('matrix plays real keyboard recordings, caches decoded buffers and preserves special keys', () => {
  const t = setup({ soundEnabled: true }, 'running'), sound = new t.TypingSound();
  sound.play('matrix', .2, false, 'KeyA');
  const ctx = t.audioContexts[0], samples = () => ctx.nodes.filter(node => node.kind === 'noise');
  const first = samples()[0].buffer;
  assert.ok(first.duration > .1 && first.duration < .3);
  assert.ok(first.getChannelData(0).some(value => Math.abs(value) > .1));
  assert.equal(ctx.nodes.filter(node => node.kind === 'oscillator').length, 0);
  t.advance(50); sound.play('matrix', .2, false, 'KeyA');
  assert.equal(samples()[1].buffer, first); assert.equal(sound.keyboardBuffers.size, 1);
  t.advance(50); sound.play('matrix', .5, false, 'Space');
  assert.notEqual(samples()[2].buffer, first); assert.equal(sound.keyboardBuffers.size, 2);
  t.advance(50); sound.play('matrix', .9, false, 'Backspace');
  assert.notEqual(samples()[3].buffer, first); assert.equal(sound.keyboardBuffers.size, 3);
  sound.destroy(); assert.equal(sound.keyboardBuffers.size, 0);
});
