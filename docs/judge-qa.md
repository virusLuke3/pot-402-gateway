# Judge Q&A

## Is this using Portaldot or just mentioning it?

The payment challenge uses Portaldot chain facts from the official docs: RPC `wss://mainnet.portaldot.io`, SS58 format `42`, POT decimals `14`, and the native `balances.transferKeepAlive` payment primitive. The app also includes a read-only RPC status endpoint.

## Is the current receipt a real on-chain transaction?

No. The default MVP uses safe mock receipts so the demo can run without private keys or funds. The UI, README, and API response label this clearly. Real transaction mode should replace the simulation with a wallet-signed Portaldot transfer.

## Why not deploy an ink! contract?

For V1, the most important proof is a clear native payment flow. A balance transfer receipt is enough to demonstrate pay-per-call access. An ink! contract can come later for escrow, subscriptions, disputes, or marketplace features.

## Who would use this?

API builders, data providers, creator tools, and Portaldot ecosystem apps that want to monetize a small resource without building a subscription system.

## Why is this useful for Portaldot?

It gives builders a repeatable monetization pattern. If Portaldot wants more apps, builders need ways to charge for services using POT. This is a small primitive with a clear path into a larger builder marketplace.

## What would you build next?

1. Polkadot.js wallet transaction flow.
2. Real receipt verification against included events.
3. Multiple paid products and builder dashboards.
4. Optional identity/reputation layer for trusted API providers.
