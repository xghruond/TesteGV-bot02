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
    wizardMode: false,
    wizardPlatformIndex: 0,
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

  // === Profundidade da floresta (parallax entre telas) ===
  var forestDepth = {
    welcome:          { scale: 1.0,  y: '0px',   brightness: 1.0,  saturate: 1.1,  overlay: 1.0,  vignette: 0   },
    form:             { scale: 1.06, y: '-8px',   brightness: 0.92, saturate: 1.05, overlay: 1.05, vignette: 0.2 },
    platforms:        { scale: 1.12, y: '-16px',  brightness: 0.85, saturate: 1.0,  overlay: 1.10, vignette: 0.35 },
    wizard:           { scale: 1.12, y: '-16px',  brightness: 0.85, saturate: 1.0,  overlay: 1.10, vignette: 0.35 },
    guide:            { scale: 1.18, y: '-24px',  brightness: 0.78, saturate: 0.95, overlay: 1.15, vignette: 0.5 },
    summary:          { scale: 1.24, y: '-32px',  brightness: 0.72, saturate: 0.9,  overlay: 1.18, vignette: 0.6 },
    history:          { scale: 1.10, y: '-12px',  brightness: 0.88, saturate: 1.0,  overlay: 1.08, vignette: 0.25 },
    'history-detail': { scale: 1.15, y: '-20px',  brightness: 0.82, saturate: 0.95, overlay: 1.12, vignette: 0.4 }
  };

  function updateForestDepth(screen) {
    var depth = forestDepth[screen] || forestDepth.welcome;
    var forest = document.getElementById('bg-forest');
    var overlay = document.querySelector('.bg-overlay');
    if (forest) {
      forest.style.setProperty('--forest-scale', depth.scale);
      forest.style.setProperty('--forest-y', depth.y);
      forest.style.setProperty('--forest-brightness', depth.brightness);
      forest.style.setProperty('--forest-saturate', depth.saturate);
    }
    if (overlay) {
      overlay.style.setProperty('--overlay-opacity', depth.overlay);
      overlay.style.setProperty('--vignette-intensity', depth.vignette);
    }
  }

  // Navegação com transição animada
  var isTransitioning = false;

  function navigateTo(screen, options) {
    options = options || {};
    if (options.guide) {
      if (!App.platforms[options.guide]) return;
      state.currentGuide = options.guide;
    }
    if (options.step !== undefined) state.currentStep = options.step;

    var content = document.getElementById('app-content');

    // Se já está em transição ou é a mesma tela, renderizar direto
    if (isTransitioning || state.currentScreen === screen) {
      state.currentScreen = screen;
      App.storage.save(state);
      updateForestDepth(screen);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Premium transition — staggered cinematic timing
    isTransitioning = true;
    var headerEl = document.getElementById('app-header');

    // Phase 1: header dims + background starts moving (0ms)
    if (headerEl) headerEl.classList.add('header-transitioning');
    updateForestDepth(screen);

    // Phase 2: content fades out (50ms after bg starts — feels layered)
    setTimeout(function() {
      content.classList.add('screen-exit');
    }, 50);

    // Phase 3: swap content after exit completes (50 + 280 = 330ms)
    setTimeout(function() {
      content.classList.remove('screen-exit');
      if (headerEl) headerEl.classList.remove('header-transitioning');
      state.currentScreen = screen;
      App.storage.save(state);
      render();
      window.scrollTo({ top: 0 });
      isTransitioning = false;
    }, 330);
  }

  function resetApp() {
    App.storage.clear();
    state = JSON.parse(JSON.stringify(defaultState));
    hasSavedState = false;
    updateForestDepth('welcome');
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
      ? '<button data-action="view-history" class="mt-4 w-full rounded-xl border border-dark-700/50 bg-dark-800/40 px-8 py-3.5 text-base font-medium text-dark-300 backdrop-blur-sm transition-all hover:bg-dark-800/60 hover:border-brand-500/30 hover:text-white">' +
          App.icons.clipboard + ' Hist\u00f3rico (' + historyCount + ')</button>'
      : '';

    return '' +
      '<div class="flex min-h-[90vh] items-center justify-center px-4">' +
        '<div class="w-full max-w-xl text-center">' +

          // Logo com glow + anéis pulsantes
          '<div class="mb-10">' +
            '<div class="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">' +
              '<div class="pulse-ring"></div>' +
              '<div class="pulse-ring"></div>' +
              '<div class="pulse-ring"></div>' +
              '<div class="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 text-white shadow-2xl logo-glow logo-float">' +
                App.icons.robot +
              '</div>' +
            '</div>' +
            '<h1 class="mb-3 text-5xl font-extrabold tracking-tight neon-text">' +
              '<span class="text-gradient">Green BOT</span>' +
            '</h1>' +
            '<p id="typewriter-text" class="text-lg text-dark-400 h-7"></p>' +
          '</div>' +

          // Cards de plataformas - grid 4 colunas com stagger
          '<div class="mb-8">' +
            '<div class="futuristic-separator mb-5"><span class="dot"></span></div>' +
            '<div class="grid grid-cols-4 gap-3">' +
              renderWelcomeItem('bg-red-500/10 text-red-400', App.platforms.gmail.icon, 'Gmail', 0) +
              renderWelcomeItem('bg-pink-500/10 text-pink-400', App.platforms.instagram.icon, 'Instagram', 1) +
              renderWelcomeItem('bg-blue-500/10 text-blue-400', App.platforms.facebook.icon, 'Facebook', 2) +
              renderWelcomeItem('bg-gray-500/10 text-gray-300', App.platforms.tiktok.icon, 'TikTok', 3) +
            '</div>' +
            '<div class="futuristic-separator mt-5"><span class="dot"></span></div>' +
          '</div>' +

          // Botão Iniciar futurista
          '<button data-action="start" class="btn-futuristic w-full rounded-xl px-8 py-4 text-lg font-bold text-white active:scale-[0.98] flex items-center justify-center gap-2">' +
            App.icons.arrowRight + ' Iniciar' +
          '</button>' +
          (hasSavedState
            ? '<button data-action="continue" class="mt-3 w-full rounded-xl border border-brand-500/30 bg-brand-500/10 px-8 py-3.5 text-base font-semibold text-brand-400 backdrop-blur-sm transition-all hover:bg-brand-500/20 hover:border-brand-500/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]">Continuar de onde parei</button>'
            : '') +
          historyButton +

          // Versão com separador
          '<div class="futuristic-separator mt-8"><span class="dot"></span></div>' +
          '<p class="mt-3 text-xs text-dark-600 tracking-widest uppercase">Green BOT v1.0</p>' +
        '</div>' +
      '</div>';
  }

  function renderWelcomeItem(classes, icon, title, index) {
    var delay = (0.3 + index * 0.12).toFixed(2);
    return '' +
      '<div class="futuristic-card stagger-in welcome-card flex flex-col items-center gap-2 rounded-xl p-4 cursor-default text-center" style="animation-delay:' + delay + 's">' +
        '<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ' + classes + ' [&>svg]:w-6 [&>svg]:h-6">' +
          icon +
        '</div>' +
        '<p class="font-semibold text-dark-100 text-sm">' + title + '</p>' +
      '</div>';
  }

  // Efeito typewriter
  function startTypewriter() {
    var el = document.getElementById('typewriter-text');
    if (!el) return;
    var text = 'Cria\u00e7\u00e3o autom\u00e1tica de contas profissionais';
    var i = 0;
    el.innerHTML = '<span class="typewriter-cursor"></span>';
    var interval = setInterval(function() {
      if (i < text.length) {
        el.innerHTML = text.substring(0, i + 1) + '<span class="typewriter-cursor"></span>';
        i++;
      } else {
        clearInterval(interval);
      }
    }, 45);
  }

  // Ripple effect no botão
  function createRipple(e, el) {
    var rect = el.getBoundingClientRect();
    var ripple = document.createElement('span');
    var size = Math.max(rect.width, rect.height);
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    el.appendChild(ripple);
    setTimeout(function() { ripple.remove(); }, 600);
  }

  // === Tela de histórico ===
  function renderHistory() {
    var history = App.storage.loadHistory();
    if (history.length === 0) {
      return '' +
        '<div class="flex min-h-[60vh] items-center justify-center">' +
          '<div class="text-center">' +
            '<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800 border border-dark-700 text-dark-500">' + App.icons.clipboard + '</div>' +
            '<p class="text-lg text-dark-400 mb-4">Nenhum processo realizado ainda.</p>' +
            '<button data-action="back-welcome" class="rounded-xl border border-dark-700 px-6 py-3 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">Voltar</button>' +
          '</div>' +
        '</div>';
    }

    var rows = history.slice().reverse().map(function(record, idx) {
      var completedCount = Object.values(record.platforms).filter(function(p) { return p.completed; }).length;
      var total = Object.keys(record.platforms).length;
      var allDone = completedCount === total;
      var statusBadge = allDone
        ? '<span class="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">' + App.icons.check + ' Completo</span>'
        : '<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">' + completedCount + '/' + total + '</span>';

      // Ícones das plataformas criadas
      var platformIcons = '';
      var platformIds = Object.keys(record.platforms);
      for (var p = 0; p < platformIds.length; p++) {
        var pid = platformIds[p];
        if (record.platforms[pid].completed && App.platforms[pid]) {
          platformIcons += '<div class="flex h-6 w-6 items-center justify-center rounded-md bg-dark-700/50 [&>svg]:w-3.5 [&>svg]:h-3.5 text-dark-300">' + App.platforms[pid].icon + '</div>';
        }
      }

      return '' +
        '<div class="group flex items-center gap-4 rounded-xl border border-dark-700/60 bg-dark-800/80 p-4 backdrop-blur-sm hover:border-brand-500/40 hover:bg-dark-800 transition-all cursor-pointer" data-action="view-history-item" data-history-id="' + record.id + '">' +
          '<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">' + App.icons.user + '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<p class="font-semibold text-dark-100 truncate group-hover:text-white transition-colors">' + App.escapeHtml(record.employee.nomeCompleto) + '</p>' +
            '<div class="flex items-center gap-2 mt-1">' +
              '<span class="text-xs text-dark-500">' + App.escapeHtml(record.employee.emailDesejado) + '@gmail.com</span>' +
              '<div class="flex items-center gap-1">' + platformIcons + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="text-right shrink-0 flex flex-col items-end gap-1.5">' +
            statusBadge +
            '<p class="text-xs text-dark-600">' + App.formatDateTimeBR(record.completedAt) + '</p>' +
          '</div>' +
          '<div class="text-dark-600 group-hover:text-dark-400 transition-colors">' + App.icons.chevronRight + '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div class="mx-auto max-w-3xl">' +
        '<div class="mb-8 flex items-center justify-between">' +
          '<div class="flex items-center gap-3">' +
            '<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">' + App.icons.clipboard + '</div>' +
            '<div>' +
              '<h2 class="text-2xl font-bold text-dark-50">Histórico</h2>' +
              '<p class="text-sm text-dark-500">' + history.length + ' processo' + (history.length !== 1 ? 's' : '') + ' realizado' + (history.length !== 1 ? 's' : '') + '</p>' +
            '</div>' +
          '</div>' +
          '<button data-action="back-welcome" class="rounded-xl border border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' +
            App.icons.chevronLeft + ' Voltar</button>' +
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
    if (!record) return '<p class="text-dark-400">Registro não encontrado.</p>';

    var pseudoState = {
      employee: record.employee,
      platforms: record.platforms,
      startedAt: record.startedAt,
      completedAt: record.completedAt
    };

    return '' +
      '<div class="mx-auto max-w-3xl">' +
        '<button data-action="back-history" class="mb-6 flex items-center gap-1.5 text-sm font-medium text-dark-400 hover:text-brand-400 transition-colors">' +
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

    // Full-width: cada componente controla seu próprio max-width

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
      case 'wizard':
        content.innerHTML = App.renderWizard(state);
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

    if (state.currentScreen === 'platforms' || state.currentScreen === 'guide' || state.currentScreen === 'wizard') {
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

    // Profundidade da floresta
    updateForestDepth(state.currentScreen);

    // Partículas e typewriter na welcome
    if (state.currentScreen === 'welcome') {
      App.particles.init();
      setTimeout(startTypewriter, 600);
    } else {
      App.particles.destroy();
    }

    // Auto-copy ao entrar no wizard
    if (state.currentScreen === 'wizard') {
      var wizCurrent = App.getNextPendingPlatform(state, state.wizardPlatformIndex);
      if (!wizCurrent) wizCurrent = App.getNextPendingPlatform(state, 0);
      if (wizCurrent) {
        setTimeout(function() {
          var autoCopy = App.getWizardAutoCopyData(wizCurrent.id, state);
          var indicator = document.getElementById('wizard-autocopy-indicator');
          App.copyToClipboard(autoCopy.value, indicator);
        }, 500);
      }
    }

    // Timer: ativo durante form, platforms, guide e wizard
    if (state.currentScreen === 'form' || state.currentScreen === 'platforms' || state.currentScreen === 'guide' || state.currentScreen === 'wizard') {
      startTimer();
    } else {
      stopTimer();
    }
  }

  // ============================================================
  // === Registro de handlers (delegados pelo listener global) ===
  // ============================================================

  bindAction('start', function(e, el) {
    createRipple(e, el);
    state.startedAt = new Date().toISOString();
    navigateTo('form');
  });

  bindAction('continue', function() {
    var saved = App.storage.load();
    if (saved) {
      state = mergeDeep(JSON.parse(JSON.stringify(defaultState)), saved);
      // Determinar a melhor tela para retomar
      var screen = state.currentScreen;
      if (screen === 'welcome' || !screen) {
        // Se já tem dados do form, ir para o wizard ou form
        if (state.employee.nomeCompleto && state.employee.emailDesejado) {
          var pending = App.getNextPendingPlatform(state, 0);
          if (pending) {
            state.wizardMode = true;
            state.wizardPlatformIndex = pending.index;
            screen = 'wizard';
          } else {
            screen = 'summary';
          }
        } else {
          screen = 'form';
        }
      }
      navigateTo(screen);
    }
  });

  bindAction('back-platforms', function() {
    if (state.wizardMode) {
      navigateTo('wizard');
    } else {
      navigateTo('platforms');
    }
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

  bindAction('regenerate-email', function() {
    // Regenera os chips com novos números aleatórios
    var nameInput = document.querySelector('[name="nomeCompleto"]');
    var chipsContainer = document.getElementById('email-variations-chips');
    if (!nameInput || !chipsContainer || !nameInput.value.trim()) return;
    var variations = App.generateEmailVariations(nameInput.value);
    var emailInput = document.querySelector('[name="emailDesejado"]');
    var currentEmail = emailInput ? emailInput.value : '';
    chipsContainer.innerHTML = variations.map(function(v) {
      var isActive = v === currentEmail;
      return '<button type="button" data-action="select-email-variation" data-email="' + App.escapeHtml(v) + '" class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ' +
        (isActive
          ? 'bg-brand-500 text-white'
          : 'bg-dark-800 border border-dark-600 text-dark-300 hover:border-brand-500/50 hover:text-brand-400') +
        '">' + App.escapeHtml(v) + '</button>';
    }).join('');
  });

  bindAction('select-email-variation', function(e, el) {
    var email = el.getAttribute('data-email');
    var emailInput = document.querySelector('[name="emailDesejado"]');
    if (email && emailInput) {
      emailInput.value = email;
      // Atualizar destaque dos chips
      var container = el.closest('#email-variations-chips') || document.getElementById('email-variations-chips');
      if (container) {
        var buttons = container.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          if (btn.getAttribute('data-email') === email) {
            btn.className = 'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors bg-brand-500 text-white';
          } else {
            btn.className = 'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors bg-dark-800 border border-dark-600 text-dark-300 hover:border-brand-500/50 hover:text-brand-400';
          }
        }
      }
    }
  });

  bindAction('back-to-welcome', function() {
    navigateTo('welcome');
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
    // Disparar geração de chips de email
    var nameEl = document.querySelector('[name="nomeCompleto"]');
    if (nameEl) nameEl.dispatchEvent(new Event('input'));
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
  // === Wizard action handlers                                ===
  // ============================================================

  bindAction('wizard-open-register', function() {
    // Link <a> handles the navigation, nothing extra needed
  });

  bindAction('wizard-confirm', function() {
    var current = App.getNextPendingPlatform(state, state.wizardPlatformIndex);
    if (!current) current = App.getNextPendingPlatform(state, 0);
    if (!current) return;

    var input = document.getElementById('wizard-account-input');
    var accountInfo = input ? input.value.trim() : '';
    if (!accountInfo) {
      accountInfo = App.suggestAccountInfo(current.id, state.employee.emailDesejado);
    }
    if (!accountInfo) return;

    state.platforms[current.id] = { completed: true, accountInfo: accountInfo };
    App.storage.save(state);

    var next = App.getNextPendingPlatform(state, 0);
    if (next) {
      state.wizardPlatformIndex = next.index;
      App.storage.save(state);
      render();

      // Auto-copy next platform data
      setTimeout(function() {
        var autoCopy = App.getWizardAutoCopyData(next.id, state);
        var indicator = document.getElementById('wizard-autocopy-indicator');
        App.copyToClipboard(autoCopy.value, indicator);
      }, 300);

      // Auto-open next platform registration
      setTimeout(function() {
        var platform = App.platforms[next.id];
        var link = document.createElement('a');
        link.href = platform.registerUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }, 800);
    } else {
      state.completedAt = new Date().toISOString();
      state.wizardMode = false;
      App.storage.save(state);
      App.storage.saveHistory({
        employee: JSON.parse(JSON.stringify(state.employee)),
        platforms: JSON.parse(JSON.stringify(state.platforms)),
        startedAt: state.startedAt,
        completedAt: state.completedAt
      });
      navigateTo('summary');
    }
  });

  bindAction('wizard-copy-credential', function(e, el) {
    e.stopPropagation();
    var text = el.getAttribute('data-copy-text');
    if (text) App.copyToClipboard(text, el);
  });

  bindAction('wizard-skip-platform', function() {
    var order = App.getWizardPlatformOrder();
    var nextIndex = state.wizardPlatformIndex + 1;
    var next = App.getNextPendingPlatform(state, nextIndex);
    if (!next) next = App.getNextPendingPlatform(state, 0);
    if (next && next.index !== state.wizardPlatformIndex) {
      state.wizardPlatformIndex = next.index;
      App.storage.save(state);
      render();
    }
  });

  bindAction('wizard-view-guide', function() {
    var current = App.getNextPendingPlatform(state, state.wizardPlatformIndex);
    if (!current) current = App.getNextPendingPlatform(state, 0);
    if (current) {
      navigateTo('guide', { guide: current.id, step: 0 });
    }
  });

  bindAction('wizard-back-platforms', function() {
    state.wizardMode = false;
    navigateTo('platforms');
  });

  bindAction('wizard-update-username', function() {
    var input = document.getElementById('wizard-username-input');
    if (input && input.value.trim()) {
      state.employee.emailDesejado = input.value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      App.storage.save(state);
      render();
    }
  });

  bindAction('wizard-pick-variation', function(e, el) {
    var variation = el.getAttribute('data-variation');
    if (variation) {
      state.employee.emailDesejado = variation;
      App.storage.save(state);
      render();
    }
  });

  bindAction('resume-wizard', function() {
    var next = App.getNextPendingPlatform(state, 0);
    if (next) {
      state.wizardMode = true;
      state.wizardPlatformIndex = next.index;
      navigateTo('wizard');
    }
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
        state.wizardMode = true;
        state.wizardPlatformIndex = 0;
        App.storage.save(state);
        navigateTo('wizard');
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

      // Auto-gerar chips de variações ao digitar o nome
      var nameInput = form.querySelector('[name="nomeCompleto"]');
      if (nameInput) {
        var updateEmailChips = function() {
          var chipsContainer = document.getElementById('email-variations-chips');
          if (!chipsContainer) return;
          var name = nameInput.value;
          if (!name || name.trim().length < 3) { chipsContainer.innerHTML = ''; return; }
          var variations = App.generateEmailVariations(name);
          var emailInput = form.querySelector('[name="emailDesejado"]');
          var currentEmail = emailInput ? emailInput.value : '';
          chipsContainer.innerHTML = variations.map(function(v) {
            var isActive = v === currentEmail;
            return '<button type="button" data-action="select-email-variation" data-email="' + App.escapeHtml(v) + '" class="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ' +
              (isActive
                ? 'bg-brand-500 text-white'
                : 'bg-dark-800 border border-dark-600 text-dark-300 hover:border-brand-500/50 hover:text-brand-400') +
              '">' + App.escapeHtml(v) + '</button>';
          }).join('');
        };
        nameInput.addEventListener('input', updateEmailChips);
        // Preencher chips iniciais se o nome já existe
        updateEmailChips();
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
          if (state.wizardMode) {
            var next = App.getNextPendingPlatform(state, 0);
            if (next) {
              state.wizardPlatformIndex = next.index;
              navigateTo('wizard');
            } else {
              state.completedAt = new Date().toISOString();
              state.wizardMode = false;
              App.storage.save(state);
              App.storage.saveHistory({
                employee: JSON.parse(JSON.stringify(state.employee)),
                platforms: JSON.parse(JSON.stringify(state.platforms)),
                startedAt: state.startedAt,
                completedAt: state.completedAt
              });
              navigateTo('summary');
            }
          } else {
            navigateTo('platforms');
          }
        }
      });
    }

    // === Wizard: Enter no campo username dispara Atualizar ===
    var wizUsernameInput = document.getElementById('wizard-username-input');
    if (wizUsernameInput) {
      wizUsernameInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var btn = document.querySelector('[data-action="wizard-update-username"]');
          if (btn) btn.click();
        }
      });
    }
  }

  // Iniciar a aplicação
  render();
})();
