import type { APIRoute } from 'astro';
import { getAllPosts, toSearchRecord } from '../lib/blog';

export const GET: APIRoute = async () => {
  const posts = await getAllPosts();
  return new Response(JSON.stringify(posts.map(toSearchRecord)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
