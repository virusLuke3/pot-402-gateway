# Technical proof notes

## Local verification

Commands expected to pass:

```bash
git diff --check
npm test
npm run smoke
```

Current API proof points:

- `/api/protected/weather` returns `402` without access.
- `/api/receipts/simulate` returns a mock receipt and access token.
- `/api/protected/weather?accessToken=...` returns a paid payload.
- `/api/ledger` redacts access tokens.
- `/api/chain/status` performs read-only Portaldot RPC checks.

## Real transaction path

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

Portaldot transaction broadcasting is intentionally disabled in the current safe MVP. This avoids private-key handling and prevents accidental mainnet/testnet transactions.
