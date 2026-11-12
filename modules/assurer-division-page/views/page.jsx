// Division / overview page: heading, introduction, cards for the child
// product category pages (loaded in index.js), the organizations picked for
// this division, then free sections.

function CategoryCard({ category, apos }) {
  const attachment = apos.image.first(category._heroImage);
  return (
    <li className="assurer-card">
      {attachment && (
        <div className="assurer-card__media">
          <img
            src={apos.attachment.url(attachment, { size: 'one-half' })}
            srcset={apos.image.srcset(attachment)}
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            alt=""
            loading="lazy"
          />
        </div>
      )}
      <div className="assurer-card__body">
        <h2 className="assurer-card__title">
          <a className="assurer-card__stretched" href={category._url}>{category.title}</a>
        </h2>
        {category.summary && <p className="assurer-card__text">{category.summary}</p>}
      </div>
    </li>
  );
}

function Organization({ organization, apos }) {
  const logo = apos.image.first(organization._logo);
  return (
    <li className="assurer-org">
      {logo && (
        <img
          className="assurer-org__logo"
          src={apos.attachment.url(logo, { size: 'one-sixth' })}
          alt=""
          loading="lazy"
        />
      )}
      <div>
        <h3 className="assurer-org__name">{organization.title}</h3>
        {organization.shortDescription && <p>{organization.shortDescription}</p>}
        {organization.websiteUrl && (
          <a href={organization.websiteUrl} rel="noopener">
            Website<span className="assurer-visually-hidden"> of {organization.title}</span>
          </a>
        )}
      </div>
    </li>
  );
}

export default function ({ page, categoryPages = [] }, {
  Extend, Area, apos
}) {
  const organizations = page._organizations || [];
  return (
    <Extend
      templateName="layout.jsx"
      main={
        <section className="bp-content assurer-division">
          <h1>{page.title}</h1>
          <div className="assurer-division__intro">
            <Area doc={page} name="intro" />
          </div>
          {categoryPages.length > 0 && (
            <div className="assurer-cq">
              <ul className="assurer-grid assurer-grid--3 assurer-division__categories" aria-label="Product categories">
                {categoryPages.map(category => <CategoryCard category={category} apos={apos} />)}
              </ul>
            </div>
          )}
          {organizations.length > 0 && (
            <section className="assurer-division__orgs assurer-cq" aria-labelledby="division-orgs">
              <h2 id="division-orgs">Group organizations</h2>
              <ul className="assurer-org-list">
                {organizations.map(organization => <Organization organization={organization} apos={apos} />)}
              </ul>
            </section>
          )}
          <Area doc={page} name="main" />
        </section>
      }
    />
  );
}
