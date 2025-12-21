# Blueprint: Novela Interactiva PWA

## Visión General

Este proyecto es una novela interactiva de misterio y terror. El objetivo es convertir la aplicación web actual en una Progressive Web App (PWA) para mejorar la experiencia del usuario, permitir la instalación en dispositivos móviles y de escritorio, y habilitar el modo de pantalla completa, especialmente en iOS.

## Diseño y Estilo

La aplicación mantendrá su estética actual, pero se mejorará con elementos visuales que refuercen la atmósfera de la historia.

*   **Paleta de Colores:** Se utilizarán tonos oscuros y fríos para crear una atmósfera de suspenso.
*   **Tipografía:** Fuentes legibles y con carácter para facilitar la lectura y aportar personalidad.
*   **Iconografía:** Se creará un conjunto de iconos para la PWA que representen la temática de la novela.

## Características Implementadas

*   **Novela Interactiva:** Sistema de decisiones que ramifican la historia.
*   **Narrativa Visual:** Imágenes que acompañan momentos clave de la narración.
*   **Soporte PWA Básico:** Incluye un `manifest.webmanifest` y un `service-worker.js` para la instalación y el funcionamiento sin conexión.

## Plan de Acción: Mejoras para iOS Safari

1.  **Detección de iOS:**
    *   En `main.js`, se añadirá una función para detectar si el usuario está en un dispositivo iOS. Esto se usará para aplicar lógicas específicas sin afectar a otros sistemas operativos.

2.  **Ajustes de Estilo para iOS:**
    *   En `style.css`, se asegurará que `html` y `body` ocupen el 100% de la altura y no tengan márgenes ni rellenos que causen desbordamientos.

3.  **Ocultar Barra de Herramientas de Safari:**
    *   Se implementará en `main.js` un script que, al cargar la página en iOS, hará un scroll automático para minimizar la barra de herramientas inferior de Safari, maximizando el espacio visible.

4.  **Botón de Pantalla Completa Inteligente:**
    *   Se modificará el event listener del botón de pantalla completa en `main.js`.
    *   Si la app se ejecuta en iOS, en lugar de llamar a `requestFullscreen()`, se mostrará una alerta o un modal instruyendo al usuario sobre cómo añadir la app a su pantalla de inicio para una experiencia de pantalla completa real.

5.  **Verificación de Metadatos PWA para iOS:**
    *   Se revisará el `manifest.webmanifest` para confirmar que el modo `display` está configurado como `standalone`.
    *   Se inspeccionará `index.html` para asegurar que las metaetiquetas `apple-mobile-web-app-capable` y `apple-mobile-web-app-status-bar-style` están presentes y correctamente configuradas para una experiencia de PWA óptima en iOS.
