import chai from "chai";
import ganache from "ganache-core";
import * as sigUtils from "eth-sig-util";

import {CeramicStorage} from "../src/ceramic";
import CeramicClient from "@ceramicnetwork/http-client";
import {Ed25519Provider} from "key-did-provider-ed25519";
import ThreeIdResolver from "@ceramicnetwork/3id-did-resolver";
import {EthereumAuthProvider} from "@ceramicnetwork/blockchain-utils-linking";
import KeyDidResolver from "key-did-resolver";
import {DID} from "dids";
import {IDX} from "@ceramicstudio/idx";
import {Caip10Link} from "@ceramicnetwork/stream-caip10-link";
import {randomBytes} from "@stablelib/random";

const {expect} = chai;
import config from "../src/config.json";

const URI = "http://127.0.0.1:7007";
let ceramicStorage: CeramicStorage;
let ethProvider: any;
let addresses: string[];

export function encodeRpcMessage(method: string, params?: any): any {
  return {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };
}

const GANACHE_CONF = {
  seed: "0xd30553e27ba2954e3736dae1342f5495798d4f54012787172048582566938f6f",
};

const GANACHE_CHAIN_ID = "1337";
const send = (provider: any, data: any): Promise<any> =>
  new Promise((resolve, reject) =>
    provider.send(data, (err: any, res: any) => {
      if (err) reject(err);
      else resolve(res.result);
    }),
  );

before(async () => {
  console.log("testing");

  ceramicStorage = new CeramicStorage(GANACHE_CHAIN_ID, URI);
  await ceramicStorage.setStateDocument(emptyState);
});

const emptyState = {
  context: "eip155:1/0xfb5453340C03db5aDe474b27E68B6a9c6b2823Eb",
  supply: 0,
  blockHeight: 0,
  participants: [],
  proposals: [],
};

describe("src/ceramic.ts", () => {
  async function createMockHolderAndProposal(): Promise<void> {
    const ceramic = new CeramicClient(URI);
    const idx = new IDX({ceramic, aliases: config.definitions});

    const seed = randomBytes(32);

    const ceramicProvider = new Ed25519Provider(seed);
    const resolver = {
      ...KeyDidResolver.getResolver(),
      ...ThreeIdResolver.getResolver(ceramic),
    };
    ceramic.did = new DID({resolver});

    ceramic.did.setProvider(ceramicProvider);
    await ceramic.did.authenticate();

    // This fails because the personal_sign JSON-RPC endpoing doesn't
    // exist in Hardhat or hardhat or truffle
    const ethAuthProvider = new EthereumAuthProvider(ethProvider, addresses[0]);

    const accountId = await ethAuthProvider.accountId();

    const accountLink = await Caip10Link.fromAccount(ceramic, accountId);

    await accountLink.setDid(ceramic.did.id, ethAuthProvider);

    const proposalRecordId = await idx.set("proposal", {
      amount: 123456789,
      beneficiary: "me",
      context: "should be CAIP10 id",
      currency: "another CAIP10 id",
      description: "I deserve the monies",
      title: "my awesome proposal",
      url: "https://goodUrl.info",
    });

    await idx.set("convictions", {
      context: "should be CAIP10 id",
      proposals: [proposalRecordId.toString()],
      convictions: [{allocation: 0.5, proposal: proposalRecordId.toString()}],
    });
  }
  before(async () => {
    ethProvider = ganache.provider(GANACHE_CONF);
    addresses = await send(ethProvider, encodeRpcMessage("eth_accounts"));

    ethProvider.manager.personal_sign = (
      data: any,
      address: string,
      callback: any,
    ): void => {
      address = addresses[0];
      const account = ethProvider.manager.state.accounts[address.toLowerCase()];
      const result = sigUtils.personalSign(account.secretKey, {data});
      callback(null, result);
    };

    await createMockHolderAndProposal();
  });

  after(async () => {
    await ceramicStorage.setStateDocument(emptyState);
  });

  it("can init", async () => {
    await ceramicStorage.init();
  });
  it("can create a state doc if none exists", async () => {
    const state = await ceramicStorage.fetchOrCreateStateDocument();
    expect(state).to.deep.equal(emptyState);
  });
  it("can read a state doc", async () => {
    const testState = {...emptyState};
    testState.blockHeight = 10;
    const state = await ceramicStorage.setStateDocument(testState);
    expect(state).to.deep.equal(testState);
  });
  describe("fetchConvictionDoc", () => {
    it("can fetch a conviction doc", async () => {
      const conviction = await ceramicStorage.fetchConvictionDoc(addresses[0]);
      expect(conviction).to.include.keys("context", "proposals", "convictions");
    });
    it("returns null when a conviction doc does not exist", async () => {
      const result = await ceramicStorage.fetchConvictionDoc(addresses[1]);
      expect(result).to.be.null;
    });
  });
  it("addProposals can fetch a proposal doc and add it to the state doc", async () => {
    const storage = await ceramicStorage.addProposals(addresses[0]);
    const state = await storage.fetchOrCreateStateDocument();
    expect(state.proposals.length).to.equal(1);
  });
});
