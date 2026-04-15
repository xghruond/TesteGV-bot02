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
    var isCompleted = i < currentIndex - 1;
    var isActive = i === currentIndex - 1;
    var label = screenLabels[screen];

    var circleClass = isCompleted
      ? 'bg-brand-500 text-white'
      : isActive
        ? 'bg-brand-500/20 border-2 border-brand-500 text-brand-400'
        : 'bg-dark-700 text-dark-500';

    var circleContent = isCompleted
      ? '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
      : '<span class="text-[10px] font-bold">' + (i + 1) + '</span>';

    var labelClass = isActive ? 'text-brand-400 font-medium' : isCompleted ? 'text-dark-300' : 'text-dark-600';

    var line = i > 0
      ? '<div class="flex-1 h-0.5 ' + (isCompleted || isActive ? 'bg-brand-500/50' : 'bg-dark-700') + ' mx-1 transition-colors duration-300"></div>'
      : '';

    return line +
      '<div class="flex flex-col items-center gap-1">' +
        '<div class="flex h-6 w-6 items-center justify-center rounded-full ' + circleClass + ' transition-all duration-300">' +
          circleContent +
        '</div>' +
        '<span class="text-[9px] ' + labelClass + ' hidden sm:block whitespace-nowrap transition-colors duration-300">' + label + '</span>' +
      '</div>';
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
            '<div id="bot-status-badge" class="hidden"></div>' +
            '<div id="connectivity-badge" class="hidden flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer" title="Status de conectividade"></div>' +
            (state.employee.nomeCompleto ? '<span class="hidden text-xs text-dark-400 sm:inline">' + App.escapeHtml(state.employee.nomeCompleto) + '</span>' : '') +
            '<button data-action="toggle-theme" aria-label="Alternar tema claro/escuro" title="Alternar tema" class="no-print flex h-9 w-9 items-center justify-center rounded-lg text-dark-500 transition-colors hover:bg-brand-500/10 hover:text-brand-400">' +
              '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>' +
            '</button>' +
            '<button data-action="show-shortcuts" aria-label="Ver atalhos de teclado" title="Atalhos (?)" class="no-print flex h-9 w-9 items-center justify-center rounded-lg text-dark-500 transition-colors hover:bg-brand-500/10 hover:text-brand-400">' +
              '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
            '</button>' +
            '<button data-action="reset" aria-label="Recomeçar onboarding" class="no-print flex h-9 w-9 items-center justify-center rounded-lg text-dark-500 transition-colors hover:bg-red-500/10 hover:text-red-400" title="Recomeçar">' +
              App.icons.refresh +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center pb-3">' + progressSteps + '</div>' +
      '</div>' +
    '</div>';
};
