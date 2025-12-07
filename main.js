document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando Lecturas Interactivas");

    // ELEMENTOS BÁSICOS
    const appContainer = document.getElementById('app-container');
    const libraryView = document.getElementById('library-view');
    const libraryGrid = document.getElementById('library-grid');
    const readerView = document.getElementById('reader-view');

    const book = document.getElementById('book');
    const pageWrapper = document.getElementById('page-wrapper');

    const mainTitle = document.getElementById('main-title');
    const backToLibraryBtn = document.getElementById('back-to-library');

    const increaseFontBtn = document.getElementById('increase-font');
    const decreaseFontBtn = document.getElementById('decrease-font');
    const themeSelectorBtn = document.getElementById('theme-selector');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsMenu = document.getElementById('settings-menu');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const muteBtn = document.getElementById('mute-btn');

    const navToggle = document.getElementById('nav-toggle');
    const navModal = document.getElementById('nav-modal');
    const navClose = document.getElementById('nav-close');
    const restartBtn = document.getElementById('restart-btn');
    const historyList = document.getElementById('history-list');

    const progressBar = document.getElementById('progress-bar');
    const appFooter = document.getElementById('app-footer');

    // ESTADO GENERAL
    let appMode = 'library'; // 'library' | 'reader'
    let books = [];
    let currentBook = null;

    // Estado de lectura
    let story = null;
    let currentStoryId = -1;
    let pageHistory = [];
    let fontSize = 1.1;

    const readerThemes = ['light', 'sepia', 'bone', 'dark'];
    const libraryThemes = ['light', 'dark'];
    let currentTheme = 'light';

    let isTransitioning = false;
    let currentAudio = null;
    let isMuted = false;
    let totalPagesInStory = 0;

    const themeColors = {
        light: '#fdf6e3',
        sepia: '#f4ecd8',
        bone: '#f2f0e9',
        dark: '#1a1a1a'
    };

    /* =========================
       PREFERENCIAS
       ========================= */

    function loadPreferences() {
        const savedFontSize = localStorage.getItem('fontSize');
        const savedTheme = localStorage.getItem('theme');
        const savedMuteState = localStorage.getItem('isMuted');

        if (savedFontSize) {
            fontSize = parseFloat(savedFontSize);
            document.documentElement.style.setProperty('--font-size-dynamic', `${fontSize}rem`);
        }

        if (savedTheme && (readerThemes.includes(savedTheme) || libraryThemes.includes(savedTheme))) {
            currentTheme = savedTheme;
        } else {
            currentTheme = 'light';
        }
        applyTheme(currentTheme);

        if (savedMuteState) {
            isMuted = JSON.parse(savedMuteState);
            updateMuteIcon();
        }
    }

    function saveFontSize() {
        localStorage.setItem('fontSize', fontSize);
    }

    function saveTheme() {
        localStorage.setItem('theme', currentTheme);
    }

    function saveMuteState() {
        localStorage.setItem('isMuted', isMuted);
    }

    function getPageHistoryKey(bookId) {
        return `pageHistory-${bookId}`;
    }

    function savePageHistory() {
        if (!currentBook) return;
        localStorage.setItem(getPageHistoryKey(currentBook.id), JSON.stringify(pageHistory));
    }

    function loadPageHistory(bookId) {
        const savedHistory = localStorage.getItem(getPageHistoryKey(bookId));
        return savedHistory ? JSON.parse(savedHistory) : null;
    }

    /* =========================
       TEMAS
       ========================= */

    function applyTheme(themeName) {
        document.body.classList.remove('theme-light', 'theme-sepia', 'theme-bone', 'theme-dark');

        const className = `theme-${themeName}`;
        document.body.classList.add(className);

        const metaThemeColor = document.querySelector("meta[name=theme-color]");
        if (metaThemeColor && themeColors[themeName]) {
            metaThemeColor.setAttribute('content', themeColors[themeName]);
        }
    }

    function cycleTheme() {
        const palette = (appMode === 'reader') ? readerThemes : libraryThemes;

        let index = palette.indexOf(currentTheme);
        if (index === -1) index = 0;

        const nextIndex = (index + 1) % palette.length;
        currentTheme = palette[nextIndex];

        applyTheme(currentTheme);
        saveTheme();
    }

    function updateMuteIcon() {
        const unmutedSvg = muteBtn.querySelector('.unmuted');
        const mutedSvg = muteBtn.querySelector('.muted');

        if (!unmutedSvg || !mutedSvg) return;

        unmutedSvg.style.display = isMuted ? 'none' : 'inline-block';
        mutedSvg.style.display = isMuted ? 'inline-block' : 'none';

        muteBtn.setAttribute('aria-label', isMuted ? 'Activar sonido' : 'Silenciar audio');
    }

    /* =========================
       BIBLIOTECA
       ========================= */

    async function loadBooks() {
        try {
            const response = await fetch('data/books.json');
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            books = await response.json();
            renderLibrary();
        } catch (error) {
            console.error('Error al cargar books.json:', error);
            libraryGrid.innerHTML = '<p>No se pudieron cargar los libros.</p>';
        }
    }

    function renderLibrary() {
        libraryGrid.innerHTML = '';

        if (!books || books.length === 0) {
            libraryGrid.innerHTML = '<p>Tu biblioteca está vacía.</p>';
            return;
        }

        books.forEach((bookData) => {
            const hasStory = Boolean(bookData.storyFile);

            const card = document.createElement('article');
            card.className = 'book-card';
            if (!hasStory) card.classList.add('book-card--disabled');
            card.dataset.bookId = bookData.id;

            const coverWrapper = document.createElement('div');
            coverWrapper.className = 'book-cover-wrapper';

            if (bookData.cover) {
                const img = document.createElement('img');
                img.src = bookData.cover;
                img.alt = `Portada de ${bookData.title || 'libro'}`;
                img.loading = 'lazy';
                img.className = 'book-cover';
                coverWrapper.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'book-cover placeholder';
                placeholder.textContent = 'Próximamente';
                coverWrapper.appendChild(placeholder);
            }

            if (!hasStory) {
                const tag = document.createElement('span');
                tag.className = 'book-tag';
                tag.textContent = 'Próximamente';
                coverWrapper.appendChild(tag);
            }

            const body = document.createElement('div');
            body.className = 'book-card-body';

            const titleEl = document.createElement('h3');
            titleEl.className = 'book-title';
            titleEl.textContent = bookData.title || 'Título pendiente';

            const authorEl = document.createElement('p');
            authorEl.className = 'book-author';
            authorEl.textContent = bookData.author || '';

            const descEl = document.createElement('p');
            descEl.className = 'book-description';
            descEl.textContent = bookData.description || '';

            const btn = document.createElement('button');
            btn.className = 'book-open-btn';
            btn.textContent = hasStory ? 'Leer' : 'Muy pronto';
            btn.disabled = !hasStory;

            body.appendChild(titleEl);
            if (bookData.author) body.appendChild(authorEl);
            if (bookData.description) body.appendChild(descEl);
            body.appendChild(btn);

            card.appendChild(coverWrapper);
            card.appendChild(body);
            libraryGrid.appendChild(card);

            if (hasStory) {
                const openHandler = (ev) => {
                    ev.stopPropagation();
                    openBook(bookData);
                };
                card.addEventListener('click', openHandler);
                btn.addEventListener('click', openHandler);
            }
        });
    }

    function switchToLibraryView() {
        appMode = 'library';
        document.body.classList.remove('app-mode-reader');
        document.body.classList.add('app-mode-library');

        libraryView.hidden = false;
        readerView.hidden = true;

        backToLibraryBtn.classList.add('hidden');
        navToggle.classList.add('hidden');
        fullscreenBtn.classList.add('hidden');
        if (appFooter) appFooter.classList.add('hidden');

        mainTitle.textContent = 'Lecturas Interactivas';

        stopCurrentAudio();
    }

    function switchToReaderView() {
        appMode = 'reader';
        document.body.classList.remove('app-mode-library');
        document.body.classList.add('app-mode-reader');

        libraryView.hidden = true;
        readerView.hidden = false;
        readerView.classList.add('active');

        backToLibraryBtn.classList.remove('hidden');
        navToggle.classList.remove('hidden');

        // En iOS no mostramos fullscreen
        if (!isIOS()) {
            fullscreenBtn.classList.remove('hidden');
        }

        if (appFooter) appFooter.classList.remove('hidden');
    }

    async function openBook(bookData) {
        if (!bookData || !bookData.storyFile) return;

        currentBook = bookData;
        mainTitle.textContent = bookData.title || 'Lectura';

        await loadStory(bookData.storyFile);

        if (!story) return;

        const loadedHistory = loadPageHistory(currentBook.id);
        if (loadedHistory && loadedHistory.length > 0) {
            pageHistory = loadedHistory;
            currentStoryId = pageHistory[pageHistory.length - 1];
        } else {
            currentStoryId = story[0].id;
            pageHistory = [currentStoryId];
        }

        switchToReaderView();
        goToPage(currentStoryId, true); // true => no vuelve a pushear al historial
    }

    backToLibraryBtn.addEventListener('click', () => {
        switchToLibraryView();
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    /* =========================
       HISTORIA / LECTOR
       ========================= */

    async function loadStory(storyFilePath) {
        try {
            const response = await fetch(storyFilePath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            story = await response.json();
            totalPagesInStory = story.length;
        } catch (error) {
            console.error('Error al cargar historia:', error);
            story = null;
            pageWrapper.innerHTML = '<div class="page-content"><div class="content-centerer"><p>Error al cargar la historia.</p></div></div>';
        }
    }

    function stopCurrentAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
    }

    function playPageSound(pageId) {
        stopCurrentAudio();
        if (isMuted || !story) return;

        const pageData = story.find(p => p.id === pageId);
        if (pageData && pageData.sound) {
            currentAudio = new Audio(`sounds/${pageData.sound}`);
            currentAudio.loop = true;
            currentAudio.play().catch(err => console.error('Error al reproducir audio:', err));
        }
    }

    function preloadNextImages(currentPageId) {
        if (!story) return;
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

    function renderPage(pageId) {
        pageWrapper.innerHTML = '';

        if (!story) {
            pageWrapper.innerHTML = '<div class="page-content"><div class="content-centerer"><p>Historia no cargada.</p></div></div>';
            return;
        }

        const pageData = story.find(p => p.id === pageId);
        if (!pageData) {
            pageWrapper.innerHTML = '<div class="page-content"><div class="content-centerer"><p>Página no encontrada.</p></div></div>';
            return;
        }

        const pageContent = document.createElement('div');
        pageContent.className = 'page-content';

        const contentCenterer = document.createElement('div');
        contentCenterer.className = 'content-centerer';

        let contentHtml = '';

        if (pageData.images && pageData.images.length > 0) {
            const imgsHtml = pageData.images
                .map(url => `<img src="${url}" alt="Ilustración" loading="eager">`)
                .join('');
            contentHtml += `<div class="images-container">${imgsHtml}</div>`;
        }

        if (pageData.scenes && pageData.scenes.length > 0) {
            const scenesHtml = pageData.scenes
                .map(s => `<p>${s.replace(/\n/g, '</p><p>')}</p>`)
                .join('');
            contentHtml += `<div class="scenes-container">${scenesHtml}</div>`;
        }

        contentCenterer.innerHTML = contentHtml;

        if (pageData.choices && pageData.choices.length > 1) {
            const choicesDiv = document.createElement('div');
            choicesDiv.className = 'choices';

            pageData.choices.forEach(choice => {
                const btn = document.createElement('button');
                btn.textContent = choice.text;
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    goToPage(choice.page);
                });
                choicesDiv.appendChild(btn);
            });

            contentCenterer.appendChild(choicesDiv);
        }

        pageContent.appendChild(contentCenterer);

        if (pageData.page !== undefined) {
            const pageNumberDiv = document.createElement('div');
            pageNumberDiv.className = 'page-number';
            pageNumberDiv.textContent = `Página ${pageData.page}`;
            pageContent.appendChild(pageNumberDiv);
        }

        pageWrapper.appendChild(pageContent);
        preloadNextImages(pageId);
    }

    function resetScrollPosition() {
        const pageContent = pageWrapper.querySelector('.page-content');

        if (pageContent) {
            pageContent.scrollTop = 0;
        }
        pageWrapper.scrollTop = 0;
        if (readerView) readerView.scrollTop = 0;
        if (book) book.scrollTop = 0;

        // Reset del scroll de la ventana (modo normal)
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        if (typeof window.scrollTo === 'function') {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }

    function updateUI() {
        if (!story || totalPagesInStory === 0) {
            progressBar.style.width = '0%';
            return;
        }
        const uniqueVisited = new Set(pageHistory);
        const progress = (uniqueVisited.size / totalPagesInStory) * 100;
        progressBar.style.width = `${progress}%`;
    }

    function goToPage(pageId, isGoingBack = false) {
        if (!story || isTransitioning) return;
        if (!story.some(p => p.id === pageId)) return;

        isTransitioning = true;
        pageWrapper.classList.remove('page-enter');
        pageWrapper.classList.add('page-exit');

        setTimeout(() => {
            renderPage(pageId);
            resetScrollPosition();

            currentStoryId = pageId;
            if (!isGoingBack && !pageHistory.includes(pageId)) {
                pageHistory.push(pageId);
            }

            savePageHistory();
            playPageSound(pageId);

            pageWrapper.classList.remove('page-exit');
            // Reinicia la animación
            void pageWrapper.offsetWidth;
            pageWrapper.classList.add('page-enter');

            setTimeout(() => {
                isTransitioning = false;
                updateUI();
            }, 500);
        }, 400);
    }

    function goBack() {
        if (isTransitioning || pageHistory.length <= 1) return;

        pageHistory.pop();
        const prevId = pageHistory[pageHistory.length - 1];
        goToPage(prevId, true);
    }

    function goForward() {
        if (isTransitioning || !story) return;

        const pageData = story.find(p => p.id === currentStoryId);
        if (pageData && pageData.choices && pageData.choices.length === 1) {
            goToPage(pageData.choices[0].page);
        }
    }

    function handleBookClick(event) {
        if (appMode !== 'reader') return;
        if (isTransitioning) return;
        if (event.target.closest('.choices') || event.target.closest('button')) return;

        const rect = book.getBoundingClientRect();
        const clickX = event.clientX - rect.left;

        if (clickX < rect.width * 0.3) {
            goBack();
        } else {
            goForward();
        }
    }

    book.addEventListener('click', handleBookClick);

    /* =========================
       NAVEGACIÓN / HISTORIAL
       ========================= */

    function openNav() {
        if (!story) return;
        updateNavigationList();
        navModal.classList.add('active');
    }

    function closeNav() {
        navModal.classList.remove('active');
    }

    function updateNavigationList() {
        historyList.innerHTML = '';

        if (!story || !pageHistory.length) {
            historyList.innerHTML = '<li class="history-item"><span class="history-preview">Aún no has avanzado en esta historia.</span></li>';
            return;
        }

        const milestones = pageHistory.filter((pageId, index) => {
            if (index === 0) return true;
            const pageData = story.find(p => p.id === pageId);
            return pageData && pageData.choices && pageData.choices.length > 1;
        });

        const recentMilestones = milestones.slice().reverse();

        if (recentMilestones.length === 0) {
            historyList.innerHTML = '<li class="history-item"><span class="history-preview">Avanza para ver decisiones.</span></li>';
            return;
        }

        recentMilestones.forEach(pageId => {
            const pageData = story.find(p => p.id === pageId);
            if (!pageData) return;

            const li = document.createElement('li');
            li.className = 'history-item decision';

            const isStart = (pageHistory.indexOf(pageId) === 0);
            const title = isStart ? 'Inicio' : 'Punto de decisión';

            let preview = '';
            if (pageData.scenes && pageData.scenes.length > 0) {
                const clean = pageData.scenes[0].replace(/<[^>]*>?/gm, '');
                preview = clean.substring(0, 60) + (clean.length > 60 ? '…' : '');
            }

            li.innerHTML = `<span class="history-title">${title} <span class="history-tag">Volver aquí</span></span>
                            <span class="history-preview">${preview}</span>`;

            li.addEventListener('click', () => {
                jumpToHistoryPoint(pageId);
                closeNav();
            });

            historyList.appendChild(li);
        });
    }

    function jumpToHistoryPoint(targetId) {
        if (!story) return;
        if (targetId === currentStoryId) return;

        const idx = pageHistory.indexOf(targetId);
        if (idx !== -1) {
            pageHistory = pageHistory.slice(0, idx + 1);
            goToPage(targetId, true);
        }
    }

    function restartStory() {
        if (!story || !currentBook) return;

        const confirmed = confirm('¿Reiniciar historia desde el inicio?');
        if (!confirmed) return;

        const startId = story[0].id;
        pageHistory = [startId];
        savePageHistory();
        goToPage(startId, true);
        closeNav();
    }

    navToggle.addEventListener('click', openNav);
    navClose.addEventListener('click', closeNav);
    restartBtn.addEventListener('click', restartStory);

    navModal.addEventListener('click', (ev) => {
        if (ev.target === navModal) {
            closeNav();
        }
    });

    /* =========================
       AJUSTES: FUENTE / TEMA / FULLSCREEN / AUDIO
       ========================= */

    function changeFontSize(delta) {
        fontSize = Math.max(0.8, Math.min(1.8, fontSize + delta));
        document.documentElement.style.setProperty('--font-size-dynamic', `${fontSize}rem`);
        saveFontSize();
    }

    function toggleSettingsMenu() {
        settingsMenu.classList.toggle('visible');
    }

    function toggleMute() {
        isMuted = !isMuted;
        updateMuteIcon();
        saveMuteState();

        if (isMuted) {
            stopCurrentAudio();
        } else if (currentStoryId !== -1) {
            playPageSound(currentStoryId);
        }
    }

    function toggleFullscreen() {
        if (isIOS()) return;

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(err => {
                console.error('Error al entrar en fullscreen:', err);
                document.documentElement.requestFullscreen().catch(e => console.error(e));
            });
        } else {
            document.exitFullscreen().catch(err => console.error('Error al salir de fullscreen:', err));
        }
    }

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            document.body.classList.add('fullscreen-mode');
            // aseguramos que la página empieza arriba al entrar en FS
            resetScrollPosition();
        } else {
            document.body.classList.remove('fullscreen-mode');
            // al salir de FS volvemos a arriba
            resetScrollPosition();
        }
    });

    function isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    increaseFontBtn.addEventListener('click', () => changeFontSize(0.1));
    decreaseFontBtn.addEventListener('click', () => changeFontSize(-0.1));
    themeSelectorBtn.addEventListener('click', cycleTheme);
    settingsToggle.addEventListener('click', toggleSettingsMenu);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    muteBtn.addEventListener('click', toggleMute);

    /* =========================
       INICIALIZACIÓN
       ========================= */

    async function initializeApp() {
        loadPreferences();
        switchToLibraryView();
        await loadBooks();

        // Ocultar botón de fullscreen en iOS siempre
        if (isIOS()) {
            fullscreenBtn.classList.add('hidden');
        }

        // Aseguramos que arrancamos arriba del todo
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    initializeApp();
});
