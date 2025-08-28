// ---------- utilities ----------
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// keep CSS var in sync with sticky header height
function setTopbarHeight() {
  const h = $('.topbar')?.offsetHeight || 56;
  document.documentElement.style.setProperty('--topbar-h', h + 'px');
}
window.addEventListener('load', setTopbarHeight);
window.addEventListener('resize', setTopbarHeight);

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================
  // 1) SKILLS FILTER (Projects + Work)  — multi-select + AND/OR + Clear
  //    HTML requirements:
  //    - container with id="projects-filter"
  //    - chips: <button class="chip" data-filter="Data Science">...</button>
  //    - optional clear: <button class="chip clear-chip">Clear</button>
  //    - radios name="filterMode" with values "and" | "or"
  //    - each card has data-tags="tag1, tag2, ..."
  // =========================================================
  const skillsBar  = $('#projects-filter');
  const modeInputs = $$('input[name="filterMode"]');

  const selectedSkills = new Set();
  let skillMode = 'and'; // 'and' or 'or'

  const parseTags = s =>
    (s || '')
      .toLowerCase()
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

  function matchSkills(card) {
    if (selectedSkills.size === 0) return true;
    const tags = new Set(parseTags(card.dataset.tags));
    if (skillMode === 'and') {
      for (const want of selectedSkills) if (!tags.has(want)) return false;
      return true;
    } else {
      for (const want of selectedSkills) if (tags.has(want)) return true;
      return false;
    }
  }

  function applyFilters() {
    // fresh node lists in case DOM changes later
    const projectCards = $$('.project-card');
    const workCards    = $$('.work-card');

    projectCards.forEach(c => {
      const show = matchSkills(c);
      c.style.display = show ? '' : 'none';
    });

    workCards.forEach(c => {
      const workOk = matchWorkType(c);     // set in section 2
      const skillOk = matchSkills(c);
      c.style.display = (workOk && skillOk) ? '' : 'none';
    });
  }

  // chips: toggle multi-select; clear resets all
  if (skillsBar) {
    const clearBtn = skillsBar.querySelector('.clear-chip');
    const chips = $$('.chip', skillsBar).filter(c => !c.classList.contains('clear-chip'));

    function resetSkillsUI() {
      chips.forEach(c => {
        c.classList.remove('chip-active');
        c.setAttribute('aria-pressed', 'false');
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        selectedSkills.clear();
        resetSkillsUI();
        applyFilters();
      });
    }

    chips.forEach(btn => {
      const tag = (btn.dataset.filter || '').toLowerCase();
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        const isOn = btn.classList.toggle('chip-active');
        btn.setAttribute('aria-pressed', String(isOn));
        if (isOn) selectedSkills.add(tag);
        else selectedSkills.delete(tag);
        applyFilters();
      });
    });
  }

  // AND / OR radio toggle
  modeInputs.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) {
        skillMode = r.value === 'or' ? 'or' : 'and';
        applyFilters();
      }
    });
  });

  // =========================================================
  // 2) WORK FILTER (All | Work | Volunteering)
  //    HTML requirements:
  //    - container id="work-type-filter"
  //    - chips with data-filter="all|work|volunteering"
  //    - each .work-card has data-type="work" or "volunteering"
  // =========================================================
  const workTypeBar = $('#work-type-filter');
  let workType = 'all';

  function matchWorkType(card) {
    if (!card.classList.contains('work-card')) return true; // ignore non-work cards
    if (workType === 'all') return true;
    return (card.dataset.type || '').toLowerCase() === workType;
  }

  if (workTypeBar) {
    const typeChips = $$('.chip', workTypeBar);
    typeChips.forEach(btn => {
      btn.addEventListener('click', () => {
        typeChips.forEach(c => {
          c.classList.remove('chip-active');
          c.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('chip-active');
        btn.setAttribute('aria-selected', 'true');
        workType = (btn.dataset.filter || 'all').toLowerCase();
        applyFilters();
      });
    });
  }

  // initial paint
  applyFilters();

  // =========================================================
  // 3) NAV: highlight active section on scroll + smooth scroll
  //    HTML requirements:
  //    - .nav-link href="#about|#projects|#work|#contact"
  //    - sections with matching ids
  // =========================================================
  const navLinks = $$('.nav-link');
  const byHash   = Object.fromEntries(navLinks.map(a => [a.getAttribute('href'), a]));

    // Make sure we start with the correct header height
  setTopbarHeight();

  // smooth scroll
  navLinks.forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        $(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // IntersectionObserver for active nav
  const topbarOffset = () =>
    parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 56;

  let observer;
  function makeObserver() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = '#' + entry.target.id;
        const link = byHash[id];
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach(n => n.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, {
      rootMargin: `-${topbarOffset() + 8}px 0px -70% 0px`,
      threshold: 0
    });

    ['about','projects','work','contact']
      .map(id => $('#' + id))
      .filter(Boolean)
      .forEach(sec => observer.observe(sec));
  }

  // initial
  makeObserver();

  // Rebuild once everything is fully laid out
  window.addEventListener('load', () => {
    setTopbarHeight();
    makeObserver();
  });

  // Rebuild on resize (e.g., orientation/font changes)
  window.addEventListener('resize', () => {
    setTopbarHeight();
    makeObserver();
  });

  // ============================
// 4) CONTACT FORM (Formspree)
// ============================
(() => {
  const form   = document.getElementById('contact-form');
  if (!form) return;

  const status = document.getElementById('contact-status');
  const button = form.querySelector('.contact-submit');

  // simple helpers
  const setStatus = (msg, cls) => {
    status.textContent = msg;
    status.className = `status ${cls || ''}`.trim();
  };

  const setFieldError = (id, message) => {
    const wrap = form.querySelector(`#${id}`)?.closest('.field');
    if (!wrap) return;
    wrap.classList.toggle('field-error', !!message);
    const hint = wrap.querySelector('.field-hint');
    if (hint) hint.textContent = message || '';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', '');
    setFieldError('name', '');
    setFieldError('email', '');
    setFieldError('message', '');

    // basic client validation
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const msg = form.message.value.trim();
    let hasErr = false;

    if (!name)   { setFieldError('name', 'Please tell me your name.'); hasErr = true; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('email', 'Please enter a valid email.');
      hasErr = true;
    }
    if (!msg)    { setFieldError('message', 'Please write a short message.'); hasErr = true; }
    if (hasErr) return;

    // submit to Formspree via fetch
    button.disabled = true;
    button.textContent = 'Sending…';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      });

      if (res.ok) {
        form.reset();
        setStatus('Thanks! Your message was sent.', 'ok');
      } else {
        const data = await res.json().catch(() => ({}));
        const firstError = data?.errors?.[0]?.message || 'Something went wrong.';
        setStatus(firstError, 'error');
      }
    } catch (err) {
      setStatus('Network error — please try again in a moment.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'SEND';
    }
  });
})();

