var App = App || {};

App.renderGuide = function(state) {
  var platform = App.platforms[state.currentGuide];
  if (!platform) return '<p>Plataforma não encontrada.</p>';

  var step = platform.steps[state.currentStep];
  var totalSteps = platform.steps.length;
  var isFirst = state.currentStep === 0;
  var isLast = state.currentStep === totalSteps - 1;
  var isCompleted = state.platforms[platform.id] && state.platforms[platform.id].completed;

  var stepsProgress = platform.steps.map(function(_, i) {
    var isDone = i < state.currentStep;
    var isCurrent = i === state.currentStep;
    var color = isDone ? 'bg-brand-500' : isCurrent ? 'bg-brand-400' : 'bg-gray-200';
    return '<div class="h-1.5 flex-1 rounded-full ' + color + ' transition-colors"></div>';
  }).join('');

  var registerButton = step.action === 'open_register'
    ? '<button data-action="open-register" class="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700 hover:shadow-xl active:scale-[0.98]">' +
        App.icons.externalLink + ' Abrir Página de Cadastro</button>'
    : '';

  var placeholders = {
    gmail: 'Ex: seunome@gmail.com',
    instagram: 'Ex: @seunome',
    facebook: 'Ex: facebook.com/seunome',
    tiktok: 'Ex: @seunome'
  };

  var finishForm = step.action === 'finish'
    ? '<div class="mt-6 rounded-xl border-2 border-brand-200 bg-brand-50 p-5">' +
        '<h4 class="mb-2 font-semibold text-brand-800">Registre sua conta criada</h4>' +
        '<form id="complete-platform-form" class="flex flex-col gap-3 sm:flex-row">' +
          '<input type="text" name="accountInfo" placeholder="' + (placeholders[platform.id] || 'Digite sua conta') + '"' +
            ' required value="' + (isCompleted ? state.platforms[platform.id].accountInfo : '') + '"' +
            ' class="flex-1 rounded-lg border border-brand-300 bg-white px-4 py-3 text-base placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />' +
          '<button type="submit" class="rounded-lg ' + (isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-brand-600 hover:bg-brand-700') +
            ' px-6 py-3 text-sm font-semibold text-white transition-colors whitespace-nowrap">' +
            (isCompleted ? '&#10003; Atualizar' : 'Marcar como Concluído') +
          '</button>' +
        '</form>' +
      '</div>'
    : '';

  var prevButton = !isFirst
    ? '<button data-action="guide-prev" class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">' +
        App.icons.chevronLeft + ' Anterior</button>'
    : '<div class="flex-1"></div>';

  var nextButton = !isLast
    ? '<button data-action="guide-next" class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700">' +
        'Próximo ' + App.icons.chevronRight + '</button>'
    : '';

  return '' +
    '<div>' +
      '<button data-action="back-platforms" class="no-print mb-4 flex items-center gap-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700">' +
        App.icons.chevronLeft + ' Voltar para Plataformas</button>' +
      '<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">' +
        '<div class="mb-4 flex items-center justify-between">' +
          '<span class="text-sm font-medium text-gray-500">Passo ' + (state.currentStep + 1) + ' de ' + totalSteps + '</span>' +
          '<span class="inline-flex items-center gap-2 rounded-full ' + platform.color.bg + ' ' + platform.color.border + ' border px-3 py-1 text-sm font-medium ' + platform.color.text + '">' +
            '<span class="[&>svg]:w-4 [&>svg]:h-4">' + platform.icon + '</span>' +
            platform.name +
          '</span>' +
        '</div>' +
        '<div class="mb-6 flex gap-1">' + stepsProgress + '</div>' +
        '<h3 class="mb-4 text-xl font-bold text-gray-900">' + step.title + '</h3>' +
        registerButton +
        '<div class="mb-4 text-base leading-relaxed text-gray-700">' + step.description + '</div>' +
        (step.tip
          ? '<div class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">' +
              '<p class="text-sm text-amber-800"><strong class="font-semibold">&#128161; Dica:</strong> ' + step.tip + '</p></div>'
          : '') +
        finishForm +
        '<div class="mt-6 flex gap-3 no-print">' + prevButton + nextButton + '</div>' +
      '</div>' +
    '</div>';
};
