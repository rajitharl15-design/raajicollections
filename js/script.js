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

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallButton();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallButton();
});

function showInstallButton() {
  let btn = document.getElementById('installAppBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'installAppBtn';
    btn.className = 'install-app-btn';
    btn.innerHTML = '<i class="fas fa-download"></i> Install App';
    btn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      hideInstallButton();
    });
    document.body.appendChild(btn);
  }
  btn.classList.add('visible');
}

function hideInstallButton() {
  const btn = document.getElementById('installAppBtn');
  if (btn) btn.classList.remove('visible');
}

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
