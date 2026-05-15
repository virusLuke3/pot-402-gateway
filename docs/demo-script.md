# 2-Minute Demo Script

**0:00 — Problem**
Portaldot builders need a simple way to charge for API calls, datasets, tools, or creator resources using native POT.

**0:20 — Solution**
POT-402 Gateway turns a protected API into a Portaldot payment challenge. Instead of a subscription system, the API itself says: `402 Payment Required`.

**0:40 — Live demo: challenge**
Click “Call Protected API”. The gateway returns a structured 402 challenge with Portaldot token metadata, recipient, amount, and a suggested `balances.transferKeepAlive` call.

**1:00 — Local Portaldot proof**
With `portaldot_dev --dev --alice` running, click “Preview Local Dev Transfer”. The app shows the exact localhost-only transfer: Alice pays the gateway recipient using native POT units on `ws://127.0.0.1:9944`.

**1:15 — Submit local transfer**
Click “Submit Local Dev Transfer”. The gateway signs with the public Substrate dev account `//Alice`, submits `balances.transferKeepAlive`, and records the local tx hash, block hash, events, payer, recipient, and amount. No mainnet funds are touched.

**1:35 — Unlock**
Click “Unlock Premium Response”. The paid API now returns premium data and a proof ledger entry with `verified_local_dev_chain` status.

**1:50 — Native fit**
This is built for Portaldot’s Substrate-native environment, not EVM. The V1 primitive can become a builder marketplace for paid APIs, creator passes, and tool monetization.

**1:58 — Close**
POT-402 Gateway is a reusable payment primitive for Portaldot builders: runnable MVP, clear demo, native POT flow, and a realistic ecosystem use case.

## Fallback mock flow

If the local node is unavailable during recording, use “Simulate Portaldot Payment” and explicitly say it is the safe fallback. The preferred prize demo is the local-dev transfer proof.
