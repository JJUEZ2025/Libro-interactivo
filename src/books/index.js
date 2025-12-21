export function createLibrary({ libraryGrid, openBook }) {
    let books = [];

    async function loadBooks() {
        if (!libraryGrid) return;

        try {
            const response = await fetch('data/books.json');
            if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
            books = await response.json();
            renderLibrary();
        } catch (error) {
            console.error('Error al cargar books.json:', error);
            libraryGrid.innerHTML = '<p style="padding: 20px; color: red;">Error cargando la biblioteca. Revisa que data/books.json exista y sea válido.</p>';
        }
    }

    function renderLibrary() {
        if (!libraryGrid) return;
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
                img.onerror = function() { this.classList.add('placeholder'); this.src=''; this.alt='Imagen no encontrada'; };
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

            const btn = document.createElement('button');
            btn.className = 'book-open-btn';
            btn.textContent = hasStory ? 'Leer' : 'Muy pronto';
            btn.disabled = !hasStory;

            body.appendChild(titleEl);
            if (bookData.author) body.appendChild(authorEl);
            body.appendChild(btn);
            card.appendChild(coverWrapper);
            card.appendChild(body);
            libraryGrid.appendChild(card);

            if (hasStory) {
                const openHandler = (ev) => { ev.stopPropagation(); openBook(bookData); };
                card.addEventListener('click', openHandler);
                btn.addEventListener('click', openHandler);
            }
        });
    }

    return {
        loadBooks,
        renderLibrary
    };
}
