var App = App || {};

// URL do backend (ajuste se mudar a porta)
App.BACKEND_URL = 'http://127.0.0.1:3001';

// API Key — carregada uma vez do backend (somente localhost)
App._twilioApiKey = null;

App.twilioGetApiKey = function() {
  if (App._twilioApiKey) return Promise.resolve(App._twilioApiKey);
  return fetch(App.BACKEND_URL + '/api/config')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.apiKey) { App._twilioApiKey = data.apiKey; }
      return App._twilioApiKey;
    })
    .catch(function() { return null; });
};

// Países suportados pelo Twilio (código ISO + nome)
App.twilioCountries = [
  { code: 'US', name: 'Estados Unidos (+1)' },
  { code: 'GB', name: 'Reino Unido (+44)' },
  { code: 'CA', name: 'Canadá (+1)' },
  { code: 'AU', name: 'Austrália (+61)' },
  { code: 'DE', name: 'Alemanha (+49)' },
  { code: 'FR', name: 'França (+33)' },
  { code: 'ES', name: 'Espanha (+34)' },
  { code: 'IT', name: 'Itália (+39)' },
  { code: 'NL', name: 'Países Baixos (+31)' },
  { code: 'SE', name: 'Suécia (+46)' },
  { code: 'NO', name: 'Noruega (+47)' },
  { code: 'DK', name: 'Dinamarca (+45)' },
  { code: 'FI', name: 'Finlândia (+358)' },
  { code: 'PL', name: 'Polônia (+48)' },
  { code: 'CH', name: 'Suíça (+41)' },
  { code: 'AT', name: 'Áustria (+43)' },
  { code: 'BE', name: 'Bélgica (+32)' },
  { code: 'PT', name: 'Portugal (+351)' },
  { code: 'MX', name: 'México (+52)' },
  { code: 'AR', name: 'Argentina (+54)' },
  { code: 'CL', name: 'Chile (+56)' },
  { code: 'CO', name: 'Colômbia (+57)' },
  { code: 'JP', name: 'Japão (+81)' },
  { code: 'KR', name: 'Coreia do Sul (+82)' },
  { code: 'SG', name: 'Singapura (+65)' },
  { code: 'HK', name: 'Hong Kong (+852)' },
  { code: 'IN', name: 'Índia (+91)' },
  { code: 'ZA', name: 'África do Sul (+27)' },
  { code: 'IL', name: 'Israel (+972)' },
  { code: 'IE', name: 'Irlanda (+353)' }
];

