import chai from "chai";

import {CeramicStorage} from "../src/ceramic";
import {setEthCeramicProvider, emptyState} from "./util";

const {expect} = chai;

let ceramicStorage: CeramicStorage;
let addresses: string[];
let createProposal: any;

describe("src/ceramic.ts", () => {
  before(async () => {
    const {
      createMockHolderAndProposal,
      ceramicStorage: storage,
      addresses: ethAddresses,
    } = await setEthCeramicProvider();
    addresses = ethAddresses;
    ceramicStorage = storage;
    createProposal = createMockHolderAndProposal;
  });

  describe("empty state", () => {
    it("can init", async () => {
      await ceramicStorage.init();
    });
    it("can create a state doc if none exists", async () => {
      const state = await ceramicStorage.fetchOrCreateStateDocument();
      expect(state).to.deep.equal(emptyState);
    });
  });
  describe("modifying state", () => {
    it("can read an updated state doc", async () => {
      const testState = {...emptyState};
      testState.blockHeight = 10;
      await ceramicStorage.setStateDocument(testState);
      const state = await ceramicStorage.fetchOrCreateStateDocument();

      expect(state).to.deep.equal(testState);
    });
  });
  describe("fetchConvictionDoc", () => {
    before(async () => {
      await createProposal(1);
    });
    it("can fetch a conviction doc", async () => {
      const conviction = await ceramicStorage.fetchConvictionDoc(addresses[1]);
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
      const storage = await ceramicStorage.addProposals(addresses[1]);
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
