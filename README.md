# WIP Gasless Conviction Voting Service

[metadreamers proposal]: https://forum.gnosis.io/t/rfp-off-chain-conviction-voting/1320

## Pieces

### Frontend

- View proposals and current conviction values
- Authenticate Users
  - submit proposals
  - set conviction on proposals
  - if execution is configured, submit proposals for execution that have
    reached the trigger threshold

> TODO: How do we denote proposals that have been enacted without onchain
> execution?

### SDK

Core functionality of the SDK:

#### Snapshot Cycle

1. Sync all holders from onchain transactions and the current block
2. Get balances of all holders. Remove zero-balance holders

- [ ] Pulling the conviction state document for the token.
- [ ] Pulling the latest conviction documents from all holders.
- [ ] Computing newest conviction scores using conviction docs and proposals
- [ ] Updating the state doc with the latest state and trigger those that reach
      the conviction threshold.

> TODO: Put safe-guard in place to prevent double-voting

#### API

- Accept proposals and add them to the state doc.
- Return DIDs for pulling documents in the frontend when requested

#### **WIP** Onchain Execution of Proposals

The generic SDK should be pluggable for arbitrary onchain execution paths.

This means that the watcher service can watch any ERC20 and

#### Lifecycle of setting up the module with a gnosis wallet

The [Gnosis Setup Guide] details how to set up the module with a multsig and
snapshot.

- Oracle Questions
  - Does each wallet need to have a deployed Oracle? No
  - Do users need to submit a reward to the oracle to submit their question? no

[gnosis setup guide]: https://github.com/gnosis/dao-module/blob/main/docs/setup_guide.md

> TODO: Write a deployment story that doesn't use Snapshot.js
