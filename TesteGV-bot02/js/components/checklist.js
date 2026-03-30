var App = App || {};

App.renderChecklist = function(state) {
  var completedCount = Object.values(state.platforms).filter(function(p) { return p.completed; }).length;
  var totalCount = Object.keys(state.platforms).length;

  var itemsHtml = Object.values(App.platforms).map(function(platform) {
    var pState = state.platforms[platform.id];
    var isCompleted = pState.completed;

    var checkIcon = isCompleted
      ? '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">' + App.icons.check + '</div>'
      : '<div class="h-6 w-6 rounded-full border-2 border-dark-600"></div>';

    var accountInfo = isCompleted && pState.accountInfo
      ? '<span class="block truncate text-xs text-dark-500">' + App.escapeHtml(pState.accountInfo) + '</span>'
      : '';

    return '' +
      '<div class="flex items-center gap-3 py-2">' +
        checkIcon +
        '<div class="min-w-0 flex-1">' +
          '<span class="text-sm font-medium ' + (isCompleted ? 'text-dark-100' : 'text-dark-400') + '">' + platform.name + '</span>' +
          accountInfo +
        '</div>' +
      '</div>';
  }).join('');

  return '' +
    '<div class="checklist-overlay" data-action="toggle-checklist"></div>' +
    '<div class="checklist-drawer">' +
      '<div class="flex h-full flex-col p-5">' +
        '<div class="mb-4 flex items-center justify-between">' +
          '<h3 class="text-base font-bold text-dark-100">Progresso</h3>' +
          '<button data-action="toggle-checklist" aria-label="Fechar painel de progresso" class="flex h-11 w-11 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-700/50 hover:text-dark-200">' +
            App.icons.close +
          '</button>' +
        '</div>' +
        (state.employee.nomeCompleto
          ? '<div class="mb-4 rounded-lg bg-dark-800/80 border border-dark-700/50 p-3"><p class="text-xs text-dark-500">Funcionário</p><p class="text-sm font-semibold text-dark-100">' + App.escapeHtml(state.employee.nomeCompleto) + '</p></div>'
          : '') +
        (state.startedAt
          ? '<div class="mb-4 rounded-lg bg-brand-500/10 border border-brand-500/20 p-3"><p class="text-xs text-dark-400">Tempo decorrido</p><p id="elapsed-timer" class="text-sm font-semibold text-brand-400">' + App.formatElapsedTime(state.startedAt) + '</p></div>'
          : '') +
        '<div class="mb-4">' +
          '<div class="mb-2 flex items-center justify-between text-sm">' +
            '<span class="text-dark-400">' + completedCount + ' de ' + totalCount + '</span>' +
            '<span class="font-semibold text-brand-400">' + Math.round((completedCount / totalCount) * 100) + '%</span>' +
          '</div>' +
          '<div class="h-2 rounded-full bg-dark-700">' +
            '<div class="h-2 rounded-full bg-brand-500 transition-all duration-500" style="width:' + ((completedCount / totalCount) * 100) + '%"></div>' +
          '</div>' +
        '</div>' +
        '<div class="divide-y divide-dark-700/50">' + itemsHtml + '</div>' +
      '</div>' +
    '</div>';
};

App.renderChecklistFab = function(state) {
  var completedCount = Object.values(state.platforms).filter(function(p) { return p.completed; }).length;

  return '' +
    '<button class="checklist-fab no-print" data-action="toggle-checklist" aria-label="Ver progresso das contas" title="Ver progresso">' +
      App.icons.clipboard +
      (completedCount > 0
        ? '<span class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white shadow">' + completedCount + '</span>'
        : '') +
    '</button>';
};
