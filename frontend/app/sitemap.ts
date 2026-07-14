import { MetadataRoute } from "next";

const BASE = "https://clearcash.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const marketing: MetadataRoute.Sitemap = [
    { url: BASE,                          lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/features`,            lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/pricing`,             lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/roi-calculator`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/about`,               lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`,             lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];
  return marketing;
}
