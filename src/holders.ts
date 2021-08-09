require("dotenv").config();
const debug = require("debug");
const holdersInfoLog = debug("CVsdk:holders:info");
const holdersDebugLog = debug("CVsdk:holders:debug");
import { ethers } from "ethers";
import { Provider, JsonRpcProvider } from "@ethersproject/providers";

const { providers, Contract } = ethers;

const Erc20TransferAbi = [
  "event Transfer(address indexed from, address indexed to, uint amount)",
  "function balanceOf(address owner) view returns (uint256)",
];

// TODO: Add "To block" param to optimize the blockchain reads after initial
// state is stored to ceramic
type Config = {
  provider: Provider;
  erc20Address?: string;
  blockIncrement?: string;
  quietIntervalThreshold?: string;
};

type FormedConfig = {
  erc20Address: string;
  blockIncrement: number;
  quietIntervalThreshold: number;
  provider: Provider;
};

type HolderBalances = Map<string, ethers.BigNumber>;
type HolderSnapshot = {
  holderBalances: HolderBalances;
  currentBlockNumber: number;
};

export async function fetchTokenHolders(
  rawConfig: Config,
): Promise<HolderSnapshot> {
  const blockIncrement: number = rawConfig.blockIncrement
    ? parseInt(rawConfig.blockIncrement, 10)
    : 50000;
  const quietIntervalThreshold: number = rawConfig.quietIntervalThreshold
    ? parseInt(rawConfig.quietIntervalThreshold, 10)
    : 2;
  // Error if these vars aren't set
  // TODO: Move process.env reads to a config parsing file
  const erc20Address = rawConfig.erc20Address || process.env.ERC20_ADDRESS;

  if (erc20Address == null) {
    throw new Error("No `ERC20_ADDRESS` param configured int .env");
  }

  const config: FormedConfig = {
    erc20Address,
    blockIncrement,
    quietIntervalThreshold,
    provider: rawConfig.provider,
  };
  holdersDebugLog(blockIncrement, quietIntervalThreshold);
  // Create Contract Instance to be queried
  const currentBlockNumber = await config.provider.getBlockNumber();
  holdersDebugLog("current block number: ", currentBlockNumber);
  const tokenContract = new Contract(
    config.erc20Address,
    Erc20TransferAbi,
    config.provider,
  );

  const holders = await fetchHoldersFromTransferEvents(
    currentBlockNumber,
    tokenContract,
    config,
  );

  const holderBalances = await getHolderBalances(
    holders,
    currentBlockNumber,
    tokenContract,
  );

  holdersDebugLog("number of non-zero addresses: ", holderBalances.size);
  return { holderBalances, currentBlockNumber };
}

async function getHolderBalances(
  holders: Set<string>,
  blockNumber: number,
  contract: ethers.Contract,
): Promise<HolderBalances> {
  const holderBalances: HolderBalances = new Map();
  for (const holder of Array.from(holders)) {
    const balance: ethers.BigNumber = await contract.balanceOf(holder, {
      blockTag: blockNumber, // for a consistent totalSupply
    });
    if (!ethers.constants.Zero.eq(balance)) holderBalances.set(holder, balance);
  }
  return holderBalances;
}

async function fetchHoldersFromTransferEvents(
  currentBlockNumber: number,
  contract: ethers.Contract,
  config: FormedConfig,
): Promise<Set<string>> {
  // set up a filter that emits all transfer events
  const transferFilter = contract.filters.Transfer();

  // initialize variables for loop
  let intervalsWithNoTransfers = 0;
  let holders: Set<string> = new Set();
  // loop from top of the blockchain and grab all addresses from transfer
  // events
  for (
    let block = currentBlockNumber;
    block > 0;
    block -= config.blockIncrement
  ) {
    const newTransfers = await contract.queryFilter(
      transferFilter,
      block - config.blockIncrement > 0 ? block - config.blockIncrement : 0,
      block,
    );
    for (const transfer of newTransfers) {
      const { args } = transfer;
      if (args) {
        if (args.from) holders.add(args.from);
        if (args.to) holders.add(args.to);
      }
    }
    // TODO: Set up debug flag to make these quiet
    holdersDebugLog("token holders: ", holders.size);
    holdersDebugLog(`through block ${block - config.blockIncrement}`);
    holdersDebugLog((currentBlockNumber - block) / currentBlockNumber, "%");

    // if there are no transfers over the configured quantity of consecutive
    // blockIncrements, the query terminates
    if (newTransfers.length === 0) intervalsWithNoTransfers++;
    else intervalsWithNoTransfers = 0;
    if (intervalsWithNoTransfers == config.quietIntervalThreshold) {
      holdersDebugLog(
        `No transfers in ${
          config.quietIntervalThreshold * config.blockIncrement
        } blocks. breaking...`,
      );
      break;
    }
  }
  return holders;
}

// fetchTokenHolders().catch((e: Error) => {
//  console.error("holders error: ", e);
//  throw e;
// });
