var App = App || {};

App.renderSummary = function(state) {
  var esc = App.escapeHtml;
  var completedAt = App.formatDateTimeBR(state.completedAt) !== '-'
    ? App.formatDateTimeBR(state.completedAt)
    : App.formatDateTimeBR(new Date().toISOString());

  var accountRows = Object.values(App.platforms).map(function(platform) {
    var pState = state.platforms[platform.id];
    var statusHtml = pState.completed
      ? '<span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">' + App.icons.check + ' Criada</span>'
      : '<span class="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Pendente</span>';

    return '' +
      '<tr class="border-b border-gray-100">' +
        '<td class="py-3 pr-4">' +
          '<div class="flex items-center gap-2">' +
            '<div class="flex h-8 w-8 items-center justify-center rounded-lg ' + platform.color.light + ' [&>svg]:w-4 [&>svg]:h-4">' + platform.icon + '</div>' +
            '<span class="font-medium text-gray-900">' + platform.name + '</span>' +
          '</div>' +
        '</td>' +
        '<td class="py-3 pr-4 text-sm text-gray-700">' + esc(pState.accountInfo || '-') + '</td>' +
        '<td class="py-3">' + statusHtml + '</td>' +
      '</tr>';
  }).join('');

  var deptLabel = App.departmentLabels[state.employee.departamento] || state.employee.departamento || '-';
  var dataNascFormatted = App.formatDateBR(state.employee.dataNascimento);
  var dataAdmFormatted = App.formatDateBR(state.employee.dataAdmissao);

  return '' +
    '<div>' +
      '<div class="print-only mb-6 border-b-2 border-gray-900 pb-4">' +
        '<h1 class="text-2xl font-bold">Relatório de Onboarding</h1>' +
        '<p class="text-sm text-gray-600">Gerado em: ' + completedAt + '</p>' +
      '</div>' +
      '<div class="mb-6 text-center no-print">' +
        '<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">' +
          App.icons.checkCircle +
        '</div>' +
        '<h2 class="text-2xl font-bold text-gray-900">Onboarding Concluído!</h2>' +
        '<p class="mt-1 text-gray-500">Todas as contas foram criadas com sucesso</p>' +
      '</div>' +
      '<div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">' +
        '<h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">' + App.icons.user + ' Dados do Funcionário</h3>' +
        '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Nome completo</p><p class="text-base font-medium text-gray-900">' + esc(state.employee.nomeCompleto || '-') + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">E-mail desejado</p><p class="text-base font-medium text-gray-900">' + esc(state.employee.emailDesejado || '-') + '@gmail.com</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Telefone</p><p class="text-base font-medium text-gray-900">' + esc(state.employee.telefone || '-') + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Data de nascimento</p><p class="text-base font-medium text-gray-900">' + dataNascFormatted + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Cargo</p><p class="text-base font-medium text-gray-900">' + esc(state.employee.cargo || '-') + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Departamento</p><p class="text-base font-medium text-gray-900">' + esc(deptLabel) + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Data de admissão</p><p class="text-base font-medium text-gray-900">' + dataAdmFormatted + '</p></div>' +
          '<div><p class="text-xs font-medium uppercase tracking-wide text-gray-400">Onboarding realizado em</p><p class="text-base font-medium text-gray-900">' + completedAt + '</p></div>' +
        '</div>' +
      '</div>' +
      '<div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">' +
        '<h3 class="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">' + App.icons.listChecks + ' Contas Criadas</h3>' +
        '<div class="overflow-x-auto">' +
          '<table class="w-full text-left">' +
            '<thead><tr class="border-b border-gray-200">' +
              '<th class="pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Plataforma</th>' +
              '<th class="pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Conta</th>' +
              '<th class="pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>' +
            '</tr></thead>' +
            '<tbody>' + accountRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="flex flex-col gap-3 no-print sm:flex-row">' +
        '<button data-action="print" class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50">' +
          App.icons.printer + ' Imprimir Relatório</button>' +
        '<button data-action="reset" class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700">' +
          App.icons.refresh + ' Novo Colaborador</button>' +
      '</div>' +
    '</div>';
};
