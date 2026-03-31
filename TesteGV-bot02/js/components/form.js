var App = App || {};

App.renderForm = function(state) {
  var fieldsHtml = App.formFields.map(function(field) {
    var value = state.employee[field.id] || '';
    var iconHtml = App.icons[field.icon] || '';
    var requiredMark = field.required
      ? ' <span class="text-red-400">*</span><span class="required-indicator">(obrigatório)</span>'
      : '';

    if (field.type === 'select') {
      var optionsHtml = field.options.map(function(opt) {
        return '<option value="' + opt.value + '"' + (value === opt.value ? ' selected' : '') + '>' + opt.label + '</option>';
      }).join('');

      return '' +
        '<div>' +
          '<label for="' + field.id + '" class="mb-1.5 block text-sm font-medium text-dark-200">' +
            field.label + requiredMark +
          '</label>' +
          '<div class="relative">' +
            '<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-dark-500">' + iconHtml + '</div>' +
            '<select id="' + field.id + '" name="' + field.id + '"' + (field.required ? ' required aria-required="true"' : '') +
              ' class="dark-input block w-full rounded-xl py-3 pl-10 pr-4 text-base transition-colors focus:outline-none">' +
              optionsHtml +
            '</select>' +
          '</div>' +
        '</div>';
    }

    // Campo telefone → botão de seleção de número Twilio
    if (field.id === 'telefone') {
      var phoneVal = state.employee.telefone || '';
      return '' +
        '<div>' +
          '<label class="mb-1.5 block text-sm font-medium text-dark-200">' +
            field.label + requiredMark +
          '</label>' +
          '<div class="relative">' +
            '<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-dark-500">' + iconHtml + '</div>' +
            '<button type="button" data-action="select-twilio-number" ' +
              'class="dark-input flex items-center w-full rounded-xl py-3 pl-10 pr-4 text-base transition-colors text-left cursor-pointer hover:border-brand-500/50">' +
              (phoneVal
                ? '<span class="font-mono text-dark-100">' + App.escapeHtml(phoneVal) + '</span>'
                : '<span class="text-dark-500">' + App.escapeHtml(field.placeholder || 'Selecionar número Twilio') + '</span>'
              ) +
              '<span class="ml-auto text-xs text-dark-600 shrink-0">' + App.icons.chevronRight + '</span>' +
            '</button>' +
          '</div>' +
          (field.helpText ? '<p class="mt-1 text-xs text-dark-500">' + field.helpText + '</p>' : '') +
        '</div>';
    }

    var emailExtras = '';
    if (field.id === 'emailDesejado') {
      emailExtras =
        '<div id="email-variations-chips" class="mt-2 flex flex-wrap gap-1.5"></div>' +
        '<button type="button" data-action="regenerate-email" aria-label="Gerar novas sugestões de e-mail" class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-500/20 transition-colors">' +
          App.icons.refresh + ' Gerar novas sugestões</button>';
    }

    return '' +
      '<div>' +
        '<label for="' + field.id + '" class="mb-1.5 block text-sm font-medium text-dark-200">' +
          field.label + requiredMark +
        '</label>' +
        '<div class="relative">' +
          '<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-dark-500">' + iconHtml + '</div>' +
          '<input type="' + field.type + '" id="' + field.id + '" name="' + field.id + '"' +
            ' value="' + App.escapeHtml(value) + '"' +
            (field.placeholder ? ' placeholder="' + field.placeholder + '"' : '') +
            (field.required ? ' required aria-required="true"' : '') +
            (field.minLength ? ' minlength="' + field.minLength + '"' : '') +
            (field.helpText ? ' aria-describedby="' + field.id + '-help"' : '') +
            ' class="dark-input block w-full rounded-xl py-3 pl-10 pr-4 text-base transition-colors focus:outline-none" />' +
        '</div>' +
        (field.helpText ? '<p id="' + field.id + '-help" class="mt-1 text-xs text-dark-500">' + field.helpText + '</p>' : '') +
        emailExtras +
      '</div>';
  }).join('');

  return '' +
    '<div class="mx-auto max-w-2xl">' +
      '<div class="mb-6 text-center">' +
        '<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">' + App.icons.user + '</div>' +
        '<h2 class="text-2xl font-bold text-dark-50">Seus Dados</h2>' +
        '<p class="mt-1 text-dark-400">Preencha suas informações pessoais para começar</p>' +
      '</div>' +
      '<form id="employee-form" class="p-2" novalidate>' +
        '<div class="space-y-5">' + fieldsHtml + '</div>' +
        '<div class="mt-8 flex flex-col sm:flex-row gap-3">' +
          '<button type="button" data-action="back-to-welcome" aria-label="Voltar para tela inicial" class="rounded-xl border border-dark-700/50 px-4 py-3.5 text-sm font-semibold text-dark-300 transition-all hover:bg-dark-800/50 hover:text-white backdrop-blur-sm">' +
            App.icons.chevronLeft + ' Voltar' +
          '</button>' +
          '<button type="button" data-action="auto-fill-form" aria-label="Preencher formulário com dados de teste" class="flex-1 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3.5 text-sm font-semibold text-brand-400 transition-all hover:bg-brand-500/20 backdrop-blur-sm">' +
            App.icons.sparkles + ' Dados de Teste' +
          '</button>' +
          '<button type="submit" class="btn-futuristic flex-1 rounded-xl px-6 py-3.5 text-base font-semibold text-white active:scale-[0.98]">' +
            'Continuar' +
          '</button>' +
        '</div>' +
        '<div class="mt-3 flex justify-center">' +
          '<button type="button" data-action="submit-form-to-platforms" class="flex items-center gap-1.5 text-sm text-dark-500 hover:text-brand-400 transition-colors">' +
            App.icons.chevronRight + ' Ir para o Painel Manual' +
          '</button>' +
        '</div>' +
      '</form>' +
    '</div>';
};
