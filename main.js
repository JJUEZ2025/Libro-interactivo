document.addEventListener('DOMContentLoaded', async () => {
    console.log("Iniciando Libro Interactivo - Inmersión Total Android");

    // Elements
    const book = document.getElementById('book');
    const pageWrapper = document.getElementById('page-wrapper'); 
    const increaseFontBtn = document.getElementById('increase-font');
    const decreaseFontBtn = document.getElementById('decrease-font');
    const themeSelectorBtn = document.getElementById('theme-selector');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsMenu = document.getElementById('settings-menu');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const muteBtn = document.getElementById('mute-btn');
    const progressBar = document.getElementById('progress-bar');
    
    const navToggle = document.getElementById('nav-toggle');
    const navModal = document.getElementById('nav-modal');
    const navClose = document.getElementById('nav-close');
    const restartBtn = document.getElementById('restart-btn');
    const historyList = document.getElementById('history-list');

    // State
    let story;
    let currentStoryId = -1;
    let pageHistory = [];
    let fontSize = 1.1;
    const themes = ['light', 'sepia', 'bone', 'dark'];
    let currentThemeIndex = 0;
    let isTransitioning = false;
    let currentAudio = null;
    let isMuted = false;
    let totalPagesInStory = 0;

    // Diccionario de colores para la barra de Android (Meta Theme Color)
    const themeColors = {
        'light': '#fdf6e3', // Color de la página
        'sepia': '#f4ecd8',
        'bone': '#f2f0e9',
        'dark': '#1a1a1a'
    };

    // --- Preferences ---
    function loadPreferences() {
        const savedFontSize = localStorage.getItem('fontSize');
        const savedTheme = localStorage.getItem('theme');
        const savedMuteState = localStorage.getItem('isMuted');

        if (savedFontSize) {
            fontSize = parseFloat(savedFontSize);
            document.documentElement.style.setProperty('--font-size-dynamic', `${fontSize}rem`);
        }
        if (savedTheme && themes.includes(savedTheme)) {
            currentThemeIndex = themes.indexOf(savedTheme);
            applyTheme(savedTheme);
        } else {
            applyTheme('light'); 
        }
        if (savedMuteState) {
            isMuted = JSON.parse(savedMuteState);
            updateMuteIcon();
        }
    }

    function saveFontSize() { localStorage.setItem('fontSize', fontSize); }
    function saveTheme() { localStorage.setItem('theme', themes[currentThemeIndex]); }
    function savePageHistory() { localStorage.setItem('frankestein-pageHistory', JSON.stringify(pageHistory)); }
    function saveMuteState() { localStorage.setItem('isMuted', isMuted); }
    function loadPageHistory() {
        const savedHistory = localStorage.getItem('frankestein-pageHistory');
        return savedHistory ? JSON.parse(savedHistory) : null;
    }

    // --- Theme Logic (MEJORADA) ---
    function applyTheme(themeName) {
        // 1. Cambiar clases CSS
        document.body.classList.remove('theme-light', 'theme-sepia', 'theme-bone', 'theme-dark');
        document.body.classList.add(`theme-${themeName}`);
        
        // 2. Actualizar Meta Theme Color (Para barra Android)
        const metaThemeColor = document.querySelector("meta[name=theme-color]");
        if (metaThemeColor && themeColors[themeName]) {
            metaThemeColor.setAttribute("content", themeColors[themeName]);
        }
    }

    function updateMuteIcon() {
        const unmutedSvg = muteBtn.querySelector('.unmuted');
        const mutedSvg = muteBtn.querySelector('.muted');
        if (unmutedSvg && mutedSvg) {
            unmutedSvg.style.display = isMuted ? 'none' : 'inline-block';
            mutedSvg.style.display = isMuted ? 'inline-block' : 'none';
        }
        muteBtn.setAttribute('aria-label', isMuted ? 'Activar Sonido' : 'Silenciar Audio');
    }

    // --- NAVEGACIÓN FILTRADA (HITOS) ---
    function openNav() { updateNavigationList(); navModal.classList.add('active'); }
    function closeNav() { navModal.classList.remove('active'); }

    function updateNavigationList() {
        historyList.innerHTML = '';
        const milestones = pageHistory.filter((pageId, index) => {
            if (index === 0) return true; 
            const pageData = story.find(p => p.id === pageId);
            return pageData && pageData.choices && pageData.choices.length > 1;
        });
        const recentMilestones = milestones.reverse();

        recentMilestones.forEach((pageId) => {
            const pageData = story.find(p => p.id === pageId);
            if (!pageData) return;
            const li = document.createElement('li');
            li.className = 'history-item decision'; 
            let title = (pageHistory.indexOf(pageId) === 0) ? "Inicio" : "Punto de Decisión";
            let preview = "";
            if (pageData.scenes && pageData.scenes.length > 0) {
                const cleanText = pageData.scenes[0].replace(/<[^>]*>?/gm, '');
                preview = cleanText.substring(0, 50) + "...";
            }
            li.innerHTML = `<span class="history-title">${title} <span class="history-tag">Volver aquí</span></span><span class="history-preview">${preview}</span>`;
            li.addEventListener('click', () => { jumpToHistoryPoint(pageId); closeNav(); });
            historyList.appendChild(li);
        });
        if(recentMilestones.length === 0) {
            historyList.innerHTML = '<li class="history-item"><span class="history-preview">Avanza para ver decisiones.</span></li>';
        }
    }

    function jumpToHistoryPoint(targetId) {
        if (targetId === currentStoryId) return;
        const targetIndex = pageHistory.indexOf(targetId);
        if (targetIndex !== -1) {
            pageHistory = pageHistory.slice(0, targetIndex + 1);
            goToPage(targetId, true);
        }
    }

    function restartStory() {
        if(confirm("¿Reiniciar historia?")) {
            const startId = story[0].id;
            pageHistory = [startId];
            goToPage(startId, true);
            closeNav();
        }
    }

    // --- PRE-CARGA ---
    function preloadNextImages(currentPageId) {
        const currentPage = story.find(p => p.id === currentPageId);
        if (!currentPage || !currentPage.choices) return;
        currentPage.choices.forEach(choice => {
            const nextPage = story.find(p => p.id === choice.page);
            if (nextPage && nextPage.images && nextPage.images.length > 0) {
                nextPage.images.forEach(imgUrl => {
                    const img = new Image();
                    img.src = imgUrl;
                });
            }
        });
    }

    async function loadStory() {
        try {
            const response = await fetch('story.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            story = await response.json();
            totalPagesInStory = story.length; 
        } catch (error) {
            console.error('Error:', error);
            pageWrapper.innerHTML = '<div class="page-content"><p>Error al cargar historia.</p></div>';
        }
    }
    
    function stopCurrentAudio() {
        if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; currentAudio = null; }
    }

    function playPageSound(pageId) {
        stopCurrentAudio();
        if (isMuted) return;
        const pageData = story.find(p => p.id === pageId);
        if (pageData && pageData.sound) {
            currentAudio = new Audio(`sounds/${pageData.sound}`);
            currentAudio.loop = true;
            currentAudio.play().catch(e => console.error("Audio:", e));
        }
    }

    function renderPage(pageId) {
        pageWrapper.innerHTML = ''; 
        const pageData = story.find(p => p.id === pageId);
        if (!pageData) {
            pageWrapper.innerHTML = '<div class="page-content"><p>Página no encontrada.</p></div>';
            return;
        }

        const pageContent = document.createElement('div');
        pageContent.className = 'page-content';
        const contentCenterer = document.createElement('div');
        contentCenterer.className = 'content-centerer';

        let contentHtml = '';
        if (pageData.images && pageData.images.length > 0) {
            contentHtml += `<div class="images-container">${pageData.images.map(url => `<img src="${url}" alt="Ilustración" loading="eager">`).join('')}</div>`;
        }
        if (pageData.scenes && pageData.scenes.length > 0) {
            const scenesHtml = pageData.scenes.map(s => `<p>${s.replace(/\n/g, '</p><p>')}</p>`).join('');
            contentHtml += `<div class="scenes-container">${scenesHtml}</div>`;
        }
        
        contentCenterer.innerHTML = contentHtml;

        if (pageData.choices && pageData.choices.length > 1) {
            const choicesDiv = document.createElement('div');
            choicesDiv.className = 'choices';
            pageData.choices.forEach(choice => {
                const button = document.createElement('button');
                button.textContent = choice.text;
                button.addEventListener('click', (e) => { e.stopPropagation(); goToPage(choice.page); });
                choicesDiv.appendChild(button);
            });
            contentCenterer.appendChild(choicesDiv);
        }
        
        pageContent.appendChild(contentCenterer);
        pageWrapper.appendChild(pageContent);

        if (pageData.page !== undefined) {
            const pageNumberDiv = document.createElement('div');
            pageNumberDiv.className = 'page-number';
            pageNumberDiv.textContent = `Página ${pageData.page}`;
            pageContent.appendChild(pageNumberDiv);
        }
        preloadNextImages(pageId);
    }

    function updateUI() {
        if (totalPagesInStory === 0) { progressBar.style.width = '0%'; return; }
        const uniqueVisitedPages = new Set(pageHistory);
        const progress = (uniqueVisitedPages.size / totalPagesInStory) * 100;
        progressBar.style.width = `${progress}%`;
    }

    function changeFontSize(amount) {
        fontSize = Math.max(0.8, Math.min(1.8, fontSize + amount));
        document.documentElement.style.setProperty('--font-size-dynamic', `${fontSize}rem`);
        saveFontSize();
    }

    function cycleTheme() {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        applyTheme(newTheme);
        saveTheme();
    }

    function toggleSettingsMenu() { settingsMenu.classList.toggle('visible'); }
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else { document.exitFullscreen(); }
    }
    function toggleMute() {
        isMuted = !isMuted; updateMuteIcon(); saveMuteState();
        if (isMuted) stopCurrentAudio(); else playPageSound(currentStoryId);
    }

    function goToPage(pageId, isGoingBack = false) {
        if (!story.some(p => p.id === pageId) || isTransitioning) return;
        isTransitioning = true;
        pageWrapper.classList.remove('page-enter'); pageWrapper.classList.add('page-exit');
        setTimeout(() => {
            renderPage(pageId);
            const contentDiv = pageWrapper.querySelector('.page-content');
            if (contentDiv) contentDiv.scrollTop = 0;
            currentStoryId = pageId;
            if (!pageHistory.includes(pageId) && !isGoingBack) { pageHistory.push(pageId); }
            savePageHistory(); playPageSound(pageId);
            pageWrapper.classList.remove('page-exit'); void pageWrapper.offsetWidth; pageWrapper.classList.add('page-enter');
            setTimeout(() => { isTransitioning = false; updateUI(); }, 500); 
        }, 400); 
    }

    function goBack() {
        if (isTransitioning || pageHistory.length <= 1) return;
        pageHistory.pop();
        const previousPageId = pageHistory[pageHistory.length - 1];
        goToPage(previousPageId, true);
    }

    function goForward() {
        if (isTransitioning) return;
        const pageData = story.find(p => p.id === currentStoryId);
        if (pageData && pageData.choices && pageData.choices.length === 1) {
            goToPage(pageData.choices[0].page);
        }
    }

    function handleBookClick(event) {
        if (isTransitioning || event.target.closest('.choices') || event.target.closest('button')) return;
        const bookRect = book.getBoundingClientRect();
        const clickX = event.clientX - bookRect.left;
        if (clickX < bookRect.width * 0.3) goBack(); else goForward();
    }

    navToggle.addEventListener('click', openNav);
    navClose.addEventListener('click', closeNav);
    restartBtn.addEventListener('click', restartStory);
    navModal.addEventListener('click', (e) => { if (e.target === navModal) closeNav(); });

    increaseFontBtn.addEventListener('click', () => changeFontSize(0.1));
    decreaseFontBtn.addEventListener('click', () => changeFontSize(-0.1));
    themeSelectorBtn.addEventListener('click', cycleTheme);
    settingsToggle.addEventListener('click', toggleSettingsMenu);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    muteBtn.addEventListener('click', toggleMute);
    book.addEventListener('click', handleBookClick);

    document.addEventListener('fullscreenchange', () => { setTimeout(() => window.scrollTo(0, 0), 50); });

    async function initializeApp() {
        loadPreferences();
        await loadStory();
        if (story) {
            const loadedHistory = loadPageHistory();
            if (loadedHistory && loadedHistory.length > 0) {
                pageHistory = loadedHistory;
                currentStoryId = pageHistory[pageHistory.length - 1];
            } else {
                currentStoryId = story[0].id;
                pageHistory = [currentStoryId];
            }
            renderPage(currentStoryId);
            playPageSound(currentStoryId);
            updateUI();
            window.scrollTo(0, 0);
        }
    }

    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        fullscreenBtn.style.display = 'none';
    }

    initializeApp();
});
