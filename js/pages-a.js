/* =========================================================
   BEAUTY SALON MANAGER — pages : tableau de bord, caisse,
   rendez-vous. Dépend de core.js et db.js.
   ========================================================= */
(function () {
  const RDV_STATUTS = ['En attente', 'Confirmé', 'En cours', 'Terminé', 'Annulé', 'Client absent'];
  const RDV_BLOCKING = ['Annulé', 'Client absent'];
  const STATUT_CLASS = { 'En attente': 'warn', 'Confirmé': 'info', 'En cours': 'accent', 'Terminé': 'ok', 'Annulé': 'danger', 'Client absent': 'muted' };
  const CHART_COLORS = ['#6b1d4f', '#e9b8cc', '#b5487f', '#8c3a6b', '#d98fb5', '#4f1239', '#c9a0bb', '#f0d3e0'];

  /* ---------- Noms liés (lecture seule) ---------- */
  const byName = (a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, 'fr');
  const clientName = id => { const c = DB.get('clients', id); return c ? `${c.nom} ${c.prenom}`.trim() : '—'; };
  const serviceName = id => { const s = DB.get('services', id); return s ? s.nom : '—'; };
  const employeeName = id => { const e = DB.get('employees', id); return e ? `${e.prenom} ${e.nom}`.trim() : '—'; };
  const activeClients = () => DB.all('clients').filter(c => !c.archive).sort(byName);
  const activeServices = () => DB.all('services').filter(s => s.actif).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const activeEmployees = () => DB.all('employees').filter(e => e.actif).sort(byName);

  function rdvConflicts(rdv) {
    const s = toMin(rdv.heure), e = s + num(rdv.duree || 30);
    return DB.all('rdv').filter(o =>
      o.id !== rdv.id && o.date === rdv.date && o.employeeId === rdv.employeeId &&
      !RDV_BLOCKING.includes(o.statut) &&
      toMin(o.heure) < e && toMin(o.heure) + num(o.duree || 30) > s
    ).sort((a, b) => a.heure.localeCompare(b.heure));
  }

  /* ---------- Graphiques (Chart.js, avec repli si indisponible) ---------- */
  const CHARTS = {};
  function makeChart(id, config) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!window.Chart) {
      el.parentElement.innerHTML = '<div class="chart-fallback">Graphique indisponible : connexion internet requise pour charger Chart.js.</div>';
      return;
    }
    if (CHARTS[id]) CHARTS[id].destroy();
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.color = '#6f6470';
    CHARTS[id] = new Chart(el, config);
  }
  const emptyChart = (id, msg) => {
    const el = document.getElementById(id);
    if (el) el.parentElement.innerHTML = `<div class="chart-fallback">${h(msg)}</div>`;
  };

  /* =========================================================
     TABLEAU DE BORD
     ========================================================= */
  PAGES.dashboard = {
    label: 'Tableau de bord', icon: '📊', roles: ['admin', 'receptionniste'],
    render(root) {
      const t = ymd();
      const wk = periodRange('semaine');
      const mo = periodRange('mois');
      const fJour = periodFinance(t, t);
      const fSem = periodFinance(wk.from, wk.to);
      const fMois = periodFinance(mo.from, mo.to);
      const rdvJour = DB.all('rdv').filter(r => r.date === t).sort((a, b) => a.heure.localeCompare(b.heure));
      const rdvProgrammes = rdvJour.filter(r => !RDV_BLOCKING.includes(r.statut)).length;
      const rdvAttente = DB.all('rdv').filter(r => r.statut === 'En attente' && r.date >= t).length;
      const produits = DB.all('produits');
      const ruptures = produits.filter(p => num(p.quantite) <= 0);
      const faibles = produits.filter(p => num(p.quantite) > 0 && num(p.quantite) <= num(p.seuil));
      const s = DB.settings();

      let alerts = '';
      if (ruptures.length) alerts += `<div class="alert">⚠ ${ruptures.length} produit(s) en rupture de stock : ${h(ruptures.map(p => p.nom).slice(0, 4).join(', '))}</div>`;
      if (faibles.length) alerts += `<div class="alert warn">Stock faible : ${h(faibles.map(p => p.nom).slice(0, 4).join(', '))}</div>`;
      if (s.joursFermeture.includes(parseYmd(t).getDay())) alerts += `<div class="alert info">Aujourd'hui est un jour de fermeture du salon.</div>`;

      root.innerHTML = `
        ${pageHead('Tableau de bord', fmtLongDate(t), `
          <button class="btn light" data-go="rdv">+ Rendez-vous</button>
          <button class="btn primary" data-go="caisse">Ouvrir la caisse</button>`)}
        ${alerts}
        <div class="kpi-grid">
          ${kpi("Chiffre d'affaires du jour", fmt(fJour.ca), `${fJour.txs.length} vente(s)`, 'accent')}
          ${kpi('Chiffre d\'affaires de la semaine', fmt(fSem.ca), `Du ${fmtDate(wk.from)} au ${fmtDate(wk.to)}`)}
          ${kpi('Chiffre d\'affaires du mois', fmt(fMois.ca), `Encaissé : ${fmt(fMois.encaisse)}`)}
          ${kpi('Clients reçus aujourd\'hui', fmtNum(fJour.nbClients), 'Clients distincts', 'info')}
          ${kpi('Rendez-vous programmés', fmtNum(rdvProgrammes), `Aujourd'hui (${rdvJour.length} au total)`, 'info')}
          ${kpi('Rendez-vous en attente', fmtNum(rdvAttente), 'À confirmer', 'warn')}
          ${kpi('Prestations réalisées', fmtNum(fJour.nbPrestations), "Aujourd'hui")}
          ${kpi('Total des dépenses', fmt(fMois.totalDepenses), 'Ce mois')}
          ${kpi('Bénéfice estimé', fmt(fMois.benefNet), 'Ce mois, après charges', fMois.benefNet >= 0 ? 'success' : 'danger')}
          ${kpi('Produits en rupture', fmtNum(ruptures.length), `${faibles.length} en stock faible`, ruptures.length ? 'danger' : 'success')}
        </div>

        <div class="grid-2">
          <div class="card"><div class="card-head"><h3>Évolution des recettes (30 jours)</h3></div>
            <div class="chart-box"><canvas id="ch-recettes"></canvas></div></div>
          <div class="card"><div class="card-head"><h3>Prestations les plus demandées (ce mois)</h3></div>
            <div class="chart-box"><canvas id="ch-prestations"></canvas></div></div>
          <div class="card"><div class="card-head"><h3>Jours les plus rentables (90 jours)</h3></div>
            <div class="chart-box"><canvas id="ch-jours"></canvas></div></div>
          <div class="card"><div class="card-head"><h3>Performances des coiffeurs (ce mois)</h3></div>
            <div class="chart-box"><canvas id="ch-employes"></canvas></div></div>
          <div class="card"><div class="card-head"><h3>Répartition des dépenses (ce mois)</h3></div>
            <div class="chart-box"><canvas id="ch-depenses"></canvas></div></div>
          <div class="card"><div class="card-head"><h3>Rendez-vous d'aujourd'hui</h3></div>
            ${rdvJour.length ? `<ul class="list-plain">${rdvJour.map(r => `
              <li><span><strong>${h(r.heure)}</strong> · ${h(clientName(r.clientId))}<br>
              <small class="muted">${h(serviceName(r.serviceId))} — ${h(employeeName(r.employeeId))}</small></span>
              ${badge(r.statut, STATUT_CLASS[r.statut])}</li>`).join('')}</ul>`
              : `<div class="empty">Aucun rendez-vous aujourd'hui.</div>`}</div>
        </div>

        <div class="card"><div class="card-head"><h3>Performances individuelles des coiffeurs (ce mois)</h3></div>
          ${performanceTable(mo.from, mo.to)}</div>`;

      root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.go === 'rdv') openRdvForm({ date: t });
        else location.hash = '#/' + b.dataset.go;
      }));

      drawDashboardCharts(t, fMois);
    }
  };

  function performanceTable(from, to) {
    const rows = DB.all('employees').filter(e => e.actif).sort(byName).map(e => {
      const st = employeeStats(e.id, from, to);
      return [h(`${e.prenom} ${e.nom}`), fmtNum(st.nb), fmt(st.ca), fmt(st.commissions), badge(ROLE_MODE[e.modeRemuneration])];
    });
    return table(['Coiffeur', 'Prestations', 'CA généré', 'Commissions', 'Rémunération'], rows, { empty: 'Aucun coiffeur actif.' });
  }
  const ROLE_MODE = { fixe: 'Salaire fixe', commission: 'Commission', mixte: 'Fixe + commission' };

  function drawDashboardCharts(t, fMois) {
    if (!window.Chart) {
      ['ch-recettes', 'ch-prestations', 'ch-jours', 'ch-employes', 'ch-depenses'].forEach(id => makeChart(id, {}));
      return;
    }
    // 1. Recettes des 30 derniers jours (encaissements)
    const days = [...Array(30)].map((_, i) => addDays(t, i - 29));
    const recettes = days.map(d => DB.all('transactions').filter(x => x.date === d).reduce((s, x) => s + num(x.montantPaye), 0));
    makeChart('ch-recettes', {
      type: 'line',
      data: { labels: days.map(d => d.slice(8) + '/' + d.slice(5, 7)), datasets: [{ label: 'Encaissements (FCFA)', data: recettes, borderColor: '#6b1d4f', backgroundColor: 'rgba(233,184,204,.35)', fill: true, tension: .35, pointRadius: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => fmtNum(v) } } } }
    });

    // 2. Prestations les plus demandées (ce mois)
    const counts = {};
    fMois.txs.forEach(tx => (tx.lignes || []).forEach(l => {
      if (l.type === 'prestation') counts[l.nom] = (counts[l.nom] || 0) + num(l.quantite);
    }));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (top.length) {
      makeChart('ch-prestations', {
        type: 'bar',
        data: { labels: top.map(x => x[0]), datasets: [{ label: 'Nombre', data: top.map(x => x[1]), backgroundColor: CHART_COLORS }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    } else emptyChart('ch-prestations', 'Aucune prestation ce mois-ci.');

    // 3. Jours les plus rentables (CA par jour de semaine, 90 derniers jours)
    const from = addDays(t, -89);
    const byWd = [0, 0, 0, 0, 0, 0, 0];
    DB.all('transactions').filter(x => x.date >= from && x.date <= t).forEach(x => {
      byWd[parseYmd(x.date).getDay()] += num(x.montantNet);
    });
    const order = [1, 2, 3, 4, 5, 6, 0];
    if (byWd.some(v => v > 0)) {
      makeChart('ch-jours', {
        type: 'bar',
        data: { labels: order.map(i => JOURS[i]), datasets: [{ label: 'CA (FCFA)', data: order.map(i => byWd[i]), backgroundColor: order.map(i => i === 6 || i === 0 ? '#e9b8cc' : '#6b1d4f'), borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => fmtNum(v) } } } }
      });
    } else emptyChart('ch-jours', 'Pas encore de ventes sur 90 jours.');

    // 4. Performances des coiffeurs (CA ce mois)
    const mo = periodRange('mois');
    const emp = DB.all('employees').filter(e => e.actif).sort(byName).map(e => ({ label: `${e.prenom} ${e.nom}`, ca: employeeStats(e.id, mo.from, mo.to).ca }));
    if (emp.length) {
      makeChart('ch-employes', {
        type: 'bar',
        data: { labels: emp.map(x => x.label), datasets: [{ label: 'CA généré (FCFA)', data: emp.map(x => x.ca), backgroundColor: '#b5487f', borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => fmtNum(v) } } } }
      });
    } else emptyChart('ch-employes', 'Aucun coiffeur actif.');

    // 5. Répartition des dépenses (ce mois)
    const cats = {};
    fMois.depenses.forEach(d => { cats[d.categorie] = (cats[d.categorie] || 0) + num(d.montant); });
    const catEntries = Object.entries(cats).filter(x => x[1] > 0);
    if (catEntries.length) {
      makeChart('ch-depenses', {
        type: 'doughnut',
        data: { labels: catEntries.map(x => x[0]), datasets: [{ data: catEntries.map(x => x[1]), backgroundColor: CHART_COLORS }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
      });
    } else emptyChart('ch-depenses', 'Aucune dépense ce mois-ci.');
  }

  /* =========================================================
     CAISSE (encaissement)
     ========================================================= */
  let POS = null;
  function newPos() { return { client: null, lines: [], reduction: 0, paiements: [], rdvId: null }; }

  /* Enregistre une transaction : recettes, stock, commissions et statut
     du rendez-vous sont mis à jour dans UNE seule écriture. */
  async function saveTransaction(input) {
    const lines = (input.lines || []).map(l => ({ ...l, quantite: Math.max(1, num(l.quantite)) }));
    if (!lines.length) throw new Error('Ajoutez au moins une prestation ou un produit.');

    const brut = lines.reduce((s, l) => s + num(l.quantite) * num(l.prixUnitaire), 0);
    const reduction = Math.min(Math.max(0, num(input.reduction)), brut);
    const net = brut - reduction;
    const paiements = (input.paiements || []).filter(p => num(p.montant) > 0).map(p => ({ mode: p.mode, montant: num(p.montant) }));
    const paye = paiements.reduce((s, p) => s + p.montant, 0);
    if (paye > net) throw new Error('Le montant payé dépasse le net à payer.');
    if (paye < net && !input.client) throw new Error('Pour un paiement partiel, sélectionnez un client afin de suivre le solde.');

    // Répartition de la réduction sur les lignes, pour que les commissions soient justes
    let allocated = 0;
    lines.forEach((l, i) => {
      const lb = num(l.quantite) * num(l.prixUnitaire);
      l.montantBrut = lb;
      const ln = brut > 0 ? (i === lines.length - 1 ? net - allocated : Math.round(lb * net / brut)) : 0;
      allocated += ln;
      l.montantNet = ln;
    });

    const ops = [];
    const stockBefore = {};
    for (const l of lines) {
      if (l.type === 'prestation') {
        const emp = DB.get('employees', l.employeeId);
        if (!emp) throw new Error(`Choisissez le coiffeur pour « ${l.nom} ».`);
        const variable = emp.modeRemuneration === 'commission' || emp.modeRemuneration === 'mixte';
        l.employeNom = `${emp.prenom} ${emp.nom}`.trim();
        l.tauxCommission = variable ? num(emp.tauxCommission) : 0;
        l.commission = Math.round(l.montantNet * l.tauxCommission / 100);
      } else if (l.type === 'produit') {
        const p = DB.get('produits', l.produitId);
        if (!p) throw new Error(`Produit introuvable : ${l.nom}.`);
        const dispo = num(stockBefore[p.id] ?? p.quantite);
        if (dispo < l.quantite) throw new Error(`Stock insuffisant pour « ${p.nom} » (disponible : ${fmtNum(dispo)}).`);
        stockBefore[p.id] = dispo - l.quantite;
        l.prixAchat = num(p.prixAchat);
        l.nom = p.nom;
      }
    }

    const numero = DB.nextNum('tx');
    const tx = {
      id: uid(),
      numero: 'TX-' + String(numero).padStart(6, '0'),
      date: ymd(), heure: nowTime(),
      clientId: input.client ? input.client.id : null,
      clientNom: input.client ? `${input.client.nom} ${input.client.prenom}`.trim() : 'Client de passage',
      lignes: lines,
      montantBrut: brut, reduction, montantNet: net,
      paiements, montantPaye: paye, solde: net - paye,
      modePaiement: paiements.length === 1 ? paiements[0].mode : (paiements.length ? 'Paiement mixte' : '—'),
      rdvId: input.rdvId || null
    };
    ops.push({ op: 'put', store: 'transactions', obj: tx });

    // Stock : sortie et mouvement pour chaque produit vendu
    lines.filter(l => l.type === 'produit').forEach(l => {
      const p = DB.get('produits', l.produitId);
      ops.push({ op: 'put', store: 'produits', obj: { ...p, quantite: num(p.quantite) - l.quantite } });
      ops.push({ op: 'put', store: 'mouvements_stock', obj: { id: uid(), produitId: p.id, type: 'vente', quantite: l.quantite, date: tx.date, note: `Vente ${tx.numero}`, transactionId: tx.id } });
    });

    // Rendez-vous : passe à « Terminé » et garde la référence de la transaction
    if (input.rdvId) {
      const r = DB.get('rdv', input.rdvId);
      if (r) ops.push({ op: 'put', store: 'rdv', obj: { ...r, statut: 'Terminé', transactionId: tx.id } });
    }

    ops.push(DB.saveSettingsOp());
    await DB.commit(ops);
    return tx;
  }

  /* Reçu imprimable */
  function receiptHtml(tx) {
    const s = DB.settings();
    const rows = tx.lignes.map(l => `<tr><td>${h(l.nom)}${l.employeNom ? `<br><span class="muted">${h(l.employeNom)}</span>` : ''}</td>
      <td class="right">${fmtNum(l.quantite)} x ${fmtNum(l.prixUnitaire)}</td><td class="right">${fmtNum(l.montantBrut)}</td></tr>`).join('');
    return `<div style="max-width:320px;margin:auto">
      <div class="center">${s.logo ? `<img src="${s.logo}" style="max-height:60px"><br>` : ''}
        <h2>${h(s.nom)}</h2>
        ${s.adresse ? `<div class="muted">${h(s.adresse)}</div>` : ''}
        ${s.telephone ? `<div class="muted">Tél : ${h(s.telephone)}</div>` : ''}
        ${s.email ? `<div class="muted">${h(s.email)}</div>` : ''}</div>
      <div class="line"></div>
      <div><strong>Reçu N° ${h(tx.numero)}</strong></div>
      <div>${fmtDate(tx.date)} à ${h(tx.heure)}</div>
      <div>Client : ${h(tx.clientNom)}</div>
      <table><thead><tr><th>Prestation / produit</th><th class="right">Qté x PU</th><th class="right">Montant</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="line"></div>
      <div>Montant brut : <span style="float:right">${fmt(tx.montantBrut)}</span></div>
      ${tx.reduction ? `<div>Réduction : <span style="float:right">- ${fmt(tx.reduction)}</span></div>` : ''}
      <div class="total">NET À PAYER : <span style="float:right">${fmt(tx.montantNet)}</span></div>
      ${tx.paiements.map(p => `<div>Payé (${h(p.mode)}) : <span style="float:right">${fmt(p.montant)}</span></div>`).join('')}
      ${tx.solde > 0 ? `<div><strong>Solde restant : <span style="float:right">${fmt(tx.solde)}</span></strong></div>` : ''}
      <div class="line"></div>
      <div class="center muted">${h(s.piedRecu)}</div>
    </div>`;
  }

  function receiptPdf(tx) {
    if (!window.jspdf) { toast('Export PDF indisponible : connexion internet requise.', 'err'); return; }
    const { jsPDF } = window.jspdf;
    const s = DB.settings();
    const H = 95 + tx.lignes.length * 9 + tx.paiements.length * 6 + (tx.solde > 0 ? 6 : 0);
    const doc = new jsPDF({ unit: 'mm', format: [80, H] });
    let y = 9;
    const center = (t, size = 9, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      doc.text(String(t), 40, y, { align: 'center' }); y += size * 0.5 + 1.5;
    };
    const row = (a, b, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8.5);
      doc.text(String(a), 4, y); doc.text(String(b), 76, y, { align: 'right' }); y += 4.8;
    };
    center(s.nom, 12, true);
    if (s.adresse) center(s.adresse, 8);
    if (s.telephone) center('Tél : ' + s.telephone, 8);
    y += 2; doc.line(4, y, 76, y); y += 5;
    row('Reçu N° ' + tx.numero, '', true);
    row(fmtDate(tx.date) + ' ' + tx.heure, '');
    row('Client : ' + tx.clientNom, '');
    doc.line(4, y, 76, y); y += 5;
    tx.lignes.forEach(l => {
      row(l.nom + (l.employeNom ? ' (' + l.employeNom + ')' : ''), fmtNum(l.montantBrut));
      row('   ' + fmtNum(l.quantite) + ' x ' + fmtNum(l.prixUnitaire), '');
    });
    doc.line(4, y, 76, y); y += 5;
    row('Montant brut', fmtNum(tx.montantBrut));
    if (tx.reduction) row('Réduction', '- ' + fmtNum(tx.reduction));
    row('NET A PAYER', fmtNum(tx.montantNet) + ' FCFA', true);
    tx.paiements.forEach(p => row('Payé (' + p.mode + ')', fmtNum(p.montant)));
    if (tx.solde > 0) row('Solde restant', fmtNum(tx.solde) + ' FCFA', true);
    doc.line(4, y, 76, y); y += 5;
    center(s.piedRecu, 8);
    doc.save(`recu-${tx.numero}.pdf`);
  }

  function showReceipt(tx, onDone) {
    openModal({
      title: 'Reçu ' + tx.numero,
      body: `<div class="receipt-preview">${receiptHtml(tx)}</div>`,
      footer: `<button class="btn ghost" id="rc-pdf">Télécharger PDF</button>
               <button class="btn light" id="rc-print">Imprimer</button>
               <button class="btn primary" id="rc-new">Nouvelle vente</button>`,
      wide: true,
      onMount: (el, close) => {
        el.querySelector('#rc-print').onclick = () => printHtml(receiptHtml(tx), 'Reçu ' + tx.numero);
        el.querySelector('#rc-pdf').onclick = () => receiptPdf(tx);
        el.querySelector('#rc-new').onclick = () => close();
      },
      onClose: () => { if (onDone) onDone(); }
    });
  }

  PAGES.caisse = {
    label: 'Caisse', icon: '💵', roles: ['admin', 'receptionniste'],
    render(root) {
      if (!POS) POS = newPos();
      /* Pré-remplissage depuis un rendez-vous */
      if (window.posPrefill) {
        const pf = window.posPrefill;
        window.posPrefill = null;
        POS = newPos();
        POS.rdvId = pf.rdvId || null;
        POS.client = pf.clientId ? DB.get('clients', pf.clientId) : null;
        const svc = pf.serviceId ? DB.get('services', pf.serviceId) : null;
        if (svc) POS.lines.push({ type: 'prestation', serviceId: svc.id, nom: svc.nom, employeeId: pf.employeeId || '', quantite: 1, prixUnitaire: num(svc.prix) });
      }
      const staff = activeEmployees();
      root.innerHTML = `
        ${pageHead('Caisse', 'Enregistrez les prestations, les produits et les paiements', `<button class="btn ghost" id="pos-reset">Vider le panier</button>`)}
        <div class="pos">
          <div>
            <div class="card"><div class="card-head"><h3>1. Client</h3></div><div id="pos-client"></div></div>
            <div class="card">
              <div class="card-head"><h3>2. Prestations</h3></div>
              <div class="field"><span>Coiffeur pour la prestation</span>
                <select class="select" id="pos-emp">${optionsList(staff.map(e => ({ value: e.id, label: `${e.prenom} ${e.nom}` })), '', { placeholder: staff.length ? '— Choisir un coiffeur —' : 'Aucun coiffeur actif' })}</select></div>
              <div class="search" style="margin-top:10px"><input class="input" id="pos-svc-q" placeholder="Rechercher une prestation..." autocomplete="off"></div>
              <div class="pick-list" id="pos-svc-list"></div>
            </div>
            <div class="card">
              <div class="card-head"><h3>3. Produits vendus</h3></div>
              <div class="search"><input class="input" id="pos-prod-q" placeholder="Rechercher un produit..." autocomplete="off"></div>
              <div class="pick-list" id="pos-prod-list"></div>
            </div>
          </div>
          <div>
            <div class="card pos-cart"><div class="card-head"><h3>Panier</h3><span id="pos-count" class="badge"></span></div>
              <div id="pos-lines"></div>
              <div class="divider"></div>
              <div class="total-line"><span>Montant brut</span><strong id="t-brut"></strong></div>
              <div class="total-line" style="align-items:center"><span>Réduction (FCFA)</span>
                <input class="input" id="pos-red" type="number" min="0" step="100" value="${POS.reduction || 0}" style="width:150px;text-align:right"></div>
              <div class="total-line big"><span>Net à payer</span><span id="t-net"></span></div>
            </div>
            <div class="card">
              <div class="card-head"><h3>4. Paiement</h3></div>
              <div class="form-grid">
                <label class="field"><span>Moyen de paiement</span><select class="select" id="pay-mode">${optionsList(PAY_MODES.map(m => ({ value: m, label: m })), 'Espèces')}</select></label>
                <label class="field"><span>Montant (FCFA)</span><input class="input" id="pay-amt" type="number" min="0" step="100"></label>
              </div>
              <div class="toolbar" style="margin:10px 0 0"><button class="btn light small" id="pay-add">+ Ajouter ce paiement</button>
                <button class="btn ghost small" id="pay-all">Tout payer avec ce moyen</button></div>
              <div id="pos-pays" style="margin-top:8px"></div>
              <div class="divider"></div>
              <div class="total-line"><span>Total payé</span><strong id="t-paye"></strong></div>
              <div class="total-line"><span>Solde restant</span><strong id="t-solde"></strong></div>
              <button class="btn primary block" id="pos-save" style="margin-top:12px;padding:.8rem">Enregistrer l'encaissement</button>
            </div>
          </div>
        </div>`;
      drawPos(root);

      root.querySelector('#pos-reset').onclick = () => { POS = newPos(); App.refresh(); };
      root.querySelector('#pos-red').addEventListener('input', e => { POS.reduction = Math.max(0, num(e.target.value)); drawTotals(root); });
      root.querySelector('#pos-svc-q').addEventListener('input', () => drawServices(root));
      root.querySelector('#pos-prod-q').addEventListener('input', () => drawProducts(root));
      root.querySelector('#pos-emp').addEventListener('change', () => drawServices(root));
      root.querySelector('#pay-add').onclick = () => addPayment(root, false);
      root.querySelector('#pay-all').onclick = () => addPayment(root, true);
      root.querySelector('#pos-save').onclick = () => submitPos(root);
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-pos]');
        if (!b) return;
        const a = b.dataset.pos;
        const i = Number(b.dataset.i);
        if (a === 'qty') { const l = POS.lines[i]; l.quantite = Math.max(1, num(l.quantite) + num(b.dataset.d)); if (l.type === 'produit') checkStockLimit(l); drawPos(root); }
        if (a === 'del') { POS.lines.splice(i, 1); drawPos(root); }
        if (a === 'pay-del') { POS.paiements.splice(i, 1); drawPos(root); }
        if (a === 'client-clear') { POS.client = null; drawPos(root); }
        if (a === 'client-pick') { POS.client = DB.get('clients', b.dataset.id); drawPos(root); }
        if (a === 'svc-add') addService(root, b.dataset.id);
        if (a === 'prod-add') addProduct(root, b.dataset.id);
        if (a === 'client-new') openClientForm({ onSaved: c => { POS.client = c; drawPos(root); } });
      });
    }
  };

  function checkStockLimit(l) {
    const p = DB.get('produits', l.produitId);
    if (p && l.quantite > num(p.quantite)) { l.quantite = num(p.quantite); toast(`Stock disponible : ${fmtNum(p.quantite)}`, 'warn'); }
  }

  function drawPos(root) {
    drawClient(root);
    drawServices(root);
    drawProducts(root);
    drawLines(root);
    drawTotals(root);
    drawPayments(root);
  }

  function drawClient(root) {
    const box = root.querySelector('#pos-client');
    if (POS.client) {
      const st = clientStats(POS.client.id);
      box.innerHTML = `<div class="client-chip"><div><strong>${h(POS.client.nom)} ${h(POS.client.prenom)}</strong>
        <div class="small muted">${h(POS.client.telephone || 'Sans téléphone')} · ${st.visites} visite(s) · ${fmt(st.total)} dépensés</div></div>
        <button class="btn ghost small" data-pos="client-clear">Changer</button></div>`;
      return;
    }
    box.innerHTML = `<div class="search"><input class="input" id="pos-cli-q" placeholder="Nom ou téléphone du client..." autocomplete="off" value="${h(POS.cliQuery || '')}"></div>
      <div class="pick-list" id="pos-cli-list"></div>
      <div class="toolbar" style="margin:10px 0 0"><button class="btn light small" data-pos="client-new">+ Nouveau client</button>
      <span class="small muted">Sans client : « client de passage » (paiement total uniquement).</span></div>`;
    const input = box.querySelector('#pos-cli-q');
    const list = box.querySelector('#pos-cli-list');
    const draw = () => {
      POS.cliQuery = input.value;
      const q = input.value.trim().toLowerCase();
      const found = activeClients().filter(c => !q || (c.nom + ' ' + c.prenom + ' ' + c.telephone).toLowerCase().includes(q)).slice(0, q ? 8 : 4);
      list.innerHTML = found.length ? found.map(c => `<button class="pick-item" data-pos="client-pick" data-id="${h(c.id)}">
        <span><strong>${h(c.nom)} ${h(c.prenom)}</strong><small>${h(c.telephone || '')}</small></span></button>`).join('')
        : `<div class="empty small">Aucun client trouvé.</div>`;
    };
    input.addEventListener('input', draw);
    draw();
  }

  function drawServices(root) {
    const q = root.querySelector('#pos-svc-q').value.trim().toLowerCase();
    const list = root.querySelector('#pos-svc-list');
    const items = activeServices().filter(s => !q || (s.nom + ' ' + s.categorie).toLowerCase().includes(q));
    list.innerHTML = items.length ? items.map(s => `<button class="pick-item" data-pos="svc-add" data-id="${h(s.id)}">
      <span><strong>${h(s.nom)}</strong><small>${h(s.categorie)} · ${fmtNum(s.duree)} min</small></span><strong>${fmt(s.prix)}</strong></button>`).join('')
      : `<div class="empty small">Aucune prestation active. Ajoutez-les dans le module Prestations.</div>`;
  }

  function drawProducts(root) {
    const q = root.querySelector('#pos-prod-q').value.trim().toLowerCase();
    const list = root.querySelector('#pos-prod-list');
    const items = DB.all('produits').filter(p => num(p.quantite) > 0 && (!q || (p.nom + ' ' + p.categorie).toLowerCase().includes(q))).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    list.innerHTML = items.length ? items.map(p => `<button class="pick-item" data-pos="prod-add" data-id="${h(p.id)}">
      <span><strong>${h(p.nom)}</strong><small>En stock : ${fmtNum(p.quantite)}</small></span><strong>${fmt(p.prixVente)}</strong></button>`).join('')
      : `<div class="empty small">Aucun produit disponible en stock.</div>`;
  }

  function addService(root, serviceId) {
    const empId = root.querySelector('#pos-emp').value;
    if (!empId) { toast('Choisissez d\'abord le coiffeur.', 'warn'); return; }
    const s = DB.get('services', serviceId);
    if (!s) return;
    const existing = POS.lines.find(l => l.type === 'prestation' && l.serviceId === serviceId && l.employeeId === empId);
    if (existing) existing.quantite += 1;
    else POS.lines.push({ type: 'prestation', serviceId, nom: s.nom, employeeId: empId, quantite: 1, prixUnitaire: num(s.prix) });
    drawPos(root);
  }

  function addProduct(root, productId) {
    const p = DB.get('produits', productId);
    if (!p) return;
    const existing = POS.lines.find(l => l.type === 'produit' && l.produitId === productId);
    if (existing) {
      if (existing.quantite + 1 > num(p.quantite)) { toast(`Stock insuffisant (disponible : ${fmtNum(p.quantite)}).`, 'warn'); return; }
      existing.quantite += 1;
    } else {
      POS.lines.push({ type: 'produit', produitId: p.id, nom: p.nom, quantite: 1, prixUnitaire: num(p.prixVente), prixAchat: num(p.prixAchat) });
    }
    drawPos(root);
  }

  function drawLines(root) {
    const box = root.querySelector('#pos-lines');
    root.querySelector('#pos-count').textContent = POS.lines.length + ' ligne(s)';
    if (!POS.lines.length) { box.innerHTML = `<div class="empty small">Le panier est vide. Choisissez une prestation ou un produit.</div>`; return; }
    box.innerHTML = POS.lines.map((l, i) => `
      <div class="cart-line">
        <div><strong>${h(l.nom)}</strong><br><small>${l.type === 'prestation' ? '✂ ' + h(employeeName(l.employeeId)) : '🧴 Produit'} · ${fmt(l.prixUnitaire)} l'unité</small></div>
        <div class="right-col" style="text-align:right"><strong>${fmt(num(l.quantite) * num(l.prixUnitaire))}</strong></div>
        <div class="actions-cell" style="grid-column:1 / span 2">
          <button class="btn ghost small" data-pos="qty" data-d="-1" data-i="${i}" aria-label="Diminuer">−</button>
          <span style="min-width:28px;text-align:center;font-weight:700">${fmtNum(l.quantite)}</span>
          <button class="btn ghost small" data-pos="qty" data-d="1" data-i="${i}" aria-label="Augmenter">+</button>
          <button class="link-btn danger-link" data-pos="del" data-i="${i}">Retirer</button>
        </div>
      </div>`).join('');
  }

  function posTotals() {
    const brut = POS.lines.reduce((s, l) => s + num(l.quantite) * num(l.prixUnitaire), 0);
    const reduction = Math.min(POS.reduction, brut);
    const net = brut - reduction;
    const paye = POS.paiements.reduce((s, p) => s + num(p.montant), 0);
    return { brut, reduction, net, paye, solde: net - paye };
  }

  function drawTotals(root) {
    const t = posTotals();
    root.querySelector('#t-brut').textContent = fmt(t.brut);
    root.querySelector('#t-net').textContent = fmt(t.net);
    root.querySelector('#t-paye').textContent = fmt(t.paye);
    const solde = root.querySelector('#t-solde');
    solde.textContent = fmt(Math.max(0, t.solde));
    solde.className = t.solde > 0 ? 'error' : '';
    const amt = root.querySelector('#pay-amt');
    if (amt && !amt.value) amt.value = Math.max(0, t.solde);
  }

  function drawPayments(root) {
    const box = root.querySelector('#pos-pays');
    box.innerHTML = POS.paiements.length ? `<ul class="list-plain">${POS.paiements.map((p, i) => `
      <li><span>${h(p.mode)}</span><span><strong>${fmt(p.montant)}</strong>
      <button class="link-btn danger-link" data-pos="pay-del" data-i="${i}" style="margin-left:10px">✕</button></span></li>`).join('')}</ul>`
      : `<div class="small muted">Aucun paiement saisi.</div>`;
  }

  function addPayment(root, all) {
    const t = posTotals();
    const mode = root.querySelector('#pay-mode').value;
    if (all) {
      POS.paiements = [{ mode, montant: t.net }];
    } else {
      const montant = num(root.querySelector('#pay-amt').value);
      if (montant <= 0) { toast('Saisissez un montant supérieur à 0.', 'warn'); return; }
      if (t.paye + montant > t.net) { toast('Le total payé dépasserait le net à payer.', 'err'); return; }
      POS.paiements.push({ mode, montant });
    }
    root.querySelector('#pay-amt').value = '';
    drawPos(root);
  }

  async function submitPos(root) {
    const t = posTotals();
    if (!POS.lines.length) { toast('Ajoutez au moins une prestation ou un produit.', 'warn'); return; }
    if (POS.lines.some(l => l.type === 'prestation' && !l.employeeId)) { toast('Chaque prestation doit avoir un coiffeur.', 'err'); return; }
    if (t.paye < t.net && !POS.client) { toast('Paiement partiel : sélectionnez un client pour suivre le solde.', 'err'); return; }
    if (t.paye === 0 && t.net > 0 && !POS.client) { toast('Indiquez le paiement.', 'warn'); return; }
    const btn = root.querySelector('#pos-save');
    btn.disabled = true;
    try {
      const tx = await saveTransaction({ client: POS.client, lines: POS.lines, reduction: POS.reduction, paiements: POS.paiements, rdvId: POS.rdvId });
      toast(`Encaissement ${tx.numero} enregistré.`);
      POS = newPos();
      showReceipt(tx, () => App.refresh());
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
    }
  }

  /* =========================================================
     RENDEZ-VOUS (calendrier)
     ========================================================= */
  const RDV = { view: 'semaine', cursor: null, emp: 'all' };

  function rdvFor(date) {
    return DB.all('rdv')
      .filter(r => r.date === date && (RDV.emp === 'all' || r.employeeId === RDV.emp))
      .sort((a, b) => a.heure.localeCompare(b.heure));
  }
  const statutClassRdv = s => ({ 'Confirmé': 'info', 'En attente': 'warn', 'En cours': 'ok', 'Terminé': 'done', 'Annulé': 'cancel', 'Client absent': 'cancel' }[s] || '');
  const chipLabel = r => `${r.heure} ${clientName(r.clientId)}`;

  PAGES.rdv = {
    label: 'Rendez-vous', icon: '📅', roles: ['admin', 'receptionniste', 'coiffeur'],
    render(root, user) {
      if (!RDV.cursor) RDV.cursor = ymd();
      if (user.role === 'coiffeur') RDV.emp = user.employeeId || '__none__';
      const staffFilter = user.role === 'coiffeur' ? '' : `
        <select class="select" id="rdv-emp" style="width:auto">
          <option value="all">Tous les coiffeurs</option>
          ${activeEmployees().map(e => `<option value="${h(e.id)}" ${RDV.emp === e.id ? 'selected' : ''}>${h(e.prenom + ' ' + e.nom)}</option>`).join('')}
        </select>`;
      root.innerHTML = `
        ${pageHead('Rendez-vous', 'Planning du salon', `<button class="btn primary" id="rdv-new">+ Nouveau rendez-vous</button>`)}
        <div class="toolbar">
          <div class="seg" role="tablist">
            ${['jour', 'semaine', 'mois'].map(v => `<button data-view="${v}" class="${RDV.view === v ? 'on' : ''}">${v === 'jour' ? 'Jour' : v === 'semaine' ? 'Semaine' : 'Mois'}</button>`).join('')}
          </div>
          <div class="cal-nav">
            <button class="icon-btn" data-nav="-1" aria-label="Précédent">‹</button>
            <span class="cal-title" id="cal-title"></span>
            <button class="icon-btn" data-nav="1" aria-label="Suivant">›</button>
            <button class="btn ghost small" data-nav="0">Aujourd'hui</button>
          </div>
          ${staffFilter}
        </div>
        <div id="cal-body"></div>`;

      const body = root.querySelector('#cal-body');
      const title = root.querySelector('#cal-title');
      const draw = () => {
        if (RDV.view === 'jour') drawDay(body, title);
        else if (RDV.view === 'semaine') drawWeek(body, title);
        else drawMonth(body, title);
      };
      draw();

      root.querySelector('#rdv-new').onclick = () => openRdvForm({ date: RDV.cursor });
      root.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { RDV.view = b.dataset.view; App.refresh(); });
      root.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
        const n = Number(b.dataset.nav);
        if (n === 0) RDV.cursor = ymd();
        else if (RDV.view === 'jour') RDV.cursor = addDays(RDV.cursor, n);
        else if (RDV.view === 'semaine') RDV.cursor = addDays(RDV.cursor, n * 7);
        else { const d = parseYmd(RDV.cursor); d.setMonth(d.getMonth() + n); RDV.cursor = ymd(d); }
        App.refresh();
      });
      const empSel = root.querySelector('#rdv-emp');
      if (empSel) empSel.onchange = () => { RDV.emp = empSel.value; App.refresh(); };

      /* Délégation des clics sur les rendez-vous et les cases */
      root.addEventListener('click', e => {
        const chip = e.target.closest('[data-rdv]');
        if (chip) { openRdvDetail(chip.dataset.rdv); return; }
        const add = e.target.closest('[data-add]');
        if (add) { openRdvForm({ date: add.dataset.add }); return; }
        const goDay = e.target.closest('[data-goday]');
        if (goDay) { RDV.cursor = goDay.dataset.goday; RDV.view = 'jour'; App.refresh(); }
        const st = e.target.closest('[data-statut]');
        if (st) setStatut(st.dataset.id, st.dataset.statut);
        const enc = e.target.closest('[data-encaisser]');
        if (enc) encaisserRdv(enc.dataset.encaisser);
        const edit = e.target.closest('[data-edit]');
        if (edit) openRdvForm({ rdv: DB.get('rdv', edit.dataset.edit) });
        const del = e.target.closest('[data-del]');
        if (del) deleteRdv(del.dataset.del);
      });
      root.addEventListener('change', e => {
        if (e.target.matches('[data-statut-select]')) setStatut(e.target.dataset.statutSelect, e.target.value);
      });
    }
  };

  function drawDay(body, title) {
    title.textContent = fmtLongDate(RDV.cursor);
    const list = rdvFor(RDV.cursor);
    body.innerHTML = list.length ? `<div class="day-list">${list.map(r => rdvRow(r)).join('')}</div>`
      : `<div class="empty">Aucun rendez-vous ce jour.</div>`;
  }

  function rdvRow(r) {
    const conflicts = rdvConflicts(r);
    const cls = statutClassRdv(r.statut);
    const finished = r.statut === 'Terminé' || RDV_BLOCKING.includes(r.statut);
    return `<div class="day-row ${cls === 'cancel' ? 'cancel' : cls === 'done' ? 'done' : cls === 'info' ? 'info' : cls === 'ok' ? 'ok' : cls === 'warn' ? 'warn' : ''}">
      <div class="time">${h(r.heure)}<br><small class="muted">${fmtNum(r.duree)} min</small></div>
      <div class="rdv-info">
        <strong>${h(clientName(r.clientId))}</strong>
        <span>${h(serviceName(r.serviceId))} — ${h(employeeName(r.employeeId))}</span>
        <div class="row-between" style="justify-content:flex-start;gap:.5rem">${badge(r.statut, STATUT_CLASS[r.statut])}
          ${conflicts.length ? badge('⚠ Conflit horaire', 'danger') : ''}</div>
        ${r.note ? `<span class="small muted">${h(r.note)}</span>` : ''}
        <div class="rdv-actions">
          <select class="select small-select" data-statut-select="${h(r.id)}" style="width:auto;min-height:34px;padding:.3rem .5rem;font-size:.85rem">
            ${RDV_STATUTS.map(s => `<option ${s === r.statut ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          ${!finished && !r.transactionId ? `<button class="btn success small" data-encaisser="${h(r.id)}">Encaisser</button>` : ''}
          <button class="btn ghost small" data-edit="${h(r.id)}">Modifier</button>
          <button class="btn ghost small" data-del="${h(r.id)}">Supprimer</button>
        </div>
      </div></div>`;
  }

  function chipHtml(r) {
    const cls = statutClassRdv(r.statut);
    return `<button class="rdv-chip ${cls}" data-rdv="${h(r.id)}" title="${h(chipLabel(r) + ' · ' + serviceName(r.serviceId))}">${h(r.heure)} ${h(clientName(r.clientId))}</button>`;
  }

  function drawWeek(body, title) {
    const start = startOfWeek(RDV.cursor);
    const end = addDays(start, 6);
    title.textContent = `${fmtDate(start)} — ${fmtDate(end)}`;
    const t = ymd();
    let html = '<div class="cal-week">';
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const list = rdvFor(d);
      const closed = DB.settings().joursFermeture.includes(parseYmd(d).getDay());
      html += `<div class="cal-col ${d === t ? 'today' : ''}">
        <div class="cal-head"><span>${JOURS[parseYmd(d).getDay()].slice(0, 3)}</span><b>${parseYmd(d).getDate()}</b></div>
        ${closed ? '<span class="badge muted">Fermé</span>' : ''}
        ${list.map(chipHtml).join('')}
        <button class="link-btn small" data-add="${d}" style="margin-top:4px">+ Ajouter</button>
      </div>`;
    }
    body.innerHTML = html + '</div>';
  }

  function drawMonth(body, title) {
    const d0 = parseYmd(RDV.cursor);
    const first = ymd(new Date(d0.getFullYear(), d0.getMonth(), 1));
    const last = monthEnd(RDV.cursor);
    title.textContent = MOIS[d0.getMonth()] + ' ' + d0.getFullYear();
    const gridStart = startOfWeek(first);
    const gridEnd = addDays(startOfWeek(last), 6);
    const t = ymd();
    let html = '<div class="cal-month">' + ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(x => `<div class="cal-head-row">${x}</div>`).join('');
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      const list = rdvFor(d);
      const other = d.slice(0, 7) !== first.slice(0, 7);
      html += `<div class="cal-cell ${d === t ? 'today' : ''} ${other ? 'other' : ''}">
        <div class="cal-head"><b>${parseYmd(d).getDate()}</b>${list.length ? `<span class="badge info">${list.length}</span>` : ''}</div>
        ${list.slice(0, 3).map(chipHtml).join('')}
        ${list.length > 3 ? `<button class="link-btn small" data-goday="${d}">+${list.length - 3} autre(s)</button>` : ''}
        ${!list.length ? `<button class="link-btn small" data-add="${d}">+</button>` : ''}
      </div>`;
    }
    body.innerHTML = html + '</div>';
  }

  function openRdvDetail(id) {
    const r = DB.get('rdv', id);
    if (!r) return;
    openRdvForm({ rdv: r });
  }

  function setStatut(id, statut) {
    const r = DB.get('rdv', id);
    if (!r || r.statut === statut) return;
    DB.put('rdv', { ...r, statut }).then(() => { toast(`Statut : ${statut}`); App.refresh(); })
      .catch(err => toast(err.message, 'err'));
  }

  function deleteRdv(id) {
    const r = DB.get('rdv', id);
    if (!r) return;
    confirmBox(`Supprimer le rendez-vous de ${clientName(r.clientId)} le ${fmtDate(r.date)} à ${r.heure} ?`, { okLabel: 'Supprimer' })
      .then(ok => {
        if (!ok) return;
        DB.commit([{ op: 'del', store: 'rdv', id }, DB.logOp('Suppression rendez-vous', `${clientName(r.clientId)} — ${fmtDate(r.date)} ${r.heure}`, App.user)])
          .then(() => { toast('Rendez-vous supprimé.'); App.refresh(); });
      });
  }

  function encaisserRdv(id) {
    const r = DB.get('rdv', id);
    if (!r) return;
    window.posPrefill = { rdvId: r.id, clientId: r.clientId, serviceId: r.serviceId, employeeId: r.employeeId };
    location.hash = '#/caisse';
  }

  /* Formulaire de rendez-vous (création et modification) */
  function openRdvForm({ rdv = null, date = null } = {}) {
    const isEdit = !!rdv;
    const data = rdv || { date: date || RDV.cursor, heure: '09:00', duree: DB.settings().dureeRdvDefaut, statut: 'Confirmé', clientId: '', serviceId: '', employeeId: App.user.role === 'coiffeur' ? App.user.employeeId : '', note: '' };
    const clients = activeClients();
    const services = activeServices();
    const staff = activeEmployees();
    const svcOptions = services.map(s => `<option value="${h(s.id)}" data-duree="${num(s.duree)}" ${s.id === data.serviceId ? 'selected' : ''}>${h(s.nom)} — ${fmt(s.prix)}</option>`).join('');
    const body = `<form id="rdv-form" class="form-grid">
      ${field('Client', `<select class="select" name="clientId" required>${optionsList(clients.map(c => ({ value: c.id, label: `${c.nom} ${c.prenom} ${c.telephone ? '· ' + c.telephone : ''}` })), data.clientId, { placeholder: '— Choisir un client —' })}</select>`, clients.length ? '' : 'Ajoutez d\'abord un client.')}
      ${field('Prestation', `<select class="select" name="serviceId" id="rdv-svc" required><option value="">— Choisir —</option>${svcOptions}</select>`)}
      ${field('Coiffeur', `<select class="select" name="employeeId" required ${App.user.role === 'coiffeur' ? 'disabled' : ''}>${optionsList(staff.map(e => ({ value: e.id, label: `${e.prenom} ${e.nom}` })), data.employeeId, { placeholder: '— Choisir —' })}</select>`)}
      ${field('Statut', `<select class="select" name="statut">${RDV_STATUTS.map(s => `<option ${s === data.statut ? 'selected' : ''}>${s}</option>`).join('')}</select>`)}
      ${field('Date', `<input class="input" type="date" name="date" value="${h(data.date)}" required>`)}
      ${field('Heure', `<input class="input" type="time" name="heure" value="${h(data.heure)}" required>`)}
      ${field('Durée (minutes)', `<input class="input" type="number" min="5" step="5" name="duree" id="rdv-duree" value="${h(data.duree)}" required>`)}
      <div class="span-2">${field('Note', `<textarea class="textarea" name="note" rows="2">${h(data.note || '')}</textarea>`)}</div>
      <div class="span-2"><div id="rdv-alert"></div></div>
    </form>`;
    openModal({
      title: isEdit ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous',
      body,
      footer: `${isEdit ? '<button class="btn danger small" id="rdv-del">Supprimer</button>' : ''}
        <button class="btn ghost" data-close>Annuler</button>
        <button class="btn primary" id="rdv-save" form="rdv-form" type="submit">Enregistrer</button>`,
      onMount: (el, close) => {
        const form = el.querySelector('#rdv-form');
        el.querySelector('#rdv-svc').addEventListener('change', e => {
          const opt = e.target.selectedOptions[0];
          if (opt && opt.dataset.duree) el.querySelector('#rdv-duree').value = opt.dataset.duree;
        });
        const coiffeurSel = form.querySelector('[name=employeeId]');
        if (App.user.role === 'coiffeur') coiffeurSel.value = App.user.employeeId || '';
        if (isEdit) el.querySelector('#rdv-del').onclick = () => { close(); deleteRdv(rdv.id); };

        const checkConflicts = () => {
          const f = formData(form);
          const preview = { id: rdv ? rdv.id : '__new', date: f.date, heure: f.heure, duree: num(f.duree), employeeId: f.employeeId };
          const c = !RDV_BLOCKING.includes(f.statut) && f.employeeId && f.date && f.heure ? rdvConflicts(preview) : [];
          el.querySelector('#rdv-alert').innerHTML = c.length
            ? `<div class="alert">⚠ Conflit : ${h(employeeName(f.employeeId))} a déjà ${c.length} rendez-vous sur ce créneau (${c.map(x => x.heure + ' ' + clientName(x.clientId)).join(', ')}).</div>` : '';
        };
        form.addEventListener('input', checkConflicts);
        form.addEventListener('change', checkConflicts);
        checkConflicts();

        form.addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(form);
          const emp = App.user.role === 'coiffeur' ? App.user.employeeId : f.employeeId;
          if (!f.clientId || !f.serviceId || !emp) { toast('Complétez le client, la prestation et le coiffeur.', 'err'); return; }
          const obj = {
            id: rdv ? rdv.id : uid(), date: f.date, heure: f.heure, duree: num(f.duree) || 30,
            clientId: f.clientId, serviceId: f.serviceId, employeeId: emp, statut: f.statut, note: f.note || '',
            transactionId: rdv ? rdv.transactionId || null : null
          };
          const conflits = !RDV_BLOCKING.includes(obj.statut) ? rdvConflicts(obj) : [];
          const dayClosed = DB.settings().joursFermeture.includes(parseYmd(obj.date).getDay());
          if (dayClosed && !(await confirmBox('Ce jour est un jour de fermeture du salon. Enregistrer quand même ?', { okLabel: 'Oui, enregistrer', danger: false }))) return;
          if (conflits.length && !(await confirmBox(`Conflit d'horaire avec ${conflits.length} rendez-vous de ${employeeName(emp)}. Enregistrer quand même ?`, { okLabel: 'Enregistrer malgré le conflit' }))) return;
          try {
            await DB.put('rdv', obj);
            toast(isEdit ? 'Rendez-vous modifié.' : 'Rendez-vous enregistré.');
            close();
            RDV.cursor = obj.date;
            App.refresh();
          } catch (err) { toast(err.message, 'err'); }
        });
      }
    });
  }

  /* Exposition pour les autres modules */
  window.saveTransaction = saveTransaction;
  window.receiptHtml = receiptHtml;
  window.rdvConflicts = rdvConflicts;
  window.clientName = clientName;
  window.serviceName = serviceName;
  window.employeeName = employeeName;
  window.activeClients = activeClients;
  window.activeServices = activeServices;
  window.activeEmployees = activeEmployees;
  window.RDV_STATUTS = RDV_STATUTS;
  window.STATUT_CLASS = STATUT_CLASS;
  window.makeChart = makeChart;
  window.emptyChart = emptyChart;
  window.CHART_COLORS = CHART_COLORS;
  window.ROLE_MODE = ROLE_MODE;
  window.showReceipt = showReceipt;
  window.receiptPdf = receiptPdf;
})();
