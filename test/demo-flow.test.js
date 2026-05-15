const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const ledgerPath = path.join(os.tmpdir(), `pot402-demo-flow-${process.pid}.json`);
process.env.POT402_LEDGER_PATH = ledgerPath;

const { readLedger } = require('../src/ledger');
const { runLocalDevDemo } = require('../src/demo-flow');

test.after(() => {
  try { fs.unlinkSync(ledgerPath); } catch (_) {}
});

test('one-click local dev demo creates challenge, verifies local receipt, and unlocks protected payload', async () => {
  const fakeClientFactory = async () => ({
    async transferKeepAlive({ payerUri, recipient, amountPlanck }) {
      assert.equal(payerUri, '//Alice');
      return {
        txHash: '0x' + 'a'.repeat(64),
        blockHash: '0x' + 'b'.repeat(64),
        blockNumber: 42,
        payerAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        recipient,
        amountPlanck,
        feePlanck: '125000000',
        events: [{ section: 'balances', method: 'Transfer', data: ['Alice', recipient, amountPlanck] }],
      };
    },
    async disconnect() {},
  });

  const result = await runLocalDevDemo({ productId: 'weather', payer: 'Alice' }, ledgerPath, fakeClientFactory);

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'local-dev-chain');
  assert.equal(result.challenge.productId, 'weather');
  assert.equal(result.preview.extrinsic.call, 'transferKeepAlive');
  assert.equal(result.receipt.verification.status, 'verified_local_dev_chain');
  assert.equal(result.receipt.txHash, '0x' + 'a'.repeat(64));
  assert.equal(result.unlock.ok, true);
  assert.equal(result.unlock.data.product, 'Premium Weather Signal API');
  assert.equal(result.demoSteps.length, 4);

  const ledger = readLedger(ledgerPath);
  assert.equal(ledger.challenges.length, 1);
  assert.equal(ledger.receipts.length, 1);
  assert.equal(ledger.accessTokens.length, 1);
});

test('one-click local dev demo rejects non-Alice payer to keep the judge path deterministic', async () => {
  await assert.rejects(
    () => runLocalDevDemo({ productId: 'weather', payer: 'Bob' }, ledgerPath, async () => ({
      async transferKeepAlive() {
        throw new Error('should not submit with Bob');
      },
      async disconnect() {},
    })),
    (error) => error.statusCode === 400 && /Alice/.test(error.message),
  );
});
