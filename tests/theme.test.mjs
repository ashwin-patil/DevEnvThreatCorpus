import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/theme.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const key = 'devenv-threat-corpus.theme';

function harness({ saved = null, readError = false, writeError = false, readyState = 'complete' } = {}) {
  const attributes = new Map(), pressed = new Map([['aria-label', 'Dark mode']]), events = new Map(), writes = [], reads = [];
  const toggle = {
    textContent: '',
    setAttribute: (name, value) => pressed.set(name, value),
    addEventListener: (name, fn) => events.set(name, fn),
  };
  const notice = { textContent: '', hidden: true };
  const storage = {
    getItem(name) {
      reads.push(name);
      if (readError) throw new Error('Synthetic storage read denied');
      return saved;
    },
    setItem(name, value) {
      if (writeError) throw new Error('Synthetic storage write denied');
      writes.push([name, value]);
      saved = value;
    },
  };
  let systemQueries = 0, domReady;
  const document = {
    readyState,
    documentElement: { setAttribute: (name, value) => attributes.set(name, value) },
    getElementById: id => ({ 'theme-toggle': toggle, 'theme-notice': notice })[id],
    addEventListener(name, fn, options) {
      assert.equal(name, 'DOMContentLoaded');
      assert.equal(options.once, true);
      domReady = fn;
    },
  };
  runInNewContext(source, {
    document,
    window: {
      localStorage: storage,
      matchMedia: () => { systemQueries++; return { matches: true }; },
    },
  });
  return { attributes, pressed, toggle, notice, writes, reads,
    click: () => events.get('click')(), domReady: () => domReady(), systemQueries: () => systemQueries };
}

test('Issue #79 AC-07 light is the initial theme even for a dark-preferring browser', () => {
  const page = harness({ readyState: 'loading' });
  assert.equal(page.attributes.get('data-theme'), 'light');
  assert.equal(page.systemQueries(), 0);
  assert.deepEqual(page.reads, [key]);
  assert.deepEqual(page.writes, []);
  page.domReady();
  assert.equal(page.pressed.get('aria-pressed'), 'false');
  assert.equal(page.toggle.title, 'Switch to dark theme');
  assert.equal(page.notice.hidden, true);
});

test('Issue #79 AC-07 valid explicit preferences restore before the header mounts', () => {
  for (const saved of ['light', 'dark']) {
    const page = harness({ saved, readyState: 'loading' });
    assert.equal(page.attributes.get('data-theme'), saved);
    page.domReady();
    assert.equal(page.pressed.get('aria-pressed'), String(saved === 'dark'));
    assert.equal(page.notice.hidden, true);
  }
});

test('Issue #79 AC-07 the header toggle persists only the theme and keeps a stable accessible name', () => {
  const page = harness();
  page.click();
  assert.equal(page.attributes.get('data-theme'), 'dark');
  assert.equal(page.pressed.get('aria-pressed'), 'true');
  assert.equal(page.toggle.title, 'Switch to light theme');
  assert.equal(page.pressed.get('aria-label'), 'Dark mode');
  assert.equal(page.toggle.textContent, '');
  assert.deepEqual(page.writes, [[key, 'dark']]);
  assert.equal(harness({ saved: page.writes.at(-1)[1] }).attributes.get('data-theme'), 'dark');
  page.click();
  assert.equal(page.attributes.get('data-theme'), 'light');
  assert.equal(page.pressed.get('aria-pressed'), 'false');
  assert.deepEqual(page.writes, [[key, 'dark'], [key, 'light']]);
});

