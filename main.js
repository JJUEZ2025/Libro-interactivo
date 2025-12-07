document.addEventListener('DOMContentLoaded', async () => {
  console.log('App de Biblioteca + Lector');

  // ======= ELEMENTOS =======
  const libraryView = document.getElementById('library-view');
  const readerView  = document.getElementById('reader-view');
  const shelf       = document.getElementById('book-shelf');

  const homeBtn           = document.getElementById('home-btn');
  const mainTitle         = document.getElementById('main-title');

  const book         = document.getElementById('book');
  const pageWrapper  = document.getElementById('page-wrapper');
  const progressBar  = document.getElementById('progress-bar');

  const navToggle    = document.getElementById('nav-toggle');
  const navModal     = document.getElementById('nav-modal');
  const navClose     = document.getElementById('nav-close');
  const restartBtn   = document.getElementById('restart-btn');
  const historyList  = document.getElementById('history-list');

  const settingsToggle   = document.getElementById('settings-toggle');
  const settingsMenu     = document.getElementById('settings-menu');
  const increaseFontBtn  = document.getElementById('increase-font');
  const decreaseFontBtn  = document.getElementById('decrease-font');
  const themeSelectorBtn = document.getElementById('theme-selector');
  const fullscreenBtn    = document.getElementById('fullscreen-btn');
  const muteBtn          = document.getElementById('mute-btn');

  // ======= ESTADO =======
  let books = [];
  let story;
  let currentBookId = null;
  let currentStoryId = -1;
  let totalPagesInStory = 0;

  let pageHistory = [];
  let isTransitioning = false;
  let currentAudio = null;
  let isMuted = false;
  let fontSize = 1.1;

  const themes = ['light', 'sepia', 'bone', 'dark'];
  let currentThemeIndex = 0;

  // Colores para meta theme-color
  const themeColors = {
    light: '#fdf6e3',
    sepia: '#f4ecd8',
    bone:  '#f2f0e9',
    dark:  '#1a1a1a'
  };

  // ======= UTIL =======
  const $ = (sel) => document.querySelector(sel);
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function readerControlsVisible(isVisible){
    document.querySelectorAll('.reader-only').forEach(el => {
      if(isVisible) el.classList.remove('hidden'); else el.classList.add('hidden');
    });
    if(isVisible) { show(homeBtn); } else { hide(homeBtn); }
  }

  // ======= PREFERENCIAS =======
  function getPageHistoryKey(bookId){ return `book-${bookId}-pageHistory`; }

  function loadPreferences(){
    const savedFontSize = localStorage.getItem('fontSize');
    const savedTheme    = localStorage.getItem('theme');
    const savedMute     = localStorage.getItem('isMuted');

    if(savedFontSize){
      fontSize = parseFloat(savedFontSize);
      document.documentElement.style.setProperty('--font-size-dynamic', `${fontSize}rem`);
    }
    if(savedTheme && themes.includes(savedTheme)){
      currentThemeIndex = themes.indexOf(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme('light');
    }
    if(savedMute){ isMuted = JSON.parse(savedMute); updateMuteIcon(); }
  }
  function saveFontSize(){ localStorage.setItem('fontSize', fontSize); }
  function saveTheme(){ localStorage.setItem('theme', themes[currentThemeIndex]); }
  function saveMuteState(){ localStorage.setItem('isMuted', isMuted); }

  function savePageHistory(){
    if(!currentBookId) return;
    localStorage.setItem(getPageHistoryKey(currentBookId), JSON.stringify(pageHistory));
  }
  function loadPageHistoryFor(bookId){
    const raw = localStorage.getItem(getPageHistoryKey(bookId));
    return raw ? JSON.parse(raw) : null;
  }

  // ======= TEMAS =======
  function applyTheme(themeName){
    document.body.classList.remove('theme-light','theme-sepia','theme-bone','theme-dark');
    document.body.classList.add(`theme-${themeName}`);

    const meta = document.querySelector('meta[name=theme-color]');
    if(meta && themeColors[themeName]) meta.setAttribute('content', themeColors[themeName]);

    if(document.fullscreenElement){
      const bg = getComputedStyle(document.body).getPropertyValue('--bg-color').trim();
      document.documentElement.style.backgroundColor = bg;
      document.body.style.backgroundColor = bg;
    }
  }
  function changeFontSize(delta){
    fontSize = Math.max(0.8, Math.min(1.8, fontSize + delta));
    document.documentElement.style.setProperty('--font-size-dynamic', `${fontSize}rem`);
    saveFontSize();
  }
  function updateMuteIcon(){
    const unmuted = muteBtn?.querySelector('.unmuted');
    const muted   = muteBtn?.querySelector('.muted');
    if(unmuted && muted){
      unmuted.style.display = isMuted ? 'none' : 'inline-block';
      muted.style.display   = isMuted ? 'inline-block' : 'none';
    }
    muteBtn?.setAttribute('aria-label', isMuted ? 'Activar Sonido' : 'Silenciar Audio');
  }

  // ======= BIBLIOTECA =======
  async function loadBooks(){
    try{
      const res = await fetch('data/books.json');
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      books = await res.json();
      renderLibrary(books);
    }catch(e){
      console.error('Error cargando catálogo:', e);
      shelf.innerHTML = '<p>No se pudo cargar la biblioteca.</p>';
    }
  }

  function renderLibrary(items){
    shelf.innerHTML = '';
    items.forEach(bookItem => {
      const card = document.createElement('article');
      card.className = 'book-card';
      card.tabIndex = 0;
      card.setAttribute('role','button');
      card.setAttribute('aria-label', `Abrir ${bookItem.title}`);

      card.innerHTML = `
        <img class="book-cover" src="${bookItem.cover}" alt="Portada de ${bookItem.title}" loading="lazy" />
        <div class="book-info">
          <div class="book-title">${bookItem.title}</div>
          <div class="book-author">${bookItem.author || ''}</div>
          <div class="book-desc">${bookItem.description || ''}</div>
        </div>
      `;

      const open = () => { window.location.hash = `#/book/${bookItem.id}`; };
      card.addEventListener('click', open);
      card.addEventListener('keypress', (ev) => { if(ev.key === 'Enter') open(); });

      shelf.appendChild(card);
    });
  }

  function showLibraryView(){
    mainTitle.textContent = 'Lecturas Interactivas';
    readerControlsVisible(false);
    show(libraryView);
    hide(readerView);
  }

  // ======= LECTOR =======
  function stopCurrentAudio(){
    if(currentAudio){ currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
  }
  function playPageSound(pageId){
    stopCurrentAudio();
    if(isMuted) return;
    const pageData = story?.find(p => p.id === pageId);
    if(pageData && pageData.sound){
      currentAudio = new Audio(`sounds/${pageData.sound}`);
      currentAudio.loop = true;
      currentAudio.play().catch(e => console.error('Audio error:', e));
    }
  }

  async function loadStoryFor(bookConfig){
    try{
      const res = await fetch(bookConfig.storyFile);
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      story = await res.json();
      totalPagesInStory = story.length || 0;
    }catch(e){
      console.error('Error cargando historia:', e);
      pageWrapper.innerHTML = '<div class="page-content"><p>Error al cargar historia.</p></div>';
    }
  }

  function preloadNextImages(currentPageId){
    const currentPage = story?.find(p => p.id === currentPageId);
    if(!currentPage || !currentPage.choices) return;
    currentPage.choices.forEach(choice => {
      const nextPage = story.find(p => p.id === choice.page);
      if(nextPage?.images?.length){
        nextPage.images.forEach(src => { const i = new Image(); i.src = src; });
      }
    });
  }

  function renderPage(pageId){
    pageWrapper.innerHTML = '';
    const pageData = story?.find(p => p.id === pageId);
    if(!pageData){
      pageWrapper.innerHTML = '<div class="page-content"><p>Página no encontrada.</p></div>';
      return;
    }

    const pageContent = document.createElement('div');
    pageContent.className = 'page-content';

    const contentCenterer = document.createElement('div');
    contentCenterer.className = 'content-centerer';

    let html = '';
    if(pageData.images?.length){
      html += `<div class="images-container">${
        pageData.images.map(url => `<img src="${url}" alt="Ilustración" loading="eager">`).join('')
      }</div>`;
    }
    if(pageData.scenes?.length){
      const scenesHtml = pageData.scenes.map(s => `<p>${s.replace(/\n/g, '</p><p>')}</p>`).join('');
      html += `<div class="scenes-container">${scenesHtml}</div>`;
    }
    contentCenterer.innerHTML = html;

    if(pageData.choices && pageData.choices.length > 1){
      const choicesDiv = document.createElement('div');
      choicesDiv.className = 'choices';
      pageData.choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.textContent = choice.text;
        btn.addEventListener('click', (e) => { e.stopPropagation(); goToPage(choice.page); });
        choicesDiv.appendChild(btn);
      });
      contentCenterer.appendChild(choicesDiv);
    }

    pageContent.appendChild(contentCenterer);
    pageWrapper.appendChild(pageContent);

    if(pageData.page !== undefined){
      const num = document.createElement('div');
      num.className = 'page-number';
      num.textContent = `Página ${pageData.page}`;
      pageContent.appendChild(num);
    }

    preloadNextImages(pageId);
  }

  function updateUI(){
    if(totalPagesInStory === 0){ progressBar.style.width = '0%'; return; }
    const progress = (new Set(pageHistory).size / totalPagesInStory) * 100;
    progressBar.style.width = `${progress}%`;
  }

  function goToPage(pageId, isGoingBack = false){
    if(!story?.some(p => p.id === pageId) || isTransitioning) return;

    isTransitioning = true;
    pageWrapper.classList.remove('page-enter');
    pageWrapper.classList.add('page-exit');

    setTimeout(() => {
      renderPage(pageId);
      const contentDiv = pageWrapper.querySelector('.page-content');
      if(contentDiv) contentDiv.scrollTop = 0;

      currentStoryId = pageId;
      if(!pageHistory.includes(pageId) && !isGoingBack){ pageHistory.push(pageId); }
      savePageHistory(); playPageSound(pageId);

      pageWrapper.classList.remove('page-exit'); void pageWrapper.offsetWidth;
      pageWrapper.classList.add('page-enter');

      setTimeout(() => { isTransitioning = false; updateUI(); }, 500);
    }, 400);
  }

  function goBack(){
    if(isTransitioning || pageHistory.length <= 1) return;
    pageHistory.pop();
    goToPage(pageHistory[pageHistory.length - 1], true);
  }
  function goForward(){
    if(isTransitioning) return;
    const pageData = story?.find(p => p.id === currentStoryId);
    if(pageData?.choices?.length === 1){ goToPage(pageData.choices[0].page); }
  }

  function handleBookClick(event){
    if(isTransitioning || event.target.closest('.choices') || event.target.closest('button')) return;
    const rect = book.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    if(clickX < rect.width * 0.3) goBack(); else goForward();
  }

  // ======= NAVEGACIÓN MODAL =======
  function openNav(){ updateNavigationList(); navModal.classList.add('active'); }
  function closeNav(){ navModal.classList.remove('active'); }
  function updateNavigationList(){
    historyList.innerHTML = '';
    const milestones = pageHistory.filter((pageId, i) => {
      if(i === 0) return true;
      const pageData = story.find(p => p.id === pageId);
      return pageData?.choices?.length > 1;
    }).reverse();

    milestones.forEach(id => {
      const data = story.find(p => p.id === id);
      if(!data) return;
      const li = document.createElement('li');
      li.className = 'history-item decision';
      const title = (pageHistory.indexOf(id) === 0) ? 'Inicio' : 'Punto de Decisión';
      let preview = '';
      if(data.scenes?.length){
        const clean = data.scenes[0].replace(/<[^>]*>?/gm,'');
        preview = clean.substring(0, 50) + '...';
      }
      li.innerHTML = `<span class="history-title">${title} <span class="history-tag">Volver aquí</span></span><span class="history-preview">${preview}</span>`;
      li.addEventListener('click', () => { jumpToHistoryPoint(id); closeNav(); });
      historyList.appendChild(li);
    });

    if(milestones.length === 0){
      historyList.innerHTML = '<li class="history-item"><span class="history-preview">Avanza para ver decisiones.</span></li>';
    }
  }
  function jumpToHistoryPoint(targetId){
    if(targetId === currentStoryId) return;
    const idx = pageHistory.indexOf(targetId);
    if(idx !== -1){ pageHistory = pageHistory.slice(0, idx+1); goToPage(targetId, true); }
  }
  function restartStory(){
    if(confirm('¿Reiniciar historia?')){
      const startId = story[0].id;
      pageHistory = [startId];
      goToPage(startId, true);
      closeNav();
    }
  }

  // ======= FULLSCREEN (Android fix) =======
  function toggleFullscreen(){
    if(!document.fullscreenElement){
      document.documentElement.requestFullscreen({ navigationUI:'hide' }).catch(err => {
        console.error('Error fullscreen:', err);
        document.documentElement.requestFullscreen().catch(e => console.error(e));
      });
    } else {
      document.exitFullscreen();
    }
  }
  function onFullscreenChange(){
    const root = document.documentElement;
    if(document.fullscreenElement){
      document.body.classList.add('fullscreen-mode');
      root.classList.add('fullscreen-root');
      const bg = getComputedStyle(document.body).getPropertyValue('--bg-color').trim();
      root.style.backgroundColor = bg;
      document.body.style.backgroundColor = bg;
      setTimeout(() => window.scrollTo(0,0), 0);
    } else {
      document.body.classList.remove('fullscreen-mode');
      root.classList.remove('fullscreen-root');
      root.style.backgroundColor = '';
      document.body.style.backgroundColor = '';
    }
  }

  // ======= ROUTER (hash) =======
  async function handleRoute(){
    const hash = window.location.hash || '#/';

    // Home
    if(hash === '#/' || hash === ''){
      showLibraryView();
      return;
    }

    // /book/:id
    const match = hash.match(/^#\/book\/(.+)$/);
    if(match){
      const id = decodeURIComponent(match[1]);
      const cfg = books.find(b => b.id === id);
      if(!cfg){ showLibraryView(); return; }
      await openBook(cfg);
    }
  }

  async function openBook(cfg){
    currentBookId = cfg.id;
    mainTitle.textContent = cfg.title;

    await loadStoryFor(cfg);

    const saved = loadPageHistoryFor(currentBookId);
    if(saved?.length){
      pageHistory = saved;
      currentStoryId = pageHistory[pageHistory.length - 1];
    } else {
      currentStoryId = story[0].id;
      pageHistory = [currentStoryId];
    }

    renderPage(currentStoryId);
    playPageSound(currentStoryId);
    updateUI();

    // Mostrar lector
    hide(libraryView);
    show(readerView);
    readerControlsVisible(true);
    window.scrollTo(0,0);
  }

  // ======= EVENTOS =======
  // Biblioteca
  homeBtn.addEventListener('click', () => { window.location.hash = '#/'; });

  // Lector
  navToggle.addEventListener('click', openNav);
  navClose.addEventListener('click', closeNav);
  restartBtn.addEventListener('click', restartStory);
  navModal.addEventListener('click', (e) => { if(e.target === navModal) closeNav(); });

  settingsToggle.addEventListener('click', () => settingsMenu.classList.toggle('visible'));
  increaseFontBtn.addEventListener('click', () => changeFontSize(0.1));
  decreaseFontBtn.addEventListener('click', () => changeFontSize(-0.1));
  themeSelectorBtn.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(themes[currentThemeIndex]); saveTheme();
  });
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted; updateMuteIcon(); saveMuteState();
    if(isMuted) stopCurrentAudio(); else playPageSound(currentStoryId);
  });

  book.addEventListener('click', handleBookClick);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // ======= INIT =======
  function hideFullscreenOnIOS(){
    if(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream){
      fullscreenBtn.style.display = 'none';
    }
  }

  async function init(){
    loadPreferences();
    hideFullscreenOnIOS();
    await loadBooks();
    await handleRoute();
  }

  window.addEventListener('hashchange', handleRoute);
  init();
});
