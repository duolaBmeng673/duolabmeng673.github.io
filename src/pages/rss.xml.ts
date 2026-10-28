import type { APIRoute } from 'astro';
import { getAllPosts, getPostHref } from '../lib/blog';
import { siteConfig } from '../config';
import { xmlEscape } from '../lib/xml';
export const GET: APIRoute = async ({ site }) => {
  const posts = await getAllPosts();
  const items = posts.map((post) => {
    const href = xmlEscape(new URL(getPostHref(post), site).href);
    return `<item><title>${xmlEscape(post.data.title)}</title><link>${href}</link><guid isPermaLink="true">${href}</guid><pubDate>${post.data.pubDate.toUTCString()}</pubDate><description>${xmlEscape(post.data.description)}</description><category>${xmlEscape(post.data.category)}</category></item>`;
  }).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(siteConfig.title)}</title><link>${xmlEscape(site!.href)}</link><description>${xmlEscape(siteConfig.description)}</description><language>zh-CN</language><atom:link href="${xmlEscape(new URL('/rss.xml', site).href)}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
