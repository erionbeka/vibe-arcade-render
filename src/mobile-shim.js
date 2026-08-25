// Mobile shim for uploaded games: injected into every served game HTML.
const path = require('path');
const fs = require('fs');
// - adds viewport meta
// - scales canvases to fit small screens (CSS) and remaps pointer coords
//   back to logical canvas units so existing mouse-code works with touch
// - shows an on-screen D-pad + ACTION button on touch devices that emit
//   synthetic Arrow/WASD/Space keyboard events for keyboard-only games
const SHIM = `
(function () {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.documentElement.style.overscrollBehavior = 'none';

    // remap pointer events on canvases from CSS pixels to logical canvas pixels
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opt) {
      if (this instanceof HTMLCanvasElement && /^pointer(down|move|up)$/i.test(type)) {
        const wrapped = function (e) {
          const r = this.getBoundingClientRect();
          if (!r.width || !r.height) return fn.call(this, e);
          const kx = this.width / r.width, ky = this.height / r.height;
          const e2 = new PointerEvent(type, {
            pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary,
            clientX: r.left + (e.clientX - r.left) * kx,
            clientY: r.top + (e.clientY - r.top) * ky,
            button: e.button, buttons: e.buttons
          });
          return fn.call(this, e2);
        };
        return orig.call(this, type, wrapped, opt);
      }
      return orig.call(this, type, fn, opt);
    };

    // fit every canvas to the screen width
    const style = document.createElement('style');
    style.textContent = 'canvas{max-width:96vw !important;height:auto !important}body{overflow-x:hidden}';
    document.head.appendChild(style);

    // touch D-pad for keyboard-controlled games
    const pad = document.createElement('div');
    pad.innerHTML = [
      '<div id="vpad" style="position:fixed;inset:auto 0 0 0;z-index:99999;display:flex;justify-content:space-between;padding:10px 14px calc(12px + env(safe-area-inset-bottom));pointer-events:none;font-family:Consolas,monospace">',
      '  <div style="display:flex;gap:10px;pointer-events:auto">',
      '    <button data-k="ArrowLeft" style="vpb">&larr;</button>',
      '    <button data-k="ArrowRight" style="vpb">&rarr;</button>',
      '  </div>',
      '  <div style="display:flex;gap:10px;pointer-events:auto">',
      '    <button data-k="ArrowUp" style="vpb">&uarr;</button>',
      '    <button data-k=" " class="sp">SPACE</button>',
      '    <button data-k="ArrowDown" style="vpb">&darr;</button>',
      '  </div>',
      '</div>'
    ].join('');
    const css = document.createElement('style');
    css.textContent = '[vpb]{width:58px;height:58px;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:rgba(0,0,0,.45);color:#fff;font-size:1.3rem;font-family:inherit}.sp{width:auto;padding:0 16px;border-radius:29px;font-size:.8rem}';
    pad.appendChild(css);
    const fire = (key, down) => {
      const code = key === ' ' ? 'Space' : key;
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, code, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: key.toLowerCase(), code, bubbles: true }));
    };
    pad.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-k]');
      if (b) { fire(b.dataset.k, true); b.setPointerCapture?.(e.pointerId); e.preventDefault(); }
    });
    pad.addEventListener('pointerup', e => {
      const b = e.target.closest('[data-k]');
      if (b) { fire(b.dataset.k, false); e.preventDefault(); }
    });
    pad.addEventListener('pointercancel', e => {
      const b = e.target.closest('[data-k]');
      if (b) fire(b.dataset.k, false);
    });
    const mount = () => document.body.appendChild(pad);
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  }
})();
`;

function injectMobile(html) {
  let out = html;
  if (!/name=["']viewport/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, '<head$1>\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">');
  }
  const shimTag = '<script>' + SHIM + '</script>';
  if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, shimTag + '\n</head>');
  else out += shimTag;
  return out;
}

function mobileGamesMiddleware(uploadsDir) {
  return (req, res, next) => {
    if (!/\.(html|htm)$/i.test(req.path)) return next();
    const target = path.join(uploadsDir, req.path.replace(/^\/uploads\//i, ''));
    const resolved = path.resolve(target);
    if (!resolved.startsWith(path.resolve(uploadsDir))) return next();
    console.log('[mobile] shim handling', req.path);
    fs.readFile(resolved, 'utf8', (err, html) => {
      if (err) return next();
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=300');
      res.send(injectMobile(html));
    });
  };
}

module.exports = { injectMobile, mobileGamesMiddleware };
