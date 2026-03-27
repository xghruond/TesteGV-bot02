var App = App || {};

App.renderPlatformCards = function(state) {
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
      ? '<p class="mt-1 text-xs text-gray-500 truncate max-w-[180px]">' + App.escapeHtml(pState.accountInfo) + '</p>'
      : '';

    var buttonText = isCompleted ? 'Ver novamente' : 'Criar conta';
    var borderColor = isCompleted ? 'border-green-300 bg-green-50/30' : platform.color.border + ' ' + platform.color.hover;

    return '' +
      '<button data-platform="' + platform.id + '" class="platform-card flex flex-col items-center gap-3 rounded-xl border-2 ' + borderColor + ' p-6 text-center transition-all hover:shadow-md">' +
        '<div class="flex h-16 w-16 items-center justify-center rounded-2xl ' + platform.color.accent + ' text-white shadow-sm">' +
          '<div class="flex items-center justify-center [&>svg]:!fill-white [&>svg]:!w-8 [&>svg]:!h-8">' + platform.icon + '</div>' +
        '</div>' +
        '<div>' +
          '<p class="text-lg font-semibold text-gray-900">' + platform.name + '</p>' +
          '<p class="text-sm text-gray-500">' + platform.description + '</p>' +
          accountInfo +
        '</div>' +
        statusBadge +
        '<span class="mt-1 inline-flex items-center gap-1 text-sm font-medium ' + (isCompleted ? 'text-green-600' : 'text-brand-600') + '">' +
          buttonText + ' ' + (isCompleted ? '' : App.icons.chevronRight) +
        '</span>' +
      '</button>';
  }).join('');

  var summaryButton = allDone
    ? '<div class="mt-6"><button data-action="view-summary" class="w-full rounded-xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 transition-all hover:bg-brand-700 hover:shadow-xl active:scale-[0.98]">' +
        App.icons.sparkles + ' Ver Resumo Final</button></div>'
    : '';

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
      '<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">' + cardsHtml + '</div>' +
      summaryButton +
    '</div>';
};
