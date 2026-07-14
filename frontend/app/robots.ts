import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features", "/pricing", "/roi-calculator", "/about", "/contact"],
        disallow: ["/api/", "/dashboard/", "/actuals/", "/dev/", "/forecast/", "/settings/"],
      },
    ],
    sitemap: "https://clearcash.app/sitemap.xml",
  };
}
