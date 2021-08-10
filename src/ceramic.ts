import dotenv from "dotenv";
import fs from "fs";
import CeramicClient from "@ceramicnetwork/http-client";
import {Ed25519Provider} from "key-did-provider-ed25519";
import ThreeIdResolver from "@ceramicnetwork/3id-did-resolver";
import KeyDidResolver from "key-did-resolver";
import {DID} from "dids";
import {IDX} from "@ceramicstudio/idx";
import {randomBytes} from "@stablelib/random";
import {Caip10Link} from "@ceramicnetwork/stream-caip10-link";

import {ConvictionState} from "./types";
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

if (!process.env.THREE_ID_SEED) {
  seed = randomBytes(32);
  fs.appendFileSync(
    ".env",
    `# 3ID_seed for use with Ceramic\nTHREE_ID_SEED=${seed}\n`,
  );
} else {
  seed = Uint8Array.from(
    process.env.THREE_ID_SEED.split(",").map((i) => Number.parseInt(i)),
  );
}

export class Ceramic implements Storage {
  ceramic: CeramicClient | AuthenticatedCeramicClient;
  idx: IDX;

  constructor(api?: string) {
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
  // Derive DID from ethereum address
  async toDID(address: string): Promise<string> {
    await this.checkInit();
    const {did} = await Caip10Link.fromAccount(
      this.ceramic,
      `${address}@ip155:1`,
    );
    if (!did) throw new Error("no did linked to address");
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
        participants: [],
        proposals: [],
      });
    }
    console.log("new state", state);
    return state as ConvictionState;
  }

  /**
   * return a holder's convictions doc
   */
  async fetchConvictionDocID(address: string): Promise<string | null> {
    const did = await this.toDID(address);
    return this.idx.getRecordID(config.definitions.convictions, did);
  }
}

const c = new Ceramic();

c.init()
  .then((c) => c.fetchOrCreateStateDocument())
  .catch((e) => console.log(e));

// TODO implement this to obtain convictions doc
// function fetchHolderDocuments() {}
