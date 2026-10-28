import type { APIRoute } from 'astro';
import { getAllPosts, getPostHref } from '../lib/blog';
import { getChapterHref, getPublicStudyNotes, getStudySeries, getStudyModuleHref } from '../lib/study';
import { xmlEscape } from '../lib/xml';
export const GET: APIRoute = async ({ site }) => {
  const posts = await getAllPosts();
  const study = await getPublicStudyNotes();
  const paths = new Set(['/', '/about/', '/blog/', '/study-notes/', ...posts.map(getPostHref), ...study.map(getChapterHref), ...study.map(getStudyModuleHref), ...study.map((post) => `/study-notes/${getStudySeries(post.data.series).slug}/`)]);
  const modified = new Map(posts.filter((post) => post.data.updatedDate).map((post) => [getPostHref(post), post.data.updatedDate!.toISOString().slice(0, 10)]));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...paths].map((path) => `<url><loc>${xmlEscape(new URL(path, site).href)}</loc>${modified.has(path) ? `<lastmod>${modified.get(path)}</lastmod>` : ''}</url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
