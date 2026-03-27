var App = App || {};

(function() {
  // Estado padrão
  var defaultState = {
    currentScreen: 'welcome',
    currentGuide: null,
    currentStep: 0,
    employee: {
      nomeCompleto: '',
      emailDesejado: '',
      telefone: '',
      dataNascimento: '',
      cargo: '',
      departamento: '',
      dataAdmissao: ''
    },
    platforms: {
      gmail: { completed: false, accountInfo: '' },
      instagram: { completed: false, accountInfo: '' },
      facebook: { completed: false, accountInfo: '' },
      tiktok: { completed: false, accountInfo: '' }
    },
    startedAt: null,
    completedAt: null
  };

  // Estado atual
  var state = JSON.parse(JSON.stringify(defaultState));
  var hasSavedState = false;

  // Restaurar estado salvo
  var saved = App.storage.load();
  if (saved) {
    hasSavedState = true;
    state = mergeDeep(JSON.parse(JSON.stringify(defaultState)), saved);
  }

  function mergeDeep(target, source) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          mergeDeep(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
    return target;
  }

  // Funções de navegação e estado
  function navigateTo(screen, options) {
    options = options || {};
    state.currentScreen = screen;
    if (options.guide) state.currentGuide = options.guide;
    if (options.step !== undefined) state.currentStep = options.step;
    App.storage.save(state);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetApp() {
    App.storage.clear();
    state = JSON.parse(JSON.stringify(defaultState));
    hasSavedState = false;
    render();
  }

  // Tela de boas-vindas
  function renderWelcome() {
    return '' +
      '<div class="flex min-h-[80vh] items-center justify-center">' +
        '<div class="w-full max-w-lg text-center">' +
          '<div class="mb-8">' +
            '<div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">' +
              App.icons.users +
            '</div>' +
            '<h1 class="mb-3 text-3xl font-extrabold text-gray-900">Bem-vindo ao Onboarding!</h1>' +
            '<p class="text-lg text-gray-500">Vamos te ajudar a criar suas contas profissionais de forma simples e rápida.</p>' +
          '</div>' +
          '<div class="mb-8 rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm">' +
            '<h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">O que vamos criar:</h3>' +
            '<div class="space-y-3">' +
              renderWelcomeItem('bg-red-100', '&#128231;', 'Gmail (Google)', 'Seu e-mail profissional') +
              renderWelcomeItem('bg-pink-100', '&#128248;', 'Instagram', 'Perfil na rede social') +
              renderWelcomeItem('bg-blue-100', '&#128101;', 'Facebook', 'Conta na rede social') +
              renderWelcomeItem('bg-gray-100', '&#127925;', 'TikTok', 'Perfil de vídeos curtos') +
            '</div>' +
          '</div>' +
          '<button data-action="start" class="w-full rounded-xl bg-brand-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-brand-600/30 transition-all hover:bg-brand-700 hover:shadow-xl hover:shadow-brand-700/30 active:scale-[0.98]">' +
            'Iniciar Onboarding' +
          '</button>' +
          (hasSavedState
            ? '<button data-action="continue" class="mt-3 w-full rounded-xl border border-brand-200 bg-brand-50 px-8 py-3 text-base font-medium text-brand-700 transition-all hover:bg-brand-100">Continuar de onde parei</button>'
            : '') +
        '</div>' +
      '</div>';
  }

  function renderWelcomeItem(bgClass, emoji, title, subtitle) {
    return '' +
      '<div class="flex items-center gap-3">' +
        '<div class="flex h-10 w-10 items-center justify-center rounded-lg ' + bgClass + '">' +
          '<span class="text-lg">' + emoji + '</span>' +
        '</div>' +
        '<div>' +
          '<p class="font-medium text-gray-900">' + title + '</p>' +
          '<p class="text-sm text-gray-500">' + subtitle + '</p>' +
        '</div>' +
      '</div>';
  }

  // Renderização principal
  function render() {
    var header = document.getElementById('app-header');
    var content = document.getElementById('app-content');
    var checklistContainer = document.getElementById('app-checklist');

    if (state.currentScreen === 'welcome') {
      header.innerHTML = '';
    } else {
      header.innerHTML = App.renderHeader(state);
    }

    switch (state.currentScreen) {
      case 'welcome':
        content.innerHTML = renderWelcome();
        break;
      case 'form':
        content.innerHTML = App.renderForm(state);
        break;
      case 'platforms':
        content.innerHTML = App.renderPlatformCards(state);
        break;
      case 'guide':
        content.innerHTML = App.renderGuide(state);
        break;
      case 'summary':
        content.innerHTML = App.renderSummary(state);
        break;
      default:
        content.innerHTML = renderWelcome();
    }

    if (state.currentScreen === 'platforms' || state.currentScreen === 'guide') {
      checklistContainer.innerHTML = App.renderChecklistFab(state) + App.renderChecklist(state);
    } else {
      checklistContainer.innerHTML = '';
    }

    var firstChild = content.querySelector(':first-child');
    if (firstChild) firstChild.classList.add('screen-enter');

    bindEvents();
  }

  // Bind de todos os eventos
  function bindEvents() {
    // Iniciar
    bindAction('start', function() {
      state.startedAt = new Date().toISOString();
      navigateTo('form');
    });

    // Continuar
    bindAction('continue', function() {
      var saved = App.storage.load();
      if (saved) {
        state = mergeDeep(JSON.parse(JSON.stringify(defaultState)), saved);
        render();
      }
    });

    // Voltar para plataformas
    bindAction('back-platforms', function() {
      navigateTo('platforms');
    });

    // Formulário do funcionário
    var form = document.getElementById('employee-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var formData = new FormData(form);
        formData.forEach(function(value, key) {
          state.employee[key] = value;
        });
        App.storage.save(state);
        navigateTo('platforms');
      });

      // Máscara de telefone
      var phoneInput = form.querySelector('[name="telefone"]');
      if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
          var value = e.target.value.replace(/\D/g, '');
          if (value.length > 11) value = value.slice(0, 11);
          if (value.length > 6) {
            value = '(' + value.slice(0, 2) + ') ' + value.slice(2, 7) + '-' + value.slice(7);
          } else if (value.length > 2) {
            value = '(' + value.slice(0, 2) + ') ' + value.slice(2);
          } else if (value.length > 0) {
            value = '(' + value;
          }
          e.target.value = value;
        });
      }
    }

    // Clique nas plataformas
    var platformCards = document.querySelectorAll('[data-platform]');
    platformCards.forEach(function(card) {
      card.addEventListener('click', function() {
        navigateTo('guide', { guide: card.dataset.platform, step: 0 });
      });
    });

    // Navegação do guia
    bindAction('guide-next', function() {
      var platform = App.platforms[state.currentGuide];
      if (state.currentStep < platform.steps.length - 1) {
        state.currentStep++;
        App.storage.save(state);
        render();
      }
    });

    bindAction('guide-prev', function() {
      if (state.currentStep > 0) {
        state.currentStep--;
        App.storage.save(state);
        render();
      }
    });

    // Abrir link de cadastro
    bindAction('open-register', function() {
      var platform = App.platforms[state.currentGuide];
      window.open(platform.registerUrl, '_blank');
    });

    // Marcar plataforma como concluída
    var completeForm = document.getElementById('complete-platform-form');
    if (completeForm) {
      completeForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var input = completeForm.querySelector('[name="accountInfo"]');
        var accountInfo = input ? input.value.trim() : '';
        if (accountInfo) {
          state.platforms[state.currentGuide] = { completed: true, accountInfo: accountInfo };
          App.storage.save(state);
          navigateTo('platforms');
        }
      });
    }

    // Ver resumo
    bindAction('view-summary', function() {
      state.completedAt = new Date().toISOString();
      App.storage.save(state);
      navigateTo('summary');
    });

    // Imprimir
    bindAction('print', function() {
      window.print();
    });

    // Resetar
    bindAction('reset', function() {
      if (confirm('Tem certeza que deseja começar um novo onboarding? Todos os dados serão apagados.')) {
        resetApp();
        navigateTo('welcome');
      }
    });

    // Toggle checklist
    bindAction('toggle-checklist', function() {
      var overlay = document.querySelector('.checklist-overlay');
      var drawer = document.querySelector('.checklist-drawer');
      if (overlay && drawer) {
        overlay.classList.toggle('active');
        drawer.classList.toggle('active');
      }
    });
  }

  function bindAction(actionName, handler) {
    var elements = document.querySelectorAll('[data-action="' + actionName + '"]');
    elements.forEach(function(el) {
      el.addEventListener('click', handler);
    });
  }

  // Iniciar a aplicação
  render();
})();
