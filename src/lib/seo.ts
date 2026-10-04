// Panda.fun Dynamic SEO & Metadata utility
export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  type?: 'website' | 'video.other' | 'video.movie' | 'video.episode' | 'video.tv_show';
  canonicalUrl?: string;
  schema?: Record<string, any>;
  keywords?: string[];
  noindex?: boolean;
}

const SITE_NAME = 'Panda.fun';
const DEFAULT_DESCRIPTION = 'Watch anime, movies and TV series on Panda.fun. Discover trending titles, new releases, popular shows and stories worth watching.';
const DEFAULT_IMAGE = '/icon.svg';

function absoluteUrl(value: string) {
  if (!value) return '';
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

export function updateSEO({
  title,
  description,
  image,
  type = 'website',
  canonicalUrl,
  schema,
  keywords,
  noindex = false,
}: SEOProps) {
  const cleanTitle = title?.trim() || SITE_NAME;
  const fullTitle = cleanTitle === SITE_NAME ? SITE_NAME : `${cleanTitle} — ${SITE_NAME}`;
  const defaultDesc = description?.trim() || DEFAULT_DESCRIPTION;
  const defaultImage = absoluteUrl(image || DEFAULT_IMAGE);
  const url = canonicalUrl || (typeof window !== 'undefined' ? window.location.href : '/');

  document.title = fullTitle;

  const setMetaTag = (attrName: string, attrVal: string, content: string) => {
    let el = document.querySelector(`meta[${attrName}="${attrVal}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMetaTag('name', 'description', defaultDesc);
  setMetaTag('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setMetaTag('name', 'theme-color', '#0b0c10');
  if (keywords?.length) setMetaTag('name', 'keywords', keywords.join(', '));

  setMetaTag('property', 'og:title', fullTitle);
  setMetaTag('property', 'og:description', defaultDesc);
  setMetaTag('property', 'og:image', defaultImage);
  setMetaTag('property', 'og:image:alt', `${cleanTitle} on ${SITE_NAME}`);
  setMetaTag('property', 'og:type', type);
  setMetaTag('property', 'og:url', url);
  setMetaTag('property', 'og:site_name', SITE_NAME);
  setMetaTag('property', 'og:locale', 'en_US');

  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', fullTitle);
  setMetaTag('name', 'twitter:description', defaultDesc);
  setMetaTag('name', 'twitter:image', defaultImage);
  setMetaTag('name', 'twitter:image:alt', `${cleanTitle} on ${SITE_NAME}`);

  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', url);

  const schemaId = 'panda-schema-structured-data';
  let scriptEl = document.getElementById(schemaId) as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = schemaId;
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const defaultSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${origin || '/'}/#website`,
        name: SITE_NAME,
        url: origin || '/',
        description: DEFAULT_DESCRIPTION,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${origin || ''}/search?keyword={search_term_string}` },
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@type': 'Organization',
        '@id': `${origin || '/'}/#organization`,
        name: SITE_NAME,
        url: origin || '/',
        logo: { '@type': 'ImageObject', url: origin ? `${origin}/icon.svg` : DEFAULT_IMAGE }
      }
    ]
  };

  scriptEl.textContent = JSON.stringify(schema || defaultSchema);
}