App.renderTwilio = function(twilioState) {
  var ts = twilioState || { status: null, searchResults: [], ownedNumbers: [], searching: false };

  var statusSection = '';
  if (ts.status === null) {
    statusSection =
      '<div class="flex items-center gap-3 rounded-xl border border-dark-700/60 bg-dark-900/30 p-4">' +
        '<div class="h-2.5 w-2.5 rounded-full bg-dark-600 animate-pulse"></div>' +
        '<span class="text-sm text-dark-400">Verificando conexão com backend...</span>' +
      '</div>';
  } else if (!ts.status.connected) {
    statusSection =
      '<div class="rounded-xl border border-red-500/30 bg-red-500/10 p-4">' +
        '<p class="font-semibold text-red-400 text-sm mb-1">Backend não conectado</p>' +
        '<p class="text-xs text-red-300/80">' + App.escapeHtml(ts.status.message || 'Verifique se o servidor está rodando') + '</p>' +
        '<div class="mt-3 rounded-lg bg-dark-900/50 p-3 font-mono text-xs text-dark-300">' +
          '<p class="text-dark-500 mb-1"># No terminal, dentro da pasta backend/:</p>' +
          '<p>npm install</p>' +
          '<p>node server.js</p>' +
        '</div>' +
      '</div>';
  } else {
    var numBadge = ts.status.phoneNumber
      ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold text-green-400">' +
          App.icons.check + ' ' + App.escapeHtml(ts.status.phoneNumber) + '</span>'
      : '<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">Nenhum número ativo</span>';

    statusSection =
      '<div class="rounded-xl border border-green-500/30 bg-green-500/10 p-4">' +
        '<div class="flex items-center justify-between">' +
          '<div class="flex items-center gap-2">' +
            '<div class="h-2.5 w-2.5 rounded-full bg-green-500"></div>' +
            '<span class="font-semibold text-green-400 text-sm">Twilio conectado</span>' +
          '</div>' +
          numBadge +
        '</div>' +
        '<p class="mt-1 text-xs text-green-300/70">Conta: ' + App.escapeHtml(ts.status.accountName || '') + '</p>' +
      '</div>';
  }

  // Números comprados
  var ownedSection = '';
  if (ts.ownedNumbers && ts.ownedNumbers.length > 0) {
    var rows = ts.ownedNumbers.map(function(n) {
      var isActive = n.phoneNumber === (ts.status && ts.status.phoneNumber);
      return '' +
        '<div class="flex items-center gap-3 rounded-lg border border-dark-700/40 bg-dark-900/40 px-3 py-2.5">' +
          '<div class="flex-1 min-w-0">' +
            '<p class="text-sm font-mono font-medium text-dark-100">' + App.escapeHtml(n.phoneNumber) + '</p>' +
            '<p class="text-xs text-dark-500">' + App.escapeHtml(n.friendlyName || '') + '</p>' +
          '</div>' +
          (isActive ? '<span class="text-xs text-green-400 font-semibold">Ativo</span>' : '') +
          '<button data-action="twilio-set-active" data-phone="' + App.escapeHtml(n.phoneNumber) + '" data-sid="' + App.escapeHtml(n.sid) + '" ' +
            'class="rounded-lg px-2.5 py-1 text-xs font-medium border border-dark-600 text-dark-400 hover:border-brand-500/50 hover:text-brand-400 transition-colors" title="Usar este número">' +
            'Usar' +
          '</button>' +
          '<button data-action="twilio-release-number" data-sid="' + App.escapeHtml(n.sid) + '" data-phone="' + App.escapeHtml(n.phoneNumber) + '" ' +
            'class="rounded-lg p-1.5 text-dark-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Liberar número">' +
            App.icons.trash +
          '</button>' +
        '</div>';
    }).join('');

    ownedSection =
      '<div>' +
        '<h3 class="mb-2 text-sm font-semibold text-dark-300">Seus números (' + ts.ownedNumbers.length + ')</h3>' +
        '<div class="space-y-2">' + rows + '</div>' +
      '</div>';
  }

  // Formulário de busca
  var countryOptions = App.twilioCountries.map(function(c) {
    var sel = (ts.selectedCountry || 'US') === c.code ? ' selected' : '';
    return '<option value="' + c.code + '"' + sel + '>' + App.escapeHtml(c.name) + '</option>';
  }).join('');

  var typeOptions = [
    { value: 'local', label: 'Local' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'tollFree', label: 'Gratuito (Toll-Free)' }
  ].map(function(t) {
    var sel = (ts.selectedType || 'local') === t.value ? ' selected' : '';
    return '<option value="' + t.value + '"' + sel + '>' + t.label + '</option>';
  }).join('');

  var searchSection =
    '<div class="space-y-3">' +
      '<h3 class="text-sm font-semibold text-dark-300">Buscar número disponível</h3>' +
      '<div class="flex gap-2">' +
        '<select id="twilio-country" class="dark-input flex-1 rounded-xl py-2.5 px-3 text-sm focus:outline-none">' +
          countryOptions +
        '</select>' +
        '<select id="twilio-type" class="dark-input rounded-xl py-2.5 px-3 text-sm focus:outline-none">' +
          typeOptions +
        '</select>' +
        '<button data-action="twilio-search" class="btn-gradient rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all" ' +
          (ts.status && ts.status.connected ? '' : 'disabled title="Backend não conectado"') + '>' +
          (ts.searching ? 'Buscando...' : 'Buscar') +
        '</button>' +
      '</div>' +

      // Resultados da busca
      (ts.searchResults && ts.searchResults.length > 0
        ? '<div class="space-y-2 max-h-64 overflow-y-auto pr-1">' +
            ts.searchResults.map(function(n) {
              return '' +
                '<div class="flex items-center gap-3 rounded-lg border border-dark-700/40 bg-dark-900/40 px-3 py-2.5 hover:border-brand-500/30 transition-colors">' +
                  '<div class="flex-1 min-w-0">' +
                    '<p class="text-sm font-mono font-medium text-dark-100">' + App.escapeHtml(n.friendlyName) + '</p>' +
                    '<div class="flex items-center gap-2 mt-0.5">' +
                      (n.locality ? '<span class="text-xs text-dark-500">' + App.escapeHtml(n.locality + (n.region ? ', ' + n.region : '')) + '</span>' : '') +
                      '<span class="text-xs text-dark-600">' + App.escapeHtml(n.isoCountry) + '</span>' +
                      (n.capabilities.sms ? '<span class="text-xs text-green-500">SMS</span>' : '') +
                      (n.capabilities.mms ? '<span class="text-xs text-blue-400">MMS</span>' : '') +
                    '</div>' +
                  '</div>' +
                  '<span class="text-xs text-dark-500 shrink-0">' + App.escapeHtml(n.monthlyFee) + '/mês</span>' +
                  '<button data-action="twilio-purchase" data-phone="' + App.escapeHtml(n.phoneNumber) + '" ' +
                    'class="rounded-xl btn-gradient px-3 py-1.5 text-xs font-semibold text-white transition-all shrink-0">' +
                    'Comprar' +
                  '</button>' +
                '</div>';
            }).join('') +
          '</div>'
        : (ts.searchDone
            ? '<p class="text-sm text-dark-500 text-center py-3">Nenhum número encontrado para este país/tipo.</p>'
            : '')
      ) +
    '</div>';

  return '' +
    '<div class="mx-auto max-w-2xl">' +
      '<div class="mb-6 flex items-center justify-between">' +
        '<div class="flex items-center gap-3">' +
          '<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">' + App.icons.phone + '</div>' +
          '<div>' +
            '<h2 class="text-2xl font-bold text-dark-50">Configuração Twilio</h2>' +
            '<p class="text-sm text-dark-500">Compre números e envie SMS de qualquer país</p>' +
          '</div>' +
        '</div>' +
        '<button data-action="back-welcome" class="rounded-xl border border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' +
          App.icons.chevronLeft + ' Voltar</button>' +
      '</div>' +

      '<div class="space-y-5">' +
        // Status
        statusSection +

        // Divisor
        (ts.status && ts.status.connected
          ? '<div class="h-px bg-dark-700/40"></div>' +
            // Números comprados
            ownedSection +
            (ownedSection ? '<div class="h-px bg-dark-700/40"></div>' : '') +
            // Busca
            searchSection
          : ''
        ) +
      '</div>' +
    '</div>';
};
