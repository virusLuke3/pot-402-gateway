const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const ledgerPath = path.join(os.tmpdir(), `pot402-local-dev-test-${process.pid}.json`);
process.env.NODE_ENV = 'test';
process.env.POT402_LEDGER_PATH = ledgerPath;
process.env.POT402_MODE = 'local-dev';
process.env.POT402_LOCAL_RPC = 'ws://127.0.0.1:9944';

const { createChallenge, verifyAccess } = require('../src/payment');
const {
  buildLocalDevPaymentPreview,
  executeLocalDevPayment,
  normalizeDevPayerUri,
} = require('../src/local-dev-payment');

function cleanupLedger() {
  try { fs.unlinkSync(ledgerPath); } catch (_) {}
}

test.afterEach(cleanupLedger);

test('local dev payment preview uses Portaldot local node and never targets mainnet', () => {
  const challenge = createChallenge({ productId: 'weather', payer: 'judge-demo' }, ledgerPath);
  const preview = buildLocalDevPaymentPreview(challenge, { payer: 'Alice' });

  assert.equal(preview.mode, 'local-dev-chain');
  assert.equal(preview.rpcUrl, 'ws://127.0.0.1:9944');
  assert.equal(preview.network.name, 'Portaldot Local Development Network');
  assert.equal(preview.network.safety, 'local_only_no_mainnet_funds');
  assert.equal(preview.payer.alias, 'Alice');
  assert.equal(preview.payer.uri, '//Alice');
  assert.equal(preview.extrinsic.pallet, 'Balances');
  assert.equal(preview.extrinsic.call, 'transferKeepAlive');
  assert.equal(preview.extrinsic.params.dest, challenge.recipient);
  assert.equal(preview.extrinsic.params.value, challenge.amountPlanck);
});

test('local dev payment proof stores verified receipt and grants access using injected chain client', async () => {
  const challenge = createChallenge({ productId: 'builder_alpha', payer: 'judge-demo' }, ledgerPath);
  let disconnected = false;

  const fakeClientFactory = async ({ rpcUrl }) => {
    assert.equal(rpcUrl, 'ws://127.0.0.1:9944');
    return {
      async transferKeepAlive({ payerUri, recipient, amountPlanck }) {
        assert.equal(payerUri, '//Alice');
        assert.equal(recipient, challenge.recipient);
        assert.equal(amountPlanck, challenge.amountPlanck);
        return {
          txHash: '0x' + '1'.repeat(64),
          blockHash: '0x' + '2'.repeat(64),
          blockNumber: 42,
          payerAddress: '5GrwvaEF5zXb26Fz9rcQpDWSqonWZZYQY1mPW7SuQkYjzJ7h',
          feePlanck: '12345',
          events: [
            { section: 'balances', method: 'Transfer' },
            { section: 'system', method: 'ExtrinsicSuccess' },
          ],
        };
      },
      async disconnect() { disconnected = true; },
    };
  };

  const result = await executeLocalDevPayment(
    { challengeId: challenge.id, payer: 'Alice' },
    ledgerPath,
    fakeClientFactory,
  );

  assert.equal(disconnected, true);
  assert.equal(result.receipt.mode, 'local-dev-chain');
  assert.equal(result.receipt.verification.status, 'verified_local_dev_chain');
  assert.equal(result.receipt.txHash, '0x' + '1'.repeat(64));
  assert.equal(result.receipt.blockHash, '0x' + '2'.repeat(64));
  assert.equal(result.receipt.productId, 'builder_alpha');
  assert.equal(result.receipt.recipient, challenge.recipient);
  assert.equal(result.receipt.amountPlanck, challenge.amountPlanck);
  assert.equal(typeof result.accessToken.token, 'string');

  const access = verifyAccess({ token: result.accessToken.token, productId: 'builder_alpha' }, ledgerPath);
  assert.equal(access.ok, true);
  assert.equal(access.receipt.mode, 'local-dev-chain');
});

test('local dev payer input only allows well-known public dev accounts', () => {
  assert.equal(normalizeDevPayerUri('Alice').uri, '//Alice');
  assert.equal(normalizeDevPayerUri('//Bob').alias, 'Bob');
  assert.throws(() => normalizeDevPayerUri('bottom drive obey lake curtain smoke basket hold race lonely fit walk'), /Only well-known public dev accounts/);
  assert.throws(() => normalizeDevPayerUri('0xabc123'), /Only well-known public dev accounts/);
});
