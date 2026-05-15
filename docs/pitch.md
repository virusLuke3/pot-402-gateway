# Pitch copy

## 15-second pitch

POT-402 Gateway is a simple payment layer for Portaldot APIs. A protected endpoint returns `402 Payment Required`, the user pays POT, and the gateway unlocks the response after verifying the receipt.

## 45-second pitch

Portaldot builders should be able to charge for one API call without building a whole marketplace first. POT-402 Gateway gives them that primitive.

The flow is direct: call a protected endpoint, receive a Portaldot payment challenge, pay POT, verify the receipt, and unlock the paid response. The MVP uses safe local receipts for demo speed, and the real path maps to Portaldot's native `balances.transferKeepAlive` call.

This fits Portaldot because the payment proof is not decorative. POT is the access primitive.

## Judge-facing close

The point is not to ship a production payment processor in a mini hackathon. The point is to show a reusable Portaldot-native pattern that other builders can copy: price a resource, return a payment challenge, verify a POT receipt, unlock the result.
