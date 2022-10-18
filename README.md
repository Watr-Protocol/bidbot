# Polkadot Slot Auction Bidbot
## Overview
This bot runs inside a docker container. It listens to events on the Polkadot network and places bids for a self funded account with key storage provided by AWS Secret Manager.
## Setup
### Prerequisites
1. Reserve a paraID and upload your chain WASM as documented [here]().
2. Transfer funds to your bidding account
### Environment Variables
`SLOT`: your paraID \
`BID_STEP`: the amount to increase the bid by \
`MAX_BID`: the upper limit to your bidding, should equal the total funds in your bidding account \
`CURRENT_BID`: the current bid in the auction process \
`SLACK_WEBHOOK_URL`: allows the bot to publish auction updates to a slack channel via webhook \
`KEY_PATH`: the path to the secret holding your mnemonic phrase for the bidding account
### Key Storage
The app is configured to read a mnemonic recovery phrase from an AWS secret in the format
```
"value":"my super secret mnemonic phrase"
```

