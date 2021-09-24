import {fetchTokenHolders, Config as HoldersConfig} from "./holders";
import {
  Convictions,
  ConvictionState,
  ConvictionElement,
  ProposalConvictions,
  ProposalConviction,
} from "./types";
import type {HolderBalances} from "./holders";
import {TileDocument} from "@ceramicnetwork/stream-tile";
import {Storage} from "./types/storage.d";
import debug from "debug";
import {BigNumber as BN} from "bignumber.js";

const snapshotInfoLog = debug("CVsdk:snapshot:info");
const snapshotDebugLog = debug("CVsdk:snapshot:debug");

type Config = {
  holdersConfig: HoldersConfig;
  alpha?: number;
  beta?: number;
  rho?: number;
};

type ParticipantConviction = {
  address: string;
  convictions: TileDocument<Convictions>;
};
type HolderConvictionDocs = Array<ParticipantConviction>;

interface ProposalDetail extends ProposalConviction {
  amount: string;
}
type ProposalDetails = Array<ProposalDetail>;

interface Threshold {
  requested: BN;
  funds: BN;
  supply: BN;
  alpha: number;
  params: {rho: number; beta: number};
}

export class Snapshot {
  storage: Storage;
  config: Config;
  ALPHA: number;
  BETA: number;
  RHO: number;
  constructor(storage: Storage, config: Config) {
    this.storage = storage;
    this.config = config;
    this.ALPHA = config.alpha ?? 0.9;
    this.BETA = config.beta ?? 0.2;
    this.RHO = config.rho ?? 0.0005;
  }

  async updateSnapshot(): Promise<void> {
    snapshotInfoLog("Start: snapshot");
    const stateDocument = await this.storage.fetchOrCreateStateDocument();
    snapshotInfoLog(`prior state document: ${JSON.stringify(stateDocument)}`);
    const lastSyncedBlock = stateDocument.blockHeight;
    snapshotInfoLog("Start: fetching token state");
    const {holderBalances, currentBlockNumber, supply} =
      await fetchTokenHolders(this.config.holdersConfig, lastSyncedBlock);
    snapshotInfoLog("Finish: fetching token state");
    const convictionDocs = await this.fetchConvictionsDocs(
      holderBalances.keys(),
    );

    snapshotInfoLog("Start: fetch proposals from state");
    const proposalDetails = await this.fetchProposalDocs(
      stateDocument.proposals,
    );
    snapshotInfoLog("Finish: fetch proposals from state");

    snapshotInfoLog("Start: calculate proposal convictions");
    const nextProposals = this.calculateNextProposalConvictions(
      proposalDetails,
      convictionDocs,
      holderBalances,
      supply,
    );
    snapshotInfoLog("Finish: calculate proposal convictions");

    snapshotInfoLog("Start: Map out Partcipants list");
    const nextParticipants = convictionDocs.map((c: ParticipantConviction) => {
      return {
        account: c.address,
        convictions: c.convictions.commitId.toString(),
        // TODO: add getter function so this is cleaner
        // The fallback is technically unnecessary since the Map solely contains
        // holders of non-zero quantities of tokens
        balance: holderBalances.get(c.address) ?? "0",
      };
    });
    snapshotInfoLog("Finish: Map out Partcipants list");

    const nextState: ConvictionState = {
      context: stateDocument.context,
      blockHeight: currentBlockNumber,
      participants: nextParticipants,
      proposals: nextProposals,
      supply,
    };

    snapshotDebugLog(`Start: Storing Next State: ${JSON.stringify(nextState)}`);
    await this.storage.setStateDocument(nextState);
    snapshotDebugLog(`Finish: Storing Next State`);
    snapshotInfoLog;
  }

