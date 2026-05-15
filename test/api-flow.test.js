const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const ledgerPath = path.join(os.tmpdir(), `pot402-test-${process.pid}.json`);
process.env.NODE_ENV = 'test';
process.env.POT402_LEDGER_PATH = ledgerPath;
process.env.POT402_MODE = 'mock';

const { createApp } = require('../src/server');

async function withServer(fn) {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try { fs.unlinkSync(ledgerPath); } catch (_) {}
  }
}

test('health and chain config expose Portaldot safe-mode facts', async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);
    assert.equal(health.mode, 'mock');

    const chain = await fetch(`${baseUrl}/api/chain/config`).then((r) => r.json());
    assert.equal(chain.chain, 'Portaldot');
    assert.equal(chain.rpcUrl, 'wss://mainnet.portaldot.io');
    assert.equal(chain.token, 'POT');
    assert.equal(chain.decimals, 14);
    assert.equal(chain.nativeProofPrimitive, 'balances.transferKeepAlive(dest, value)');
  });
});

test('protected API returns 402 challenge, simulated receipt unlocks premium response', async () => {
  await withServer(async (baseUrl) => {
    const first = await fetch(`${baseUrl}/api/protected/weather`);
    assert.equal(first.status, 402);
    assert.equal(first.headers.get('x-pot-402-challenge')?.startsWith('ch_'), true);
    const paymentRequired = await first.json();
    assert.equal(paymentRequired.error, 'payment_required');
    assert.equal(paymentRequired.challenge.token, 'POT');
    assert.equal(paymentRequired.challenge.network.rpcUrl, 'wss://mainnet.portaldot.io');
    assert.equal(paymentRequired.challenge.suggestedExtrinsic.call, 'transferKeepAlive');

    const simulated = await fetch(`${baseUrl}/api/receipts/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId: paymentRequired.challenge.id, payer: 'judge-demo' }),
    });
    assert.equal(simulated.status, 201);
    const receiptResponse = await simulated.json();
    assert.equal(receiptResponse.receipt.mode, 'mock');
    assert.match(receiptResponse.receipt.txHash, /^0x[0-9a-f]{64}$/);
    assert.equal(typeof receiptResponse.accessToken.token, 'string');

    const unlocked = await fetch(`${baseUrl}/api/protected/weather?accessToken=${receiptResponse.accessToken.token}`);
    assert.equal(unlocked.status, 200);
    const payload = await unlocked.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.data.unlocked, true);
    assert.equal(payload.data.message, 'This premium API response was unlocked by a POT-402 receipt.');
  });
});

test('wrong product access token is rejected with a new 402 challenge', async () => {
  await withServer(async (baseUrl) => {
    const challengeResponse = await fetch(`${baseUrl}/api/protected/weather`).then((r) => r.json());
    const receiptResponse = await fetch(`${baseUrl}/api/receipts/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId: challengeResponse.challenge.id, payer: 'judge-demo' }),
    }).then((r) => r.json());

    const wrong = await fetch(`${baseUrl}/api/protected/builder_alpha?accessToken=${receiptResponse.accessToken.token}`);
    assert.equal(wrong.status, 402);
    const wrongBody = await wrong.json();
    assert.equal(wrongBody.challenge.productId, 'builder_alpha');
  });
});

test('ledger endpoint redacts access tokens', async () => {
  await withServer(async (baseUrl) => {
    const challengeResponse = await fetch(`${baseUrl}/api/protected/weather`).then((r) => r.json());
    const receiptResponse = await fetch(`${baseUrl}/api/receipts/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId: challengeResponse.challenge.id, payer: 'judge-demo' }),
    }).then((r) => r.json());

    const ledger = await fetch(`${baseUrl}/api/ledger`).then((r) => r.json());
    assert.equal(ledger.accessTokens.length, 1);
    assert.notEqual(ledger.accessTokens[0].token, receiptResponse.accessToken.token);
    assert.match(ledger.accessTokens[0].token, /^.{8}…redacted$/);
  });
});

test('local dev preview endpoint prepares localhost-only transfer proof', async () => {
  await withServer(async (baseUrl) => {
    const challengeResponse = await fetch(`${baseUrl}/api/protected/weather`).then((r) => r.json());
    const previewResponse = await fetch(`${baseUrl}/api/receipts/local-dev/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId: challengeResponse.challenge.id, payer: 'Alice' }),
    });
    assert.equal(previewResponse.status, 200);
    const preview = await previewResponse.json();
    assert.equal(preview.mode, 'local-dev-chain');
    assert.equal(preview.rpcUrl, 'ws://127.0.0.1:9944');
    assert.equal(preview.network.safety, 'local_only_no_mainnet_funds');
    assert.equal(preview.payer.uri, '//Alice');
    assert.equal(preview.extrinsic.call, 'transferKeepAlive');
    assert.equal(preview.extrinsic.params.dest, challengeResponse.challenge.recipient);
    assert.equal(preview.extrinsic.params.value, challengeResponse.challenge.amountPlanck);
  });
});
