const net = require('node:net');
const { config } = require('./config');
const { readLedger, writeLedger } = require('./ledger');
const { createAccessTokenForReceipt, findChallenge, isExpired } = require('./payment');

const DEV_ACCOUNTS = Object.freeze({
  Alice: '//Alice',
  Bob: '//Bob',
  Charlie: '//Charlie',
  Dave: '//Dave',
  Eve: '//Eve',
  Ferdie: '//Ferdie',
});

function nowIso() {
  return new Date().toISOString();
}

function normalizeDevPayerUri(input = 'Alice') {
  const raw = String(input || 'Alice').trim();
  const alias = raw.startsWith('//') ? raw.slice(2) : raw;
  if (!Object.prototype.hasOwnProperty.call(DEV_ACCOUNTS, alias)) {
    throw Object.assign(
      new Error('Only well-known public dev accounts are accepted: Alice, Bob, Charlie, Dave, Eve, Ferdie. Do not send private wallet material to this API.'),
      { statusCode: 400 },
    );
  }
  return {
    alias,
    uri: DEV_ACCOUNTS[alias],
    safety: 'well_known_public_substrate_dev_account',
  };
}

function assertLocalRpcUrl(rpcUrl) {
  let parsed;
  try {
    parsed = new URL(rpcUrl);
  } catch (error) {
    throw Object.assign(new Error(`Invalid local RPC URL: ${rpcUrl}`), { statusCode: 400 });
  }
  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  if (!['ws:', 'wss:'].includes(parsed.protocol) || !localHosts.has(parsed.hostname)) {
    throw Object.assign(
      new Error('Local-dev payments are restricted to localhost RPC endpoints. Refusing to target public networks.'),
      { statusCode: 400 },
    );
  }
  return rpcUrl;
}

function waitForLocalRpcPort(rpcUrl, timeoutMs = 2500) {
  const parsed = new URL(assertLocalRpcUrl(rpcUrl));
  const port = Number(parsed.port || (parsed.protocol === 'wss:' ? 443 : 80));
  const host = parsed.hostname === '[::1]' ? '::1' : parsed.hostname;
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(Object.assign(
        new Error(`Portaldot local dev RPC is not reachable at ${rpcUrl}. Start ./portaldot_dev --dev --alice first.`),
        { statusCode: 503 },
      ));
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      socket.destroy();
      reject(Object.assign(
        new Error(`Portaldot local dev RPC is not reachable at ${rpcUrl}. Start ./portaldot_dev --dev --alice first.`),
        { statusCode: 503 },
      ));
    });
  });
}

function buildLocalDevPaymentPreview(challenge, { payer = 'Alice', rpcUrl = config.localRpcUrl } = {}) {
  const devPayer = normalizeDevPayerUri(payer);
  const safeRpcUrl = assertLocalRpcUrl(rpcUrl);
  return {
    type: 'portaldot-local-dev-payment-preview',
    mode: 'local-dev-chain',
    rpcUrl: safeRpcUrl,
    network: {
      name: 'Portaldot Local Development Network',
      rpcUrl: safeRpcUrl,
      token: config.token,
      decimals: config.decimals,
      ss58Format: config.ss58Format,
      safety: 'local_only_no_mainnet_funds',
    },
    payer: devPayer,
    recipient: challenge.recipient,
    amountPOT: challenge.amountPOT,
    amountPlanck: challenge.amountPlanck,
    memo: challenge.memo,
    extrinsic: {
      pallet: 'Balances',
      call: 'transferKeepAlive',
      params: {
        dest: challenge.recipient,
        value: challenge.amountPlanck,
      },
    },
    instructions: [
      'Run ./portaldot_dev --dev --alice in the downloaded Portaldot local development node directory.',
      'Keep the local node running at ws://127.0.0.1:9944.',
      'Use the local-dev payment endpoint to submit a transfer from a well-known dev account such as Alice.',
    ],
  };
}

