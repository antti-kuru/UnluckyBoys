import type { APIRoute } from "astro";

const apiBaseUrl = import.meta.env.API_BASE_URL ?? "http://127.0.0.1:8000/api";

export const prerender = false;

export const ALL: APIRoute = async ({ request, params }) => {
  const incomingUrl = new URL(request.url);
  const path = params.path ?? "";
  const targetUrl = new URL(`${apiBaseUrl.replace(/\/$/, "")}/${path}`);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual"
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
};
