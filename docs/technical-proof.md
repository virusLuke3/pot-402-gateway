# Technical proof notes

## Local verification

Commands expected to pass:

```bash
git diff --check
npm test
npm run smoke
npm run smoke:downstream
```

Current API proof points:

- `/api/protected/weather` returns `402` without access.
- `/api/receipts/simulate` returns a mock receipt and access token.
- `/api/receipts/local-dev/preview` prepares a localhost-only `balances.transferKeepAlive` proof.
- `/api/receipts/local-dev` submits a transfer to `ws://127.0.0.1:9944` when a Portaldot local dev node is running.
- `/api/demo/local-dev` runs the full local dev challenge → transfer → unlock proof in one call for demo reliability.
- `/api/downstream/hackathon-report` is a downstream AI report consumer that returns `402` until a verified receipt is provided.
- `/api/demo/downstream/hackathon-report/local-dev` proves the downstream path end-to-end: local POT payment → receipt verification → AI report unlock.
- The downstream verifier rejects `verified_mock` receipts and requires `verified_local_dev_chain`.
- `/api/protected/weather?accessToken=...` returns a paid payload.
- `/api/ledger` redacts access tokens.
- `/api/chain/status` performs read-only Portaldot RPC checks.

## Local dev transaction path

The local-dev mode implements the same proof shape against the official Portaldot local development network:

1. Start `portaldot_dev --dev --alice`.
2. Keep RPC available at `ws://127.0.0.1:9944`.
3. Use `//Alice`, a well-known public Substrate development account, to sign `balances.transferKeepAlive`.
4. Store the local tx hash, block hash, events, amount, payer, and recipient.
5. Mark the receipt as `verified_local_dev_chain` and unlock the API.

This is stronger than a mock because it exercises real Substrate transaction mechanics, while still avoiding mainnet funds.

## Public-chain transaction path

The payment challenge includes:

```json
{
  "pallet": "Balances",
  "call": "transferKeepAlive",
  "params": {
    "dest": "<gateway recipient>",
    "value": "<amount in POT planck units>"
  }
}
```

A production or final-demo version should:

1. Connect a Polkadot.js-compatible wallet.
2. Ask the user to sign a `balances.transferKeepAlive` payment.
3. Wait for inclusion/finalization.
4. Verify sender, recipient, amount, and challenge reference.
5. Store the real tx hash as the receipt.

## Current limitation

The gateway can now submit localhost-only Portaldot local dev transactions when `portaldot_dev --dev --alice` is running. Public testnet/mainnet broadcasting remains intentionally disabled until explicit approval, wallet/account scope, and chain target are confirmed.
