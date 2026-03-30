var App = App || {};

// Separa nome completo em primeiro nome e sobrenome
App.splitName = function(fullName) {
  if (!fullName) return { first: '', last: '' };
  var parts = fullName.trim().split(/\s+/);
  return {
    first: parts[0] || '',
    last: parts.length > 1 ? parts.slice(1).join(' ') : ''
  };
};

App.escapeHtml = function(text) {
  if (!text) return '';
  var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
};

App.formatDateBR = function(isoString) {
  if (!isoString || !/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return '-';
  var parts = isoString.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
};

App.formatDateTimeBR = function(isoString) {
  if (!isoString) return '-';
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return ('0' + d.getDate()).slice(-2) + '/' +
    ('0' + (d.getMonth() + 1)).slice(-2) + '/' +
    d.getFullYear() + ' ' +
    ('0' + d.getHours()).slice(-2) + ':' +
    ('0' + d.getMinutes()).slice(-2);
};

// === Utilidades de automação ===

App.removeAccents = function(str) {
  var accents = {
    'a': /[\u00e0\u00e1\u00e2\u00e3\u00e4]/g,
    'e': /[\u00e8\u00e9\u00ea\u00eb]/g,
    'i': /[\u00ec\u00ed\u00ee\u00ef]/g,
    'o': /[\u00f2\u00f3\u00f4\u00f5\u00f6]/g,
    'u': /[\u00f9\u00fa\u00fb\u00fc]/g,
    'c': /[\u00e7]/g,
    'n': /[\u00f1]/g
  };
  var result = str.toLowerCase();
  for (var letter in accents) {
    if (accents.hasOwnProperty(letter)) {
      result = result.replace(accents[letter], letter);
    }
  }
  return result;
};

App.generateEmailFromName = function(fullName) {
  if (!fullName || fullName.trim().length < 3) return '';
  var prepositions = ['da', 'de', 'do', 'das', 'dos', 'e'];
  var parts = fullName.trim().split(/\s+/).filter(function(word) {
    return prepositions.indexOf(word.toLowerCase()) === -1;
  });
  if (parts.length === 0) return '';
  var clean = parts.map(function(p) {
    return App.removeAccents(p).replace(/[^a-z0-9]/g, '');
  }).filter(function(p) { return p.length > 0; });
  return clean.join('.');
};

App._nicknameMap = {
  'joao': ['jota', 'jj'], 'jose': ['ze', 'zeze'], 'antonio': ['toninho', 'toni'],
  'francisco': ['chico', 'francis'], 'carlos': ['carlao', 'cacau'], 'paulo': ['paulinho', 'paul'],
  'pedro': ['pedrinho', 'pedrao'], 'lucas': ['luc', 'luck'], 'luiz': ['luis', 'lulu'],
  'marcos': ['marcao', 'marc'], 'gabriel': ['gabi', 'gab'], 'rafael': ['rafa', 'raf'],
  'daniel': ['dani', 'dan'], 'rodrigo': ['rod', 'digao'], 'bruno': ['bru', 'bruninho'],
  'eduardo': ['edu', 'dudu'], 'felipe': ['lipe', 'phil'], 'gustavo': ['gus', 'guga'],
  'andre': ['dede', 'drew'], 'fernando': ['fer', 'nando'], 'ricardo': ['rick', 'rica'],
  'matheus': ['mat', 'math'], 'leonardo': ['leo', 'leon'], 'henrique': ['rick', 'henri'],
  'marcelo': ['cel', 'celo'], 'vinicius': ['vini', 'vin'], 'thiago': ['thi', 'thig'],
  'diego': ['dieguinho', 'dg'], 'alexandre': ['alex', 'xande'], 'roberto': ['beto', 'rob'],
  'maria': ['mari', 'mah'], 'ana': ['aninha', 'ani'], 'juliana': ['ju', 'juju'],
  'patricia': ['pat', 'paty'], 'fernanda': ['fer', 'nanda'], 'amanda': ['manda', 'mandy'],
  'bruna': ['bru', 'bruninha'], 'camila': ['cami', 'cam'], 'carolina': ['carol', 'lina'],
  'gabriela': ['gabi', 'gab'], 'isabela': ['isa', 'bela'], 'larissa': ['lari', 'lala'],
  'leticia': ['leti', 'lets'], 'mariana': ['mari', 'mah'], 'natalia': ['nat', 'nati'],
  'rafaela': ['rafa', 'raf'], 'tatiana': ['tati', 'tat'], 'vanessa': ['van', 'nessa'],
  'beatriz': ['bia', 'bea'], 'jessica': ['jess', 'jeh'], 'aline': ['ali', 'line'],
  'renata': ['re', 'renatinha'], 'priscila': ['pri', 'pris'], 'luana': ['lu', 'lua'],
  'vitoria': ['vic', 'vivi'], 'bianca': ['bia', 'bianquinha'], 'clara': ['clarinha', 'cla'],
  'sandra': ['san', 'sandy'], 'monica': ['mon', 'moni'], 'simone': ['si', 'mone'],
  'adriana': ['adri', 'dri'], 'luciana': ['lu', 'luci'], 'cristina': ['cris', 'tina']
};

App.generateEmailVariations = function(fullName) {
  if (!fullName || fullName.trim().length < 3) return [];
  var prepositions = ['da', 'de', 'do', 'das', 'dos', 'e'];
  var parts = fullName.trim().split(/\s+/).filter(function(w) {
    return prepositions.indexOf(w.toLowerCase()) === -1;
  });
  if (parts.length === 0) return [];
  var clean = parts.map(function(p) {
    return App.removeAccents(p).replace(/[^a-z0-9]/g, '');
  }).filter(function(p) { return p.length > 0; });
  if (clean.length === 0) return [];

  var f = clean[0];
  var l = clean.length > 1 ? clean[clean.length - 1] : '';
  var mid = clean.length > 2 ? clean.slice(1, -1) : [];
  var initials = clean.map(function(c) { return c[0]; }).join('');
  var yr = new Date().getFullYear().toString().slice(-2);
  var rnd = Math.floor(Math.random() * 90 + 10);
  var nicks = App._nicknameMap[f] || [];
  var nick = nicks.length > 0 ? nicks[0] : '';
  var nick2 = nicks.length > 1 ? nicks[1] : '';
  // Diminutivo automático se não tem no mapa
  var dim = '';
  if (!nick) {
    if (f.length > 3) dim = f.slice(0, -1) + 'inho';
    if (f[f.length - 1] === 'a' && f.length > 3) dim = f.slice(0, -1) + 'inha';
  }
  // Primeiras 3 letras
  var f3 = f.length > 3 ? f.slice(0, 3) : f;

  var variations = [];
  var seen = {};
  function add(v) {
    v = v.replace(/[^a-z0-9._-]/g, '');
    if (v && !seen[v] && v.length >= 3) { seen[v] = true; variations.push(v); }
  }

  // ── Clássico ──
  add(f + '.' + l);                                   // joao.silva
  add(f + l);                                         // joaosilva
  add(f + '_' + l);                                   // joao_silva
  add(l + '.' + f);                                   // silva.joao

  // ── Iniciais e abreviações ──
  if (l) {
    add(f[0] + '.' + l);                             // j.silva
    add(f[0] + l);                                   // jsilva
    add(f + '.' + l[0]);                             // joao.s
    add(l + '.' + f[0]);                             // silva.j
  }
  if (initials.length >= 2) {
    add(initials + '.' + l);                         // jms.silva
  }

  // ── Apelidos brasileiros ──
  if (nick) {
    add(nick + '.' + l);                             // jota.silva
    add(nick + l);                                   // jotasilva
    add(nick + yr);                                  // jota26
    if (l) add(nick + '.' + l[0]);                   // jota.s
  }
  if (nick2) {
    add(nick2 + '.' + l);                            // jj.silva
    add(nick2 + l);                                  // jjsilva
  }
  if (dim) {
    add(dim + '.' + l);                              // joaozinho.silva
    add(dim);                                        // joaozinho
  }

  // ── Truncado (3 letras) ──
  if (l) {
    add(f3 + '.' + l);                               // joa.silva
    add(f + '.' + l.slice(0, 3));                    // joao.sil
    add(f3 + l.slice(0, 3));                         // joasil
  }

  // ── Nome do meio ──
  if (mid.length > 0) {
    add(f + '.' + mid[0] + '.' + l);                 // joao.maria.silva
    add(f + '.' + mid[0][0] + '.' + l);             // joao.m.silva
    add(mid[0] + '.' + l);                           // maria.silva
    add(f + '.' + mid[0]);                           // joao.maria
  }

  // ── Com números ──
  add(f + '.' + l + yr);                             // joao.silva26
  add(f + '.' + l + '01');                           // joao.silva01
  add(f + l + rnd);                                  // joaosilva47
  add(f + yr);                                       // joao26
  add(l + '.' + f + yr);                             // silva.joao26

  // ── Corporativo ──
  add(f + '.gv');                                     // joao.gv
  add(f + '.' + l + '.gv');                           // joao.silva.gv
  add('gv.' + f + '.' + l);                          // gv.joao.silva
  add(f + '.greenvillage');                           // joao.greenvillage

  // ── Letras dobradas / estilo redes sociais ──
  add(f + f[f.length - 1] + '.' + l);               // joaoo.silva (dobra última)
  if (l) add('o' + f + '.' + l);                    // ojoao.silva
  add(f + '.oficial');                               // joao.oficial
  add('eu' + f + l);                                 // eujoaosilva
  add('sou' + f + l);                               // soujoaosilva
  add(f + '.' + l + '.real');                        // joao.silva.real

  // ── Só primeiro nome (sem sobrenome) ──
  if (!l) {
    add(f + '.oficial');
    add(f + '.pro');
    add(f + '.work');
    add(f + '.' + rnd);
    if (nick) add(nick);
    if (dim) add(dim);
  }

  return variations;
};

App.copyToClipboard = function(text, buttonEl) {
  // Fallback para file:// protocol
  var textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  document.body.removeChild(textarea);
  // Feedback visual
  if (buttonEl) {
    var original = buttonEl.innerHTML;
    buttonEl.innerHTML = App.icons.check + ' Copiado!';
    buttonEl.classList.add('text-green-600');
    setTimeout(function() {
      buttonEl.innerHTML = original;
      buttonEl.classList.remove('text-green-600');
    }, 2000);
  }
};

App.generatePassword = function(length) {
  length = length || 14;
  var upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var lower = 'abcdefghijklmnopqrstuvwxyz';
  var digits = '0123456789';
  var symbols = '!@#$%&*?';
  var all = upper + lower + digits + symbols;
  var array = new Uint32Array(length);
  crypto.getRandomValues(array);
  var password = [
    upper[array[0] % upper.length],
    lower[array[1] % lower.length],
    digits[array[2] % digits.length],
    symbols[array[3] % symbols.length]
  ];
  for (var i = 4; i < length; i++) {
    password.push(all[array[i] % all.length]);
  }
  for (var j = password.length - 1; j > 0; j--) {
    var k = array[j % array.length] % (j + 1);
    var tmp = password[j];
    password[j] = password[k];
    password[k] = tmp;
  }
  return password.join('');
};

App.suggestAccountInfo = function(platformId, emailDesejado) {
  if (!emailDesejado) return '';
  switch (platformId) {
    case 'gmail': return emailDesejado + '@gmail.com';
    case 'instagram': return '@' + emailDesejado;
    case 'facebook': return 'facebook.com/' + emailDesejado;
    case 'tiktok': return '@' + emailDesejado;
    default: return '';
  }
};

App.formatElapsedTime = function(startIso) {
  if (!startIso) return '0min 00s';
  var elapsed = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  if (elapsed < 0) elapsed = 0;
  var mins = Math.floor(elapsed / 60);
  var secs = elapsed % 60;
  return mins + 'min ' + ('0' + secs).slice(-2) + 's';
};

App.generateSummaryText = function(state) {
  var deptLabel = App.departmentLabels[state.employee.departamento] || state.employee.departamento || '-';
  var email = (state.employee.emailDesejado || '-') + '@gmail.com';
  var username = '@' + (state.employee.emailDesejado || '-');
  var senha = state.suggestedPassword || '-';
  var lines = [
    '=== RELATORIO DE ONBOARDING ===',
    '',
    'DADOS DO FUNCIONARIO',
    'Nome: ' + (state.employee.nomeCompleto || '-'),
    'Email: ' + email,
    'Telefone: ' + (state.employee.telefone || '-'),
    'Data de Nascimento: ' + App.formatDateBR(state.employee.dataNascimento),
    'Cargo: ' + (state.employee.cargo || '-'),
    'Departamento: ' + deptLabel,
    'Data de Admissao: ' + App.formatDateBR(state.employee.dataAdmissao),
    '',
    'CREDENCIAIS DAS CONTAS',
    '---',
    'Gmail (Google)',
    '  Email: ' + email,
    '  Senha: ' + senha,
    '---',
    'Instagram',
    '  Username: ' + username,
    '  Email de cadastro: ' + email,
    '  Senha: ' + senha,
    '---',
    'Facebook',
    '  Conta: ' + (state.platforms.facebook.accountInfo || '-'),
    '  Email de cadastro: ' + email,
    '  Senha: ' + senha,
    '---',
    'TikTok',
    '  Username: ' + username,
    '  Email de cadastro: ' + email,
    '  Senha: ' + senha,
    '',
    'STATUS'
  ];
  Object.keys(App.platforms).forEach(function(id) {
    var p = App.platforms[id];
    var s = state.platforms[id];
    lines.push(p.name + ': ' + (s.completed ? 'Criada' : 'Pendente'));
  });
  lines.push('');
  lines.push('Inicio: ' + App.formatDateTimeBR(state.startedAt));
  lines.push('Conclusao: ' + App.formatDateTimeBR(state.completedAt));
  lines.push('');
  lines.push('=== FIM DO RELATORIO ===');
  return lines.join('\n');
};

App.icons = {
  user: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  mail: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  phone: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
  briefcase: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  building: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>',
  'calendar-check': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  chevronLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  externalLink: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>',
  printer: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>',
  refresh: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
  clipboard: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
  sparkles: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
  listChecks: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  key: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>',
  robot: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/><path d="M9 21v1"/><path d="M15 21v1"/></svg>',
  robotSmall: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="8" y1="16" x2="8" y2="16.01"/><line x1="16" y1="16" x2="16" y2="16.01"/></svg>',
  arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
};

App.platforms = {
  gmail: {
    id: 'gmail',
    name: 'Gmail (Google)',
    description: 'Conta de e-mail profissional do Google',
    registerUrl: 'https://accounts.google.com/signup',
    color: {
      bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700',
      accent: 'bg-red-500', hover: 'hover:border-red-400', light: 'bg-red-100', icon: '#EA4335'
    },
    icon: '<svg viewBox="0 0 24 24" fill="none" class="w-8 h-8"><path d="M20 18H18V9.25L12 13L6 9.25V18H4V6H5.2L12 10.8L18.8 6H20V18Z" fill="currentColor"/><path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4Z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
    steps: [
      {
        title: 'Abra a página de criação de conta do Google',
        description: 'Clique no botão <strong>"Abrir Página de Cadastro"</strong> abaixo. Uma nova aba vai abrir com o formulário do Google para criar sua conta de e-mail.',
        tip: 'Use o navegador Google Chrome para melhor experiência.',
        action: 'open_register'
      },
      {
        title: 'Preencha seu nome e sobrenome',
        description: 'Na página do Google, você verá dois campos:<br><br><li class="ml-4"><strong>Nome</strong>: Digite seu primeiro nome</li><li class="ml-4"><strong>Sobrenome</strong>: Digite seu sobrenome</li><br>Depois clique em "Próxima".',
        tip: 'Use seu nome completo como está registrado no RH da empresa.'
      },
      {
        title: 'Informe sua data de nascimento e gênero',
        description: 'Preencha:<br><br><li class="ml-4"><strong>Dia, Mês e Ano</strong> do seu nascimento</li><li class="ml-4"><strong>Gênero</strong>: Selecione uma opção</li><br>Depois clique em "Próxima".',
        tip: 'Essas informações são necessárias pelo Google e ficam privadas.'
      },
      {
        title: 'Escolha seu endereço de e-mail',
        description: 'O Google vai sugerir opções de e-mail ou você pode criar o seu próprio.<br><br><li class="ml-4">Selecione <strong>"Criar seu próprio endereço do Gmail"</strong></li><li class="ml-4">Digite o e-mail que deseja (ex: seunome.empresa@gmail.com)</li><br>Depois clique em "Próxima".',
        tip: 'Se o e-mail já existir, tente adicionar números ou pontos. Ex: joao.silva2@gmail.com'
      },
      {
        title: 'Crie uma senha segura',
        description: 'Digite uma senha forte nos dois campos:<br><br><li class="ml-4"><strong>Senha</strong>: Mínimo 8 caracteres, com letras e números</li><li class="ml-4"><strong>Confirmar</strong>: Digite a mesma senha novamente</li><br>Depois clique em "Próxima".',
        tip: 'Anote sua senha em um lugar seguro! Use letras maiúsculas, minúsculas, números e símbolos.'
      },
      {
        title: 'Adicione um telefone e finalize',
        description: 'O Google pode pedir:<br><br><li class="ml-4"><strong>Número de telefone</strong> para recuperação (recomendado)</li><li class="ml-4"><strong>E-mail de recuperação</strong> (pode pular)</li><br>Revise seus dados e clique em <strong>"Concordo"</strong> nos termos de uso.<br><br><strong>Parabéns! Sua conta Gmail foi criada!</strong>',
        tip: 'Adicionar telefone ajuda a recuperar a conta caso esqueça a senha.',
        action: 'finish'
      }
    ]
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    description: 'Rede social de fotos e vídeos',
    registerUrl: 'https://www.instagram.com/accounts/emailsignup/',
    color: {
      bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700',
      accent: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
      hover: 'hover:border-pink-400', light: 'bg-pink-100', icon: '#E4405F'
    },
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    steps: [
      {
        title: 'Abra a página de cadastro do Instagram',
        description: 'Clique no botão <strong>"Abrir Página de Cadastro"</strong> abaixo. A página do Instagram vai abrir em uma nova aba.',
        tip: 'Você pode criar a conta pelo computador ou pelo celular.',
        action: 'open_register'
      },
      {
        title: 'Preencha seus dados básicos',
        description: 'Na página de cadastro, preencha:<br><br><li class="ml-4"><strong>E-mail ou telefone</strong>: Use o Gmail que você acabou de criar</li><li class="ml-4"><strong>Nome completo</strong>: Seu nome como deseja que apareça</li><li class="ml-4"><strong>Nome de usuário</strong>: Escolha um nome único (ex: joao.silva.empresa)</li><li class="ml-4"><strong>Senha</strong>: Crie uma senha forte</li><br>Depois clique em <strong>"Cadastre-se"</strong>.',
        tip: 'O nome de usuário não pode ter espaços. Use pontos ou underlines. Ex: joao_silva'
      },
      {
        title: 'Confirme sua data de nascimento',
        description: 'O Instagram vai pedir sua data de nascimento.<br><br><li class="ml-4">Selecione o <strong>dia</strong>, <strong>mês</strong> e <strong>ano</strong></li><li class="ml-4">Clique em <strong>"Avançar"</strong></li><br>Você precisa ter pelo menos 13 anos.',
        tip: 'Essa informação é privada e não aparece no seu perfil.'
      },
      {
        title: 'Confirme seu e-mail',
        description: 'O Instagram enviou um código de confirmação para seu e-mail.<br><br><li class="ml-4">Abra seu <strong>Gmail</strong> (que você acabou de criar)</li><li class="ml-4">Procure o e-mail do Instagram</li><li class="ml-4">Copie o <strong>código de 6 dígitos</strong></li><li class="ml-4">Cole na página do Instagram e clique em <strong>"Avançar"</strong></li>',
        tip: 'Se não encontrar o e-mail, verifique a pasta "Spam" ou "Promoções" no Gmail.'
      },
      {
        title: 'Finalize a configuração do perfil',
        description: 'Agora o Instagram vai sugerir:<br><br><li class="ml-4"><strong>Foto de perfil</strong>: Pode adicionar agora ou pular</li><li class="ml-4"><strong>Seguir pessoas</strong>: Pode pular por enquanto</li><li class="ml-4"><strong>Ativar notificações</strong>: Escolha sua preferência</li><br><strong>Parabéns! Sua conta do Instagram foi criada!</strong>',
        tip: 'Você pode configurar tudo isso depois com calma.',
        action: 'finish'
      }
    ]
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    description: 'Rede social para conectar com pessoas',
    registerUrl: 'https://www.facebook.com/r.php',
    color: {
      bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
      accent: 'bg-blue-600', hover: 'hover:border-blue-400', light: 'bg-blue-100', icon: '#1877F2'
    },
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    steps: [
      {
        title: 'Abra a página de cadastro do Facebook',
        description: 'Clique no botão <strong>"Abrir Página de Cadastro"</strong> abaixo. A página do Facebook vai abrir em uma nova aba.',
        tip: 'O Facebook funciona melhor no Google Chrome ou Firefox.',
        action: 'open_register'
      },
      {
        title: 'Preencha o formulário de cadastro',
        description: 'Na página do Facebook, preencha todos os campos:<br><br><li class="ml-4"><strong>Nome e Sobrenome</strong>: Seu nome real</li><li class="ml-4"><strong>E-mail ou telefone</strong>: Use o Gmail que você criou</li><li class="ml-4"><strong>Nova senha</strong>: Crie uma senha forte</li><li class="ml-4"><strong>Data de nascimento</strong>: Selecione dia, mês e ano</li><li class="ml-4"><strong>Gênero</strong>: Selecione uma opção</li><br>Depois clique em <strong>"Cadastre-se"</strong>.',
        tip: 'Use o mesmo e-mail Gmail que foi criado no passo anterior.'
      },
      {
        title: 'Confirme seu e-mail',
        description: 'O Facebook enviou um código de confirmação para seu e-mail.<br><br><li class="ml-4">Abra seu <strong>Gmail</strong></li><li class="ml-4">Procure o e-mail do Facebook</li><li class="ml-4">Clique no link de confirmação ou copie o código</li><li class="ml-4">Volte ao Facebook e confirme</li>',
        tip: 'Se não encontrar o e-mail, verifique a pasta "Spam" no Gmail.'
      },
      {
        title: 'Finalize a configuração do perfil',
        description: 'O Facebook vai sugerir algumas configurações:<br><br><li class="ml-4"><strong>Foto de perfil</strong>: Pode adicionar ou pular</li><li class="ml-4"><strong>Encontrar amigos</strong>: Pode pular por enquanto</li><li class="ml-4"><strong>Informações do perfil</strong>: Pode preencher depois</li><br><strong>Parabéns! Sua conta do Facebook foi criada!</strong>',
        tip: 'Você pode personalizar tudo depois nas configurações do perfil.',
        action: 'finish'
      }
    ]
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    description: 'Plataforma de vídeos curtos',
    registerUrl: 'https://www.tiktok.com/signup',
    color: {
      bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-900',
      accent: 'bg-black', hover: 'hover:border-gray-500', light: 'bg-gray-200', icon: '#000000'
    },
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.43v-7.15a8.16 8.16 0 005.58 2.2v-3.4a4.85 4.85 0 01-1.59-.27 4.83 4.83 0 01-1.59-1.02V6.69h3.18z"/></svg>',
    steps: [
      {
        title: 'Abra a página de cadastro do TikTok',
        description: 'Clique no botão <strong>"Abrir Página de Cadastro"</strong> abaixo. A página do TikTok vai abrir em uma nova aba.',
        tip: 'Você também pode criar a conta baixando o app TikTok no celular.',
        action: 'open_register'
      },
      {
        title: 'Escolha o método de cadastro',
        description: 'Na página do TikTok, você verá várias opções para se cadastrar:<br><br><li class="ml-4"><strong>Usar e-mail ou telefone</strong> (recomendado)</li><li class="ml-4">Google, Facebook, etc.</li><br>Clique em <strong>"Usar e-mail ou telefone"</strong>.',
        tip: 'Usar e-mail é a opção mais simples e segura.'
      },
      {
        title: 'Preencha sua data de nascimento',
        description: 'O TikTok vai pedir sua data de nascimento primeiro.<br><br><li class="ml-4">Selecione o <strong>mês</strong>, <strong>dia</strong> e <strong>ano</strong></li><li class="ml-4">Clique em <strong>"Avançar"</strong></li><br>Você precisa ter pelo menos 13 anos.',
        tip: 'Essa informação é privada e serve para verificar sua idade.'
      },
      {
        title: 'Cadastre com e-mail e senha',
        description: 'Agora preencha:<br><br><li class="ml-4">Selecione a aba <strong>"E-mail"</strong> (em vez de telefone)</li><li class="ml-4"><strong>E-mail</strong>: Digite seu Gmail que acabou de criar</li><li class="ml-4"><strong>Senha</strong>: Crie uma senha forte (8-20 caracteres)</li><br>Clique em <strong>"Avançar"</strong>.',
        tip: 'A senha deve ter letras, números e caracteres especiais.'
      },
      {
        title: 'Verifique seu e-mail e escolha um nome de usuário',
        description: 'O TikTok enviou um código de verificação para seu e-mail.<br><br><li class="ml-4">Abra seu <strong>Gmail</strong> e encontre o código</li><li class="ml-4">Digite o código no TikTok</li><li class="ml-4">Depois, escolha um <strong>nome de usuário</strong> único</li><br><strong>Parabéns! Sua conta do TikTok foi criada!</strong>',
        tip: 'O nome de usuário será seu @ no TikTok. Escolha algo profissional.',
        action: 'finish'
      }
    ]
  }
};

App.formFields = [
  { id: 'nomeCompleto', label: 'Nome completo', type: 'text', placeholder: 'Ex: João da Silva', required: true, minLength: 3, icon: 'user' },
  { id: 'emailDesejado', label: 'E-mail desejado (usuário para o Gmail)', type: 'text', placeholder: 'nome.sobrenome ou nome.empresa', required: true, minLength: 3, helpText: 'Sugestões: maria.santos, pedro.costa.gv, ana.tech — o "@gmail.com" será adicionado automaticamente.', icon: 'mail' },
  { id: 'telefone', label: 'Telefone (com DDD)', type: 'tel', placeholder: '(11) 99999-9999', required: true, icon: 'phone' },
  { id: 'dataNascimento', label: 'Data de nascimento', type: 'date', required: true, icon: 'calendar' },
  { id: 'cargo', label: 'Cargo', type: 'text', placeholder: 'Ex: Analista de Marketing', required: true, icon: 'briefcase' },
  {
    id: 'departamento', label: 'Departamento', type: 'select', required: true, icon: 'building',
    options: [
      { value: '', label: 'Selecione o departamento' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'vendas', label: 'Vendas' },
      { value: 'ti', label: 'Tecnologia da Informação' },
      { value: 'rh', label: 'Recursos Humanos' },
      { value: 'financeiro', label: 'Financeiro' },
      { value: 'operacoes', label: 'Operações' },
      { value: 'juridico', label: 'Jurídico' },
      { value: 'administrativo', label: 'Administrativo' },
      { value: 'outro', label: 'Outro' }
    ]
  },
  { id: 'dataAdmissao', label: 'Data de admissão', type: 'date', required: true, icon: 'calendar-check' }
];

// === Wizard helpers ===

App.getWizardPlatformOrder = function() {
  return Object.keys(App.platforms);
};

App.getNextPendingPlatform = function(state, startIndex) {
  var order = App.getWizardPlatformOrder();
  for (var i = startIndex || 0; i < order.length; i++) {
    if (!state.platforms[order[i]].completed) {
      return { id: order[i], index: i };
    }
  }
  return null;
};

App.getWizardCredentials = function(platformId, state) {
  var names = App.splitName(state.employee.nomeCompleto);
  var email = state.employee.emailDesejado + '@gmail.com';
  var username = '@' + state.employee.emailDesejado;
  var senha = state.suggestedPassword || '';
  var dataNasc = App.formatDateBR(state.employee.dataNascimento);
  var telefone = state.employee.telefone || '';

  var senhaRow = { label: 'Senha sugerida', value: senha };

  switch (platformId) {
    case 'gmail':
      return [
        { label: 'Primeiro nome', value: names.first },
        { label: 'Sobrenome', value: names.last },
        { label: 'E-mail desejado', value: state.employee.emailDesejado },
        { label: 'Data de nascimento', value: dataNasc },
        { label: 'Telefone', value: telefone },
        senhaRow
      ];
    case 'instagram':
      return [
        { label: 'E-mail (Gmail)', value: email, autoCopy: true },
        { label: 'Nome completo', value: state.employee.nomeCompleto },
        { label: 'Username sugerido', value: state.employee.emailDesejado },
        senhaRow
      ];
    case 'facebook':
      return [
        { label: 'E-mail (Gmail)', value: email, autoCopy: true },
        { label: 'Primeiro nome', value: names.first },
        { label: 'Sobrenome', value: names.last },
        { label: 'Data de nascimento', value: dataNasc },
        senhaRow
      ];
    case 'tiktok':
      return [
        { label: 'E-mail (Gmail)', value: email, autoCopy: true },
        { label: 'Data de nascimento', value: dataNasc },
        senhaRow
      ];
    default:
      return [senhaRow];
  }
};

App.getWizardAutoCopyData = function(platformId, state) {
  var email = state.employee.emailDesejado + '@gmail.com';
  switch (platformId) {
    case 'gmail': return { value: state.employee.emailDesejado, label: 'E-mail desejado' };
    case 'instagram': return { value: email, label: 'E-mail Gmail' };
    case 'facebook': return { value: email, label: 'E-mail Gmail' };
    case 'tiktok': return { value: email, label: 'E-mail Gmail' };
    default: return { value: email, label: 'E-mail' };
  }
};

App.departmentLabels = {
  marketing: 'Marketing', vendas: 'Vendas', ti: 'Tecnologia da Informação',
  rh: 'Recursos Humanos', financeiro: 'Financeiro', operacoes: 'Operações',
  juridico: 'Jurídico', administrativo: 'Administrativo', outro: 'Outro'
};
