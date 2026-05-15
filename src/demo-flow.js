const { createChallenge, premiumPayload, verifyAccess } = require('./payment');
const { executeLocalDevPayment } = require('./local-dev-payment');
const { config } = require('./config');

function requireAliceDemoPayer(payer = 'Alice') {
  const normalized = String(payer || 'Alice').trim();
  if (normalized !== 'Alice' && normalized !== '//Alice') {
    throw Object.assign(
      new Error('One-click local-dev demo is intentionally restricted to Alice / //Alice for deterministic judge demos.'),
      { statusCode: 400 },
    );
  }
  return 'Alice';
}

async function runLocalDevDemo(
  { productId = 'weather', payer = 'Alice' } = {},
  ledgerPath = config.ledgerPath,
  clientFactory,
) {
  const demoPayer = requireAliceDemoPayer(payer);
  const challenge = createChallenge({ productId, payer: demoPayer }, ledgerPath);
  const paymentResult = await executeLocalDevPayment(
    { challengeId: challenge.id, payer: demoPayer },
    ledgerPath,
    clientFactory,
  );
  const unlock = verifyAccess({ token: paymentResult.accessToken.token, productId: challenge.productId }, ledgerPath);
  if (!unlock.ok) {
    throw Object.assign(new Error(`Local-dev payment was recorded but unlock failed: ${unlock.reason}`), { statusCode: 500 });
  }

  return {
    ok: true,
    mode: 'local-dev-chain',
    challenge,
    preview: paymentResult.preview,
    receipt: paymentResult.receipt,
    accessToken: paymentResult.accessToken,
    unlock: {
      ok: true,
      access: unlock.access,
      receipt: unlock.receipt,
      data: premiumPayload(challenge.productId),
    },
    demoSteps: [
      'HTTP 402 challenge created',
      'balances.transferKeepAlive preview prepared',
      'Local Portaldot dev-chain transfer verified',
      'Protected API payload unlocked',
    ],
    safety: 'One-click demo uses localhost Portaldot dev node only. No public-chain or mainnet transaction is sent.',
  };
}

module.exports = { runLocalDevDemo, requireAliceDemoPayer };
