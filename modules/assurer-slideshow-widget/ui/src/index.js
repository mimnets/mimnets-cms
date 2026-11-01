// Widget player for the Assurer slideshow. Apostrophe runs players on page
// load and again whenever an editor re-renders the widget.

export default () => {
  apos.util.widgetPlayers['assurer-slideshow'] = {
    selector: '[data-assurer-slideshow]',
    player(el) {
      const slides = [ ...el.querySelectorAll('[data-slide]') ];
      const dots = [ ...el.querySelectorAll('[data-dot]') ];
      if (slides.length < 2) {
        return;
      }
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const autoplay = el.dataset.autoplay === 'true' && !reduceMotion;
      const interval = Math.max(3000, parseInt(el.dataset.interval, 10) || 6000);
      let current = 0;
      let timer = null;

      const show = (index) => {
        current = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => {
          const active = i === current;
          slide.classList.toggle('is-active', active);
          slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        });
        dots.forEach((dot, i) => {
          dot.classList.toggle('is-active', i === current);
          dot.setAttribute('aria-current', i === current ? 'true' : 'false');
        });
      };
      const stop = () => {
        clearInterval(timer);
        timer = null;
      };
      const start = () => {
        if (autoplay && !timer) {
          // Editing re-renders the widget and detaches this element; stop
          // the old timer rather than leaking it.
          timer = setInterval(
            () => (el.isConnected ? show(current + 1) : stop()),
            interval
          );
        }
      };

      el.querySelector('[data-prev]')?.addEventListener('click', () => show(current - 1));
      el.querySelector('[data-next]')?.addEventListener('click', () => show(current + 1));
      dots.forEach(dot => {
        dot.addEventListener('click', () => show(parseInt(dot.dataset.dot, 10)));
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          show(current - 1);
        } else if (e.key === 'ArrowRight') {
          show(current + 1);
        }
      });
      // Pause while the visitor is interacting.
      el.addEventListener('mouseenter', stop);
      el.addEventListener('mouseleave', start);
      el.addEventListener('focusin', stop);
      el.addEventListener('focusout', start);

      show(0);
      // Turn the fade on after the first frame with the start state (see
      // _assurer.scss), so nothing fades in at page load.
      requestAnimationFrame(() => el.classList.add('is-ready'));
      start();
    }
  };
};
