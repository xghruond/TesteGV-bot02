var App = App || {};

App.renderHeader = function(state) {
  var screenOrder = ['welcome', 'form', 'platforms', 'guide', 'summary'];
  var screenLabels = {
    welcome: 'Início', form: 'Dados', platforms: 'Contas', guide: 'Guia', summary: 'Resumo'
  };
  var currentIndex = screenOrder.indexOf(state.currentScreen);
  var currentLabel = screenLabels[state.currentScreen] || '';

  var progressSteps = screenOrder.slice(1).map(function(screen, i) {
    var isActive = i <= currentIndex - 1;
    return '<div class="h-1.5 flex-1 rounded-full ' + (isActive ? 'bg-brand-500' : 'bg-gray-200') + ' transition-colors duration-300"></div>';
  }).join('');

  return '' +
    '<div class="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm">' +
      '<div class="container mx-auto max-w-3xl px-4">' +
        '<div class="flex items-center justify-between py-3">' +
          '<div class="flex items-center gap-3">' +
            '<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
            '</div>' +
            '<div>' +
              '<h1 class="text-sm font-bold text-gray-900">Onboarding</h1>' +
              '<p class="text-xs text-gray-500">' + currentLabel + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            (state.employee.nomeCompleto ? '<span class="hidden text-xs text-gray-500 sm:inline">' + App.escapeHtml(state.employee.nomeCompleto) + '</span>' : '') +
            '<button data-action="reset" class="no-print flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500" title="Recomeçar">' +
              App.icons.refresh +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="flex gap-1.5 pb-3">' + progressSteps + '</div>' +
      '</div>' +
    '</div>';
};
