# Gasless Conviction Voting Service

## Quickstart

First, copy the .env.example file:

```sh
$ cp .env.example .env
```

and edit it using your preferred file editor.

Second, start the service:

```
$ npm i && npm run start
```

Alternatively, start the service in a docker container

```
$ docker build . -t conviction-voting-service

$ docker run -p 3000:3000 -d conviction-voting-service
```

## Background

This service implements [this design outlined by the Ceramic Team], though
it doesn't completely abide by the draft schemas in a couple cases, for the
purpose of optimizing chain state calculations.

[this design outlined by the ceramic team]: https://blog.ceramic.network/trust-minimized-off-chain-conviction-voting/

## About

This service allows a community to utilize the ERC20 token of their
choice to participate in conviction voting. The design of this service strikes
a balance between decentralization and cost of participation. This service
does not store any application state locally, save for its own configuration.
It relies on access to an evm rpc endpoint to obtain token events and Ceramic
to store the state of conviction calculations and proposals.

### Ceramic

proposals and information needed to calculate conviction on proposals is
stored on [Ceramic]. Each service randomly generates a 32-byte seed used as
a Ceramic private key. This allows only the service to manage the conviction
state document.

The purpose of the conviction state document is that all the provided
details on the document should be used to

### EVM JSON-RPC

This service was designed for use by any community
interested is using conviction voting for a part of the decisionmaking process.
In order to support this, blockchain state is taken directly from an RPC
endpoint, which is effectively unopinionate. The real source can be an Infura
endpoint, or even just a full (non-archive) node running in someone's home.

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

### Service

Core functionality of the Service:

#### Snapshot Cycle

1. Sync all holders from onchain transactions and the current block
2. Get balances of all holders. Remove zero-balance holders
3. Pull the conviction state document for the token.
4. Pull the latest conviction documents from all holders.
5. Compute newest conviction scores using conviction docs and proposals
6. Update the state doc with the latest state and trigger those that reach
   the conviction threshold.

#### API

- Accept proposals and add them to the state doc.
- Return public app state so the frontend knows how to find all docs directly
  within its own ceramic client, and can show when the next conviction
  snapshot will run

## Potential Future Work

- add logic that allows users to withdraw proposals
- add a configurable "expiration date" so proposals that don't meet conviction
  by the configured date are removed from the state document.

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
