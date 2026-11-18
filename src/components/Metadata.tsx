import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://trumpoftheday.com";

interface MetadataProps {
  title: string;
  description: string;
  /** Path under SITE_URL; social cards require absolute image URLs. */
  imagePath: string;
}

const Metadata = ({ title, description, imagePath }: MetadataProps) => {
  const image = new URL(imagePath, SITE_URL).toString();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: title,
    description,
    url: SITE_URL,
    publisher: {
      "@type": "Organization",
      name: "Trump Of The Day",
      logo: { "@type": "ImageObject", url: image },
    },
  };

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={SITE_URL} />

      <meta property="og:type" content="website" />
      <meta property="og:url" content={SITE_URL} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="Trump Of The Day" />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
    </Helmet>
  );
};

export default Metadata;
