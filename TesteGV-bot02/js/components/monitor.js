var App = App || {};

// Monitor ao vivo - logs + progresso + screenshot
App.renderLiveMonitor = function() {
  return '' +
    '<div id="live-monitor" class="fixed inset-0 z-[9999] bg-dark-950/95 backdrop-blur-sm flex items-center justify-center p-4" style="display:none">' +
      '<div class="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">' +
        // Header
        '<div class="flex items-center justify-between p-4 border-b border-dark-700/60">' +
          '<div class="flex items-center gap-3">' +
            '<div class="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>' +
            '<h2 class="text-lg font-bold text-dark-50">Monitor ao Vivo</h2>' +
            '<span id="monitor-elapsed" class="text-sm text-dark-400 font-mono">00:00</span>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<button data-action="cancel-bot" class="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors">' +
              '&#9632; Cancelar' +
            '</button>' +
            '<button data-action="close-monitor" class="rounded-lg border border-dark-600 px-4 py-2 text-sm text-dark-300 hover:bg-dark-800 transition-colors">Fechar</button>' +
          '</div>' +
        '</div>' +
        // Body: 2 columns
        '<div class="flex-1 flex gap-4 p-4 overflow-hidden">' +
          // Left: progress + screenshot
          '<div class="w-1/2 flex flex-col gap-4 overflow-hidden">' +
            // Progress card
            '<div class="rounded-xl border border-dark-700 bg-dark-900/60 p-4">' +
              '<div class="flex items-center justify-between mb-2">' +
                '<span id="monitor-step-label" class="text-sm font-semibold text-brand-400">Aguardando...</span>' +
                '<span id="monitor-step-num" class="text-xs text-dark-500 font-mono">0/8</span>' +
              '</div>' +
              '<div class="w-full bg-dark-800 rounded-full h-2 overflow-hidden">' +
                '<div id="monitor-progress-bar" class="h-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500" style="width:0%"></div>' +
              '</div>' +
              '<p id="monitor-status-msg" class="mt-3 text-xs text-dark-400 font-mono leading-relaxed"></p>' +
            '</div>' +
            // Screenshot preview
            '<div class="rounded-xl border border-dark-700 bg-dark-900/60 p-3 flex-1 flex flex-col overflow-hidden">' +
              '<div class="flex items-center justify-between mb-2">' +
                '<span class="text-xs font-semibold text-dark-300 uppercase tracking-wider">Preview Bot</span>' +
                '<label class="flex items-center gap-1.5 text-xs text-dark-400 cursor-pointer">' +
                  '<input type="checkbox" id="monitor-screenshot-toggle" class="accent-brand-500" checked />' +
                  'Ativo' +
                '</label>' +
              '</div>' +
              '<div class="flex-1 bg-dark-800 rounded-lg overflow-hidden flex items-center justify-center">' +
                '<img id="monitor-screenshot" src="" class="max-w-full max-h-full object-contain" style="display:none" />' +
                '<p id="monitor-screenshot-placeholder" class="text-xs text-dark-600">Aguardando...</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
          // Right: logs
          '<div class="w-1/2 flex flex-col gap-2 overflow-hidden">' +
            '<div class="flex items-center justify-between">' +
              '<span class="text-xs font-semibold text-dark-300 uppercase tracking-wider">Logs ao Vivo</span>' +
              '<button data-action="clear-logs" class="text-xs text-dark-500 hover:text-red-400 transition-colors">Limpar</button>' +
            '</div>' +
            '<div id="monitor-logs" class="flex-1 overflow-y-auto bg-dark-950 rounded-lg p-3 font-mono text-xs space-y-1 border border-dark-800">' +
              '<p class="text-dark-600">Aguardando eventos...</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
};

// Stats dashboard
App.renderStatsCard = function() {
  var history = App.storage.loadHistory();
  var total = history.length;
  var completos = 0;
  var contasCriadas = 0;
  var totalTime = 0;
  var withTime = 0;
  for (var i = 0; i < history.length; i++) {
    var r = history[i];
    var cc = 0, tt = 0;
    for (var pid in r.platforms) {
      tt++;
      if (r.platforms[pid].completed) cc++;
    }
    if (cc === tt && tt > 0) completos++;
    contasCriadas += cc;
    if (r.startedAt && r.completedAt) {
      var dt = new Date(r.completedAt) - new Date(r.startedAt);
      if (dt > 0 && dt < 3600000) {
        totalTime += dt;
        withTime++;
      }
    }
  }
  var avgMin = withTime > 0 ? Math.round(totalTime / withTime / 60000) : 0;
  var rate = total > 0 ? Math.round(completos / total * 100) : 0;

  return '' +
    '<div class="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">' +
      '<div class="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 text-center hover:border-brand-500/40 transition-all">' +
        '<div class="text-3xl font-bold text-brand-400">' + total + '</div>' +
        '<div class="text-[10px] text-dark-400 uppercase tracking-wider mt-1">Onboardings</div>' +
      '</div>' +
      '<div class="rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center hover:border-green-500/40 transition-all">' +
        '<div class="text-3xl font-bold text-green-400">' + completos + '</div>' +
        '<div class="text-[10px] text-dark-400 uppercase tracking-wider mt-1">Completos</div>' +
      '</div>' +
      '<div class="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center hover:border-amber-500/40 transition-all">' +
        '<div class="text-3xl font-bold text-amber-400">' + rate + '%</div>' +
        '<div class="text-[10px] text-dark-400 uppercase tracking-wider mt-1">Taxa Sucesso</div>' +
      '</div>' +
      '<div class="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-center hover:border-blue-500/40 transition-all">' +
        '<div class="text-3xl font-bold text-blue-400">' + (avgMin > 0 ? avgMin + 'm' : '-') + '</div>' +
        '<div class="text-[10px] text-dark-400 uppercase tracking-wider mt-1">Tempo Médio</div>' +
      '</div>' +
    '</div>';
};

