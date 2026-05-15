# 2-Minute Demo Script

**0:00 — Problem**
Portaldot builders need a simple way to charge for API calls, datasets, tools, or creator resources using native POT.

**0:20 — Solution**
POT-402 Gateway turns a protected API into a Portaldot payment challenge. Instead of a subscription system, the API itself says: `402 Payment Required`.

**0:40 — Live demo**
Click “Call Protected API”. The gateway returns a structured 402 challenge with Portaldot RPC, POT decimals, recipient, amount, and a suggested `balances.transferKeepAlive` call.

**1:05 — Payment proof**
For safe local judging, click “Simulate Portaldot Payment”. It produces a deterministic mock receipt and clearly labels it as safe mode. In approved real mode, this step is replaced by a wallet-signed POT transfer.

**1:25 — Unlock**
Click “Unlock Premium Response”. The paid API now returns premium data and a proof ledger entry.

**1:45 — Native fit**
This is built for Portaldot’s Substrate-native environment, not EVM. The V1 primitive can become a builder marketplace for paid APIs, creator passes, and tool monetization.

**1:55 — Close**
POT-402 Gateway is a reusable payment primitive for Portaldot builders: runnable MVP, clear demo, native POT integration, and a realistic ecosystem use case.
