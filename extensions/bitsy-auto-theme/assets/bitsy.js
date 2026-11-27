/* Bitsy Auto storefront – vehicle search, My Garage, results and collection filtering.
 * All fitment comes live from /apps/bitsy (Shopify App Proxy → Supabase). Nothing about
 * fitment is cached: only the shopper's own garage vehicles are kept, in localStorage.
 * Product cards load from the Storefront API with the app's public token. */
(function () {
  'use strict';
  if (window.BitsyAuto) return;

  var GARAGE_KEY = 'bitsy:garage';
  var SF_VERSION = '2026-10';
  var LEVELS = ['make', 'model', 'year', 'engine'];

  /* ---------- config ---------- */
  var config = (function () {
    // Every Bitsy block prints a config script; the nav bar embed's adds the garage texts. Merge them.
    var c = {};
    Array.prototype.forEach.call(document.querySelectorAll('script[data-bitsy-config]'), function (el) {
      try {
        var part = JSON.parse(el.textContent);
        Object.keys(part).forEach(function (k) { if (part[k] !== null && part[k] !== undefined && part[k] !== '') c[k] = part[k]; });
      } catch (e) { /* ignore a broken block */ }
    });
    var s = c.settings || {};
    c.proxy = c.proxy || '/apps/bitsy';
    c.settings = {
      vin: s.vin || {},
      results: Object.assign({pageHandle: 'parts-for-your-vehicle', perPage: 24, outOfStockLast: true,
        filters: {price: true, inStock: true, productType: true, brand: true}}, s.results || {}),
      garage: Object.assign({enabled: true, maxVehicles: 5, saveVin: false}, s.garage || {})
    };
    c.root = (c.root || '/').replace(/\/$/, '');
    c.resultsUrl = c.root + '/pages/' + c.settings.results.pageHandle;
    c.cartAdd = c.cartAdd || '/cart/add.js';
    c.cartUrl = c.cartUrl || '/cart';
    return c;
  })();

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function qs(o) { return Object.keys(o).filter(function (k) { return o[k] !== '' && o[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
  function numId(gid) { return String(gid || '').split('/').pop(); }
  function fire(name, detail) { document.dispatchEvent(new CustomEvent(name, {detail: detail})); }

  var ICON_GARAGE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M7 21v-6h10v6"/><path d="M7 18h10"/></svg>';
  var ICON_CLOSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_TRASH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
  var ICON_CHECK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

  /* ---------- Bitsy API (App Proxy) ---------- */
  function ApiError(message, status, code) { this.message = message; this.status = status; this.code = code; }
  function api(path, params) {
    var url = config.proxy + path + (params ? '?' + qs(params) : '');
    return fetch(url, {headers: {Accept: 'application/json'}, credentials: 'same-origin', cache: 'no-store'})
      .catch(function () { throw new ApiError('Vehicle search is unavailable right now. Please try again.', 0); })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (json) {
          if (!res.ok) throw new ApiError((json && json.message) || (json && json.error) || 'Something went wrong.', res.status, json && json.error);
          return json;
        });
      });
  }

  /* ---------- Garage (shopper's own vehicles, this browser only) ---------- */
  var garage = {
    read: function () {
      try {
        var g = JSON.parse(localStorage.getItem(GARAGE_KEY) || 'null');
        if (g && Array.isArray(g.vehicles)) return g;
      } catch (e) { /* storage blocked */ }
      return {v: 1, vehicles: [], active: null};
    },
    write: function (g) {
      try { localStorage.setItem(GARAGE_KEY, JSON.stringify(g)); } catch (e) { /* ignore */ }
      fire('bitsy:garage', g);
    },
    list: function () { return this.read().vehicles; },
    active: function () {
      var g = this.read();
      return g.vehicles.filter(function (v) { return v.id === g.active; })[0] || null;
    },
    max: function () { return Math.max(1, Math.min(5, Number(config.settings.garage.maxVehicles) || 5)); },
    enabled: function () { return config.settings.garage.enabled !== false; },
    add: function (vehicle) {
      var g = this.read();
      if (!config.settings.garage.saveVin) delete vehicle.vin;
      vehicle.id = vehicle.id || String(vehicle.ktype) + (vehicle.vin ? '-' + vehicle.vin : '');
      g.vehicles = g.vehicles.filter(function (v) { return v.id !== vehicle.id && String(v.ktype) !== String(vehicle.ktype); });
      g.vehicles.unshift(vehicle);
      if (!this.enabled()) g.vehicles = [vehicle];
      g.vehicles = g.vehicles.slice(0, this.enabled() ? this.max() : 1);
      g.active = vehicle.id;
      this.write(g);
      fire('bitsy:vehicle', vehicle);
      return vehicle;
    },
    select: function (id) {
      var g = this.read(); g.active = id; this.write(g); fire('bitsy:vehicle', this.active());
    },
    remove: function (id) {
      var g = this.read();
      g.vehicles = g.vehicles.filter(function (v) { return v.id !== id; });
      if (g.active === id) g.active = g.vehicles[0] ? g.vehicles[0].id : null;
      this.write(g); fire('bitsy:vehicle', this.active());
    },
    clearActive: function () { var g = this.read(); g.active = null; this.write(g); fire('bitsy:vehicle', null); }
  };
  function vehicleTitle(v) { return [v.make && v.make.name, v.model && v.model.name].filter(Boolean).join(' ') + (v.year ? ' · ' + v.year : ''); }
  function vehicleFull(v) { return vehicleTitle(v) + (v.label ? ' · ' + v.label : ''); }

  /* Wording from the Bitsy Auto design embed (labels, placeholders, VIN and garage texts). */
  function applyTexts(root) {
    var t = config.texts;
    if (!t) return;
    LEVELS.forEach(function (l) {
      $$('select[data-level="' + l + '"]', root).forEach(function (sel) {
        var label = sel.closest('label');
        var span = label && $('.bitsy__label', label);
        if (span && t.labels && t.labels[l]) span.textContent = t.labels[l];
        var ph = t.placeholders && t.placeholders[l];
        if (ph) {
          sel.setAttribute('data-ph', ph);
          if (sel.options[0] && sel.options[0].value === '') sel.options[0].textContent = ph;
        }
      });
    });
    $$('[data-vin-toggle]', root).forEach(function (b) {
      if (t.vinLink) b.setAttribute('data-vin-text', t.vinLink);
      if (t.vinBack) b.setAttribute('data-ymm-text', t.vinBack);
      var form = b.closest('form');
      b.textContent = b.getAttribute(form && form.getAttribute('data-mode') === 'vin' ? 'data-ymm-text' : 'data-vin-text');
    });
    if (t.vinPlaceholder) $$('[data-vin]', root).forEach(function (i) { i.placeholder = t.vinPlaceholder; });
    $$('form[data-bitsy-ymm]', root).forEach(function (f) {
      if (t.vinPaused) f.setAttribute('data-vin-paused', t.vinPaused);
      if (t.incomplete) f.setAttribute('data-incomplete', t.incomplete);
      if (t.autoAdvance === false) f.setAttribute('data-auto-advance', 'false');
    });
    if (t.garageLabel) {
      $$('[data-garage-label]', root).forEach(function (el) { el.textContent = t.garageLabel; });
      $$('[data-garage-open][aria-label]', root).forEach(function (el) { el.setAttribute('aria-label', t.garageLabel); });
    }
  }

  /* ---------- Vehicle form: Make → Model → Year → Engine, or VIN ---------- */
  function VehicleForm(form) {
    applyTexts(form);
    this.form = form;
    this.selects = {};
    var self = this;
    LEVELS.forEach(function (l) { self.selects[l] = $('select[data-level="' + l + '"]', form); });
    this.msg = $('[data-msg]', form);
    this.vinInput = $('[data-vin]', form);
    this.loaded = {};
    this.autoAdvance = form.getAttribute('data-auto-advance') !== 'false';
    form.__bitsy = this;
    this.bind();
    if (form.getAttribute('data-prefill') !== 'false') this.prefill(garage.active());
  }
  VehicleForm.prototype.placeholder = function (level) {
    var s = this.selects[level];
    return (s && s.getAttribute('data-ph')) || 'Select ' + level;
  };
  VehicleForm.prototype.setOptions = function (level, items, selected) {
    var s = this.selects[level];
    if (!s) return;
    s.innerHTML = '';
    s.appendChild(h('option', {value: '', text: this.placeholder(level)}));
    items.forEach(function (it) { s.appendChild(h('option', {value: it.value, text: it.text, selected: String(it.value) === String(selected)})); });
    s.disabled = false;
  };
  VehicleForm.prototype.reset = function (fromLevel) {
    var i = LEVELS.indexOf(fromLevel), self = this;
    LEVELS.slice(i).forEach(function (l) {
      var s = self.selects[l];
      if (!s) return;
      s.innerHTML = '';
      s.appendChild(h('option', {value: '', text: self.placeholder(l)}));
      s.disabled = true;
      self.loaded[l] = false;
    });
  };
  VehicleForm.prototype.say = function (text, kind) {
    if (!this.msg) return;
    this.msg.textContent = text || '';
    this.msg.hidden = !text;
    this.msg.className = 'bitsy-msg' + (kind ? ' bitsy-msg--' + kind : '');
  };
  VehicleForm.prototype.loading = function (level) {
    var s = this.selects[level];
    if (!s) return;
    s.innerHTML = '';
    s.appendChild(h('option', {value: '', text: (this.form.getAttribute('data-loading') || 'Loading…')}));
    s.disabled = true;
  };
  VehicleForm.prototype.values = function () {
    var v = {}, self = this;
    LEVELS.forEach(function (l) { v[l] = self.selects[l] ? self.selects[l].value : ''; });
    return v;
  };
  VehicleForm.prototype.load = function (level) {
    var self = this, v = this.values(), req;
    if (level === 'make') req = api('/ymm/makes');
    else if (level === 'model') req = api('/ymm/models', {make: v.make});
    else if (level === 'year') req = api('/ymm/years', {make: v.make, model: v.model});
    else req = api('/ymm/engines', {make: v.make, model: v.model, year: v.year});
    var keep = this.selects[level] ? this.selects[level].value : '';
    this.loading(level);
    this.say('');
    return req.then(function (list) {
      var items = (list || []).map(function (it) {
        if (level === 'year') return {value: it, text: String(it)};
        if (level === 'engine') return {value: it.ktype, text: it.label};
        return {value: it.id, text: it.name};
      });
      self.setOptions(level, items, keep);
      self.loaded[level] = true;
      return items;
    }).catch(function (e) {
      self.setOptions(level, [], '');
      self.say(e.message, 'error');
    });
  };
  VehicleForm.prototype.ensureMakes = function () {
    if (!this.loaded.make && !this.loadingMakes) {
      var self = this;
      this.loadingMakes = this.load('make').then(function () { self.loadingMakes = null; });
    }
  };
  VehicleForm.prototype.prefill = function (v) {
    if (!v) return;
    var self = this;
    // Shows the saved vehicle without any lookup; the full lists load if the shopper changes it.
    [['make', v.make && v.make.id, v.make && v.make.name], ['model', v.model && v.model.id, v.model && v.model.name],
      ['year', v.year, String(v.year)], ['engine', v.ktype, v.label]].forEach(function (p) {
      if (self.selects[p[0]] && p[1] != null) self.setOptions(p[0], [{value: p[1], text: p[2]}], p[1]);
    });
  };
  VehicleForm.prototype.bind = function () {
    var self = this, form = this.form;
    if (this.selects.make) {
      // Load makes only when the shopper reaches for the dropdown, so idle page views cost no API calls.
      ['pointerenter', 'focus', 'pointerdown', 'touchstart'].forEach(function (ev) {
        self.selects.make.addEventListener(ev, function () { self.ensureMakes(); }, {passive: true});
      });
    }
    LEVELS.forEach(function (level, i) {
      var s = self.selects[level];
      if (!s) return;
      s.addEventListener('change', function () {
        self.say('');
        var next = LEVELS[i + 1];
        if (!next) return;
        self.reset(next);
        if (s.value) self.load(next).then(function () { if (self.autoAdvance && self.selects[next]) self.selects[next].focus(); });
      });
      // A prefilled select only holds the saved value: load the full list when it's opened.
      if (level !== 'make') s.addEventListener('pointerdown', function () {
        if (!self.loaded[level] && !s.disabled && self.prereqs(level)) self.load(level);
      });
    });
    var toggle = $('[data-vin-toggle]', form);
    if (toggle) toggle.addEventListener('click', function () { self.setMode(form.getAttribute('data-mode') === 'vin' ? 'ymm' : 'vin'); });
    form.addEventListener('submit', function (e) { e.preventDefault(); self.submit(); });
    $$('[data-garage-open]', form).forEach(function (b) { b.addEventListener('click', function () { modal.open(b); }); });
  };
  VehicleForm.prototype.prereqs = function (level) {
    var v = this.values(), i = LEVELS.indexOf(level);
    return LEVELS.slice(0, i).every(function (l) { return v[l]; });
  };
  VehicleForm.prototype.setMode = function (mode) {
    var form = this.form, toggle = $('[data-vin-toggle]', form);
    form.setAttribute('data-mode', mode);
    $('[data-ymm-fields]', form).hidden = mode === 'vin';
    $('[data-vin-fields]', form).hidden = mode !== 'vin';
    if (toggle) toggle.textContent = toggle.getAttribute(mode === 'vin' ? 'data-ymm-text' : 'data-vin-text');
    this.say('');
    if (mode === 'vin' && this.vinInput) this.vinInput.focus();
  };
  VehicleForm.prototype.submit = function () {
    var self = this, form = this.form, btn = $('[data-submit]', form);
    if (form.getAttribute('data-mode') === 'vin') {
      var vin = (this.vinInput.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) { this.say(form.getAttribute('data-vin-invalid') || 'Enter the 17-character VIN.', 'error'); return; }
      if (btn) btn.disabled = true;
      api('/vin', {vin: vin}).then(function (r) {
        self.done({make: {id: r.make_id || r.make, name: r.make}, model: {id: r.model_id || r.model, name: r.model},
          year: r.year, ktype: r.ktype, label: r.label, vin: vin});
      }).catch(function (e) {
        self.say(e.status === 429 ? (form.getAttribute('data-vin-paused') || e.message) : e.message, 'error');
      }).then(function () { if (btn) btn.disabled = false; });
      return;
    }
    var v = this.values();
    if (!v.engine) { this.say(form.getAttribute('data-incomplete') || 'Choose Make, Model, Year and Engine.', 'error'); return; }
    var opt = function (l) { var s = self.selects[l]; return s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : ''; };
    this.done({make: {id: v.make, name: opt('make')}, model: {id: v.model, name: opt('model')}, year: Number(v.year) || v.year,
      ktype: Number(v.engine), label: opt('engine')});
  };
  VehicleForm.prototype.done = function (vehicle) {
    garage.add(vehicle);
    var after = this.form.getAttribute('data-after');
    if (after === 'stay') { this.say((this.form.getAttribute('data-saved') || 'Saved to My Garage.'), 'ok'); fire('bitsy:form-done', vehicle); return; }
    // On a collection page with the collection bar, filter that collection instead of leaving it.
    if (after !== 'results' && document.querySelector('[data-bitsy-results][data-mode="collection"]')) return;
    window.location.href = config.resultsUrl + '?' + qs({ktype: vehicle.ktype});
  };

  /* ---------- My Garage popup ---------- */
  var modal = {
    el: null, host: null, mode: 'list', addMode: 'ymm',
    text: function (k, d) { var t = config.garageText || {}; return t[k] || d; },
    open: function (trigger) {
      this.trigger = trigger;
      this.host = document.querySelector('[data-bitsy-modal-host]') || (trigger && trigger.closest('.bitsy')) || document.body;
      this.mode = garage.list().length ? 'list' : 'add';
      this.render();
      document.addEventListener('keydown', this.onKey);
    },
    close: function () {
      if (this.el) this.el.remove();
      this.el = null;
      document.removeEventListener('keydown', modal.onKey);
      if (this.trigger) this.trigger.focus();
    },
    onKey: function (e) { if (e.key === 'Escape') modal.close(); },
    render: function () {
      var self = this, list = garage.list(), active = garage.active(), max = garage.max();
      if (this.el) this.el.remove();
      var items = list.map(function (v) {
        var isActive = active && active.id === v.id;
        var meta = [];
        if (config.garageShowKtype !== false) meta.push('KType ' + v.ktype);
        if (v.vin && config.garageShowVin !== false) meta.push('VIN saved');
        return h('li', {class: 'bitsy-car' + (isActive ? ' bitsy-car--active' : '')}, [
          h('button', {type: 'button', class: 'bitsy-car__pick', 'aria-label': 'Select ' + vehicleFull(v), onclick: function () { garage.select(v.id); self.render(); }}, [
            h('span', {class: 'bitsy-car__title', text: vehicleTitle(v)}),
            h('span', {class: 'bitsy-car__meta', text: v.label || ''}),
            meta.length ? h('span', {class: 'bitsy-car__meta', text: meta.join(' · ')}) : null
          ]),
          isActive ? h('span', {class: 'bitsy-car__tag', text: self.text('selected', 'Selected')}) : null,
          h('button', {type: 'button', class: 'bitsy-car__remove', 'aria-label': 'Remove ' + vehicleFull(v), html: ICON_TRASH, onclick: function () { garage.remove(v.id); self.render(); }})
        ]);
      });
      var body = h('div', {class: 'bitsy-modal__body'});
      if (this.mode === 'add' && garage.enabled()) {
        var formHost = h('div');
        body.appendChild(formHost);
        formHost.innerHTML = buildFormHtml({after: 'stay', vin: config.vinEnabled !== false, garage: false, layout: 'grid'});
        var f = new VehicleForm($('form', formHost));
        document.addEventListener('bitsy:form-done', function onDone() { document.removeEventListener('bitsy:form-done', onDone); self.mode = 'list'; self.render(); });
        body.appendChild(h('button', {type: 'button', class: 'bitsy-btn bitsy-btn--secondary', text: this.text('cancel', 'Cancel'), onclick: function () { self.mode = 'list'; self.render(); }}));
        setTimeout(function () { f.ensureMakes(); }, 0);
      } else if (garage.enabled()) {
        var full = list.length >= max;
        body.appendChild(h('button', {type: 'button', class: 'bitsy-btn bitsy-btn--secondary', disabled: full,
          text: full ? this.text('full', 'Garage full: remove a vehicle to add one') : this.text('add', '+ Add a vehicle'),
          onclick: function () { self.mode = 'add'; self.render(); }}));
      }
      if (active) body.appendChild(h('a', {class: 'bitsy-btn', href: config.resultsUrl + '?' + qs({ktype: active.ktype}), text: this.text('shop', 'Shop parts for selected vehicle')}));
      var titleId = 'bitsy-garage-title';
      this.el = h('div', {class: 'bitsy-modal', onclick: function (e) { if (e.target === self.el) self.close(); }}, [
        h('div', {class: 'bitsy-modal__dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId}, [
          h('div', {class: 'bitsy-modal__head'}, [
            h('div', {style: 'display:flex;align-items:center;gap:10px'}, [
              h('h2', {id: titleId, class: 'bitsy-modal__title', text: this.text('title', 'My Garage')}),
              h('span', {class: 'bitsy-car__meta', text: list.length + ' / ' + max})
            ]),
            h('button', {type: 'button', class: 'bitsy-modal__close', 'aria-label': 'Close', html: ICON_CLOSE, onclick: function () { self.close(); }})
          ]),
          list.length ? h('ul', {class: 'bitsy-modal__list'}, items) : h('p', {class: 'bitsy-modal__empty', text: this.text('empty', 'No vehicles saved yet. Add one to see only the parts that fit.')}),
          body
        ])
      ]);
      this.host.appendChild(this.el);
      var focusable = $('select, input, button', this.el.querySelector('.bitsy-modal__body')) || $('.bitsy-modal__close', this.el);
      if (focusable) focusable.focus();
    }
  };

  /* Markup for a vehicle form created in script (inside the garage popup). */
  function buildFormHtml(o) {
    var tx = config.texts || {};
    var ph = tx.placeholders || {}, lb = tx.labels || {};
    var field = function (l, label) {
      label = lb[l] || label;
      return '<label class="bitsy-field bitsy-field--' + l + '"><span class="bitsy__label">' + esc(label) + '</span>' +
        '<select class="bitsy-select" data-level="' + l + '" data-ph="' + esc(ph[l] || 'Select ' + l) + '"' + (l === 'make' ? '' : ' disabled') + '>' +
        '<option value="">' + esc(ph[l] || 'Select ' + l) + '</option></select></label>';
    };
    return '<form class="bitsy-ymm bitsy-ymm--' + o.layout + '" data-bitsy-ymm data-mode="ymm" data-after="' + o.after + '" data-prefill="false" novalidate>' +
      (o.vin ? '<div class="bitsy-tabs" role="tablist"><button type="button" class="bitsy-tab" role="tab" aria-selected="true" data-tab="ymm">Make and Model</button><button type="button" class="bitsy-tab" role="tab" aria-selected="false" data-tab="vin">VIN</button></div>' : '') +
      '<div class="bitsy-ymm__fields" data-ymm-fields>' + field('make', 'Make') + field('model', 'Model') + field('year', 'Year') + field('engine', 'Engine') + '</div>' +
      '<div class="bitsy-ymm__fields" data-vin-fields hidden><label class="bitsy-field"><span class="bitsy__label">VIN</span><input class="bitsy-input bitsy-input--vin" data-vin maxlength="17" autocomplete="off" placeholder="' + esc(tx.vinPlaceholder || '17 characters') + '"></label></div>' +
      '<div class="bitsy-ymm__actions"><button type="submit" class="bitsy-btn bitsy-btn--full" data-submit>' + esc(modal.text('save', 'Save to garage')) + '</button></div>' +
      '<p class="bitsy-msg" data-msg role="status" hidden></p></form>';
  }
  document.addEventListener('click', function (e) {
    var tab = e.target.closest && e.target.closest('.bitsy-tab[data-tab]');
    if (!tab) return;
    var form = tab.closest('form'); var vf = form && form.__bitsy;
    $$('.bitsy-tab', form).forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
    if (vf) vf.setMode(tab.getAttribute('data-tab'));
  });

  /* ---------- Storefront API (product cards) ---------- */
  function storefront(query, variables) {
    if (!config.storefrontToken) return Promise.reject(new Error('Storefront access is not set up. Open the Bitsy Auto app once in the Shopify admin.'));
    return fetch('/api/' + SF_VERSION + '/graphql.json', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': config.storefrontToken},
      body: JSON.stringify({query: query, variables: variables})
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.errors && j.errors.length) throw new Error(j.errors[0].message);
      return j.data;
    });
  }
  var VARIANT_QUERY = 'query BitsyVariants($ids:[ID!]!){nodes(ids:$ids){...on ProductVariant{id sku availableForSale quantityAvailable ' +
    'price{amount currencyCode} compareAtPrice{amount currencyCode} image{url altText} ' +
    'product{id title handle vendor productType onlineStoreUrl featuredImage{url altText} images(first:2){nodes{url altText}}}}}}';
  function loadVariants(ids) {
    var batches = [];
    for (var i = 0; i < ids.length; i += 250) batches.push(ids.slice(i, i + 250));
    return Promise.all(batches.map(function (b) { return storefront(VARIANT_QUERY, {ids: b}); })).then(function (res) {
      var out = [];
      res.forEach(function (d) { (d.nodes || []).forEach(function (n) { if (n && n.id) out.push(n); }); });
      return out;
    });
  }
  function money(amount) {
    var n = Number(amount || 0), fmt = config.moneyFormat || '{{amount}}';
    var withDelims = function (num, dec, thou, decSep) {
      var parts = num.toFixed(dec).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thou);
      return parts.join(decSep);
    };
    var val = fmt.replace(/\{\{\s*(\w+)\s*\}\}/, function (_, k) {
      if (k === 'amount_no_decimals') return withDelims(n, 0, ',', '.');
      if (k === 'amount_with_comma_separator') return withDelims(n, 2, '.', ',');
      if (k === 'amount_no_decimals_with_comma_separator') return withDelims(n, 0, '.', ',');
      if (k === 'amount_with_space_separator') return withDelims(n, 2, ' ', ',');
      if (k === 'amount_with_apostrophe_separator') return withDelims(n, 2, "'", '.');
      return withDelims(n, 2, ',', '.');
    });
    var tmp = document.createElement('div'); tmp.innerHTML = val; return tmp.textContent;
  }

  /* ---------- Results grid (results page and filtered collections) ---------- */
  function Results(root) {
    this.root = root;
    var d = root.dataset, cards = config.cards || {}, ct = cards.t || {};
    this.mode = d.mode || 'page';
    this.opts = {
      cols: Number(d.cols) || 4, colsM: Number(d.colsM) || 2, perPage: Number(d.perPage) || Number(config.settings.results.perPage) || 24,
      allowCols: d.allowCols !== 'false', allowPerPage: d.allowPerPage !== 'false', pagination: d.pagination || 'numbers',
      showSort: d.showSort !== 'false', sort: d.defaultSort || 'stock', drawer: d.filtersLayout === 'drawer', counts: d.filterCounts !== 'false',
      brand: cards.brand !== false, sku: cards.sku !== false, stock: cards.stock !== false, fit: cards.fit !== false,
      atc: cards.atc !== false, hover: cards.hover !== false, afterAdd: cards.afterAdd || 'stay',
      t: {fit: ct.fit || 'Fits your vehicle', atc: ct.atc || 'Add to cart', added: ct.added || 'Added to cart', sold: ct.sold || 'Out of stock',
        inStock: ct.inStock || 'In stock', sku: ct.sku || 'SKU', count: d.tCount || '{count} parts fit', clear: d.tClear || 'Clear all', filters: d.tFilters || 'Filters',
        more: d.tMore || 'Load more', choose: d.tChoose || 'Choose your vehicle above to see the parts that fit.'}
    };
    var f = config.settings.results.filters || {};
    this.filterOn = {price: f.price !== false && d.fPrice !== 'false', inStock: f.inStock !== false && d.fStock !== 'false',
      productType: f.productType !== false && d.fType !== 'false', brand: f.brand !== false && d.fBrand !== 'false'};
    this.state = {cols: this.opts.cols, perPage: this.opts.perPage, page: 1, sort: this.opts.sort, inStock: false, types: {}, brands: {}, min: '', max: ''};
    this.items = [];
    this.out = $('[data-results-out]', root) || root;
    this.countEl = $('[data-results-count]', root);
  }
  // Matched products are kept for this page view only, so re-selecting a vehicle costs no new request.
  var partsMemo = {};
  function partsFor(params) {
    var key = params.ktype + '|' + (params.collection || '');
    if (!partsMemo[key]) partsMemo[key] = api('/parts', params).catch(function (e) { delete partsMemo[key]; throw e; });
    return partsMemo[key];
  }
  Results.prototype.load = function (ktype) {
    var self = this, params = {ktype: ktype};
    if (this.mode === 'collection') params.collection = this.root.getAttribute('data-collection-id');
    this.ktype = ktype;
    this.out.innerHTML = '<div class="bitsy-loading" role="status">' + esc(this.root.getAttribute('data-t-loading') || 'Finding parts that fit…') + '</div>';
    return partsFor(params).then(function (res) {
      var ids = [], seen = {};
      (res.items || []).forEach(function (it) { if (it.variant_id && !seen[it.variant_id]) { seen[it.variant_id] = 1; ids.push(it.variant_id); } });
      self.total = res.count;
      return ids.length ? loadVariants(ids) : [];
    }).then(function (variants) {
      // One card per product, with the first matched variant pre-selected. Keep Bitsy's fit order.
      var byProduct = {}, list = [];
      variants.forEach(function (v, i) {
        var p = v.product;
        if (!p || byProduct[p.id]) return;
        byProduct[p.id] = 1;
        list.push({order: i, variant: v, product: p, price: Number(v.price && v.price.amount) || 0,
          available: !!v.availableForSale, vendor: p.vendor || '', type: p.productType || '', title: p.title || ''});
      });
      self.items = list;
      self.state.page = 1;
      self.render();
    }).catch(function (e) {
      self.out.innerHTML = '';
      self.out.appendChild(h('div', {class: 'bitsy-empty bitsy-msg--error', role: 'alert', text: e.message}));
    });
  };
  Results.prototype.filtered = function () {
    var s = this.state, f = this.filterOn;
    var types = Object.keys(s.types).filter(function (k) { return s.types[k]; });
    var brands = Object.keys(s.brands).filter(function (k) { return s.brands[k]; });
    var min = s.min === '' ? -Infinity : Number(s.min), max = s.max === '' ? Infinity : Number(s.max);
    var list = this.items.filter(function (it) {
      if (f.inStock && s.inStock && !it.available) return false;
      if (f.productType && types.length && types.indexOf(it.type) < 0) return false;
      if (f.brand && brands.length && brands.indexOf(it.vendor) < 0) return false;
      if (f.price && (it.price < min || it.price > max)) return false;
      return true;
    });
    var cmp = {
      best: function (a, b) { return a.order - b.order; },
      stock: function (a, b) { return (b.available - a.available) || (a.order - b.order); },
      'price-asc': function (a, b) { return a.price - b.price; },
      'price-desc': function (a, b) { return b.price - a.price; },
      'title-asc': function (a, b) { return a.title.localeCompare(b.title); },
      'brand-asc': function (a, b) { return a.vendor.localeCompare(b.vendor) || a.title.localeCompare(b.title); }
    }[s.sort] || function (a, b) { return a.order - b.order; };
    list.sort(cmp);
    if (config.settings.results.outOfStockLast !== false) {
      list = list.filter(function (i) { return i.available; }).concat(list.filter(function (i) { return !i.available; }));
    }
    return list;
  };
  Results.prototype.facet = function (key) {
    var counts = {};
    this.items.forEach(function (it) { if (it[key]) counts[it[key]] = (counts[it[key]] || 0) + 1; });
    return Object.keys(counts).sort().map(function (k) { return {value: k, count: counts[k]}; });
  };
  Results.prototype.render = function () {
    var self = this, s = this.state, o = this.opts, t = o.t;
    var list = this.filtered();
    var pages = Math.max(1, Math.ceil(list.length / s.perPage));
    if (s.page > pages) s.page = pages;
    var shown = o.pagination === 'numbers' ? list.slice((s.page - 1) * s.perPage, s.page * s.perPage) : list.slice(0, s.page * s.perPage);
    if (this.countEl) this.countEl.textContent = t.count.replace('{count}', String(this.items.length)).replace('{total}', String(this.total || this.items.length));
    this.out.innerHTML = '';
    if (!this.items.length) {
      var tpl = $('template[data-empty]', this.root);
      var empty = h('div', {class: 'bitsy-empty'});
      if (tpl) empty.appendChild(tpl.content.cloneNode(true)); else empty.textContent = 'No parts found for this vehicle.';
      this.out.appendChild(empty);
      return;
    }
    var layout = h('div', {class: 'bitsy-results__layout'});
    var anyFilter = this.filterOn.price || this.filterOn.inStock || this.filterOn.productType || this.filterOn.brand;
    if (anyFilter) layout.appendChild(this.renderFilters());
    var main = h('div', {class: 'bitsy-results__main'});
    main.appendChild(this.renderToolbar(anyFilter));
    var grid = h('div', {class: 'bitsy-grid', style: '--b-cols:' + s.cols + ';--b-cols-m:' + o.colsM});
    shown.forEach(function (it) { grid.appendChild(self.card(it)); });
    if (!shown.length) grid.appendChild(h('div', {class: 'bitsy-empty', style: 'grid-column:1/-1', text: 'No parts match these filters.'}));
    main.appendChild(grid);
    if (pages > 1) main.appendChild(this.renderPager(pages, list.length, shown.length));
    layout.appendChild(main);
    this.out.appendChild(layout);
  };
  Results.prototype.renderToolbar = function (anyFilter) {
    var self = this, s = this.state, o = this.opts;
    var bar = h('div', {class: 'bitsy-toolbar'});
    var left = h('div', {style: 'display:flex;gap:12px;flex-wrap:wrap;align-items:center'});
    if (anyFilter && o.drawer) left.appendChild(h('button', {type: 'button', class: 'bitsy-btn bitsy-btn--secondary bitsy-drawer-btn', text: o.t.filters,
      onclick: function () { self.root.classList.toggle('bitsy-results--drawer-open'); }}));
    if (o.showSort) {
      var sel = h('select', {class: 'bitsy-select', onchange: function (e) { s.sort = e.target.value; s.page = 1; self.render(); }});
      [['stock', 'In stock first'], ['best', 'Best match'], ['price-asc', 'Price, low to high'], ['price-desc', 'Price, high to low'], ['title-asc', 'Name, A–Z'], ['brand-asc', 'Brand, A–Z']]
        .forEach(function (p) { sel.appendChild(h('option', {value: p[0], text: p[1], selected: s.sort === p[0]})); });
      left.appendChild(h('label', {}, [h('span', {text: 'Sort by'}), sel]));
    }
    bar.appendChild(left);
    var right = h('div', {style: 'display:flex;gap:16px;flex-wrap:wrap;align-items:center'});
    if (o.allowPerPage) {
      var pp = h('select', {class: 'bitsy-select', onchange: function (e) { s.perPage = Number(e.target.value); s.page = 1; self.render(); }});
      [12, 24, 36, 48].forEach(function (n) { pp.appendChild(h('option', {value: n, text: n + ' per page', selected: s.perPage === n})); });
      right.appendChild(h('label', {}, [h('span', {text: 'Show'}), pp]));
    }
    if (o.allowCols) {
      var cols = h('div', {class: 'bitsy-cols', role: 'group', 'aria-label': 'Columns'});
      [2, 3, 4, 5].forEach(function (n) {
        cols.appendChild(h('button', {type: 'button', 'aria-pressed': String(s.cols === n), 'aria-label': n + ' columns', text: String(n),
          onclick: function () { s.cols = n; self.render(); }}));
      });
      right.appendChild(cols);
    }
    bar.appendChild(right);
    return bar;
  };
  Results.prototype.renderFilters = function () {
    var self = this, s = this.state, o = this.opts, f = this.filterOn;
    var box = h('aside', {class: 'bitsy-filters', 'aria-label': o.t.filters});
    box.appendChild(h('div', {class: 'bitsy-filters__head'}, [h('span', {text: o.t.filters}),
      h('button', {type: 'button', class: 'bitsy-link', text: o.t.clear, onclick: function () {
        s.inStock = false; s.types = {}; s.brands = {}; s.min = ''; s.max = ''; s.page = 1; self.render(); }})]));
    var change = function () { s.page = 1; self.render(); };
    if (f.inStock) {
      var avail = this.items.filter(function (i) { return i.available; }).length;
      box.appendChild(h('fieldset', {class: 'bitsy-filter'}, [h('legend', {text: 'Availability'}),
        h('label', {}, [h('input', {type: 'checkbox', checked: s.inStock, onchange: function (e) { s.inStock = e.target.checked; change(); }}),
          h('span', {text: 'In stock only'}), o.counts ? h('span', {class: 'bitsy-filter__count', text: String(avail)}) : null])]));
    }
    if (f.price) {
      var prices = this.items.map(function (i) { return i.price; });
      var lo = Math.floor(Math.min.apply(null, prices)), hi = Math.ceil(Math.max.apply(null, prices));
      var inp = function (key, label, ph) {
        return h('label', {}, [h('span', {class: 'bitsy__label', text: label}),
          h('input', {class: 'bitsy-input', type: 'number', min: 0, inputmode: 'numeric', value: s[key], placeholder: ph,
            onchange: function (e) { s[key] = e.target.value; change(); }})]);
      };
      box.appendChild(h('fieldset', {class: 'bitsy-filter'}, [h('legend', {text: 'Price'}),
        h('div', {class: 'bitsy-filter__price'}, [inp('min', 'From', String(lo)), inp('max', 'To', String(hi))])]));
    }
    var multi = function (title, key, stateKey) {
      var opts = self.facet(key);
      if (!opts.length) return;
      var fs = h('fieldset', {class: 'bitsy-filter'}, [h('legend', {text: title})]);
      opts.forEach(function (op) {
        fs.appendChild(h('label', {}, [h('input', {type: 'checkbox', checked: !!s[stateKey][op.value],
          onchange: function (e) { s[stateKey][op.value] = e.target.checked; change(); }}),
          h('span', {text: op.value}), o.counts ? h('span', {class: 'bitsy-filter__count', text: String(op.count)}) : null]));
      });
      box.appendChild(fs);
    };
    if (f.productType) multi('Product type', 'type', 'types');
    if (f.brand) multi('Brand', 'vendor', 'brands');
    if (o.drawer) box.appendChild(h('button', {type: 'button', class: 'bitsy-btn', text: 'Show results', onclick: function () { self.root.classList.remove('bitsy-results--drawer-open'); }}));
    return box;
  };
  Results.prototype.renderPager = function (pages, total, shown) {
    var self = this, s = this.state, o = this.opts;
    var nav = h('nav', {class: 'bitsy-pages', 'aria-label': 'Pagination'});
    if (o.pagination === 'numbers') {
      for (var p = 1; p <= pages; p++) (function (p) {
        nav.appendChild(h('button', {type: 'button', 'aria-current': p === s.page ? 'page' : null, text: String(p),
          onclick: function () { s.page = p; self.render(); self.root.scrollIntoView({behavior: 'smooth', block: 'start'}); }}));
      })(p);
    } else if (shown < total) {
      var more = h('button', {type: 'button', class: 'bitsy-btn bitsy-btn--secondary', text: o.t.more, onclick: function () { s.page += 1; self.render(); }});
      nav.appendChild(more);
      if (o.pagination === 'infinite' && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); s.page += 1; self.render(); } });
        setTimeout(function () { io.observe(more); }, 50);
      }
    }
    return nav;
  };
  Results.prototype.card = function (it) {
    var o = this.opts, t = o.t, p = it.product, v = it.variant;
    var url = config.root + '/products/' + p.handle + '?variant=' + numId(v.id);
    var imgs = [];
    var main = v.image || p.featuredImage;
    if (main) imgs.push(main);
    if (o.hover && p.images && p.images.nodes) p.images.nodes.forEach(function (im) { if (imgs.length < 2 && (!main || im.url !== main.url)) imgs.push(im); });
    var media = h('a', {class: 'bitsy-card__media', href: url, tabindex: '-1', 'aria-hidden': 'true'},
      imgs.map(function (im) { return h('img', {src: im.url + (im.url.indexOf('?') < 0 ? '?' : '&') + 'width=600', alt: '', loading: 'lazy'}); }));
    var priceRow = h('div', {class: 'bitsy-card__row'}, [
      h('span', {class: 'bitsy-card__price'}, [money(v.price && v.price.amount),
        v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount) ? h('span', {class: 'bitsy-card__compare', text: money(v.compareAtPrice.amount)}) : null]),
      o.stock ? h('span', {class: 'bitsy-card__stock' + (it.available ? '' : ' bitsy-card__stock--out'), text: it.available ? t.inStock : t.sold}) : null
    ]);
    var card = h('article', {class: 'bitsy-card'}, [
      media,
      o.brand && p.vendor ? h('span', {class: 'bitsy-card__brand', text: p.vendor}) : null,
      h('a', {class: 'bitsy-card__title', href: url, text: p.title}),
      o.sku && v.sku ? h('span', {class: 'bitsy-card__sku', text: (t.sku ? t.sku + ' ' : '') + v.sku}) : null,
      priceRow,
      o.fit ? h('span', {class: 'bitsy-card__fit', text: t.fit}) : null
    ]);
    if (o.atc) {
      var btn = h('button', {type: 'button', class: 'bitsy-btn', disabled: !it.available, text: it.available ? t.atc : t.sold});
      btn.addEventListener('click', function () {
        btn.disabled = true;
        fetch(config.cartAdd, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'},
          body: JSON.stringify({items: [{id: Number(numId(v.id)), quantity: 1}]})})
          .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
          .then(function (res) {
            fire('bitsy:cart-added', res); fire('cart:refresh', res);
            if (o.afterAdd === 'cart') { window.location.href = config.cartUrl; return; }
            btn.textContent = t.added;
            setTimeout(function () { btn.textContent = t.atc; btn.disabled = false; }, 2000);
          })
          .catch(function () { btn.textContent = t.atc; btn.disabled = false; });
      });
      card.appendChild(btn);
    }
    return card;
  };

  /* ---------- Results page ---------- */
  function initResultsPage(root) {
    var r = new Results(root);
    var ktype = new URLSearchParams(window.location.search).get('ktype');
    var active = garage.active();
    if (!ktype && active) ktype = active.ktype;
    var label = $('[data-results-vehicle]', root);
    if (!ktype) { r.out.innerHTML = ''; r.out.appendChild(h('div', {class: 'bitsy-empty', text: r.opts.t.choose})); return; }
    if (label) {
      var v = garage.list().filter(function (x) { return String(x.ktype) === String(ktype); })[0];
      label.textContent = v ? vehicleFull(v) : '';
    }
    r.load(ktype);
  }

  /* ---------- Collection bar ---------- */
  function initCollection(root) {
    var r = new Results(root);
    var grids = (root.getAttribute('data-theme-grid') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var stateEl = $('[data-coll-state]', root), pickEl = $('[data-coll-picker]', root), nameEl = $('[data-coll-vehicle]', root);
    var auto = root.getAttribute('data-auto') !== 'false';
    var setTheme = function (show) {
      grids.forEach(function (sel) { try { $$(sel).forEach(function (el) { if (!el.contains(root) && !root.contains(el)) el.style.display = show ? '' : 'none'; }); } catch (e) { /* bad selector */ } });
    };
    var apply = function (v) {
      if (!v) { stateEl.hidden = true; pickEl.hidden = false; r.out.innerHTML = ''; setTheme(true); return; }
      stateEl.hidden = false; pickEl.hidden = true;
      if (nameEl) nameEl.textContent = (root.getAttribute('data-t-fits') || 'Showing parts that fit {vehicle}').replace('{vehicle}', vehicleFull(v));
      setTheme(false);
      r.load(v.ktype);
    };
    var change = $('[data-coll-change]', root), clear = $('[data-coll-clear]', root);
    if (change) change.addEventListener('click', function () { pickEl.hidden = !pickEl.hidden; });
    if (clear) clear.addEventListener('click', function () { garage.clearActive(); });
    document.addEventListener('bitsy:vehicle', function (e) { apply(e.detail); });
    var active = garage.active();
    if (active && auto) apply(active); else { stateEl.hidden = true; pickEl.hidden = false; }
  }

  /* ---------- Collection pages filtered by the header nav bar ----------
   * On /collections/<handle> the nav bar replaces the theme's product grid with every product in
   * that collection that fits the selected vehicle. No section is needed in the theme. */
  function themeGridTargets(selectorList) {
    var found = [];
    (selectorList || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (sel) {
      try { $$(sel).forEach(function (el) { if (!el.closest('.bitsy') && found.indexOf(el) < 0) found.push(el); }); } catch (e) { /* bad selector */ }
    });
    // Keep only the outermost matches.
    found = found.filter(function (el) { return !found.some(function (o) { return o !== el && o.contains(el); }); });
    if (found.length) return found;
    // Fallback: the smallest element holding all the theme's product links.
    var scope = document.querySelector('main') || document.body;
    var links = $$('a[href*="/products/"]', scope).filter(function (a) { return !a.closest('.bitsy, header, footer, nav'); });
    if (links.length < 2) return [];
    var lca = links[0].parentElement;
    while (lca && !links.every(function (a) { return lca.contains(a); })) lca = lca.parentElement;
    return lca && lca !== document.body && lca !== scope ? [lca] : [];
  }
  function initHeaderCollection(bar) {
    var id = bar.getAttribute('data-collection-id');
    if (!id || bar.getAttribute('data-auto-collection') === 'false') return;
    if (!/\/collections\/[^/]+\/?$/.test(window.location.pathname)) return;
    if (document.querySelector('[data-bitsy-results][data-mode="collection"]')) return; // the collection section is in charge
    var targets = themeGridTargets(bar.getAttribute('data-theme-grid'));
    if (!targets.length) return;
    var t = bar.dataset;
    var nameEl = h('span', {'data-coll-vehicle': ''});
    var countEl = h('span', {class: 'bitsy-coll__count', 'data-results-count': ''});
    var root = h('div', {class: 'bitsy__inner bitsy-results', 'data-bitsy-results': '', 'data-mode': 'collection', 'data-header': '',
      'data-collection-id': id, 'data-t-count': t.tCount || '{count} products fit', 'data-pagination': 'numbers'}, [
      h('div', {class: 'bitsy-coll__state'}, [
        h('span', {class: 'bitsy-coll__fits', html: ICON_CHECK}, [nameEl]),
        countEl,
        h('span', {class: 'bitsy-spacer'}),
        h('button', {type: 'button', class: 'bitsy-link', text: t.tClear || 'Clear vehicle, show all', onclick: function () { garage.clearActive(); }})
      ]),
      h('div', {'data-results-out': ''})
    ]);
    var wrap = h('div', {class: 'bitsy bitsy-auto-coll', hidden: true, style: 'margin:0 0 24px'}, [root]);
    targets[0].parentNode.insertBefore(wrap, targets[0]);
    var r = new Results(root);
    var apply = function (v) {
      targets.forEach(function (el) { el.style.display = v ? 'none' : ''; });
      wrap.hidden = !v;
      if (!v) { r.out.innerHTML = ''; return; }
      nameEl.textContent = (t.tFits || 'Showing parts that fit {vehicle}').replace('{vehicle}', vehicleFull(v));
      r.load(v.ktype);
    };
    document.addEventListener('bitsy:vehicle', function (e) { apply(e.detail); });
    apply(garage.active());
  }

  /* ---------- Garage count badges and nav bar behaviour ---------- */
  function refreshBadges() {
    var n = garage.list().length;
    $$('[data-garage-count]').forEach(function (b) { b.textContent = String(n); b.hidden = !n; });
    $$('[data-active-vehicle]').forEach(function (el) { var a = garage.active(); el.textContent = a ? vehicleFull(a) : ''; });
  }
  function initBar(bar) {
    var toggle = $('.bitsy-bar__toggle', bar);
    if (toggle) toggle.addEventListener('click', function () {
      var open = bar.classList.toggle('bitsy-bar--open'); toggle.setAttribute('aria-expanded', String(open));
    });
    if (bar.classList.contains('bitsy-bar--sticky') && bar.hasAttribute('data-stuck-shadow') && 'IntersectionObserver' in window) {
      var s = h('div', {style: 'height:1px;margin-top:-1px', 'aria-hidden': 'true'});
      bar.parentNode.insertBefore(s, bar);
      new IntersectionObserver(function (en) { bar.classList.toggle('bitsy-bar--stuck', !en[0].isIntersecting); }).observe(s);
    }
    if (bar.getAttribute('data-position') === 'above') {
      var header = document.querySelector('header, .header-wrapper, #shopify-section-header, .shopify-section-group-header-group');
      var root = bar.closest('.bitsy');
      if (header && root && header.parentNode) header.parentNode.insertBefore(root, header);
    } else {
      var groups = $$('.shopify-section-group-header-group');
      var hdr = groups.length ? groups[groups.length - 1] : document.querySelector('#shopify-section-header, header');
      var r2 = bar.closest('.bitsy');
      if (hdr && r2 && hdr.parentNode && !r2.closest('header')) hdr.parentNode.insertBefore(r2, hdr.nextSibling);
    }
  }

  /* ---------- boot ---------- */
  function boot() {
    $$('[data-bitsy-bar]').forEach(initBar);
    $$('form[data-bitsy-ymm]').forEach(function (f) { if (!f.__bitsy) f.__bitsy = new VehicleForm(f); });
    $$('[data-garage-open]').forEach(function (b) {
      if (b.closest('form[data-bitsy-ymm]') || b.__bitsy) return;
      b.__bitsy = true; b.addEventListener('click', function () { modal.open(b); });
    });
    $$('[data-bitsy-results][data-mode="page"]').forEach(initResultsPage);
    $$('[data-bitsy-results][data-mode="collection"]').forEach(function (r) { if (!r.hasAttribute('data-header') && !r.__bitsy) { r.__bitsy = true; initCollection(r); } });
    $$('[data-bitsy-bar]').forEach(function (b) { if (!b.__bitsyColl) { b.__bitsyColl = true; initHeaderCollection(b); } });
    refreshBadges();
  }
  document.addEventListener('bitsy:garage', refreshBadges);
  // Re-run after a section is added or changed in the theme editor.
  document.addEventListener('shopify:section:load', boot);
  document.addEventListener('shopify:block:select', function () { refreshBadges(); });

  window.BitsyAuto = {config: config, garage: garage, openGarage: function () { modal.open(null); }, refresh: boot};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
