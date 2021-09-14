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
let createMockProposal: (idx: number, amnt?: number) => Promise<void>;
let resetState: () => Promise<void>;

describe("snaphot", () => {
  let accounts: SignerWithAddress[];
  let TokenFactory: ContractFactory;
  let Token: Contract;

  let config: HoldersConfig;
  before(async () => {
    accounts = await ethers.getSigners();
    TokenFactory = await ethers.getContractFactory("MockToken");
    const {
      createMockHolderAndProposal,
      ceramicStorage: storage,
      resetState: resetStateFn,
    } = await setEthCeramicProvider();
    ceramicStorage = storage;
    createMockProposal = createMockHolderAndProposal;
  });

  beforeEach(async () => {
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
    const snapshot = new Snapshot(ceramicStorage, {holdersConfig: config});
    await snapshot.updateSnapshot();
  });
});
