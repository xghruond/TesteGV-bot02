var App = App || {};

App.renderForm = function(state) {
  var fieldsHtml = App.formFields.map(function(field) {
    var value = state.employee[field.id] || '';
    var iconHtml = App.icons[field.icon] || '';

    if (field.type === 'select') {
      var optionsHtml = field.options.map(function(opt) {
        return '<option value="' + opt.value + '"' + (value === opt.value ? ' selected' : '') + '>' + opt.label + '</option>';
      }).join('');

      return '' +
        '<div>' +
          '<label for="' + field.id + '" class="mb-1.5 block text-sm font-medium text-dark-200">' +
            field.label + (field.required ? ' <span class="text-red-400">*</span>' : '') +
          '</label>' +
          '<div class="relative">' +
            '<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-dark-500">' + iconHtml + '</div>' +
            '<select id="' + field.id + '" name="' + field.id + '"' + (field.required ? ' required' : '') +
              ' class="dark-input block w-full rounded-xl py-3 pl-10 pr-4 text-base transition-colors focus:outline-none">' +
              optionsHtml +
            '</select>' +
          '</div>' +
        '</div>';
    }

    var emailExtras = '';
    if (field.id === 'emailDesejado') {
      emailExtras =
        '<div id="email-variations-chips" class="mt-2 flex flex-wrap gap-1.5"></div>' +
        '<button type="button" data-action="regenerate-email" class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-500/20 transition-colors">' +
          App.icons.refresh + ' Gerar novas sugestões</button>';
    }

    return '' +
      '<div>' +
        '<label for="' + field.id + '" class="mb-1.5 block text-sm font-medium text-dark-200">' +
          field.label + (field.required ? ' <span class="text-red-400">*</span>' : '') +
        '</label>' +
        '<div class="relative">' +
          '<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-dark-500">' + iconHtml + '</div>' +
          '<input type="' + field.type + '" id="' + field.id + '" name="' + field.id + '"' +
            ' value="' + App.escapeHtml(value) + '"' +
            (field.placeholder ? ' placeholder="' + field.placeholder + '"' : '') +
            (field.required ? ' required' : '') +
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
      '<form id="employee-form" class="p-2">' +
        '<div class="space-y-5">' + fieldsHtml + '</div>' +
        '<div class="mt-8 flex gap-3">' +
          '<button type="button" data-action="back-to-welcome" class="rounded-xl border border-dark-700/50 px-4 py-3.5 text-sm font-semibold text-dark-300 transition-all hover:bg-dark-800/50 hover:text-white backdrop-blur-sm">' +
            App.icons.chevronLeft + ' Voltar' +
          '</button>' +
          '<button type="button" data-action="auto-fill-form" class="flex-1 rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-3.5 text-sm font-semibold text-brand-400 transition-all hover:bg-brand-500/20 backdrop-blur-sm">' +
            App.icons.sparkles + ' Gerar Dados de Teste' +
          '</button>' +
          '<button type="submit" class="btn-futuristic flex-[2] rounded-xl px-6 py-3.5 text-base font-semibold text-white active:scale-[0.98]">' +
            'Continuar' +
          '</button>' +
        '</div>' +
      '</form>' +
    '</div>';
};
