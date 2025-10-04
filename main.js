document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const book = document.getElementById('book');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const increaseFontBtn = document.getElementById('increase-font');
    const decreaseFontBtn = document.getElementById('decrease-font');
    const themeSelectorBtn = document.getElementById('theme-selector');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsMenu = document.getElementById('settings-menu');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const muteBtn = document.getElementById('mute-btn');
    const progressBar = document.getElementById('progress-bar');

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
    let totalPagesInStory = 0;

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
            const unmutedSvg = muteBtn.querySelector('.unmuted');
            const mutedSvg = muteBtn.querySelector('.muted');
            if (unmutedSvg && mutedSvg) {
                unmutedSvg.style.display = isMuted ? 'none' : 'inline-block';
                mutedSvg.style.display = isMuted ? 'inline-block' : 'none';
            }
            muteBtn.setAttribute('aria-label', isMuted ? 'Activar Sonido' : 'Silenciar Audio');
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
            const response = await fetch('story.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            story = await response.json();
            totalPagesInStory = story.length; 
        } catch (error) {
            console.error('Error loading the story:', error);
            book.innerHTML = '<div class="page-content"><p>Error al cargar la historia. Por favor, intente de nuevo más tarde.</p></div>';
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

        const pageData = story.find(p => p.id === pageId);
        if (pageData && pageData.sound) {
            currentAudio = new Audio(`sounds/${pageData.sound}`);
            currentAudio.loop = true;
            currentAudio.play().catch(e => console.error("Error playing audio:", e));
        }
    }

    // --- Rendering ---
    function renderPage(pageId) {
        book.innerHTML = ''; 

        const pageData = story.find(p => p.id === pageId);
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

        if (pageData.choices && pageData.choices.length > 1) {
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

    // --- UI Updates & Controls ---
    function updateUI() {
        const pageData = story.find(p => p.id === currentStoryId);
        const hasSingleChoice = pageData && pageData.choices && pageData.choices.length === 1;
        
        prevBtn.disabled = pageHistory.length <= 1 || isTransitioning;
        nextBtn.disabled = !hasSingleChoice || isTransitioning;
        updateProgressBar();
    }

    function updateProgressBar() {
        if (totalPagesInStory === 0) {
            progressBar.style.width = '0%';
            return;
        }
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
        const unmutedSvg = muteBtn.querySelector('.unmuted');
        const mutedSvg = muteBtn.querySelector('.muted');
        if (unmutedSvg && mutedSvg) {
            unmutedSvg.style.display = isMuted ? 'none' : 'inline-block';
            mutedSvg.style.display = isMuted ? 'inline-block' : 'none';
        }
        muteBtn.setAttribute('aria-label', isMuted ? 'Activar Sonido' : 'Silenciar Audio');
        saveMuteState();
        if (isMuted) {
            stopCurrentAudio();
        } else {
            playPageSound(currentStoryId);
        }
    }

    // --- Navigation ---
    function goToPage(pageId, isGoingBack = false) {
        if (!story.some(p => p.id === pageId) || isTransitioning) return;

        isTransitioning = true;
        book.classList.add('loading');

        setTimeout(() => {
            renderPage(pageId);
            window.scrollTo({ top: 0, behavior: 'smooth' });

            currentStoryId = pageId;
            if (isGoingBack) {
                pageHistory.pop();
            } else if (pageHistory[pageHistory.length - 1] !== pageId) {
                pageHistory.push(pageId);
            }
            savePageHistory();
            playPageSound(pageId);

            book.classList.remove('loading');

            setTimeout(() => {
                isTransitioning = false;
                updateUI();
                if (document.activeElement) document.activeElement.blur(); // FIX: Remove focus from tapped button on mobile
            }, 50);

        }, 300);
    }

    function goBack() {
        if (isTransitioning || pageHistory.length <= 1) return;
        goToPage(pageHistory[pageHistory.length - 2], true);
    }

    function goForward() {
        if (isTransitioning) return;

        const pageData = story.find(p => p.id === currentStoryId);
        if (pageData && pageData.choices && pageData.choices.length === 1) {
            goToPage(pageData.choices[0].page);
        }
    }

    function handleBookClick(event) {
        if (isTransitioning || event.target.closest('.choices')) return;

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
