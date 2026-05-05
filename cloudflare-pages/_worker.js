const DEFAULT_API_ORIGIN = 'https://e-com-website-i25p.onrender.com';

function apiOrigin(env) {
  return (env.API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, '');
}

async function proxyApi(request, env) {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(sourceUrl.pathname + sourceUrl.search, apiOrigin(env));
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', sourceUrl.host);
  headers.set('x-forwarded-proto', sourceUrl.protocol.replace(':', ''));

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual'
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return proxyApi(request, env);
    }

    if (url.pathname === '/admin') {
      url.pathname = '/admin/';
      return Response.redirect(url.toString(), 308);
    }

    return env.ASSETS.fetch(request);
  }
};