  calculateNextProposalConvictions(
    proposals: ProposalDetails,
    holderConvictions: HolderConvictionDocs,
    holderBalances: HolderBalances,
    supply: string,
  ): ProposalConvictions {
    const nextConvictions: ProposalConvictions = [];
    for (const proposal of proposals) {
      const fundedSupport = this.sumSupport(
        proposal.proposal,
        holderConvictions,
        holderBalances,
      );
      const threshold = this.triggerThreshold({
        requested: new BN(proposal.amount),
        funds: fundedSupport,
        supply: new BN(supply),
        alpha: this.ALPHA,
        params: {
          beta: this.BETA,
          rho: this.RHO,
        },
      });

      const totalConviction = new BN(proposal.totalConviction)
        .times(this.ALPHA)
        .plus(fundedSupport)
        .toString();

      snapshotDebugLog(
        "proposal: ",
        proposal,
        "\nthreshold: ",
        threshold.toString(),
        "\ntotal conviction: ",
        totalConviction.toString(),
      );
      const nextConviction = {
        proposal: proposal.proposal,
        triggered: threshold.lt(totalConviction),
        totalConviction,
      };
      nextConvictions.push(nextConviction);
    }
    return nextConvictions;
  }

  triggerThreshold({requested, funds, supply, alpha, params}: Threshold): BN {
    // TODO: make the available funds configurable to some address
    // instead of using the entire token supply
    const share = requested.div(supply);
    snapshotDebugLog({requested, funds, supply, alpha});
    if (share.lt(params.beta)) {
      const numerator = supply.times(params.rho);
      const denominator = new BN(params.beta)
        .minus(share)
        .pow(2)
        .times(new BN(1).minus(alpha));
      return numerator.div(denominator);
      /* math in pure JS
      (((params.rho * supply) / (params.beta - share) ** 2) * 1) / (1 - alpha));
      */
    } else {
      return new BN(Infinity);
    }
  }

  sumSupport(
    proposalId: string,
    holderConvictions: HolderConvictionDocs,
    holderBalances: HolderBalances,
  ): BN {
    let support = new BN(0);
    for (const doc of holderConvictions) {
      const proposalConvictions: Convictions = doc.convictions.content;
      const conviction = proposalConvictions.convictions.find(
        ({proposal}) => proposal === proposalId,
      );
      const balance = holderBalances.get(doc.address);
      if (conviction && balance) {
        const portion = new BN(balance).times(conviction.allocation);
        support = support.plus(portion);
      }
    }
    return support;
  }

  async fetchProposalDocs(
    proposals: ProposalConvictions,
  ): Promise<ProposalDetails> {
    snapshotDebugLog("fetching these proposals: ", proposals);
    const proposalPromises = proposals.map(({proposal}) =>
      this.storage.fetchProposal(proposal),
    );
    const proposalDocs = await Promise.all(proposalPromises);
    snapshotDebugLog("got these proposal docs: ", proposalDocs);
    const proposalDetails = [];
    for (let i = 0; i < proposals.length; i++) {
      proposalDetails.push({
        amount: proposalDocs[i].amount,
        ...proposals[i],
      });
    }
    return proposalDetails;
  }
  /*
  addParticipantConviction(proposals: Array<Proposal>) {}
  triggerProposals() {}
  */

  async fetchConvictionsDocs(
    holders: Iterable<string>,
  ): Promise<HolderConvictionDocs> {
    const holderConvictionDocs = [];
    for (const address of holders) {
      snapshotDebugLog(`Start: fetching conviction doc for ${address}`);
      const convictions = await this.storage.fetchConvictionDoc(address);
      snapshotDebugLog(
        `Done: fetching conviction doc for ${address}; got ${JSON.stringify(
          convictions,
        )}`,
      );
      if (convictions && this.validateConvictions(convictions)) {
        snapshotDebugLog(`Adding convictions doc to state for ${address}`);
        holderConvictionDocs.push({address, convictions});
      }
    }
    return holderConvictionDocs;
  }

  validateConvictions(doc: TileDocument<Convictions>): boolean {
    const {convictions} = doc.content as Convictions;
    // ensure allocations sum to <=1
    const convictionTotalLessThanOne: boolean =
      1 >=
      convictions.reduce(
        (totalAllocation: number, {allocation}: ConvictionElement) =>
          allocation + totalAllocation,
        0,
      );

    return convictionTotalLessThanOne;
  }
}
