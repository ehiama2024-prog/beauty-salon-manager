/* =========================================================
   BEAUTY SALON MANAGER — pages : clients, prestations,
   personnel, stock, dépenses, finances, rapports, paramètres,
   journal, espace coiffeur. Dépend de core.js, db.js, pages-a.js.
   ========================================================= */
(function () {
  const FIDELE_VISITES = 5;      // au moins 5 visites = client fidèle
  const INACTIF_JOURS = 60;      // pas revenu depuis plus de 60 jours
  const CATEGORIES_PRESTATIONS = ['Coiffure homme', 'Coiffure femme', 'Tresses et nattes', 'Défrisage et coloration', 'Soins capillaires', 'Brushing et finitions', 'Ongles', 'Autre'];
  const PRESTATIONS_TYPES = ['Coupe homme', 'Coupe femme', 'Tresses africaines', 'Nattes collées', 'Pose de perruque', 'Défrisage', 'Coloration', 'Brushing', 'Shampooing', 'Soins capillaires', 'Manucure', 'Pédicure'];

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  const todayStr = () => ymd();
  const sortByName = (a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, 'fr');
  const phoneClean = p => String(p || '').replace(/[\s.\-]/g, '');

  /* =========================================================
     CLIENTS
     ========================================================= */
  const CLI = { q: '', filtre: 'actifs' };

  function clientStatus(c) {
    if (c.archive) return { label: 'Archivé', cls: 'muted' };
    const st = clientStats(c.id);
    if (st.visites >= FIDELE_VISITES) return { label: 'Fidèle', cls: 'ok' };
    if (st.derniere && diffDays(st.derniere, todayStr()) > INACTIF_JOURS) return { label: 'Inactif', cls: 'warn' };
    if (!st.visites) return { label: 'Nouveau', cls: 'info' };
    return { label: 'Régulier', cls: 'accent' };
  }

  PAGES.clients = {
    label: 'Clients', icon: '👥', roles: ['admin', 'receptionniste'],
    render(root, user) {
      const all = DB.all('clients');
      const isAdmin = user.role === 'admin';
      root.innerHTML = `
        ${pageHead('Clients', 'Fiches clients, historique et fidélisation', `<button class="btn primary" id="cli-new">+ Nouveau client</button>`)}
        <div class="kpi-grid" id="cli-kpi"></div>
        <div class="toolbar">
          <div class="search"><input class="input" id="cli-q" placeholder="Rechercher par nom ou téléphone..." value="${h(CLI.q)}" autocomplete="off"></div>
          <select class="select" id="cli-f">
            <option value="actifs" ${CLI.filtre === 'actifs' ? 'selected' : ''}>Clients actifs</option>
            <option value="tous" ${CLI.filtre === 'tous' ? 'selected' : ''}>Tous (y compris archivés)</option>
            <option value="fideles" ${CLI.filtre === 'fideles' ? 'selected' : ''}>Clients fidèles</option>
            <option value="inactifs" ${CLI.filtre === 'inactifs' ? 'selected' : ''}>Clients non revenus depuis ${INACTIF_JOURS} jours</option>
            <option value="archives" ${CLI.filtre === 'archives' ? 'selected' : ''}>Archivés</option>
          </select>
        </div>
        <div id="cli-list"></div>`;

      const kpis = root.querySelector('#cli-kpi');
      const actifs = all.filter(c => !c.archive);
      const fideles = actifs.filter(c => clientStats(c.id).visites >= FIDELE_VISITES).length;
      const inactifs = actifs.filter(c => { const s = clientStats(c.id); return s.derniere && diffDays(s.derniere, todayStr()) > INACTIF_JOURS; }).length;
      kpis.innerHTML = kpi('Clients actifs', fmtNum(actifs.length), 'Fiches enregistrées', 'accent') +
        kpi('Clients fidèles', fmtNum(fideles), `${FIDELE_VISITES} visites ou plus`, 'success') +
        kpi('À relancer', fmtNum(inactifs), `Pas revenus depuis ${INACTIF_JOURS} jours`, 'warn') +
        kpi('Archivés', fmtNum(all.length - actifs.length), 'Conservés pour l\'historique');

      const list = root.querySelector('#cli-list');
      const draw = () => {
        const q = CLI.q.trim().toLowerCase();
        let items = all.filter(c => {
          const txt = `${c.nom} ${c.prenom} ${phoneClean(c.telephone)} ${c.code || ''}`.toLowerCase();
          return !q || txt.includes(q) || (q.replace(/\s/g, '').length > 3 && phoneClean(c.telephone).includes(q.replace(/\s/g, '')));
        });
        items = items.filter(c => {
          const st = clientStats(c.id);
          switch (CLI.filtre) {
            case 'actifs': return !c.archive;
            case 'archives': return !!c.archive;
            case 'fideles': return !c.archive && st.visites >= FIDELE_VISITES;
            case 'inactifs': return !c.archive && st.derniere && diffDays(st.derniere, todayStr()) > INACTIF_JOURS;
            default: return true;
          }
        }).sort(sortByName);
        list.innerHTML = table(
          ['Code', 'Client', 'Téléphone', 'Première visite', 'Dernière visite', 'Visites', 'Total dépensé', 'Statut', 'Actions'],
          items.map(c => {
            const st = clientStats(c.id);
            const stat = clientStatus(c);
            return [
              `<span class="muted small">${h(c.code || '')}</span>`,
              `<strong>${h(c.nom)} ${h(c.prenom)}</strong>${c.observations ? `<br><small class="muted">${h(c.observations).slice(0, 60)}</small>` : ''}`,
              h(c.telephone || '—'),
              fmtDate(st.premiere),
              fmtDate(st.derniere),
              fmtNum(st.visites),
              `<span class="num">${fmt(st.total)}</span>`,
              badge(stat.label, stat.cls),
              `<div class="actions-cell">
                <button class="link-btn" data-act="hist" data-id="${h(c.id)}">Historique</button>
                <button class="link-btn" data-act="edit" data-id="${h(c.id)}">Modifier</button>
                ${c.archive ? `<button class="link-btn" data-act="unarchive" data-id="${h(c.id)}">Réactiver</button>`
                  : `<button class="link-btn" data-act="archive" data-id="${h(c.id)}">Archiver</button>`}
                ${isAdmin ? `<button class="link-btn danger-link" data-act="del" data-id="${h(c.id)}">Supprimer</button>` : ''}
              </div>`
            ];
          }), { empty: 'Aucun client ne correspond à votre recherche.' });
      };
      draw();

      root.querySelector('#cli-q').addEventListener('input', e => { CLI.q = e.target.value; draw(); });
      root.querySelector('#cli-f').addEventListener('change', e => { CLI.filtre = e.target.value; draw(); });
      root.querySelector('#cli-new').onclick = () => openClientForm({});
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const c = DB.get('clients', b.dataset.id);
        if (!c) return;
        const act = b.dataset.act;
        if (act === 'hist') openClientHistory(c);
        if (act === 'edit') openClientForm({ client: c });
        if (act === 'archive' || act === 'unarchive') toggleArchive(c, act === 'archive');
        if (act === 'del') deleteClient(c);
      });
    }
  };

  function toggleArchive(c, archive) {
    DB.commit([
      { op: 'put', store: 'clients', obj: { ...c, archive } },
      DB.logOp(archive ? 'Archivage client' : 'Réactivation client', `${c.nom} ${c.prenom} (${c.code})`, App.user)
    ]).then(() => { toast(archive ? 'Client archivé. Son historique est conservé.' : 'Client réactivé.'); App.refresh(); });
  }

  function deleteClient(c) {
    const used = DB.all('transactions').some(t => t.clientId === c.id) || DB.all('rdv').some(r => r.clientId === c.id);
    if (used) { toast('Ce client a un historique : archivez-le plutôt que de le supprimer.', 'warn'); return; }
    confirmBox(`Supprimer définitivement la fiche de ${c.nom} ${c.prenom} ?`, { okLabel: 'Supprimer' }).then(ok => {
      if (!ok) return;
      DB.commit([{ op: 'del', store: 'clients', id: c.id }, DB.logOp('Suppression client', `${c.nom} ${c.prenom} (${c.code})`, App.user)])
        .then(() => { toast('Client supprimé.'); App.refresh(); });
    });
  }

  function openClientHistory(c) {
    const st = clientStats(c.id);
    const rows = st.txs.map(t => [
      fmtDate(t.date) + ' ' + h(t.heure),
      h(t.numero),
      h((t.lignes || []).map(l => `${l.nom}${l.type === 'prestation' ? ' (' + (l.employeNom || '') + ')' : ''}`).join(', ')),
      `<span class="num">${fmtNum(t.montantNet)}</span>`,
      `<span class="num">${fmtNum(t.montantPaye)}</span>`,
      t.solde > 0 ? `<span class="num error">${fmtNum(t.solde)}</span>` : '<span class="num">0</span>',
      h(t.modePaiement)
    ]);
    openModal({
      title: `Historique — ${c.nom} ${c.prenom}`,
      wide: true,
      body: `<div class="kpi-grid" style="margin-bottom:12px">
          ${kpi('Visites', fmtNum(st.visites), '', 'accent')}
          ${kpi('Total dépensé', fmt(st.total), '')}
          ${kpi('Dernière visite', fmtDate(st.derniere), '')}
          ${kpi('Téléphone', h(c.telephone || '—'), c.sexe || '')}
        </div>
        ${c.observations ? `<div class="alert info">Observations : ${h(c.observations)}</div>` : ''}
        ${table(['Date', 'N° reçu', 'Prestations / produits', 'Net', 'Payé', 'Solde', 'Paiement'], rows, { empty: 'Aucune visite enregistrée.' })}`,
      footer: `<button class="btn ghost" data-close>Fermer</button>`
    });
  }

  /* Formulaire client (utilisé aussi par la caisse) */
  function openClientForm({ client = null, onSaved = null }) {
    const c = client || { nom: '', prenom: '', telephone: '', sexe: 'Femme', dateNaissance: '', observations: '' };
    const isEdit = !!client;
    openModal({
      title: isEdit ? 'Modifier le client' : 'Nouveau client',
      body: `<form id="cli-form" class="form-grid">
        ${field('Nom', `<input class="input" name="nom" value="${h(c.nom)}" required autofocus>`)}
        ${field('Prénom', `<input class="input" name="prenom" value="${h(c.prenom)}">`)}
        ${field('Numéro de téléphone', `<input class="input" name="telephone" type="tel" value="${h(c.telephone)}" placeholder="6XX XX XX XX">`)}
        ${field('Sexe', `<select class="select" name="sexe">${['Femme', 'Homme', 'Autre', 'Non précisé'].map(x => `<option ${x === c.sexe ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
        ${field('Date de naissance', `<input class="input" type="date" name="dateNaissance" value="${h(c.dateNaissance || '')}">`, 'Facultatif')}
        <div></div>
        <div class="span-2">${field('Observations particulières', `<textarea class="textarea" name="observations" rows="3" placeholder="Allergies, préférences de coiffure, etc.">${h(c.observations || '')}</textarea>`)}</div>
        <div class="span-2"><p class="form-error" id="cli-err"></p></div>
      </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="cli-form">Enregistrer</button>`,
      onMount: (el, close) => {
        const form = el.querySelector('#cli-form');
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(form);
          if (!f.nom) { el.querySelector('#cli-err').textContent = 'Le nom est obligatoire.'; return; }
          if (f.telephone && phoneClean(f.telephone).length < 8) { el.querySelector('#cli-err').textContent = 'Numéro de téléphone incomplet.'; return; }
          const dup = f.telephone && DB.all('clients').find(x => x.id !== c.id && phoneClean(x.telephone) === phoneClean(f.telephone));
          if (dup && !(await confirmBox(`Ce numéro appartient déjà à ${dup.nom} ${dup.prenom}. Créer quand même ?`, { okLabel: 'Créer quand même', danger: false }))) return;
          const obj = isEdit ? { ...client, ...f } : { id: uid(), code: 'CL-' + String(DB.nextNum('client')).padStart(6, '0'), dateCreation: todayStr(), archive: false, ...f };
          const ops = [{ op: 'put', store: 'clients', obj }];
          if (!isEdit) ops.push(DB.saveSettingsOp());
          try {
            await DB.commit(ops);
            toast(isEdit ? 'Fiche client mise à jour.' : `Client ${obj.code} enregistré.`);
            close();
            if (onSaved) onSaved(DB.get('clients', obj.id)); else App.refresh();
          } catch (err) { el.querySelector('#cli-err').textContent = err.message; }
        });
      }
    });
  }
  window.openClientForm = openClientForm;

  /* =========================================================
     PRESTATIONS (catalogue)
     ========================================================= */
  const SVC = { q: '', cat: 'toutes' };

  PAGES.prestations = {
    label: 'Prestations', icon: '✂', roles: ['admin', 'receptionniste'],
    render(root, user) {
      const isAdmin = user.role === 'admin';
      const cats = [...new Set(DB.all('services').map(s => s.categorie).filter(Boolean))].sort();
      root.innerHTML = `
        ${pageHead('Prestations', 'Catalogue des services et tarifs (FCFA)', isAdmin ? `
          ${DB.all('services').length === 0 ? '<button class="btn light" id="svc-import">Charger les prestations types</button>' : ''}
          <button class="btn primary" id="svc-new">+ Nouvelle prestation</button>` : '')}
        <div class="toolbar">
          <div class="search"><input class="input" id="svc-q" placeholder="Rechercher une prestation..." value="${h(SVC.q)}"></div>
          <select class="select" id="svc-cat"><option value="toutes">Toutes les catégories</option>
            ${cats.map(c => `<option ${SVC.cat === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select>
        </div>
        <div id="svc-list"></div>`;

      const list = root.querySelector('#svc-list');
      const draw = () => {
        const q = SVC.q.trim().toLowerCase();
        const items = DB.all('services').filter(s => (SVC.cat === 'toutes' || s.categorie === SVC.cat) &&
          (!q || `${s.nom} ${s.categorie} ${s.description}`.toLowerCase().includes(q))).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        list.innerHTML = table(['Prestation', 'Catégorie', 'Description', 'Prix', 'Durée', 'Statut', isAdmin ? 'Actions' : ''],
          items.map(s => [
            `<strong>${h(s.nom)}</strong>`,
            h(s.categorie || '—'),
            `<span class="small muted">${h(s.description || '')}</span>`,
            `<span class="num">${fmt(s.prix)}</span>`,
            `${fmtNum(s.duree)} min`,
            badge(s.actif ? 'Active' : 'Inactive', s.actif ? 'ok' : 'muted'),
            isAdmin ? `<div class="actions-cell">
              <button class="link-btn" data-act="edit" data-id="${h(s.id)}">Modifier</button>
              <button class="link-btn" data-act="toggle" data-id="${h(s.id)}">${s.actif ? 'Désactiver' : 'Activer'}</button>
              <button class="link-btn danger-link" data-act="del" data-id="${h(s.id)}">Supprimer</button></div>` : ''
          ]), { empty: 'Aucune prestation. Ajoutez-en une avec le bouton ci-dessus.' });
      };
      draw();

      root.querySelector('#svc-q').addEventListener('input', e => { SVC.q = e.target.value; draw(); });
      root.querySelector('#svc-cat').addEventListener('change', e => { SVC.cat = e.target.value; draw(); });
      const imp = root.querySelector('#svc-import');
      if (imp) imp.onclick = () => {
        const ops = PRESTATIONS_TYPES.map(nom => ({ op: 'put', store: 'services', obj: { id: uid(), nom, categorie: '', description: '', prix: 0, duree: 30, actif: false } }));
        DB.commit([...ops, DB.logOp('Import catalogue type', `${ops.length} prestations à compléter`, App.user)])
          .then(() => { toast('Prestations types ajoutées : complétez les prix puis activez-les.'); App.refresh(); });
      };
      const nw = root.querySelector('#svc-new');
      if (nw) nw.onclick = () => openServiceForm({});
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || !isAdmin) return;
        const s = DB.get('services', b.dataset.id);
        if (!s) return;
        if (b.dataset.act === 'edit') openServiceForm({ service: s });
        if (b.dataset.act === 'toggle') DB.put('services', { ...s, actif: !s.actif }).then(() => App.refresh());
        if (b.dataset.act === 'del') {
          const used = DB.all('transactions').some(t => (t.lignes || []).some(l => l.serviceId === s.id)) || DB.all('rdv').some(r => r.serviceId === s.id);
          if (used) { toast('Cette prestation a déjà été vendue : désactivez-la plutôt que de la supprimer.', 'warn'); return; }
          confirmBox(`Supprimer la prestation « ${s.nom} » ?`, { okLabel: 'Supprimer' }).then(ok => {
            if (ok) DB.commit([{ op: 'del', store: 'services', id: s.id }, DB.logOp('Suppression prestation', s.nom, App.user)]).then(() => { toast('Prestation supprimée.'); App.refresh(); });
          });
        }
      });
    }
  };

  function openServiceForm({ service = null }) {
    const s = service || { nom: '', categorie: 'Coiffure femme', description: '', prix: '', duree: 30, actif: true };
    const isEdit = !!service;
    openModal({
      title: isEdit ? 'Modifier la prestation' : 'Nouvelle prestation',
      body: `<form id="svc-form" class="form-grid">
        ${field('Nom', `<input class="input" name="nom" value="${h(s.nom)}" required>`)}
        ${field('Catégorie', `<input class="input" name="categorie" list="svc-cats" value="${h(s.categorie)}">
          <datalist id="svc-cats">${CATEGORIES_PRESTATIONS.map(c => `<option value="${h(c)}">`).join('')}</datalist>`)}
        ${field('Prix (FCFA)', `<input class="input" type="number" min="0" step="100" name="prix" value="${h(s.prix)}" required>`)}
        ${field('Durée estimée (minutes)', `<input class="input" type="number" min="5" step="5" name="duree" value="${h(s.duree)}" required>`)}
        <div class="span-2">${field('Description', `<textarea class="textarea" name="description" rows="2">${h(s.description || '')}</textarea>`)}</div>
        <label class="check-row span-2"><input type="checkbox" name="actif" ${s.actif ? 'checked' : ''}> Prestation active (visible à la caisse)</label>
        <div class="span-2"><p class="form-error" id="svc-err"></p></div>
      </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="svc-form">Enregistrer</button>`,
      onMount: (el, close) => {
        el.querySelector('#svc-form').addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(e.target);
          if (!f.nom || num(f.prix) < 0 || num(f.duree) <= 0) { el.querySelector('#svc-err').textContent = 'Nom, prix et durée sont obligatoires.'; return; }
          const obj = { id: isEdit ? s.id : uid(), nom: f.nom, categorie: f.categorie, description: f.description || '', prix: num(f.prix), duree: num(f.duree), actif: !!e.target.actif.checked };
          const ops = [{ op: 'put', store: 'services', obj }];
          if (isEdit && num(s.prix) !== obj.prix) ops.push(DB.logOp('Changement de prix', `${obj.nom} : ${fmtNum(s.prix)} → ${fmtNum(obj.prix)} FCFA`, App.user));
          await DB.commit(ops);
          toast('Prestation enregistrée.');
          close();
          App.refresh();
        });
      }
    });
  }

  /* =========================================================
     PERSONNEL (coiffeurs)
     ========================================================= */
  PAGES.personnel = {
    label: 'Personnel', icon: '💇', roles: ['admin'],
    render(root) {
      const staff = DB.all('employees').sort(sortByName);
      const rows = staff.map(e => {
        const b = employeeBalance(e);
        const mois = employeeStats(e.id, monthStart(todayStr()), monthEnd(todayStr()));
        return [
          `<strong>${h(e.prenom)} ${h(e.nom)}</strong><br><small class="muted">${h(e.fonction || '')}</small>`,
          badge(ROLE_MODE[e.modeRemuneration] || '—', 'accent'),
          e.modeRemuneration === 'fixe' ? '—' : `${fmtNum(e.tauxCommission)} %`,
          `<span class="num">${fmtNum(e.salaireFixe)}</span>`,
          `<span class="num">${fmtNum(mois.nb)} / ${fmt(mois.ca)}</span>`,
          `<span class="num">${fmt(b.commissions)}</span>`,
          `<span class="num">${fmt(b.avances + b.paiements)}</span>`,
          `<span class="num ${b.solde > 0 ? 'error' : ''}"><strong>${fmt(b.solde)}</strong></span>`,
          badge(e.actif ? 'Actif' : 'Inactif', e.actif ? 'ok' : 'muted'),
          `<div class="actions-cell">
            <button class="link-btn" data-act="detail" data-id="${h(e.id)}">Détail</button>
            <button class="link-btn" data-act="mv" data-id="${h(e.id)}">Avance / paiement</button>
            <button class="link-btn" data-act="edit" data-id="${h(e.id)}">Modifier</button></div>`
        ];
      });
      root.innerHTML = `
        ${pageHead('Personnel', 'Coiffeurs, commissions, avances et paiements', `<button class="btn primary" id="emp-new">+ Nouveau coiffeur</button>`)}
        <div class="alert info">Le solde à payer = commissions acquises + salaire fixe acquis (au prorata du temps depuis la date de recrutement), moins les avances et les paiements déjà effectués.</div>
        ${table(['Coiffeur', 'Rémunération', 'Taux', 'Salaire fixe', 'Ce mois : prestations / CA', 'Commissions', 'Avances + paiements', 'Solde à payer', 'Statut', 'Actions'], rows,
          { empty: 'Aucun coiffeur enregistré.' })}`;
      root.querySelector('#emp-new').onclick = () => openEmployeeForm({});
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const emp = DB.get('employees', b.dataset.id);
        if (!emp) return;
        if (b.dataset.act === 'edit') openEmployeeForm({ employee: emp });
        if (b.dataset.act === 'mv') openMouvementForm(emp);
        if (b.dataset.act === 'detail') openEmployeeDetail(emp);
      });
    }
  };

  function openEmployeeForm({ employee = null }) {
    const e = employee || { nom: '', prenom: '', telephone: '', adresse: '', fonction: 'Coiffeur(se)', dateRecrutement: todayStr(), modeRemuneration: 'commission', tauxCommission: 40, salaireFixe: 0, actif: true };
    const isEdit = !!employee;
    openModal({
      title: isEdit ? 'Modifier le coiffeur' : 'Nouveau coiffeur',
      wide: true,
      body: `<form id="emp-form" class="form-grid">
        ${field('Nom', `<input class="input" name="nom" value="${h(e.nom)}" required>`)}
        ${field('Prénom', `<input class="input" name="prenom" value="${h(e.prenom)}" required>`)}
        ${field('Téléphone', `<input class="input" name="telephone" value="${h(e.telephone)}">`)}
        ${field('Fonction', `<input class="input" name="fonction" value="${h(e.fonction)}">`)}
        <div class="span-2">${field('Adresse', `<input class="input" name="adresse" value="${h(e.adresse)}">`)}</div>
        ${field('Date de recrutement', `<input class="input" type="date" name="dateRecrutement" value="${h(e.dateRecrutement)}" required>`)}
        ${field('Mode de rémunération', `<select class="select" name="modeRemuneration" id="emp-mode">
          <option value="fixe" ${e.modeRemuneration === 'fixe' ? 'selected' : ''}>Salaire fixe</option>
          <option value="commission" ${e.modeRemuneration === 'commission' ? 'selected' : ''}>Commission sur les prestations</option>
          <option value="mixte" ${e.modeRemuneration === 'mixte' ? 'selected' : ''}>Salaire fixe + commission</option></select>`)}
        ${field('Pourcentage de commission (%)', `<input class="input" type="number" min="0" max="100" step="1" name="tauxCommission" value="${h(e.tauxCommission)}">`, 'Appliqué au montant net de chaque prestation')}
        ${field('Salaire fixe mensuel (FCFA)', `<input class="input" type="number" min="0" step="1000" name="salaireFixe" value="${h(e.salaireFixe)}">`)}
        <label class="check-row"><input type="checkbox" name="actif" ${e.actif ? 'checked' : ''}> Coiffeur actif</label>
        <div class="span-2"><p class="form-error" id="emp-err"></p></div>
      </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="emp-form">Enregistrer</button>`,
      onMount: (el, close) => {
        el.querySelector('#emp-form').addEventListener('submit', async ev => {
          ev.preventDefault();
          const f = formData(ev.target);
          if (!f.nom || !f.prenom) { el.querySelector('#emp-err').textContent = 'Nom et prénom sont obligatoires.'; return; }
          const mode = f.modeRemuneration;
          if ((mode === 'commission' || mode === 'mixte') && num(f.tauxCommission) <= 0) { el.querySelector('#emp-err').textContent = 'Indiquez un pourcentage de commission.'; return; }
          const obj = {
            id: isEdit ? employee.id : uid(), nom: f.nom, prenom: f.prenom, telephone: f.telephone || '', adresse: f.adresse || '',
            fonction: f.fonction || '', dateRecrutement: f.dateRecrutement, modeRemuneration: mode,
            tauxCommission: mode === 'fixe' ? 0 : num(f.tauxCommission), salaireFixe: mode === 'commission' ? 0 : num(f.salaireFixe),
            actif: !!ev.target.actif.checked
          };
          await DB.commit([{ op: 'put', store: 'employees', obj }, DB.logOp(isEdit ? 'Modification coiffeur' : 'Création coiffeur', `${obj.prenom} ${obj.nom}`, App.user)]);
          toast('Fiche coiffeur enregistrée.');
          close();
          App.refresh();
        });
      }
    });
  }

  function openMouvementForm(emp) {
    const b = employeeBalance(emp);
    openModal({
      title: `Avance ou paiement — ${emp.prenom} ${emp.nom}`,
      body: `<div class="alert info">Solde actuel à payer : <strong>${fmt(b.solde)}</strong></div>
        <form id="mv-form" class="form-grid">
          ${field('Type', `<select class="select" name="type"><option value="avance">Avance reçue</option><option value="paiement">Paiement effectué</option></select>`)}
          ${field('Montant (FCFA)', `<input class="input" type="number" min="1" step="100" name="montant" required>`)}
          ${field('Date', `<input class="input" type="date" name="date" value="${todayStr()}" required>`)}
          ${field('Note', `<input class="input" name="note" placeholder="Ex. : avance pour loyer">`)}
          <div class="span-2"><p class="form-error" id="mv-err"></p></div>
        </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="mv-form">Enregistrer</button>`,
      onMount: (el, close) => {
        el.querySelector('#mv-form').addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(e.target);
          if (num(f.montant) <= 0) { el.querySelector('#mv-err').textContent = 'Montant invalide.'; return; }
          const obj = { id: uid(), employeeId: emp.id, type: f.type, montant: num(f.montant), date: f.date, note: f.note || '' };
          await DB.put('mouvements_personnel', obj);
          toast(f.type === 'avance' ? 'Avance enregistrée.' : 'Paiement enregistré.');
          close();
          App.refresh();
        });
      }
    });
  }

  function openEmployeeDetail(emp) {
    const b = employeeBalance(emp);
    const mois = employeeStats(emp.id, monthStart(todayStr()), monthEnd(todayStr()));
    const lignes = [];
    DB.all('transactions').forEach(t => (t.lignes || []).forEach(l => {
      if (l.type === 'prestation' && l.employeeId === emp.id) lignes.push({ date: t.date, heure: t.heure, numero: t.numero, client: t.clientNom, ...l });
    }));
    lignes.sort((x, y) => (y.date + y.heure).localeCompare(x.date + x.heure));
    const mouv = DB.all('mouvements_personnel').filter(m => m.employeeId === emp.id).sort((x, y) => y.date.localeCompare(x.date));
    openModal({
      title: `${emp.prenom} ${emp.nom}`,
      wide: true,
      body: `<div class="kpi-grid">
          ${kpi('Prestations (ce mois)', fmtNum(mois.nb), '', 'accent')}
          ${kpi('CA généré (ce mois)', fmt(mois.ca), '')}
          ${kpi('Commissions acquises', fmt(b.commissions), 'Depuis le début')}
          ${kpi('Solde à payer', fmt(b.solde), `Avances ${fmt(b.avances)} · Paiements ${fmt(b.paiements)}`, b.solde > 0 ? 'warn' : 'success')}
        </div>
        <h3 style="margin:8px 0">Historique des prestations</h3>
        ${table(['Date', 'Client', 'Prestation', 'Net', 'Commission', 'Taux'], lignes.slice(0, 200).map(l => [
          fmtDate(l.date), h(l.client), h(l.nom), `<span class="num">${fmtNum(l.montantNet)}</span>`, `<span class="num">${fmtNum(l.commission)}</span>`, `${fmtNum(l.tauxCommission)} %`
        ]), { empty: 'Aucune prestation enregistrée.' })}
        <h3 style="margin:18px 0 8px">Avances et paiements</h3>
        ${table(['Date', 'Type', 'Montant', 'Note'], mouv.map(m => [fmtDate(m.date), m.type === 'avance' ? 'Avance' : 'Paiement', `<span class="num">${fmtNum(m.montant)}</span>`, h(m.note || '')]),
          { empty: 'Aucun mouvement.' })}`,
      footer: `<button class="btn ghost" data-close>Fermer</button><button class="btn primary" id="emp-mv">Avance / paiement</button>`,
      onMount: (el, close) => { el.querySelector('#emp-mv').onclick = () => { close(); openMouvementForm(emp); }; }
    });
  }

  /* =========================================================
     STOCK ET PRODUITS
     ========================================================= */
  const STK = { tab: 'produits', q: '' };
  const stockStatus = p => {
    const q = num(p.quantite);
    if (q <= 0) return { label: 'Rupture', cls: 'danger' };
    if (q <= num(p.seuil)) return { label: 'Stock faible', cls: 'warn' };
    return { label: 'Disponible', cls: 'ok' };
  };

  PAGES.stock = {
    label: 'Stock & produits', icon: '📦', roles: ['admin', 'receptionniste'],
    render(root, user) {
      const isAdmin = user.role === 'admin';
      const produits = DB.all('produits');
      const valeur = produits.reduce((s, p) => s + num(p.quantite) * num(p.prixAchat), 0);
      const ruptures = produits.filter(p => num(p.quantite) <= 0).length;
      const faibles = produits.filter(p => num(p.quantite) > 0 && num(p.quantite) <= num(p.seuil)).length;
      root.innerHTML = `
        ${pageHead('Stock & produits', 'Entrées, sorties, ventes de produits et alertes', isAdmin ? `<button class="btn primary" id="prod-new">+ Nouveau produit</button>` : '')}
        <div class="kpi-grid">
          ${kpi('Produits référencés', fmtNum(produits.length), '', 'accent')}
          ${kpi('Valeur du stock', fmt(valeur), 'Au prix d\'achat')}
          ${kpi('Ruptures', fmtNum(ruptures), 'Quantité à zéro', ruptures ? 'danger' : 'success')}
          ${kpi('Stocks faibles', fmtNum(faibles), 'Sous le seuil d\'alerte', faibles ? 'warn' : 'success')}
        </div>
        <div class="tabs">
          <button class="tab ${STK.tab === 'produits' ? 'on' : ''}" data-tab="produits">Produits</button>
          <button class="tab ${STK.tab === 'mouvements' ? 'on' : ''}" data-tab="mouvements">Mouvements de stock</button>
        </div>
        <div id="stk-body"></div>`;

      const body = root.querySelector('#stk-body');
      const drawProduits = () => {
        body.innerHTML = `<div class="toolbar"><div class="search"><input class="input" id="stk-q" placeholder="Rechercher un produit..." value="${h(STK.q)}"></div></div><div id="stk-list"></div>`;
        const list = body.querySelector('#stk-list');
        const q = STK.q.trim().toLowerCase();
        const items = produits.filter(p => !q || `${p.nom} ${p.categorie} ${p.fournisseur}`.toLowerCase().includes(q)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
        list.innerHTML = table(['Produit', 'Catégorie', 'Fournisseur', 'Prix achat', 'Prix vente', 'Quantité', 'Seuil', 'Statut', 'Actions'],
          items.map(p => {
            const st = stockStatus(p);
            return [
              `<strong>${h(p.nom)}</strong><br><small class="muted">Entrée : ${fmtDate(p.dateEntree)}</small>`,
              h(p.categorie || '—'), h(p.fournisseur || '—'),
              `<span class="num">${fmt(p.prixAchat)}</span>`, `<span class="num">${fmt(p.prixVente)}</span>`,
              `<span class="num"><strong>${fmtNum(p.quantite)}</strong></span>`, fmtNum(p.seuil),
              badge(st.label, st.cls),
              `<div class="actions-cell">
                <button class="link-btn" data-act="vente" data-id="${h(p.id)}">Vendre</button>
                <button class="link-btn" data-act="entree" data-id="${h(p.id)}">Entrée</button>
                <button class="link-btn" data-act="sortie" data-id="${h(p.id)}">Sortie</button>
                ${isAdmin ? `<button class="link-btn" data-act="edit" data-id="${h(p.id)}">Modifier</button>
                <button class="link-btn danger-link" data-act="del" data-id="${h(p.id)}">Supprimer</button>` : ''}</div>`
            ];
          }), { empty: 'Aucun produit. Ajoutez vos produits (shampoings, défrisants, perruques…).' });
        body.querySelector('#stk-q').addEventListener('input', e => { STK.q = e.target.value; drawProduits(); body.querySelector('#stk-q').focus(); });
      };

      const drawMouvements = () => {
        const mv = DB.all('mouvements_stock').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 300);
        body.innerHTML = table(['Date', 'Produit', 'Type', 'Quantité', 'Note'], mv.map(m => {
          const p = DB.get('produits', m.produitId);
          const type = { entree: ['Entrée', 'ok'], sortie: ['Sortie', 'warn'], vente: ['Vente', 'info'] }[m.type] || [m.type, ''];
          return [fmtDate(m.date), h(p ? p.nom : '—'), badge(type[0], type[1]), `<span class="num">${fmtNum(m.quantite)}</span>`, h(m.note || '')];
        }), { empty: 'Aucun mouvement enregistré.' });
      };

      (STK.tab === 'produits' ? drawProduits : drawMouvements)();

      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { STK.tab = b.dataset.tab; App.refresh(); });
      const nw = root.querySelector('#prod-new');
      if (nw) nw.onclick = () => openProduitForm({});
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const p = DB.get('produits', b.dataset.id);
        if (!p) return;
        const act = b.dataset.act;
        if (act === 'vente') openVenteProduit(p);
        if (act === 'entree') openMouvementStock(p, 'entree');
        if (act === 'sortie') openMouvementStock(p, 'sortie');
        if (act === 'edit' && isAdmin) openProduitForm({ produit: p });
        if (act === 'del' && isAdmin) {
          if (DB.all('mouvements_stock').some(m => m.produitId === p.id)) { toast('Ce produit a un historique de mouvements : il ne peut pas être supprimé.', 'warn'); return; }
          confirmBox(`Supprimer le produit « ${p.nom} » ?`, { okLabel: 'Supprimer' }).then(ok => {
            if (ok) DB.commit([{ op: 'del', store: 'produits', id: p.id }, DB.logOp('Suppression produit', p.nom, App.user)]).then(() => { toast('Produit supprimé.'); App.refresh(); });
          });
        }
      });
    }
  };

  function openProduitForm({ produit = null }) {
    const p = produit || { nom: '', categorie: '', fournisseur: '', prixAchat: 0, prixVente: 0, quantite: 0, seuil: 2, dateEntree: todayStr() };
    const isEdit = !!produit;
    openModal({
      title: isEdit ? 'Modifier le produit' : 'Nouveau produit',
      wide: true,
      body: `<form id="prod-form" class="form-grid">
        ${field('Nom du produit', `<input class="input" name="nom" value="${h(p.nom)}" required>`)}
        ${field('Catégorie', `<input class="input" name="categorie" value="${h(p.categorie)}" list="prod-cats"><datalist id="prod-cats"><option value="Shampoings"><option value="Défrisants"><option value="Huiles capillaires"><option value="Colorations"><option value="Mèches"><option value="Perruques"><option value="Produits de soin"><option value="Accessoires"></datalist>`)}
        ${field('Fournisseur', `<input class="input" name="fournisseur" value="${h(p.fournisseur)}">`)}
        ${field('Date d\'entrée en stock', `<input class="input" type="date" name="dateEntree" value="${h(p.dateEntree)}">`)}
        ${field('Prix d\'achat (FCFA)', `<input class="input" type="number" min="0" step="100" name="prixAchat" value="${h(p.prixAchat)}">`)}
        ${field('Prix de vente (FCFA)', `<input class="input" type="number" min="0" step="100" name="prixVente" value="${h(p.prixVente)}">`)}
        ${isEdit ? '' : field('Quantité initiale', `<input class="input" type="number" min="0" step="1" name="quantite" value="0">`)}
        ${field('Seuil d\'alerte', `<input class="input" type="number" min="0" step="1" name="seuil" value="${h(p.seuil)}">`, 'Alerte quand le stock atteint ce niveau')}
        <div class="span-2"><p class="form-error" id="prod-err"></p></div>
      </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="prod-form">Enregistrer</button>`,
      onMount: (el, close) => {
        el.querySelector('#prod-form').addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(e.target);
          if (!f.nom) { el.querySelector('#prod-err').textContent = 'Le nom est obligatoire.'; return; }
          const obj = {
            id: isEdit ? p.id : uid(), nom: f.nom, categorie: f.categorie || '', fournisseur: f.fournisseur || '',
            prixAchat: num(f.prixAchat), prixVente: num(f.prixVente), seuil: num(f.seuil),
            dateEntree: f.dateEntree || todayStr(), quantite: isEdit ? p.quantite : num(f.quantite)
          };
          const ops = [{ op: 'put', store: 'produits', obj }];
          if (isEdit && num(p.prixVente) !== obj.prixVente) ops.push(DB.logOp('Changement de prix', `${obj.nom} : ${fmtNum(p.prixVente)} → ${fmtNum(obj.prixVente)} FCFA`, App.user));
          if (!isEdit && obj.quantite > 0) ops.push({ op: 'put', store: 'mouvements_stock', obj: { id: uid(), produitId: obj.id, type: 'entree', quantite: obj.quantite, date: obj.dateEntree, note: 'Stock initial' } });
          await DB.commit(ops);
          toast('Produit enregistré.');
          close();
          App.refresh();
        });
      }
    });
  }

  function openMouvementStock(p, type) {
    const isIn = type === 'entree';
    openModal({
      title: `${isIn ? 'Entrée' : 'Sortie'} de stock — ${p.nom}`,
      body: `<div class="alert info">Quantité actuelle : <strong>${fmtNum(p.quantite)}</strong></div>
        <form id="mvs-form" class="form-grid">
          ${field('Quantité', `<input class="input" type="number" min="1" step="1" name="quantite" required autofocus>`)}
          ${field('Date', `<input class="input" type="date" name="date" value="${todayStr()}" required>`)}
          <div class="span-2">${field(isIn ? 'Fournisseur / référence' : 'Motif', `<input class="input" name="note" placeholder="${isIn ? 'Ex. : facture n° 124' : 'Ex. : usage interne, casse'}">`)}</div>
          <div class="span-2"><p class="form-error" id="mvs-err"></p></div>
        </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="mvs-form">Enregistrer</button>`,
      onMount: (el, close) => {
        el.querySelector('#mvs-form').addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(e.target);
          const q = num(f.quantite);
          if (q <= 0) { el.querySelector('#mvs-err').textContent = 'Quantité invalide.'; return; }
          if (!isIn && q > num(p.quantite)) { el.querySelector('#mvs-err').textContent = `Sortie impossible : seulement ${fmtNum(p.quantite)} en stock.`; return; }
          const newQty = isIn ? num(p.quantite) + q : num(p.quantite) - q;
          await DB.commit([
            { op: 'put', store: 'produits', obj: { ...p, quantite: newQty } },
            { op: 'put', store: 'mouvements_stock', obj: { id: uid(), produitId: p.id, type, quantite: q, date: f.date, note: f.note || '' } }
          ]);
          toast(isIn ? 'Entrée enregistrée.' : 'Sortie enregistrée.');
          close();
          App.refresh();
        });
      }
    });
  }

  /* Vente directe d'un produit (passe par la même logique que la caisse) */
  function openVenteProduit(p) {
    if (num(p.quantite) <= 0) { toast('Produit en rupture de stock.', 'warn'); return; }
    openModal({
      title: `Vente — ${p.nom}`,
      body: `<form id="pv-form" class="form-grid">
          <div class="span-2">${field('Client', `<select class="select" name="clientId"><option value="">Client de passage</option>${activeClients().map(c => `<option value="${h(c.id)}">${h(c.nom)} ${h(c.prenom)}</option>`).join('')}</select>`)}</div>
          ${field('Quantité (stock : ' + fmtNum(p.quantite) + ')', `<input class="input" type="number" min="1" max="${num(p.quantite)}" step="1" name="quantite" value="1" required>`)}
          ${field('Prix unitaire (FCFA)', `<input class="input" type="number" min="0" step="100" name="prix" value="${num(p.prixVente)}" required>`)}
          ${field('Réduction (FCFA)', `<input class="input" type="number" min="0" step="100" name="reduction" value="0">`)}
          ${field('Moyen de paiement', `<select class="select" name="mode">${PAY_MODES.map(m => `<option>${m}</option>`).join('')}</select>`)}
          <div class="span-2"><div class="alert info" id="pv-total"></div></div>
          ${field('Montant payé (FCFA)', `<input class="input" type="number" min="0" step="100" name="paye" id="pv-paye">`, 'Au client de passage : paiement total obligatoire')}
          <div class="span-2"><p class="form-error" id="pv-err"></p></div>
        </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="pv-form">Encaisser la vente</button>`,
      onMount: (el, close) => {
        const form = el.querySelector('#pv-form');
        const refreshTotal = () => {
          const f = formData(form);
          const brut = num(f.quantite) * num(f.prix);
          const net = Math.max(0, brut - num(f.reduction));
          el.querySelector('#pv-total').innerHTML = `Net à payer : <strong>${fmt(net)}</strong>`;
          const paye = el.querySelector('#pv-paye');
          if (!paye.dataset.touched) paye.value = net;
        };
        form.addEventListener('input', refreshTotal);
        el.querySelector('#pv-paye').addEventListener('input', e => { e.target.dataset.touched = '1'; });
        refreshTotal();
        form.addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(form);
          const client = f.clientId ? DB.get('clients', f.clientId) : null;
          try {
            const tx = await saveTransaction({
              client,
              lines: [{ type: 'produit', produitId: p.id, nom: p.nom, quantite: num(f.quantite), prixUnitaire: num(f.prix) }],
              reduction: num(f.reduction),
              paiements: [{ mode: f.mode, montant: num(f.paye) }],
              rdvId: null
            });
            toast(`Vente ${tx.numero} enregistrée.`);
            close();
            showReceipt(tx, () => App.refresh());
          } catch (err) { el.querySelector('#pv-err').textContent = err.message; }
        });
      }
    });
  }

  /* =========================================================
     DÉPENSES
     ========================================================= */
  const DEP = { period: { key: 'mois', from: '', to: '' } };

  PAGES.depenses = {
    label: 'Dépenses', icon: '🧾', roles: ['admin'],
    render(root) {
      const jour = periodRange('jour'), sem = periodRange('semaine'), mois = periodRange('mois');
      const pr = periodRange(DEP.period.key, DEP.period);
      const liste = DB.all('depenses').filter(d => d.date >= pr.from && d.date <= pr.to).sort((a, b) => b.date.localeCompare(a.date));
      const sum = arr => arr.reduce((s, d) => s + num(d.montant), 0);
      const tJour = sum(DB.all('depenses').filter(d => d.date >= jour.from && d.date <= jour.to));
      const tSem = sum(DB.all('depenses').filter(d => d.date >= sem.from && d.date <= sem.to));
      const tMois = sum(DB.all('depenses').filter(d => d.date >= mois.from && d.date <= mois.to));
      const total = sum(liste);
      root.innerHTML = `
        ${pageHead('Dépenses', 'Charges du salon : loyer, électricité, eau, achats, transport…', `<button class="btn primary" id="dep-new">+ Nouvelle dépense</button>`)}
        <div class="kpi-grid">
          ${kpi('Aujourd\'hui', fmt(tJour), '', 'warn')}
          ${kpi('Cette semaine', fmt(tSem), '')}
          ${kpi('Ce mois', fmt(tMois), '', 'accent')}
          ${kpi('Période affichée', fmt(total), pr.label, 'danger')}
        </div>
        <div class="toolbar">${periodControls('dep', DEP.period.key, DEP.period.from || pr.from, DEP.period.to || pr.to)}</div>
        <div class="alert info">Les catégories « Achat de produits » et « Salaires » s'affichent ici, mais ne sont pas redéduites du bénéfice : les achats sont comptés via le coût des produits vendus, et les salaires via le module Personnel.</div>
        ${table(['Date', 'Catégorie', 'Description', 'Montant', 'Paiement', 'Justificatif', 'Actions'], liste.map(d => [
          fmtDate(d.date), badge(d.categorie, 'accent'), h(d.description), `<span class="num"><strong>${fmt(d.montant)}</strong></span>`, h(d.moyenPaiement || '—'),
          d.justificatif ? `<a href="${d.justificatif}" download="${h(d.justificatifNom || 'justificatif')}" class="link-btn">Télécharger</a>` : '<span class="muted small">—</span>',
          `<div class="actions-cell"><button class="link-btn" data-act="edit" data-id="${h(d.id)}">Modifier</button>
           <button class="link-btn danger-link" data-act="del" data-id="${h(d.id)}">Supprimer</button></div>`
        ]), { empty: 'Aucune dépense sur cette période.' })}`;

      const pc = root.querySelector('#dep-p');
      const applyPeriod = () => {
        const p = readPeriod('dep');
        DEP.period = { key: p.key, from: p.from, to: p.to };
        App.refresh();
      };
      pc.addEventListener('change', () => {
        const isCustom = pc.value === 'perso';
        root.querySelector('#dep-custom').classList.toggle('hidden', !isCustom);
        if (!isCustom) applyPeriod();
      });
      ['#dep-from', '#dep-to'].forEach(s => root.querySelector(s).addEventListener('change', applyPeriod));
      root.querySelector('#dep-new').onclick = () => openDepenseForm({});
      root.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const d = DB.get('depenses', b.dataset.id);
        if (!d) return;
        if (b.dataset.act === 'edit') openDepenseForm({ depense: d });
        if (b.dataset.act === 'del') {
          confirmBox(`Supprimer la dépense « ${d.description} » de ${fmt(d.montant)} ?`, { okLabel: 'Supprimer' }).then(ok => {
            if (ok) DB.commit([{ op: 'del', store: 'depenses', id: d.id }, DB.logOp('Suppression dépense', `${d.description} — ${fmt(d.montant)}`, App.user)]).then(() => { toast('Dépense supprimée.'); App.refresh(); });
          });
        }
      });
    }
  };

  function openDepenseForm({ depense = null }) {
    const d = depense || { date: todayStr(), categorie: 'Électricité', description: '', montant: '', moyenPaiement: 'Espèces' };
    const isEdit = !!depense;
    let justificatif = depense ? depense.justificatif : '';
    let justificatifNom = depense ? depense.justificatifNom : '';
    openModal({
      title: isEdit ? 'Modifier la dépense' : 'Nouvelle dépense',
      body: `<form id="dep-form" class="form-grid">
        ${field('Date', `<input class="input" type="date" name="date" value="${h(d.date)}" required>`)}
        ${field('Catégorie', `<select class="select" name="categorie">${EXPENSE_CATS.map(c => `<option ${c === d.categorie ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
        <div class="span-2">${field('Description', `<input class="input" name="description" value="${h(d.description)}" required placeholder="Ex. : facture Eneo de mars">`)}</div>
        ${field('Montant (FCFA)', `<input class="input" type="number" min="1" step="100" name="montant" value="${h(d.montant)}" required>`)}
        ${field('Moyen de paiement', `<select class="select" name="moyenPaiement">${PAY_MODES.map(m => `<option ${m === d.moyenPaiement ? 'selected' : ''}>${m}</option>`).join('')}</select>`)}
        <div class="span-2">${field('Justificatif (facultatif, image ou PDF, 1,5 Mo max.)', `<input class="input" type="file" accept="image/*,application/pdf" id="dep-file">`, justificatifNom ? 'Actuel : ' + justificatifNom : '')}</div>
        <div class="span-2"><p class="form-error" id="dep-err"></p></div>
      </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="dep-form">Enregistrer</button>`,
      onMount: (el, close) => {
        el.querySelector('#dep-file').addEventListener('change', e => {
          const file = e.target.files[0];
          if (!file) return;
          if (file.size > 1.5 * 1024 * 1024) { el.querySelector('#dep-err').textContent = 'Fichier trop lourd (1,5 Mo maximum).'; e.target.value = ''; return; }
          const reader = new FileReader();
          reader.onload = () => { justificatif = reader.result; justificatifNom = file.name; el.querySelector('#dep-err').textContent = ''; };
          reader.readAsDataURL(file);
        });
        el.querySelector('#dep-form').addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(e.target);
          if (num(f.montant) <= 0) { el.querySelector('#dep-err').textContent = 'Montant invalide.'; return; }
          const obj = { id: isEdit ? d.id : uid(), date: f.date, categorie: f.categorie, description: f.description, montant: num(f.montant), moyenPaiement: f.moyenPaiement, justificatif: justificatif || '', justificatifNom: justificatifNom || '' };
          const ops = [{ op: 'put', store: 'depenses', obj }];
          if (isEdit && num(d.montant) !== obj.montant) ops.push(DB.logOp('Modification de montant de dépense', `${obj.description} : ${fmtNum(d.montant)} → ${fmtNum(obj.montant)}`, App.user));
          await DB.commit(ops);
          toast('Dépense enregistrée.');
          close();
          App.refresh();
        });
      }
    });
  }

  /* =========================================================
     FINANCES ET RENTABILITÉ
     ========================================================= */
  const FIN = { period: { key: 'mois', from: '', to: '' } };

  PAGES.finances = {
    label: 'Finances & rentabilité', icon: '📈', roles: ['admin'],
    render(root) {
      const pr = periodRange(FIN.period.key, FIN.period);
      const f = periodFinance(pr.from, pr.to);
      const marge = f.ca > 0 ? Math.round(f.benefNet / f.ca * 100) : 0;
      const byMode = {};
      f.txs.forEach(t => (t.paiements || []).forEach(p => { byMode[p.mode] = (byMode[p.mode] || 0) + num(p.montant); }));
      root.innerHTML = `
        ${pageHead('Finances & rentabilité', 'Situation réelle du salon sur la période choisie', '')}
        <div class="toolbar">${periodControls('fin', FIN.period.key, FIN.period.from || pr.from, FIN.period.to || pr.to)}</div>
        <div class="kpi-grid">
          ${kpi('Recettes encaissées', fmt(f.encaisse), 'Argent réellement reçu', 'success')}
          ${kpi('Chiffre d\'affaires', fmt(f.ca), 'Ventes nettes de réductions', 'accent')}
          ${kpi('Bénéfice brut', fmt(f.benefBrut), 'CA − coût des produits vendus', f.benefBrut >= 0 ? '' : 'danger')}
          ${kpi('Bénéfice net estimé', fmt(f.benefNet), `Marge : ${marge} %`, f.benefNet >= 0 ? 'success' : 'danger')}
        </div>
        <div class="grid-2">
          <div class="card"><div class="card-head"><h3>Compte de résultat — ${h(pr.label)}</h3></div>
            <div class="total-line"><span>Chiffre d'affaires (ventes nettes)</span><strong>${fmt(f.ca)}</strong></div>
            <div class="total-line"><span>− Coût des produits vendus</span><span>${fmt(f.cogs)}</span></div>
            <div class="total-line" style="border-top:1px solid var(--border);padding-top:8px"><span><strong>= Bénéfice brut</strong></span><strong>${fmt(f.benefBrut)}</strong></div>
            <div class="total-line"><span>− Commissions du personnel</span><span>${fmt(f.commissions)}</span></div>
            <div class="total-line"><span>− Salaires fixes (prorata)</span><span>${fmt(f.salairesFixes)}</span></div>
            <div class="total-line"><span>− Autres charges (hors achats et salaires)</span><span>${fmt(f.chargesDeduites)}</span></div>
            <div class="total-line big"><span>Bénéfice net estimé</span><span>${fmt(f.benefNet)}</span></div>
          </div>
          <div class="card"><div class="card-head"><h3>Distinguer les flux</h3></div>
            <ul class="list-plain">
              <li><span><strong>Encaissements</strong><br><small class="muted">Argent reçu (espèces, Mobile Money, virements)</small></span><strong>${fmt(f.encaisse)}</strong></li>
              <li><span><strong>Ventes</strong><br><small class="muted">Valeur des prestations et produits vendus</small></span><strong>${fmt(f.ca)}</strong></li>
              <li><span><strong>Créances (solde non payé)</strong><br><small class="muted">Ventes − encaissements</small></span><strong>${fmt(Math.max(0, f.ca - f.encaisse))}</strong></li>
              <li><span><strong>Dépenses (sorties de caisse)</strong><br><small class="muted">Toutes les dépenses saisies</small></span><strong>${fmt(f.totalDepenses)}</strong></li>
              <li><span><strong>Prestations réalisées</strong><br><small class="muted">Nombre de prestations sur la période</small></span><strong>${fmtNum(f.nbPrestations)}</strong></li>
            </ul>
            <h3 style="margin:16px 0 8px;font-size:1rem">Encaissements par moyen de paiement</h3>
            ${table(['Moyen', 'Montant'], Object.entries(byMode).sort((a, b) => b[1] - a[1]).map(([m, v]) => [h(m), `<span class="num">${fmt(v)}</span>`]), { empty: 'Aucun encaissement sur la période.' })}
          </div>
        </div>
        <div class="card"><div class="card-head"><h3>Évolution de la rentabilité — ${FIN_YEAR()}</h3></div>
          <div class="chart-box tall"><canvas id="ch-fin"></canvas></div></div>`;

      const pc = root.querySelector('#fin-p');
      pc.addEventListener('change', () => {
        root.querySelector('#fin-custom').classList.toggle('hidden', pc.value !== 'perso');
        if (pc.value !== 'perso') { FIN.period = { key: pc.value }; App.refresh(); }
      });
      ['#fin-from', '#fin-to'].forEach(s => root.querySelector(s).addEventListener('change', () => {
        const p = readPeriod('fin'); FIN.period = { key: 'perso', from: p.from, to: p.to }; App.refresh();
      }));
      drawFinChart();
    }
  };
  const FIN_YEAR = () => ymd().slice(0, 4);

  function drawFinChart() {
    const y = ymd().slice(0, 4);
    const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const ca = [], net = [], dep = [];
    for (let m = 1; m <= 12; m++) {
      const from = `${y}-${String(m).padStart(2, '0')}-01`;
      const f = periodFinance(from, monthEnd(from));
      ca.push(f.ca); net.push(f.benefNet); dep.push(f.totalDepenses);
    }
    makeChart('ch-fin', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Chiffre d\'affaires', data: ca, backgroundColor: '#e9b8cc', borderRadius: 6 },
          { label: 'Dépenses', data: dep, backgroundColor: '#c9a0bb', borderRadius: 6 },
          { type: 'line', label: 'Bénéfice net', data: net, borderColor: '#6b1d4f', backgroundColor: '#6b1d4f', tension: .3 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => fmtNum(v) } } } }
    });
  }

  /* =========================================================
     RAPPORTS
     ========================================================= */
  const REPORTS = [
    ['journalier', 'Rapport journalier'], ['hebdomadaire', 'Rapport hebdomadaire'], ['mensuel', 'Rapport mensuel'],
    ['annuel', 'Rapport annuel'], ['prestations', 'Rapport des prestations'], ['clients', 'Rapport des clients'],
    ['employes', 'Rapport des employés'], ['ventes', 'Rapport des ventes'], ['depenses', 'Rapport des dépenses'],
    ['stocks', 'Rapport des stocks'], ['rentabilite', 'Rapport de rentabilité']
  ];
  const RPT = { type: 'mensuel', period: { key: 'mois', from: '', to: '' } };

  /* Découpe une période en tranches (jour, semaine, mois) */
  function buckets(gran, from, to) {
    const out = [];
    if (gran === 'day') {
      for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push({ label: fmtDate(d), from: d, to: d });
    } else if (gran === 'week') {
      for (let s = startOfWeek(from); s <= to && out.length < 200; s = addDays(s, 7)) {
        const e = addDays(s, 6);
        out.push({ label: `Sem. du ${fmtDate(s)}`, from: s < from ? from : s, to: e > to ? to : e });
      }
    } else {
      for (let m = monthStart(from); m <= to && out.length < 120; m = addDays(monthEnd(m), 1)) {
        const e = monthEnd(m);
        const mm = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][parseYmd(m).getMonth()];
        out.push({ label: `${mm} ${m.slice(0, 4)}`, from: m < from ? from : m, to: e > to ? to : e });
      }
    }
    return out;
  }

  /* Construit un rapport : en-têtes, lignes et total, pour l'affichage, l'impression et le CSV */
  function buildReport(type, from, to) {
    const title = REPORTS.find(r => r[0] === type)[1];
    const sub = `Période : du ${fmtDate(from)} au ${fmtDate(to)}`;
    const salon = DB.settings().nom;
    switch (type) {
      case 'journalier': case 'hebdomadaire': case 'mensuel': case 'annuel': {
        const gran = { journalier: 'day', hebdomadaire: 'week', mensuel: 'month', annuel: 'month' }[type];
        const rows = buckets(gran, from, to).map(b => {
          const f = periodFinance(b.from, b.to);
          return [b.label, f.nbPrestations, f.txs.length, f.ca, f.encaisse, f.commissions, f.totalDepenses, f.benefNet];
        });
        const tot = rows.reduce((a, r) => r.map((v, i) => i === 0 ? 'Total' : (typeof v === 'number' ? (a[i] || 0) + v : v)), []);
        const totals = tot.length ? tot : ['Total', 0, 0, 0, 0, 0, 0, 0];
        return { title, sub, salon, headers: ['Période', 'Prestations', 'Ventes (nb)', 'CA (FCFA)', 'Encaissé (FCFA)', 'Commissions (FCFA)', 'Dépenses (FCFA)', 'Bénéfice net (FCFA)'], rows, totals };
      }
      case 'prestations': {
        const stats = {};
        periodFinance(from, to).txs.forEach(t => (t.lignes || []).forEach(l => {
          if (l.type !== 'prestation') return;
          const s = stats[l.nom] || (stats[l.nom] = { n: 0, ca: 0 });
          s.n += num(l.quantite); s.ca += num(l.montantNet);
        }));
        const total = Object.values(stats).reduce((s, x) => s + x.ca, 0);
        const rows = Object.entries(stats).sort((a, b) => b[1].ca - a[1].ca).map(([nom, s]) => [nom, s.n, s.ca, s.n ? Math.round(s.ca / s.n) : 0, total ? Math.round(s.ca * 100 / total) : 0]);
        return { title, sub, salon, headers: ['Prestation', 'Nombre', 'CA (FCFA)', 'Prix moyen (FCFA)', 'Part du CA (%)'], rows, totals: ['Total', rows.reduce((s, r) => s + r[1], 0), total, '', 100] };
      }
      case 'clients': {
        const rows = DB.all('clients').sort(sortByName).map(c => {
          const txs = clientStats(c.id).txs.filter(t => t.date >= from && t.date <= to);
          const total = txs.reduce((s, t) => s + num(t.montantNet), 0);
          const last = txs[0] ? txs[0].date : '';
          return [c.code || '', `${c.nom} ${c.prenom}`.trim(), c.telephone || '', txs.length, total, fmtDate(last), clientStatus(c).label];
        });
        return { title, sub, salon, headers: ['Code', 'Client', 'Téléphone', 'Visites (période)', 'Dépensé (FCFA)', 'Dernière visite', 'Statut'], rows,
          totals: ['Total', '', '', rows.reduce((s, r) => s + r[3], 0), rows.reduce((s, r) => s + r[4], 0), '', ''] };
      }
      case 'employes': {
        const rows = DB.all('employees').sort(sortByName).map(e => {
          const st = employeeStats(e.id, from, to);
          const mv = DB.all('mouvements_personnel').filter(m => m.employeeId === e.id && m.date >= from && m.date <= to);
          const av = mv.filter(m => m.type === 'avance').reduce((s, m) => s + num(m.montant), 0);
          const pa = mv.filter(m => m.type === 'paiement').reduce((s, m) => s + num(m.montant), 0);
          return [`${e.prenom} ${e.nom}`, ROLE_MODE[e.modeRemuneration] || '', st.nb, st.ca, st.commissions, av, pa, employeeBalance(e).solde];
        });
        const sum = i => rows.reduce((s, r) => s + num(r[i]), 0);
        return { title, sub, salon, headers: ['Coiffeur', 'Rémunération', 'Prestations', 'CA généré (FCFA)', 'Commissions (FCFA)', 'Avances (FCFA)', 'Paiements (FCFA)', 'Solde à payer (FCFA)'], rows,
          totals: ['Total', '', sum(2), sum(3), sum(4), sum(5), sum(6), sum(7)] };
      }
      case 'ventes': {
        const txs = txInRange(from, to).sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
        const rows = txs.map(t => [t.numero, fmtDate(t.date) + ' ' + t.heure, t.clientNom, (t.lignes || []).map(l => l.nom).join(', '), t.montantBrut, t.reduction, t.montantNet, t.montantPaye, t.solde, t.modePaiement]);
        return { title, sub, salon, headers: ['N° reçu', 'Date', 'Client', 'Prestations / produits', 'Brut', 'Réduction', 'Net', 'Payé', 'Solde', 'Paiement'], rows,
          totals: ['Total', '', '', `${txs.length} vente(s)`, sum(txs, 'montantBrut'), sum(txs, 'reduction'), sum(txs, 'montantNet'), sum(txs, 'montantPaye'), sum(txs, 'solde'), ''] };
      }
      case 'depenses': {
        const deps = DB.all('depenses').filter(d => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date));
        const rows = deps.map(d => [fmtDate(d.date), d.categorie, d.description, num(d.montant), d.moyenPaiement || '']);
        return { title, sub, salon, headers: ['Date', 'Catégorie', 'Description', 'Montant (FCFA)', 'Paiement'], rows,
          totals: ['Total', '', `${deps.length} dépense(s)`, deps.reduce((s, d) => s + num(d.montant), 0), ''] };
      }
      case 'stocks': {
        const rows = DB.all('produits').sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map(p => [p.nom, p.categorie || '', p.quantite, p.prixAchat, num(p.quantite) * num(p.prixAchat), p.seuil, stockStatus(p).label]);
        return { title, sub: 'État du stock à la date du jour', salon, headers: ['Produit', 'Catégorie', 'Quantité', 'Prix achat (FCFA)', 'Valeur (FCFA)', 'Seuil', 'Statut'], rows,
          totals: ['Total', '', rows.reduce((s, r) => s + num(r[2]), 0), '', rows.reduce((s, r) => s + num(r[4]), 0), '', ''] };
      }
      case 'rentabilite': {
        const f = periodFinance(from, to);
        const marge = f.ca > 0 ? Math.round(f.benefNet * 100 / f.ca) : 0;
        const rows = [
          ['Encaissements', f.encaisse], ['Chiffre d\'affaires (ventes nettes)', f.ca], ['Coût des produits vendus', f.cogs],
          ['Bénéfice brut', f.benefBrut], ['Commissions du personnel', f.commissions], ['Salaires fixes (prorata)', f.salairesFixes],
          ['Autres charges (hors achats et salaires)', f.chargesDeduites], ['Bénéfice net estimé', f.benefNet], ['Marge nette (%)', marge],
          ['Dépenses totales (sorties de caisse, information)', f.totalDepenses]
        ];
        return { title, sub, salon, headers: ['Indicateur', 'Montant'], rows, totals: null };
      }
      default: return null;
    }
  }
  function sum(arr, key) { return arr.reduce((s, x) => s + num(x[key]), 0); }

  function reportHtml(rep) {
    const cell = v => typeof v === 'number' ? fmtNum(v) : h(v);
    const head = `<div class="center"><h2>${h(rep.salon)}</h2><div><strong>${h(rep.title)}</strong></div><div class="muted">${h(rep.sub)}</div><div class="muted">Édité le ${fmtLongDate(ymd())}</div></div>`;
    const tbl = `<table><thead><tr>${rep.headers.map((x, i) => `<th class="${i ? 'right' : ''}">${h(x)}</th>`).join('')}</tr></thead>
      <tbody>${rep.rows.map(r => `<tr>${r.map((v, i) => `<td class="${i ? 'right' : ''}">${cell(v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${rep.headers.length}">Aucune donnée</td></tr>`}</tbody>
      ${rep.totals ? `<tfoot><tr>${rep.totals.map((v, i) => `<th class="${i ? 'right' : ''}">${cell(v)}</th>`).join('')}</tr></tfoot>` : ''}</table>`;
    return head + tbl;
  }

  function reportCsv(rep) {
    const esc = v => { const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [[rep.salon], [rep.title], [rep.sub], [], rep.headers, ...rep.rows];
    if (rep.totals) lines.push(rep.totals);
    return '﻿' + lines.map(r => r.map(esc).join(';')).join('\r\n');
  }

  PAGES.rapports = {
    label: 'Rapports', icon: '📑', roles: ['admin'],
    render(root) {
      const pr = periodRange(RPT.period.key, RPT.period);
      const rep = buildReport(RPT.type, pr.from, pr.to);
      root.innerHTML = `
        ${pageHead('Rapports et statistiques', 'Générez, imprimez (PDF) ou exportez vos rapports', `
          <button class="btn light" id="rp-csv">Exporter Excel (CSV)</button>
          <button class="btn primary" id="rp-print">Imprimer / PDF</button>`)}
        <div class="toolbar">
          <select class="select" id="rp-type">${REPORTS.map(([k, l]) => `<option value="${k}" ${k === RPT.type ? 'selected' : ''}>${l}</option>`).join('')}</select>
          ${periodControls('rp', RPT.period.key, RPT.period.from || pr.from, RPT.period.to || pr.to)}
        </div>
        <div class="card">
          <div class="card-head"><div><h3>${h(rep.title)}</h3><small class="muted">${h(rep.sub)}</small></div></div>
          ${table(rep.headers, rep.rows.map(r => r.map((v, i) => typeof v === 'number' ? `<span class="num">${fmtNum(v)}</span>` : (i ? `<span class="num">${h(v)}</span>` : h(v)))),
            { empty: 'Aucune donnée pour cette période.' }).replace('<tbody>', '<tbody>')}
          ${rep.totals ? `<div class="row-between" style="margin-top:10px;font-weight:800">${rep.totals.map((v, i) => `<span>${typeof v === 'number' ? fmtNum(v) : h(v)}</span>`).join('<span class="muted">·</span>')}</div>` : ''}
        </div>`;

      root.querySelector('#rp-type').onchange = e => { RPT.type = e.target.value; App.refresh(); };
      const pc = root.querySelector('#rp-p');
      pc.addEventListener('change', () => {
        root.querySelector('#rp-custom').classList.toggle('hidden', pc.value !== 'perso');
        if (pc.value !== 'perso') { RPT.period = { key: pc.value }; App.refresh(); }
      });
      ['#rp-from', '#rp-to'].forEach(s => root.querySelector(s).addEventListener('change', () => {
        const p = readPeriod('rp'); RPT.period = { key: 'perso', from: p.from, to: p.to }; App.refresh();
      }));
      root.querySelector('#rp-print').onclick = () => printHtml(reportHtml(rep), rep.title);
      root.querySelector('#rp-csv').onclick = () => {
        downloadBlob(reportCsv(rep), `${RPT.type}-${pr.from}-${pr.to}.csv`, 'text/csv;charset=utf-8');
        toast('Export CSV téléchargé (ouvrable dans Excel).');
      };
    }
  };

  /* =========================================================
     PARAMÈTRES (salon, utilisateurs, sauvegarde)
     ========================================================= */
  const PAR = { tab: 'salon' };
  const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  PAGES.parametres = {
    label: 'Paramètres', icon: '⚙', roles: ['admin'],
    render(root) {
      root.innerHTML = `
        ${pageHead('Paramètres', 'Salon, comptes utilisateurs et sauvegarde des données')}
        <div class="tabs">
          <button class="tab ${PAR.tab === 'salon' ? 'on' : ''}" data-tab="salon">Salon et reçus</button>
          <button class="tab ${PAR.tab === 'utilisateurs' ? 'on' : ''}" data-tab="utilisateurs">Utilisateurs et accès</button>
          <button class="tab ${PAR.tab === 'sauvegarde' ? 'on' : ''}" data-tab="sauvegarde">Sauvegarde</button>
        </div>
        <div id="par-body"></div>`;
      root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { PAR.tab = b.dataset.tab; App.refresh(); });
      const body = root.querySelector('#par-body');
      if (PAR.tab === 'salon') drawSalon(body);
      if (PAR.tab === 'utilisateurs') drawUsers(body);
      if (PAR.tab === 'sauvegarde') drawBackup(body);
    }
  };

  function drawSalon(body) {
    const s = DB.settings();
    body.innerHTML = `<div class="card"><form id="salon-form" class="form-grid">
        ${field('Nom du salon', `<input class="input" name="nom" value="${h(s.nom)}" required>`)}
        ${field('Téléphone', `<input class="input" name="telephone" value="${h(s.telephone)}">`)}
        <div class="span-2">${field('Adresse', `<input class="input" name="adresse" value="${h(s.adresse)}">`)}</div>
        ${field('Adresse électronique', `<input class="input" type="email" name="email" value="${h(s.email)}">`)}
        ${field('Horaires d\'ouverture', `<input class="input" name="horaires" value="${h(s.horaires)}" placeholder="08:00 - 19:00">`)}
        <div class="span-2">${field('Jours de fermeture', `<div class="check-row">${JOURS.map((j, i) => `<label><input type="checkbox" name="jf" value="${i}" ${s.joursFermeture.includes(i) ? 'checked' : ''}> ${j}</label>`).join('')}</div>`)}</div>
        ${field('Durée par défaut d\'un rendez-vous (min)', `<input class="input" type="number" min="5" step="5" name="dureeRdvDefaut" value="${h(s.dureeRdvDefaut)}">`)}
        ${field('Devise', `<input class="input" value="FCFA" disabled>`)}
        <div class="span-2">${field('Message en bas du reçu', `<input class="input" name="piedRecu" value="${h(s.piedRecu)}">`)}</div>
        <div class="span-2">${field('Logo (facultatif, 300 Ko max.)', `<input class="input" type="file" accept="image/*" id="logo-file">`)}
          <div class="row-between" style="margin-top:8px">${s.logo ? `<img src="${s.logo}" alt="Logo" style="max-height:70px;border-radius:10px">` : '<span class="muted small">Aucun logo</span>'}
          ${s.logo ? '<button type="button" class="link-btn danger-link" id="logo-del">Retirer le logo</button>' : ''}</div></div>
        <div class="span-2"><p class="form-error" id="salon-err"></p></div>
        <div class="span-2"><button class="btn primary" type="submit">Enregistrer les paramètres</button></div>
      </form></div>`;
    let logo = s.logo;
    body.querySelector('#logo-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 300 * 1024) { body.querySelector('#salon-err').textContent = 'Logo trop lourd (300 Ko maximum).'; e.target.value = ''; return; }
      const r = new FileReader();
      r.onload = () => { logo = r.result; body.querySelector('#salon-err').textContent = ''; toast('Logo chargé : enregistrez pour l\'appliquer.', 'warn'); };
      r.readAsDataURL(file);
    });
    const del = body.querySelector('#logo-del');
    if (del) del.onclick = () => { logo = ''; toast('Logo retiré : enregistrez pour valider.', 'warn'); };
    body.querySelector('#salon-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = formData(e.target);
      const jf = [...e.target.querySelectorAll('input[name=jf]:checked')].map(x => Number(x.value));
      await DB.put('settings', { ...DB.settings(), nom: f.nom || 'Mon Salon', telephone: f.telephone, adresse: f.adresse, email: f.email, horaires: f.horaires, joursFermeture: jf, dureeRdvDefaut: num(f.dureeRdvDefaut) || 30, piedRecu: f.piedRecu, logo });
      toast('Paramètres enregistrés.');
      App.refresh();
    });
  }

  function drawUsers(body) {
    const users = DB.all('users').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    body.innerHTML = `<div class="toolbar"><button class="btn primary" id="u-new">+ Nouvel utilisateur</button></div>
      <div class="alert info">Administrateur : accès total. Réceptionniste : clients, rendez-vous, caisse, prestations et stock. Coiffeur : son planning, ses prestations et ses commissions.</div>
      ${table(['Nom', 'Identifiant', 'Rôle', 'Coiffeur lié', 'Actions'], users.map(u => [
        h(u.nom), h(u.identifiant), badge(ROLES[u.role], u.role === 'admin' ? 'accent' : ''), h(u.employeeId ? employeeName(u.employeeId) : '—'),
        `<div class="actions-cell"><button class="link-btn" data-act="edit" data-id="${h(u.id)}">Modifier</button>
         <button class="link-btn danger-link" data-act="del" data-id="${h(u.id)}">Supprimer</button></div>`
      ]))}`;
    body.querySelector('#u-new').onclick = () => openUserForm({});
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const u = DB.get('users', b.dataset.id);
      if (!u) return;
      if (b.dataset.act === 'edit') openUserForm({ user: u });
      if (b.dataset.act === 'del') deleteUser(u);
    });
  }

  function deleteUser(u) {
    if (u.id === App.user.id) { toast('Vous ne pouvez pas supprimer votre propre compte.', 'warn'); return; }
    const admins = DB.all('users').filter(x => x.role === 'admin');
    if (u.role === 'admin' && admins.length <= 1) { toast('Il doit rester au moins un administrateur.', 'warn'); return; }
    confirmBox(`Supprimer le compte « ${u.identifiant} » ?`, { okLabel: 'Supprimer' }).then(ok => {
      if (ok) DB.commit([{ op: 'del', store: 'users', id: u.id }, DB.logOp('Suppression utilisateur', u.identifiant, App.user)]).then(() => { toast('Compte supprimé.'); App.refresh(); });
    });
  }

  function openUserForm({ user = null }) {
    const u = user || { nom: '', identifiant: '', role: 'receptionniste', employeeId: '' };
    const isEdit = !!user;
    const staff = activeEmployees();
    openModal({
      title: isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur',
      body: `<form id="u-form" class="form-grid">
        ${field('Nom complet', `<input class="input" name="nom" value="${h(u.nom)}" required>`)}
        ${field('Identifiant', `<input class="input" name="identifiant" value="${h(u.identifiant)}" required autocomplete="off">`)}
        ${field('Rôle', `<select class="select" name="role" id="u-role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${field('Coiffeur lié (pour le rôle Coiffeur)', `<select class="select" name="employeeId">${optionsList(staff.map(e => ({ value: e.id, label: `${e.prenom} ${e.nom}` })), u.employeeId, { placeholder: '— Aucun —' })}</select>`)}
        <div class="span-2">${field(isEdit ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe', `<input class="input" type="password" name="motdepasse" ${isEdit ? '' : 'required'} minlength="4" autocomplete="new-password">`, 'Au moins 4 caractères')}</div>
        <div class="span-2"><p class="form-error" id="u-err"></p></div>
      </form>`,
      footer: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="u-form">Enregistrer</button>`,
      onMount: (el, close) => {
        el.querySelector('#u-form').addEventListener('submit', async e => {
          e.preventDefault();
          const f = formData(e.target);
          const err = el.querySelector('#u-err');
          const dup = DB.all('users').find(x => x.identifiant.toLowerCase() === f.identifiant.toLowerCase() && x.id !== u.id);
          if (dup) { err.textContent = 'Cet identifiant existe déjà.'; return; }
          if (f.role === 'coiffeur' && !f.employeeId) { err.textContent = 'Liez ce compte à une fiche coiffeur.'; return; }
          if (isEdit && u.role === 'admin' && f.role !== 'admin' && DB.all('users').filter(x => x.role === 'admin').length <= 1) { err.textContent = 'Il doit rester au moins un administrateur.'; return; }
          if (!isEdit && f.motdepasse.length < 4) { err.textContent = 'Mot de passe trop court.'; return; }
          const obj = { id: isEdit ? u.id : uid(), nom: f.nom, identifiant: f.identifiant, role: f.role, employeeId: f.role === 'coiffeur' ? f.employeeId : '', passwordHash: isEdit ? u.passwordHash : '' };
          if (f.motdepasse) obj.passwordHash = await hashPassword(f.motdepasse);
          await DB.commit([{ op: 'put', store: 'users', obj }, DB.logOp(isEdit ? 'Modification utilisateur' : 'Création utilisateur', `${obj.identifiant} (${ROLES[obj.role]})`, App.user)]);
          toast('Utilisateur enregistré.');
          close();
          App.refresh();
        });
      }
    });
  }

  function drawBackup(body) {
    const counts = Object.fromEntries(['clients', 'transactions', 'rdv', 'produits', 'depenses', 'employees', 'services'].map(k => [k, DB.all(k).length]));
    body.innerHTML = `
      <div class="grid-2">
        <div class="card"><div class="card-head"><h3>Exporter une sauvegarde</h3></div>
          <p class="muted">Un fichier JSON contenant toutes les données : clients, prestations, rendez-vous, ventes, personnel, stock, dépenses, utilisateurs et journal.</p>
          <p class="small">Contenu actuel : ${counts.clients} clients · ${counts.transactions} ventes · ${counts.rdv} rendez-vous · ${counts.employees} coiffeurs · ${counts.services} prestations · ${counts.produits} produits · ${counts.depenses} dépenses.</p>
          <button class="btn primary" id="bk-export">Télécharger la sauvegarde</button></div>
        <div class="card"><div class="card-head"><h3>Restaurer une sauvegarde</h3></div>
          <div class="alert">Attention : la restauration remplace toutes les données actuelles. Exportez d'abord une sauvegarde de sécurité.</div>
          <input class="input" type="file" accept="application/json,.json" id="bk-file">
          <p class="form-error" id="bk-err"></p></div>
      </div>
      <div class="card"><div class="card-head"><h3>Conseil</h3></div>
        <p class="muted">Les données sont conservées dans ce navigateur. Pour ne rien perdre (changement d'ordinateur, nettoyage du navigateur), téléchargez une sauvegarde régulièrement, par exemple chaque semaine.</p></div>`;

    body.querySelector('#bk-export').onclick = () => {
      const data = DB.exportAll();
      const d = ymd();
      downloadBlob(JSON.stringify(data, null, 2), `sauvegarde-beauty-salon-${d}.json`, 'application/json');
      DB.commit([DB.logOp('Sauvegarde exportée', `Fichier du ${fmtDate(d)}`, App.user)]);
      toast('Sauvegarde téléchargée.');
    };
    body.querySelector('#bk-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let payload;
        try { payload = JSON.parse(reader.result); } catch (err) { body.querySelector('#bk-err').textContent = 'Fichier illisible (JSON invalide).'; return; }
        if (!payload.app || payload.app !== 'beauty-salon-manager') { body.querySelector('#bk-err').textContent = 'Ce fichier n\'est pas une sauvegarde de BEAUTY SALON MANAGER.'; return; }
        const ok = await confirmBox(`Restaurer la sauvegarde du ${fmtDate((payload.exportedAt || '').slice(0, 10))} ? Toutes les données actuelles seront remplacées.`, { okLabel: 'Restaurer et remplacer' });
        if (!ok) { e.target.value = ''; return; }
        try {
          await DB.importAll(payload);
          const still = DB.get('users', App.user.id);
          if (!still) {
            toast('Sauvegarde restaurée. Connectez-vous avec un compte de cette sauvegarde.');
            Session.clear();
            App.user = null;
            location.hash = '';
            showAuth();
          } else {
            toast('Sauvegarde restaurée avec succès.');
            App.refresh();
          }
        } catch (err) { body.querySelector('#bk-err').textContent = err.message; }
      };
      reader.readAsText(file);
    });
  }

  /* =========================================================
     JOURNAL (opérations sensibles)
     ========================================================= */
  const JOU = { q: '' };
  PAGES.journal = {
    label: 'Journal', icon: '🗂', roles: ['admin'],
    render(root) {
      root.innerHTML = `${pageHead('Journal des opérations', 'Suppressions, modifications de prix et de paiements, sauvegardes, comptes')}
        <div class="toolbar"><div class="search"><input class="input" id="jou-q" placeholder="Filtrer (action, utilisateur, détail)..." value="${h(JOU.q)}"></div></div>
        <div id="jou-list"></div>`;
      const draw = () => {
        const q = JOU.q.toLowerCase();
        const items = DB.all('journal').sort((a, b) => b.date.localeCompare(a.date)).filter(j => !q || `${j.action} ${j.utilisateur} ${j.details}`.toLowerCase().includes(q)).slice(0, 500);
        root.querySelector('#jou-list').innerHTML = table(['Date et heure', 'Utilisateur', 'Action', 'Détail'], items.map(j => {
          const d = new Date(j.date);
          return [`${fmtDate(ymd(d))} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`, h(j.utilisateur), badge(j.action, /Suppression|Changement|Modification de montant/.test(j.action) ? 'warn' : 'info'), h(j.details)];
        }), { empty: 'Aucune opération enregistrée.' });
      };
      draw();
      root.querySelector('#jou-q').addEventListener('input', e => { JOU.q = e.target.value; draw(); });
    }
  };
  const pad2 = n => String(n).padStart(2, '0');

  /* =========================================================
     ESPACE COIFFEUR (rôle Coiffeur)
     ========================================================= */
  PAGES['mon-espace'] = {
    label: 'Mon espace', icon: '🪞', roles: ['coiffeur'],
    render(root, user) {
      const emp = DB.get('employees', user.employeeId);
      if (!emp) { root.innerHTML = `<div class="empty">Aucune fiche coiffeur n'est liée à votre compte. Demandez à l'administrateur de la lier.</div>`; return; }
      const t = todayStr();
      const mo = periodRange('mois');
      const st = employeeStats(emp.id, mo.from, mo.to);
      const bal = employeeBalance(emp);
      const rdvDuJour = DB.all('rdv').filter(r => r.employeeId === emp.id && r.date === t).sort((a, b) => a.heure.localeCompare(b.heure));
      const lignes = [];
      DB.all('transactions').forEach(tx => (tx.lignes || []).forEach(l => {
        if (l.type === 'prestation' && l.employeeId === emp.id) lignes.push({ date: tx.date, heure: tx.heure, client: tx.clientNom, ...l });
      }));
      lignes.sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
      root.innerHTML = `
        <div class="card"><div class="profile-head"><div class="avatar">${h((emp.prenom[0] || '') + (emp.nom[0] || ''))}</div>
          <div><h2>${h(emp.prenom)} ${h(emp.nom)}</h2><div class="muted">${h(emp.fonction || 'Coiffeur(se)')} · ${h(ROLE_MODE[emp.modeRemuneration])}</div></div></div></div>
        <div class="kpi-grid">
          ${kpi('Prestations (ce mois)', fmtNum(st.nb), '', 'accent')}
          ${kpi('CA généré (ce mois)', fmt(st.ca), '')}
          ${kpi('Commissions (ce mois)', fmt(st.commissions), '', 'success')}
          ${kpi('Solde à recevoir', fmt(Math.max(0, bal.solde)), `Avances ${fmt(bal.avances)} · Paiements ${fmt(bal.paiements)}`, 'info')}
        </div>
        <div class="grid-2">
          <div class="card"><div class="card-head"><h3>Mon planning d'aujourd'hui</h3><button class="btn ghost small" data-go="rdv">Voir le planning</button></div>
            ${rdvDuJour.length ? `<ul class="list-plain">${rdvDuJour.map(r => `<li><span><strong>${h(r.heure)}</strong> · ${h(clientName(r.clientId))}<br><small class="muted">${h(serviceName(r.serviceId))}</small></span>${badge(r.statut, STATUT_CLASS[r.statut])}</li>`).join('')}</ul>`
              : `<div class="empty">Aucun rendez-vous aujourd'hui.</div>`}</div>
          <div class="card"><div class="card-head"><h3>Mes commissions</h3></div>
            <div class="total-line"><span>Commissions acquises (total)</span><strong>${fmt(bal.commissions)}</strong></div>
            <div class="total-line"><span>Salaire fixe acquis</span><strong>${fmt(bal.salaire)}</strong></div>
            <div class="total-line"><span>Avances reçues</span><span>- ${fmt(bal.avances)}</span></div>
            <div class="total-line"><span>Paiements effectués</span><span>- ${fmt(bal.paiements)}</span></div>
            <div class="total-line big"><span>Solde restant à payer</span><span>${fmt(bal.solde)}</span></div>
          </div>
        </div>
        <div class="card"><div class="card-head"><h3>Mes dernières prestations</h3></div>
          ${table(['Date', 'Client', 'Prestation', 'Montant net', 'Commission'], lignes.slice(0, 50).map(l => [
            fmtDate(l.date), h(l.client), h(l.nom), `<span class="num">${fmt(l.montantNet)}</span>`, `<span class="num">${fmt(l.commission)}</span>`
          ]), { empty: 'Aucune prestation enregistrée pour le moment.' })}
        </div>`;
      root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { location.hash = '#/' + b.dataset.go; });
    }
  };

  /* Accès aux fonctions utilisées par core.js */
  window.downloadBlob = downloadBlob;
})();
