import type { MetadataRoute } from 'next';

/**
 * The public sitemap.
 *
 * Only pages a search engine should reach: the ministry's public face and its
 * policies. Nothing behind sign-in appears here, and nothing here is generated
 * from the database — a sitemap that named live counselling or event records
 * would leak their existence to anyone who fetched it.
 *
 * URLs are absolute against NEXT_PUBLIC_APP_URL, as the sitemap protocol
 * requires, so moving the platform to another domain needs no change here.
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/** Path, and how often a crawler should bother coming back. */
const PAGES: Array<[path: string, changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly', priority: number]> = [
  ['/', 'weekly', 1],
  ['/about', 'monthly', 0.8],
  ['/beliefs', 'yearly', 0.7],
  ['/leadership', 'monthly', 0.6],
  ['/ministries', 'monthly', 0.7],
  ['/missions', 'monthly', 0.6],
  ['/centers', 'monthly', 0.6],
  ['/counselling', 'monthly', 0.9],
  ['/prayer', 'monthly', 0.8],
  ['/discipleship', 'weekly', 0.8],
  ['/resources', 'weekly', 0.7],
  ['/events', 'daily', 0.7],
  ['/download', 'monthly', 0.8],
  ['/contact', 'yearly', 0.6],
  ['/faq', 'monthly', 0.6],
  ['/privacy', 'yearly', 0.4],
  ['/terms', 'yearly', 0.4],
  ['/safeguarding', 'yearly', 0.5],
  ['/counselling-disclaimer', 'yearly', 0.4],
  ['/community-guidelines', 'yearly', 0.4],
  ['/data-rights', 'yearly', 0.4],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map(([path, changeFrequency, priority]) => ({
    url: new URL(path, appUrl).toString(),
    lastModified,
    changeFrequency,
    priority,
  }));
}
