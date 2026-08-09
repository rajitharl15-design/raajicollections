function toggleMenu() {
  const navLinks = document.getElementById('navLinks');
  const hamburger = document.getElementById('hamburger');
  navLinks.classList.toggle('show');
  hamburger.classList.toggle('active');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let deferredInstallPrompt = null;

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !window.MSStream;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function isSamsungBrowser() {
  return /SamsungBrowser/i.test(navigator.userAgent);
}

function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Messenger|Twitter|MicroMessenger/i.test(ua);
}

const INSTALL_TIPS = {
  ios: {
    title: 'Install Raaji Collections App',
    steps: [
      'Tap the Share button at the bottom of your browser (or the Share icon in Safari).',
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add" in the top right. The app icon will appear on your home screen.',
    ],
  },
  android: {
    title: 'Install Raaji Collections App',
    steps: [
      'Tap the menu button (three dots ⋮) in the top right of your browser.',
      'Tap "Add to Home screen" (or "Install app").',
      'Tap "Add" / "Install". The app icon will appear on your home screen.',
    ]
  },
};

function getInstallTip() {
  if (isIOS()) return INSTALL_TIPS.ios;
  return INSTALL_TIPS.android;
}

function ensureInstallHelp() {
  let modal = document.getElementById('installHelp');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'installHelp';
    modal.className = 'install-help';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Installation help');
    modal.innerHTML = `
      <div class="install-help-box">
        <button class="install-help-close" aria-label="Close">&times;</button>
        <h3 class="install-help-title"></h3>
        <ol class="install-help-steps"></ol>
        <p class="install-help-secure"><i class="fas fa-shield-alt"></i> No download, no files installed — this only adds a home-screen link to our secure website. Safe on any phone.</p>
        <button class="btn-outline" id="installHelpClose">Close</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#installHelpClose').addEventListener('click', () => modal.classList.remove('open'));
    modal.querySelector('.install-help-close').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  }
  return modal;
}

function showInstallHelp() {
  if (isStandalone()) return;
  const modal = ensureInstallHelp();
  const tip = getInstallTip();

  const stepsBox = modal.querySelector('.install-help-steps');
  stepsBox.innerHTML = '';
  tip.steps.forEach(step => {
    const li = document.createElement('li');
    li.textContent = step;
    stepsBox.appendChild(li);
  });

  if (isInAppBrowser()) {
    modal.querySelector('.install-help-title').textContent =
      'Using an in-app browser — install from your main browser instead';
    stepsBox.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = 'It looks like you\'re viewing this inside an app (like Facebook, Instagram or a chat app). Please copy this link and open it in Chrome or Safari first, then install.';
    stepsBox.appendChild(li);
    modal.querySelector('.btn-outline').textContent = 'Got it';
  } else {
    modal.querySelector('.install-help-title').textContent = tip.title;
    modal.querySelector('.btn-outline').textContent = 'Close';
  }

  modal.classList.add('open');
}

function isInChrome() {
  return /Chrome|Chromium|Edg\//i.test(navigator.userAgent) && !isIOS();
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallButton();
});

if (isIOS() && !isStandalone()) {
  window.addEventListener('load', () => {
    setTimeout(showInstallButton, 2500);
  });
}

function showInstallButton() {
  let btn = document.getElementById('installAppBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'installAppBtn';
    btn.className = 'install-app-btn';
    btn.innerHTML = '<i class="fas fa-download"></i> Install App';
    btn.addEventListener('click', async () => {
      if (isSamsungBrowser() && !deferredInstallPrompt) {
        showInstallHelp();
        return;
      }
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try {
          await deferredInstallPrompt.userChoice;
        } catch (_) {}
        deferredInstallPrompt = null;
        hideInstallButton();
        return;
      }
      showInstallHelp();
    });
    document.body.appendChild(btn);
  }
  btn.classList.add('visible');
}

function hideInstallButton() {
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.classList.remove('visible');
}

async function triggerInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    try {
      await deferredInstallPrompt.userChoice;
    } catch (_) {}
    deferredInstallPrompt = null;
    hideInstallButton();
    return;
  }
  showInstallHelp();
}

document.addEventListener('click', e => {
  const trigger = e.target.closest('[data-install-trigger]');
  if (!trigger) return;
  e.preventDefault();
  triggerInstall();
});

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('show');
    document.getElementById('hamburger').classList.remove('active');
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
  });
});

window.addEventListener('scroll', () => {
  const sections = document.querySelectorAll('section[id]');
  const scrollY = window.scrollY + 100;

  sections.forEach(section => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const link = document.querySelector(`.nav-links a[href="#${id}"]`);

    if (link && scrollY >= top && scrollY < top + height) {
      document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
    }
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.category-card, .product-card, .testimonial-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  observer.observe(el);
});

document.querySelector('.product-card img') && (() => {
  let current = [], currentIndex = 0;

  function build() {
    if (document.getElementById('lightbox')) return document.getElementById('lightbox');
    const div = document.createElement('div');
    div.id = 'lightbox';
    div.className = 'lightbox';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Image preview');
    div.innerHTML = `
      <button class="lightbox-close" aria-label="Close preview">&times;</button>
      <button class="lightbox-prev" aria-label="Previous image">&#10094;</button>
      <button class="lightbox-next" aria-label="Next image">&#10095;</button>
      <div class="lightbox-content">
        <img src="" alt="">
        <p class="lightbox-caption"></p>
      </div>`;
    document.body.appendChild(div);
    return div;
  }

  function show(idx) {
    if (!current.length) return;
    currentIndex = (idx + current.length) % current.length;
    const lb = document.getElementById('lightbox');
    const img = lb.querySelector('.lightbox-content img');
    img.src = current[currentIndex].src;
    img.alt = current[currentIndex].alt;
    lb.querySelector('.lightbox-caption').textContent = current[currentIndex].alt;
  }

  function open(img) {
    const lb = build();
    current = [...document.querySelectorAll('.product-card img')].map(i => ({ src: i.currentSrc || i.src, alt: i.alt }));
    const idx = Math.max(0, current.findIndex(i => i.src === img.src));
    show(idx);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    const lb = document.getElementById('lightbox');
    if (lb) lb.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', e => {
    const img = e.target.closest('.product-card img');
    if (img) { e.preventDefault(); open(img); }
  });

  document.addEventListener('click', e => {
    const lb = document.getElementById('lightbox');
    if (!lb || !lb.classList.contains('open')) return;
    if (e.target.closest('.lightbox-close') || e.target === lb) close();
    else if (e.target.closest('.lightbox-prev')) show(currentIndex - 1);
    else if (e.target.closest('.lightbox-next')) show(currentIndex + 1);
  });

  document.addEventListener('keydown', e => {
    const lb = document.getElementById('lightbox');
    if (!lb || !lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(currentIndex - 1);
    else if (e.key === 'ArrowRight') show(currentIndex + 1);
  });
})();

document.querySelector('.newsletter-form')?.addEventListener('submit', async function (e) {
  e.preventDefault();
  const input = this.querySelector('input');
  const btn = this.querySelector('button');
  if (!input.value) return;

  if (window.API_CONFIG && API_CONFIG.baseUrl) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Subscribing...';
    try {
      const res = await fetch(`${API_CONFIG.baseUrl}/api/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.value }),
      });
      if (!res.ok) throw new Error('Subscription failed');
      alert('Thank you for subscribing!');
      input.value = '';
    } catch (err) {
      alert('Could not subscribe. Please try again later.');
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  } else {
    alert('Thank you for subscribing!');
    input.value = '';
  }
});
