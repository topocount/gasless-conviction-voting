import chai from "chai";
import dotenv from "dotenv";

import {CeramicStorage} from "../src/ceramic";
import {setEthCeramicProvider, emptyState} from "./util";
dotenv.config({path: "./.env.test"});
const {expect} = chai;

let ceramicStorage: CeramicStorage;
let addresses: string[];

describe("src/ceramic.ts", () => {
  before(async () => {
    const {
      createMockHolderAndProposal,
      ceramicStorage: storage,
      addresses: ethAddresses,
    } = await setEthCeramicProvider();
    console.log("test");
    addresses = ethAddresses;
    ceramicStorage = storage;
    await createMockHolderAndProposal(0);
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
      expect(conviction?.content).to.include.keys(
        "context",
        "proposals",
        "convictions",
      );
    });
    it("returns null when a conviction doc does not exist", async () => {
      const result = await ceramicStorage.fetchConvictionDoc(addresses[9]);
      expect(result).to.be.null;
    });
  });
  describe("Proposals", () => {
    it("addProposals can fetch a proposal doc and add it to the state doc", async () => {
      const storage = await ceramicStorage.addProposals(addresses[0]);
      const state = await storage.fetchOrCreateStateDocument();
      expect(state.proposals.length).to.equal(1);
    });
    it("can fetch a proposal from the DID on the state doc", async () => {
      const state = await ceramicStorage.fetchOrCreateStateDocument();
      const {proposal: proposalId} = state.proposals[0];
      const proposal = await ceramicStorage.fetchProposal(proposalId);
      expect(proposal).to.include.keys(
        "amount",
        "beneficiary",
        "context",
        "currency",
        "title",
        "url",
      );
    });
  });
});
