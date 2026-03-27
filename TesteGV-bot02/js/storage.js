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
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('Não foi possível carregar:', e);
      return null;
    }
  },

  clear: function() {
    localStorage.removeItem(this.KEY);
  }
};