// Controla o monitor ao vivo
App.LiveMonitor = {
  _interval: null,
  _screenshotInterval: null,
  _startTime: null,
  _platform: 'instagram',
  _totalSteps: 8,

  open: function(platform, totalSteps) {
    this._platform = platform || 'instagram';
    this._totalSteps = totalSteps || 8;
    this._startTime = Date.now();
    var el = document.getElementById('live-monitor');
    if (!el) {
      document.body.insertAdjacentHTML('beforeend', App.renderLiveMonitor());
      el = document.getElementById('live-monitor');
    }
    el.style.display = 'flex';
    this.startPolling();
  },

  close: function() {
    var el = document.getElementById('live-monitor');
    if (el) el.style.display = 'none';
    this.stopPolling();
  },

  stopPolling: function() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
    if (this._screenshotInterval) { clearInterval(this._screenshotInterval); this._screenshotInterval = null; }
  },

  startPolling: function() {
    var self = this;
    this.stopPolling();
    var seenLogIds = new Set();
    this._interval = setInterval(function() {
      // Elapsed timer
      var elapsed = Math.floor((Date.now() - self._startTime) / 1000);
      var mm = Math.floor(elapsed / 60);
      var ss = elapsed % 60;
      var elEl = document.getElementById('monitor-elapsed');
      if (elEl) elEl.textContent = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');

      // Status polling
      fetch('/api/status?platform=' + self._platform)
        .then(function(r) { return r.json(); })
        .then(function(s) {
          var step = s.step || 0;
          var total = s.total || self._totalSteps;
          var pct = Math.round(step / total * 100);
          var bar = document.getElementById('monitor-progress-bar');
          if (bar) bar.style.width = pct + '%';
          var lbl = document.getElementById('monitor-step-label');
          if (lbl) lbl.textContent = 'Passo ' + step + '/' + total;
          var num = document.getElementById('monitor-step-num');
          if (num) num.textContent = step + '/' + total;
          var msg = document.getElementById('monitor-status-msg');
          if (msg) msg.textContent = s.message || '';
        })
        .catch(function() {});

      // Logs polling
      fetch('/api/logs?limit=30')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var logs = (data && data.logs) || [];
          var container = document.getElementById('monitor-logs');
          if (!container) return;
          // Only append new ones
          var newLogs = logs.filter(function(l) {
            var id = l.ts + '|' + l.message;
            if (seenLogIds.has(id)) return false;
            seenLogIds.add(id);
            return true;
          });
          if (newLogs.length === 0) return;
          // If first batch, clear placeholder
          if (container.innerHTML.indexOf('Aguardando eventos') !== -1) container.innerHTML = '';
          newLogs.forEach(function(l) {
            var colorCls = l.level === 'error' ? 'text-red-400' : (l.level === 'warn' ? 'text-amber-400' : 'text-dark-200');
            var botBadge = '<span class="inline-block px-1.5 rounded bg-brand-500/20 text-brand-400 text-[9px] font-semibold mr-1.5">' + (l.bot || '?').substring(0, 3).toUpperCase() + '</span>';
            var time = (l.ts || '').split('T')[1] || '';
            var line = document.createElement('div');
            line.className = colorCls + ' leading-snug break-all';
            line.innerHTML = '<span class="text-dark-600">' + time.substring(0, 8) + '</span> ' + botBadge + App.escapeHtml(l.message || '');
            container.appendChild(line);
            // Keep only last 200 lines
            while (container.children.length > 200) container.removeChild(container.firstChild);
            container.scrollTop = container.scrollHeight;
          });
        })
        .catch(function() {});
    }, 1500);

    // Screenshot polling (slower)
    this._screenshotInterval = setInterval(function() {
      var toggle = document.getElementById('monitor-screenshot-toggle');
      if (!toggle || !toggle.checked) return;
      fetch('/api/screenshot?platform=' + self._platform)
        .then(function(r) { if (!r.ok) throw 0; return r.json(); })
        .then(function(data) {
          if (!data || !data.img) return;
          var img = document.getElementById('monitor-screenshot');
          var placeholder = document.getElementById('monitor-screenshot-placeholder');
          if (img) { img.src = data.img; img.style.display = 'block'; }
          if (placeholder) placeholder.style.display = 'none';
        })
        .catch(function() {});
    }, 3000);
  }
};
