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
    suggestedPassword: null,
    startedAt: null,
    completedAt: null,
    viewingHistoryId: null
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

  // === Timer ===
  var timerInterval = null;

  function startTimer() {
    stopTimer();
    timerInterval = setInterval(function() {
      var el = document.getElementById('elapsed-timer');
      if (el && state.startedAt) {
        el.textContent = App.formatElapsedTime(state.startedAt);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Validação do formulário
  function validateForm(data) {
    var errors = [];
    if (!data.nomeCompleto || data.nomeCompleto.trim().length < 3) {
      errors.push('Nome completo deve ter pelo menos 3 caracteres.');
    }
    if (!data.emailDesejado || !/^[a-zA-Z0-9._-]+$/.test(data.emailDesejado)) {
      errors.push('E-mail desejado deve conter apenas letras, números, pontos e hífens.');
    }
    var phoneDigits = (data.telefone || '').replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      errors.push('Telefone deve ter 10 ou 11 dígitos (com DDD).');
    }
    if (!data.dataNascimento) {
      errors.push('Data de nascimento é obrigatória.');
    }
    if (!data.cargo || data.cargo.trim().length < 2) {
      errors.push('Cargo é obrigatório.');
    }
    if (!data.departamento) {
      errors.push('Selecione um departamento.');
    }
    if (!data.dataAdmissao) {
      errors.push('Data de admissão é obrigatória.');
    }
    return errors;
  }

  // Navegação
  function navigateTo(screen, options) {
    options = options || {};
    state.currentScreen = screen;
    if (options.guide) {
      if (!App.platforms[options.guide]) return;
      state.currentGuide = options.guide;
    }
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

  // Proteção contra perda de dados
  window.addEventListener('beforeunload', function(e) {
    if (state.currentScreen !== 'welcome' && state.currentScreen !== 'summary' &&
        state.currentScreen !== 'history' && state.currentScreen !== 'history-detail') {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ============================================================
  // === Event Delegation — um único listener no document      ===
  // === Captura cliques em qualquer [data-action] ou          ===
  // === [data-platform], mesmo gerados dinamicamente.         ===
  // ============================================================
  var actionHandlers = {};

  document.addEventListener('click', function(e) {
    // 1) data-action
    var actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      var action = actionEl.getAttribute('data-action');
      if (actionHandlers[action]) {
        actionHandlers[action](e, actionEl);
      }
      return;
    }

    // 2) data-platform (cards de plataforma)
    var platformEl = e.target.closest('[data-platform]');
    if (platformEl) {
      navigateTo('guide', { guide: platformEl.getAttribute('data-platform'), step: 0 });
    }
  });

  function bindAction(name, handler) {
    actionHandlers[name] = handler;
  }

  // === Tela de boas-vindas ===
  function renderWelcome() {
    var historyCount = App.storage.loadHistory().length;
    var historyButton = historyCount > 0
      ? '<button data-action="view-history" class="mt-3 w-full rounded-xl border border-gray-200 px-8 py-3 text-base font-medium text-gray-600 transition-all hover:bg-gray-100">' +
          App.icons.clipboard + ' Histórico (' + historyCount + ')</button>'
      : '';

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
          historyButton +
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

  // === Tela de histórico ===
  function renderHistory() {
    var history = App.storage.loadHistory();
    if (history.length === 0) {
      return '' +
        '<div class="flex min-h-[60vh] items-center justify-center">' +
          '<div class="text-center">' +
            '<p class="text-lg text-gray-500 mb-4">Nenhum onboarding realizado ainda.</p>' +
            '<button data-action="back-welcome" class="rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Voltar</button>' +
          '</div>' +
        '</div>';
    }

    var rows = history.slice().reverse().map(function(record) {
      var completedCount = Object.values(record.platforms).filter(function(p) { return p.completed; }).length;
      var total = Object.keys(record.platforms).length;
      return '' +
        '<div class="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-brand-300 transition-colors cursor-pointer" data-action="view-history-item" data-history-id="' + record.id + '">' +
          '<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">' + App.icons.user + '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="font-semibold text-gray-900 truncate">' + App.escapeHtml(record.employee.nomeCompleto) + '</p>' +
            '<p class="text-xs text-gray-500">' + App.escapeHtml(record.employee.emailDesejado) + '@gmail.com &bull; ' + completedCount + '/' + total + ' contas</p>' +
          '</div>' +
          '<div class="text-right shrink-0">' +
            '<p class="text-xs text-gray-400">' + App.formatDateTimeBR(record.completedAt) + '</p>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div>' +
        '<div class="mb-6 flex items-center justify-between">' +
          '<div>' +
            '<h2 class="text-2xl font-bold text-gray-900">Histórico de Onboardings</h2>' +
            '<p class="mt-1 text-gray-500">' + history.length + ' onboarding(s) realizado(s)</p>' +
          '</div>' +
          '<button data-action="back-welcome" class="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Voltar</button>' +
        '</div>' +
        '<div class="space-y-3">' + rows + '</div>' +
      '</div>';
  }

  function renderHistoryDetail(recordId) {
    var history = App.storage.loadHistory();
    var record = null;
    for (var i = 0; i < history.length; i++) {
      if (history[i].id === recordId) { record = history[i]; break; }
    }
    if (!record) return '<p>Registro não encontrado.</p>';

    var pseudoState = {
      employee: record.employee,
      platforms: record.platforms,
      startedAt: record.startedAt,
      completedAt: record.completedAt
    };

    return '' +
      '<div>' +
        '<button data-action="back-history" class="mb-4 flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700">' +
          App.icons.chevronLeft + ' Voltar ao Histórico</button>' +
        App.renderSummary(pseudoState) +
      '</div>';
  }

  // === Renderização principal ===
  function render() {
    var header = document.getElementById('app-header');
    var content = document.getElementById('app-content');
    var checklistContainer = document.getElementById('app-checklist');

    if (state.currentScreen === 'welcome' || state.currentScreen === 'history' || state.currentScreen === 'history-detail') {
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
      case 'history':
        content.innerHTML = renderHistory();
        break;
      case 'history-detail':
        content.innerHTML = renderHistoryDetail(state.viewingHistoryId);
        break;
      default:
        content.innerHTML = renderWelcome();
    }

    if (state.currentScreen === 'platforms' || state.currentScreen === 'guide') {
      checklistContainer.innerHTML = App.renderChecklistFab(state) + App.renderChecklist(state);
    } else {
      checklistContainer.innerHTML = '';
    }

    // Animação + foco automático
    var firstChild = content.querySelector(':first-child');
    if (firstChild) {
      firstChild.classList.add('screen-enter');
      firstChild.setAttribute('tabindex', '-1');
      firstChild.focus({ preventScroll: true });
    }

    bindFormEvents();

    // Timer: ativo durante form, platforms e guide
    if (state.currentScreen === 'form' || state.currentScreen === 'platforms' || state.currentScreen === 'guide') {
      startTimer();
    } else {
      stopTimer();
    }
  }

  // ============================================================
  // === Registro de handlers (delegados pelo listener global) ===
  // ============================================================

  bindAction('start', function() {
    state.startedAt = new Date().toISOString();
    navigateTo('form');
  });

  bindAction('continue', function() {
    var saved = App.storage.load();
    if (saved) {
      state = mergeDeep(JSON.parse(JSON.stringify(defaultState)), saved);
      render();
    }
  });

  bindAction('back-platforms', function() {
    navigateTo('platforms');
  });

  bindAction('use-email-suggestion', function() {
    var nameInput = document.querySelector('[name="nomeCompleto"]');
    var emailInput = document.querySelector('[name="emailDesejado"]');
    if (nameInput && emailInput) {
      var suggestion = App.generateEmailFromName(nameInput.value);
      if (suggestion) {
        emailInput.value = suggestion;
        emailInput.focus();
      }
    }
  });

  // Gerar dados de teste no formulário
  bindAction('auto-fill-form', function() {
    var nomes = ['Lucas Oliveira', 'Maria Santos', 'Pedro Costa', 'Ana Ferreira', 'João Souza', 'Carla Lima', 'Rafael Almeida', 'Juliana Rocha'];
    var cargos = ['Analista de Marketing', 'Desenvolvedor Web', 'Designer Gráfico', 'Gerente de Vendas', 'Assistente Administrativo', 'Analista de RH'];
    var deptos = ['marketing', 'vendas', 'ti', 'rh', 'financeiro', 'operacoes', 'administrativo'];

    var nome = nomes[Math.floor(Math.random() * nomes.length)];
    var cargo = cargos[Math.floor(Math.random() * cargos.length)];
    var depto = deptos[Math.floor(Math.random() * deptos.length)];
    var ddd = ['11','21','31','41','51','61','71','85'][Math.floor(Math.random() * 8)];
    var tel = '(' + ddd + ') 9' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);

    var year = 1985 + Math.floor(Math.random() * 20);
    var month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    var day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    var dataNasc = year + '-' + month + '-' + day;

    var hoje = new Date();
    var dataAdm = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');

    var emailSuggestion = App.generateEmailFromName(nome);

    var fields = {
      nomeCompleto: nome,
      emailDesejado: emailSuggestion,
      telefone: tel,
      dataNascimento: dataNasc,
      cargo: cargo,
      departamento: depto,
      dataAdmissao: dataAdm
    };

    for (var key in fields) {
      var input = document.querySelector('[name="' + key + '"]');
      if (input) input.value = fields[key];
    }
  });

  // Abrir todos os cadastros pendentes
  bindAction('open-all-registers', function() {
    var pending = Object.keys(state.platforms).filter(function(id) {
      return !state.platforms[id].completed && App.platforms[id];
    });
    pending.forEach(function(id, index) {
      setTimeout(function() {
        var link = document.createElement('a');
        link.href = App.platforms[id].registerUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }, index * 300);
    });
  });

  // Toggle batch fill
  bindAction('toggle-batch-fill', function() {
    var panel = document.getElementById('batch-fill-panel');
    if (panel) {
      var isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? '' : 'none';
    }
  });

  // Guia passo a passo
  bindAction('guide-next', function() {
    var platform = App.platforms[state.currentGuide];
    if (!platform) return;
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
    if (!platform) return;
    var link = document.createElement('a');
    link.href = platform.registerUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  });

  // Gerador de senha
  bindAction('toggle-password-tool', function() {
    var body = document.getElementById('password-tool-body');
    if (body) {
      var isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
    }
  });

  bindAction('generate-password', function() {
    var field = document.getElementById('generated-password');
    if (field) field.value = App.generatePassword(14);
  });

  bindAction('copy-password', function(e, el) {
    var field = document.getElementById('generated-password');
    if (field && field.value) App.copyToClipboard(field.value, el);
  });

  // Auto-preencher campo de conta com sugestão
  bindAction('use-account-suggestion', function(e, el) {
    var input = document.querySelector('[name="accountInfo"]');
    if (el && input) {
      input.value = el.getAttribute('data-suggestion');
      input.focus();
    }
  });

  // Resumo
  bindAction('view-summary', function() {
    state.completedAt = new Date().toISOString();
    App.storage.save(state);
    App.storage.saveHistory({
      employee: JSON.parse(JSON.stringify(state.employee)),
      platforms: JSON.parse(JSON.stringify(state.platforms)),
      startedAt: state.startedAt,
      completedAt: state.completedAt
    });
    navigateTo('summary');
  });

  // Copiar genérico (data-copy-text)
  bindAction('copy', function(e, el) {
    e.stopPropagation();
    var text = el.getAttribute('data-copy-text');
    if (text) App.copyToClipboard(text, el);
  });

  // Copiar resumo completo
  bindAction('copy-summary', function(e, el) {
    var text = App.generateSummaryText(state);
    App.copyToClipboard(text, el);
  });

  // Exportar TXT
  bindAction('export-txt', function() {
    var text = App.generateSummaryText(state);
    var fileName = 'onboarding-' + (state.employee.nomeCompleto || 'relatorio').replace(/\s+/g, '-').toLowerCase() + '.txt';
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
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

  // Histórico
  bindAction('view-history', function() {
    navigateTo('history');
  });

  bindAction('back-welcome', function() {
    navigateTo('welcome');
  });

  bindAction('back-history', function() {
    navigateTo('history');
  });

  bindAction('view-history-item', function(e, el) {
    state.viewingHistoryId = el.getAttribute('data-history-id');
    navigateTo('history-detail');
  });

  // ============================================================
  // === Bind de eventos de formulário (precisam re-bindar     ===
  // === após cada render pois os elementos são recriados)     ===
  // ============================================================
  function bindFormEvents() {
    // === Formulário do funcionário ===
    var form = document.getElementById('employee-form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var formData = new FormData(form);
        var data = {};
        formData.forEach(function(value, key) { data[key] = value; });

        var errors = validateForm(data);
        var oldError = form.querySelector('.form-error');
        if (oldError) oldError.remove();

        if (errors.length > 0) {
          var errorHtml = '<div class="form-error mt-4 rounded-lg border border-red-200 bg-red-50 p-4">' +
            '<p class="text-sm font-semibold text-red-700 mb-1">Corrija os seguintes erros:</p>' +
            '<ul class="list-disc pl-5 text-sm text-red-600">' +
            errors.map(function(err) { return '<li>' + err + '</li>'; }).join('') +
            '</ul></div>';
          form.querySelector('button[type="submit"]').insertAdjacentHTML('beforebegin', errorHtml);
          return;
        }

        for (var key in data) {
          if (data.hasOwnProperty(key)) state.employee[key] = data[key];
        }
        if (!state.suggestedPassword) {
          state.suggestedPassword = App.generatePassword(14);
        }
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

      // Auto-sugestão de email a partir do nome
      var nameInput = form.querySelector('[name="nomeCompleto"]');
      if (nameInput) {
        nameInput.addEventListener('input', function() {
          var suggestion = App.generateEmailFromName(nameInput.value);
          var suggestionContainer = document.getElementById('email-suggestion');
          var suggestionText = document.getElementById('email-suggestion-text');
          if (suggestionContainer && suggestionText) {
            if (suggestion) {
              suggestionText.textContent = 'Usar: ' + suggestion;
              suggestionContainer.style.display = '';
            } else {
              suggestionContainer.style.display = 'none';
            }
          }
        });
      }
    }

    // === Batch fill form submit ===
    var batchForm = document.getElementById('batch-fill-form');
    if (batchForm) {
      batchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var platformIds = Object.keys(state.platforms);
        var anyFilled = false;
        platformIds.forEach(function(id) {
          if (!state.platforms[id].completed) {
            var input = batchForm.querySelector('[name="batch-' + id + '"]');
            if (input && input.value.trim()) {
              state.platforms[id] = { completed: true, accountInfo: input.value.trim() };
              anyFilled = true;
            }
          }
        });
        if (anyFilled) {
          App.storage.save(state);
          render();
        }
      });
    }

    // === Marcar plataforma como concluída ===
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
  }

  // Iniciar a aplicação
  render();
})();
