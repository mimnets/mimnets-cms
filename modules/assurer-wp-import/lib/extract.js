// Elementor page HTML → a flat, ordered list of plain blocks (m1-067).
// The WordPress REST API returns only the rendered HTML (no Elementor data),
// so the widgets are recognised by their `data-widget_type` attribute. Pure:
// no network, no Apostrophe.
import { load } from 'cheerio';

const clean = (text) => (text || '').replace(/\s+/g, ' ').trim();

// The largest candidate in a srcset, else the src.
function largestSrc($img) {
  const candidates = ($img.attr('srcset') || '').split(',')
    .map(part => part.trim().split(/\s+/))
    .filter(([ url, width ]) => url && /^\d+w$/.test(width || ''))
    .map(([ url, width ]) => ({
      url,
      width: parseInt(width, 10)
    }))
    .sort((a, b) => b.width - a.width);
  return candidates[0]?.url || $img.attr('src') || null;
}

// The nearest Elementor section or container, to group widgets.
function sectionOf($, el) {
  return $(el)
    .parents('[data-element_type="container"], [data-element_type="section"]')
    .first()
    .attr('data-id') || null;
}

// Paragraph-level HTML of a text widget, without Elementor wrappers.
function textHtml($, $container) {
  const html = ($container.html() || '').trim();
  if (!html) {
    return '';
  }
  return /<(p|ul|ol|h[1-6])[\s>]/i.test(html) ? html : `<p>${html}</p>`;
}

function readWidget($, el) {
  const $el = $(el);
  const widget = $el.attr('data-widget_type');
  const $c = $el.children('.elementor-widget-container').first().length
    ? $el.children('.elementor-widget-container').first()
    : $el;
  const base = {
    widget,
    section: sectionOf($, el)
  };

  switch (widget) {
    case 'heading.default': {
      const $h = $c.find('.elementor-heading-title').first();
      const tag = ($h.prop('tagName') || 'H2').toLowerCase();
      return {
        ...base,
        type: 'heading',
        level: /^h[1-6]$/.test(tag) ? Number(tag[1]) : 2,
        text: clean($h.text()),
        href: $h.find('a').attr('href') || null
      };
    }
    case 'text-editor.default':
    case 'elementskit-heading.default':
      return {
        ...base,
        type: 'text',
        html: textHtml($, $c),
        text: clean($c.text())
      };
    case 'image.default': {
      const $img = $c.find('img').first();
      return {
        ...base,
        type: 'image',
        src: $img.length ? largestSrc($img) : null,
        href: $c.find('a').attr('href') || null
      };
    }
    case 'html.default': {
      // Product cards on the category pages: <h5><a href="#anchor">NAME</a></h5><p>…</p>
      const $a = $c.find('h1 a, h2 a, h3 a, h4 a, h5 a, h6 a').first();
      if ($a.length && ($a.attr('href') || '').startsWith('#')) {
        return {
          ...base,
          type: 'card',
          name: clean($a.text()),
          anchor: $a.attr('href').slice(1),
          text: clean($c.find('p').first().text())
        };
      }
      return {
        ...base,
        type: 'skip'
      };
    }
    case 'gallery.default':
      return {
        ...base,
        type: 'gallery',
        anchor: $el.parents('[id]').first().attr('id') || null,
        images: $c.find('a.e-gallery-item').map((i, a) => $(a).attr('href')).get()
      };
    case 'image-gallery.default':
      return {
        ...base,
        type: 'figures',
        items: $c.find('figure').map((i, fig) => {
          const $fig = $(fig);
          const lines = ($fig.find('figcaption').html() || '')
            .split(/<br\s*\/?>/i)
            .map(part => clean(load(part).text()))
            .filter(Boolean);
          return {
            src: largestSrc($fig.find('img').first()),
            lines
          };
        }).get()
      };
    case 'counter.default':
      return {
        ...base,
        type: 'counter',
        label: clean($c.find('.elementor-counter-title').text()),
        prefix: clean($c.find('.elementor-counter-number-prefix').text()),
        value: $c.find('.elementor-counter-number').attr('data-to-value') || '',
        suffix: clean($c.find('.elementor-counter-number-suffix').text())
      };
    case 'icon-box.default':
    case 'elementskit-icon-box.default': {
      const $title = $c.find('.elementor-icon-box-title, .elementskit-info-box-title, h1, h2, h3, h4, h5, h6').first();
      const title = clean($title.text());
      const $desc = $c.find('.elementor-icon-box-description, .box-body p, p').first();
      const text = clean($desc.length ? $desc.text() : $c.text().replace($title.text(), ''));
      return {
        ...base,
        type: 'box',
        title,
        text: text.replace(/\s*>{2,}\.?$/, '')
      };
    }
    case 'button.default':
      return {
        ...base,
        type: 'button',
        text: clean($c.text()),
        href: $c.find('a').attr('href') || null
      };
    default:
      return {
        ...base,
        type: 'skip'
      };
  }
}

export function extractWidgets(html) {
  const $ = load(html || '');
  return $('[data-widget_type]')
    // Nested widgets are read through their parent.
    .filter((i, el) => !$(el).parents('[data-widget_type]').length)
    .map((i, el) => readWidget($, el))
    .get();
}

// Decodes the entities in a WordPress `title.rendered`.
export function decodeTitle(rendered) {
  return clean(load(`<p>${rendered || ''}</p>`)('p').text());
}
