/* Live console demo. Reads a scenario from <script type="application/json" data-watch-for="ID">
   and plays it into <div class="watch" id="ID">. Plain JS, no libraries, no network. Every number is made up. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  function setup(box, data) {
    var state = {}, timer = null, i = 0, waiting = null;
    box.textContent = '';
    var head = el('div', 'watch-head');
    var who = el('span'); who.append('Migration Watch · '); who.append(el('b', '', data.company));
    var status = el('span', '', 'ready');
    head.append(who, status);
    var bar = el('div', 'bar'); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'Projects moved');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(data.totals.projects));
    var fill = el('i'); bar.append(fill);
    var counts = el('div', 'counts');
    var cells = {};
    data.counters.forEach(function (c) {
      var s = el('span'); var b = el('b', '', '0'); cells[c.key] = b;
      s.append(b, ' ' + c.label); counts.append(s);
    });
    var feed = el('ol', 'feed'); feed.setAttribute('aria-live', 'polite');
    var foot = el('div', 'watch-foot');
    var note = el('span', '', data.note || 'Made-up company and numbers.');
    var again = el('button', '', 'Replay'); again.type = 'button';
    foot.append(note, again);
    box.append(head, bar, counts, feed, foot);

    function apply(set) {
      if (!set) return;
      Object.keys(set).forEach(function (k) { state[k] = set[k]; if (cells[k]) cells[k].textContent = fmt(set[k]) + (k === 'projects' ? ' / ' + data.totals.projects : ''); });
      if (set.projects != null) {
        fill.style.width = Math.round(100 * set.projects / data.totals.projects) + '%';
        bar.setAttribute('aria-valuenow', String(set.projects));
      }
    }
    function line(ev) {
      var li = el('li'); var t = el('time', '', ev.at || ''); var msg = el('div', ev.kind || '', ev.text);
      li.append(t, msg); feed.append(li); feed.scrollTop = feed.scrollHeight; apply(ev.set); return msg;
    }
    function fixNow(ev, btn) {
      if (btn) { btn.disabled = true; btn.textContent = 'Fix applied'; }
      waiting = null; status.textContent = 'running';
      (ev.fix.then || []).forEach(function (t) { line(t); });
      next();
    }
    function next() {
      if (i >= data.events.length) { status.textContent = 'done'; return; }
      var ev = data.events[i++];
      var msg = line(ev);
      if (ev.fix) {
        status.textContent = 'needs a decision';
        var row = el('div', 'fixbox'); var btn = el('button', '', ev.fix.label || 'Apply fix'); btn.type = 'button';
        row.append(btn, el('span', '', ev.fix.hint || '')); msg.append(row);
        btn.addEventListener('click', function () { clearTimeout(timer); fixNow(ev, btn); });
        waiting = ev;
        timer = setTimeout(function () { if (waiting === ev) fixNow(ev, btn); }, data.autoFixMs || 9000);
        return;
      }
      timer = setTimeout(next, ev.pause || data.stepMs || 1100);
    }
    function start() {
      clearTimeout(timer); feed.textContent = ''; i = 0; waiting = null; state = {};
      apply(data.start); status.textContent = 'running';
      if (reduce) {
        data.events.forEach(function (ev) { line(ev); (ev.fix && ev.fix.then || []).forEach(function (t) { line(t); }); });
        status.textContent = 'done'; return;
      }
      next();
    }
    again.addEventListener('click', start);
    apply(data.start);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); } }, { threshold: 0.4 });
      io.observe(box);
    } else { start(); }
  }

  document.querySelectorAll('script[data-watch-for]').forEach(function (s) {
    var box = document.getElementById(s.getAttribute('data-watch-for'));
    if (!box) return;
    try { setup(box, JSON.parse(s.textContent)); } catch (e) { box.textContent = 'Demo could not load.'; }
  });
})();
