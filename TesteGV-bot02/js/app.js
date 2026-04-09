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
      dataNascimento: '',
      cargo: '',
      departamento: '',
      dataAdmissao: ''
    },
    platforms: {
      protonmail: { completed: false, accountInfo: '' },
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

  // Validação visual por campo (blur)
  function validateFieldVisual(fieldId, value) {
    switch (fieldId) {
      case 'nomeCompleto': return value && value.trim().length >= 3;
      case 'emailDesejado': return value && /^[a-zA-Z0-9._-]+$/.test(value) && !/\.{2,}/.test(value) && !/^[.\-]|[.\-]$/.test(value);
      case 'dataNascimento': if(!value) return false; var d=new Date(value+'T00:00:00'); var t=new Date(); t.setHours(0,0,0,0); var a=t.getFullYear()-d.getFullYear(); return d<t && a>=13 && a<=120;
      case 'cargo': return value && value.trim().length >= 2;
      case 'departamento': return !!value;
      case 'dataAdmissao': return !!value;
      default: return !!value;
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
    } else if (/\.{2,}/.test(data.emailDesejado) || /^[.\-]|[.\-]$/.test(data.emailDesejado)) {
      errors.push('E-mail não pode começar/terminar com ponto ou hífen, nem ter pontos consecutivos.');
    }
    if (!data.dataNascimento) {
      errors.push('Data de nascimento é obrigatória.');
    } else {
      var nascDate = new Date(data.dataNascimento + 'T00:00:00');
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      if (nascDate >= today) {
        errors.push('Data de nascimento não pode ser no futuro.');
      } else {
        var age = today.getFullYear() - nascDate.getFullYear();
        var m = today.getMonth() - nascDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < nascDate.getDate())) age--;
        if (age < 13) {
          errors.push('Idade mínima para criar contas é 13 anos.');
        } else if (age > 120) {
          errors.push('Data de nascimento inválida.');
        }
      }
    }
    if (!data.cargo || data.cargo.trim().length < 2) {
      errors.push('Cargo é obrigatório.');
    }
    if (!data.departamento) {
      errors.push('Selecione um departamento.');
    }
    if (!data.dataAdmissao) {
      errors.push('Data de admissão é obrigatória.');
    } else {
      var admDate = new Date(data.dataAdmissao + 'T00:00:00');
      var todayAdm = new Date();
      todayAdm.setHours(0, 0, 0, 0);
      var oneYearFromNow = new Date(todayAdm);
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      if (admDate > oneYearFromNow) {
        errors.push('Data de admissão não pode ser mais de 1 ano no futuro.');
      }
    }
    return errors;
  }

  // === Profundidade da floresta (parallax entre telas) ===
  var forestDepth = {
    welcome:          { scale: 1.0,  y: '0px',   brightness: 1.0,  saturate: 1.1,  overlay: 1.0,  vignette: 0,    farOp: 0,    farSc: 0.92, midOp: 0,    midX: '60px',  nearOp: 0,    nearX: '40px', nearSc: 0.95 },
    form:             { scale: 1.06, y: '-8px',   brightness: 0.92, saturate: 1.05, overlay: 1.05, vignette: 0.2,  farOp: 0.4,  farSc: 0.96, midOp: 0.1,  midX: '40px',  nearOp: 0,    nearX: '40px', nearSc: 0.95 },
    platforms:        { scale: 1.12, y: '-16px',  brightness: 0.85, saturate: 1.0,  overlay: 1.10, vignette: 0.35, farOp: 0.6,  farSc: 1.0,  midOp: 0.35, midX: '15px',  nearOp: 0.1,  nearX: '25px', nearSc: 0.97 },
    wizard:           { scale: 1.12, y: '-16px',  brightness: 0.85, saturate: 1.0,  overlay: 1.10, vignette: 0.35, farOp: 0.6,  farSc: 1.0,  midOp: 0.35, midX: '15px',  nearOp: 0.1,  nearX: '25px', nearSc: 0.97 },
    guide:            { scale: 1.18, y: '-24px',  brightness: 0.78, saturate: 0.95, overlay: 1.15, vignette: 0.5,  farOp: 0.75, farSc: 1.03, midOp: 0.55, midX: '0px',   nearOp: 0.35, nearX: '10px', nearSc: 0.99 },
    summary:          { scale: 1.24, y: '-32px',  brightness: 0.72, saturate: 0.9,  overlay: 1.18, vignette: 0.6,  farOp: 0.85, farSc: 1.06, midOp: 0.7,  midX: '-15px', nearOp: 0.55, nearX: '0px',  nearSc: 1.0  },
    history:          { scale: 1.10, y: '-12px',  brightness: 0.88, saturate: 1.0,  overlay: 1.08, vignette: 0.25, farOp: 0.35, farSc: 0.97, midOp: 0.15, midX: '30px',  nearOp: 0,    nearX: '40px', nearSc: 0.95 },
    'history-detail': { scale: 1.15, y: '-20px',  brightness: 0.82, saturate: 0.95, overlay: 1.12, vignette: 0.4,  farOp: 0.5,  farSc: 1.0,  midOp: 0.3,  midX: '15px',  nearOp: 0.15, nearX: '20px', nearSc: 0.97 },
  };

  // SVGs de folhagem para as 3 camadas — silhuetas escuras contrastantes
  var foliageSvgs = {
    far: '' +
      // Folhas — canto superior esquerdo
      '<svg class="foliage-svg" style="top:-20px;left:-30px;width:300px;height:280px;transform:rotate(15deg)" viewBox="0 0 200 180" fill="#0a2e1a">' +
        '<path d="M30 160 Q50 80 20 10 Q60 50 90 20 Q70 70 100 50 Q80 90 110 80 Q85 110 105 120 Q75 120 80 150Z" opacity="0.9"/>' +
        '<path d="M60 170 Q70 120 55 60 Q80 85 100 55 Q90 100 115 85 Q100 115 120 110 Q95 130 100 160Z" opacity="0.7"/>' +
      '</svg>' +
      // Folhas — canto superior direito
      '<svg class="foliage-svg" style="top:-20px;right:-30px;width:280px;height:260px;transform:scaleX(-1) rotate(10deg)" viewBox="0 0 200 180" fill="#0a2e1a">' +
        '<path d="M30 160 Q50 80 20 10 Q60 50 90 20 Q70 70 100 50 Q80 90 110 80 Q85 110 105 120 Q75 120 80 150Z" opacity="0.9"/>' +
        '<path d="M60 170 Q70 120 55 60 Q80 85 100 55 Q90 100 115 85 Q100 115 120 110 Q95 130 100 160Z" opacity="0.7"/>' +
      '</svg>' +
      // Folhas cantos inferiores
      '<svg class="foliage-svg" style="bottom:-10px;left:-20px;width:250px;height:200px;transform:rotate(160deg)" viewBox="0 0 200 180" fill="#0a2e1a">' +
        '<path d="M20 170 Q40 100 10 30 Q50 60 80 25 Q65 75 95 55 Q75 95 100 90 Q70 110 80 150Z" opacity="0.85"/>' +
      '</svg>' +
      '<svg class="foliage-svg" style="bottom:-10px;right:-20px;width:240px;height:190px;transform:scaleX(-1) rotate(160deg)" viewBox="0 0 200 180" fill="#0a2e1a">' +
        '<path d="M20 170 Q40 100 10 30 Q50 60 80 25 Q65 75 95 55 Q75 95 100 90 Q70 110 80 150Z" opacity="0.85"/>' +
      '</svg>',

    mid: '' +
      // Samambaia grande — esquerda (tronco + folhas laterais)
      '<svg class="foliage-svg" style="top:8%;left:-40px;width:320px;height:500px" viewBox="0 0 250 400" fill="#0a2e1a">' +
        '<path d="M10 400 Q15 350 12 300 Q20 310 35 290 Q15 280 14 250 Q25 265 45 240 Q18 235 16 200 Q30 220 55 195 Q20 185 18 155 Q35 175 60 150 Q22 140 20 110 Q40 135 65 110 Q25 100 22 70 Q45 95 70 70 Q28 60 25 30 Q50 55 75 35 Q30 20 28 5" stroke="#0a2e1a" stroke-width="4" fill="none"/>' +
        '<path d="M14 250 Q-15 230 -30 200" stroke="#0a2e1a" stroke-width="3" fill="none"/>' +
        '<path d="M16 200 Q-10 185 -25 155" stroke="#0a2e1a" stroke-width="3" fill="none"/>' +
        '<path d="M18 155 Q-5 140 -20 110" stroke="#0a2e1a" stroke-width="2.5" fill="none"/>' +
        '<path d="M35 290 Q20 300 35 310 Q15 310 10 330 Q25 310 35 290Z" opacity="0.9"/>' +
        '<path d="M45 240 Q30 250 42 265 Q22 260 18 280 Q35 258 45 240Z" opacity="0.9"/>' +
        '<path d="M55 195 Q40 205 50 220 Q30 215 25 235 Q42 212 55 195Z" opacity="0.85"/>' +
        '<path d="M60 150 Q45 160 55 175 Q35 170 30 190 Q48 165 60 150Z" opacity="0.8"/>' +
        '<path d="M65 110 Q50 120 60 135 Q40 130 35 150 Q52 125 65 110Z" opacity="0.75"/>' +
      '</svg>' +
      // Samambaia grande — direita (espelhada)
      '<svg class="foliage-svg" style="top:5%;right:-40px;width:320px;height:500px;transform:scaleX(-1)" viewBox="0 0 250 400" fill="#0a2e1a">' +
        '<path d="M10 400 Q15 350 12 300 Q20 310 35 290 Q15 280 14 250 Q25 265 45 240 Q18 235 16 200 Q30 220 55 195 Q20 185 18 155 Q35 175 60 150 Q22 140 20 110 Q40 135 65 110 Q25 100 22 70 Q45 95 70 70 Q28 60 25 30 Q50 55 75 35 Q30 20 28 5" stroke="#0a2e1a" stroke-width="4" fill="none"/>' +
        '<path d="M14 250 Q-15 230 -30 200" stroke="#0a2e1a" stroke-width="3" fill="none"/>' +
        '<path d="M16 200 Q-10 185 -25 155" stroke="#0a2e1a" stroke-width="3" fill="none"/>' +
        '<path d="M35 290 Q20 300 35 310 Q15 310 10 330 Q25 310 35 290Z" opacity="0.9"/>' +
        '<path d="M45 240 Q30 250 42 265 Q22 260 18 280 Q35 258 45 240Z" opacity="0.9"/>' +
        '<path d="M55 195 Q40 205 50 220 Q30 215 25 235 Q42 212 55 195Z" opacity="0.85"/>' +
        '<path d="M60 150 Q45 160 55 175 Q35 170 30 190 Q48 165 60 150Z" opacity="0.8"/>' +
      '</svg>' +
      // Galho com folhas — lateral esquerda baixo
      '<svg class="foliage-svg" style="bottom:5%;left:-25px;width:280px;height:350px" viewBox="0 0 200 300" fill="#0a2e1a">' +
        '<path d="M5 300 Q10 250 8 200 Q12 190 10 160 Q15 145 12 115 Q18 105 15 80 Q20 65 18 45" stroke="#0a2e1a" stroke-width="3.5" fill="none"/>' +
        '<path d="M8 200 Q25 220 40 200 Q25 195 8 200Z" opacity="0.85"/>' +
        '<path d="M10 160 Q30 180 50 155 Q28 155 10 160Z" opacity="0.8"/>' +
        '<path d="M12 115 Q35 140 55 115 Q32 112 12 115Z" opacity="0.75"/>' +
        '<path d="M15 80 Q40 100 60 80 Q36 78 15 80Z" opacity="0.7"/>' +
      '</svg>',

    near: '' +
      // Folha tropical grande — canto inferior esquerdo
      '<svg class="foliage-svg" style="bottom:-30px;left:-60px;width:450px;height:400px" viewBox="0 0 350 300" fill="#0a2e1a">' +
        '<path d="M0 300 Q10 250 5 200 Q30 230 60 195 Q15 185 10 150 Q45 180 80 145 Q25 135 15 100 Q55 135 95 100 Q35 85 25 55 Q65 90 110 60 Q45 45 35 15 Q75 50 120 25 Q55 10 50 0" stroke="#0a2e1a" stroke-width="5" fill="none"/>' +
        '<path d="M5 200 Q30 230 60 195 Q30 200 5 200Z" opacity="0.95"/>' +
        '<path d="M10 150 Q45 180 80 145 Q40 155 10 150Z" opacity="0.9"/>' +
        '<path d="M15 100 Q55 135 95 100 Q50 105 15 100Z" opacity="0.85"/>' +
        '<path d="M25 55 Q65 90 110 60 Q62 60 25 55Z" opacity="0.8"/>' +
        '<path d="M0 300 Q-10 240 -20 200 Q10 215 25 190 Q-15 175 -25 150 Q15 170 35 140" stroke="#0a2e1a" stroke-width="4" fill="none"/>' +
        '<path d="M-20 200 Q10 215 25 190 Q0 195 -20 200Z" opacity="0.9"/>' +
        '<path d="M-25 150 Q15 170 35 140 Q-5 150 -25 150Z" opacity="0.85"/>' +
      '</svg>' +
      // Folha tropical grande — canto inferior direito
      '<svg class="foliage-svg" style="bottom:-30px;right:-60px;width:420px;height:380px;transform:scaleX(-1)" viewBox="0 0 350 300" fill="#0a2e1a">' +
        '<path d="M0 300 Q10 250 5 200 Q30 230 60 195 Q15 185 10 150 Q45 180 80 145 Q25 135 15 100 Q55 135 95 100 Q35 85 25 55 Q65 90 110 60 Q45 45 35 15 Q75 50 120 25" stroke="#0a2e1a" stroke-width="5" fill="none"/>' +
        '<path d="M5 200 Q30 230 60 195 Q30 200 5 200Z" opacity="0.95"/>' +
        '<path d="M10 150 Q45 180 80 145 Q40 155 10 150Z" opacity="0.9"/>' +
        '<path d="M15 100 Q55 135 95 100 Q50 105 15 100Z" opacity="0.85"/>' +
        '<path d="M0 300 Q-10 240 -20 200 Q10 215 25 190 Q-15 175 -25 150 Q15 170 35 140" stroke="#0a2e1a" stroke-width="4" fill="none"/>' +
        '<path d="M-20 200 Q10 215 25 190 Q0 195 -20 200Z" opacity="0.9"/>' +
      '</svg>' +
      // Grama densa — borda inferior inteira
      '<svg class="foliage-svg" style="bottom:-5px;left:10%;width:80%;height:100px" viewBox="0 0 600 80" fill="#0a2e1a">' +
        '<path d="M0 80 Q15 55 10 20 Q20 50 25 80 Q40 45 35 5 Q48 42 52 80 Q70 50 65 10 Q78 45 82 80 Q100 55 95 15 Q108 48 112 80 Q130 50 125 8 Q138 45 142 80 Q160 55 155 18 Q168 48 172 80 Q190 50 185 12 Q198 45 202 80 Q220 55 215 20 Q228 50 232 80 Q250 45 245 8 Q258 42 262 80 Q280 55 275 15 Q288 48 292 80 Q310 50 305 10 Q318 45 322 80 Q340 55 335 18 Q348 48 352 80 Q370 50 365 12 Q378 45 382 80 Q400 55 395 20 Q408 50 412 80 Q430 45 425 8 Q438 42 442 80 Q460 55 455 15 Q468 48 472 80 Q490 50 485 10 Q498 45 502 80 Q520 55 515 18 Q528 48 532 80 Q550 50 545 12 Q558 45 562 80 Q580 55 575 20 Q588 50 592 80 L600 80Z" opacity="0.95"/>' +
      '</svg>' +
      // Galho pendente — canto superior esquerdo
      '<svg class="foliage-svg" style="top:-20px;left:2%;width:350px;height:250px" viewBox="0 0 280 200" fill="#0a2e1a">' +
        '<path d="M0 5 Q30 8 60 15 Q75 20 90 25 Q105 30 120 35 Q135 40 150 50 Q165 55 180 65" stroke="#0a2e1a" stroke-width="4" fill="none"/>' +
        '<path d="M60 15 Q50 30 65 45 Q70 25 60 15Z" opacity="0.85"/>' +
        '<path d="M90 25 Q80 45 95 60 Q98 32 90 25Z" opacity="0.8"/>' +
        '<path d="M120 35 Q110 55 125 75 Q128 45 120 35Z" opacity="0.75"/>' +
        '<path d="M150 50 Q140 70 155 90 Q158 58 150 50Z" opacity="0.7"/>' +
      '</svg>' +
      // Galho pendente — canto superior direito
      '<svg class="foliage-svg" style="top:-20px;right:2%;width:320px;height:230px;transform:scaleX(-1)" viewBox="0 0 280 200" fill="#0a2e1a">' +
        '<path d="M0 5 Q30 8 60 15 Q75 20 90 25 Q105 30 120 35 Q135 40 150 50" stroke="#0a2e1a" stroke-width="3.5" fill="none"/>' +
        '<path d="M60 15 Q50 30 65 45 Q70 25 60 15Z" opacity="0.8"/>' +
        '<path d="M90 25 Q80 45 95 60 Q98 32 90 25Z" opacity="0.75"/>' +
        '<path d="M120 35 Q110 55 125 75 Q128 45 120 35Z" opacity="0.7"/>' +
      '</svg>'
  };

  var foliageRendered = false;

  function initFoliage() {
    if (foliageRendered) return;
    var container = document.getElementById('forest-foliage');
    if (!container) return;
    container.innerHTML =
      '<div class="foliage-layer foliage-far">' + foliageSvgs.far + '</div>' +
      '<div class="foliage-layer foliage-mid">' + foliageSvgs.mid + '</div>' +
      '<div class="foliage-layer foliage-near">' + foliageSvgs.near + '</div>';
    foliageRendered = true;
  }

  function updateForestDepth(screen) {
    var depth = forestDepth[screen] || forestDepth.welcome;
    var forest = document.getElementById('bg-forest');
    var overlay = document.querySelector('.bg-overlay');
    var foliage = document.getElementById('forest-foliage');
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
    if (foliage) {
      foliage.style.setProperty('--foliage-far-opacity', depth.farOp);
      foliage.style.setProperty('--foliage-far-scale', depth.farSc);
      foliage.style.setProperty('--foliage-mid-opacity', depth.midOp);
      foliage.style.setProperty('--foliage-mid-x', depth.midX);
      foliage.style.setProperty('--foliage-near-opacity', depth.nearOp);
      foliage.style.setProperty('--foliage-near-x', depth.nearX);
      foliage.style.setProperty('--foliage-near-scale', depth.nearSc);
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
            '<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">' +
              renderWelcomeItem('bg-purple-500/10 text-purple-400', App.platforms.protonmail.icon, 'ProtonMail', 0, 'protonmail') +
              renderWelcomeItem('bg-pink-500/10 text-pink-400', App.platforms.instagram.icon, 'Instagram', 1, 'instagram') +
              renderWelcomeItem('bg-blue-500/10 text-blue-400', App.platforms.facebook.icon, 'Facebook', 2, 'facebook') +
              renderWelcomeItem('bg-gray-500/10 text-gray-300', App.platforms.tiktok.icon, 'TikTok', 3, 'tiktok') +
            '</div>' +
            '<div class="futuristic-separator mt-5"><span class="dot"></span></div>' +
          '</div>' +

          // Botão Iniciar futurista
          '<button data-action="start" class="btn-futuristic btn-iniciar-pulse w-full rounded-xl px-8 py-4 text-lg font-bold text-white active:scale-[0.98] flex items-center justify-center gap-2">' +
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

  function renderWelcomeItem(classes, icon, title, index, platformId) {
    var delay = (0.3 + index * 0.12).toFixed(2);
    return '' +
      '<div class="futuristic-card stagger-in welcome-card welcome-card-' + platformId + ' flex flex-col items-center gap-2 rounded-xl p-4 cursor-default text-center" style="animation-delay:' + delay + 's">' +
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
  function showCompletionCelebration(platformName) {
    var overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    overlay.innerHTML =
      '<div class="celebration-content">' +
        '<div class="celebration-check">' +
          '<svg class="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' +
        '</div>' +
        '<p class="celebration-text">' + App.escapeHtml(platformName) + ' criada!</p>' +
      '</div>';
    document.body.appendChild(overlay);
    setTimeout(function() {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s ease';
      setTimeout(function() { overlay.remove(); }, 400);
    }, 1200);
  }

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
              '<span class="text-xs text-dark-500">' + App.escapeHtml(record.employee.emailDesejado) + '@proton.me</span>' +
              '<div class="flex items-center gap-1">' + platformIcons + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="text-right shrink-0 flex flex-col items-end gap-1.5">' +
            statusBadge +
            '<p class="text-xs text-dark-600">' + App.formatDateTimeBR(record.completedAt) + '</p>' +
          '</div>' +
          '<div class="flex items-center gap-1">' +
            '<button data-action="delete-history" data-history-id="' + record.id + '" title="Remover do hist\u00f3rico" class="p-1.5 rounded-lg text-dark-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">' +
              App.icons.trash +
            '</button>' +
            '<div class="text-dark-600 group-hover:text-dark-400 transition-colors">' + App.icons.chevronRight + '</div>' +
          '</div>' +
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
      suggestedPassword: record.suggestedPassword || null,
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

    try {
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
    } catch (err) {
      content.innerHTML =
        '<div class="flex min-h-[80vh] items-center justify-center">' +
          '<div class="text-center">' +
            '<p class="text-dark-400 mb-6">Ocorreu um erro ao carregar a tela.</p>' +
            '<button data-action="back-welcome" class="rounded-xl border border-dark-700 px-6 py-3 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' +
              App.icons.chevronLeft + ' Voltar ao início' +
            '</button>' +
          '</div>' +
        '</div>';
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

    // Profundidade da floresta + folhagem
    initFoliage();
    updateForestDepth(state.currentScreen);

    // Partículas e typewriter na welcome
    if (state.currentScreen === 'welcome') {
      App.particles.init();
      setTimeout(startTypewriter, 600);
    } else {
      App.particles.destroy();
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




  // Hash SHA-256 da senha de autorização de compra (nunca armazenar o texto puro)
  var PURCHASE_PASSWORD_HASH = 'b1dfdec95c76124d322254713c29f73995c80022a36d369121b5209bb4764e44';

  function hashSHA256(str) {
    var encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(str)).then(function(buf) {
      return Array.from(new Uint8Array(buf)).map(function(b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    });
  }






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
    resetApp();
    navigateTo('welcome');
  });

  bindAction('back-to-form', function() {
    navigateTo('form');
  });


  bindAction('back-to-platforms', function() {
    navigateTo('platforms');
  });

  // Gerar dados de teste no formulário
  bindAction('auto-fill-form', function() {
    var nomes = ['Lucas Oliveira', 'Maria Santos', 'Pedro Costa', 'Ana Ferreira', 'João Souza', 'Carla Lima', 'Rafael Almeida', 'Juliana Rocha'];
    var cargos = ['Analista de Marketing', 'Desenvolvedor Web', 'Designer Gráfico', 'Gerente de Vendas', 'Assistente Administrativo', 'Analista de RH'];
    var deptos = ['marketing', 'vendas', 'ti', 'rh', 'financeiro', 'operacoes', 'administrativo'];

    var nome = nomes[Math.floor(Math.random() * nomes.length)];
    var cargo = cargos[Math.floor(Math.random() * cargos.length)];
    var depto = deptos[Math.floor(Math.random() * deptos.length)];

    var year = 1985 + Math.floor(Math.random() * 20);
    var month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    var day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
    var dataNasc = year + '-' + month + '-' + day;

    var hoje = new Date();
    var dataAdm = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');

    var emailSuggestion = App.generateEmailFromName(nome);

    var fields = {
      nomeCompleto:  nome,
      emailDesejado: emailSuggestion,
      dataNascimento: dataNasc,
      cargo:         cargo,
      departamento:  depto,
      dataAdmissao:  dataAdm
    };

    for (var key in fields) {
      var input = document.querySelector('[name="' + key + '"]');
      if (input) input.value = fields[key];
    }
    // Disparar geração de chips de email
    var nameEl = document.querySelector('[name="nomeCompleto"]');
    if (nameEl) nameEl.dispatchEvent(new Event('input'));
  });

  // Abrir todos os cadastros pendentes — com confirmação
  bindAction('open-all-registers', function() {
    var pending = Object.keys(state.platforms).filter(function(id) {
      return !state.platforms[id].completed && App.platforms[id];
    });
    if (pending.length === 0) return;
    if (!confirm('Abrir ' + pending.length + ' páginas de cadastro em novas abas?')) return;
    pending.forEach(function(id, index) {
      setTimeout(function() {
        var link = document.createElement('a');
        link.href = App.platforms[id].registerUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.click();
      }, index * 500);
    });
    App.showToast(pending.length + ' páginas abertas', 'info');
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

  // Criar conta ProtonMail automaticamente

  // Criar conta ProtonMail — abre site + mostra dados para copiar
  bindAction('auto-create-protonmail', function() {
    var username = state.employee.emailDesejado;
    var password = state.suggestedPassword || App.generatePassword(14);
    var displayName = state.employee.nomeCompleto || '';

    if (!username) {
      App.showToast('Preencha o e-mail desejado primeiro.', 'error');
      return;
    }

    // Mostrar modal de progresso
    var overlay = document.createElement('div');
    overlay.id = 'automation-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;';

    var stepLabels = [
      'Aguardando...',
      'Abrindo navegador...',
      'Selecionando plano Free...',
      'Preenchendo username: ' + App.escapeHtml(username),
      'Preenchendo senha...',
      'Enviando formulário...',
      'Aguardando verificação...'
    ];

    function buildStepsHTML(currentStep, message) {
      var html = '';
      for (var i = 1; i <= 6; i++) {
        var icon = i < currentStep ? '<span style="color:#4ade80;">&#10003;</span>'
                 : i === currentStep ? '<span class="animate-pulse" style="color:#f59e0b;">&#9679;</span>'
                 : '<span style="color:#475569;">&#9675;</span>';
        var color = i < currentStep ? '#4ade80' : i === currentStep ? '#f1f5f9' : '#475569';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">' +
          icon + ' <span style="color:' + color + ';font-size:13px;">' + stepLabels[i] + '</span></div>';
      }
      if (currentStep === 6 && message && (message.indexOf('CAPTCHA') > -1 || message.indexOf('verificacao') > -1 || message.indexOf('resolva') > -1)) {
        html += '<div style="margin-top:12px;padding:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;">' +
          '<p style="color:#fbbf24;font-size:13px;font-weight:600;text-align:center;">⚠ Resolva o CAPTCHA/verificação no navegador que abriu!</p></div>';
      }
      return html;
    }

    overlay.innerHTML =
      '<div id="auto-modal" style="background:rgba(15,23,42,0.97);border:1px solid rgba(109,74,255,0.3);border-radius:20px;padding:1.75rem;width:100%;max-width:440px;box-shadow:0 24px 60px rgba(0,0,0,0.6);">' +
        '<div style="text-align:center;margin-bottom:16px;">' +
          '<div style="width:56px;height:56px;border-radius:16px;background:rgba(109,74,255,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#a78bfa;font-size:28px;">' + App.icons.sparkles + '</div>' +
          '<h3 style="font-size:18px;font-weight:700;color:#f1f5f9;">Criando conta ProtonMail...</h3>' +
          '<p style="font-size:13px;color:#94a3b8;margin-top:4px;">' + App.escapeHtml(username) + '@proton.me</p>' +
        '</div>' +
        '<div id="auto-steps" style="margin-bottom:16px;">' + buildStepsHTML(0, '') + '</div>' +
        '<div id="auto-actions" style="display:flex;gap:8px;">' +
          '<button id="auto-cancel" style="flex:1;border:1px solid rgba(100,116,139,0.4);border-radius:12px;padding:12px;color:#94a3b8;font-size:14px;font-weight:600;cursor:pointer;background:none;">Cancelar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var polling = null;
    var cancelled = false;
    var pollErrors = 0;

    document.getElementById('auto-cancel').addEventListener('click', function() {
      cancelled = true;
      if (polling) clearInterval(polling);
      overlay.remove();
    });

    // Iniciar automação no servidor
    fetch('/api/create-protonmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password, displayName: displayName })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.started) {
        App.showToast('Erro ao iniciar: ' + (data.error || 'desconhecido'), 'error');
        overlay.remove();
        return;
      }

      // Polling de status
      polling = setInterval(function() {
        if (cancelled) return;
        fetch('/api/status')
          .then(function(r) { return r.json(); })
          .then(function(s) {
            // Atualizar modal
            var stepsEl = document.getElementById('auto-steps');
            if (stepsEl) stepsEl.innerHTML = buildStepsHTML(s.step, s.message);

            if (s.done) {
              clearInterval(polling);
              if (s.success) {
                // Sucesso!
                state.platforms.protonmail = { completed: true, accountInfo: username + '@proton.me' };
                App.storage.save(state);

                var modal = document.getElementById('auto-modal');
                if (modal) {
                  modal.innerHTML =
                    '<div style="text-align:center;padding:20px;">' +
                      '<div style="width:64px;height:64px;border-radius:50%;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#4ade80;font-size:32px;">&#10003;</div>' +
                      '<h3 style="font-size:20px;font-weight:700;color:#4ade80;margin-bottom:8px;">Conta criada!</h3>' +
                      '<p style="font-size:14px;color:#f1f5f9;font-family:monospace;">' + App.escapeHtml(username) + '@proton.me</p>' +
                      '<p style="font-size:12px;color:#94a3b8;margin-top:4px;">Senha: ' + App.escapeHtml(password) + '</p>' +
                      '<button id="auto-close-success" class="btn-futuristic" style="margin-top:20px;width:100%;border-radius:12px;padding:14px;font-size:15px;font-weight:700;color:#fff;border:none;cursor:pointer;">Continuar</button>' +
                    '</div>';
                  document.getElementById('auto-close-success').addEventListener('click', function() {
                    overlay.remove();
                    App.showToast('ProtonMail criado com sucesso!', 'success');
                    render();
                  });
                }
              } else {
                // Erro ou timeout
                var modal = document.getElementById('auto-modal');
                if (modal) {
                  modal.innerHTML =
                    '<div style="text-align:center;padding:20px;">' +
                      '<div style="width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#ef4444;font-size:28px;">!</div>' +
                      '<h3 style="font-size:18px;font-weight:700;color:#ef4444;margin-bottom:8px;">Não foi possível completar</h3>' +
                      '<p style="font-size:13px;color:#94a3b8;">' + App.escapeHtml(s.error || s.message) + '</p>' +
                      '<div style="display:flex;gap:8px;margin-top:20px;">' +
                        '<button id="auto-close-error" style="flex:1;border:1px solid rgba(100,116,139,0.4);border-radius:12px;padding:12px;color:#94a3b8;font-size:14px;font-weight:600;cursor:pointer;background:none;">Fechar</button>' +
                        '<button id="auto-done-manual" class="btn-futuristic" style="flex:2;border-radius:12px;padding:12px;font-size:14px;font-weight:700;color:#fff;border:none;cursor:pointer;">Conta Criada (manual)</button>' +
                      '</div>' +
                    '</div>';
                  document.getElementById('auto-close-error').addEventListener('click', function() { overlay.remove(); });
                  document.getElementById('auto-done-manual').addEventListener('click', function() {
                    state.platforms.protonmail = { completed: true, accountInfo: username + '@proton.me' };
                    App.storage.save(state);
                    overlay.remove();
                    App.showToast('ProtonMail marcado como criado!', 'success');
                    render();
                  });
                }
              }
            }
          })
          .catch(function() {
            pollErrors++;
            if (pollErrors >= 5) {
              clearInterval(polling);
              var stepsEl = document.getElementById('auto-steps');
              if (stepsEl) stepsEl.innerHTML += '<div style="margin-top:8px;color:#ef4444;font-size:12px;">Conexão com servidor perdida. Feche e tente novamente.</div>';
            }
          });
      }, 2000);
    })
    .catch(function(err) {
      // Servidor não está rodando — fallback para modo manual
      overlay.remove();
      App.showToast('Servidor de automação não encontrado. Iniciando modo manual...', 'info');

      // Abrir ProtonMail manualmente
      var link = document.createElement('a');
      link.href = 'https://account.proton.me/signup';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();

      // Modal manual simplificado
      var manualOverlay = document.createElement('div');
      manualOverlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:1rem;';
      manualOverlay.innerHTML =
        '<div style="background:rgba(15,23,42,0.97);border:1px solid rgba(51,65,85,0.4);border-radius:20px;padding:2rem;width:100%;max-width:400px;">' +
          '<h3 style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:4px;text-align:center;">Dados para o ProtonMail</h3>' +
          '<p style="font-size:12px;color:#94a3b8;text-align:center;margin-bottom:16px;">Copie e cole no site que abriu</p>' +
          '<div style="background:rgba(10,18,32,0.85);border:1px solid rgba(51,65,85,0.4);border-radius:10px;padding:12px;margin-bottom:8px;">' +
            '<p style="font-size:11px;color:#64748b;">Username</p><p style="font-size:15px;font-weight:600;color:#f1f5f9;font-family:monospace;">' + App.escapeHtml(username) + '</p></div>' +
          '<div style="background:rgba(10,18,32,0.85);border:1px solid rgba(51,65,85,0.4);border-radius:10px;padding:12px;margin-bottom:8px;">' +
            '<p style="font-size:11px;color:#64748b;">Senha</p><p style="font-size:15px;font-weight:600;color:#4ade80;font-family:monospace;">' + App.escapeHtml(password) + '</p></div>' +
          '<div style="display:flex;gap:8px;margin-top:16px;">' +
            '<button id="manual-cancel" style="flex:1;border:1px solid rgba(100,116,139,0.4);border-radius:12px;padding:12px;color:#94a3b8;font-size:14px;cursor:pointer;background:none;">Cancelar</button>' +
            '<button id="manual-done" class="btn-futuristic" style="flex:2;border-radius:12px;padding:12px;font-size:14px;font-weight:700;color:#fff;border:none;cursor:pointer;">Conta Criada!</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(manualOverlay);
      document.getElementById('manual-cancel').addEventListener('click', function() { manualOverlay.remove(); });
      document.getElementById('manual-done').addEventListener('click', function() {
        state.platforms.protonmail = { completed: true, accountInfo: username + '@proton.me' };
        App.storage.save(state);
        manualOverlay.remove();
        App.showToast('ProtonMail criado com sucesso!', 'success');
        render();
      });
    });
  });

  // Criar conta Instagram automaticamente
  bindAction('auto-create-instagram', function() {
    var email = state.employee.emailDesejado + '@proton.me';
    var password = state.suggestedPassword || App.generatePassword(14);
    var fullName = state.employee.nomeCompleto || '';
    var username = state.employee.emailDesejado || '';
    var birthParts = (state.employee.dataNascimento || '2000-01-01').split('-');
    var birthYear = birthParts[0] || '2000';
    var birthMonth = String(parseInt(birthParts[1] || '1'));
    var birthDay = String(parseInt(birthParts[2] || '1'));

    if (!email || !password) {
      App.showToast('Preencha os dados primeiro.', 'error');
      return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'automation-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;';

    var stepLabels = [
      'Aguardando...',
      'Abrindo navegador...',
      'Abrindo pagina de cadastro...',
      'Preenchendo email...',
      'Preenchendo nome...',
      'Preenchendo username...',
      'Preenchendo senha...',
      'Clicando em Cadastre-se...',
      'Aguardando verificacao...'
    ];

    function buildStepsHTML(currentStep, message) {
      var html = '';
      for (var i = 1; i <= 8; i++) {
        var icon = i < currentStep ? '<span style="color:#4ade80;">&#10003;</span>'
                 : i === currentStep ? '<span class="animate-pulse" style="color:#f59e0b;">&#9679;</span>'
                 : '<span style="color:#475569;">&#9675;</span>';
        var color = i < currentStep ? '#4ade80' : i === currentStep ? '#f1f5f9' : '#475569';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">' +
          icon + ' <span style="color:' + color + ';font-size:13px;">' + stepLabels[i] + '</span></div>';
      }
      if (currentStep === 8 && message) {
        var alertColor = message.indexOf('ProtonMail') > -1 ? '#a78bfa' : message.indexOf('anonymsms') > -1 ? '#fbbf24' : '#60a5fa';
        html += '<div style="margin-top:12px;padding:12px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.3);border-radius:10px;">' +
          '<p style="color:' + alertColor + ';font-size:13px;font-weight:600;text-align:center;">' + App.escapeHtml(message) + '</p></div>';
      }
      return html;
    }

    overlay.innerHTML =
      '<div id="auto-modal" style="background:rgba(15,23,42,0.97);border:1px solid rgba(236,72,153,0.3);border-radius:20px;padding:1.75rem;width:100%;max-width:440px;box-shadow:0 24px 60px rgba(0,0,0,0.6);">' +
        '<div style="text-align:center;margin-bottom:16px;">' +
          '<div style="width:56px;height:56px;border-radius:16px;background:rgba(236,72,153,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#ec4899;font-size:28px;">' + App.platforms.instagram.icon + '</div>' +
          '<h3 style="font-size:18px;font-weight:700;color:#f1f5f9;">Criando conta Instagram...</h3>' +
          '<p style="font-size:13px;color:#94a3b8;margin-top:4px;">@' + App.escapeHtml(username) + '</p>' +
        '</div>' +
        '<div id="auto-steps" style="margin-bottom:16px;">' + buildStepsHTML(0, '') + '</div>' +
        '<div id="auto-actions" style="display:flex;gap:8px;">' +
          '<button id="auto-cancel" style="flex:1;border:1px solid rgba(100,116,139,0.4);border-radius:12px;padding:12px;color:#94a3b8;font-size:14px;font-weight:600;cursor:pointer;background:none;">Cancelar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var polling = null;
    var cancelled = false;
    var pollErrors = 0;

    document.getElementById('auto-cancel').addEventListener('click', function() {
      cancelled = true;
      if (polling) clearInterval(polling);
      overlay.remove();
    });

    fetch('/api/create-instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email, password: password, fullName: fullName,
        username: username, birthDay: birthDay, birthMonth: birthMonth, birthYear: birthYear
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.started) {
        App.showToast('Erro: ' + (data.error || 'desconhecido'), 'error');
        overlay.remove();
        return;
      }

      polling = setInterval(function() {
        if (cancelled) return;
        fetch('/api/status?platform=instagram')
          .then(function(r) { return r.json(); })
          .then(function(s) {
            var stepsEl = document.getElementById('auto-steps');
            if (stepsEl) stepsEl.innerHTML = buildStepsHTML(s.step, s.message);

            if (s.done) {
              clearInterval(polling);
              if (s.success) {
                state.platforms.instagram = { completed: true, accountInfo: '@' + username };
                App.storage.save(state);
                var modal = document.getElementById('auto-modal');
                if (modal) {
                  modal.innerHTML =
                    '<div style="text-align:center;padding:20px;">' +
                      '<div style="width:64px;height:64px;border-radius:50%;background:rgba(236,72,153,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#ec4899;font-size:32px;">&#10003;</div>' +
                      '<h3 style="font-size:20px;font-weight:700;color:#ec4899;margin-bottom:8px;">Conta Instagram criada!</h3>' +
                      '<p style="font-size:14px;color:#f1f5f9;">@' + App.escapeHtml(username) + '</p>' +
                      '<button id="auto-close-success" class="btn-futuristic" style="margin-top:20px;width:100%;border-radius:12px;padding:14px;font-size:15px;font-weight:700;color:#fff;border:none;cursor:pointer;">Continuar</button>' +
                    '</div>';
                  document.getElementById('auto-close-success').addEventListener('click', function() {
                    overlay.remove();
                    App.showToast('Instagram criado!', 'success');
                    render();
                  });
                }
              } else {
                var modal = document.getElementById('auto-modal');
                if (modal) {
                  modal.innerHTML =
                    '<div style="text-align:center;padding:20px;">' +
                      '<div style="width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#ef4444;font-size:28px;">!</div>' +
                      '<h3 style="font-size:18px;font-weight:700;color:#ef4444;margin-bottom:8px;">Não foi possível completar</h3>' +
                      '<p style="font-size:13px;color:#94a3b8;">' + App.escapeHtml(s.error || s.message) + '</p>' +
                      '<div style="display:flex;gap:8px;margin-top:20px;">' +
                        '<button id="auto-close-error" style="flex:1;border:1px solid rgba(100,116,139,0.4);border-radius:12px;padding:12px;color:#94a3b8;font-size:14px;cursor:pointer;background:none;">Fechar</button>' +
                        '<button id="auto-done-manual" class="btn-futuristic" style="flex:2;border-radius:12px;padding:12px;font-size:14px;font-weight:700;color:#fff;border:none;cursor:pointer;">Conta Criada (manual)</button>' +
                      '</div>' +
                    '</div>';
                  document.getElementById('auto-close-error').addEventListener('click', function() { overlay.remove(); });
                  document.getElementById('auto-done-manual').addEventListener('click', function() {
                    state.platforms.instagram = { completed: true, accountInfo: '@' + username };
                    App.storage.save(state);
                    overlay.remove();
                    App.showToast('Instagram marcado como criado!', 'success');
                    render();
                  });
                }
              }
            }
          })
          .catch(function() {
            pollErrors++;
            if (pollErrors >= 5) {
              clearInterval(polling);
              var stepsEl = document.getElementById('auto-steps');
              if (stepsEl) stepsEl.innerHTML += '<div style="margin-top:8px;color:#ef4444;font-size:12px;">Conexão com servidor perdida. Feche e tente novamente.</div>';
            }
          });
      }, 2000);
    })
    .catch(function() {
      overlay.remove();
      App.showToast('Servidor não encontrado. Abrindo modo manual...', 'info');
      window.open('https://www.instagram.com/accounts/emailsignup/', '_blank');
    });
  });

  // Abrir cadastro da plataforma
  bindAction('wizard-open-incognito', function(e, el) {
    var url = el.getAttribute('data-url');
    if (!url) return;

    // Encontrar qual plataforma está ativa
    var platformId = state.currentGuide;
    if (!platformId) {
      var pending = App.getNextPendingPlatform(state, state.wizardPlatformIndex);
      if (!pending) pending = App.getNextPendingPlatform(state, 0);
      if (pending) platformId = pending.id;
    }
    var platform = platformId ? App.platforms[platformId] : null;
    var platformName = platform ? platform.name : '';

    // Copiar dados silenciosamente
    var creds = App.getWizardCredentials(platformId, state);
    var credsText = '';
    if (creds) {
      credsText = creds.map(function(c) { return c.value; }).join('\n');
      try { navigator.clipboard.writeText(credsText); } catch(e) {}
    }

    // Montar lista de dados copiados para exibir
    var credsDisplay = '';
    if (creds) {
      for (var ci = 0; ci < creds.length; ci++) {
        if (creds[ci].value) {
          credsDisplay += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(51,65,85,0.3);">' +
            '<span style="color:#94a3b8;font-size:12px;">' + App.escapeHtml(creds[ci].label) + '</span>' +
            '<span style="color:#f1f5f9;font-size:12px;font-weight:600;">' + App.escapeHtml(creds[ci].value) + '</span>' +
          '</div>';
        }
      }
    }

    // Mostrar modal com dados copiados + opções
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;';
    overlay.innerHTML =
      '<div style="background:rgba(15,23,42,0.97);border:1px solid rgba(51,65,85,0.4);border-radius:20px;padding:2rem;width:100%;max-width:420px;">' +
        '<p style="font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:12px;text-align:center;">Criar conta no ' + App.escapeHtml(platformName) + '</p>' +
        '<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:12px;padding:12px;margin-bottom:16px;">' +
          '<p style="font-size:11px;font-weight:700;color:#4ade80;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Dados copiados para a area de transferencia</p>' +
          credsDisplay +
        '</div>' +
        '<p style="font-size:12px;color:#94a3b8;margin-bottom:12px;text-align:center;">Use a <strong style="color:#f1f5f9;">mesma senha</strong> em todas as plataformas para facilitar!</p>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<button id="open-normal" style="width:100%;padding:14px;border-radius:12px;font-size:15px;font-weight:700;color:#fff;border:none;cursor:pointer;background:linear-gradient(135deg,#22c55e,#16a34a);">Abrir ' + App.escapeHtml(platformName) + ' direto</button>' +
          '<button id="open-incognito" style="width:100%;padding:14px;border-radius:12px;font-size:15px;font-weight:700;color:#fff;border:none;cursor:pointer;background:linear-gradient(135deg,#6D4AFF,#4F46E5);">Tenho conta pessoal — Copiar link</button>' +
          '<p id="link-copied" style="display:none;font-size:13px;color:#4ade80;margin-top:4px;text-align:center;">Link copiado! Abra uma janela anônima (Ctrl+Shift+N) e cole com Ctrl+V</p>' +
          '<button id="open-cancel" style="width:100%;padding:10px;border-radius:12px;font-size:13px;color:#64748b;border:1px solid rgba(100,116,139,0.3);cursor:pointer;background:none;">Cancelar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('open-normal').addEventListener('click', function() {
      overlay.remove();
      window.open(url, '_blank');
      App.showToast('Dados copiados! Cole no formulário do ' + platformName + '.', 'success');
    });

    document.getElementById('open-incognito').addEventListener('click', function() {
      navigator.clipboard.writeText(url).then(function() {
        document.getElementById('link-copied').style.display = 'block';
        document.getElementById('open-incognito').textContent = 'Link copiado!';
        document.getElementById('open-incognito').style.background = '#22c55e';
      });
    });

    document.getElementById('open-cancel').addEventListener('click', function() {
      overlay.remove();
    });
  });

  // Abrir ProtonMail para verificar código
  bindAction('open-protonmail', function() {
    App.showToast('ProtonMail aberto — procure o código de verificação!', 'info');
  });

  // Abrir sites de SMS virtual para verificação por telefone
  bindAction('open_sms_sites', function() {
    App.showToast('Escolha um número virtual nos sites acima!', 'info');
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
    App.showToast(platform.name + ' aberto em nova aba', 'info');
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

  // Toggle visibilidade da senha gerada
  bindAction('toggle-password-visibility', function(e, el) {
    var field = document.getElementById('generated-password');
    if (!field) return;
    if (field.type === 'password') {
      field.type = 'text';
      el.innerHTML = App.icons.eyeOff;
    } else {
      field.type = 'password';
      el.innerHTML = App.icons.eye;
    }
  });

  // Desfazer conclusão de plataforma
  bindAction('undo-platform', function(e, el) {
    var platformId = el.getAttribute('data-platform-id');
    if (!platformId || !state.platforms[platformId]) return;
    var previousInfo = state.platforms[platformId].accountInfo;
    state.platforms[platformId] = { completed: false, accountInfo: '' };
    App.storage.save(state);
    render();
    App.showUndoToast(App.platforms[platformId].name + ' desmarcada', function() {
      state.platforms[platformId] = { completed: true, accountInfo: previousInfo };
      App.storage.save(state);
      render();
    });
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
      suggestedPassword: state.suggestedPassword,
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
    App.showToast('Arquivo exportado!', 'success');
  });


  bindAction('export-pdf', function() {
    var originalTitle = document.title;
    document.title = 'Onboarding - ' + (state.employee.nomeCompleto || 'Relatorio');
    window.print();
    document.title = originalTitle;
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

  bindAction('delete-history', function(e, el) {
    e.stopPropagation();
    var id = el.getAttribute('data-history-id');
    if (!id) return;
    var history = App.storage.loadHistory();
    var record = null;
    for (var i = 0; i < history.length; i++) {
      if (history[i].id === id) { record = history[i]; break; }
    }
    var name = record ? record.employee.nomeCompleto : 'este registro';
    if (!confirm('Remover "' + name + '" do hist\u00f3rico?')) return;
    App.storage.deleteHistoryItem(id);
    App.showToast('Registro removido', 'info');
    render();
  });

  // ============================================================
  // === Wizard action handlers                                ===
  // ============================================================

  bindAction('wizard-open-register', function() {
    // Link <a> handles the navigation; show toast as feedback
    App.showToast('Página de cadastro aberta', 'info');
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

    var platformName = App.platforms[current.id].name;
    state.platforms[current.id] = { completed: true, accountInfo: accountInfo };
    App.storage.save(state);

    showCompletionCelebration(platformName);

    var next = App.getNextPendingPlatform(state, 0);
    if (next) {
      state.wizardPlatformIndex = next.index;
      App.storage.save(state);
      render();
    } else {
      state.completedAt = new Date().toISOString();
      state.wizardMode = false;
      App.storage.save(state);
      App.storage.saveHistory({
        employee: JSON.parse(JSON.stringify(state.employee)),
        platforms: JSON.parse(JSON.stringify(state.platforms)),
        suggestedPassword: state.suggestedPassword,
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
    var nextIndex = state.wizardPlatformIndex + 1;
    var next = App.getNextPendingPlatform(state, nextIndex);
    if (!next) next = App.getNextPendingPlatform(state, 0);
    if (next && next.index !== state.wizardPlatformIndex) {
      state.wizardPlatformIndex = next.index;
      App.storage.save(state);
      render();
    } else {
      App.showToast('Esta \u00e9 a \u00fanica plataforma pendente.', 'info');
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
  var preferManual = false;

  bindAction('submit-form-to-platforms', function() {
    preferManual = true;
    var form = document.getElementById('employee-form');
    if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

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
          var errorHtml = '<div class="form-error mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">' +
            '<p class="text-sm font-semibold text-red-400 mb-1">Corrija os seguintes erros:</p>' +
            '<ul class="list-disc pl-5 text-sm text-red-300">' +
            errors.map(function(err) { return '<li>' + err + '</li>'; }).join('') +
            '</ul></div>';
          form.querySelector('button[type="submit"]').insertAdjacentHTML('beforebegin', errorHtml);
          App.showToast('Preencha todos os campos obrigatórios', 'error');
          return;
        }

        for (var key in data) {
          if (data.hasOwnProperty(key)) state.employee[key] = data[key];
        }
        if (!state.suggestedPassword) {
          state.suggestedPassword = App.generatePassword(14);
        }
        App.storage.save(state);
        if (preferManual) {
          preferManual = false;
          state.wizardMode = false;
          navigateTo('platforms');
        } else {
          state.wizardMode = true;
          state.wizardPlatformIndex = 0;
          navigateTo('wizard');
        }
      });

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

      // Auto-save form fields on blur + visual validation
      var formFields = form.querySelectorAll('input, select');
      for (var fi = 0; fi < formFields.length; fi++) {
        formFields[fi].addEventListener('blur', function() {
          var input = this;
          var inputs = form.querySelectorAll('input, select');
          for (var j = 0; j < inputs.length; j++) {
            var name = inputs[j].getAttribute('name');
            if (name && state.employee.hasOwnProperty(name)) {
              state.employee[name] = inputs[j].value;
            }
          }
          App.storage.save(state);

          // Visual validation feedback
          var fieldName = input.getAttribute('name');
          var value = input.value;
          var wrapper = input.closest('div');
          if (!wrapper || !fieldName) return;

          input.classList.remove('field-valid', 'field-invalid');
          var oldErr = wrapper.parentElement ? wrapper.parentElement.querySelector('.field-error-msg') : null;
          if (oldErr) oldErr.remove();
          var oldIcon = wrapper.querySelector('.field-valid-icon');
          if (oldIcon) oldIcon.remove();

          if (!value || value.trim() === '') return;

          if (validateFieldVisual(fieldName, value)) {
            input.classList.add('field-valid');
            var icon = document.createElement('div');
            icon.className = 'field-valid-icon';
            icon.innerHTML = '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
            wrapper.appendChild(icon);
          } else {
            input.classList.add('field-invalid');
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
          App.showToast('Todas as contas marcadas como concluídas!', 'success');
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
          App.showToast(App.platforms[state.currentGuide].name + ' concluída!', 'success');
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
                suggestedPassword: state.suggestedPassword,
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

  // Expor navigateTo globalmente (usado em onclick do header como fallback)
  App.navigateTo = navigateTo;

  // ============================================================
  // === Splash Screen — Abertura Green Village               ===
  // ============================================================
  (function() {
    var splash = document.getElementById('splash-screen');
    var logo   = document.getElementById('splash-logo');
    if (!splash) return;

    function closeSplash() {
      if (splash.classList.contains('splash-exit')) return;

      // Smooth forest reveal
      var forest = document.getElementById('bg-forest');
      var overlay = document.querySelector('.bg-overlay');
      if (forest) { forest.style.opacity = '0'; forest.offsetHeight; forest.style.opacity = '1'; }
      if (overlay) { overlay.style.opacity = '0'; overlay.offsetHeight; overlay.style.opacity = '1'; }

      if (logo) logo.classList.add('logo-exit');
      setTimeout(function() {
        splash.classList.add('splash-exit');
        setTimeout(function() {
          splash.style.display = 'none';
          document.body.classList.add('splash-just-closed');
          setTimeout(function() { document.body.classList.remove('splash-just-closed'); }, 1000);
        }, 900);
      }, 500);
    }

    // Fechar ao clicar em qualquer lugar
    splash.addEventListener('click', closeSplash);

    // Fechar automaticamente após 3.2s
    setTimeout(closeSplash, 3200);
  })();

  // Iniciar a aplicação
  render();
})();
