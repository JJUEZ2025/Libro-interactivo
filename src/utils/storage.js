export function loadPreferences({
    readerThemes,
    libraryThemes,
    applyTheme,
    volumeSlider,
    setFontSize,
    setCurrentTheme,
    setCurrentVolume,
    documentRef = document,
    localStorageRef = localStorage
}) {
    const savedFontSize = localStorageRef.getItem('fontSize');
    const savedTheme = localStorageRef.getItem('theme');
    const savedVolume = localStorageRef.getItem('volume');

    if (savedFontSize) {
        const parsedFontSize = parseFloat(savedFontSize);
        setFontSize(parsedFontSize);
        documentRef.documentElement.style.setProperty('--font-size-dynamic', `${parsedFontSize}rem`);
    }

    let resolvedTheme = 'light';
    if (savedTheme && (readerThemes.includes(savedTheme) || libraryThemes.includes(savedTheme))) {
        resolvedTheme = savedTheme;
    }
    setCurrentTheme(resolvedTheme);
    applyTheme(resolvedTheme);

    if (savedVolume !== null && volumeSlider) {
        const parsedVolume = parseFloat(savedVolume);
        setCurrentVolume(parsedVolume);
        volumeSlider.value = parsedVolume;
    }
}

export function saveFontSize(fontSize, localStorageRef = localStorage) {
    localStorageRef.setItem('fontSize', fontSize);
}

export function saveTheme(currentTheme, localStorageRef = localStorage) {
    localStorageRef.setItem('theme', currentTheme);
}

export function saveVolume(currentVolume, localStorageRef = localStorage) {
    localStorageRef.setItem('volume', currentVolume);
}

export function getPageHistoryKey(bookId) {
    return `pageHistory-${bookId}`;
}

export function savePageHistory({ currentBook, pageHistory, localStorageRef = localStorage }) {
    if (!currentBook) return;
    localStorageRef.setItem(getPageHistoryKey(currentBook.id), JSON.stringify(pageHistory));
}

export function loadPageHistory(bookId, localStorageRef = localStorage) {
    const savedHistory = localStorageRef.getItem(getPageHistoryKey(bookId));
    return savedHistory ? JSON.parse(savedHistory) : null;
}
