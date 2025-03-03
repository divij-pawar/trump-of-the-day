import React from 'react';
import { Helmet } from 'react-helmet';

const Metadata = ({ 
  // Basic metadata
  title,
  description,
  image,
  url,
  
  // Additional SEO metadata
  keywords,
  author,
  language = 'en',
  canonicalUrl,
  
  // Open Graph enhancements
  ogType = 'website',
  ogSiteName,
  ogLocale = 'en_US',
  ogArticlePublishedTime,
  ogArticleModifiedTime,
  ogArticleAuthor,
  ogArticleSection,
  ogArticleTags,
  
  // Twitter enhancements
  twitterCard = 'summary_large_image',
  twitterSite,
  twitterCreator,
  
  // Robots & indexing
  robots,
  googlebot,
  
  // Structured data
  structuredData,
  
  // App linking
  appleTouchIcon,
  appName,
  appId,
  
  // Favicon
  favicon,
  
  // Theme color
  themeColor,
  
  // Viewport settings
  viewport = 'width=device-width, initial-scale=1',
  
  // Additional custom tags
  additionalTags = [],
}) => {
  return (
    <Helmet>
      {/* Standard metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {author && <meta name="author" content={author} />}
      <meta httpEquiv="Content-Language" content={language} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Viewport settings */}
      <meta name="viewport" content={viewport} />
      
      {/* Favicon */}
      {favicon && <link rel="icon" href={favicon} />}
      
      {/* Apple Touch Icon */}
      {appleTouchIcon && <link rel="apple-touch-icon" href={appleTouchIcon} />}
      
      {/* Theme Color */}
      {themeColor && <meta name="theme-color" content={themeColor} />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      {ogSiteName && <meta property="og:site_name" content={ogSiteName} />}
      <meta property="og:locale" content={ogLocale} />
      
      {/* Open Graph Article specific (only used when ogType is 'article') */}
      {ogType === 'article' && ogArticlePublishedTime && (
        <meta property="article:published_time" content={ogArticlePublishedTime} />
      )}
      {ogType === 'article' && ogArticleModifiedTime && (
        <meta property="article:modified_time" content={ogArticleModifiedTime} />
      )}
      {ogType === 'article' && ogArticleAuthor && (
        <meta property="article:author" content={ogArticleAuthor} />
      )}
      {ogType === 'article' && ogArticleSection && (
        <meta property="article:section" content={ogArticleSection} />
      )}
      {ogType === 'article' && ogArticleTags && Array.isArray(ogArticleTags) && (
        ogArticleTags.map((tag, index) => (
          <meta key={`article:tag:${index}`} property="article:tag" content={tag} />
        ))
      )}
      
      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {twitterSite && <meta name="twitter:site" content={twitterSite} />}
      {twitterCreator && <meta name="twitter:creator" content={twitterCreator} />}
      
      {/* App linking */}
      {appName && <meta name="application-name" content={appName} />}
      {appId && <meta name="apple-itunes-app" content={`app-id=${appId}`} />}
      
      {/* Robots & indexing */}
      {robots && <meta name="robots" content={robots} />}
      {googlebot && <meta name="googlebot" content={googlebot} />}
      
      {/* Structured Data / JSON-LD */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
      
      {/* Additional custom tags */}
      {additionalTags.map((tag, index) => {
        const { type, ...props } = tag;
        if (type === 'meta') {
          return <meta key={`custom-meta-${index}`} {...props} />;
        } else if (type === 'link') {
          return <link key={`custom-link-${index}`} {...props} />;
        } else if (type === 'script') {
          return <script key={`custom-script-${index}`} {...props} />;
        }
        return null;
      })}
    </Helmet>
  );
};

export default Metadata;