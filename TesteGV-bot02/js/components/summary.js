var App = App || {};

App.renderSummary = function(state) {
  var esc = App.escapeHtml;
  var completedAt = App.formatDateTimeBR(state.completedAt) !== '-'
    ? App.formatDateTimeBR(state.completedAt)
    : App.formatDateTimeBR(new Date().toISOString());

  var email = state.employee.emailDesejado ? state.employee.emailDesejado + '@gmail.com' : '-';
  var username = state.employee.emailDesejado ? '@' + state.employee.emailDesejado : '-';
  var senha = state.suggestedPassword || App.generatePassword(14);

  function copyBtn(text) {
    if (!text || text === '-') return '';
    return '<button data-action="copy" data-copy-text="' + esc(text) + '" class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Copiar">' + App.icons.copy + '</button>';
  }

  function credRow(label, value, highlight) {
    if (!value || value === '-') return '';
    var cls = highlight ? 'text-sm font-semibold text-brand-700' : 'text-sm font-medium text-gray-900';
    return '' +
      '<div class="flex items-center justify-between gap-2">' +
        '<span class="text-xs text-gray-500">' + label + '</span>' +
        '<span class="flex items-center gap-1 ' + cls + '">' + esc(value) + ' ' + copyBtn(value) + '</span>' +
      '</div>';
  }

  var platformDetails = {
    gmail: {
      credentials: [
        { label: 'E-mail', value: email },
        { label: 'Senha', value: senha, highlight: true }
      ]
    },
    instagram: {
      credentials: [
        { label: 'Username', value: username },
        { label: 'E-mail de cadastro', value: email },
        { label: 'Senha', value: senha, highlight: true }
      ]
    },
    facebook: {
      credentials: [
        { label: 'Conta', value: state.platforms.facebook.accountInfo || '-' },
        { label: 'E-mail de cadastro', value: email },
        { label: 'Senha', value: senha, highlight: true }
      ]
    },
    tiktok: {
      credentials: [
        { label: 'Username', value: username },
        { label: 'E-mail de cadastro', value: email },
        { label: 'Senha', value: senha, highlight: true }
      ]
    }
  };

  var accountCards = Object.values(App.platforms).map(function(platform) {
    var pState = state.platforms[platform.id];
    var details = platformDetails[platform.id];
    var isCompleted = pState.completed;

    var statusBadge = isCompleted
      ? '<span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">' + App.icons.check + ' Criada</span>'
      : '<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">Pendente</span>';

    var credRows = details.credentials.map(function(c) {
      return credRow(c.label, c.value, c.highlight);
    }).join('');

    return '' +
      '<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">' +
        '<div class="flex items-center justify-between mb-3">' +
          '<div class="flex items-center gap-2">' +
            '<div class="flex h-9 w-9 items-center justify-center rounded-lg ' + platform.color.light + ' [&>svg]:w-4 [&>svg]:h-4">' + platform.icon + '</div>' +
            '<span class="font-semibold text-gray-900">' + platform.name + '</span>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            statusBadge +
            '<a href="' + platform.registerUrl + '" target="_blank" rel="noopener noreferrer" class="no-print inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">' +
              App.icons.externalLink + ' Acessar' +
            '</a>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-1.5 rounded-lg bg-gray-50 p-3">' +
          credRows +
        '</div>' +
      '</div>';
  }).join('');

  var deptLabel = App.departmentLabels[state.employee.departamento] || state.employee.departamento || '-';
  var dataNascFormatted = App.formatDateBR(state.employee.dataNascimento);
  var dataAdmFormatted = App.formatDateBR(state.employee.dataAdmissao);

  return '' +
    '<div>' +
      '<div class="print-only mb-6 border-b-2 border-gray-900 pb-4">' +
        '<h1 class="text-2xl font-bold">Relatório - Green BOT</h1>' +
        '<p class="text-sm text-gray-600">Gerado em: ' + completedAt + '</p>' +
      '</div>' +
      '<div class="mb-6 text-center no-print">' +
        '<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">' +
          App.icons.checkCircle +
        '</div>' +
        '<h2 class="text-2xl font-bold text-gray-900">Processo Concluído!</h2>' +
        '<p class="mt-1 text-gray-500">Todas as contas foram criadas com sucesso</p>' +
      '</div>' +
      '<div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">' +
        '<h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">' + App.icons.user + ' Dados do Funcionário</h3>' +
        '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Nome completo</p><p class="text-base font-medium text-gray-900">' + esc(state.employee.nomeCompleto || '-') + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">E-mail</p><p class="text-base font-medium text-gray-900">' + esc(email) + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Telefone</p><p class="text-base font-medium text-gray-900">' + esc(state.employee.telefone || '-') + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Data de nascimento</p><p class="text-base font-medium text-gray-900">' + dataNascFormatted + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Cargo</p><p class="text-base font-medium text-gray-900">' + esc(state.employee.cargo || '-') + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Departamento</p><p class="text-base font-medium text-gray-900">' + esc(deptLabel) + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Data de admissão</p><p class="text-base font-medium text-gray-900">' + dataAdmFormatted + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Onboarding realizado em</p><p class="text-base font-medium text-gray-900">' + completedAt + '</p></div>' +
        '</div>' +
      '</div>' +
      '<div class="mb-6">' +
        '<h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">' + App.icons.listChecks + ' Contas Criadas</h3>' +
        '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' + accountCards + '</div>' +
      '</div>' +
      '<div class="flex flex-col gap-3 no-print sm:flex-row sm:flex-wrap">' +
        '<button data-action="export-txt" class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50">' +
          App.icons.download + ' Exportar TXT</button>' +
        '<button data-action="copy-summary" class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50">' +
          App.icons.copy + ' Copiar Resumo</button>' +
        '<button data-action="print" class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50">' +
          App.icons.printer + ' Imprimir</button>' +
        '<button data-action="reset" class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700">' +
          App.icons.refresh + ' Novo Colaborador</button>' +
      '</div>' +
    '</div>';
};
