const crypto = require('node:crypto');
const { config } = require('./config');
const { readLedger, writeLedger } = require('./ledger');

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function fakeTxHash(seed) {
  return `0x${crypto.createHash('sha256').update(seed).digest('hex')}`;
}

function getProduct(productId = 'weather') {
  const products = {
    weather: {
      id: 'weather',
      name: 'Premium Weather Signal API',
      endpoint: '/api/protected/weather',
      description: 'Demo premium API response unlocked by a POT-402 receipt.',
      amountPOT: config.amountPOT,
      amountPlanck: config.amountPlanck,
    },
    builder_alpha: {
      id: 'builder_alpha',
      name: 'Builder Alpha Feed',
      endpoint: '/api/protected/builder_alpha',
      description: 'Demo paid builder-intelligence feed for Portaldot ecosystem projects.',
      amountPOT: '0.0020',
      amountPlanck: String(2n * 10n ** 11n),
    },
  };
  return products[productId] || products.weather;
}

function createChallenge({ productId = 'weather', payer = 'demo-user' } = {}, ledgerPath = config.ledgerPath) {
  const product = getProduct(productId);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + config.challengeTTLSeconds * 1000);
  const challenge = {
    id: randomId('ch'),
    type: 'portaldot-pot-402-challenge',
    productId: product.id,
    endpoint: product.endpoint,
    payerHint: payer,
    recipient: config.recipient,
    amountPOT: product.amountPOT,
    amountPlanck: product.amountPlanck,
    token: config.token,
    decimals: config.decimals,
    network: {
      name: 'Portaldot Mainnet',
      rpcUrl: config.rpcUrl,
      ss58Format: config.ss58Format,
      nativeToken: config.token,
    },
    suggestedExtrinsic: {
      pallet: 'Balances',
      call: 'transferKeepAlive',
      params: {
        dest: config.recipient,
        value: product.amountPlanck,
      },
    },
    memo: `POT402:${Date.now()}:${randomId('nonce')}`,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
    safety: {
      mode: config.mode,
      note: 'Mock receipts are safe for local demos. Real Portaldot transactions require explicit user confirmation.',
    },
  };
  const ledger = readLedger(ledgerPath);
  ledger.challenges.push(challenge);
  writeLedger(ledgerPath, ledger);
  return challenge;
}

function findChallenge(challengeId, ledger) {
  return ledger.challenges.find((challenge) => challenge.id === challengeId);
}

function isExpired(challenge) {
  return new Date(challenge.expiresAt).getTime() < Date.now();
}

function simulateReceipt({ challengeId, payer = 'demo-payer' }, ledgerPath = config.ledgerPath) {
  const ledger = readLedger(ledgerPath);
  const challenge = findChallenge(challengeId, ledger);
  if (!challenge) {
    const error = new Error('Unknown challenge id');
    error.statusCode = 404;
    throw error;
  }
  if (isExpired(challenge)) {
    const error = new Error('Challenge expired');
    error.statusCode = 410;
    throw error;
  }
  const receipt = {
    id: randomId('rcpt'),
    type: 'mock-portaldot-payment-receipt',
    challengeId: challenge.id,
    productId: challenge.productId,
    mode: 'mock',
    payer,
    recipient: challenge.recipient,
    amountPOT: challenge.amountPOT,
    amountPlanck: challenge.amountPlanck,
    token: challenge.token,
    txHash: fakeTxHash(`${challenge.id}:${payer}:${challenge.amountPlanck}`),
    blockHash: fakeTxHash(`block:${challenge.id}`).slice(0, 66),
    verifiedAt: nowIso(),
    verification: {
      status: 'verified_mock',
      note: 'This is a deterministic safe-mode receipt. Do not present it as a real on-chain transaction.',
    },
  };
  const accessToken = {
    id: randomId('access'),
    token: crypto.createHash('sha256').update(`${receipt.id}:${receipt.txHash}`).digest('hex'),
    receiptId: receipt.id,
    challengeId: challenge.id,
    productId: challenge.productId,
    endpoint: challenge.endpoint,
    issuedAt: nowIso(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  challenge.status = 'paid_mock';
  ledger.receipts.push(receipt);
  ledger.accessTokens.push(accessToken);
  writeLedger(ledgerPath, ledger);
  return { receipt, accessToken };
}

function verifyAccess({ token, productId }, ledgerPath = config.ledgerPath) {
  if (!token) return { ok: false, reason: 'missing_access_token' };
  const ledger = readLedger(ledgerPath);
  const access = ledger.accessTokens.find((item) => item.token === token);
  if (!access) return { ok: false, reason: 'unknown_access_token' };
  if (productId && access.productId !== productId) return { ok: false, reason: 'wrong_product' };
  if (new Date(access.expiresAt).getTime() < Date.now()) return { ok: false, reason: 'access_expired' };
  const receipt = ledger.receipts.find((item) => item.id === access.receiptId);
  return { ok: true, access, receipt };
}

function premiumPayload(productId) {
  if (productId === 'builder_alpha') {
    return {
      product: 'Builder Alpha Feed',
      unlocked: true,
      insight: 'Portaldot builders are rewarded for native Substrate-first UX, clear demos, and POT-visible proofs.',
      opportunities: ['payment flows', 'builder tooling', 'onchain identity', 'AI-assisted execution'],
      generatedAt: nowIso(),
    };
  }
  return {
    product: 'Premium Weather Signal API',
    unlocked: true,
    city: 'Portaldot Demo City',
    signal: 'clear-demo-skies',
    temperatureC: 26,
    message: 'This premium API response was unlocked by a POT-402 receipt.',
    generatedAt: nowIso(),
  };
}

module.exports = {
  getProduct,
  createChallenge,
  simulateReceipt,
  verifyAccess,
  premiumPayload,
  fakeTxHash,
};
