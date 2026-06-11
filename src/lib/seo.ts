import type { Metadata } from "next";
import { site, social } from "./site";

type BuildMetadataArgs = {
  title: string;
  description: string;
  path?: string;
  image?: string;
};

export function buildMetadata({
  title,
  description,
  path = "",
  image,
}: BuildMetadataArgs): Metadata {
  const url = `${site.url}${path}`;
  const og = image ?? site.ogImage;
  return {
    title,
    description,
    metadataBase: new URL(site.url),
    openGraph: {
      title: `${title} | ${site.name}`,
      description,
      url,
      siteName: site.name,
      images: [{ url: og, width: 1200, height: 630, alt: title }],
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${site.name}`,
      description,
      images: [og],
    },
    alternates: { canonical: url },
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Hostel",
    name: site.name,
    description: site.description,
    url: site.url,
    image: `${site.url}${site.ogImage}`,
    telephone: "+919833624363",
    priceRange: "₹₹",
    hasMap: site.mapsUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Near Hema Shree, Gokarna Main Beach",
      addressLocality: "Gokarna",
      addressRegion: "Karnataka",
      postalCode: "581421",
      addressCountry: "IN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 14.5479,
      longitude: 74.3188,
    },
    sameAs: [social.instagram, social.facebook, site.googleBusinessUrl],
  };
}
