const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { config } = require('./config');
const { readLedger, resetLedger } = require('./ledger');
const { chainConfig, getChainStatus } = require('./chain');
const { createChallenge, getProduct, premiumPayload, simulateReceipt, verifyAccess } = require('./payment');
const { buildLocalDevPaymentPreview, executeLocalDevPayment } = require('./local-dev-payment');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function sendJson(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'content-type': contentType });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(Object.assign(new Error('Request too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (error) { reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function contentTypeFor(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.normalize(path.join(PUBLIC_DIR, safePath));
  const relativePath = path.relative(PUBLIC_DIR, fullPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    sendText(res, 403, 'Forbidden');
    return true;
  }
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return false;
  }
  sendText(res, 200, fs.readFileSync(fullPath), contentTypeFor(fullPath));
  return true;
}

function paymentRequired(res, challenge) {
  sendJson(res, 402, {
    error: 'payment_required',
    message: 'This endpoint is protected by POT-402. Submit a Portaldot/POT payment proof to unlock it.',
    challenge,
  }, {
    'x-pot-402-challenge': challenge.id,
  });
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { ok: true, app: config.appName, mode: config.mode, time: new Date().toISOString() });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/chain/config') {
    sendJson(res, 200, chainConfig());
    return;
  }

  if (req.method === 'GET' && pathname === '/api/chain/status') {
    sendJson(res, 200, await getChainStatus());
    return;
  }

  if (req.method === 'GET' && pathname === '/api/products') {
    sendJson(res, 200, { products: [getProduct('weather'), getProduct('builder_alpha')] });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/challenges') {
    const body = await parseBody(req);
    const challenge = createChallenge({ productId: body.productId || 'weather', payer: body.payer || 'demo-user' });
    paymentRequired(res, challenge);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/receipts/simulate') {
    const body = await parseBody(req);
    const result = simulateReceipt({ challengeId: body.challengeId, payer: body.payer || 'demo-payer' });
    sendJson(res, 201, {
      ...result,
      safety: 'Mock receipt created for local demo only. Real Portaldot transaction broadcasting is disabled until explicit user confirmation.',
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/receipts/local-dev/preview') {
    const body = await parseBody(req);
    const ledger = readLedger(config.ledgerPath);
    const challenge = ledger.challenges.find((item) => item.id === body.challengeId);
    if (!challenge) {
      sendJson(res, 404, { error: 'unknown_challenge_id' });
      return;
    }
    sendJson(res, 200, buildLocalDevPaymentPreview(challenge, { payer: body.payer || 'Alice' }));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/receipts/local-dev') {
    const body = await parseBody(req);
    const result = await executeLocalDevPayment({ challengeId: body.challengeId, payer: body.payer || 'Alice' });
    sendJson(res, 201, {
      ...result,
      safety: 'Submitted only to the localhost Portaldot development node. This endpoint refuses public RPC targets and never uses mainnet funds.',
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/ledger') {
    const ledger = readLedger(config.ledgerPath);
    sendJson(res, 200, {
      challenges: ledger.challenges,
      receipts: ledger.receipts,
      accessTokens: ledger.accessTokens.map((accessToken) => ({
        ...accessToken,
        token: `${accessToken.token.slice(0, 8)}…redacted`,
      })),
      safety: 'Access tokens are redacted from this public ledger endpoint. Use the receipt response returned during the local demo to unlock protected APIs.',
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/dev/reset' && process.env.NODE_ENV === 'test') {
    sendJson(res, 200, resetLedger(config.ledgerPath));
    return;
  }

  const protectedMatch = pathname.match(/^\/api\/protected\/(weather|builder_alpha)$/);
  if (req.method === 'GET' && protectedMatch) {
    const productId = protectedMatch[1];
    const token = url.searchParams.get('accessToken') || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const access = verifyAccess({ token, productId });
    if (!access.ok) {
      const challenge = createChallenge({ productId, payer: 'anonymous' });
      paymentRequired(res, challenge);
      return;
    }
    sendJson(res, 200, {
      ok: true,
      access: access.access,
      receipt: access.receipt,
      data: premiumPayload(productId),
    });
    return;
  }

  if (req.method === 'GET' && serveStatic(req, res, pathname)) return;
  sendJson(res, 404, { error: 'not_found', pathname });
}

function createApp() {
  return http.createServer((req, res) => {
    route(req, res).catch((error) => {
      const statusCode = error.statusCode || 500;
      sendJson(res, statusCode, {
        error: statusCode === 503 ? 'service_unavailable' : (statusCode >= 500 ? 'internal_error' : 'bad_request'),
        message: error.message,
      });
    });
  });
}

if (require.main === module) {
  const server = createApp();
  server.listen(config.port, () => {
    console.log(`${config.appName} listening on http://localhost:${config.port}`);
    console.log(`Mode: ${config.mode}; real transaction broadcast is disabled by default.`);
  });
}

module.exports = { createApp, route };
