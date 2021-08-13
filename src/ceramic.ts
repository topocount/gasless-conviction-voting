import dotenv from "dotenv";
import CeramicClient from "@ceramicnetwork/http-client";
import {Ed25519Provider} from "key-did-provider-ed25519";
import ThreeIdResolver from "@ceramicnetwork/3id-did-resolver";
import KeyDidResolver from "key-did-resolver";
import {DID} from "dids";
import {IDX} from "@ceramicstudio/idx";
import {Caip10Link} from "@ceramicnetwork/stream-caip10-link";

import {ConvictionState, Convictions} from "./types";
import {Storage} from "./types/storage.d";

dotenv.config();
let seed: Uint8Array;

// TODO: Create config type
// TODO: separate configs into a more resilient, self-sustaining structure
// Ceramic and the holders fetchers should each have separate config.json
// files that they should be able to update with server state to assist with
// performance optimizations.
let config: any = {};
try {
  config = require("./config.json");
} catch (e) {
  console.error("run bootstrap to generate config.json");
}

interface AuthenticatedCeramicClient extends CeramicClient {
  did: DID;
}

if (process.env.THREE_ID_SEED) {
  seed = Uint8Array.from(
    process.env.THREE_ID_SEED.split(",").map(Number.parseInt),
  );
}

export class CeramicStorage implements Storage {
  ceramic: CeramicClient | AuthenticatedCeramicClient;
  idx: IDX;
  chainId: string;

  constructor(chainId: string, api?: string) {
    this.chainId = chainId;
    this.ceramic = new CeramicClient(api || process.env.CERAMIC_API_URL);
    this.idx = new IDX({ceramic: this.ceramic, aliases: config.definitions});
  }

  async checkInit(): Promise<void> {
    if (!this.ceramic.did) await this.init();
  }

  async init(): Promise<this> {
    const provider = new Ed25519Provider(seed);
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
        context: config.erc20Contract,
        supply: 0,
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
      totalConviction: 0,
      triggered: false,
    });
    await this.setStateDocument(state);
  }

  /**
   * return a holder's convictions doc
   */
  async fetchConvictionDoc(address: string): Promise<Convictions | null> {
    const did = await this.toDID(address);
    if (did == null) return null;
    return this.idx.get(config.definitions.convictions, did);
  }

  async addProposals(address: string): Promise<this> {
    const doc = await this.fetchConvictionDoc(address);
    if (doc) {
      for (const proposal of doc.proposals) {
        await this._addProposalToState(proposal);
      }
    }
    return this;
  }
}

/*
const c = new Ceramic();

c.init()
  .then((c) => c.fetchOrCreateStateDocument())
  .catch((e) => console.log(e));
*/
// TODO implement this to obtain convictions doc
// function fetchHolderDocuments() {}
