/* =========================================================
   BEAUTY SALON MANAGER — couche de données (IndexedDB)
   Principe : une copie en mémoire (cache) pour un affichage
   immédiat, et des écritures persistantes dans IndexedDB.
   Chaque opération métier qui touche plusieurs magasins
   (ex. vente = transaction + stock + mouvement) est enregistrée
   dans UNE SEULE transaction IndexedDB : tout ou rien.
   ========================================================= */
(function () {
  const DB_NAME = 'beauty-salon-manager';
  const DB_VERSION = 1;
  const STORES = [
    'clients', 'services', 'employees', 'mouvements_personnel', 'rdv',
    'transactions', 'produits', 'mouvements_stock', 'depenses', 'journal',
    'users', 'settings'
  ];

  const DB = {
    conn: null,
    cache: {},
    ready: false,

    open() {
      return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
          reject(new Error("Ce navigateur ne supporte pas IndexedDB. Utilisez Google Chrome."));
          return;
        }
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          STORES.forEach(name => {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name, { keyPath: 'id' });
            }
          });
        };
        req.onsuccess = () => { this.conn = req.result; resolve(); };
        req.onerror = () => reject(req.error);
      });
    },

    async load() {
      for (const name of STORES) {
        this.cache[name] = await this._readAll(name);
      }
      this.ready = true;
    },

    _readAll(name) {
      return new Promise((resolve, reject) => {
        const req = this.conn.transaction(name, 'readonly').objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },

    /* Accès lecture (depuis le cache) */
    all(store) { return this.cache[store] || []; },
    get(store, id) { return this.all(store).find(x => x.id === id) || null; },

    /* Écriture groupée : ops = [{op:'put', store, obj} | {op:'del', store, id}] */
    commit(ops) {
      return new Promise((resolve, reject) => {
        const stores = [...new Set(ops.map(o => o.store))];
        const tx = this.conn.transaction(stores, 'readwrite');
        ops.forEach(o => {
          const s = tx.objectStore(o.store);
          if (o.op === 'put') s.put(o.obj);
          else s.delete(o.id);
        });
        tx.oncomplete = () => { ops.forEach(o => this._apply(o)); resolve(); };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Opération annulée'));
      });
    },

    _apply(o) {
      const arr = this.cache[o.store];
      if (o.op === 'put') {
        const copy = JSON.parse(JSON.stringify(o.obj));
        const i = arr.findIndex(x => x.id === copy.id);
        if (i >= 0) arr[i] = copy; else arr.push(copy);
      } else {
        const i = arr.findIndex(x => x.id === o.id);
        if (i >= 0) arr.splice(i, 1);
      }
    },

    put(store, obj) { return this.commit([{ op: 'put', store, obj }]); },
    del(store, id) { return this.commit([{ op: 'del', store, id }]); },

    /* Paramètres (un seul enregistrement, id = 'main') */
    settings() {
      const defaults = {
        id: 'main',
        nom: 'Mon Salon', adresse: '', telephone: '', email: '', logo: '',
        horaires: '08:00 - 19:00', joursFermeture: [0],
        piedRecu: 'Merci de votre visite !',
        dureeRdvDefaut: 30,
        counters: { tx: 0, client: 0, rdv: 0, depense: 0 }
      };
      const s = this.get('settings', 'main') || {};
      return Object.assign({}, defaults, s, {
        counters: Object.assign({}, defaults.counters, s.counters || {})
      });
    },

    /* Numéros automatiques : incrémente le compteur en mémoire.
       À enregistrer avec saveSettingsOp() dans la même écriture. */
    nextNum(name) {
      const s = this.settings();
      s.counters[name] = (s.counters[name] || 0) + 1;
      this._pendingSettings = s;
      return s.counters[name];
    },
    saveSettingsOp(extra) {
      const s = Object.assign({}, this._pendingSettings || this.settings(), extra || {});
      this._pendingSettings = null;
      return { op: 'put', store: 'settings', obj: s };
    },

    /* Journal des opérations sensibles */
    logOp(action, details, user) {
      return {
        op: 'put', store: 'journal',
        obj: {
          id: uid(), date: new Date().toISOString(), action,
          details: details || '', utilisateur: user ? user.identifiant : 'système'
        }
      };
    },

    /* Sauvegarde complète */
    exportAll() {
      const data = {};
      STORES.forEach(s => { data[s] = this.all(s); });
      return { app: 'beauty-salon-manager', version: DB_VERSION, exportedAt: new Date().toISOString(), data };
    },

    /* Restauration : remplace toutes les données */
    importAll(payload) {
      if (!payload || payload.app !== 'beauty-salon-manager' || !payload.data) {
        return Promise.reject(new Error("Ce fichier n'est pas une sauvegarde de BEAUTY SALON MANAGER."));
      }
      return new Promise((resolve, reject) => {
        const stores = STORES;
        const tx = this.conn.transaction(stores, 'readwrite');
        stores.forEach(name => {
          const s = tx.objectStore(name);
          s.clear();
          (payload.data[name] || []).forEach(obj => { if (obj && obj.id) s.put(obj); });
        });
        tx.oncomplete = async () => { await this.load(); resolve(); };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Restauration annulée'));
      });
    },

    async askPersistence() {
      try {
        if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
      } catch (e) { /* non bloquant */ }
    }
  };

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  window.DB = DB;
  window.uid = uid;
})();
