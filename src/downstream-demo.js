const { config } = require('./config');
const { createChallenge, getProduct, verifyAccess } = require('./payment');
const { runLocalDevDemo } = require('./demo-flow');

const HACKATHON_REPORT_PRODUCT_ID = 'hackathon_report';

function nowIso() {
  return new Date().toISOString();
}

function redactToken(token = '') {
  if (!token) return null;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

function normalizeIdea(idea) {
  const trimmed = String(idea || '').trim();
  return trimmed || 'POT-402 pay-per-call APIs for Portaldot builders';
}

function summarizeReceipt(receipt) {
  if (!receipt) return null;
  return {
    id: receipt.id,
    productId: receipt.productId,
    mode: receipt.mode,
    payer: receipt.payer,
    recipient: receipt.recipient,
    amountPOT: receipt.amountPOT,
    amountPlanck: receipt.amountPlanck,
    token: receipt.token,
    txHash: receipt.txHash,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber,
    feePlanck: receipt.feePlanck,
    verification: receipt.verification,
  };
}

function verifyDownstreamAccess(
  { accessToken, productId = HACKATHON_REPORT_PRODUCT_ID } = {},
  ledgerPath = config.ledgerPath,
) {
  if (!accessToken) {
    return {
      ok: false,
      statusCode: 402,
      error: 'payment_required',
      reason: 'missing_access_token',
    };
  }

  const access = verifyAccess({ token: accessToken, productId }, ledgerPath);
  if (!access.ok) {
    return {
      ok: false,
      statusCode: 402,
      error: 'payment_required',
      reason: access.reason,
    };
  }

  const product = getProduct(productId);
  const receipt = access.receipt;
  const checked = ['access_token_valid', 'product_binding_matches'];

  if (!receipt) {
    return {
      ok: false,
      statusCode: 403,
      error: 'receipt_not_found',
      reason: 'access_token_has_no_receipt',
      checked,
    };
  }

  const receiptVerification = receipt.verification?.status || 'missing';
  if (receiptVerification !== 'verified_local_dev_chain') {
    return {
      ok: false,
      statusCode: 403,
      error: 'receipt_not_verified',
      reason: 'requires_verified_local_dev_chain',
      receiptVerification,
      checked,
      receipt: summarizeReceipt(receipt),
    };
  }
  checked.push('receipt_status_verified_local_dev_chain');

  if (receipt.verification?.primitive !== 'balances.transferKeepAlive(dest, value)') {
    return {
      ok: false,
      statusCode: 403,
      error: 'receipt_not_verified',
      reason: 'unexpected_payment_primitive',
      receiptVerification,
      checked,
      receipt: summarizeReceipt(receipt),
    };
  }
  checked.push('native_payment_primitive_matches');

  if (receipt.amountPlanck !== product.amountPlanck) {
    return {
      ok: false,
      statusCode: 403,
      error: 'receipt_not_verified',
      reason: 'amount_does_not_match_product_price',
      expectedAmountPlanck: product.amountPlanck,
      actualAmountPlanck: receipt.amountPlanck,
      checked,
      receipt: summarizeReceipt(receipt),
    };
  }
  checked.push('amount_matches_product_price');

  if (receipt.recipient !== config.recipient) {
    return {
      ok: false,
      statusCode: 403,
      error: 'receipt_not_verified',
      reason: 'recipient_does_not_match_gateway',
      expectedRecipient: config.recipient,
      actualRecipient: receipt.recipient,
      checked,
      receipt: summarizeReceipt(receipt),
    };
  }
  checked.push('recipient_matches_gateway');

  return {
    ok: true,
    status: 'accepted_verified_local_dev_chain_receipt',
    consumer: 'AI Hackathon Report API',
    productId,
    accessToken: {
      id: access.access.id,
      token: redactToken(access.access.token),
      expiresAt: access.access.expiresAt,
    },
    receipt: summarizeReceipt(receipt),
    checked,
  };
}

function buildHackathonReport({ idea, verification }) {
  const normalizedIdea = normalizeIdea(idea);
  return {
    title: 'POT-402 Verified Hackathon Report',
    idea: normalizedIdea,
    generatedAt: nowIso(),
    receiptProof: {
      verification: verification.status,
      txHash: verification.receipt.txHash,
      blockHash: verification.receipt.blockHash,
      amountPOT: verification.receipt.amountPOT,
      payer: verification.receipt.payer,
      recipient: verification.receipt.recipient,
    },
    sections: {
      sponsorFit: 'Strong Portaldot fit: it turns POT into a visible payment primitive for downstream APIs and builder tools.',
      mvp: 'HTTP 402 challenge → local Portaldot transferKeepAlive payment → verified receipt → downstream AI report unlock.',
      risk: 'Public testnet/mainnet proof depends on official faucet/RPC access; the current demo is honestly labeled as local-dev chain proof.',
      nextIteration: 'Replace the local-dev signer with Polkadot.js wallet confirmation when public test tokens or a reviewed mainnet flow are available.',
    },
  };
}

function createDownstreamPaymentChallenge(
  { idea, payer = 'anonymous' } = {},
  ledgerPath = config.ledgerPath,
) {
  const challenge = createChallenge({ productId: HACKATHON_REPORT_PRODUCT_ID, payer }, ledgerPath);
  return {
    error: 'payment_required',
    scenario: 'downstream_hackathon_report',
    downstreamConsumer: 'AI Hackathon Report API',
    message: 'The downstream AI report service requires a POT-402 receipt before returning the premium report.',
    idea: normalizeIdea(idea),
    acceptedProof: 'verified_local_dev_chain',
    challenge,
  };
}

function runDownstreamHackathonReport(
  { idea, accessToken } = {},
  ledgerPath = config.ledgerPath,
) {
  const verification = verifyDownstreamAccess(
    { accessToken, productId: HACKATHON_REPORT_PRODUCT_ID },
    ledgerPath,
  );
  if (!verification.ok) {
    return verification;
  }
  return {
    ok: true,
    scenario: 'downstream_hackathon_report',
    downstreamConsumer: 'AI Hackathon Report API',
    verification,
    report: buildHackathonReport({ idea, verification }),
  };
}

async function runDownstreamLocalDevDemo(
  { idea, payer = 'Alice' } = {},
  ledgerPath = config.ledgerPath,
  clientFactory,
) {
  const upstream = await runLocalDevDemo(
    { productId: HACKATHON_REPORT_PRODUCT_ID, payer },
    ledgerPath,
    clientFactory,
  );
  const verification = verifyDownstreamAccess(
    { accessToken: upstream.accessToken.token, productId: HACKATHON_REPORT_PRODUCT_ID },
    ledgerPath,
  );
  if (!verification.ok) {
    throw Object.assign(
      new Error(`Downstream verifier rejected the local-dev receipt: ${verification.reason}`),
      { statusCode: verification.statusCode || 500 },
    );
  }

  return {
    ok: true,
    scenario: 'paid_ai_hackathon_report',
    mode: 'local-dev-chain',
    upstream: {
      challenge: upstream.challenge,
      preview: upstream.preview,
      receipt: upstream.receipt,
      accessToken: {
        ...upstream.accessToken,
        token: redactToken(upstream.accessToken.token),
      },
      demoSteps: upstream.demoSteps,
    },
    downstream: {
      consumer: 'AI Hackathon Report API',
      verification,
      report: buildHackathonReport({ idea, verification }),
    },
    demoSteps: [
      'Downstream AI report API requests a POT-402 access proof',
      'Gateway creates a hackathon_report payment challenge',
      'Alice pays with balances.transferKeepAlive on the local Portaldot dev chain',
      'Downstream verifier rejects mock receipts and accepts verified_local_dev_chain only',
      'AI Hackathon Report is unlocked for the caller',
    ],
    safety: 'Downstream demo uses localhost Portaldot dev node only. Mock receipts are rejected by the downstream verifier.',
  };
}

module.exports = {
  HACKATHON_REPORT_PRODUCT_ID,
  createDownstreamPaymentChallenge,
  runDownstreamHackathonReport,
  runDownstreamLocalDevDemo,
  verifyDownstreamAccess,
  buildHackathonReport,
};
