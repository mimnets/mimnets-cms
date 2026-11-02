// Product list: one card per published product. Editors see a hint when the
// list is empty; visitors see nothing.
import EmptyHint from '../../../lib/views/EmptyHint.jsx';

function ProductCard({ product, apos }) {
  const attachment = apos.image.first(product._image);
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
        <h3 className="assurer-card__title">{product.displayTitle || product.title}</h3>
        {product.summary && <p className="assurer-card__text">{product.summary}</p>}
      </div>
    </li>
  );
}

export default function ({ widget, user }, {
  Area, apos, __t
}) {
  const products = widget._listed || [];
  // Nothing to list: editors get a hint, visitors get no section at all.
  if (!products.length && !user) {
    return null;
  }
  return (
    <section className="assurer-section assurer-product-list" id={widget.anchor || undefined}>
      <div className="assurer-section__intro">
        <Area doc={widget} name="intro" />
      </div>
      {products.length > 0
        ? (
          <ul className={`assurer-grid assurer-grid--cols-${widget.columns || '3'}`}>
            {products.map(product => <ProductCard product={product} apos={apos} />)}
          </ul>
        )
        : <EmptyHint user={user} text={__t(widget.mode === 'pick' ? 'project:emptyPick' : 'project:emptyProductCategory')} />}
    </section>
  );
}
