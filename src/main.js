import { createLibrary } from './books/index.js';
import { handlePageEffects } from './effects/index.js';
import {
    loadPreferences,
    saveFontSize,
    saveTheme,
    saveVolume,
    savePageHistory,
    loadPageHistory
} from './utils/storage.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Iniciando Lecturas Interactivas v4.2 (Corrección Audio & Estilos)");

    // --- SELECCIÓN DE ELEMENTOS ---
    const getEl = (id) => document.getElementById(id);

    const appContainer = getEl('app-container');
    const libraryView = getEl('library-view');
    const libraryGrid = getEl('library-grid');
    const readerView = getEl('reader-view');

    const book = getEl('book');
    const pageWrapper = getEl('page-wrapper');

    const mainTitle = getEl('main-title');
    const backToLibraryBtn = getEl('back-to-library');

    const increaseFontBtn = getEl('increase-font');
    const decreaseFontBtn = getEl('decrease-font');
    const themeSelectorBtn = getEl('theme-selector');
    const settingsToggle = getEl('settings-toggle');
    const settingsMenu = getEl('settings-menu');
    const fullscreenBtn = getEl('fullscreen-btn');
    const volumeSlider = getEl('volume-slider');

    const navToggle = getEl('nav-toggle');
    const navModal = getEl('nav-modal');
    const navClose = getEl('nav-close');
    const restartBtn = getEl('restart-btn');
    const historyList = getEl('history-list');

    const progressBar = getEl('progress-bar');
    const appFooter = getEl('app-footer');

    // ESTADO GENERAL
    let appMode = 'library';
    let currentBook = null;

    // Estado de lectura
    let story = null;
    let currentStoryId = -1;
    let pageHistory = [];
    let fontSize = 1.1;

    let currentTheme = 'light';
    const readerThemes = ['light', 'sepia', 'bone', 'dark'];
    const libraryThemes = ['light', 'dark'];

    let isTransitioning = false;
    let currentAudio = null;
    let currentAudioFile = null;
    let currentVolume = 1;
    let totalPagesInStory = 0;
    
    // Variable para el intervalo del karaoke
    let karaokeInterval = null;

    const themeColors = {
        light: '#fdf6e3',
        sepia: '#f4ecd8',
        bone: '#f2f0e9',
        dark: '#1a1a1a'
    };

    const setFontSize = (value) => fontSize = value;
    const setCurrentTheme = (value) => currentTheme = value;
    const setCurrentVolume = (value) => currentVolume = value;

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
        saveTheme(currentTheme);
    }

    /* =========================
       BIBLIOTECA
       ========================= */
    const library = createLibrary({ libraryGrid, openBook });

    function switchToLibraryView() {
        appMode = 'library';
        document.body.classList.remove('app-mode-reader', 'fullscreen-mode');
        document.body.classList.add('app-mode-library');

        if (libraryView) {
            libraryView.hidden = false;
            libraryView.style.display = ''; 
        }

        if (readerView) {
            readerView.classList.remove('active'); 
            readerView.hidden = true;
            readerView.style.display = 'none';
        }

        if (pageWrapper) {
            pageWrapper.innerHTML = '';
        }

        if (backToLibraryBtn) backToLibraryBtn.classList.add('hidden');
        if (navToggle) navToggle.classList.add('hidden');
        if (fullscreenBtn) fullscreenBtn.classList.add('hidden');
        if (appFooter) appFooter.classList.add('hidden');
        if (mainTitle) mainTitle.textContent = 'Lecturas Interactivas';

        stopCurrentAudio();
        handlePageEffects(null, { getAppMode }); 
        window.scrollTo(0, 0);
    }

    function switchToReaderView() {
        appMode = 'reader';
        document.body.classList.remove('app-mode-library');
        document.body.classList.add('app-mode-reader');

        if (libraryView) {
            libraryView.hidden = true;
            libraryView.style.display = 'none';
        }
        
        if (readerView) {
            readerView.hidden = false;
            readerView.style.display = ''; 
            readerView.classList.add('active');
        }

        if (backToLibraryBtn) backToLibraryBtn.classList.remove('hidden');
        if (navToggle) navToggle.classList.remove('hidden');
        if (fullscreenBtn) fullscreenBtn.classList.remove('hidden');
        if (appFooter) appFooter.classList.remove('hidden');
    }

    async function openBook(bookData) {
        if (!bookData || !bookData.storyFile) return;
        currentBook = bookData;
        if (mainTitle) mainTitle.textContent = bookData.title || 'Lectura';
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
        goToPage(currentStoryId, true);
    }

    if (backToLibraryBtn) {
        backToLibraryBtn.addEventListener('click', () => {
            switchToLibraryView();
        });
    }

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
            alert("No se pudo cargar la historia. Verifica la consola para más detalles.");
            story = null;
        }
    }

    function stopCurrentAudio() {
        if (karaokeInterval) {
            clearInterval(karaokeInterval);
            karaokeInterval = null;
        }

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
        }
        currentAudioFile = null;
    }

    // Lógica principal de audio
    function playPageSound(pageId, soundFileOverride = null, autoPlay = true) {
        let soundFile = soundFileOverride;
        if (!soundFile && story && pageId) {
            const pageData = story.find(p => p.id === pageId);
            if (pageData) soundFile = pageData.sound || pageData.audio;
        }

        if (soundFile) {
            // Si ya está sonando el mismo archivo
            if (currentAudio && currentAudioFile === soundFile) {
                currentAudio.volume = currentVolume;
                if (autoPlay && currentAudio.paused) {
                    currentAudio.play().catch(err => console.error('Error audio:', err));
                }
                return;
            }

            stopCurrentAudio();
            currentAudio = new Audio(`sounds/${soundFile}`);
            currentAudioFile = soundFile;
            
            const pageData = story.find(p => p.id === pageId);
            const isKaraoke = pageData && pageData.karaokeLines;
            
            // Si es karaoke, NO hacemos loop. Si es música de fondo, sí.
            currentAudio.loop = !isKaraoke; 
            currentAudio.volume = currentVolume;

            // Al terminar el audio...
            currentAudio.addEventListener('ended', () => {
                 updatePlayButtonState(false);
                 // NO hay lógica de autoplay aquí para evitar bucles indeseados.
                 // Simplemente se detiene y muestra el icono de Play.
            });

            if (autoPlay) {
                currentAudio.play().then(() => {
                    updatePlayButtonState(true);
                }).catch(err => console.error('Error audio:', err));
            } else {
                updatePlayButtonState(false);
            }
        }
    }

    function updatePlayButtonState(isPlaying) {
        const btn = document.getElementById('karaoke-play-btn');
        if (!btn) return;
        
        // Iconos SVG Sólidos y Claros (Material Design Style)
        const iconPlay = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>`;
        const iconPause = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>`;
        
        btn.innerHTML = isPlaying ? iconPause : iconPlay;
        btn.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproducir');
        
        // Manejar visibilidad del texto de instrucción
        const instructionText = document.querySelector('.audio-instruction');
        if (instructionText) {
            if (isPlaying) {
                instructionText.classList.add('faded');
            } else {
                // Opcional: si quieres que vuelva a aparecer al pausar, quita la clase.
                // Si prefieres que se quede oculto hasta pasar el mouse, no hagas nada.
                // instructionText.classList.remove('faded'); 
            }
        }
    }

    function toggleKaraokeAudio() {
        if (!currentAudio) return;
        
        if (currentAudio.paused) {
            currentAudio.play();
            updatePlayButtonState(true);
        } else {
            currentAudio.pause();
            updatePlayButtonState(false);
        }
    }

    // Función para manejar el karaoke (Sync Visual)
    function startKaraokeSync() {
        if (karaokeInterval) clearInterval(karaokeInterval);
        
        karaokeInterval = setInterval(() => {
            if (!currentAudio) return; // Si no hay audio, no hacemos nada
            
            // Aunque esté pausado, queremos poder hacer click y ver el highlight correcto
            const time = currentAudio.currentTime;
            const domLines = document.querySelectorAll('.karaoke-line');
            
            let anyActive = false;

            domLines.forEach((p) => {
                const start = parseFloat(p.dataset.start);
                const end = parseFloat(p.dataset.end);
                
                if (time >= start && time < end) {
                    if (!p.classList.contains('active')) {
                        // Limpiar otros activos primero por si acaso
                        domLines.forEach(l => l.classList.remove('active'));
                        p.classList.add('active');
                        // Scroll suave automático
                        p.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    anyActive = true;
                } 
            });

            // No limpiamos si no hay activo para mantener el último resaltado si se pausa justo al final
        }, 100); 
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            currentVolume = parseFloat(e.target.value);
            if (currentAudio) currentAudio.volume = currentVolume;
            saveVolume(currentVolume);
        });
    }

    function getAppMode() { return appMode; }

    function preloadNextImages(currentPageId) {
        if (!story) return;
        const currentPage = story.find(p => p.id === currentPageId);
        if (!currentPage || !currentPage.choices) return;

        currentPage.choices.forEach(choice => {
            const nextPage = story.find(p => p.id === choice.page);
            if (nextPage) {
                if (nextPage.images) nextPage.images.forEach(url => { new Image().src = url; });
                if (nextPage.sound) { new Audio(`sounds/${nextPage.sound}`).preload = 'auto'; }
            }
        });
    }

    function renderPage(pageId) {
        if (!pageWrapper) return;
        
        if (pageId === -1) {
            switchToLibraryView();
            return;
        }

        pageWrapper.innerHTML = '';
        if (!story) return;

        const pageData = story.find(p => p.id === pageId);
        if (!pageData) return;

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

        // --- RENDERIZADO KARAOKE ---
        if (pageData.karaokeLines) {
            // Texto descriptivo (ej: "Escucha al autor...")
            if (pageData.audioText) {
                // Lo integramos, pero quizás prefieras que sea el texto 'fantasmal' del botón
                // Por ahora lo dejamos como un párrafo aparte si existe en el JSON
                 contentHtml += `<p class="audio-hint">${pageData.audioText}</p>`;
            }
            
            // 1. Controles de Audio mejorados
            contentHtml += `
                <div class="audio-controls-container">
                    <button id="karaoke-play-btn" class="karaoke-btn" aria-label="Reproducir">
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </button>
                    <span class="audio-instruction">Pulsa para escuchar</span>
                </div>
            `;

            contentHtml += `<div class="karaoke-container">`;
            pageData.karaokeLines.forEach(line => {
                contentHtml += `<p class="karaoke-line clickable" data-start="${line.start}" data-end="${line.end}">${line.text}</p>`;
            });
            contentHtml += `</div>`;
        } 
        // --- RENDERIZADO NORMAL ---
        else if (pageData.scenes && pageData.scenes.length > 0) {
            const scenesHtml = pageData.scenes
                .map((s, index) => `<p class="fade-in-text" style="animation-delay: ${index * 0.2}s">${s.replace(/\n/g, '</p><p class="fade-in-text">')}</p>`)
                .join('');
            contentHtml += `<div class="scenes-container">${scenesHtml}</div>`;
        }

        contentCenterer.innerHTML = contentHtml;

        // --- CHOICES ---
        if (pageData.choices && (pageData.choices.length > 1 || (pageData.choices.length > 0 && pageData.forceShowChoices))) {
            const choicesDiv = document.createElement('div');
            choicesDiv.className = 'choices';
            pageData.choices.forEach(choice => {
                const btn = document.createElement('button');
                btn.textContent = choice.text;
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    // Si el botón dice "Volver a escuchar", reiniciamos el audio
                    if (choice.page === 'pecado' || choice.text.toLowerCase().includes('escuchar')) {
                        if(currentAudio) {
                            currentAudio.currentTime = 0;
                            currentAudio.play();
                            updatePlayButtonState(true);
                            // Scroll al inicio del poema
                            const firstLine = document.querySelector('.karaoke-line');
                            if(firstLine) firstLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    } else {
                        goToPage(choice.page);
                    }
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

        // --- CONFIGURACIÓN DE EVENTOS DEL DOM ---
        
        // Listener para el botón Play/Pause
        const playBtn = document.getElementById('karaoke-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleKaraokeAudio();
            });
        }

        // Listener para CADA línea de karaoke (salto temporal)
        const lines = document.querySelectorAll('.karaoke-line');
        lines.forEach(line => {
            line.addEventListener('click', () => {
                const start = parseFloat(line.dataset.start);
                if (currentAudio) {
                    currentAudio.currentTime = start; // Saltar al tiempo
                    if (currentAudio.paused) {
                        currentAudio.play(); // Reproducir si estaba pausado
                        updatePlayButtonState(true);
                    }
                }
            });
        });

        // --- LÓGICA DE AUDIO (INICIALIZACIÓN) ---
        if (pageData.bgMusic) {
            playPageSound(null, pageData.bgMusic, true);
        } else if (pageData.sound) {
            playPageSound(null, pageData.sound, true);
        } else if (pageData.audio) {
            // Karaoke: Cargar pero NO reproducir automáticamente
            playPageSound(null, pageData.audio, false); 
            // Iniciar sincronización visual (funcionará cuando el usuario de play)
            if (pageData.karaokeLines) {
                startKaraokeSync();
            }
        } else {
            stopCurrentAudio();
        }

        handlePageEffects(pageData.effect, { getAppMode });
        preloadNextImages(pageId);
    }

    function resetScrollPosition() {
        if (pageWrapper && pageWrapper.querySelector('.page-content')) {
            pageWrapper.querySelector('.page-content').scrollTop = 0;
        }
        if (pageWrapper) pageWrapper.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    function updateUI() {
        if (!progressBar) return;
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

        if (pageId === -1) {
            switchToLibraryView();
            return;
        }

        // Buscar página por ID
        if (!story.some(p => p.id === pageId)) return;

        isTransitioning = true;
        if (pageWrapper) {
            pageWrapper.classList.remove('page-enter');
            pageWrapper.classList.add('page-exit');
        }

        setTimeout(() => {
            renderPage(pageId);
            resetScrollPosition();
            currentStoryId = pageId;
            if (!isGoingBack && !pageHistory.includes(pageId)) {
                pageHistory.push(pageId);
            }
            savePageHistory({ currentBook, pageHistory });
            if (pageWrapper) {
                pageWrapper.classList.remove('page-exit');
                void pageWrapper.offsetWidth;
                pageWrapper.classList.add('page-enter');
            }
            setTimeout(() => { isTransitioning = false; updateUI(); }, 500);
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
        if (pageData && pageData.forceShowChoices) return;
        if (pageData && pageData.choices && pageData.choices.length === 1) {
            goToPage(pageData.choices[0].page);
        }
    }

    if (book) {
        book.addEventListener('click', (event) => {
            if (appMode !== 'reader') return;
            if (isTransitioning) return;
            // Evitar navegar si se hace click en controles o líneas clicables
            if (event.target.closest('.choices') || 
                event.target.closest('button') || 
                event.target.closest('.karaoke-line') ||
                event.target.closest('.audio-controls-container')) return;
            
            const rect = book.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            if (clickX < rect.width * 0.3) goBack(); else goForward();
        });

        let touchStartX = 0;
        let touchStartY = 0;
        book.addEventListener('touchstart', (event) => {
            if (appMode !== 'reader') return;
            if (isTransitioning) return;
            const touch = event.changedTouches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }, { passive: true });

        book.addEventListener('touchend', (event) => {
            if (appMode !== 'reader') return;
            if (isTransitioning) return;
            if (event.target.closest('.choices') || 
                event.target.closest('button') || 
                event.target.closest('.karaoke-line') ||
                event.target.closest('.audio-controls-container')) return;
            
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);
            if (absDeltaX < 50 || absDeltaX < absDeltaY) return;
            if (deltaX < 0) goForward(); else goBack();
        }, { passive: true });
    }

    function openNav() {
        if (!story) return;
        updateNavigationList();
        if (navModal) navModal.classList.add('active');
    }
    function closeNav() { if (navModal) navModal.classList.remove('active'); }
    function updateNavigationList() {
        if (!historyList) return;
        historyList.innerHTML = '';
        if (!story || !pageHistory.length) return;
        const milestones = pageHistory.filter((pageId, index) => {
            if (index === 0) return true;
            const pageData = story.find(p => p.id === pageId);
            return pageData && pageData.choices && pageData.choices.length > 1;
        });
        const recentMilestones = milestones.slice().reverse();
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
            } else if (pageData.karaokeLines && pageData.karaokeLines.length > 0) {
                preview = "Lectura interactiva de poema...";
            }
            li.innerHTML = `<span class="history-title">${title} <span class="history-tag">Volver aquí</span></span>
                            <span class="history-preview">${preview}</span>`;
            li.addEventListener('click', () => { jumpToHistoryPoint(pageId); closeNav(); });
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
        const confirmed = confirm('¿Reiniciar historia?');
        if (!confirmed) return;
        const startId = story[0].id;
        pageHistory = [startId];
        savePageHistory({ currentBook, pageHistory });
        goToPage(startId, true);
        closeNav();
    }

    if (navToggle) navToggle.addEventListener('click', openNav);
    if (navClose) navClose.addEventListener('click', closeNav);
    if (restartBtn) restartBtn.addEventListener('click', restartStory);
    if (navModal) navModal.addEventListener('click', (ev) => { if (ev.target === navModal) closeNav(); });

    function changeFontSize(delta) {
        fontSize = Math.max(0.8, Math.min(1.8, fontSize + delta));
        document.documentElement.style.setProperty('--font-size-dynamic', `${fontSize}rem`);
        saveFontSize(fontSize);
    }
    function toggleSettingsMenu() { if (settingsMenu) settingsMenu.classList.toggle('visible'); }

    function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }

    function toggleFullscreen() {
        const doc = document;
        if (isIOS()) {
            const isStandalone = window.navigator.standalone || (window.matchMedia('(display-mode: standalone)').matches);
            if (!isStandalone) {
                alert("Para ver en pantalla completa real en iOS:\n\n1. Pulsa el botón 'Compartir' (cuadrado con flecha).\n2. Busca y selecciona 'Agregar a inicio'.\n\n¡Ábrela desde tu inicio y listo!");
                return;
            }
            return;
        }

        if (!doc.fullscreenElement) {
            doc.documentElement.requestFullscreen().catch(err => {
                console.warn('Fullscreen API falló, activando modo CSS fallback:', err);
                document.body.classList.toggle('fullscreen-mode');
            });
        } else {
            doc.exitFullscreen();
        }
    }

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            document.body.classList.add('fullscreen-mode');
            resetScrollPosition();
        } else {
            document.body.classList.remove('fullscreen-mode');
            resetScrollPosition();
        }
    });

    if (increaseFontBtn) increaseFontBtn.addEventListener('click', () => changeFontSize(0.1));
    if (decreaseFontBtn) decreaseFontBtn.addEventListener('click', () => changeFontSize(-0.1));
    if (themeSelectorBtn) themeSelectorBtn.addEventListener('click', cycleTheme);
    if (settingsToggle) settingsToggle.addEventListener('click', toggleSettingsMenu);
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

    async function initializeApp() {
        loadPreferences({
            readerThemes,
            libraryThemes,
            applyTheme,
            volumeSlider,
            setFontSize,
            setCurrentTheme,
            setCurrentVolume
        });
        switchToLibraryView();
        await library.loadBooks();
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    initializeApp();
});