function formatDispatchError(api, dispatchError) {
  if (!dispatchError) return null;
  if (dispatchError.isModule) {
    const decoded = api.registry.findMetaError(dispatchError.asModule);
    return `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
  }
  return dispatchError.toString();
}

async function createPolkadotLocalDevClient({ rpcUrl = config.localRpcUrl } = {}) {
  const safeRpcUrl = assertLocalRpcUrl(rpcUrl);
  let ApiPromise;
  let WsProvider;
  let Keyring;
  let cryptoWaitReady;
  try {
    ({ ApiPromise, WsProvider } = require('@polkadot/api'));
    ({ Keyring } = require('@polkadot/keyring'));
    ({ cryptoWaitReady } = require('@polkadot/util-crypto'));
  } catch (error) {
    throw Object.assign(
      new Error('Missing @polkadot dependencies. Run npm install before using local-dev payment mode.'),
      { statusCode: 500, cause: error },
    );
  }

  await cryptoWaitReady();
  await waitForLocalRpcPort(safeRpcUrl);
  const provider = new WsProvider(safeRpcUrl);
  const api = await ApiPromise.create({ provider });
  const keyring = new Keyring({ type: 'sr25519', ss58Format: config.ss58Format });

  return {
    async transferKeepAlive({ payerUri, recipient, amountPlanck, timeoutMs = 30_000 }) {
      const payer = keyring.addFromUri(payerUri);
      const tx = api.tx.balances.transferKeepAlive(recipient, amountPlanck);
      const paymentInfo = await tx.paymentInfo(payer);
      const fallbackTxHash = tx.hash.toHex();

      return new Promise((resolve, reject) => {
        let unsubscribe;
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          try { if (unsubscribe) unsubscribe(); } catch (_) {}
          reject(Object.assign(new Error('Timed out waiting for local dev transaction to enter a block'), { statusCode: 504 }));
        }, timeoutMs);

        tx.signAndSend(payer, ({ status, events, dispatchError, txHash }) => {
          if (settled) return;
          const errorMessage = formatDispatchError(api, dispatchError);
          if (errorMessage) {
            settled = true;
            clearTimeout(timer);
            try { if (unsubscribe) unsubscribe(); } catch (_) {}
            reject(Object.assign(new Error(`Local dev transaction failed: ${errorMessage}`), { statusCode: 502 }));
            return;
          }

          if (status.isInBlock || status.isFinalized) {
            settled = true;
            clearTimeout(timer);
            const blockHash = status.isInBlock ? status.asInBlock.toHex() : status.asFinalized.toHex();
            const eventSummary = events.map(({ event }) => ({
              section: event.section,
              method: event.method,
              data: event.data.map((item) => item.toString()),
            }));
            const includedTxHash = txHash?.toHex ? txHash.toHex() : fallbackTxHash;
            try { if (unsubscribe) unsubscribe(); } catch (_) {}
            resolve({
              txHash: includedTxHash,
              blockHash,
              blockNumber: null,
              payerAddress: payer.address,
              feePlanck: paymentInfo.partialFee.toString(),
              events: eventSummary,
            });
          }
        }).then((unsub) => {
          unsubscribe = unsub;
        }).catch((error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(Object.assign(error, { statusCode: error.statusCode || 502 }));
        });
      });
    },

    async disconnect() {
      await api.disconnect();
    },
  };
}

async function executeLocalDevPayment(
  { challengeId, payer = 'Alice', rpcUrl = config.localRpcUrl } = {},
  ledgerPath = config.ledgerPath,
  clientFactory = createPolkadotLocalDevClient,
) {
  const ledger = readLedger(ledgerPath);
  const challenge = findChallenge(challengeId, ledger);
  if (!challenge) {
    throw Object.assign(new Error('Unknown challenge id'), { statusCode: 404 });
  }
  if (isExpired(challenge)) {
    throw Object.assign(new Error('Challenge expired'), { statusCode: 410 });
  }

  const preview = buildLocalDevPaymentPreview(challenge, { payer, rpcUrl });
  const client = await clientFactory({ rpcUrl: preview.rpcUrl });
  try {
    const proof = await client.transferKeepAlive({
      payerUri: preview.payer.uri,
      recipient: challenge.recipient,
      amountPlanck: challenge.amountPlanck,
    });

    const receipt = {
      id: `local_${proof.txHash.slice(2, 14)}`,
      type: 'local-dev-portaldot-payment-receipt',
      challengeId: challenge.id,
      productId: challenge.productId,
      mode: 'local-dev-chain',
      payer: {
        alias: preview.payer.alias,
        address: proof.payerAddress,
      },
      recipient: challenge.recipient,
      amountPOT: challenge.amountPOT,
      amountPlanck: challenge.amountPlanck,
      token: challenge.token,
      txHash: proof.txHash,
      blockHash: proof.blockHash,
      blockNumber: proof.blockNumber,
      feePlanck: proof.feePlanck,
      events: proof.events,
      verifiedAt: nowIso(),
      verification: {
        status: 'verified_local_dev_chain',
        primitive: 'balances.transferKeepAlive(dest, value)',
        rpcUrl: preview.rpcUrl,
        note: 'Verified on a Portaldot local development node using public Substrate dev accounts. No mainnet funds were used.',
      },
    };

    const accessToken = createAccessTokenForReceipt(receipt, challenge);
    challenge.status = 'paid_local_dev';
    ledger.receipts.push(receipt);
    ledger.accessTokens.push(accessToken);
    writeLedger(ledgerPath, ledger);
    return { receipt, accessToken, preview };
  } finally {
    await client.disconnect();
  }
}

module.exports = {
  buildLocalDevPaymentPreview,
  createPolkadotLocalDevClient,
  executeLocalDevPayment,
  normalizeDevPayerUri,
  assertLocalRpcUrl,
  waitForLocalRpcPort,
};
