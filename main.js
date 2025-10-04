document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const bookContainer = document.getElementById('book-container');
    const book = document.getElementById('book');           // contenedor general
    const flipbookRoot = document.getElementById('flipbook'); // contenedor del flipbook (nuevo)
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const increaseFontBtn = document.getElementById('increase-font');
    const decreaseFontBtn = document.getElementById('decrease-font');
    const themeSelectorBtn = document.getElementById('theme-selector');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsMenu = document.getElementById('settings-menu');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const muteBtn = document.getElementById('mute-btn');
    const progressEl = document.getElementById('progress');

    // State
    let story;
    let currentStoryId = -1;
    let pageHistory = [];
    let fontSize = 1.1;
    const themes = ['light', 'sepia', 'dark'];
    let currentThemeIndex = 0;
    let isTransitioning = false;
    let currentAudio = null;
    let isMuted = false;

    // ---- NUEVO: estado flipbook ----
    let pageFlip = null;               // instancia St.PageFlip
    const idToIndex = new Map();       // map id -> índice de página
    const indexToId = [];              // array índice -> id
    const PERSIST_KEY = 'bookPageIndex';

    // --- Preferences Handling ---
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
            document.body.className = document.body.className.replace(/theme-\w*/, `theme-${savedTheme}`) || `theme-${savedTheme}`;
        }
        if (savedMuteState) {
            isMuted = JSON.parse(savedMuteState);
            muteBtn.textContent = isMuted ? "Activar Sonido" : "Silenciar";
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

    // --- Story Loading ---
    async function loadStory() {
        try {
            const response = await fetch('story.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            story = await response.json();
        } catch (error) {
            console.error('Error loading the story:', error);
            if (flipbookRoot) {
                flipbookRoot.innerHTML = '<div class="page"><p>Error al cargar la historia. Por favor, intente de nuevo más tarde.</p></div>';
            } else {
                book.innerHTML = '<div class="page-content"><p>Error al cargar la historia. Por favor, intente de nuevo más tarde.</p></div>';
            }
        }
    }
    
    // --- Audio Handling ---
    function stopCurrentAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
    }

    function playPageSound(pageId) {
        stopCurrentAudio();
        if (isMuted) return;

        const pageData = findPageById(pageId);
        if (pageData && pageData.sound) {
            currentAudio = new Audio(`sounds/${pageData.sound}`);
            currentAudio.loop = true;
            currentAudio.play().catch(e => console.error("Error playing audio:", e));
        }
    }

    // Utilidad para buscar páginas por id en cualquier formato de story
    function findPageById(id) {
        if (!story) return null;
        // Tu formato actual usa un array plano (p.ej. [{id, images, scenes, choices, page, sound}])
        if (Array.isArray(story)) return story.find(p => p.id === id) || null;
        // Si fuera {nodes:[...]} también soportamos:
        if (Array.isArray(story.nodes)) return story.nodes.find(p => p.id === id) || null;
        return null;
    }

    function getAllPagesArray() {
        if (Array.isArray(story)) return story;
        if (Array.isArray(story?.nodes)) return story.nodes;
        return [];
    }

    // --- Rendering (fallback clásico SIN flipbook) ---
    function renderPageFallback(pageId) {
        if (!book) return;
        book.innerHTML = ''; // Clear the book container

        const pageData = findPageById(pageId);
        if (!pageData) {
            book.innerHTML = '<div class="page-content"><p>Página no encontrada.</p></div>';
            return;
        }

        const pageContent = document.createElement('div');
        pageContent.className = 'page-content';

        let contentHtml = '';
        if (pageData.images && pageData.images.length > 0) {
            contentHtml += `<div class="images-container">${pageData.images.map(url => `<img src="${url}" alt="Ilustración">`).join('')}</div>`;
        }
        if (pageData.scenes && pageData.scenes.length > 0) {
            const scenesHtml = pageData.scenes.map(s => `<p>${s.replace(/\n/g, '</p><p>')}</p>`).join('');
            contentHtml += `<div class="scenes-container">${scenesHtml}</div>`;
        }
        pageContent.innerHTML = contentHtml;

        if (pageData.choices && pageData.choices.length > 0) {
            const choicesDiv = document.createElement('div');
            choicesDiv.className = 'choices';
            pageData.choices.forEach(choice => {
                const button = document.createElement('button');
                button.textContent = choice.text;
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    goToPage(choice.page);
                });
                choicesDiv.appendChild(button);
            });
            pageContent.appendChild(choicesDiv);
        }
        
        book.appendChild(pageContent);

        if (pageData.page !== undefined) {
            const pageNumberDiv = document.createElement('div');
            pageNumberDiv.className = 'page-number';
            pageNumberDiv.textContent = `Página ${pageData.page}`;
            book.appendChild(pageNumberDiv);
        }
    }

    // --- NUEVO: construir una página DOM para el flipbook ---
    function buildFlipPageElement(pageData) {
        const d = document.createElement('div');
        d.className = 'page';
        let html = '';

        // número/título opcional
        if (pageData.page !== undefined) {
            html += `<div class="page-number" style="text-align:right;opacity:.7">Página ${pageData.page}</div>`;
        }
        if (pageData.title) {
            html += `<h2>${pageData.title}</h2>`;
        }

        // imágenes
        if (pageData.images && pageData.images.length > 0) {
            html += `<div class="images-container">${pageData.images
                .map(url => `<img src="${url}" alt="Ilustración" style="max-width:100%;height:auto;border-radius:6px;">`)
                .join('')}</div>`;
        }
        // escenas/texto
        if (pageData.scenes && pageData.scenes.length > 0) {
            const scenesHtml = pageData.scenes.map(s => `<p>${s.replace(/\n/g, '</p><p>')}</p>`).join('');
            html += `<div class="scenes-container">${scenesHtml}</div>`;
        }

        // elecciones
        if (pageData.choices && pageData.choices.length > 0) {
            html += `<div class="choices" style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:.5rem">
              ${pageData.choices.map(c => `<button data-target="${c.page}">${c.text}</button>`).join('')}
            </div>`;
        }

        d.innerHTML = html;

        // listeners para elecciones dentro de la página
        const choices = d.querySelectorAll('.choices button[data-target]');
        choices.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const target = btn.getAttribute('data-target');
                if (target) goToPage(target);
            });
        });

        return d;
    }

    // --- NUEVO: inicializar FLIPBOOK si está disponible ---
    function canUseFlipbook() {
        return !!(flipbookRoot && window.St && St.PageFlip);
    }

    function updateProgressFromFlip() {
        if (!pageFlip || !progressEl) return;
        const st = pageFlip.getState();
        progressEl.textContent = `Página ${st.page + 1} / ${st.pages}`;
        // botones prev/next tipo libro
        if (prevBtn) prevBtn.disabled = st.page <= 0 || isTransitioning;
        if (nextBtn) nextBtn.disabled = st.page >= st.pages - 1 || isTransitioning;
    }

    function onFlipEvent(e) {
        const pageIndex = e.data; // índice actual
        const newId = indexToId[pageIndex];
        if (newId === undefined) return;

        currentStoryId = newId;

        // historial/persistencia
        if (pageHistory[pageHistory.length - 1] !== currentStoryId) {
            pageHistory.push(currentStoryId);
            savePageHistory();
        }
        localStorage.setItem(PERSIST_KEY, String(pageIndex));

        // audio y controles
        playPageSound(currentStoryId);
        updateProgressFromFlip();
    }

    function attachFlipbookControls() {
        if (!pageFlip) return;
        // Conectar botones a pasar página "libro"
        if (prevBtn) {
            prevBtn.onclick = (e) => { e.preventDefault(); pageFlip.flipPrev(); };
        }
        if (nextBtn) {
            nextBtn.onclick = (e) => { e.preventDefault(); pageFlip.flipNext(); };
        }
        // Atajos teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') pageFlip.flipNext();
            if (e.key === 'ArrowLeft') pageFlip.flipPrev();
        });
    }

    function restoreFlipbookPosition() {
        if (!pageFlip) return;
        const saved = Number(localStorage.getItem(PERSIST_KEY) || 0);
        if (!Number.isNaN(saved) && saved >= 0 && saved < pageFlip.getPageCount()) {
            try { pageFlip.flip(saved); } catch {}
        }
    }

    function initFlipbookFromStory() {
        const pagesArr = getAllPagesArray();
        if (!pagesArr.length) return false;

        // map id <-> index
        idToIndex.clear();
        indexToId.length = 0;
        pagesArr.forEach((p, i) => { idToIndex.set(p.id, i); indexToId[i] = p.id; });

        // crear DOM pages
        const domPages = pagesArr.map(buildFlipPageElement);

        // Inicializar St.PageFlip
        pageFlip = new St.PageFlip(flipbookRoot, {
            width: 420,
            height: 580,
            size: 'stretch',
            minWidth: 315,
            maxWidth: 1200,
            minHeight: 420,
            maxHeight: 1600,
            showCover: false,
            maxShadowOpacity: 0.5,
            usePortrait: true,
            mobileScrollSupport: true,
            swipeDistance: 30
        });

        pageFlip.loadFromHTML(domPages);
        pageFlip.on('flip', onFlipEvent);
        updateProgressFromFlip();
        attachFlipbookControls();
        return true;
    }

    // --- UI Updates & Controls ---
    function updateButtons() {
        if (pageFlip) {
            updateProgressFromFlip();
            return;
        }
        // Fallback a tu lógica original (basada en choices)
        prevBtn.disabled = pageHistory.length <= 1 || isTransitioning;
        const pageData = findPageById(currentStoryId);
        nextBtn.disabled = !pageData || !pageData.choices || pageData.choices.length === 0 || isTransitioning;
    }

    function changeFontSize(amount) {
        fontSize = Math.max(0.8, Math.min(1.8, fontSize + amount));
        document.documentElement.style.setProperty('--font-size-dynamic', `${fontSize}rem`);
        saveFontSize();
    }

    function cycleTheme() {
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        const newTheme = themes[currentThemeIndex];
        document.body.className = document.body.className.replace(/theme-\w*/, `theme-${newTheme}`);
        saveTheme();
    }

    function toggleSettingsMenu() { settingsMenu.classList.toggle('visible'); }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`));
        } else {
            document.exitFullscreen();
        }
    }

    function toggleMute() {
        isMuted = !isMuted;
        muteBtn.textContent = isMuted ? "Activar Sonido" : "Silenciar";
        saveMuteState();
        if (isMuted) {
            stopCurrentAudio();
        } else {
            playPageSound(currentStoryId);
        }
    }

    // --- Navigation ---
    function goToPage(pageId, isGoingBack = false) {
        // Si tenemos flipbook activo: navegamos por índice
        if (pageFlip && idToIndex.has(pageId)) {
            pageFlip.flip(idToIndex.get(pageId));
            return;
        }

        // Fallback a tu lógica anterior (sin flipbook)
        if (isTransitioning || !findPageById(pageId)) return;

        isTransitioning = true;
        updateButtons();
        book?.classList?.add('loading');

        setTimeout(() => {
            renderPageFallback(pageId);
            window.scrollTo({ top: 0, behavior: 'smooth' });

            currentStoryId = pageId;
            if (isGoingBack) {
                pageHistory.pop();
            } else if (pageHistory[pageHistory.length - 1] !== pageId) {
                pageHistory.push(pageId);
            }
            savePageHistory();
            playPageSound(pageId);

            book?.classList?.remove('loading');

            setTimeout(() => {
                isTransitioning = false;
                updateButtons();
            }, 50);

        }, 300);
    }

    function goBack() {
        if (pageFlip) {
            pageFlip.flipPrev();
            return;
        }
        if (pageHistory.length > 1 && !isTransitioning) {
            goToPage(pageHistory[pageHistory.length - 2], true);
        }
    }

    function goForward() {
        if (pageFlip) {
            pageFlip.flipNext();
            return;
        }
        const pageData = findPageById(currentStoryId);
        if (pageData && pageData.choices && pageData.choices.length > 0 && !isTransitioning) {
            goToPage(pageData.choices[0].page);
        }
    }

    function handleBookClick(event) {
        // Si hay flipbook activo, dejamos que el arrastre/click del componente maneje todo
        if (pageFlip) return;

        if (event.target.closest('.choices')) return;

        const bookRect = book.getBoundingClientRect();
        const clickX = event.clientX - bookRect.left;
        
        if (clickX < bookRect.width / 2) {
            goBack();
        } else {
            goForward();
        }
    }

    // --- Event Listeners ---
    prevBtn.addEventListener('click', goBack);
    nextBtn.addEventListener('click', goForward);
    increaseFontBtn.addEventListener('click', () => changeFontSize(0.1));
    decreaseFontBtn.addEventListener('click', () => changeFontSize(-0.1));
    themeSelectorBtn.addEventListener('click', cycleTheme);
    settingsToggle.addEventListener('click', toggleSettingsMenu);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    muteBtn.addEventListener('click', toggleMute);
    book.addEventListener('click', handleBookClick);

    document.addEventListener('fullscreenchange', () => {
        setTimeout(() => window.scrollTo(0, 0), 50);
    });

    // --- Initialization ---
    async function initializeApp() {
        loadPreferences();
        await loadStory();

        const pagesArr = getAllPagesArray();
        if (!pagesArr.length) return;

        // restaurar historial o iniciar en la primera
        const loadedHistory = loadPageHistory();
        if (loadedHistory && loadedHistory.length > 0) {
            pageHistory = loadedHistory;
            currentStoryId = pageHistory[pageHistory.length - 1];
        } else {
            currentStoryId = pagesArr[0].id;
            pageHistory = [currentStoryId];
        }

        // Si podemos usar flipbook, lo activamos. Si no, fallback a tu render original.
        if (canUseFlipbook()) {
            flipbookRoot.innerHTML = ''; // limpia por si acaso
            initFlipbookFromStory();

            // Colocar el flipbook en la página guardada (por índice) o en el id actual
            const savedIndex = Number(localStorage.getItem(PERSIST_KEY));
            if (!Number.isNaN(savedIndex)) {
                try { pageFlip.flip(savedIndex); } catch {}
            } else if (idToIndex.has(currentStoryId)) {
                try { pageFlip.flip(idToIndex.get(currentStoryId)); } catch {}
            }

            // audio y botones iniciales
            playPageSound(currentStoryId);
            updateButtons();
            window.scrollTo(0, 0);
        } else {
            // Fallback completo a tu versión anterior
            renderPageFallback(currentStoryId);
            playPageSound(currentStoryId);
            updateButtons();
            window.scrollTo(0, 0);
        }
    }

    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) {
        fullscreenBtn.style.display = 'none';
    }

    initializeApp();
});
