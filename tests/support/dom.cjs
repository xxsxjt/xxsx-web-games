'use strict';

const assert = require('node:assert/strict');

// Just enough DOM and bubbling for the standalone renderers. Layout and native
// input behavior belong in browser acceptance, not in this fixture.
function decodeEntities(value) {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'"})[entity]);
}

class FakeNode {
  constructor(doc, tagName, content = '') {
    this.doc = doc;
    this.tagName = tagName;
    this.content = content;
    this.parentNode = null;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.hidden = false;
    this.disabled = false;
    this.value = '';
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    if (name === 'hidden') this.hidden = true;
    if (name === 'disabled') this.disabled = true;
    if (name === 'value') this.value = String(value);
  }
  getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  get className() { return this.getAttribute('class') || ''; }
  set className(value) { this.setAttribute('class', value); }
  get classList() {
    return {
      contains: token => this.className.split(/\s+/).includes(token),
      add: token => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(token))].join(' '); }
    };
  }
  get tabIndex() {
    return this.hasAttribute('tabindex') ? Number(this.getAttribute('tabindex')) :
      this.matches('button,input,select,textarea,summary') || (this.tagName === 'a' && this.hasAttribute('href')) ? 0 : -1;
  }
  set tabIndex(value) { this.setAttribute('tabindex', value); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  contains(node) { return Boolean(node) && (this === node || this.children.some(child => child.contains(node))); }
  get textContent() { return this.tagName === '#text' ? this.content : this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.clear(); this.appendChild(new FakeNode(this.doc, '#text', String(value))); }
  clear() {
    if (this.doc.activeElement && this.contains(this.doc.activeElement) && this.doc.activeElement !== this) this.doc.activeElement = this.doc.body;
    this.children.forEach(child => { child.parentNode = null; });
    this.children = [];
  }
  set innerHTML(value) { this.clear(); parseInto(this, value); }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      const attr = part.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
      if (attr) return this.hasAttribute(attr[1]) && (attr[2] === undefined || this.getAttribute(attr[1]) === attr[2]);
      if (part.startsWith('#')) return this.getAttribute('id') === part.slice(1);
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      return this.tagName === part.toLowerCase();
    });
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => node.children.forEach(child => { if (child.matches(selector)) found.push(child); visit(child); });
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node; node = node.parentNode) if (node.matches(selector)) return node; return null; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatch(type, details = {}) {
    const event = {type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details};
    for (let node = this; node; node = node.parentNode) for (const listener of node.listeners[type] || []) listener(event);
    return event;
  }
  click() {
    if (this.disabled) return;
    this.focus();
    return this.dispatch('click', {button: 0, detail: 1});
  }
  focus() { if (!this.disabled) this.doc.activeElement = this; }
}

function parseInto(container, markup) {
  const stack = [container];
  const voids = new Set(['meta', 'link', 'input', 'img', 'br', 'hr', 'source']);
  for (const token of String(markup).match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) || []) {
    if (/^<!/.test(token)) continue;
    if (/^<\//.test(token)) { stack.pop(); continue; }
    if (token[0] !== '<') { stack[stack.length - 1].appendChild(new FakeNode(container.doc, '#text', decodeEntities(token))); continue; }
    const match = token.match(/^<([a-z0-9]+)\b([^>]*)>/i);
    assert(match, 'test DOM received malformed markup');
    const element = container.doc.createElement(match[1].toLowerCase());
    const attributes = match[2].replace(/\/$/, '');
    for (const attribute of attributes.matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g)) element.setAttribute(attribute[1], decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? ''));
    stack[stack.length - 1].appendChild(element);
    if (!voids.has(element.tagName) && !/\/>$/.test(token)) stack.push(element);
  }
}

class FakeDocument extends FakeNode {
  constructor(html) {
    super(null, '#document');
    this.doc = this;
    parseInto(this, html);
    this.body = this.querySelector('body');
    this.activeElement = this.body;
  }
  createElement(tag) { return new FakeNode(this, tag); }
  getElementById(id) { return this.querySelector('[id="' + id + '"]'); }
}

module.exports = {FakeDocument};
