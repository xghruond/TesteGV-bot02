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
          '<label for="' + field.id + '" class="mb-1.5 block text-sm font-medium text-gray-700">' +
            field.label + (field.required ? ' <span class="text-red-500">*</span>' : '') +
          '</label>' +
          '<div class="relative">' +
            '<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">' + iconHtml + '</div>' +
            '<select id="' + field.id + '" name="' + field.id + '"' + (field.required ? ' required' : '') +
              ' class="block w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-base text-gray-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20">' +
              optionsHtml +
            '</select>' +
          '</div>' +
        '</div>';
    }

    return '' +
      '<div>' +
        '<label for="' + field.id + '" class="mb-1.5 block text-sm font-medium text-gray-700">' +
          field.label + (field.required ? ' <span class="text-red-500">*</span>' : '') +
        '</label>' +
        '<div class="relative">' +
          '<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">' + iconHtml + '</div>' +
          '<input type="' + field.type + '" id="' + field.id + '" name="' + field.id + '"' +
            ' value="' + App.escapeHtml(value) + '"' +
            (field.placeholder ? ' placeholder="' + field.placeholder + '"' : '') +
            (field.required ? ' required' : '') +
            (field.minLength ? ' minlength="' + field.minLength + '"' : '') +
            (field.helpText ? ' aria-describedby="' + field.id + '-help"' : '') +
            ' class="block w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />' +
        '</div>' +
        (field.helpText ? '<p id="' + field.id + '-help" class="mt-1 text-xs text-gray-500">' + field.helpText + '</p>' : '') +
      '</div>';
  }).join('');

  return '' +
    '<div class="mx-auto max-w-lg">' +
      '<div class="mb-6 text-center">' +
        '<div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">' + App.icons.user + '</div>' +
        '<h2 class="text-2xl font-bold text-gray-900">Seus Dados</h2>' +
        '<p class="mt-1 text-gray-500">Preencha suas informações pessoais para começar</p>' +
      '</div>' +
      '<form id="employee-form" class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">' +
        '<div class="space-y-4">' + fieldsHtml + '</div>' +
        '<button type="submit" class="mt-6 w-full rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-brand-600/20 transition-all hover:bg-brand-700 hover:shadow-lg active:scale-[0.98]">' +
          'Continuar' +
        '</button>' +
      '</form>' +
    '</div>';
};
