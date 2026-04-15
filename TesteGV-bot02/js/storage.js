var App = App || {};

App.storage = {
  KEY: 'gv-onboarding-state',
  VERSION: 6,

  _checkVersion: function() {
    var v = localStorage.getItem('gv-storage-version');
    if (v !== String(this.VERSION)) {
      localStorage.removeItem(this.KEY);
      localStorage.setItem('gv-storage-version', String(this.VERSION));
    }
  },

  save: function(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Não foi possível salvar:', e);
    }
  },

  load: function() {
    this._checkVersion();
    try {
      var raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      var state = JSON.parse(raw);
      // Telas que não devem ser restauradas ao recarregar
      var noRestore = ['history', 'history-detail'];
      if (state && noRestore.indexOf(state.currentScreen) !== -1) {
        state.currentScreen = 'welcome';
      }
      return state;
    } catch (e) {
      console.warn('Não foi possível carregar:', e);
      return null;
    }
  },

  clear: function() {
    localStorage.removeItem(this.KEY);
  },

  // === Histórico de onboardings ===
  HISTORY_KEY: 'gv-onboarding-history',

  saveHistory: function(record) {
    try {
      var history = this.loadHistory();
      record.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      history.push(record);
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Não foi possível salvar histórico:', e);
    }
  },

  loadHistory: function() {
    try {
      var raw = localStorage.getItem(this.HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  deleteHistoryItem: function(id) {
    try {
      var history = this.loadHistory().filter(function(item) { return item.id !== id; });
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Erro ao remover do histórico:', e);
    }
  },

  // === Favoritos (perfis pinnados) ===
  FAVORITES_KEY: 'gv-onboarding-favorites',

  loadFavorites: function() {
    try {
      var raw = localStorage.getItem(this.FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  },

  toggleFavorite: function(historyId) {
    try {
      var favs = this.loadFavorites();
      var idx = favs.indexOf(historyId);
      if (idx === -1) favs.push(historyId);
      else favs.splice(idx, 1);
      localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favs));
      return idx === -1;
    } catch (e) { return false; }
  },

  isFavorite: function(historyId) {
    return this.loadFavorites().indexOf(historyId) !== -1;
  },

  // === Fila de import CSV ===
  IMPORT_QUEUE_KEY: 'gv-import-queue',

  saveImportQueue: function(queue) {
    try { localStorage.setItem(this.IMPORT_QUEUE_KEY, JSON.stringify(queue)); }
    catch (e) {}
  },

  loadImportQueue: function() {
    try {
      var raw = localStorage.getItem(this.IMPORT_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  },

  clearImportQueue: function() {
    localStorage.removeItem(this.IMPORT_QUEUE_KEY);
  }
};
