import {ethers} from "hardhat";
import {Contract, ContractFactory} from "ethers";
import chai from "chai";
import {solidity} from "ethereum-waffle";

import {Config as HoldersConfig} from "../src/holders";
import {SignerWithAddress} from "../src/types";

import {setEthCeramicProvider} from "./util";

import {Storage} from "../src/types/storage.d";
import {Snapshot} from "../src/snapshot";
import {checkEnvironment} from "../src/config";

chai.use(solidity);
const {expect} = chai;

let ceramicStorage: Storage;
let snapshot: Snapshot;
let createMockProposal: (idx: number, amnt?: number) => Promise<void>;

describe("snaphot", () => {
  let accounts: SignerWithAddress[];
  let TokenFactory: ContractFactory;
  let Token: Contract;

  let config: HoldersConfig;
  before(async () => {
    accounts = await ethers.getSigners();
    TokenFactory = await ethers.getContractFactory("MockToken");
    const {createMockHolderAndProposal, ceramicStorage: storage} =
      await setEthCeramicProvider();
    ceramicStorage = storage;
    createMockProposal = createMockHolderAndProposal;
  });

  before(async () => {
    Token = await TokenFactory.deploy("test", "TEST");

    await createMockProposal(1, 0);
    await ceramicStorage.addProposals(accounts[1].address);

    const {holder} = checkEnvironment("test/.env.test");

    config = {
      ...holder,
      provider: ethers.provider,
      erc20Address: Token.address,
    };

    await Token.mint(accounts[0].address, 500);
    await Token.mint(accounts[1].address, 500);
    await Token.mint(accounts[2].address, 500);
    await Token.transfer(accounts[1].address, 5);
  });
  it("works", async () => {
    await createMockProposal(2, 100);
    await ceramicStorage.addProposals(accounts[2].address);
    snapshot = new Snapshot(ceramicStorage, {holdersConfig: config});
    await snapshot.updateSnapshot();
    const state = await ceramicStorage.fetchOrCreateStateDocument();
    const {proposals, participants, supply} = state;
    console.log(state);
    expect(proposals[0]).to.contain({
      triggered: true,
      totalConviction: "252.5",
    });
    expect(proposals[1]).to.contain({
      triggered: false,
      totalConviction: "250",
    });
    proposals.map(({proposal}) => expect(proposal).to.be.a("string"));
    expect(supply).to.equal("1500");
    expect(participants[0]).to.contain({
      account: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      balance: "505",
    });
    expect(participants[1]).to.contain({
      account: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      balance: "500",
    });
  });
  it("triggers after conviction builds over multiple calculations", async () => {
    await snapshot.updateSnapshot();
    // await snapshot.updateSnapshot();
    const state = await ceramicStorage.fetchOrCreateStateDocument();
    const {proposals} = state;
    expect(proposals[0]).to.contain({
      triggered: true,
      totalConviction: "479.75",
    });
    expect(proposals[1]).to.contain({
      triggered: true,
      totalConviction: "475",
    });
  });
});