test('Issue #79 AC-07 compact sun/moon control keeps icons decorative and a stable accessible toggle name', () => {
  const button = html.match(/<button id="theme-toggle"[\s\S]*?<\/button>/)[0];
  assert.match(button, /type="button" aria-label="Dark mode" aria-pressed="false"/);
  assert.equal([...button.matchAll(/<svg\b/g)].length, 2);
  for (const icon of ['sun', 'moon']) {
    assert.match(button, new RegExp(`class="theme-option theme-${icon}" aria-hidden="true"`));
  }
  assert.equal([...button.matchAll(/focusable="false"/g)].length, 2);
  assert.equal(button.replace(/<[^>]+>/g, '').trim(), '');
  assert.match(css, /\.theme-toggle\[aria-pressed=false\] \.theme-sun,\.theme-toggle\[aria-pressed=true\] \.theme-moon\{/);
  assert.match(css, /@media\(pointer:coarse\)\{\.theme-toggle\{min-height:44px\}/);
});

test('Issue #79 AC-07 invalid saved values never become attributes and show an actionable notice', () => {
  for (const saved of ['system', 'DARK', '<script>untrusted</script>']) {
    const page = harness({ saved });
    assert.equal(page.attributes.get('data-theme'), 'light');
    assert.equal(page.notice.hidden, false);
    assert.match(page.notice.textContent, /invalid.*choose a theme/);
    page.click();
    assert.equal(page.attributes.get('data-theme'), 'dark');
    assert.equal(page.notice.hidden, true);
    assert.equal(page.notice.textContent, '');
  }
});

test('Issue #79 AC-07 storage failures remain visible without disabling page-local switching', () => {
  const deniedRead = harness({ readError: true });
  assert.equal(deniedRead.attributes.get('data-theme'), 'light');
  assert.equal(deniedRead.notice.hidden, false);
  assert.match(deniedRead.notice.textContent, /could not be read/);
  deniedRead.click();
  assert.equal(deniedRead.attributes.get('data-theme'), 'dark');
  assert.equal(deniedRead.notice.hidden, true);

  const deniedWrite = harness({ saved: 'dark', writeError: true });
  deniedWrite.click();
  assert.equal(deniedWrite.attributes.get('data-theme'), 'light');
  assert.equal(deniedWrite.pressed.get('aria-pressed'), 'false');
  assert.equal(deniedWrite.notice.hidden, false);
  assert.match(deniedWrite.notice.textContent, /page only.*could not be saved/);
  deniedWrite.click();
  assert.equal(deniedWrite.attributes.get('data-theme'), 'dark');
  assert.deepEqual(deniedWrite.writes, []);
});

function palette(selector) {
  const block = css.match(new RegExp(`${selector}\\{([^}]+)\\}`))[1];
  return Object.fromEntries([...block.matchAll(/--([\w-]+):([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}
const palettes = { light: palette(':root'), dark: palette(':root\\[data-theme=dark\\]') };
function contrast(foreground, background) {
  const luminance = hex => hex.slice(1).match(/../g).map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('Issue #79 AC-06 both themes meet 4.5:1 for normal text, semantic badges and graph labels', () => {
  for (const [theme, colors] of Object.entries(palettes)) {
    const pairs = [
      ...['paper', 'surface', 'selected', 'tint', 'soft', 'highlight-hover', 'group', 'activity'].map(bg => ['ink', bg]),
      ...['paper', 'surface', 'selected', 'tint', 'soft', 'group', 'activity'].map(bg => ['muted', bg]),
      ...['paper', 'surface', 'selected', 'tint', 'soft', 'group', 'activity'].map(bg => ['green', bg]),
      ['accent', 'paper'], ['accent', 'surface'], ['conditional', 'soft'], ['propagation', 'paper'],
      ...['danger', 'warning', 'reported', 'example', 'accepted', 'neutral'].map(kind => [`${kind}-ink`, `${kind}-bg`]),
      ...['danger', 'warning', 'reported', 'example', 'accepted', 'neutral'].map(kind => [`${kind}-ink`, 'surface']),
    ];
    for (const [fg, bg] of pairs) {
      const ratio = contrast(colors[fg], colors[bg]);
      assert.ok(ratio >= 4.5, `${theme} ${fg}/${bg}: ${ratio.toFixed(3)}:1`);
    }
    for (const bg of ['paper', 'surface']) {
      const ratio = contrast(colors['control-border'], colors[bg]);
      assert.ok(ratio >= 3, `${theme} control boundary/${bg}: ${ratio.toFixed(3)}:1`);
    }
  }
});

test('Issue #79 AC-06 every component color is theme-tokenized with no automatic dark override', () => {
  const components = css.replace(/:root(?:\[data-theme=dark\])?\{[^}]*\}/g, '');
  assert.doesNotMatch(components, /#[a-f\d]{3,8}\b|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(css, /prefers-color-scheme/);
  for (const [, name] of components.matchAll(/var\(--([\w-]+)\)/g)) {
    for (const [theme, colors] of Object.entries(palettes)) assert.ok(colors[name], `${theme} defines ${name}`);
  }
  assert.match(css, /:root\{\s*color-scheme:light/);
  assert.match(css, /:root\[data-theme=dark\]\{\s*color-scheme:dark/);
});

test('Issue #79 AC-06 theme-specific wordmark text meets 4.5:1 without changing branding geometry', async () => {
  const logos = await Promise.all(['logo.svg', 'logo-dark.svg'].map(name =>
    readFile(new URL(`../docs/assets/${name}`, import.meta.url), 'utf8')));
  for (const [index, theme] of ['light', 'dark'].entries()) {
    assert.match(logos[index], /viewBox="0 0 540 120"/);
    for (const [, fg] of logos[index].matchAll(/<(?:text|tspan)\b[^>]*fill="(#[a-f\d]{6})"/g)) {
      const ratio = contrast(fg, palettes[theme].paper);
      assert.ok(ratio >= 4.5, `${theme} wordmark ${fg}: ${ratio.toFixed(3)}:1`);
    }
  }
  assert.deepEqual([...logos[0].matchAll(/<path\b[^>]* d="([^"]+)"/g)].map(match => match[1]),
    [...logos[1].matchAll(/<path\b[^>]* d="([^"]+)"/g)].map(match => match[1]));
});

test('Issue #79 AC-07 preference bootstrap is external, before styles and independent of corpus startup', () => {
  assert.match(html, /<html[^>]+data-theme="light"/);
  const bootstrap = html.indexOf('<script src="/src/theme.js"></script>');
  assert.ok(bootstrap > 0 && bootstrap < html.indexOf('rel="stylesheet"'));
  assert.match(html, /id="theme-toggle"[^>]+type="button"[^>]+aria-pressed="false"/);
  assert.match(html, /id="theme-notice"[^>]+role="status"/);
  assert.doesNotMatch(source, /fetch\(|location\.|history\.|mountWorkbench|createModel/);
  assert.doesNotMatch(html, /<script(?:\s[^>]*)?>(?!<\/script>)/);
});
