var App = App || {};

App.renderPlatformCards = function(state) {
  var esc = App.escapeHtml;
  var completedCount = Object.values(state.platforms).filter(function(p) { return p.completed; }).length;
  var totalCount = Object.keys(state.platforms).length;
  var allDone = completedCount === totalCount;

  var cardsHtml = Object.values(App.platforms).map(function(platform) {
    var pState = state.platforms[platform.id];
    var isCompleted = pState.completed;

    var statusBadge = isCompleted
      ? '<span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">' + App.icons.check + ' Concluído</span>'
      : '<span class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">Pendente</span>';

    var accountInfo = isCompleted && pState.accountInfo
      ? '<p class="mt-1 text-xs text-gray-500 truncate max-w-[180px]">' + esc(pState.accountInfo) + '</p>'
      : '';

    var borderColor = isCompleted ? 'border-green-300 bg-green-50/30' : platform.color.border + ' ' + platform.color.hover;

    // Botão do guia + botão de acesso direto
    var cardContent = '' +
      '<div class="platform-card flex flex-col items-center gap-3 rounded-xl border-2 ' + borderColor + ' p-5 text-center transition-all hover:shadow-md">' +
        '<button data-platform="' + platform.id + '" class="flex flex-col items-center gap-3 w-full">' +
          '<div class="flex h-14 w-14 items-center justify-center rounded-2xl ' + platform.color.accent + ' text-white shadow-sm">' +
            '<div class="flex items-center justify-center [&>svg]:!fill-white [&>svg]:!w-7 [&>svg]:!h-7">' + platform.icon + '</div>' +
          '</div>' +
          '<div>' +
            '<p class="text-base font-semibold text-gray-900">' + platform.name + '</p>' +
            '<p class="text-xs text-gray-500">' + platform.description + '</p>' +
            accountInfo +
          '</div>' +
          statusBadge +
        '</button>' +
        '<a href="' + platform.registerUrl + '" target="_blank" rel="noopener noreferrer"' +
          ' class="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-400">' +
          App.icons.externalLink + ' Acessar site' +
        '</a>' +
      '</div>';

    return cardContent;
  }).join('');

  var summaryButton = allDone
    ? '<div class="mt-6"><button data-action="view-summary" class="w-full rounded-xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 transition-all hover:bg-brand-700 hover:shadow-xl active:scale-[0.98]">' +
        App.icons.sparkles + ' Ver Resumo Final</button></div>'
    : '';

  // === Painel de informações do funcionário para copiar ===
  var names = App.splitName(state.employee.nomeCompleto);
  var email = state.employee.emailDesejado ? state.employee.emailDesejado + '@gmail.com' : '-';
  var username = state.employee.emailDesejado ? '@' + state.employee.emailDesejado : '-';
  var dataNasc = App.formatDateBR(state.employee.dataNascimento);
  var telefone = state.employee.telefone || '-';
  var senhaGerada = state.suggestedPassword || App.generatePassword(14);

  function infoRow(label, value) {
    if (!value || value === '-') return '';
    return '' +
      '<div class="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">' +
        '<div class="min-w-0">' +
          '<p class="text-xs text-gray-400">' + label + '</p>' +
          '<p class="text-sm font-medium text-gray-900 truncate">' + esc(value) + '</p>' +
        '</div>' +
        '<button data-action="copy" data-copy-text="' + esc(value) + '" class="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50 transition-colors" title="Copiar">' +
          App.icons.copy + ' Copiar' +
        '</button>' +
      '</div>';
  }

  var infoPanel = '<div class="mb-6 rounded-xl border border-blue-200 bg-blue-50/50 p-5">' +
    '<h3 class="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">' +
      App.icons.clipboard + ' Dados para Cadastro <span class="text-xs font-normal text-gray-500">— copie e cole nos formulários</span>' +
    '</h3>' +
    '<div class="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6">' +
      '<div>' +
        infoRow('Primeiro nome', names.first) +
        infoRow('Sobrenome', names.last) +
        infoRow('Nome completo', state.employee.nomeCompleto) +
        infoRow('E-mail', email) +
      '</div>' +
      '<div>' +
        infoRow('Username / @', username) +
        infoRow('Senha sugerida', senhaGerada) +
        infoRow('Data de nascimento', dataNasc) +
        infoRow('Telefone', telefone) +
      '</div>' +
    '</div>' +
  '</div>';

  // === Seção de atalhos (só se há pendentes) ===
  var pendingPlatforms = Object.values(App.platforms).filter(function(platform) {
    return !state.platforms[platform.id].completed;
  });
  var hasPending = pendingPlatforms.length > 0;

  var shortcutsSection = '';
  if (hasPending) {
    var openAllBtn = '<div class="text-center">' +
      '<button data-action="open-all-registers" class="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-400">' +
        App.icons.externalLink + ' Abrir todos os cadastros pendentes' +
      '</button>' +
    '</div>';

    var batchInputs = pendingPlatforms.map(function(platform) {
      var suggestion = App.suggestAccountInfo(platform.id, state.employee.emailDesejado);
      return '' +
        '<div class="flex items-center gap-3">' +
          '<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' + platform.color.light + ' [&>svg]:w-4 [&>svg]:h-4">' + platform.icon + '</div>' +
          '<div class="flex-1">' +
            '<label class="block text-xs font-medium text-gray-600 mb-1">' + platform.name + '</label>' +
            '<input type="text" name="batch-' + platform.id + '" value="' + esc(suggestion) + '"' +
              ' placeholder="Conta criada" class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />' +
          '</div>' +
        '</div>';
    }).join('');

    var batchFillForm = '<div class="mt-5 rounded-xl border border-brand-200 bg-brand-50/50 p-5">' +
      '<h4 class="mb-1 text-sm font-bold text-gray-900 flex items-center gap-2">' +
        App.icons.sparkles + ' Preenchimento Rápido' +
      '</h4>' +
      '<p class="mb-4 text-xs text-gray-500">Preencha as contas e marque todas como concluídas de uma vez</p>' +
      '<form id="batch-fill-form" class="space-y-3">' +
        batchInputs +
        '<button type="submit" class="mt-3 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 transition-colors">' +
          App.icons.check + ' Marcar todas como concluídas' +
        '</button>' +
      '</form>' +
    '</div>';

    shortcutsSection = '<div class="mt-6 space-y-4">' +
      openAllBtn +
      batchFillForm +
    '</div>';
  }

  return '' +
    '<div>' +
      '<div class="mb-6 text-center">' +
        '<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">' + App.icons.listChecks + '</div>' +
        '<h2 class="text-2xl font-bold text-gray-900">Crie suas Contas</h2>' +
        '<p class="mt-1 text-gray-500">Clique em cada plataforma para seguir o guia passo a passo</p>' +
        '<div class="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-1.5">' +
          '<span class="text-sm font-medium text-gray-700">' + completedCount + ' de ' + totalCount + ' concluídas</span>' +
          '<div class="h-2 w-24 rounded-full bg-gray-200">' +
            '<div class="h-2 rounded-full bg-brand-500 transition-all duration-500" style="width:' + ((completedCount / totalCount) * 100) + '%"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      infoPanel +
      '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' + cardsHtml + '</div>' +
      shortcutsSection +
      summaryButton +
    '</div>';
};
