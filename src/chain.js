const { config } = require('./config');

function hasWebSocket() {
  return typeof WebSocket !== 'undefined';
}

function rpcCall(method, params = [], timeoutMs = 2500) {
  return new Promise((resolve) => {
    if (!hasWebSocket()) {
      resolve({ ok: false, reason: 'websocket_unavailable_in_node_runtime' });
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { ws.close(); } catch (_) {}
        resolve({ ok: false, reason: 'rpc_timeout' });
      }
    }, timeoutMs);
    let ws;
    try {
      ws = new WebSocket(config.rpcUrl);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }));
      });
      ws.addEventListener('message', (event) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws.close(); } catch (_) {}
        try {
          const payload = JSON.parse(event.data);
          if (payload.error) resolve({ ok: false, reason: 'rpc_error', error: payload.error });
          else resolve({ ok: true, result: payload.result });
        } catch (error) {
          resolve({ ok: false, reason: 'invalid_rpc_json', error: error.message });
        }
      });
      ws.addEventListener('error', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ ok: false, reason: 'rpc_websocket_error' });
        }
      });
    } catch (error) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, reason: 'rpc_exception', error: error.message });
      }
    }
  });
}

async function getChainStatus() {
  const header = await rpcCall('chain_getHeader');
  const health = await rpcCall('system_health');
  return {
    chain: 'Portaldot',
    rpcUrl: config.rpcUrl,
    ss58Format: config.ss58Format,
    token: config.token,
    decimals: config.decimals,
    readOnly: true,
    header,
    health,
    safety: 'This endpoint performs read-only RPC checks only. It never broadcasts transactions.',
  };
}

function chainConfig() {
  return {
    chain: 'Portaldot',
    rpcUrl: config.rpcUrl,
    ss58Format: config.ss58Format,
    token: config.token,
    decimals: config.decimals,
    nativeProofPrimitive: 'balances.transferKeepAlive(dest, value)',
    docs: {
      chainInfo: 'https://portaldot-dev.readthedocs.io/en/latest/chain-info.html',
      balancesExtrinsics: 'https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/balances.html',
      pythonExtrinsics: 'https://portaldot-dev.readthedocs.io/en/latest/python-sdk/usage/extrinsics.html',
    },
  };
}

module.exports = { getChainStatus, chainConfig, rpcCall };
