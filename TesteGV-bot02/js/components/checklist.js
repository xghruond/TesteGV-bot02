var App = App || {};

App.renderChecklist = function(state) {
  var completedCount = Object.values(state.platforms).filter(function(p) { return p.completed; }).length;
  var totalCount = Object.keys(state.platforms).length;

  var itemsHtml = Object.values(App.platforms).map(function(platform) {
    var pState = state.platforms[platform.id];
    var isCompleted = pState.completed;

    var checkIcon = isCompleted
      ? '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">' + App.icons.check + '</div>'
      : '<div class="h-6 w-6 rounded-full border-2 border-gray-300"></div>';

    var accountInfo = isCompleted && pState.accountInfo
      ? '<span class="block truncate text-xs text-gray-500">' + App.escapeHtml(pState.accountInfo) + '</span>'
      : '';

    return '' +
      '<div class="flex items-center gap-3 py-2">' +
        checkIcon +
        '<div class="min-w-0 flex-1">' +
          '<span class="text-sm font-medium ' + (isCompleted ? 'text-gray-900' : 'text-gray-500') + '">' + platform.name + '</span>' +
          accountInfo +
        '</div>' +
      '</div>';
  }).join('');

  return '' +
    '<div class="checklist-overlay" data-action="toggle-checklist"></div>' +
    '<div class="checklist-drawer">' +
      '<div class="flex h-full flex-col p-5">' +
        '<div class="mb-4 flex items-center justify-between">' +
          '<h3 class="text-base font-bold text-gray-900">Progresso</h3>' +
          '<button data-action="toggle-checklist" class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">' +
            App.icons.close +
          '</button>' +
        '</div>' +
        (state.employee.nomeCompleto
          ? '<div class="mb-4 rounded-lg bg-gray-50 p-3"><p class="text-xs text-gray-500">Funcionário</p><p class="text-sm font-semibold text-gray-900">' + App.escapeHtml(state.employee.nomeCompleto) + '</p></div>'
          : '') +
        '<div class="mb-4">' +
          '<div class="mb-2 flex items-center justify-between text-sm">' +
            '<span class="text-gray-600">' + completedCount + ' de ' + totalCount + '</span>' +
            '<span class="font-semibold text-brand-600">' + Math.round((completedCount / totalCount) * 100) + '%</span>' +
          '</div>' +
          '<div class="h-2 rounded-full bg-gray-200">' +
            '<div class="h-2 rounded-full bg-brand-500 transition-all duration-500" style="width:' + ((completedCount / totalCount) * 100) + '%"></div>' +
          '</div>' +
        '</div>' +
        '<div class="divide-y divide-gray-100">' + itemsHtml + '</div>' +
      '</div>' +
    '</div>';
};

App.renderChecklistFab = function(state) {
  var completedCount = Object.values(state.platforms).filter(function(p) { return p.completed; }).length;

  return '' +
    '<button class="checklist-fab no-print" data-action="toggle-checklist" title="Ver progresso">' +
      App.icons.clipboard +
      (completedCount > 0
        ? '<span class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-600 shadow">' + completedCount + '</span>'
        : '') +
    '</button>';
};
