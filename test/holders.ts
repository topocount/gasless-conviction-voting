import {ethers} from "hardhat";
import {Contract, ContractFactory} from "ethers";
import chai from "chai";
import {solidity} from "ethereum-waffle";

import {fetchTokenHolders, Config as HoldersConfig} from "../src/holders";
import {SignerWithAddress} from "../src/types";

chai.use(solidity);

const {expect} = chai;

/**
 * This file is for testing out fetchTokenHolders function End-To-End
 */
describe("fetchTokenHolders", () => {
  let accounts: SignerWithAddress[];
  let TokenFactory: ContractFactory;
  let Token: Contract;

  let config: HoldersConfig;
  before(async () => {
    TokenFactory = await ethers.getContractFactory("MockToken");
  });

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    Token = await TokenFactory.deploy("test", "TEST");

    config = {
      provider: ethers.provider,
      erc20Address: Token.address,
    };

    await Token.mint(accounts[0].address, 5);
    await Token.mint(accounts[1].address, 5);
    await Token.mint(accounts[2].address, 5);
    await Token.transfer(accounts[1].address, 5);
  });

  it("filters out zero-balance holders", async () => {
    expect(await Token.balanceOf(accounts[1].address)).to.equal(10);
    const {holderBalances, supply} = await fetchTokenHolders(config);
    expect(holderBalances.get(accounts[1].address)).to.equal("10");
    expect(holderBalances.get(accounts[2].address)).to.equal("5");
    expect(holderBalances.get(accounts[0].address)).to.be.undefined;
    expect(supply).to.equal("15");
  });
});
