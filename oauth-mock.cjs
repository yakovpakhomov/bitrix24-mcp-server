const http = require('http');
const url = require('url');

const SECRET = 'fd8466e121bf371407c8a0d521f8c5f794ea2c194632243a42e08f6c40125064';

http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname;

  // CORS headers for token endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // OAuth2 metadata discovery
  if (path === '/.well-known/oauth-authorization-server') {
    const host = req.headers.host || 'bitrix24-mcp.pakhomov.info';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      issuer: `https://${host}`,
      authorization_endpoint: `https://${host}/authorize`,
      token_endpoint: `https://${host}/token`,
      registration_endpoint: `https://${host}/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256', 'plain']
    }));
  }

  // Authorization endpoint — redirect back with auth code
  if (path === '/authorize') {
    const redirectUri = parsed.query.redirect_uri;
    const state = parsed.query.state || '';
    const code = 'bitrix24_auth_' + Date.now();

    if (!redirectUri) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing redirect_uri');
    }

    const separator = redirectUri.includes('?') ? '&' : '?';
    const redirect = `${redirectUri}${separator}code=${code}${state ? '&state=' + encodeURIComponent(state) : ''}`;

    console.error(`[OAuth] Authorize -> redirect to ${redirect}`);
    res.writeHead(302, { Location: redirect });
    return res.end();
  }

  // Token endpoint — return access token
  if (path === '/token') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.error(`[OAuth] Token request: ${body}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        access_token: SECRET,
        token_type: 'bearer',
        expires_in: 86400,
        refresh_token: 'refresh_' + Date.now()
      }));
    });
    return;
  }

  // Dynamic client registration
  if (path === '/register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.error(`[OAuth] Register request: ${body}`);
      const data = JSON.parse(body || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        client_id: 'bitrix24-mcp-client',
        client_secret: 'bitrix24-mcp-secret',
        client_name: data.client_name || 'Claude AI',
        redirect_uris: data.redirect_uris || [],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none'
      }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');

}).listen(8090, '127.0.0.1', () => {
  console.error('OAuth mock server running on port 8090');
});
