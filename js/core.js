/* =========================================================
   BEAUTY SALON MANAGER — noyau : utilitaires, connexion,
   navigation, fenêtres, et calculs financiers partagés.
   ========================================================= */
(function () {
  /* ---------- Raccourcis DOM ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* Échappement HTML (toute donnée saisie passe par h()) */
  function h(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* ---------- Montants en FCFA ---------- */
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function fmt(v) {
    return Math.round(num(v)).toLocaleString('fr-FR').replace(/[  ]/g, ' ') + ' FCFA';
  }
  function fmtNum(v) { return Math.round(num(v)).toLocaleString('fr-FR').replace(/[  ]/g, ' '); }

  /* ---------- Dates (heure locale, format AAAA-MM-JJ) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function ymd(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
  function startOfWeek(s) { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
  function monthStart(s) { return s.slice(0, 8) + '01'; }
  function monthEnd(s) { const d = parseYmd(s); return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  function yearStart(s) { return s.slice(0, 4) + '-01-01'; }
  function yearEnd(s) { return s.slice(0, 4) + '-12-31'; }
  function fmtDate(s) { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
  function fmtLongDate(s) { const d = parseYmd(s); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; }
  function nowTime() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function addMinutes(hhmm, mins) {
    const [H, M] = hhmm.split(':').map(Number);
    const t = H * 60 + M + mins;
    return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
  }
  function toMin(hhmm) { const [H, M] = hhmm.split(':').map(Number); return H * 60 + M; }

  /* Périodes standard */
  function periodRange(key, custom) {
    const t = ymd();
    switch (key) {
      case 'jour': return { from: t, to: t, label: "Aujourd'hui" };
      case 'semaine': { const a = startOfWeek(t); return { from: a, to: addDays(a, 6), label: 'Cette semaine' }; }
      case 'mois': return { from: monthStart(t), to: monthEnd(t), label: 'Ce mois' };
      case 'annee': return { from: yearStart(t), to: yearEnd(t), label: 'Cette année' };
      case 'perso': {
        const from = custom && custom.from ? custom.from : monthStart(t);
        const to = custom && custom.to ? custom.to : t;
        return { from, to, label: `Du ${fmtDate(from)} au ${fmtDate(to)}` };
      }
      default: return { from: t, to: t, label: "Aujourd'hui" };
    }
  }
  /* Sélecteur de période réutilisable */
  function periodControls(prefix, key, from, to) {
    return `<div class="period-bar">
      <select id="${prefix}-p" class="select">
        <option value="jour" ${key === 'jour' ? 'selected' : ''}>Aujourd'hui</option>
        <option value="semaine" ${key === 'semaine' ? 'selected' : ''}>Cette semaine</option>
        <option value="mois" ${key === 'mois' ? 'selected' : ''}>Ce mois</option>
        <option value="annee" ${key === 'annee' ? 'selected' : ''}>Cette année</option>
        <option value="perso" ${key === 'perso' ? 'selected' : ''}>Période personnalisée</option>
      </select>
      <div class="custom-range ${key === 'perso' ? '' : 'hidden'}" id="${prefix}-custom">
        <input type="date" class="input" id="${prefix}-from" value="${from}">
        <span>au</span>
        <input type="date" class="input" id="${prefix}-to" value="${to}">
      </div></div>`;
  }
  function readPeriod(prefix) {
    return {
      key: $('#' + prefix + '-p').value,
      from: $('#' + prefix + '-from') ? $('#' + prefix + '-from').value : '',
      to: $('#' + prefix + '-to') ? $('#' + prefix + '-to').value : ''
    };
  }

  /* ---------- Notifications ---------- */
  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  /* ---------- Fenêtre modale ---------- */
  function openModal({ title, body, footer = '', wide = false, onMount, onClose } = {}) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="overlay">
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${h(title)}</h3>
          <button class="icon-btn" data-close aria-label="Fermer">✕</button></div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div></div>`;
    const overlay = root.querySelector('.overlay');
    const el = root.querySelector('.modal');
    let closed = false;
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => {
      if (closed) return;
      closed = true;
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    document.addEventListener('keydown', onKey);
    if (onMount) onMount(el, close);
    return { close, el };
  }

  /* Confirmation avant suppression ou action importante */
  function confirmBox(message, { title = 'Confirmation', okLabel = 'Confirmer', danger = true } = {}) {
    return new Promise(resolve => {
      openModal({
        title,
        body: `<p class="confirm-msg">${h(message)}</p>`,
        footer: `<button class="btn ghost" data-close>Annuler</button>
                 <button class="btn ${danger ? 'danger' : 'primary'}" id="cf-ok">${h(okLabel)}</button>`,
        onMount: (el, close) => {
          el.querySelector('#cf-ok').onclick = () => { resolve(true); close(); };
        },
        onClose: () => resolve(false)
      });
    });
  }

  /* ---------- Éléments d'interface réutilisables ---------- */
  function pageHead(title, sub, actions = '') {
    return `<div class="page-head">
      <div><h2>${h(title)}</h2>${sub ? `<p class="muted">${h(sub)}</p>` : ''}</div>
      <div class="page-actions">${actions}</div></div>`;
  }
  function kpi(label, value, sub = '', cls = '') {
    return `<div class="kpi ${cls}"><span class="kpi-label">${h(label)}</span>
      <strong class="kpi-value">${value}</strong>
      ${sub ? `<span class="kpi-sub">${sub}</span>` : ''}</div>`;
  }
  function table(headers, rows, { empty = 'Aucune donnée à afficher.' } = {}) {
    if (!rows.length) return `<div class="empty">${h(empty)}</div>`;
    return `<div class="table-wrap"><table class="table">
      <thead><tr>${headers.map(x => `<th>${h(x)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  }
  function badge(text, cls = '') { return `<span class="badge ${cls}">${h(text)}</span>`; }
  function field(label, input, hint = '') {
    return `<label class="field"><span>${h(label)}</span>${input}${hint ? `<small class="muted">${h(hint)}</small>` : ''}</label>`;
  }
  function formData(form) {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
    return o;
  }
  function optionsList(items, selected, { placeholder = '' } = {}) {
    return (placeholder ? `<option value="">${h(placeholder)}</option>` : '') +
      items.map(i => `<option value="${h(i.value)}" ${String(i.value) === String(selected) ? 'selected' : ''}>${h(i.label)}</option>`).join('');
  }

  /* Impression (reçus, rapports) dans un cadre caché */
  function printHtml(html, title = 'Impression') {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${h(title)}</title>
      <style>${PRINT_CSS}</style></head><body>${html}</body></html>`);
    doc.close();
    frame.contentWindow.focus();
    setTimeout(() => { frame.contentWindow.print(); setTimeout(() => frame.remove(), 1500); }, 300);
  }
  const PRINT_CSS = `
    body{font-family:Arial,Helvetica,sans-serif;color:#1f1726;margin:0;padding:16px;font-size:13px}
    h1,h2,h3{margin:4px 0} .center{text-align:center}
    table{width:100%;border-collapse:collapse;margin:8px 0}
    th,td{border-bottom:1px solid #ddd;padding:5px 4px;text-align:left;font-size:12px}
    th{background:#f3eef6} .right{text-align:right} .total{font-weight:bold;font-size:14px}
    .muted{color:#666} .line{border-top:1px dashed #999;margin:8px 0}
    @media print{ @page{margin:10mm} }`;

  /* Empreinte du mot de passe (SHA-256 si disponible) */
  async function hashPassword(pw) {
    const data = new TextEncoder().encode('bsm::' + pw);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let x = 0;
    for (const c of data) x = (x * 31 + c) >>> 0;
    return 'fb' + x;
  }

  /* ---------- Rôles ---------- */
  const ROLES = { admin: 'Administrateur', receptionniste: 'Réceptionniste', coiffeur: 'Coiffeur' };
  const PAY_MODES = ['Espèces', 'MTN Mobile Money', 'Orange Money', 'Virement bancaire'];
  const EXPENSE_CATS = ['Loyer', 'Électricité', 'Eau', 'Internet', 'Salaires', 'Achat de produits', 'Transport', 'Entretien', 'Réparations', 'Autres dépenses'];
  /* Catégories exclues du calcul du bénéfice, car déjà comptées ailleurs */
  const EXCLUDED_FROM_PROFIT = ['Achat de produits', 'Salaires'];

  /* ---------- Session ---------- */
  const Session = {
    get() {
      try {
        const id = sessionStorage.getItem('bsm-user');
        return id ? DB.get('users', id) : null;
      } catch (e) { return null; }
    },
    set(u) { try { sessionStorage.setItem('bsm-user', u.id); } catch (e) { /* non bloquant */ } },
    clear() { try { sessionStorage.removeItem('bsm-user'); } catch (e) { /* non bloquant */ } }
  };

  /* ---------- Calculs financiers partagés ----------
     Règles anti-doublons :
     - Chiffre d'affaires = montant net des transactions (ventes).
     - Encaissements = montants réellement payés (trésorerie).
     - Coût des produits vendus = prix d'achat des produits sortis.
     - Commissions et salaires fixes = gérés par le module Personnel.
     - Dépenses : les catégories « Achat de produits » et « Salaires »
       ne sont pas redéduites du bénéfice (déjà comptées ailleurs). */
  function txInRange(from, to) {
    return DB.all('transactions').filter(t => t.date >= from && t.date <= to);
  }

  function salaryAccrued(emp, from, to) {
    if (!emp.actif || !(emp.modeRemuneration === 'fixe' || emp.modeRemuneration === 'mixte')) return 0;
    const today = ymd();
    const start = emp.dateRecrutement && emp.dateRecrutement > from ? emp.dateRecrutement : from;
    const end = to < today ? to : today;
    if (!emp.dateRecrutement || end < start) return 0;
    // Prorata mois par mois : un mois complet vaut exactement le salaire,
    // quel que soit le nombre de jours du mois (28, 30 ou 31).
    let total = 0;
    let cursor = start;
    while (cursor <= end) {
      const mEnd = monthEnd(cursor);
      const segEnd = mEnd < end ? mEnd : end;
      const daysInMonth = parseYmd(mEnd).getDate();
      const days = diffDays(cursor, segEnd) + 1;
      total += num(emp.salaireFixe) * days / daysInMonth;
      cursor = addDays(segEnd, 1);
    }
    return total;
  }

  function periodFinance(from, to) {
    const txs = txInRange(from, to);
    let ca = 0, encaisse = 0, cogs = 0, commissions = 0;
    txs.forEach(t => {
      ca += num(t.montantNet);
      encaisse += num(t.montantPaye);
      (t.lignes || []).forEach(l => {
        if (l.type === 'produit') cogs += num(l.quantite) * num(l.prixAchat);
        if (l.type === 'prestation') commissions += num(l.commission);
      });
    });
    const depenses = DB.all('depenses').filter(d => d.date >= from && d.date <= to);
    const totalDepenses = depenses.reduce((s, d) => s + num(d.montant), 0);
    const chargesDeduites = depenses
      .filter(d => !EXCLUDED_FROM_PROFIT.includes(d.categorie))
      .reduce((s, d) => s + num(d.montant), 0);
    const salairesFixes = DB.all('employees').reduce((s, e) => s + salaryAccrued(e, from, to), 0);
    const benefBrut = ca - cogs;
    const benefNet = benefBrut - commissions - salairesFixes - chargesDeduites;
    return {
      txs, ca, encaisse, cogs, commissions, salairesFixes, depenses, totalDepenses,
      chargesDeduites, benefBrut, benefNet,
      nbClients: new Set(txs.map(t => t.clientId).filter(Boolean)).size,
      nbPrestations: txs.reduce((s, t) => s + (t.lignes || []).filter(l => l.type === 'prestation').reduce((a, l) => a + num(l.quantite), 0), 0)
    };
  }

  /* Statistiques d'un coiffeur sur une période */
  function employeeStats(empId, from, to) {
    let nb = 0, ca = 0, commissions = 0;
    txInRange(from, to).forEach(t => (t.lignes || []).forEach(l => {
      if (l.type === 'prestation' && l.employeeId === empId) {
        nb += num(l.quantite); ca += num(l.montantNet); commissions += num(l.commission);
      }
    }));
    return { nb, ca, commissions };
  }

  /* Solde à payer d'un coiffeur (depuis le début) */
  function employeeBalance(emp) {
    const today = ymd();
    const all = employeeStats(emp.id, '0000-01-01', '9999-12-31');
    const salaire = salaryAccrued(emp, emp.dateRecrutement || today, today);
    const mouvements = DB.all('mouvements_personnel').filter(m => m.employeeId === emp.id);
    const avances = mouvements.filter(m => m.type === 'avance').reduce((s, m) => s + num(m.montant), 0);
    const paiements = mouvements.filter(m => m.type === 'paiement').reduce((s, m) => s + num(m.montant), 0);
    const gains = all.commissions + salaire;
    return { ...all, salaire, gains, avances, paiements, solde: gains - avances - paiements };
  }

  /* Clients : visites et dépenses calculées depuis les transactions */
  function clientStats(clientId) {
    const txs = DB.all('transactions').filter(t => t.clientId === clientId).sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
    return {
      txs,
      visites: txs.length,
      total: txs.reduce((s, t) => s + num(t.montantNet), 0),
      derniere: txs[0] ? txs[0].date : '',
      premiere: txs.length ? txs[txs.length - 1].date : ''
    };
  }

  /* ---------- Journal (log) ---------- */
  function logAndCommit(ops) {
    return DB.commit(ops);
  }

  /* ---------- Application ---------- */
  const PAGES = {};
  const App = {
    user: null,
    current: null,
    registerPage(key, def) { PAGES[key] = def; }
  };

  function routeKey() {
    return (location.hash || '#/dashboard').replace(/^#\/?/, '').split('?')[0] || 'dashboard';
  }
  function defaultPage(user) { return user.role === 'coiffeur' ? 'mon-espace' : 'dashboard'; }

  function buildNav(user) {
    const nav = $('#nav');
    const groups = [
      ['Pilotage', ['dashboard', 'finances', 'rapports']],
      ['Activité', ['caisse', 'rdv', 'clients', 'prestations', 'stock', 'depenses']],
      ['Équipe', ['personnel', 'mon-espace']],
      ['Administration', ['parametres', 'journal']]
    ];
    const current = App.current;
    nav.innerHTML = groups.map(([title, keys]) => {
      const items = keys.filter(k => PAGES[k] && PAGES[k].roles.includes(user.role));
      if (!items.length) return '';
      return `<div class="nav-group"><span class="nav-title">${title}</span>` +
        items.map(k => `<a href="#/${k}" class="nav-link ${k === current ? 'active' : ''}" data-key="${k}">
          <span class="nav-ico">${PAGES[k].icon}</span><span>${h(PAGES[k].label)}</span></a>`).join('') +
        `</div>`;
    }).join('');
  }

  function showAuth() {
    $('#app').classList.add('hidden');
    $('#auth').classList.remove('hidden');
    const hasUsers = DB.all('users').length > 0;
    const s = DB.settings();
    $('#auth').innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          ${s.logo ? `<img src="${s.logo}" alt="" class="auth-logo">` : '<div class="logo-mark">✂</div>'}
          <h1>BEAUTY SALON MANAGER</h1>
          <p class="muted">${h(s.nom)}</p>
        </div>
        ${hasUsers ? `
        <h2>Connexion</h2>
        <form id="login-form" class="form-stack" autocomplete="on">
          ${field('Identifiant', '<input class="input" name="identifiant" required autofocus autocomplete="username">')}
          ${field('Mot de passe', '<input class="input" type="password" name="motdepasse" required autocomplete="current-password">')}
          <p class="form-error" id="auth-error"></p>
          <button class="btn primary block" type="submit">Se connecter</button>
        </form>` : `
        <h2>Premier démarrage</h2>
        <p class="muted small">Créez le compte administrateur. Vous pourrez ensuite ajouter les réceptionnistes et les coiffeurs.</p>
        <form id="setup-form" class="form-stack">
          ${field('Nom complet', '<input class="input" name="nom" required autofocus>')}
          ${field('Identifiant', '<input class="input" name="identifiant" required autocomplete="username">')}
          ${field('Mot de passe', '<input class="input" type="password" name="motdepasse" minlength="4" required autocomplete="new-password">', 'Au moins 4 caractères')}
          ${field('Confirmer le mot de passe', '<input class="input" type="password" name="confirmation" minlength="4" required autocomplete="new-password">')}
          <p class="form-error" id="auth-error"></p>
          <button class="btn primary block" type="submit">Créer le compte et démarrer</button>
        </form>`}
      </div>`;

    if (hasUsers) {
      $('#login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const f = formData(e.target);
        const hash = await hashPassword(f.motdepasse);
        const u = DB.all('users').find(x => x.identifiant.toLowerCase() === f.identifiant.toLowerCase());
        if (!u || u.passwordHash !== hash) {
          $('#auth-error').textContent = 'Identifiant ou mot de passe incorrect.';
          return;
        }
        Session.set(u);
        App.user = u;
        start();
      });
    } else {
      $('#setup-form').addEventListener('submit', async e => {
        e.preventDefault();
        const f = formData(e.target);
        if (f.motdepasse !== f.confirmation) { $('#auth-error').textContent = 'Les mots de passe ne correspondent pas.'; return; }
        const u = { id: uid(), nom: f.nom, identifiant: f.identifiant, role: 'admin', employeeId: '', passwordHash: await hashPassword(f.motdepasse) };
        await logAndCommit([{ op: 'put', store: 'users', obj: u }, DB.logOp('Création du compte administrateur', f.identifiant, u)]);
        Session.set(u);
        App.user = u;
        toast('Bienvenue ! Votre compte administrateur est créé.');
        start();
      });
    }
  }

  function start() {
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    render();
  }

  function render() {
    if (!App.user) return showAuth();
    const user = App.user;
    const key = routeKey();
    const allowed = PAGES[key] && PAGES[key].roles.includes(user.role);
    if (!allowed) {
      // Page non autorisée ou inexistante : retour à la page par défaut du rôle
      location.hash = '#/' + defaultPage(user);
      return;
    }
    renderPage(key);
  }

  function renderPage(key) {
    const user = App.user;
    App.current = key;
    const s = DB.settings();
    $('#brand-name').textContent = s.nom;
    $('#brand-logo').innerHTML = s.logo ? `<img src="${s.logo}" alt="">` : '✂';
    $('#user-name').textContent = user.nom;
    $('#user-role').textContent = ROLES[user.role];
    $('#topbar-date').textContent = fmtLongDate(ymd());
    buildNav(user);
    $('#page-title').textContent = PAGES[key].label;
    // Conteneur neuf à chaque affichage : évite d'accumuler les gestionnaires d'événements
    const old = $('#page');
    const root = old.cloneNode(false);
    old.replaceWith(root);
    try {
      PAGES[key].render(root, user);
    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="empty error">Une erreur est survenue sur cette page : ${h(err.message)}</div>`;
    }
    toggleMenu(false);
  }

  function toggleMenu(open) {
    $('#sidebar').classList.toggle('open', open);
    $('#app').classList.toggle('menu-open', open);
  }

  /* Rafraîchit la page courante après une modification */
  App.refresh = () => { if (App.user) renderPage(App.current || routeKey()); };

  window.addEventListener('hashchange', () => { if (App.user) render(); });

  /* Expose les utilitaires aux autres fichiers */
  Object.assign(window, {
    $, $$, h, num, fmt, fmtNum, JOURS, MOIS, ymd, parseYmd, addDays, diffDays, startOfWeek, monthStart, monthEnd,
    yearStart, yearEnd, fmtDate, fmtLongDate, nowTime, addMinutes, toMin, periodRange, periodControls,
    readPeriod, toast, openModal, confirmBox, pageHead, kpi, table, badge, field, formData, optionsList,
    printHtml, hashPassword, ROLES, PAY_MODES, EXPENSE_CATS, EXCLUDED_FROM_PROFIT, Session, App, PAGES,
    txInRange, periodFinance, employeeStats, employeeBalance, clientStats, salaryAccrued, logAndCommit, showAuth, start, render
  });

  /* ---------- Démarrage ---------- */
  async function boot() {
    try {
      await DB.open();
      await DB.load();
      DB.askPersistence();
    } catch (err) {
      $('#auth').classList.remove('hidden');
      $('#auth').innerHTML = `<div class="auth-card"><h2>Impossible d'ouvrir les données</h2>
        <p class="form-error">${h(err.message)}</p></div>`;
      return;
    }
    const user = Session.get();
    if (user) { App.user = user; start(); } else { showAuth(); }
  }

  /* Interface : menu mobile, déconnexion */
  document.addEventListener('DOMContentLoaded', () => {
    $('#menu-toggle').addEventListener('click', () => toggleMenu(true));
    $('#overlay-backdrop').addEventListener('click', () => toggleMenu(false));
    $('#logout-btn').addEventListener('click', () => {
      Session.clear();
      App.user = null;
      location.hash = '';
      $('#app').classList.add('hidden');
      showAuth();
    });
    boot();
  });
})();
