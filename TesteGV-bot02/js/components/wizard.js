var App = App || {};

App.renderWizard = function(state) {
  var esc = App.escapeHtml;
  var order = App.getWizardPlatformOrder();
  var totalPlatforms = order.length;
  var completedCount = 0;
  for (var i = 0; i < order.length; i++) {
    if (state.platforms[order[i]].completed) completedCount++;
  }

  var current = App.getNextPendingPlatform(state, state.wizardPlatformIndex);
  if (!current) current = App.getNextPendingPlatform(state, 0);
  if (!current) {
    return '<div class="text-center py-12">' +
      '<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 text-green-400">' + App.icons.checkCircle + '</div>' +
      '<h2 class="text-xl font-bold text-dark-50 mb-2">Todas as contas foram criadas!</h2>' +
      '<button data-action="view-summary" class="mt-4 btn-gradient rounded-xl px-6 py-3 text-white font-semibold">Ver Resumo Final</button>' +
    '</div>';
  }

  var platformId = current.id;
  var platform = App.platforms[platformId];
  var currentNumber = completedCount + 1;
  var credentials = App.getWizardCredentials(platformId, state);
  var autoCopyData = App.getWizardAutoCopyData(platformId, state);
  var accountSuggestion = App.suggestAccountInfo(platformId, state.employee.emailDesejado);

  // Progress bar segments
  var progressSegments = '';
  for (var p = 0; p < totalPlatforms; p++) {
    var pId = order[p];
    var segClass = state.platforms[pId].completed
      ? 'bg-green-500'
      : (pId === platformId ? 'bg-brand-500 animate-pulse' : 'bg-dark-700');
    progressSegments += '<div class="flex-1 h-2 rounded-full ' + segClass + '"></div>';
  }

  // Credential rows
  var credRows = '';
  for (var c = 0; c < credentials.length; c++) {
    var cred = credentials[c];
    if (!cred.value) continue;
    var isAutoCopy = (cred.value === autoCopyData.value);
    var autoBadge = isAutoCopy
      ? '<span id="wizard-autocopy-indicator" class="ml-2 text-xs text-green-400 font-medium"></span>'
      : '';
    credRows +=
      '<div class="flex items-center justify-between gap-2 py-2.5 ' + (c > 0 ? 'border-t border-dark-700/50' : '') + '">' +
        '<span class="text-sm text-dark-400 min-w-[120px]">' + esc(cred.label) + autoBadge + '</span>' +
        '<div class="flex items-center gap-1.5">' +
          '<span class="text-sm font-medium text-dark-100 select-all">' + esc(cred.value) + '</span>' +
          '<button data-action="wizard-copy-credential" data-copy-text="' + esc(cred.value) + '" class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-dark-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors" title="Copiar">' +
            App.icons.copy +
          '</button>' +
        '</div>' +
      '</div>';
  }

  return '' +
    '<div class="wizard-step-enter max-w-2xl mx-auto">' +
      // Progress header
      '<div class="mb-6">' +
        '<div class="flex items-center justify-between mb-2">' +
          '<span class="text-sm font-medium text-dark-400">Plataforma ' + currentNumber + ' de ' + totalPlatforms + '</span>' +
          '<span class="text-sm font-medium text-brand-400">' + completedCount + ' concluída' + (completedCount !== 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div class="flex gap-1.5">' + progressSegments + '</div>' +
      '</div>' +

      // Platform identity
      '<div class="text-center mb-6">' +
        '<div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800 border border-dark-700 [&>svg]:w-8 [&>svg]:h-8">' +
          platform.icon +
        '</div>' +
        '<h2 class="text-2xl font-bold text-dark-50">' + esc(platform.name) + '</h2>' +
        '<p class="text-sm text-dark-400 mt-1">' + esc(platform.description) + '</p>' +
      '</div>' +

      // Username editor
      '<div class="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">' +
        '<label class="block text-xs font-semibold text-amber-400 mb-1.5">Nome de usuário / E-mail base</label>' +
        '<div class="flex gap-2">' +
          '<input id="wizard-username-input" type="text" value="' + esc(state.employee.emailDesejado) + '" class="dark-input flex-1 rounded-lg px-3 py-2 text-sm font-medium !border-amber-500/30 focus:!border-amber-400">' +
          '<button type="button" data-action="wizard-update-username" class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 transition-colors whitespace-nowrap">Atualizar</button>' +
        '</div>' +
        '<div class="mt-2 flex flex-wrap gap-1.5" id="wizard-variations-list">' +
          (function() {
            var vars = App.generateEmailVariations(state.employee.nomeCompleto);
            return vars.map(function(v) {
              var isActive = v === state.employee.emailDesejado;
              return '<button type="button" data-action="wizard-pick-variation" data-variation="' + esc(v) + '" class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ' +
                (isActive
                  ? 'bg-amber-500 text-white'
                  : 'bg-dark-800 border border-dark-600 text-dark-300 hover:border-amber-500/50 hover:text-amber-400') +
                '">' + esc(v) + '</button>';
            }).join('');
          })() +
        '</div>' +
        '<p class="mt-1.5 text-xs text-amber-500/70">Clique em uma sugestão ou edite manualmente</p>' +
      '</div>' +

      // Credentials panel
      '<div class="mb-5 rounded-xl border border-brand-500/30 bg-brand-500/5 p-5">' +
        '<h3 class="flex items-center gap-2 text-sm font-bold text-brand-400 mb-3">' +
          App.icons.clipboard + ' Dados para Cadastro' +
        '</h3>' +
        '<div class="bg-dark-900/50 rounded-lg p-3">' +
          credRows +
        '</div>' +
      '</div>' +

      // Open register button
      '<a href="' + platform.registerUrl + '" target="_blank" rel="noopener noreferrer" data-action="wizard-open-register" class="btn-gradient flex items-center justify-center gap-2 w-full rounded-xl px-6 py-4 text-base font-bold text-white shadow-lg shadow-green-600/20">' +
        App.icons.externalLink + ' Abrir Cadastro do ' + esc(platform.name) +
      '</a>' +

      // Divider
      '<div class="relative my-6">' +
        '<div class="absolute inset-0 flex items-center"><div class="w-full border-t border-dark-700"></div></div>' +
        '<div class="relative flex justify-center">' +
          '<span class="bg-dark-900/95 backdrop-blur-sm px-4 text-sm text-dark-500 rounded">Após criar a conta, confirme abaixo</span>' +
        '</div>' +
      '</div>' +

      // Confirmation section
      '<div class="rounded-xl border border-dark-700/60 bg-dark-800/80 p-5">' +
        '<label class="block text-sm font-medium text-dark-300 mb-2">Informação da conta criada</label>' +
        '<input id="wizard-account-input" type="text" value="' + esc(accountSuggestion) + '" placeholder="Ex: ' + esc(accountSuggestion) + '" class="dark-input w-full rounded-lg px-4 py-3 text-sm focus:outline-none">' +
        '<button data-action="wizard-confirm" class="mt-3 btn-gradient flex items-center justify-center gap-2 w-full rounded-xl px-6 py-4 text-base font-bold text-white shadow-lg shadow-green-600/20">' +
          App.icons.check + ' Conta Criada → Próximo' +
        '</button>' +
      '</div>' +

      // Footer actions
      '<div class="mt-6 flex items-center justify-center gap-4 text-sm">' +
        '<button data-action="wizard-view-guide" class="text-brand-400 hover:text-brand-300 font-medium transition-colors">Ver guia detalhado</button>' +
        '<span class="text-dark-700">|</span>' +
        '<button data-action="wizard-skip-platform" class="text-dark-500 hover:text-dark-300 transition-colors">Pular</button>' +
        '<span class="text-dark-700">|</span>' +
        '<button data-action="wizard-back-platforms" class="text-dark-500 hover:text-dark-300 transition-colors">Voltar ao painel</button>' +
      '</div>' +
    '</div>';
};
