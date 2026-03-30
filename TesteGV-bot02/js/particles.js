var App = App || {};

App.particles = (function() {
  var canvas, ctx;
  var particles = [];
  var mouse = { x: -9999, y: -9999 };
  var animId = null;
  var isActive = false;

  var CONFIG = {
    count: 55,
    colors: ['#22c55e', '#4ade80', '#059669', '#10b981', '#34d399'],
    maxRadius: 3,
    minRadius: 1,
    speed: 0.4,
    connectionDistance: 150,
    mouseRepelDistance: 120,
    mouseRepelForce: 0.8
  };

  function init() {
    // Skip on small screens for performance
    if (window.innerWidth < 768) return;

    canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    resize();
    createParticles();
    bindEvents();
    isActive = true;
    loop();
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    for (var i = 0; i < CONFIG.count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * CONFIG.speed,
        vy: (Math.random() - 0.5) * CONFIG.speed,
        radius: CONFIG.minRadius + Math.random() * (CONFIG.maxRadius - CONFIG.minRadius),
        color: CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)],
        opacity: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02
      });
    }
  }

  function bindEvents() {
    window.addEventListener('resize', function() {
      resize();
      // Redistribute particles that went off-screen
      for (var i = 0; i < particles.length; i++) {
        if (particles[i].x > canvas.width) particles[i].x = Math.random() * canvas.width;
        if (particles[i].y > canvas.height) particles[i].y = Math.random() * canvas.height;
      }
    });

    document.addEventListener('mousemove', function(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    document.addEventListener('mouseleave', function() {
      mouse.x = -9999;
      mouse.y = -9999;
    });
  }

  function loop() {
    if (!isActive) return;
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  function update() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      // Organic sine wave motion
      p.phase += p.pulseSpeed;
      p.x += p.vx + Math.sin(p.phase) * 0.15;
      p.y += p.vy + Math.cos(p.phase * 0.7) * 0.15;

      // Mouse repulsion
      var dx = p.x - mouse.x;
      var dy = p.y - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONFIG.mouseRepelDistance && dist > 0) {
        var force = (CONFIG.mouseRepelDistance - dist) / CONFIG.mouseRepelDistance * CONFIG.mouseRepelForce;
        p.x += (dx / dist) * force;
        p.y += (dy / dist) * force;
      }

      // Wrap around screen edges
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;

      // Pulse opacity
      p.currentOpacity = p.opacity + Math.sin(p.phase) * 0.15;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Spatial grid for O(n) connection checks instead of O(n²)
    var cellSize = CONFIG.connectionDistance;
    var cols = Math.ceil(canvas.width / cellSize) + 1;
    var grid = {};
    for (var gi = 0; gi < particles.length; gi++) {
      var cx = Math.floor(particles[gi].x / cellSize);
      var cy = Math.floor(particles[gi].y / cellSize);
      var key = cx + ',' + cy;
      if (!grid[key]) grid[key] = [];
      grid[key].push(gi);
    }

    // Draw connections using spatial grid
    var drawn = {};
    for (var i = 0; i < particles.length; i++) {
      var gcx = Math.floor(particles[i].x / cellSize);
      var gcy = Math.floor(particles[i].y / cellSize);
      for (var nx = gcx - 1; nx <= gcx + 1; nx++) {
        for (var ny = gcy - 1; ny <= gcy + 1; ny++) {
          var neighbors = grid[nx + ',' + ny];
          if (!neighbors) continue;
          for (var ni = 0; ni < neighbors.length; ni++) {
            var j = neighbors[ni];
            if (j <= i) continue;
            var pairKey = i + '-' + j;
            if (drawn[pairKey]) continue;
            drawn[pairKey] = true;
            var dx = particles[i].x - particles[j].x;
            var dy = particles[i].y - particles[j].y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONFIG.connectionDistance) {
              var opacity = (1 - dist / CONFIG.connectionDistance) * 0.15;
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(34, 197, 94, ' + opacity + ')';
              ctx.lineWidth = 0.5;
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Draw particles
    for (var k = 0; k < particles.length; k++) {
      var p = particles[k];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.currentOpacity || p.opacity;
      ctx.fill();

      // Glow effect
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
      var glow = ctx.createRadialGradient(p.x, p.y, p.radius, p.x, p.y, p.radius * 3);
      glow.addColorStop(0, p.color.replace(')', ', 0.2)').replace('rgb', 'rgba').replace('#', ''));
      glow.addColorStop(0, 'rgba(34, 197, 94, 0.15)');
      glow.addColorStop(1, 'rgba(34, 197, 94, 0)');
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.globalAlpha = 1;
    }
  }

  function destroy() {
    isActive = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    particles = [];
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return {
    init: init,
    destroy: destroy
  };
})();
