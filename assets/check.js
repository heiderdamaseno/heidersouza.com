/* Readiness check. Reads questions from <script type="application/json" data-check-for="ID"> and renders them
   into <form class="check" id="ID">. Nothing leaves the browser unless the visitor presses the email link. */
(function () {
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function setup(form, data) {
    form.textContent = '';
    data.questions.forEach(function (q, qi) {
      var fs = el('fieldset'); fs.append(el('legend', '', (qi + 1) + '. ' + q.q));
      q.options.forEach(function (o, oi) {
        var lab = el('label'); var inp = document.createElement('input');
        inp.type = 'radio'; inp.name = 'q' + qi; inp.value = String(oi); inp.required = true;
        lab.append(inp, document.createTextNode(o.label)); fs.append(lab);
      });
      form.append(fs);
    });
    var go = el('button', 'btn primary', data.button || 'Show my result'); go.type = 'submit';
    var out = el('div'); out.setAttribute('aria-live', 'polite');
    form.append(go, out);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var score = 0, flags = [], lines = [];
      data.questions.forEach(function (q, qi) {
        var pick = form.querySelector('input[name="q' + qi + '"]:checked');
        var o = q.options[Number(pick.value)];
        score += o.points || 0;
        if (o.flag) flags.push(o.flag);
        lines.push((qi + 1) + '. ' + q.q + ' ' + o.label);
      });
      var band = data.bands.filter(function (b) { return score >= b.min; }).pop();
      out.textContent = '';
      var r = el('div', 'result'); r.setAttribute('data-band', String(data.bands.indexOf(band) + 1));
      r.append(el('h3', '', band.title), el('p', '', band.text));
      if (flags.length) { var ul = el('ul'); flags.forEach(function (f) { ul.append(el('li', '', f)); }); r.append(el('p', 'muted', 'Watch these:'), ul); }
      var body = data.mailIntro + '\n\nResult: ' + band.title + ' (score ' + score + ')\n\n' + lines.join('\n') + '\n\nCompany:\nMy role:\nBest time for a call:\n';
      var a = el('a', 'btn primary', data.mailButton || 'Send this to Heider');
      a.href = 'mailto:' + data.mailTo + '?subject=' + encodeURIComponent(data.mailSubject) + '&body=' + encodeURIComponent(body);
      r.append(el('p', '', data.after || ''), a);
      out.append(r);
      r.scrollIntoView({ block: 'nearest' });
    });
  }

  document.querySelectorAll('script[data-check-for]').forEach(function (s) {
    var form = document.getElementById(s.getAttribute('data-check-for'));
    if (!form) return;
    try { setup(form, JSON.parse(s.textContent)); } catch (e) { form.textContent = 'The check could not load. Email heider@heidersouza.com instead.'; }
  });
})();
