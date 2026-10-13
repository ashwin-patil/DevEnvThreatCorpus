export const ARTICLE_PARSER_VERSION = 'readable-html/2';
export const PUBLISHERS = Object.freeze({
  'stepsecurity.io': 'StepSecurity',
  'socket.dev': 'Socket',
  'redcanary.com': 'Red Canary',
});

const entities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', copy: '©', reg: '®', trade: '™', bull: '•', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', ensp: ' ', emsp: ' ', thinsp: ' ', laquo: '«', raquo: '»',
};
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]+);?/gi, (match, name) => {
    if (name[0] !== '#') return entities[name] ?? match;
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : '\ufffd';
  });
}
const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const hiddenTags = new Set('head script style template noscript iframe object svg form nav footer'.split(' '));
const blockTags = new Set('html body div p br hr h1 h2 h3 h4 h5 h6 ul ol li pre blockquote section article main header table tr td th dl dt dd figure figcaption'.split(' '));

function tree(raw) {
  const root = { name: 'root', attrs: {}, children: [] }, stack = [root];
  const tokens = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?[a-z](?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+|</gi;
  let match, skip = null;
  while ((match = tokens.exec(raw))) {
    const token = match[0];
    if (skip) {
      if (new RegExp(`^</${skip}\\s*>$`, 'i').test(token)) { stack.pop(); skip = null; }
      continue;
    }
    if (/^<!/.test(token)) continue;
    if (!/^<\/?[a-z]/i.test(token)) {
      stack.at(-1).children.push(decodeEntities(token));
      continue;
    }
    const name = /^<\/?([^\s/>]+)/.exec(token)[1].toLowerCase();
    if (token.startsWith('</')) {
      const index = stack.findLastIndex(node => node.name === name);
      if (index > 0) stack.length = index;
      continue;
    }
    if (name === 'body') stack.length = 1;
    if (name === 'li' && stack.at(-1).name === 'li') stack.pop();
    if (blockTags.has(name) && stack.at(-1).name === 'p') stack.pop();
    const attrs = {};
    const attrText = token.slice(/^<\/?([^\s/>]+)/.exec(token)[0].length, -1);
    for (const attr of attrText.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const key = attr[1].toLowerCase();
      if (!Object.hasOwn(attrs, key)) attrs[key] = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    const node = { name, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!voidTags.has(name)) {
      if (stack.length < 256) stack.push(node);
      if (['script', 'style'].includes(name)) {
        if (name === 'script' && /ld\+json/i.test(attrs.type ?? '')) {
          const closing = /<\/script\s*>/gi;
          closing.lastIndex = tokens.lastIndex;
          const end = closing.exec(raw);
          node.children.push(raw.slice(tokens.lastIndex, end?.index ?? raw.length));
          tokens.lastIndex = end ? closing.lastIndex : raw.length;
          stack.pop();
        } else skip = name;
      }
    }
  }
  return root;
}

function nodes(root, predicate) {
  const result = [], pending = [root];
  while (pending.length) {
    const node = pending.pop();
    if (typeof node === 'string') continue;
    if (predicate(node)) result.push(node);
    pending.push(...node.children.toReversed());
  }
  return result;
}

function textOf(root) {
  const chunks = [], preserved = [];
  const walk = (node, pre = false) => {
    if (typeof node === 'string') {
      chunks.push(pre ? node : node.replace(/\s+/g, ' '));
      return;
    }
    if (hiddenTags.has(node.name) || Object.hasOwn(node.attrs, 'hidden') || node.attrs['aria-hidden'] === 'true') return;
    if (node.name === 'pre' && !pre) {
      const start = chunks.length;
      for (const child of node.children) walk(child, true);
      const text = chunks.splice(start).join('');
      chunks.push(`\n\0${preserved.length}\0\n`);
      preserved.push(text);
      return;
    }
    const block = blockTags.has(node.name);
    if (block) chunks.push('\n');
    for (const child of node.children) walk(child, pre || node.name === 'pre');
    if (block) chunks.push('\n');
  };
  walk(root);
  return chunks.join('').replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n+/g, '\n').trim()
    .replace(/\0(\d+)\0/g, (_, index) => preserved[Number(index)]);
}
const clean = value => typeof value === 'string' && value.trim() ? value.trim() : null;

export function parseArticle(raw, url) {
  const root = tree(raw);
  const article = nodes(root, node => node.name === 'article')[0]
    ?? nodes(root, node => node.name === 'main' || node.attrs.role === 'main')[0]
    ?? nodes(root, node => node.name === 'body')[0] ?? root;
  const meta = {};
  for (const node of nodes(root, node => node.name === 'meta')) {
    const key = (node.attrs.property ?? node.attrs.name ?? node.attrs.itemprop ?? '').toLowerCase();
    if (!meta[key]) meta[key] = clean(node.attrs.content);
  }
  let structured = {};
  for (const node of nodes(root, node => node.name === 'script' && /ld\+json/i.test(node.attrs.type ?? ''))) {
    try {
      const parsed = JSON.parse(node.children.join(''));
      const values = Array.isArray(parsed) ? parsed : parsed['@graph'] ?? [parsed];
      const found = values.find(value => /^(?:Article|NewsArticle|BlogPosting|TechArticle)$/.test(value?.['@type']));
      if (found) { structured = found; break; }
    } catch { /* Invalid page-provided structured metadata is not evidence. */ }
  }
  const titleNode = nodes(root, node => node.name === 'title')[0];
  const heading = nodes(article, node => node.name === 'h1')[0];
  const author = structured.author;
  const pagePublisher = meta['og:site_name'] ?? clean(structured.publisher?.name) ?? null;
  const hostname = url ? new URL(url).hostname.toLowerCase() : '';
  const publisher = Object.entries(PUBLISHERS).find(([host]) => hostname === host || hostname.endsWith(`.${host}`))?.[1] ?? pagePublisher;
  const metadata = {
    title: meta['og:title'] ?? meta['twitter:title'] ?? clean(structured.headline)
      ?? (titleNode ? clean(titleNode.children.filter(value => typeof value === 'string').join('')) : null)
      ?? (heading ? clean(textOf(heading)) : null),
    publisher, pagePublisher,
    author: meta.author ?? clean(typeof author === 'string' ? author : Array.isArray(author)
      ? author.map(value => typeof value === 'string' ? value : value?.name).filter(Boolean).join(', ') : author?.name),
    publicationDate: meta['article:published_time'] ?? meta.datepublished ?? clean(structured.datePublished),
    updateDate: meta['article:modified_time'] ?? meta.datemodified ?? clean(structured.dateModified),
  };
  const images = [], imageNodes = [], pending = [article];
  while (pending.length) {
    const node = pending.pop();
    if (typeof node === 'string' || hiddenTags.has(node.name) || Object.hasOwn(node.attrs, 'hidden') || node.attrs['aria-hidden'] === 'true') continue;
    if (node.name === 'img') imageNodes.push(node);
    pending.push(...node.children.toReversed());
  }
  for (const node of imageNodes) {
    const attrs = node.attrs;
    const candidate = attrs['data-src'] || attrs['data-original'] || attrs['data-lazy-src']
      || (attrs['data-srcset'] || attrs.srcset || '').split(',')[0].trim().split(/\s+/)[0] || attrs.src;
    if (candidate) images.push(candidate);
  }
  return { text: textOf(article), metadata, images: [...new Set(images)] };
}
