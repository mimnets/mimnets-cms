// Which WordPress pages the import brings in, and how (m1-067; design note
// docs/content/wordpress-import-design.md §2). Paths are the WordPress paths
// without the trailing slash. Every other page is skipped: the pages
// D-CONTENT-3 retires are redirected instead (assurer-seo:seed-redirects).
export const PAGES = [
  {
    path: '/',
    handler: 'home'
  },
  {
    path: '/style',
    handler: 'division'
  },
  {
    path: '/style/apparels-textiles',
    handler: 'category',
    parent: '/style'
  },
  {
    path: '/style/activewear-accessories',
    handler: 'category',
    parent: '/style'
  },
  {
    path: '/style/home-tex-decor',
    handler: 'category',
    parent: '/style'
  },
  {
    path: '/health',
    handler: 'division'
  },
  {
    path: '/health/health-tex-medi-care',
    handler: 'category',
    parent: '/health'
  },
  {
    path: '/health/beauty-herbs',
    handler: 'category',
    parent: '/health'
  },
  {
    path: '/health/food-minerals',
    handler: 'category',
    parent: '/health'
  },
  // People are left out until they consent (D-CONTENT-4; owner, m1-067):
  // only the page's headings come in.
  {
    path: '/leadership',
    handler: 'headings'
  },
  {
    path: '/contact-us',
    handler: 'contact'
  },
  {
    path: '/downloads',
    handler: 'downloads'
  },
  {
    path: '/gallery/images',
    handler: 'gallery'
  }
];

// Pages read only for their file links. The PDFs on them become file
// records tagged with the category (D-CONTENT-3: the pages themselves are
// merged into the category pages and redirected).
export const DOWNLOAD_SOURCES = {
  '/downloads': null,
  '/downloads/corporate-profiles': null,
  '/downloads/apparels-textiles': '/style/apparels-textiles',
  '/downloads/active-wear-accessories': '/style/activewear-accessories',
  '/downloads/home-tex-decor': '/style/home-tex-decor',
  '/downloads/beauty-herbs': '/health/beauty-herbs',
  '/downloads/food-minerals': '/health/food-minerals',
  '/downloads/health-tex-medi-care': '/health/health-tex-medi-care'
};

// The tag for files that belong to no single category.
export const CORPORATE_TAG = 'Corporate';

// The home page section whose cards are the group's entities (D-CONTENT-2).
export const ORGANIZATIONS_HEADING = /entities/i;

// Marks figures that need the owner's confirmation (D-CONTENT-12).
export const UNCONFIRMED_NOTE = 'Unconfirmed: check before publishing';

// The tag on every imported image and file, for review.
export const REVIEW_TAG = 'Imported from WordPress';
