// Product category page: header image and heading, summary, introduction,
// the published products assigned to this category, then free sections.
import { byDisplayOrder } from '../../../lib/display-order.js';

function ProductCard({
  product, apos, Area
}) {
  const attachment = apos.image.first(product._image);
  const name = product.displayTitle || product.title;
  return (
    <li className="assurer-card">
      {attachment && (
        <div className="assurer-card__media">
          <img
            src={apos.attachment.url(attachment, { size: 'one-half' })}
            srcset={apos.image.srcset(attachment)}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            alt={attachment._alt || ''}
            loading="lazy"
          />
        </div>
      )}
      <div className="assurer-card__body">
        <h3 className="assurer-card__title">{name}</h3>
        {product.summary && <p className="assurer-card__text">{product.summary}</p>}
        <div className="assurer-card__text">
          <Area doc={product} name="description" />
        </div>
      </div>
    </li>
  );
}

export default function ({ page }, {
  Extend, Area, apos
}) {
  const hero = apos.image.first(page._heroImage);
  const products = [ ...(page._products || []) ].sort(byDisplayOrder);
  return (
    <Extend
      templateName="layout.jsx"
      main={
        <section className="bp-content assurer-category">
          {hero && (
            <div className="assurer-category__hero">
              <img
                src={apos.attachment.url(hero, { size: 'full' })}
                srcset={apos.image.srcset(hero)}
                sizes="100vw"
                alt={hero._alt || ''}
              />
            </div>
          )}
          <h1>{page.title}</h1>
          {page.summary && <p className="assurer-category__summary">{page.summary}</p>}
          <Area doc={page} name="intro" />
          {products.length > 0 && (
            <section aria-labelledby="category-products">
              <h2 id="category-products">Products</h2>
              <ul className="assurer-grid assurer-grid--3">
                {products.map(product => <ProductCard product={product} apos={apos} Area={Area} />)}
              </ul>
            </section>
          )}
          <Area doc={page} name="main" />
        </section>
      }
    />
  );
}
