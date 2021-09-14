import CeramicClient from "@ceramicnetwork/http-client";
import {Ed25519Provider} from "key-did-provider-ed25519";
import ThreeIdResolver from "@ceramicnetwork/3id-did-resolver";
import KeyDidResolver from "key-did-resolver";
import {DID} from "dids";
import {IDX} from "@ceramicstudio/idx";
import {Caip10Link} from "@ceramicnetwork/stream-caip10-link";
import {TileDocument} from "@ceramicnetwork/stream-tile";
import {Config} from "./config";

import {ConvictionState, Convictions, Proposal} from "./types";
import {Storage} from "./types/storage.d";

interface AuthenticatedCeramicClient extends CeramicClient {
  did: DID;
}

export class CeramicStorage implements Storage {
  ceramic: CeramicClient | AuthenticatedCeramicClient;
  idx: IDX;
  chainId: string;
  config: Config;

  constructor(chainId: string, config: Config, api?: string) {
    this.chainId = chainId;
    this.ceramic = new CeramicClient(api || config.environment.ceramicApiUrl);
    this.idx = new IDX({
      ceramic: this.ceramic,
      aliases: config.ceramic.definitions,
    });
    this.config = config;
  }

  async checkInit(): Promise<void> {
    if (!this.ceramic.did) await this.init();
  }

  async init(): Promise<this> {
    const provider = new Ed25519Provider(this.config.environment.threeIdSeed);
    const resolver = {
      ...KeyDidResolver.getResolver(),
      ...ThreeIdResolver.getResolver(this.ceramic),
    };
    this.ceramic.did = new DID({resolver});

    this.ceramic.did.setProvider(provider);
    await this.ceramic.did.authenticate();
    return this;
  }
  // Get linked DID from ethereum address
  async toDID(address: string): Promise<string | null> {
    await this.checkInit();
    const {did} = await Caip10Link.fromAccount(
      this.ceramic,
      `${address}@eip155:${this.chainId}`,
    );
    return did;
  }

  async setStateDocument(state: ConvictionState): Promise<ConvictionState> {
    await this.checkInit();
    await this.idx.set("convictionstate", state);

    const result = await this.idx.get("convictionstate");
    if (!result) throw new Error("Error setting state document");
    return result as ConvictionState;
  }

  async fetchOrCreateStateDocument(): Promise<ConvictionState> {
    await this.checkInit();
    let state = await this.idx.get("convictionstate");
    if (state == null) {
      state = await this.setStateDocument({
        context: this.config.ceramic.erc20Contract,
        supply: "0",
        blockHeight: 0,
        participants: [],
        proposals: [],
      });
    }

    return state as ConvictionState;
  }

  async _addProposalToState(docId: string): Promise<void> {
    const state = await this.fetchOrCreateStateDocument();
    const proposalExists = state.proposals
      .map(({proposal}) => proposal)
      .includes(docId);
    if (proposalExists) {
      console.warn(`Proposal ${docId} Already Exists in State`);
      return;
    }
    state.proposals.push({
      proposal: docId,
      totalConviction: "0",
      triggered: false,
    });
    await this.setStateDocument(state);
  }

  /**
   * return a holder's convictions doc
   */
  async fetchConvictionDoc(
    address: string,
  ): Promise<TileDocument<Convictions> | null> {
    const did = await this.toDID(address);
    if (did == null) return null;
    let convictions = null;
    const index = await this.idx.getIndex(did);
    if (index) {
      convictions = await TileDocument.load<Convictions>(
        this.ceramic,
        index[this.config.ceramic.definitions.convictions],
      );
      if (!convictions.content) return null;
    }
    return convictions;
  }

  async addProposals(address: string): Promise<this> {
    const doc = await this.fetchConvictionDoc(address);
    if (doc) {
      console.log(doc.content);
      for (const proposal of doc.content.proposals) {
        await this._addProposalToState(proposal);
      }
    }
    return this;
  }

  async fetchProposal(docId: string): Promise<Proposal> {
    const doc = await TileDocument.load(this.ceramic, docId);
    if (!doc) throw new Error(`No doc matching docId: ${docId}`);

    return doc.content;
  }
}
