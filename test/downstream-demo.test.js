const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const ledgerPath = path.join(os.tmpdir(), `pot402-downstream-${process.pid}.json`);
process.env.NODE_ENV = 'test';
process.env.POT402_LEDGER_PATH = ledgerPath;
process.env.POT402_MODE = 'local-dev';

const { createApp } = require('../src/server');

async function withServer(fn, appOptions = {}) {
  const server = createApp(appOptions);
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

function fakeLocalDevClientFactory() {
  return async () => ({
    async transferKeepAlive({ payerUri, recipient, amountPlanck }) {
      assert.equal(payerUri, '//Alice');
      return {
        txHash: '0x' + 'e'.repeat(64),
        blockHash: '0x' + 'f'.repeat(64),
        blockNumber: 99,
        payerAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient,
        amountPlanck,
        feePlanck: '1460304736255',
        events: [{ section: 'balances', method: 'Transfer', data: ['Alice', recipient, amountPlanck] }],
      };
    },
    async disconnect() {},
  });
}

test('downstream Hackathon Report API returns 402 before payment and unlocks after verified local-dev receipt', async () => {
  await withServer(async (baseUrl) => {
    const idea = 'POT-402 pay-per-call APIs for Portaldot builders';

    const unpaid = await fetch(`${baseUrl}/api/downstream/hackathon-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea, payer: 'Alice' }),
    });
    assert.equal(unpaid.status, 402);
    const unpaidBody = await unpaid.json();
    assert.equal(unpaidBody.scenario, 'downstream_hackathon_report');
    assert.equal(unpaidBody.challenge.productId, 'hackathon_report');
    assert.equal(unpaidBody.challenge.endpoint, '/api/downstream/hackathon-report');
    assert.equal(unpaidBody.challenge.network.rpcUrl, 'ws://127.0.0.1:9944');
    assert.equal(unpaidBody.challenge.suggestedExtrinsic.call, 'transferKeepAlive');

    const demo = await fetch(`${baseUrl}/api/demo/downstream/hackathon-report/local-dev`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea, payer: 'Alice' }),
    });
    assert.equal(demo.status, 201);
    const body = await demo.json();
    assert.equal(body.ok, true);
    assert.equal(body.scenario, 'paid_ai_hackathon_report');
    assert.equal(body.upstream.receipt.verification.status, 'verified_local_dev_chain');
    assert.equal(body.upstream.receipt.amountPOT, '0.0030');
    assert.equal(body.downstream.verification.status, 'accepted_verified_local_dev_chain_receipt');
    assert.equal(body.downstream.verification.checked.includes('receipt_status_verified_local_dev_chain'), true);
    assert.equal(body.downstream.report.title, 'POT-402 Verified Hackathon Report');
    assert.equal(body.downstream.report.idea, idea);
    assert.equal(body.downstream.report.receiptProof.txHash, '0x' + 'e'.repeat(64));
    assert.equal(body.downstream.report.sections.mvp.includes('HTTP 402'), true);
  }, { localDevClientFactory: fakeLocalDevClientFactory() });
});

test('downstream Hackathon Report API rejects mock receipts because the downstream demo requires real local-dev chain verification', async () => {
  await withServer(async (baseUrl) => {
    const unpaid = await fetch(`${baseUrl}/api/downstream/hackathon-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: 'Mock should not pass the downstream verifier' }),
    });
    assert.equal(unpaid.status, 402);
    const unpaidBody = await unpaid.json();

    const simulated = await fetch(`${baseUrl}/api/receipts/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ challengeId: unpaidBody.challenge.id, payer: 'judge-demo' }),
    });
    assert.equal(simulated.status, 201);
    const simulatedBody = await simulated.json();
    assert.equal(simulatedBody.receipt.verification.status, 'verified_mock');

    const downstream = await fetch(`${baseUrl}/api/downstream/hackathon-report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idea: 'Mock should not pass the downstream verifier',
        accessToken: simulatedBody.accessToken.token,
      }),
    });
    assert.equal(downstream.status, 403);
    const downstreamBody = await downstream.json();
    assert.equal(downstreamBody.error, 'receipt_not_verified');
    assert.equal(downstreamBody.verification.reason, 'requires_verified_local_dev_chain');
    assert.equal(downstreamBody.verification.receiptVerification, 'verified_mock');
  });
});
