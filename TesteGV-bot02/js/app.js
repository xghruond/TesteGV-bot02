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

  // Undo/Redo stacks (formulario)
  var formUndoStack = [];
  var formRedoStack = [];
  var UNDO_MAX = 30;

  function captureFormSnapshot() {
    var form = document.getElementById('employee-form');
    if (!form) return {};
    var snap = {};
    var inputs = form.querySelectorAll('input, select');
    for (var i = 0; i < inputs.length; i++) {
      var name = inputs[i].getAttribute('name');
      if (name) snap[name] = inputs[i].value;
    }
    return snap;
  }

  function applyFormSnapshot(snap) {
    var form = document.getElementById('employee-form');
    if (!form) return;
    var inputs = form.querySelectorAll('input, select');
    for (var i = 0; i < inputs.length; i++) {
      var name = inputs[i].getAttribute('name');
      if (name && snap.hasOwnProperty(name)) inputs[i].value = snap[name];
    }
  }

  function pushFormUndo() {
    formUndoStack.push(captureFormSnapshot());
    if (formUndoStack.length > UNDO_MAX) formUndoStack.shift();
    formRedoStack = [];
  }

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

  // === Atalhos de teclado ===
  document.addEventListener('keydown', function(e) {
    // Ignorar atalhos dentro de inputs/textareas
    var tag = (e.target.tagName || '').toLowerCase();
    var isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

    // Ctrl+N — novo colaborador
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      if (confirm('Iniciar novo colaborador? (os dados atuais serao salvos no historico)')) {
        if (actionHandlers['reset']) actionHandlers['reset'](e, null);
      }
      return;
    }

    // Ctrl+H — historico
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault();
      navigateTo('history');
      return;
    }

    // Ctrl+Z / Ctrl+Shift+Z — undo/redo no formulario
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
      if (state.currentScreen !== 'form') return;
      e.preventDefault();
      if (e.shiftKey) {
        if (formRedoStack.length === 0) return;
        var redoSnap = formRedoStack.pop();
        formUndoStack.push(captureFormSnapshot());
        applyFormSnapshot(redoSnap);
        App.showToast('Refeito', 'info');
      } else {
        if (formUndoStack.length === 0) return;
        var undoSnap = formUndoStack.pop();
        formRedoStack.push(captureFormSnapshot());
        applyFormSnapshot(undoSnap);
        App.showToast('Desfeito', 'info');
      }
      return;
    }

    // Esc — voltar / fechar modal
    if (e.key === 'Escape') {
      var modal = document.getElementById('automation-overlay');
      if (modal) {
        var cancelBtn = document.getElementById('auto-cancel');
        if (cancelBtn) cancelBtn.click();
        return;
      }
      // Fechar drawer checklist se aberto
      var drawer = document.querySelector('.checklist-drawer.open');
      if (drawer && actionHandlers['toggle-checklist']) {
        actionHandlers['toggle-checklist'](e, null);
        return;
      }
    }

    // Enter (fora de input) — submit tela atual
    if (e.key === 'Enter' && !isInput && !e.shiftKey) {
      var primaryBtn = document.querySelector('button[data-action="start"], button[data-action="continue"], #form-submit-btn');
      if (primaryBtn && primaryBtn.offsetHeight > 0) {
        e.preventDefault();
        primaryBtn.click();
      }
    }
  });

  // === Tela de boas-vindas ===
  function renderWelcome() {
    var historyArr = App.storage.loadHistory();
    var historyCount = historyArr.length;

    // Calcular estatisticas
    var accountsCreated = 0;
    var completedCount = 0;
    for (var hx = 0; hx < historyArr.length; hx++) {
      var r = historyArr[hx];
      var cc = Object.values(r.platforms).filter(function(p) { return p.completed; }).length;
      var tt = Object.keys(r.platforms).length;
      accountsCreated += cc;
      if (cc === tt) completedCount++;
    }

    var dashboardHtml = historyCount > 0
      ? '<div class="mb-6 grid grid-cols-3 gap-2 max-w-md mx-auto">' +
          '<div class="rounded-xl border border-brand-500/20 bg-brand-500/5 backdrop-blur-sm p-3 text-center hover:border-brand-500/40 hover:bg-brand-500/10 transition-all">' +
            '<div class="text-2xl font-bold text-brand-400">' + historyCount + '</div>' +
            '<div class="text-[10px] text-dark-400 uppercase tracking-wider">Onboardings</div>' +
          '</div>' +
          '<div class="rounded-xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm p-3 text-center hover:border-green-500/40 hover:bg-green-500/10 transition-all">' +
            '<div class="text-2xl font-bold text-green-400">' + completedCount + '</div>' +
            '<div class="text-[10px] text-dark-400 uppercase tracking-wider">Completos</div>' +
          '</div>' +
          '<div class="rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-3 text-center hover:border-amber-500/40 hover:bg-amber-500/10 transition-all">' +
            '<div class="text-2xl font-bold text-amber-400">' + accountsCreated + '</div>' +
            '<div class="text-[10px] text-dark-400 uppercase tracking-wider">Contas</div>' +
          '</div>' +
        '</div>'
      : '';

    var historyButton = historyCount > 0
      ? '<button data-action="view-history" class="mt-4 w-full rounded-xl border border-dark-700/50 bg-dark-800/40 px-8 py-3.5 text-base font-medium text-dark-300 backdrop-blur-sm transition-all hover:bg-dark-800/60 hover:border-brand-500/30 hover:text-white">' +
          App.icons.clipboard + ' Hist\u00f3rico (' + historyCount + ')</button>'
      : '';

    // Favoritos: chips com cargo/departamento de perfis pinnados
    var favIds = App.storage.loadFavorites();
    var favChipsHtml = '';
    if (favIds.length) {
      var favRecords = [];
      for (var fx = 0; fx < historyArr.length; fx++) {
        if (favIds.indexOf(historyArr[fx].id) !== -1) favRecords.push(historyArr[fx]);
      }
      if (favRecords.length) {
        favChipsHtml = '<div class="mb-6">' +
          '<p class="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-2 flex items-center justify-center gap-1">' +
            '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63L22 9.24l-5.46 4.73 1.64 7.03z"/></svg>' +
            ' Favoritos' +
          '</p>' +
          '<div class="flex flex-wrap justify-center gap-2">' +
            favRecords.map(function(fr) {
              var label = fr.employee.cargo || fr.employee.nomeCompleto || 'Template';
              return '<button data-action="load-favorite" data-history-id="' + fr.id + '" class="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors">' +
                App.escapeHtml(label) + '</button>';
            }).join('') +
          '</div>' +
        '</div>';
      }
    }

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
            '<p id="typewriter-text" class="text-lg text-dark-400 h-7 mb-4"></p>' +
          '</div>' +

          // Dashboard de estatisticas (se ha historico)
          dashboardHtml +
          favChipsHtml +

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
          '<label class="mt-2 w-full rounded-xl border border-dark-700/50 bg-dark-800/40 px-8 py-3 text-sm font-medium text-dark-400 backdrop-blur-sm transition-all hover:bg-dark-800/60 hover:border-brand-500/30 hover:text-brand-400 cursor-pointer flex items-center justify-center gap-2">' +
            '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>' +
            ' Importar CSV em massa' +
            '<input type="file" id="csv-import-input" accept=".csv" style="display:none;" />' +
          '</label>' +
          (App.storage.loadImportQueue().length > 0
            ? '<button data-action="resume-queue" class="mt-2 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-8 py-3 text-sm font-medium text-amber-400 hover:bg-amber-500/20 transition-colors">' +
                'Continuar fila (' + App.storage.loadImportQueue().length + ' restantes)</button>'
            : '') +
          '<button data-action="view-logs" class="mt-2 w-full rounded-xl border border-dark-700/50 bg-dark-800/40 px-8 py-3 text-sm font-medium text-dark-400 backdrop-blur-sm transition-all hover:bg-dark-800/60 hover:border-brand-500/30 hover:text-brand-400">' +
            '<svg class="inline-block w-4 h-4 mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>' +
            'Logs de Automacao</button>' +

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
            '<svg class="empty-state-illustration" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<rect x="40" y="30" width="120" height="150" rx="12" stroke="#4ade80" stroke-width="3" stroke-dasharray="6 4"/>' +
              '<line x1="60" y1="60" x2="140" y2="60" stroke="#4ade80" stroke-width="3" stroke-linecap="round"/>' +
              '<line x1="60" y1="85" x2="140" y2="85" stroke="#4ade80" stroke-width="3" stroke-linecap="round" opacity="0.6"/>' +
              '<line x1="60" y1="110" x2="120" y2="110" stroke="#4ade80" stroke-width="3" stroke-linecap="round" opacity="0.4"/>' +
              '<circle cx="100" cy="150" r="15" stroke="#4ade80" stroke-width="3" fill="none"/>' +
              '<line x1="110" y1="160" x2="125" y2="175" stroke="#4ade80" stroke-width="3" stroke-linecap="round"/>' +
            '</svg>' +
            '<p class="text-lg text-dark-300 mb-2 font-semibold">Nenhum processo realizado</p>' +
            '<p class="text-sm text-dark-500 mb-6">Seu historico aparecera aqui apos o primeiro onboarding</p>' +
            '<button data-action="back-welcome" class="rounded-xl border border-brand-500/30 bg-brand-500/10 px-6 py-3 text-sm font-medium text-brand-400 hover:bg-brand-500/20 transition-colors">Comecar agora</button>' +
          '</div>' +
        '</div>';
    }

    // Calcular estatisticas
    var totalRecords = history.length;
    var fullySuccess = 0;
    var partialSuccess = 0;
    var accountsCreated = 0;
    for (var hi = 0; hi < history.length; hi++) {
      var rec = history[hi];
      var cc = Object.values(rec.platforms).filter(function(p) { return p.completed; }).length;
      var tt = Object.keys(rec.platforms).length;
      accountsCreated += cc;
      if (cc === tt) fullySuccess++;
      else if (cc > 0) partialSuccess++;
    }

    var rows = history.slice().reverse().map(function(record, idx) {
      var completedCount = Object.values(record.platforms).filter(function(p) { return p.completed; }).length;
      var total = Object.keys(record.platforms).length;
      var allDone = completedCount === total;
      var completedPlatformsList = [];
      var _pids = Object.keys(record.platforms);
      for (var _p = 0; _p < _pids.length; _p++) {
        if (record.platforms[_pids[_p]].completed) completedPlatformsList.push(_pids[_p]);
      }
      var dateIso = (record.completedAt || '').slice(0, 10);
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
        '<div class="history-row group flex items-center gap-4 rounded-xl border border-dark-700/60 bg-dark-800/80 p-4 backdrop-blur-sm hover:border-brand-500/40 hover:bg-dark-800 transition-all cursor-pointer" data-search-name="' + App.escapeHtml((record.employee.nomeCompleto || '').toLowerCase()) + '" data-filter-date="' + dateIso + '" data-filter-status="' + (allDone ? 'complete' : 'partial') + '" data-filter-platforms="' + completedPlatformsList.join(',') + '" data-action="view-history-item" data-history-id="' + record.id + '">' +
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
            '<button data-action="toggle-favorite" data-history-id="' + record.id + '" title="' + (App.storage.isFavorite(record.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos') + '" class="p-1.5 rounded-lg transition-colors ' + (App.storage.isFavorite(record.id) ? 'text-amber-400 hover:bg-amber-500/10' : 'text-dark-700 hover:text-amber-400 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100') + '">' +
              (App.storage.isFavorite(record.id)
                ? '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63L22 9.24l-5.46 4.73 1.64 7.03z"/></svg>'
                : '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>') +
            '</button>' +
            '<button data-action="delete-history" data-history-id="' + record.id + '" title="Remover do hist\u00f3rico" class="p-1.5 rounded-lg text-dark-700 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100">' +
              App.icons.trash +
            '</button>' +
            '<div class="text-dark-600 group-hover:text-dark-400 transition-colors">' + App.icons.chevronRight + '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    // Dashboard de estatisticas
    var dashboardHtml =
      '<div class="mb-6 grid grid-cols-3 gap-3">' +
        '<div class="rounded-xl border border-dark-700/60 bg-dark-900/40 backdrop-blur-sm p-4 text-center">' +
          '<div class="text-3xl font-bold text-brand-400">' + totalRecords + '</div>' +
          '<div class="text-xs text-dark-400 mt-1">Onboardings</div>' +
        '</div>' +
        '<div class="rounded-xl border border-green-500/20 bg-green-500/5 backdrop-blur-sm p-4 text-center">' +
          '<div class="text-3xl font-bold text-green-400">' + fullySuccess + '</div>' +
          '<div class="text-xs text-dark-400 mt-1">Completos</div>' +
        '</div>' +
        '<div class="rounded-xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-4 text-center">' +
          '<div class="text-3xl font-bold text-amber-400">' + accountsCreated + '</div>' +
          '<div class="text-xs text-dark-400 mt-1">Contas criadas</div>' +
        '</div>' +
      '</div>';

    // Busca avancada: nome + data + status + plataforma
    var searchHtml =
      '<div class="mb-4 space-y-3">' +
        '<div class="relative">' +
          '<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-dark-500">' +
            '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
          '</div>' +
          '<input type="text" id="history-search" placeholder="Buscar por nome do colaborador..." class="dark-input block w-full rounded-xl py-2.5 pl-10 pr-4 text-sm" />' +
        '</div>' +
        '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">' +
          '<input type="date" id="history-date-from" title="Data inicial" class="dark-input rounded-lg px-3 py-2 text-xs" />' +
          '<input type="date" id="history-date-to" title="Data final" class="dark-input rounded-lg px-3 py-2 text-xs" />' +
          '<select id="history-status" class="dark-input rounded-lg px-3 py-2 text-xs">' +
            '<option value="">Todos os status</option>' +
            '<option value="complete">Completo (4/4)</option>' +
            '<option value="partial">Parcial</option>' +
          '</select>' +
          '<select id="history-platform" class="dark-input rounded-lg px-3 py-2 text-xs">' +
            '<option value="">Todas plataformas</option>' +
            '<option value="protonmail">Com ProtonMail</option>' +
            '<option value="instagram">Com Instagram</option>' +
            '<option value="facebook">Com Facebook</option>' +
            '<option value="tiktok">Com TikTok</option>' +
          '</select>' +
        '</div>' +
      '</div>';

    return '' +
      '<div class="mx-auto max-w-3xl">' +
        '<div class="mb-6 flex items-center justify-between">' +
          '<div class="flex items-center gap-3">' +
            '<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">' + App.icons.clipboard + '</div>' +
            '<div>' +
              '<h2 class="text-2xl font-bold text-dark-50">Histórico</h2>' +
              '<p class="text-sm text-dark-500">' + history.length + ' processo' + (history.length !== 1 ? 's' : '') + ' realizado' + (history.length !== 1 ? 's' : '') + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<button data-action="export-history-csv" class="rounded-xl border border-brand-500/30 bg-brand-500/10 px-4 py-2.5 text-sm font-medium text-brand-400 hover:bg-brand-500/20 transition-colors">' +
              App.icons.download + ' CSV</button>' +
            '<button data-action="back-welcome" class="rounded-xl border border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' +
              App.icons.chevronLeft + ' Voltar</button>' +
          '</div>' +
        '</div>' +
        dashboardHtml +
        searchHtml +
        '<div class="space-y-3" id="history-rows">' + rows + '</div>' +
      '</div>';
  }

  function renderLogsScreen() {
    return '' +
      '<div class="mx-auto max-w-5xl">' +
        '<div class="mb-6 flex items-center justify-between">' +
          '<div class="flex items-center gap-3">' +
            '<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">' +
              '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>' +
            '</div>' +
            '<div><h2 class="text-2xl font-bold text-dark-50">Logs de Automacao</h2>' +
              '<p class="text-sm text-dark-500" id="logs-count">Carregando...</p></div>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<button data-action="refresh-logs" class="rounded-xl border border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-brand-400 transition-colors">' + App.icons.refresh + ' Atualizar</button>' +
            '<button data-action="clear-logs" class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors">Limpar</button>' +
            '<button data-action="back-welcome" class="rounded-xl border border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' + App.icons.chevronLeft + ' Voltar</button>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-2 mb-4">' +
          '<select id="logs-filter-bot" class="dark-input rounded-lg px-3 py-2 text-xs">' +
            '<option value="">Todos os bots</option>' +
            '<option value="protonmail">ProtonMail</option>' +
            '<option value="instagram">Instagram</option>' +
            '<option value="tutanota">Tutanota</option>' +
          '</select>' +
          '<select id="logs-filter-level" class="dark-input rounded-lg px-3 py-2 text-xs">' +
            '<option value="">Todos os niveis</option>' +
            '<option value="info">Info</option>' +
            '<option value="warn">Warning</option>' +
            '<option value="error">Error</option>' +
          '</select>' +
        '</div>' +
        '<div id="logs-container" class="space-y-1.5 font-mono text-xs"><p class="text-dark-500 text-center py-8">Carregando logs...</p></div>' +
      '</div>';
  }

  function loadAndRenderLogs() {
    var container = document.getElementById('logs-container');
    var countEl = document.getElementById('logs-count');
    if (!container) return;
    fetch('/api/logs')
      .then(function(r) { return r.json(); })
      .catch(function() { return { logs: [] }; })
      .then(function(data) {
        var logs = (data && data.logs) || [];
        var botFilter = (document.getElementById('logs-filter-bot') || {}).value || '';
        var levelFilter = (document.getElementById('logs-filter-level') || {}).value || '';
        var filtered = logs.filter(function(l) {
          if (botFilter && l.bot !== botFilter) return false;
          if (levelFilter && l.level !== levelFilter) return false;
          return true;
        });
        if (countEl) countEl.textContent = filtered.length + ' eventos' + (filtered.length !== logs.length ? ' (de ' + logs.length + ')' : '');
        if (filtered.length === 0) {
          container.innerHTML =
            '<div class="text-center py-12">' +
              '<svg class="empty-state-illustration" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<circle cx="100" cy="100" r="60" stroke="#64748b" stroke-width="3" stroke-dasharray="4 6"/>' +
                '<path d="M75 100 L90 115 L125 85" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
              '</svg>' +
              '<p class="text-dark-300 text-sm font-medium">Nenhum log registrado ainda</p>' +
              '<p class="text-dark-500 text-xs mt-1">Rode uma automacao para ver eventos aqui</p>' +
            '</div>';
          return;
        }
        container.innerHTML = filtered.slice().reverse().map(function(l) {
          var levelClass = l.level === 'error' ? 'text-red-400 border-red-500/30 bg-red-500/5' :
                           l.level === 'warn' ? 'text-amber-400 border-amber-500/30 bg-amber-500/5' :
                           'text-dark-300 border-dark-700/50 bg-dark-800/40';
          var botBadge = '<span class="inline-block rounded px-1.5 py-0.5 bg-brand-500/10 text-brand-400 text-[10px] font-semibold">' + App.escapeHtml(l.bot) + '</span>';
          var stepInfo = (l.step !== null && l.step !== undefined) ? ' <span class="text-dark-500">[step ' + l.step + ']</span>' : '';
          var extra = l.extra && Object.keys(l.extra).length
            ? '<div class="text-[10px] text-dark-500 mt-1">' + App.escapeHtml(JSON.stringify(l.extra)) + '</div>' : '';
          return '<div class="flex items-start gap-2 rounded-lg border px-3 py-2 ' + levelClass + '">' +
            '<span class="text-dark-500 shrink-0">' + App.escapeHtml(l.ts.split('T')[1] || l.ts) + '</span>' +
            botBadge +
            '<div class="flex-1 min-w-0">' + App.escapeHtml(l.message) + stepInfo + extra + '</div>' +
          '</div>';
        }).join('');
      });
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

    if (state.currentScreen === 'welcome' || state.currentScreen === 'history' || state.currentScreen === 'history-detail' || state.currentScreen === 'logs') {
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
          // Hook busca avancada
          setTimeout(function() {
            var search = document.getElementById('history-search');
            var dateFrom = document.getElementById('history-date-from');
            var dateTo = document.getElementById('history-date-to');
            var statusSel = document.getElementById('history-status');
            var platSel = document.getElementById('history-platform');

            function applyFilters() {
              var q = (search && search.value || '').toLowerCase().trim();
              var df = (dateFrom && dateFrom.value) || '';
              var dt = (dateTo && dateTo.value) || '';
              var st = (statusSel && statusSel.value) || '';
              var pf = (platSel && platSel.value) || '';
              var rows = document.querySelectorAll('.history-row');
              for (var r = 0; r < rows.length; r++) {
                var row = rows[r];
                var name = row.getAttribute('data-search-name') || '';
                var rowDate = row.getAttribute('data-filter-date') || '';
                var rowStatus = row.getAttribute('data-filter-status') || '';
                var rowPlats = row.getAttribute('data-filter-platforms') || '';
                var show = true;
                if (q && name.indexOf(q) === -1) show = false;
                if (df && rowDate && rowDate < df) show = false;
                if (dt && rowDate && rowDate > dt) show = false;
                if (st && rowStatus !== st) show = false;
                if (pf && rowPlats.split(',').indexOf(pf) === -1) show = false;
                row.style.display = show ? '' : 'none';
              }
            }

            if (search) search.addEventListener('input', applyFilters);
            if (dateFrom) dateFrom.addEventListener('change', applyFilters);
            if (dateTo) dateTo.addEventListener('change', applyFilters);
            if (statusSel) statusSel.addEventListener('change', applyFilters);
            if (platSel) platSel.addEventListener('change', applyFilters);
          }, 50);
          break;
        case 'history-detail':
          content.innerHTML = renderHistoryDetail(state.viewingHistoryId);
          break;
        case 'logs':
          content.innerHTML = renderLogsScreen();
          setTimeout(function() {
            loadAndRenderLogs();
            var bf = document.getElementById('logs-filter-bot');
            var lf = document.getElementById('logs-filter-level');
            if (bf) bf.addEventListener('change', loadAndRenderLogs);
            if (lf) lf.addEventListener('change', loadAndRenderLogs);
          }, 50);
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
    // Pedir permissao de notificacao (primeira interacao)
    if (App.requestNotificationPermission) App.requestNotificationPermission();
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

  // Mostrar modal de atalhos de teclado
  bindAction('show-shortcuts', function() {
    var existing = document.getElementById('shortcuts-modal');
    if (existing) { existing.remove(); return; }
    var modal = document.createElement('div');
    modal.id = 'shortcuts-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(8px);';
    modal.innerHTML =
      '<div style="background:rgba(15,23,42,0.97);border:1px solid rgba(34,197,94,0.3);border-radius:20px;padding:2rem;max-width:420px;width:100%;">' +
        '<h3 style="font-size:18px;font-weight:700;color:#f1f5f9;margin-bottom:16px;text-align:center;">&#9000; Atalhos de Teclado</h3>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<div style="display:flex;justify-content:space-between;padding:10px;background:rgba(30,41,59,0.5);border-radius:10px;">' +
            '<span style="color:#94a3b8;font-size:13px;">Novo colaborador</span>' +
            '<kbd style="background:#1e293b;border:1px solid #334155;padding:2px 8px;border-radius:4px;font-size:11px;color:#4ade80;">Ctrl + N</kbd>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;padding:10px;background:rgba(30,41,59,0.5);border-radius:10px;">' +
            '<span style="color:#94a3b8;font-size:13px;">Ver hist&oacute;rico</span>' +
            '<kbd style="background:#1e293b;border:1px solid #334155;padding:2px 8px;border-radius:4px;font-size:11px;color:#4ade80;">Ctrl + H</kbd>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;padding:10px;background:rgba(30,41,59,0.5);border-radius:10px;">' +
            '<span style="color:#94a3b8;font-size:13px;">Cancelar / Fechar modal</span>' +
            '<kbd style="background:#1e293b;border:1px solid #334155;padding:2px 8px;border-radius:4px;font-size:11px;color:#4ade80;">Esc</kbd>' +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;padding:10px;background:rgba(30,41,59,0.5);border-radius:10px;">' +
            '<span style="color:#94a3b8;font-size:13px;">Continuar</span>' +
            '<kbd style="background:#1e293b;border:1px solid #334155;padding:2px 8px;border-radius:4px;font-size:11px;color:#4ade80;">Enter</kbd>' +
          '</div>' +
        '</div>' +
        '<button id="close-shortcuts" style="margin-top:20px;width:100%;border-radius:12px;padding:12px;background:#334155;color:#f1f5f9;font-weight:600;border:none;cursor:pointer;">Fechar</button>' +
      '</div>';
    document.body.appendChild(modal);
    document.getElementById('close-shortcuts').addEventListener('click', function() {
      modal.remove();
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.remove();
    });
  });

  // Repetir departamento/cargo do ultimo colaborador (template)
  bindAction('repeat-last', function() {
    var hist = App.storage.loadHistory();
    if (hist.length === 0) {
      App.showToast('Nenhum colaborador no historico', 'info');
      return;
    }
    var last = hist[hist.length - 1];
    var fields = {
      cargo: last.employee.cargo || '',
      departamento: last.employee.departamento || ''
    };
    for (var key in fields) {
      var inp = document.querySelector('[name="' + key + '"]');
      if (inp) {
        inp.value = fields[key];
        inp.dispatchEvent(new Event('change'));
      }
    }
    App.showToast('Cargo e departamento copiados do ultimo', 'success');
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
      if (currentStep === 6 && message) {
        var msgLower = message.toLowerCase();
        if (msgLower.indexOf('captcha visual') > -1 || msgLower.indexOf('resolva') > -1) {
          html += '<div style="margin-top:12px;padding:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;">' +
            '<p style="color:#fbbf24;font-size:13px;font-weight:600;text-align:center;">⚠ CAPTCHA visual detectado — resolva no navegador!</p></div>';
        } else if (msgLower.indexOf('codigo') > -1 || msgLower.indexOf('email') > -1 || msgLower.indexOf('buscando') > -1) {
          html += '<div style="margin-top:12px;padding:12px;background:rgba(109,74,255,0.1);border:1px solid rgba(109,74,255,0.3);border-radius:10px;">' +
            '<p style="color:#a78bfa;font-size:13px;font-weight:600;text-align:center;">' + App.escapeHtml(message) + '</p></div>';
        }
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

    // Mostrar badge no header
    App.showBotStatus('ProtonMail', Date.now());

    document.getElementById('auto-cancel').addEventListener('click', function() {
      cancelled = true;
      if (polling) clearInterval(polling);
      overlay.remove();
      App.hideBotStatus();
    });

    // Detecao de stall (timeout warning)
    var lastStepChange = Date.now();
    var lastStep = 0;
    var stallWarningShown = false;

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
            // Detectar stall (step nao muda por 30s)
            if (s.step !== lastStep) {
              lastStep = s.step;
              lastStepChange = Date.now();
              stallWarningShown = false;
              var sw = document.getElementById('stall-warning');
              if (sw) sw.remove();
            } else if (!stallWarningShown && !s.done && Date.now() - lastStepChange > 30000) {
              stallWarningShown = true;
              var stepsElW = document.getElementById('auto-steps');
              if (stepsElW) {
                var warn = document.createElement('div');
                warn.id = 'stall-warning';
                warn.style.cssText = 'margin-top:12px;padding:12px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:10px;color:#fbbf24;font-size:12px;text-align:center;';
                warn.innerHTML = '&#9888; Sem progresso ha 30s — pode ser lentidao. Aguarde ou cancele e tente novamente.';
                stepsElW.parentNode.insertBefore(warn, stepsElW.nextSibling);
              }
            }

            // Atualizar modal
            var stepsEl = document.getElementById('auto-steps');
            if (stepsEl) stepsEl.innerHTML = buildStepsHTML(s.step, s.message);

            if (s.done) {
              clearInterval(polling);
              App.hideBotStatus();
              var swe = document.getElementById('stall-warning');
              if (swe) swe.remove();
              if (s.success) {
                // Sucesso!
                App.notify('ProtonMail criado!', username + '@proton.me');
                state.platforms.protonmail = { completed: true, accountInfo: username + '@proton.me', password: password };
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
                    // Avançar para próxima plataforma pendente
                    var next = App.getNextPendingPlatform(state, 0);
                    if (next && state.wizardMode) {
                      state.wizardPlatformIndex = next.index;
                      App.storage.save(state);
                    }
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
    // VPN é gerenciado automaticamente pelo bot
    if (!confirm('O bot vai criar a conta Instagram automaticamente.\nO VPN sera desligado/religado conforme necessario.\n\nContinuar?')) {
      return;
    }

    var email = 'teste.greenvillage@tutamail.com';
    var password = state.suggestedPassword || App.generatePassword(14);
    var fullName = state.employee.nomeCompleto || '';
    var username = state.employee.emailDesejado || '';
    var birthParts = (state.employee.dataNascimento || '2000-01-01').split('-');
    var birthYear = birthParts[0] || '2000';
    var birthMonth = String(parseInt(birthParts[1] || '1'));
    var birthDay = String(parseInt(birthParts[2] || '1'));

    if (!email || !password) {
      App.showToast('Erro: email ou senha nao encontrados. Crie o ProtonMail primeiro.', 'error');
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

    // Mostrar badge no header
    App.showBotStatus('Instagram', Date.now());

    document.getElementById('auto-cancel').addEventListener('click', function() {
      cancelled = true;
      if (polling) clearInterval(polling);
      overlay.remove();
      App.hideBotStatus();
    });

    fetch('/api/create-instagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email, password: password, fullName: fullName,
        username: username, birthDay: birthDay, birthMonth: birthMonth, birthYear: birthYear,
        createFreshEmail: true
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

            // Banner pulsante quando SMS necessario
            var modal = document.getElementById('auto-modal');
            var msg = (s.message || '').toUpperCase();
            var needsAction = msg.indexOf('ACAO NECESSARIA') > -1 || msg.indexOf('SMS') > -1;
            var existingBanner = document.getElementById('sms-banner');
            if (needsAction && !existingBanner && modal) {
              var banner = document.createElement('div');
              banner.id = 'sms-banner';
              banner.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:#fbbf24;color:#000;padding:16px 24px;border-radius:12px;font-size:15px;font-weight:700;box-shadow:0 4px 20px rgba(251,191,36,0.5);animation:pulse 1.5s infinite;max-width:500px;text-align:center;';
              banner.innerHTML = '\u26A0 DIGITE O CODIGO SMS NO INSTAGRAM';
              document.body.appendChild(banner);
              // Adicionar keyframe se nao existe
              if (!document.getElementById('sms-pulse-style')) {
                var style = document.createElement('style');
                style.id = 'sms-pulse-style';
                style.innerHTML = '@keyframes pulse { 0%,100% { opacity: 1; transform: translateX(-50%) scale(1); } 50% { opacity: 0.7; transform: translateX(-50%) scale(1.05); } }';
                document.head.appendChild(style);
              }
            } else if (!needsAction && existingBanner) {
              existingBanner.remove();
            }

            if (s.done) {
              clearInterval(polling);
              App.hideBotStatus();
              if (s.success) {
                App.notify('Instagram criado!', '@' + username);
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

  // Copiar como tabela (Excel-friendly)
  bindAction('copy-as-table', function(e, el) {
    var emp = state.employee;
    var password = state.suggestedPassword || '';
    var email = emp.emailDesejado ? emp.emailDesejado + '@proton.me' : '';
    var rows = [];
    // Header
    rows.push(['Nome', 'Email', 'Senha', 'Plataforma', 'Conta', 'Status'].join('\t'));
    // Para cada plataforma criada
    var platformIds = Object.keys(state.platforms);
    for (var i = 0; i < platformIds.length; i++) {
      var pid = platformIds[i];
      var ps = state.platforms[pid];
      var platName = (App.platforms[pid] && App.platforms[pid].name) || pid;
      rows.push([
        emp.nomeCompleto || '',
        email,
        password,
        platName,
        ps.accountInfo || '',
        ps.completed ? 'Criada' : 'Pendente'
      ].join('\t'));
    }
    var text = rows.join('\n');
    App.copyToClipboard(text, el);
    App.showToast('Tabela copiada! Cole no Excel/Sheets', 'success');
  });

  // Exportar TXT
  bindAction('show-qr', function(e, el) {
    var container = document.getElementById('qr-credentials-container');
    if (!container) return;
    if (container.style.display !== 'none' && container.innerHTML.trim()) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    if (typeof QRCode === 'undefined') {
      App.showToast('Biblioteca QR nao carregada', 'error');
      return;
    }
    var email = state.employee.emailDesejado ? state.employee.emailDesejado + '@proton.me' : '';
    var senha = state.suggestedPassword || '';
    var payload = {
      nome: state.employee.nomeCompleto || '',
      email: email,
      senha: senha,
      proton: email,
      instagram: '@' + (state.employee.emailDesejado || ''),
      gerado: new Date().toISOString().slice(0, 19)
    };
    var text = JSON.stringify(payload);
    container.style.display = 'flex';
    container.innerHTML = '<div class="rounded-xl border border-purple-500/30 bg-white p-6 shadow-xl shadow-purple-500/10"><canvas id="qr-canvas"></canvas><p class="mt-3 text-xs text-gray-700 text-center max-w-[200px]">Escaneie para copiar credenciais</p></div>';
    var canvas = document.getElementById('qr-canvas');
    QRCode.toCanvas(canvas, text, { width: 220, margin: 1, color: { dark: '#000', light: '#fff' } }, function(err) {
      if (err) App.showToast('Erro ao gerar QR: ' + err.message, 'error');
    });
  });

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

  bindAction('toggle-favorite', function(e, el) {
    e.stopPropagation();
    var id = el.getAttribute('data-history-id');
    var added = App.storage.toggleFavorite(id);
    App.showToast(added ? 'Adicionado aos favoritos' : 'Removido dos favoritos', 'success');
    render();
  });

  bindAction('load-favorite', function(e, el) {
    var id = el.getAttribute('data-history-id');
    var history = App.storage.loadHistory();
    var record = null;
    for (var i = 0; i < history.length; i++) {
      if (history[i].id === id) { record = history[i]; break; }
    }
    if (!record) return;
    // Carregar cargo/departamento do favorito como template
    state.employee = {
      nomeCompleto: '',
      emailDesejado: '',
      dataNascimento: '',
      cargo: record.employee.cargo || '',
      departamento: record.employee.departamento || '',
      dataAdmissao: ''
    };
    App.storage.save(state);
    App.showToast('Template carregado: ' + (record.employee.cargo || 'cargo'), 'success');
    navigateTo('form');
  });

  bindAction('export-history-csv', function() {
    var history = App.storage.loadHistory();
    if (!history.length) {
      App.showToast('Nenhum registro no historico', 'info');
      return;
    }
    var header = ['Nome', 'Email', 'Cargo', 'Departamento', 'DataAdmissao', 'ProtonMail', 'Instagram', 'Facebook', 'TikTok', 'Status', 'CriadoEm'];
    var lines = [header.join(',')];
    for (var i = 0; i < history.length; i++) {
      var r = history[i];
      var emp = r.employee || {};
      var platforms = r.platforms || {};
      var completed = 0;
      var total = 0;
      var pKeys = Object.keys(platforms);
      for (var k = 0; k < pKeys.length; k++) {
        total++;
        if (platforms[pKeys[k]].completed) completed++;
      }
      function csvEscape(v) {
        v = String(v == null ? '' : v);
        if (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1) {
          return '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
      }
      function pInfo(id) {
        return platforms[id] && platforms[id].completed ? (platforms[id].accountInfo || 'criada') : '';
      }
      lines.push([
        csvEscape(emp.nomeCompleto),
        csvEscape((emp.emailDesejado || '') + '@proton.me'),
        csvEscape(emp.cargo),
        csvEscape(App.departmentLabels[emp.departamento] || emp.departamento),
        csvEscape(emp.dataAdmissao),
        csvEscape(pInfo('protonmail')),
        csvEscape(pInfo('instagram')),
        csvEscape(pInfo('facebook')),
        csvEscape(pInfo('tiktok')),
        csvEscape(completed + '/' + total),
        csvEscape(r.completedAt)
      ].join(','));
    }
    var csv = '\uFEFF' + lines.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'historico-greenbot-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    App.showToast('CSV exportado (' + history.length + ' registros)', 'success');
  });

  bindAction('view-logs', function() {
    navigateTo('logs');
  });

  bindAction('toggle-theme', function() {
    var cur = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('gv-theme', next); } catch (e) {}
    App.showToast('Tema: ' + (next === 'light' ? 'Claro' : 'Escuro'), 'info');
  });

  // Init tema salvo
  try {
    var savedTheme = localStorage.getItem('gv-theme');
    if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch (e) {}

  // === Tour de onboarding (primeira visita) ===
  var tourSteps = [
    {
      title: 'Bem-vindo ao Green BOT!',
      body: 'Este sistema guia voce na criacao de contas profissionais para novos colaboradores. Vamos fazer um tour rapido de 4 passos.',
      target: null
    },
    {
      title: 'Iniciar onboarding',
      body: 'Clique em <strong>Iniciar</strong> para criar contas para um novo colaborador. Voce podera escolher entre preencher automaticamente ou manualmente.',
      target: '[data-action="start"]'
    },
    {
      title: 'Importacao em massa',
      body: 'Tem varios colaboradores? Use <strong>Importar CSV</strong> para processar em lote. O sistema carrega cada linha automaticamente.',
      target: '#csv-import-input'
    },
    {
      title: 'Atalhos de teclado',
      body: 'Pressione <strong>Ctrl+N</strong> para novo, <strong>Ctrl+H</strong> para historico, <strong>Ctrl+Z</strong> para desfazer. Divirta-se!',
      target: null
    }
  ];
  var tourIndex = 0;

  function positionTourBubble(bubble, targetSelector) {
    if (!targetSelector) {
      bubble.style.top = '50%';
      bubble.style.left = '50%';
      bubble.style.transform = 'translate(-50%, -50%)';
      return;
    }
    var target = document.querySelector(targetSelector);
    if (!target) {
      bubble.style.top = '50%';
      bubble.style.left = '50%';
      bubble.style.transform = 'translate(-50%, -50%)';
      return;
    }
    var rect = target.getBoundingClientRect();
    target.style.position = target.style.position || 'relative';
    target.style.zIndex = '9999';
    target.style.boxShadow = '0 0 0 4px rgba(74, 222, 128, 0.5), 0 0 30px rgba(74, 222, 128, 0.4)';
    target.style.borderRadius = '12px';
    var top = rect.bottom + 16;
    if (top + 220 > window.innerHeight) top = rect.top - 220;
    if (top < 16) top = 16;
    var left = Math.max(16, Math.min(window.innerWidth - 360, rect.left + rect.width / 2 - 170));
    bubble.style.top = top + 'px';
    bubble.style.left = left + 'px';
    bubble.style.transform = 'none';
  }

  function clearTourHighlight() {
    var els = document.querySelectorAll('[style*="box-shadow"]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].style.boxShadow.indexOf('74, 222, 128') !== -1) {
        els[i].style.boxShadow = '';
        els[i].style.zIndex = '';
      }
    }
  }

  function showTourStep() {
    var overlay = document.getElementById('tour-overlay');
    var bubble = document.getElementById('tour-bubble');
    if (!overlay || !bubble) return;
    var step = tourSteps[tourIndex];
    if (!step) { endTour(); return; }
    clearTourHighlight();
    bubble.innerHTML =
      '<h4>' + App.escapeHtml(step.title) + '</h4>' +
      '<p>' + step.body + '</p>' +
      '<div class="tour-nav">' +
        '<span class="tour-progress">' + (tourIndex + 1) + ' de ' + tourSteps.length + '</span>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="tour-skip" id="tour-skip-btn">Pular</button>' +
          '<button class="tour-next" id="tour-next-btn">' + (tourIndex === tourSteps.length - 1 ? 'Concluir' : 'Proximo →') + '</button>' +
        '</div>' +
      '</div>';
    positionTourBubble(bubble, step.target);
    setTimeout(function() { bubble.classList.add('active'); }, 10);
    var skipBtn = document.getElementById('tour-skip-btn');
    var nextBtn = document.getElementById('tour-next-btn');
    if (skipBtn) skipBtn.onclick = endTour;
    if (nextBtn) nextBtn.onclick = function() {
      tourIndex++;
      if (tourIndex >= tourSteps.length) endTour();
      else showTourStep();
    };
  }

  function endTour() {
    var overlay = document.getElementById('tour-overlay');
    var bubble = document.getElementById('tour-bubble');
    if (overlay) overlay.classList.remove('active');
    if (bubble) {
      bubble.classList.remove('active');
      setTimeout(function() {
        if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 300);
    }
    clearTourHighlight();
    try { localStorage.setItem('gv-tour-seen', '1'); } catch (e) {}
  }

  function startTour() {
    var overlay = document.createElement('div');
    overlay.id = 'tour-overlay';
    overlay.className = 'tour-overlay';
    document.body.appendChild(overlay);
    var bubble = document.createElement('div');
    bubble.id = 'tour-bubble';
    bubble.className = 'tour-bubble';
    document.body.appendChild(bubble);
    setTimeout(function() { overlay.classList.add('active'); }, 10);
    tourIndex = 0;
    showTourStep();
  }

  // Autostart na primeira visita (depois do render inicial)
  try {
    if (!localStorage.getItem('gv-tour-seen') && !hasSavedState) {
      setTimeout(startTour, 2500);
    }
  } catch (e) {}

  // Botao para reativar tour
  bindAction('start-tour', function() {
    try { localStorage.removeItem('gv-tour-seen'); } catch (e) {}
    startTour();
  });

  bindAction('resume-queue', function() {
    loadNextFromQueue();
  });

  function parseCsv(text) {
    var lines = text.replace(/\r/g, '').split('\n').filter(function(l) { return l.trim(); });
    if (lines.length < 2) return [];
    function splitLine(line) {
      var result = [];
      var cur = '';
      var inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === ',' && !inQ) {
          result.push(cur); cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur);
      return result;
    }
    var headers = splitLine(lines[0]).map(function(h) { return h.trim().toLowerCase(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = splitLine(lines[i]);
      var obj = {};
      for (var j = 0; j < headers.length; j++) obj[headers[j]] = (cols[j] || '').trim();
      rows.push(obj);
    }
    return rows;
  }

  function mapCsvRowToEmployee(row) {
    return {
      nomeCompleto: row.nome || row['nome completo'] || row.name || '',
      emailDesejado: row.email || row.username || row['e-mail'] || '',
      dataNascimento: row.nascimento || row['data nascimento'] || row['data_nascimento'] || '',
      cargo: row.cargo || row.position || '',
      departamento: (row.departamento || row.department || '').toLowerCase(),
      dataAdmissao: row.admissao || row['data admissao'] || row['data_admissao'] || ''
    };
  }

  function loadNextFromQueue() {
    var queue = App.storage.loadImportQueue();
    if (!queue.length) {
      App.showToast('Fila vazia', 'info');
      return;
    }
    var next = queue.shift();
    App.storage.saveImportQueue(queue);
    state.employee = mapCsvRowToEmployee(next);
    state.suggestedPassword = App.generatePassword(14);
    state.platforms = JSON.parse(JSON.stringify(defaultState.platforms));
    App.storage.save(state);
    App.showToast('Colaborador carregado. ' + queue.length + ' restante(s) na fila', 'success');
    navigateTo('form');
  }

  document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'csv-import-input') {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        try {
          var rows = parseCsv(ev.target.result);
          if (!rows.length) {
            App.showToast('CSV vazio ou invalido', 'error');
            return;
          }
          App.storage.saveImportQueue(rows);
          App.showToast(rows.length + ' colaboradores na fila. Iniciando...', 'success');
          setTimeout(loadNextFromQueue, 400);
        } catch (err) {
          App.showToast('Erro ao ler CSV: ' + err.message, 'error');
        }
      };
      reader.readAsText(file, 'utf-8');
    }
  });

  bindAction('refresh-logs', function() {
    loadAndRenderLogs();
  });

  bindAction('clear-logs', function() {
    if (!confirm('Limpar todos os logs?')) return;
    fetch('/api/logs/clear', { method: 'POST' }).then(function() {
      loadAndRenderLogs();
      App.showToast('Logs limpos', 'success');
    });
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
          App.showErrorModal(errors, function(fieldId) {
            var input = document.querySelector('[name="' + fieldId + '"]');
            if (input) {
              input.scrollIntoView({ behavior: 'smooth', block: 'center' });
              input.focus();
            }
          });
          return;
        }

        function proceed() {
          var submitBtn = document.getElementById('form-submit-btn');
          if (submitBtn) {
            submitBtn.disabled = true;
            var lbl = submitBtn.querySelector('.submit-label');
            var spn = submitBtn.querySelector('.submit-spinner');
            if (lbl) lbl.textContent = 'Processando...';
            if (spn) spn.style.display = 'inline-flex';
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
        }

        // B.2: validacao de username ProtonMail antes de prosseguir
        var usernameToCheck = (data.emailDesejado || '').trim();
        if (!usernameToCheck) { proceed(); return; }

        fetch('/api/check-username?username=' + encodeURIComponent(usernameToCheck))
          .then(function(r) { return r.json(); })
          .catch(function() { return { ok: true }; })
          .then(function(res) {
            if (res && res.ok === false) {
              App.showErrorModal(
                [{ field: 'E-mail desejado (usuário ProtonMail)', message: res.reason || 'Username invalido' }],
                function(fid) {
                  var inp = document.querySelector('[name="emailDesejado"]');
                  if (inp) { inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); inp.focus(); }
                }
              );
              return;
            }
            proceed();
          });
      });

      // Auto-gerar chips de variações ao digitar o nome (com debounce)
      var nameInput = form.querySelector('[name="nomeCompleto"]');
      var chipsDebounce = null;
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
        nameInput.addEventListener('input', function() {
          if (chipsDebounce) clearTimeout(chipsDebounce);
          chipsDebounce = setTimeout(updateEmailChips, 300);
        });
        // Preencher chips iniciais se o nome já existe
        updateEmailChips();
      }

      // === Preview de email ao vivo ===
      var emailInput = form.querySelector('[name="emailDesejado"]');
      var updateEmailPreview = function() {
        var previewEl = document.getElementById('email-preview-value');
        if (!previewEl || !emailInput) return;
        var val = emailInput.value.trim();
        previewEl.textContent = val || '...';
      };
      if (emailInput) {
        emailInput.addEventListener('input', updateEmailPreview);
        updateEmailPreview();
      }

      // === Validação inline em tempo real (no input, nao so blur) ===
      var applyValidation = function(input) {
        var fieldName = input.getAttribute('name');
        var value = input.value;
        var wrapper = input.closest('.field-wrapper');
        if (!wrapper || !fieldName) return;

        var iconSlot = wrapper.querySelector('.field-validity');
        input.classList.remove('field-valid', 'field-invalid');
        if (iconSlot) iconSlot.innerHTML = '';

        if (!value || value.trim() === '') return;

        var isValid = validateFieldVisual(fieldName, value);
        if (isValid) {
          input.classList.add('field-valid');
          if (iconSlot) {
            iconSlot.innerHTML = '<svg class="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
          }
        } else {
          input.classList.add('field-invalid');
          if (iconSlot) {
            iconSlot.innerHTML = '<svg class="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
          }
        }
      };

      var validationFields = form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="date"]');
      for (var vi = 0; vi < validationFields.length; vi++) {
        validationFields[vi].addEventListener('input', function() { applyValidation(this); });
        // Aplicar validacao inicial se ja tem valor
        if (validationFields[vi].value) applyValidation(validationFields[vi]);
      }

      // Auto-save debounced (3s) com indicador
      var draftDebounce = null;
      var saveDraftIndicator = function() {
        var ind = document.getElementById('draft-indicator');
        if (!ind) {
          ind = document.createElement('div');
          ind.id = 'draft-indicator';
          ind.className = 'fixed bottom-4 left-4 z-30 flex items-center gap-1.5 rounded-lg bg-dark-800/90 border border-brand-500/30 px-3 py-1.5 text-xs text-brand-400 backdrop-blur-sm shadow-lg';
          document.body.appendChild(ind);
        }
        var now = new Date();
        var h = String(now.getHours()).padStart(2, '0');
        var m = String(now.getMinutes()).padStart(2, '0');
        ind.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Rascunho salvo às ' + h + ':' + m;
        ind.style.opacity = '1';
        setTimeout(function() { if (ind) ind.style.opacity = '0.4'; }, 2500);
      };
      var scheduleDraftSave = function() {
        if (draftDebounce) clearTimeout(draftDebounce);
        draftDebounce = setTimeout(function() {
          var inputs = form.querySelectorAll('input, select');
          for (var j = 0; j < inputs.length; j++) {
            var name = inputs[j].getAttribute('name');
            if (name && state.employee.hasOwnProperty(name)) {
              state.employee[name] = inputs[j].value;
            }
          }
          App.storage.save(state);
          saveDraftIndicator();
        }, 3000);
      };
      var draftInputs = form.querySelectorAll('input, select');
      var undoDebounce = null;
      for (var di = 0; di < draftInputs.length; di++) {
        draftInputs[di].addEventListener('input', scheduleDraftSave);
        draftInputs[di].addEventListener('input', function() {
          if (undoDebounce) clearTimeout(undoDebounce);
          undoDebounce = setTimeout(pushFormUndo, 600);
        });
      }
      // Snapshot inicial para undo a partir do 1o estado
      formUndoStack = [captureFormSnapshot()];
      formRedoStack = [];

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

  // Iniciar poll de conectividade (delayed para nao atrasar startup)
  setTimeout(function() {
    if (App.startConnectivityPoll) App.startConnectivityPoll();
  }, 2000);

  // Renderizar connectivity badge apos cada render (se ja tiver estado)
  var origRender = render;
  // Nota: render e const local, nao posso reatribuir. Uso setInterval leve.
  setInterval(function() {
    if (App._connectivityState && App.renderConnectivityBadge) {
      App.renderConnectivityBadge();
    }
  }, 3000);
})();
