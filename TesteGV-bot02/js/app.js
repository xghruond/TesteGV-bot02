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

  // Estado da tela Twilio (não persistido — carregado ao entrar na tela)
  var twilioState = {
    status: null,
    ownedNumbers: [],
    searchResults: [],
    selectedCountry: 'US',
    selectedType: 'local',
    searching: false,
    searchDone: false
  };

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
      case 'telefone': var p = (value||'').trim(); return /^\+[1-9]\d{6,14}$/.test(p) || (p.replace(/\D/g,'').length >= 10 && p.replace(/\D/g,'').length <= 11);
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
    var phone = (data.telefone || '').trim();
    var isE164 = /^\+[1-9]\d{6,14}$/.test(phone);
    var phoneDigits = phone.replace(/\D/g, '');
    var isBR = phoneDigits.length >= 10 && phoneDigits.length <= 11;
    if (!isE164 && !isBR) {
      errors.push('Selecione um número Twilio válido clicando no campo de telefone.');
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
    twilio:           { scale: 1.10, y: '-12px',  brightness: 0.88, saturate: 1.0,  overlay: 1.08, vignette: 0.25, farOp: 0.35, farSc: 0.97, midOp: 0.15, midX: '30px',  nearOp: 0,    nearX: '40px', nearSc: 0.95 }
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
          '<button data-action="view-twilio" class="mt-3 w-full rounded-xl border border-dark-700/50 bg-dark-800/40 px-8 py-3.5 text-base font-medium text-dark-300 backdrop-blur-sm transition-all hover:bg-dark-800/60 hover:border-brand-500/30 hover:text-white">' +
            App.icons.phone + ' Configura\u00e7\u00e3o Twilio (SMS)</button>' +

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

    if (state.currentScreen === 'twilio') {
      header.innerHTML =
        '<div class="container mx-auto px-4 py-3 flex items-center">' +
          '<button data-action="back-welcome" onclick="App.navigateTo(\'welcome\')" class="flex items-center gap-1.5 rounded-xl border border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' +
            App.icons.chevronLeft + ' Voltar' +
          '</button>' +
        '</div>';
    } else if (state.currentScreen === 'welcome' || state.currentScreen === 'history' || state.currentScreen === 'history-detail') {
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
        case 'twilio':
          if (typeof App.renderTwilio !== 'function') {
            content.innerHTML = '<div class="p-8 text-center"><p class="text-amber-400 mb-4">Módulo Twilio não carregado.</p><button data-action="back-welcome" onclick="App.navigateTo(\'welcome\')" class="rounded-xl border border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' + App.icons.chevronLeft + ' Voltar</button></div>';
          } else {
            content.innerHTML = App.renderTwilio(twilioState);
          }
          if (!twilioState._loaded) { twilioState._loaded = true; loadTwilioStatus(); }
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
  // === Twilio — helpers de fetch                             ===
  // ============================================================

  function twilioFetch(path, options) {
    return App.twilioGetApiKey().then(function(key) {
      var opts = options || {};
      opts.headers = Object.assign({}, opts.headers || {});
      if (key) opts.headers['X-API-Key'] = key;
      return fetch(App.BACKEND_URL + path, opts).then(function(r) { return r.json(); });
    });
  }

  function loadTwilioStatus() {
    twilioFetch('/api/status').then(function(data) {
      twilioState.status = data;
      // Carregar números comprados se conectado
      if (data.connected) {
        twilioFetch('/api/numbers/owned').then(function(owned) {
          twilioState.ownedNumbers = owned.numbers || [];
          if (state.currentScreen === 'twilio') render();
        }).catch(function() {
          if (state.currentScreen === 'twilio') render();
        });
      } else {
        if (state.currentScreen === 'twilio') render();
      }
    }).catch(function() {
      twilioState.status = { connected: false, message: 'Backend não encontrado em ' + App.BACKEND_URL + '. Inicie com: cd backend && node server.js' };
      if (state.currentScreen === 'twilio') render();
    });
  }

  // ============================================================
  // === Modal: Selecionar número Twilio (campo telefone no form)===
  // ============================================================

  var SELECT_WARN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  function showTwilioSelectModal() {
    var old = document.getElementById('twilio-select-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'twilio-select-overlay';
    overlay.className = 'purchase-modal-overlay';

    function renderStep1() {
      overlay.innerHTML =
        '<div class="purchase-modal" role="dialog" aria-modal="true">' +
          '<div class="flex items-center gap-2 mb-6">' +
            '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">1</div>' +
            '<div class="h-px flex-1 bg-amber-500/40"></div>' +
            '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-dark-700 text-dark-500 text-xs font-bold">2</div>' +
            '<div class="h-px flex-1 bg-dark-700/40"></div>' +
            '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-dark-700 text-dark-500 text-xs font-bold">3</div>' +
          '</div>' +
          '<div class="flex flex-col items-center text-center mb-6">' +
            '<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 mb-4">' + SELECT_WARN_ICON + '</div>' +
            '<h3 class="text-xl font-bold text-dark-50 mb-1">Acesso Restrito</h3>' +
            '<p class="text-sm text-dark-400">Este recurso requer autenticação. Os números Twilio são pagos e estão vinculados à sua conta.</p>' +
          '</div>' +
          '<p class="text-sm text-center text-dark-300 mb-6">Deseja continuar e selecionar um número?</p>' +
          '<div class="flex gap-3">' +
            '<button id="ts-step1-no" class="flex-1 rounded-xl border border-dark-700 py-3 text-sm font-semibold text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">Não</button>' +
            '<button id="ts-step1-yes" class="flex-1 rounded-xl btn-gradient py-3 text-sm font-semibold text-white transition-all">Sim, continuar</button>' +
          '</div>' +
        '</div>';
      document.getElementById('ts-step1-no').addEventListener('click', function() { overlay.remove(); });
      document.getElementById('ts-step1-yes').addEventListener('click', function() { renderStep2(); });
    }

    function renderStep2() {
      var card = overlay.querySelector('.purchase-modal');
      card.innerHTML =
        '<div class="flex items-center gap-2 mb-6">' +
          '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-dark-700 text-dark-500 text-xs font-bold">1</div>' +
          '<div class="h-px flex-1 bg-dark-700/40"></div>' +
          '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold">2</div>' +
          '<div class="h-px flex-1 bg-brand-500/40"></div>' +
          '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-dark-700 text-dark-500 text-xs font-bold">3</div>' +
        '</div>' +
        '<div class="flex flex-col items-center text-center mb-6">' +
          '<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 mb-4">' + SELECT_WARN_ICON + '</div>' +
          '<h3 class="text-xl font-bold text-dark-50 mb-1">Senha de Acesso</h3>' +
          '<p class="text-sm text-dark-400">Digite a senha para acessar os números.</p>' +
        '</div>' +
        '<div class="relative mb-4">' +
          '<input id="ts-pw-input" type="password" placeholder="Digite a senha..." class="dark-input w-full rounded-xl py-3 px-4 pr-12 text-base focus:outline-none" />' +
          '<button id="ts-pw-eye" type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-200">' + App.icons.eye + '</button>' +
        '</div>' +
        '<p id="ts-pw-error" class="text-xs text-red-400 mb-4 hidden">Senha incorreta.</p>' +
        '<div class="flex gap-3">' +
          '<button id="ts-step2-back" class="rounded-xl border border-dark-700 px-4 py-3 text-sm font-semibold text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' + App.icons.chevronLeft + ' Voltar</button>' +
          '<button id="ts-step2-confirm" class="flex-1 rounded-xl btn-gradient py-3 text-sm font-semibold text-white transition-all">Confirmar</button>' +
        '</div>';

      var eyeToggled = false;
      document.getElementById('ts-pw-eye').addEventListener('click', function() {
        var inp = document.getElementById('ts-pw-input');
        eyeToggled = !eyeToggled;
        inp.type = eyeToggled ? 'text' : 'password';
      });
      document.getElementById('ts-step2-back').addEventListener('click', function() { renderStep1(); });
      document.getElementById('ts-step2-confirm').addEventListener('click', function() {
        var pw = document.getElementById('ts-pw-input').value;
        hashSHA256(pw).then(function(hash) {
          if (hash !== PURCHASE_PASSWORD_HASH) {
            document.getElementById('ts-pw-error').classList.remove('hidden');
            document.getElementById('ts-pw-input').classList.add('border-red-500/50');
            return;
          }
          renderStep3();
        });
      });
      document.getElementById('ts-pw-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('ts-step2-confirm').click();
      });
    }

    function renderStep3() {
      var card = overlay.querySelector('.purchase-modal');
      card.innerHTML =
        '<div class="flex items-center gap-2 mb-6">' +
          '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-dark-700 text-dark-500 text-xs font-bold">1</div>' +
          '<div class="h-px flex-1 bg-dark-700/40"></div>' +
          '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-dark-700 text-dark-500 text-xs font-bold">2</div>' +
          '<div class="h-px flex-1 bg-brand-500/40"></div>' +
          '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold">3</div>' +
        '</div>' +
        '<h3 class="text-lg font-bold text-dark-50 mb-4">Selecionar Número</h3>' +
        '<div id="ts-numbers-list" class="space-y-2 min-h-[80px] flex items-center justify-center">' +
          '<div class="h-2.5 w-2.5 rounded-full bg-brand-500 animate-pulse"></div>' +
          '<span class="text-sm text-dark-400 ml-2">Carregando números...</span>' +
        '</div>' +
        '<button id="ts-step3-back" class="mt-4 rounded-xl border border-dark-700 px-4 py-2.5 text-sm font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">' + App.icons.chevronLeft + ' Voltar</button>';

      document.getElementById('ts-step3-back').addEventListener('click', function() { renderStep2(); });

      twilioFetch('/api/numbers/owned').then(function(data) {
        var nums = data.numbers || [];
        var list = document.getElementById('ts-numbers-list');
        if (!list) return;
        if (nums.length === 0) {
          list.innerHTML = '<p class="text-sm text-dark-500 text-center py-4">Nenhum número encontrado. Compre um na tela Twilio.</p>';
          return;
        }
        list.className = 'space-y-2 max-h-60 overflow-y-auto';
        list.innerHTML = nums.map(function(n) {
          var isActive = n.phoneNumber === (twilioState.status && twilioState.status.phoneNumber);
          return '<div class="flex items-center gap-3 rounded-lg border border-dark-700/40 bg-dark-900/40 px-3 py-2.5">' +
            '<div class="flex-1 min-w-0">' +
              '<p class="text-sm font-mono font-semibold text-dark-100">' + App.escapeHtml(n.phoneNumber) + '</p>' +
              '<p class="text-xs text-dark-500">' + App.escapeHtml(n.friendlyName || '') + '</p>' +
            '</div>' +
            (isActive ? '<span class="text-xs text-green-400 font-semibold">Ativo</span>' : '') +
            '<button data-ts-phone="' + App.escapeHtml(n.phoneNumber) + '" class="ts-select-btn rounded-lg px-3 py-1.5 text-xs font-semibold btn-gradient text-white">Usar</button>' +
          '</div>';
        }).join('');

        list.querySelectorAll('.ts-select-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            state.employee.telefone = btn.getAttribute('data-ts-phone');
            App.storage.save(state);
            overlay.remove();
            render();
          });
        });
      }).catch(function() {
        var list = document.getElementById('ts-numbers-list');
        if (list) list.innerHTML = '<p class="text-sm text-red-400 text-center py-4">Backend não disponível. Inicie o servidor Twilio.</p>';
      });
    }

    document.body.appendChild(overlay);
    renderStep1();
  }

  // ============================================================
  // === Registro de handlers (delegados pelo listener global) ===
  // ============================================================

  bindAction('select-twilio-number', function() {
    showTwilioSelectModal();
  });

  bindAction('view-twilio', function() {
    twilioState.status = null;
    twilioState.searchResults = [];
    twilioState.searchDone = false;
    twilioState._loaded = false;
    navigateTo('twilio');
  });

  bindAction('twilio-search', function() {
    var countryEl = document.getElementById('twilio-country');
    var typeEl = document.getElementById('twilio-type');
    var country = countryEl ? countryEl.value : 'US';
    var type = typeEl ? typeEl.value : 'local';
    twilioState.selectedCountry = country;
    twilioState.selectedType = type;
    twilioState.searching = true;
    twilioState.searchResults = [];
    twilioState.searchDone = false;
    render();
    twilioFetch('/api/numbers/search?country=' + country + '&type=' + type + '&limit=10')
      .then(function(data) {
        twilioState.searching = false;
        twilioState.searchDone = true;
        twilioState.searchResults = data.numbers || [];
        render();
      })
      .catch(function(err) {
        twilioState.searching = false;
        twilioState.searchDone = true;
        App.showToast('Erro na busca: ' + err.message, 'error');
        render();
      });
  });

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

  var WARN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  var LOCK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

  function showPurchaseModal(phone, friendlyName, country, monthlyFee) {
    var old = document.getElementById('purchase-modal-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'purchase-modal-overlay';
    overlay.className = 'purchase-modal-overlay';

    // ── Tela 1: Aviso ──────────────────────────────────────
    function renderStep1() {
      overlay.innerHTML =
        '<div class="purchase-modal" role="dialog" aria-modal="true">' +

          // Indicador de passos
          '<div class="flex items-center gap-2 mb-6">' +
            '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">1</div>' +
            '<div class="h-px flex-1 bg-amber-500/40"></div>' +
            '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-dark-700 text-dark-500 text-xs font-bold">2</div>' +
          '</div>' +

          // Ícone + título
          '<div class="flex flex-col items-center text-center mb-6">' +
            '<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 mb-4">' +
              WARN_ICON +
            '</div>' +
            '<h3 class="text-xl font-bold text-dark-50 mb-1">Atenção!</h3>' +
            '<p class="text-sm text-dark-400">Este número gera cobrança recorrente</p>' +
          '</div>' +

          // Detalhes do número
          '<div class="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4 mb-6 space-y-2.5">' +
            '<div class="flex justify-between text-sm">' +
              '<span class="text-dark-400">Número</span>' +
              '<span class="font-mono font-semibold text-dark-100">' + App.escapeHtml(friendlyName || phone) + '</span>' +
            '</div>' +
            '<div class="flex justify-between text-sm">' +
              '<span class="text-dark-400">País</span>' +
              '<span class="font-medium text-dark-200">' + App.escapeHtml(country) + '</span>' +
            '</div>' +
            '<div class="flex justify-between text-sm">' +
              '<span class="text-dark-400">Custo mensal</span>' +
              '<span class="font-bold text-amber-400">' + App.escapeHtml(monthlyFee || '~$1.00') + ' / mês</span>' +
            '</div>' +
            '<div class="pt-2 border-t border-amber-500/20 text-xs text-amber-300/75 leading-relaxed">' +
              '⚠️ O valor será debitado da sua conta Twilio todos os meses até o número ser liberado manualmente.' +
            '</div>' +
          '</div>' +

          // Pergunta central
          '<p class="text-center text-base font-semibold text-dark-100 mb-6">' +
            'Deseja continuar com essa compra?' +
          '</p>' +

          // Botões
          '<div class="flex gap-3">' +
            '<button id="pm-step1-no"  class="flex-1 rounded-xl border border-dark-600 py-3.5 text-sm font-bold text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">Não</button>' +
            '<button id="pm-step1-yes" class="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 py-3.5 text-sm font-bold text-white transition-colors">Sim, continuar</button>' +
          '</div>' +

        '</div>';

      document.getElementById('pm-step1-no').addEventListener('click', function() { overlay.remove(); });
      document.getElementById('pm-step1-yes').addEventListener('click', function() { renderStep2(); });
      overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    }

    // ── Tela 2: Senha ──────────────────────────────────────
    function renderStep2() {
      var card = overlay.querySelector('.purchase-modal');
      card.style.animation = 'slideUpModal 0.25s cubic-bezier(0.22, 1, 0.36, 1)';

      card.innerHTML =
        // Indicador de passos
        '<div class="flex items-center gap-2 mb-6">' +
          '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-dark-700 text-dark-500 text-xs font-bold">1</div>' +
          '<div class="h-px flex-1 bg-brand-500/40"></div>' +
          '<div class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold">2</div>' +
        '</div>' +

        // Ícone + título
        '<div class="flex flex-col items-center text-center mb-6">' +
          '<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 mb-4">' +
            LOCK_ICON +
          '</div>' +
          '<h3 class="text-xl font-bold text-dark-50 mb-1">Autorização necessária</h3>' +
          '<p class="text-sm text-dark-400">Digite a senha para confirmar a compra</p>' +
        '</div>' +

        // Campo de senha
        '<div class="mb-6">' +
          '<label class="mb-2 block text-sm font-medium text-dark-200">Senha de autorização</label>' +
          '<div class="relative">' +
            '<input id="purchase-password-input" type="password" autocomplete="off" ' +
              'placeholder="Digite a senha de autorização" ' +
              'class="dark-input block w-full rounded-xl py-3 pl-4 pr-12 text-base focus:outline-none" />' +
            '<button type="button" id="purchase-pw-toggle" tabindex="-1" class="password-toggle">' +
              App.icons.eye +
            '</button>' +
          '</div>' +
          '<p id="purchase-pw-error" class="mt-1.5 text-xs text-red-400 hidden">Senha incorreta. Tente novamente.</p>' +
        '</div>' +

        // Botões
        '<div class="flex gap-3">' +
          '<button id="pm-step2-back"    class="flex-1 rounded-xl border border-dark-600 py-3.5 text-sm font-bold text-dark-300 hover:bg-dark-800 hover:text-white transition-colors">← Voltar</button>' +
          '<button id="pm-step2-confirm" class="flex-1 rounded-xl bg-brand-500 hover:bg-brand-600 py-3.5 text-sm font-bold text-white transition-colors">Confirmar Compra</button>' +
        '</div>';

      // Foco automático
      setTimeout(function() {
        var inp = document.getElementById('purchase-password-input');
        if (inp) inp.focus();
      }, 60);

      // Toggle olho
      document.getElementById('purchase-pw-toggle').addEventListener('click', function() {
        var inp = document.getElementById('purchase-password-input');
        if (!inp) return;
        if (inp.type === 'password') { inp.type = 'text'; this.innerHTML = App.icons.eyeOff; }
        else                         { inp.type = 'password'; this.innerHTML = App.icons.eye; }
      });

      // Voltar
      document.getElementById('pm-step2-back').addEventListener('click', function() { renderStep1(); });

      // Confirmar
      function doConfirm() {
        var inp    = document.getElementById('purchase-password-input');
        var errEl  = document.getElementById('purchase-pw-error');
        var btn    = document.getElementById('pm-step2-confirm');
        var pw     = inp ? inp.value : '';
        if (!pw) { errEl.classList.remove('hidden'); inp.focus(); return; }

        btn.disabled    = true;
        btn.textContent = 'Verificando...';

        hashSHA256(pw).then(function(hash) {
          if (hash !== PURCHASE_PASSWORD_HASH) {
            errEl.classList.remove('hidden');
            inp.value       = '';
            inp.focus();
            btn.disabled    = false;
            btn.textContent = 'Confirmar Compra';
            return;
          }
          errEl.classList.add('hidden');
          btn.textContent = 'Comprando...';
          App.showToast('Comprando ' + phone + '...', 'info');

          twilioFetch('/api/numbers/purchase', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ phoneNumber: phone })
          }).then(function(data) {
            overlay.remove();
            if (data.error) { App.showToast('Erro: ' + data.error, 'error'); return; }
            App.showToast(data.message, 'success');
            twilioState.searchResults = [];
            twilioState.searchDone    = false;
            loadTwilioStatus();
          }).catch(function() {
            overlay.remove();
            App.showToast('Erro ao comprar número.', 'error');
          });
        });
      }

      document.getElementById('pm-step2-confirm').addEventListener('click', doConfirm);
      document.getElementById('purchase-password-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  doConfirm();
        if (e.key === 'Escape') overlay.remove();
      });
    }

    // Inicia na tela 1
    document.body.appendChild(overlay);
    renderStep1();
  }

  bindAction('twilio-purchase', function(e, el) {
    var phone       = el.getAttribute('data-phone');
    var friendly    = el.getAttribute('data-friendly') || phone;
    var country     = el.getAttribute('data-country') || '';
    var fee         = el.getAttribute('data-fee') || '~$1.00';
    if (!phone) return;
    showPurchaseModal(phone, friendly, country, fee);
  });

  bindAction('twilio-set-active', function(e, el) {
    var phone = el.getAttribute('data-phone');
    if (!phone) return;
    twilioFetch('/api/numbers/set-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone })
    }).then(function(data) {
      if (data.error) { App.showToast('Erro: ' + data.error, 'error'); return; }
      twilioState.status.phoneNumber = phone;
      App.showToast('Número ativo atualizado para ' + phone, 'success');
      render();
    }).catch(function() { App.showToast('Erro ao atualizar número ativo', 'error'); });
  });

  bindAction('twilio-release-number', function(e, el) {
    var sid = el.getAttribute('data-sid');
    var phone = el.getAttribute('data-phone');
    if (!sid) return;
    if (!confirm('Liberar o número ' + phone + '?\nVocê deixará de ser cobrado por ele, mas não poderá recuperá-lo.')) return;
    twilioFetch('/api/numbers/' + sid, { method: 'DELETE' })
      .then(function(data) {
        if (data.error) { App.showToast('Erro: ' + data.error, 'error'); return; }
        App.showToast('Número ' + phone + ' liberado', 'info');
        loadTwilioStatus();
      })
      .catch(function() { App.showToast('Erro ao liberar número', 'error'); });
  });

  bindAction('send-sms-credentials', function() {
    // Usa o número real do funcionário cadastrado no formulário
    var digits = state.employee.telefone ? state.employee.telefone.replace(/\D/g, '') : '';
    var dest = digits ? '+55' + digits : '';

    // Se o número não estiver preenchido, pede ao usuário
    if (!dest) {
      dest = prompt('Número do funcionário não encontrado.\nDigite manualmente (ex: +5511999999999):');
      if (!dest) return;
    } else {
      if (!confirm('Enviar SMS com as credenciais para ' + dest + '?')) return;
    }

    var completedPlatforms = Object.keys(state.platforms)
      .filter(function(id) { return state.platforms[id].completed; })
      .map(function(id) {
        return { name: App.platforms[id].name, username: state.employee.emailDesejado };
      });

    App.showToast('Enviando SMS...', 'info');
    twilioFetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: dest,
        employeeName: state.employee.nomeCompleto,
        email: state.employee.emailDesejado,
        password: state.suggestedPassword || '',
        platforms: completedPlatforms
      })
    }).then(function(data) {
      if (data.error) { App.showToast('Erro: ' + data.error, 'error'); return; }
      App.showToast('SMS enviado para ' + dest + '!', 'success');
    }).catch(function() {
      App.showToast('Backend n\u00e3o encontrado. Inicie o servidor primeiro.', 'error');
    });
  });

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

    // telefone não é preenchido automaticamente — deve ser o número real
    // do funcionário para receber SMS via Twilio
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

  // Imprimir
  bindAction('print', function() {
    window.print();
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

    App.showToast(platformName + ' concluída!', 'success');

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

      // Máscara de telefone
      var phoneInput = form.querySelector('[name="telefone"]');
      if (phoneInput) {
        function applyPhoneMask(input) {
          var value = input.value.replace(/\D/g, '');
          if (value.length > 11) value = value.slice(0, 11);
          if (value.length > 6) {
            value = '(' + value.slice(0, 2) + ') ' + value.slice(2, 7) + '-' + value.slice(7);
          } else if (value.length > 2) {
            value = '(' + value.slice(0, 2) + ') ' + value.slice(2);
          } else if (value.length > 0) {
            value = '(' + value;
          }
          input.value = value;
        }
        phoneInput.addEventListener('input', function(e) { applyPhoneMask(e.target); });
        phoneInput.addEventListener('paste', function(e) {
          e.preventDefault();
          var pasted = (e.clipboardData || window.clipboardData).getData('text');
          e.target.value = pasted;
          applyPhoneMask(e.target);
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
        setTimeout(function() { splash.style.display = 'none'; }, 900);
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
