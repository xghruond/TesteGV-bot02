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
    var color = isDone ? 'bg-brand-500' : isCurrent ? 'bg-brand-400' : 'bg-dark-700';
    return '<div class="h-1.5 flex-1 rounded-full ' + color + ' transition-colors"></div>';
  }).join('');

  var registerButton = step.action === 'open_register'
    ? '<button data-action="open-register" class="mb-6 flex w-full items-center justify-center gap-2 btn-futuristic rounded-xl px-6 py-4 text-base font-semibold text-white active:scale-[0.98]">' +
        App.icons.externalLink + ' Abrir Página de Cadastro</button>'
    : '';

  var placeholders = {
    protonmail: 'Ex: seunome@proton.me',
    instagram: 'Ex: @seunome',
    facebook: 'Ex: facebook.com/seunome',
    tiktok: 'Ex: @seunome'
  };

  var accountSuggestion = App.suggestAccountInfo(platform.id, state.employee.emailDesejado);

  var finishForm = step.action === 'finish'
    ? '<div class="mt-6 rounded-xl border border-brand-500/30 bg-dark-900/30 backdrop-blur-sm p-5">' +
        '<h4 class="mb-2 font-semibold text-brand-400">Registre sua conta criada</h4>' +
        (accountSuggestion
          ? '<button type="button" data-action="use-account-suggestion" data-suggestion="' + App.escapeHtml(accountSuggestion) + '" class="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-brand-500/20 transition-colors">' +
              App.icons.sparkles + ' Usar sugestão: <strong>' + App.escapeHtml(accountSuggestion) + '</strong>' +
            '</button>'
          : '') +
        '<form id="complete-platform-form" class="flex flex-col gap-3 sm:flex-row">' +
          '<input type="text" name="accountInfo" placeholder="' + (placeholders[platform.id] || 'Digite sua conta') + '"' +
            ' required value="' + (isCompleted ? App.escapeHtml(state.platforms[platform.id].accountInfo) : '') + '"' +
            ' class="dark-input flex-1 rounded-lg px-4 py-3 text-base focus:outline-none" />' +
          '<button type="submit" class="rounded-lg ' + (isCompleted ? 'bg-green-600 hover:bg-green-700' : 'bg-brand-600 hover:bg-brand-700') +
            ' px-6 py-3 text-sm font-semibold text-white transition-colors whitespace-nowrap">' +
            (isCompleted ? '&#10003; Atualizar' : 'Marcar como Concluído') +
          '</button>' +
        '</form>' +
      '</div>'
    : '';

  var prevButton = !isFirst
    ? '<button data-action="guide-prev" aria-label="Passo anterior" class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dark-600/50 px-4 py-3 text-sm font-medium text-dark-300 transition-colors hover:bg-dark-700/50 hover:text-dark-100">' +
        App.icons.chevronLeft + ' Anterior</button>'
    : '<div class="flex-1"></div>';

  var nextButton = !isLast
    ? '<button data-action="guide-next" aria-label="Próximo passo" class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700">' +
        'Próximo ' + App.icons.chevronRight + '</button>'
    : '';

  return '' +
    '<div>' +
      '<button data-action="back-platforms" aria-label="Voltar para plataformas" class="no-print mb-4 flex items-center gap-1 text-sm font-medium text-dark-400 transition-colors hover:text-brand-400">' +
        App.icons.chevronLeft + ' Voltar para Plataformas</button>' +
      '<div class="rounded-xl border border-dark-700/40 bg-dark-900/30 backdrop-blur-sm p-6 shadow-lg shadow-black/10">' +
        '<div class="mb-4 flex items-center justify-between">' +
          '<span class="text-sm font-medium text-dark-400">Passo ' + (state.currentStep + 1) + ' de ' + totalSteps + '</span>' +
          '<span class="inline-flex items-center gap-2 rounded-full ' + platform.color.accent + ' px-3 py-1 text-sm font-medium text-white">' +
            '<span class="[&>svg]:w-4 [&>svg]:h-4">' + platform.icon + '</span>' +
            platform.name +
          '</span>' +
        '</div>' +
        '<div class="mb-6 flex gap-1">' + stepsProgress + '</div>' +
        '<h3 class="mb-4 text-xl font-bold text-dark-50">' + step.title + '</h3>' +
        registerButton +
        '<div class="mb-4 text-base leading-relaxed text-dark-300">' + step.description + '</div>' +
        (step.tip
          ? '<div class="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">' +
              '<p class="text-sm text-amber-300"><strong class="font-semibold">&#128161; Dica:</strong> ' + step.tip + '</p></div>'
          : '') +
        '<div class="mb-4 rounded-xl border border-dark-700/40 bg-dark-900/30 p-4">' +
          '<button data-action="toggle-password-tool" class="flex w-full items-center justify-between text-sm font-medium text-dark-300">' +
            '<span class="flex items-center gap-2">' + App.icons.key + ' Gerador de Senha Segura</span>' +
            '<span class="text-xs text-dark-500">clique para abrir</span>' +
          '</button>' +
          '<div id="password-tool-body" style="display:none" class="mt-3">' +
            '<div class="flex gap-2">' +
              '<div class="relative flex-1">' +
                '<input type="password" id="generated-password" readonly class="dark-input w-full rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none" placeholder="Clique em Gerar" />' +
                '<button data-action="toggle-password-visibility" aria-label="Mostrar ou esconder senha" class="password-toggle">' + App.icons.eye + '</button>' +
              '</div>' +
              '<button data-action="generate-password" class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors whitespace-nowrap">Gerar</button>' +
              '<button data-action="copy-password" aria-label="Copiar senha" class="rounded-lg border border-dark-600/50 px-3 py-2 text-sm text-dark-400 hover:bg-dark-700/50 hover:text-brand-400 transition-colors" title="Copiar">' + App.icons.copy + '</button>' +
            '</div>' +
            '<p class="mt-2 text-xs text-dark-500">14 caracteres com maiúsculas, minúsculas, números e símbolos.</p>' +
          '</div>' +
        '</div>' +
        finishForm +
        '<div class="mt-6 flex gap-3 no-print">' + prevButton + nextButton + '</div>' +
      '</div>' +
    '</div>';
};
