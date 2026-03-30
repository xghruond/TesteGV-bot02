var App = App || {};

App.renderHeader = function(state) {
  var screenOrder = ['welcome', 'form', 'platforms', 'guide', 'summary'];
  var screenLabels = {
    welcome: 'Início', form: 'Dados', platforms: 'Contas', guide: 'Guia', summary: 'Resumo'
  };
  var effectiveScreen = state.currentScreen === 'wizard' ? 'platforms' : state.currentScreen;
  var currentIndex = screenOrder.indexOf(effectiveScreen);
  var currentLabel = state.currentScreen === 'wizard' ? 'Assistente' : (screenLabels[state.currentScreen] || '');

  var progressSteps = screenOrder.slice(1).map(function(screen, i) {
    var isActive = i <= currentIndex - 1;
    return '<div class="h-1.5 flex-1 rounded-full ' + (isActive ? 'bg-brand-500' : 'bg-dark-700') + ' transition-colors duration-300"></div>';
  }).join('');

  return '' +
    '<div class="sticky top-0 z-20 dark-header">' +
      '<div class="container mx-auto max-w-5xl px-4">' +
        '<div class="flex items-center justify-between py-3">' +
          '<div class="flex items-center gap-3">' +
            '<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 text-white">' +
              App.icons.robotSmall +
            '</div>' +
            '<div>' +
              '<h1 class="text-sm font-bold text-gradient">Green BOT</h1>' +
              '<p class="text-xs text-dark-400">' + currentLabel + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            (state.employee.nomeCompleto ? '<span class="hidden text-xs text-dark-400 sm:inline">' + App.escapeHtml(state.employee.nomeCompleto) + '</span>' : '') +
            '<button data-action="reset" class="no-print flex h-8 w-8 items-center justify-center rounded-lg text-dark-500 transition-colors hover:bg-red-500/10 hover:text-red-400" title="Recomeçar">' +
              App.icons.refresh +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="flex gap-1.5 pb-3">' + progressSteps + '</div>' +
      '</div>' +
    '</div>';
};
