import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import chai from "chai";
import { solidity } from "ethereum-waffle";

import { fetchTokenHolders } from "../src/holders";

chai.use(solidity);

const { expect } = chai;

/**
 * This file is for testing out fetchTokenHolders function End-To-End
 */
describe("fetchTokenHolders", function () {
  let accounts: any;
  let TokenFactory: ContractFactory;
  let Token: Contract;
  before(async () => {
    TokenFactory = await ethers.getContractFactory("MockToken");
  });

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    Token = await TokenFactory.deploy("test", "TEST");
  });

  it("filters out zero-balance holders", async function () {
    await Token.mint(accounts[0].address, 5);
    await Token.mint(accounts[1].address, 5);
    await Token.transfer(accounts[1].address, 5);

    expect(await Token.balanceOf(accounts[1].address)).to.equal(10);
    const result = await fetchTokenHolders({
      provider: ethers.provider,
      erc20Address: Token.address,
    });
    expect(result.holderBalances.get(accounts[1].address)).to.equal("10");
    expect(result.holderBalances.get(accounts[0].address)).to.be.undefined;
  });
});
