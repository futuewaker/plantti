/* ===========================================================
   PLANTTI · 植塑测试 — app.js v2
   =========================================================== */
(function () {
  'use strict';

  // ------------------------------------------------------------
  // Mock fallbacks (used only if JSON fetch fails — e.g. file://)
  // ------------------------------------------------------------
  const MOCK_QUESTIONS = [
    {
      id: 1, dim: 'VI', text: '周末走进花店，你的视线最先落在——',
      bubble: '花店的第一眼', avatar: 'images/rose.png',
      options: [
        { label: '一束饱满的玫瑰/绣球，颜色直接撞脸', score: 1, pets: [] },
        { label: '看心情，温柔的、热烈的都会停下来', score: 0, pets: [] },
        { label: '角落那束雏菊/满天星，安静的最戳我', score: -1, pets: [] }
      ]
    }
  ];
  const MOCK_PETS = [
    {
      id: 'rose', name: '玫瑰', name_title: '浪漫之神-', image: 'images/rose.png',
      slogan: '"我开就开到顶，开就开到能让你心跳停一拍"',
      tags: ['#浪漫天花板', '#自带聚光灯', '#情绪饱和度高'],
      vector: [4, 2, 4, -2, 2, 0],
      interpretation: '你是花店里那束所有人路过都要回头看一眼的玫瑰——浓郁、饱满、不打算低调。'
    }
  ];

  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  const state = {
    view: 'intro',
    questions: [],
    pets: [],
    currentIdx: 0,
    answers: [],        // [{id, dim, score}]
    result: null,
    userVec: [0, 0, 0, 0],
    isAnimating: false
  };

  const DIM_IDX = { VI: 0, EH: 1, RD: 2, LH: 3, SP: 4, GA: 5 };
  // PLANTTI 6 维 (植物本体语言，避开 MBTI 黑话)
  // VI 视觉浓度 / EH 元气治愈 / RD 浪漫田园 / LH 省心讲究 / SP 季节常青 / GA 群植独株
  const DIM_LABELS = ['视觉浓度', '元气指数', '梦幻指数', '省心指数', '季节限定', '群植浓度'];
  const DIM_COUNT = DIM_LABELS.length;
  const ANIM_MS = 280;
  const FLASH_MS = 320;
  const NEXT_DELAY = 260;

  // ------------------------------------------------------------
  // DOM refs
  // ------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    views: {
      intro:  $('view-intro'),
      quiz:   $('view-quiz'),
      result: $('view-result')
    },
    // intro
    scrollRows: [$('scroll-row-1'), $('scroll-row-2'), $('scroll-row-3')],
    btnStart:     $('btn-start'),
    // quiz
    btnHome:         $('btn-home'),
    progressFill:    $('progress-fill'),
    progressCurrent: $('progress-current'),
    progressTotal:   $('progress-total'),
    scenarioAvatar:  $('scenario-avatar-img'),
    scenarioAvatarBox: document.querySelector('.scenario-avatar'),
    scenarioBubble:  $('scenario-bubble'),
    quizCard:        $('quiz-card'),
    qText:           $('q-text'),
    optionsList:     $('options-list'),
    btnPrev:         $('btn-prev'),
    btnNext:         $('btn-next'),
    // result
    resultImage:          $('result-image'),
    resultNameTitle:      $('result-name-title'),
    resultName:           $('result-name'),
    resultMdValue:        $('result-md-value'),
    resultMdNote:         $('result-md-note'),
    resultNzValue:        $('result-nz-value'),
    resultNzNote:         $('result-nz-note'),
    resultQuote:          $('result-quote'),
    resultTags:           $('result-tags'),
    resultQuickReview:    $('result-quick-review'),
    resultInterpretation: $('result-interpretation'),
    resultCatchphrases:   $('result-catchphrases'),
    radarCanvas:          $('radar-canvas'),
    btnRestart:           $('btn-restart'),
    btnShare:             $('btn-share'),
    btnSaveLong:          $('btn-save-long'),
    saveLoading:          $('save-loading'),
    saveModal:            $('save-modal'),
    saveModalBackdrop:    $('save-modal-backdrop'),
    saveModalImg:         $('save-modal-img'),
    btnSaveClose:         $('btn-save-close'),
    viewResult:           $('view-result')
  };

  // ------------------------------------------------------------
  // Init — load JSON + render
  // ------------------------------------------------------------
  async function init() {
    const [questions, pets] = await Promise.all([
      loadJSON('data/questions.json', MOCK_QUESTIONS),
      loadJSON('data/types.json',     MOCK_PETS)
    ]);
    state.questions = Array.isArray(questions) && questions.length ? questions : MOCK_QUESTIONS;
    state.pets      = Array.isArray(pets)      && pets.length      ? pets      : MOCK_PETS;

    el.progressTotal.textContent = state.questions.length;

    renderIntroGallery();
    bindEvents();
    render();
  }

  async function loadJSON(path, fallback) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } catch (err) {
      console.warn('[PLANTTI] fallback to mock for', path, err.message);
      return fallback;
    }
  }

  // ------------------------------------------------------------
  // Intro marquee (3 rows of scrolling pixel pets)
  // Each row contains all 24 pets × 2 for seamless -50% loop.
  // ------------------------------------------------------------
  function renderIntroGallery() {
    if (!el.scrollRows || !el.scrollRows.every(Boolean)) return;
    const ids = state.pets.map(p => p.id);
    if (!ids.length) return;

    // Fixed deterministic split: 24 pets interleaved into 3 rows
    // Row 1 gets indices 0,3,6…; Row 2 gets 1,4,7…; Row 3 gets 2,5,8…
    // This gives each row 8 unique pets with visual variety across rows,
    // and the same arrangement every session for a stable animation.
    const groups = [[], [], []];
    ids.forEach((id, idx) => groups[idx % 3].push(id));

    el.scrollRows.forEach((row, i) => {
      if (!row) return;
      // duplicate the list so a -50% translate wraps seamlessly
      const list = groups[i].concat(groups[i]);
      row.innerHTML = list.map(id => {
        const pet = state.pets.find(p => p.id === id);
        const src = pet ? pet.image : ('images/' + id + '.png');
        return '<div class="pet"><img src="' + src + '" alt=""></div>';
      }).join('');
      // Set explicit pixel width so iOS Safari animates reliably.
      // Without this, `width: max-content` can compute as 0 during layout
      // and break the scrollLoop on 1st/3rd rows (observed on mobile).
      const PET = 96, GAP = 14;
      row.style.width = (list.length * PET + (list.length - 1) * GAP) + 'px';
    });
  }

  // ------------------------------------------------------------
  // Events
  // ------------------------------------------------------------
  function bindEvents() {
    el.btnStart    && el.btnStart.addEventListener('click', startQuiz);
    el.btnHome     && el.btnHome.addEventListener('click',  goHome);
    el.btnPrev     && el.btnPrev.addEventListener('click',  previousQuestion);
    el.btnNext     && el.btnNext.addEventListener('click',  nextQuestion);
    el.btnRestart  && el.btnRestart.addEventListener('click', restart);
    el.btnShare    && el.btnShare.addEventListener('click',  shareLink);
    el.btnSaveLong && el.btnSaveLong.addEventListener('click', saveLongScreenshot);
    el.btnSaveClose && el.btnSaveClose.addEventListener('click', closeSaveModal);
    el.saveModalBackdrop && el.saveModalBackdrop.addEventListener('click', closeSaveModal);
  }

  // ------------------------------------------------------------
  // View routing
  // ------------------------------------------------------------
  function setView(name) {
    state.view = name;
    Object.entries(el.views).forEach(([k, node]) => {
      if (!node) return;
      node.classList.toggle('active', k === name);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    if (state.view === 'quiz')   renderQuiz();
    if (state.view === 'result') renderResult();
    setView(state.view);
  }

  // ------------------------------------------------------------
  // Intro actions
  // ------------------------------------------------------------
  function startQuiz() {
    state.view = 'quiz';
    state.currentIdx = 0;
    state.answers = [];
    render();
  }

  function goHome() {
    if (state.isAnimating) return;
    state.view = 'intro';
    render();
  }

  // ------------------------------------------------------------
  // QUIZ
  // ------------------------------------------------------------
  function renderQuiz() {
    renderProgress();
    renderScenarioHint();
    renderQuestion();
    updateNavButtons();
  }

  function renderProgress() {
    const total = state.questions.length;
    const current = state.currentIdx + 1;
    el.progressTotal.textContent = total;
    el.progressCurrent.textContent = current;
    const pct = Math.round((current / total) * 100);
    el.progressFill.style.width = pct + '%';
  }

  function renderScenarioHint() {
    const q = state.questions[state.currentIdx];
    if (!q) return;
    el.scenarioBubble.textContent = q.bubble || '';
    if (q.avatar) {
      el.scenarioAvatar.src = q.avatar;
      el.scenarioAvatar.alt = '';
    }
    // Replay pop animation
    if (el.scenarioAvatarBox) {
      el.scenarioAvatarBox.classList.remove('pop');
      // eslint-disable-next-line no-unused-expressions
      el.scenarioAvatarBox.offsetHeight;
      el.scenarioAvatarBox.classList.add('pop');
    }
  }

  function renderQuestion() {
    const q = state.questions[state.currentIdx];
    if (!q) return;
    el.qText.textContent = q.text || '';

    const prev = state.answers[state.currentIdx];

    el.optionsList.innerHTML = '';
    (q.options || []).forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'option';
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.dataset.score = String(opt.score);
      if (prev && prev.score === opt.score) li.classList.add('selected');
      li.innerHTML =
        '<span class="option-bullet" aria-hidden="true">' + String.fromCharCode(65 + i) + '</span>' +
        '<span class="option-label"></span>';
      li.querySelector('.option-label').textContent = opt.label;

      const handler = function (e) {
        if (e.type === 'keydown') {
          if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
          e.preventDefault();
        }
        onSelectOption(li, opt.score);
      };
      li.addEventListener('click', handler);
      li.addEventListener('keydown', handler);

      el.optionsList.appendChild(li);
    });
  }

  function onSelectOption(node, score) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    // clear others, flash clicked
    [...el.optionsList.children].forEach(c => {
      c.classList.remove('selected', 'flashing');
    });
    node.classList.add('flashing');

    // record answer
    const q = state.questions[state.currentIdx];
    state.answers[state.currentIdx] = { id: q.id, dim: q.dim, score: score };

    setTimeout(function () {
      node.classList.remove('flashing');
      node.classList.add('selected');

      // auto-advance (or finish)
      setTimeout(function () {
        if (state.currentIdx < state.questions.length - 1) {
          animateTo(+1);
        } else {
          state.isAnimating = false;
          computeResult();
        }
      }, NEXT_DELAY);
    }, FLASH_MS);
  }

  function previousQuestion() {
    if (state.isAnimating || state.currentIdx === 0) return;
    animateTo(-1);
  }

  function nextQuestion() {
    if (state.isAnimating) return;
    // enabled only when current has an answer
    if (!state.answers[state.currentIdx]) return;
    if (state.currentIdx < state.questions.length - 1) {
      animateTo(+1);
    } else {
      computeResult();
    }
  }

  function animateTo(direction) {
    state.isAnimating = true;
    const card = el.quizCard;
    const outX = direction === 1 ? -28 : 28;
    const inX  = direction === 1 ? 28 : -28;

    card.style.transition = 'transform 0.26s cubic-bezier(0.16,1,0.3,1), opacity 0.26s ease';
    card.style.transform  = 'translateX(' + outX + 'px)';
    card.style.opacity    = '0';

    setTimeout(function () {
      state.currentIdx += direction;

      card.style.transition = 'none';
      card.style.transform  = 'translateX(' + inX + 'px)';
      card.style.opacity    = '0';

      renderQuiz();

      // eslint-disable-next-line no-unused-expressions
      card.offsetHeight;

      card.style.transition = 'transform 0.26s cubic-bezier(0.16,1,0.3,1), opacity 0.26s ease';
      card.style.transform  = 'translateX(0)';
      card.style.opacity    = '1';

      setTimeout(function () {
        state.isAnimating = false;
        card.style.transition = '';
        card.style.transform  = '';
        card.style.opacity    = '';
      }, ANIM_MS + 40);
    }, ANIM_MS);
  }

  function updateNavButtons() {
    el.btnPrev.disabled = state.currentIdx === 0;
    const hasAnswer = !!state.answers[state.currentIdx];
    const isLast = state.currentIdx === state.questions.length - 1;
    el.btnNext.disabled = !hasAnswer;
    // Label adjusts on last question
    const nextLabel = el.btnNext.querySelector('span');
    if (nextLabel) nextLabel.textContent = isLast ? '看结果' : '下一题';
  }

  // ------------------------------------------------------------
  // RESULT
  // ------------------------------------------------------------
  function computeResult() {
    // 1. Compute userVec (radar chart + highlight %, NOT used for matching)
    const userVec = new Array(DIM_COUNT).fill(0);
    state.answers.forEach(function (a) {
      if (!a) return;
      const idx = DIM_IDX[a.dim];
      if (typeof idx === 'number') userVec[idx] += a.score;
    });
    state.userVec = userVec;

    // 2. Tag voting: count hits per pet from option.pets array
    const hits = {};
    const trumpHit = {};
    state.pets.forEach(function (p) {
      hits[p.id] = 0;
      trumpHit[p.id] = false;
    });

    state.answers.forEach(function (a, i) {
      if (!a) return;
      const q = state.questions[i];
      if (!q) return;
      const opt = (q.options || []).find(function (o) { return o.score === a.score; });
      if (!opt) return;
      (opt.pets || []).forEach(function (petId) {
        if (petId in hits) hits[petId] += 1;
      });
      state.pets.forEach(function (p) {
        if (p.trump && p.trump.qId === q.id && p.trump.score === a.score) {
          trumpHit[p.id] = true;
        }
      });
    });

    // 3. Top hitter(s)
    let topHit = -1;
    state.pets.forEach(function (p) { if (hits[p.id] > topHit) topHit = hits[p.id]; });
    const tied = state.pets.filter(function (p) { return hits[p.id] === topHit; });

    let result;
    if (tied.length === 1) {
      result = tied[0];
    } else {
      // Tiebreaker 1: trump selected
      const trumpWinners = tied.filter(function (p) { return trumpHit[p.id]; });
      const pool = trumpWinners.length > 0 ? trumpWinners : tied;
      if (pool.length === 1) {
        result = pool[0];
      } else {
        // Tiebreaker 2: smallest euclidean distance (last-resort)
        let best = pool[0], bestDist = Infinity;
        pool.forEach(function (pet) {
          const vec = Array.isArray(pet.vector) ? pet.vector : new Array(DIM_COUNT).fill(0);
          let s = 0;
          for (let j = 0; j < DIM_COUNT; j++) {
            const d = (vec[j] || 0) - userVec[j];
            s += d * d;
          }
          const dist = Math.sqrt(s);
          if (dist < bestDist) { bestDist = dist; best = pet; }
        });
        result = best;
      }
    }

    state.result = result || state.pets[0];
    state.isAnimating = false;
    state.view = 'result';
    render();
  }

  function renderResult() {
    const pet = state.result;
    if (!pet) return;

    el.resultImage.src = pet.image || '';
    el.resultImage.alt = pet.name || '';

    // Add a space between code and name ("WILD" + " " + "野性基因-孟加拉虎")
    el.resultNameTitle.textContent = pet.name_title ? pet.name_title + ' ' : '';
    el.resultName.textContent      = pet.name || '';

    // The quote block now shows the pet's first-person punchline
    el.resultQuote.textContent = pet.punchline || pet.slogan || '';
    if (el.resultQuickReview) el.resultQuickReview.textContent = pet.quick_review || '';
    el.resultInterpretation.textContent = pet.interpretation || '';

    el.resultTags.innerHTML = '';
    (pet.tags || []).slice(0, 3).forEach(function (t) {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = '#' + t;
      el.resultTags.appendChild(span);
    });

    if (el.resultCatchphrases) {
      el.resultCatchphrases.innerHTML = '';
      (pet.catchphrases || []).forEach(function (phrase) {
        const d = document.createElement('div');
        d.className = 'catchphrase';
        d.textContent = phrase;
        el.resultCatchphrases.appendChild(d);
      });
    }

    // Draw radar chart
    drawRadar(el.radarCanvas, state.userVec);

    // Highlight cards: 季节限定度 (SP, vec[4]) + 群植浓度 (GA, vec[5])
    const mdPct = Math.round(((state.userVec[4] + 4) / 8) * 100);
    const nzPct = Math.round(((state.userVec[5] + 4) / 8) * 100);
    if (el.resultMdValue) el.resultMdValue.textContent = mdPct + '%';
    if (el.resultNzValue) el.resultNzValue.textContent = nzPct + '%';
    if (el.resultMdNote)  el.resultMdNote.textContent  = mdNoteFor(mdPct);
    if (el.resultNzNote)  el.resultNzNote.textContent  = nzNoteFor(nzPct);

    // reset share button state
    el.btnShare.classList.remove('is-copied');
    el.btnShare.textContent = '复制分享链接';
  }

  // ------------------------------------------------------------
  // Radar chart
  // Input: canvas, 4-dim vector in [-4, +4]
  // Maps to 0-100 score per axis for visual intuition.
  // ------------------------------------------------------------
  function drawRadar(canvas, vector) {
    if (!canvas || !canvas.getContext) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalSize = 320;           // CSS size
    canvas.width  = logicalSize * dpr;
    canvas.height = logicalSize * dpr;
    canvas.style.width  = logicalSize + 'px';
    canvas.style.height = logicalSize + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, logicalSize, logicalSize);

    const cx = logicalSize / 2;
    const cy = logicalSize / 2;
    const r  = Math.min(cx, cy) - 56;
    const axisCount = DIM_COUNT;

    // Normalize [-4, +4] → [0, 1]
    const norm = vector.map(v => Math.max(0, Math.min(1, (v + 4) / 8)));

    // Angles: start top, go clockwise
    const angleFor = (i) => (-Math.PI / 2) + (i * 2 * Math.PI / axisCount);

    // 1) Grid polygons at 25/50/75/100
    ctx.strokeStyle = '#D5D5D5';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(scale => {
      ctx.beginPath();
      for (let i = 0; i < axisCount; i++) {
        const a = angleFor(i);
        const x = cx + Math.cos(a) * r * scale;
        const y = cy + Math.sin(a) * r * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    });

    // 2) Axes lines
    ctx.strokeStyle = '#D5D5D5';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }

    // 3) User polygon
    ctx.fillStyle = 'rgba(26, 26, 26, 0.12)';
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const x = cx + Math.cos(a) * r * norm[i];
      const y = cy + Math.sin(a) * r * norm[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4) User points
    ctx.fillStyle = '#1A1A1A';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const x = cx + Math.cos(a) * r * norm[i];
      const y = cy + Math.sin(a) * r * norm[i];
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5) Labels + percentage
    ctx.fillStyle = '#1A1A1A';
    ctx.font = '600 14px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < axisCount; i++) {
      const a = angleFor(i);
      const labelDist = r + 26;
      const lx = cx + Math.cos(a) * labelDist;
      const ly = cy + Math.sin(a) * labelDist;
      ctx.fillStyle = '#1A1A1A';
      ctx.fillText(DIM_LABELS[i], lx, ly - 8);

      ctx.fillStyle = '#8A8A8A';
      ctx.font = '400 12px -apple-system, sans-serif';
      ctx.fillText(Math.round(norm[i] * 100) + '%', lx, ly + 8);
      ctx.font = '600 14px -apple-system, "PingFang SC", "Noto Sans SC", sans-serif';
    }
  }

  // ------------------------------------------------------------
  // Highlight card copy — 季节限定度 (SP) / 群植浓度 (GA)
  // ------------------------------------------------------------
  function mdNoteFor(pct) {
    if (pct >= 80) return '限定款人格 · 错过这季再等一年';
    if (pct >= 60) return '有花期的那一型 · 该开就开个痛快';
    if (pct >= 40) return '半季节半常青 · 想浪能浪,想稳能稳';
    if (pct >= 20) return '常青为主 · 偶尔搞一场限定特别款';
    return '全年在线 · 365 天稳定输出不打烊';
  }
  function nzNoteFor(pct) {
    if (pct >= 80) return '热闹型 · 一个人喝奶茶坐不住三分钟';
    if (pct >= 60) return '有朋友才有趣 · 但能独处也能 social';
    if (pct >= 40) return '群独自由切换 · 看心情看天气';
    if (pct >= 20) return '独处省电 · 真心朋友不超过五个';
    return '独株美学 · 一个人就是一整片花海';
  }

  // ------------------------------------------------------------
  // Share / Restart
  // ------------------------------------------------------------
  async function shareLink() {
    const url = location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        legacyCopy(url);
      }
      showCopied();
    } catch (err) {
      try { legacyCopy(url); showCopied(); }
      catch (_) { el.btnShare.textContent = '复制失败 · 请手动复制'; }
    }
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  function showCopied() {
    el.btnShare.classList.add('is-copied');
    el.btnShare.textContent = '已复制 ✓';
    clearTimeout(showCopied._t);
    showCopied._t = setTimeout(() => {
      el.btnShare.classList.remove('is-copied');
      el.btnShare.textContent = '复制分享链接';
    }, 2000);
  }

  function restart() {
    state.view = 'intro';
    state.currentIdx = 0;
    state.answers = [];
    state.result = null;
    state.userVec = [0, 0, 0, 0];
    state.isAnimating = false;
    render();
  }

  // ------------------------------------------------------------
  // One-click long screenshot (iOS + Android + Desktop)
  // 1) Try Web Share API Level 2 (iOS 15+, Android Chrome) → native save sheet
  // 2) Android/Desktop fallback: trigger blob download
  // 3) iOS fallback: show image in modal, user long-presses to save
  // ------------------------------------------------------------
  // Switched from html-to-image (SVG-foreignObject pipeline, unreliable on iOS Safari)
  // to html2canvas (direct canvas paint via CSS parse). Different rendering path,
  // much more mature on mobile.
  const CAPTURE_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
  let _captureLibLoading = null;
  function ensureCaptureLib() {
    if (window.html2canvas) return Promise.resolve();
    if (_captureLibLoading) return _captureLibLoading;
    _captureLibLoading = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = CAPTURE_CDN;
      s.onload = function () { resolve(); };
      s.onerror = function () { _captureLibLoading = null; reject(new Error('html2canvas load failed')); };
      document.head.appendChild(s);
    });
    return _captureLibLoading;
  }

  async function embedImagesAsDataUrl(root) {
    const imgs = root.querySelectorAll('img');
    await Promise.all(Array.from(imgs).map(async function (img) {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;
      try {
        // resolve to absolute URL (mobile Safari quirk: SVG-embedded relative paths break)
        const abs = new URL(src, location.href).href;
        const res = await fetch(abs, { cache: 'force-cache' });
        const blob = await res.blob();
        const dataUrl = await new Promise(function (resolve, reject) {
          const r = new FileReader();
          r.onloadend = function () { resolve(r.result); };
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        img.src = dataUrl;
        if (typeof img.decode === 'function') { try { await img.decode(); } catch (_) {} }
      } catch (e) {
        console.warn('[PLANTTI] embed img fail, keep original', src, e);
      }
    }));
  }

  // Mobile Safari often fails to serialize live <canvas> inside html-to-image's
  // SVG foreignObject. Pre-snapshot to <img> and swap back after capture.
  function snapshotCanvases(root) {
    const swaps = [];
    root.querySelectorAll('canvas').forEach(function (canvas) {
      try {
        if (!canvas.width || !canvas.height) return;
        const dataUrl = canvas.toDataURL('image/png');
        const img = new Image();
        img.src = dataUrl;
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        // Copy layout sizing from the original canvas so layout doesn't shift
        const cs = window.getComputedStyle(canvas);
        img.style.width = cs.width;
        img.style.height = cs.height;
        img.style.display = cs.display === 'inline' ? 'inline-block' : (cs.display || 'block');
        img.style.verticalAlign = 'middle';
        const parent = canvas.parentNode;
        const next = canvas.nextSibling;
        parent.replaceChild(img, canvas);
        swaps.push({ canvas: canvas, img: img, parent: parent, next: next });
      } catch (e) {
        console.warn('[PLANTTI] canvas snapshot failed', e);
      }
    });
    return function restore() {
      swaps.forEach(function (s) {
        if (!s.img.parentNode) return;
        if (s.next && s.next.parentNode === s.parent) {
          s.parent.insertBefore(s.canvas, s.next);
        } else {
          s.parent.appendChild(s.canvas);
        }
        s.img.remove();
      });
    };
  }

  // Wait for every <img> in the tree to be load+decoded so the SVG rasterize
  // step doesn't grab them mid-decode (Safari blanks them otherwise).
  async function waitAllImagesReady(root) {
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all(imgs.map(function (img) {
      const settled = (img.complete && img.naturalWidth > 0)
        ? Promise.resolve()
        : new Promise(function (resolve) {
            const done = function () {
              img.removeEventListener('load', done);
              img.removeEventListener('error', done);
              resolve();
            };
            img.addEventListener('load', done);
            img.addEventListener('error', done);
            setTimeout(done, 2000);
          });
      return settled.then(function () {
        if (typeof img.decode === 'function') {
          return img.decode().catch(function () {});
        }
      });
    }));
  }

  function showSaveLoading(show) {
    if (!el.saveLoading) return;
    el.saveLoading.classList.toggle('visible', !!show);
  }
  function openSaveModal(dataUrl) {
    if (!el.saveModal || !el.saveModalImg) return;
    el.saveModalImg.src = dataUrl;
    el.saveModal.classList.add('visible');
    el.saveModal.setAttribute('aria-hidden', 'false');
  }
  function closeSaveModal() {
    if (!el.saveModal) return;
    el.saveModal.classList.remove('visible');
    el.saveModal.setAttribute('aria-hidden', 'true');
    if (el.saveModalImg) el.saveModalImg.src = '';
  }

  async function saveLongScreenshot() {
    const pet = state.result;
    if (!pet || !el.viewResult) return;
    if (el.btnSaveLong.disabled) return;

    const originalLabel = el.btnSaveLong.innerHTML;
    el.btnSaveLong.disabled = true;
    el.btnSaveLong.textContent = '生成中…';
    showSaveLoading(true);

    // Hide buttons/footer during capture
    el.viewResult.classList.add('result-capturing');

    let restoreCanvases = function () {};
    try {
      await ensureCaptureLib();
      // Step 1: inline every <img> as data URL + wait for decode
      await embedImagesAsDataUrl(el.viewResult);
      // Step 2: replace <canvas> (radar) with snapshot <img> — mobile safety
      restoreCanvases = snapshotCanvases(el.viewResult);
      // Step 3: wait for ALL imgs (including freshly-injected canvas snapshots)
      await waitAllImagesReady(el.viewResult);
      // Step 4: two animation frames to let layout settle
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });

      const scale = (window.devicePixelRatio && window.devicePixelRatio > 1) ? 2 : 1;
      // Step 5: capture via html2canvas (direct CSS-to-canvas paint, no SVG detour)
      const canvas = await window.html2canvas(el.viewResult, {
        backgroundColor: '#FFFFFF',
        scale: scale,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
        logging: false,
        imageTimeout: 8000,
        removeContainer: true
      });
      const blob = await new Promise(function (resolve, reject) {
        canvas.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('canvas.toBlob returned null'));
        }, 'image/png');
      });
      if (!blob) throw new Error('canvas toBlob returned null');

      const filename = 'plantti-' + pet.id + '-' + Date.now() + '.png';
      const file = new File([blob], filename, { type: 'image/png' });

      // Path 1: native share (iOS 15+, Android Chrome, most desktop browsers)
      let shared = false;
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'PLANTTI · 植塑测试',
            text: '本命植物给我写信了: ' + (pet.name_title || '') + ' ' + (pet.name || '')
          });
          shared = true;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') { shared = true; /* user cancelled, ok */ }
        else console.warn('[PLANTTI] share API failed, falling back', e);
      }

      if (!shared) {
        const ua = (navigator.userAgent || '').toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const dataUrl = await new Promise(function (resolve, reject) {
          const r = new FileReader();
          r.onloadend = function () { resolve(r.result); };
          r.onerror = reject;
          r.readAsDataURL(blob);
        });

        if (isIOS) {
          // Path 3: iOS long-press modal
          openSaveModal(dataUrl);
        } else {
          // Path 2: download (Android/Desktop)
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        }
      }
    } catch (err) {
      console.error('[PLANTTI] long screenshot failed', err);
      alert('截图生成失败,请稍后重试~');
    } finally {
      try { restoreCanvases(); } catch (_) {}
      el.viewResult.classList.remove('result-capturing');
      showSaveLoading(false);
      el.btnSaveLong.disabled = false;
      el.btnSaveLong.innerHTML = originalLabel;
    }
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
