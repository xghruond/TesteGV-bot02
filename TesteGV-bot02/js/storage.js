var App = App || {};

App.storage = {
  KEY: 'gv-onboarding-state',

  save: function(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Não foi possível salvar:', e);
    }
  },

  load: function() {
    try {
      var raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      var state = JSON.parse(raw);
      // Telas que não devem ser restauradas ao recarregar
      var noRestore = ['twilio', 'history', 'history-detail'];
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
  }
};
