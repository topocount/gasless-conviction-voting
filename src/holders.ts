import debug from "debug";
const holdersInfoLog = debug("CVsdk:holders:info");
const holdersDebugLog = debug("CVsdk:holders:debug");
import {ethers} from "ethers";
import {Provider} from "@ethersproject/providers";
import {BigNumber as BN} from "@ethersproject/bignumber";

const {Contract} = ethers;

const Erc20TransferAbi = [
  "event Transfer(address indexed from, address indexed to, uint amount)",
  "function balanceOf(address owner) view returns (uint256)",
];

// TODO: Add "To block" param to optimize the blockchain reads after initial
// state is stored to ceramic
export type Config = {
  provider: Provider;
  erc20Address: string;
  blockIncrement: number;
  startBlock: number;
};

export type HolderBalances = Map<string, string>;
type HolderState = {
  holderBalances: HolderBalances;
  supply: string;
};
type HolderSnapshot = {
  holderBalances: HolderBalances;
  currentBlockNumber: number;
  supply: string;
};

export async function fetchTokenHolders(
  config: Config,
  lastSyncedHolders: Array<string>,
  lastSyncedBlock?: number,
): Promise<HolderSnapshot> {
  const {
    erc20Address,
    blockIncrement,
    startBlock: deployedBlock,
    provider,
  } = config;

  // if the lastSyncedBlock is zero or undefined, fall back to the block set
  // in the .env
  holdersDebugLog(
    `last synced block: ${lastSyncedBlock}\ndeployed block: ${deployedBlock}`,
  );
  const startBlock = lastSyncedBlock || deployedBlock;
  holdersInfoLog("Start: Getting Token Holders");
  holdersDebugLog(
    "\nincrement: ",
    blockIncrement,
    "\nstart block:",
    startBlock,
  );
  // Create Contract Instance to be queried
  const currentBlockNumber = await provider.getBlockNumber();
  holdersDebugLog("current block number: ", currentBlockNumber);
  const tokenContract = new Contract(erc20Address, Erc20TransferAbi, provider);

  const holders = await fetchHoldersFromTransferEvents(
    currentBlockNumber,
    tokenContract,
    config,
    startBlock,
  );

  lastSyncedHolders.forEach((holder) => holders.add(holder));

  const {holderBalances, supply} = await getHolderBalances(
    holders,
    currentBlockNumber,
    tokenContract,
  );

  holdersInfoLog("number of non-zero addresses: ", holderBalances.size);

  holdersInfoLog("Finish: Getting Token Holders");
  return {holderBalances, currentBlockNumber, supply};
}

async function getHolderBalances(
  holders: Set<string>,
  blockNumber: number,
  contract: ethers.Contract,
): Promise<HolderState> {
  let supply = BN.from(0);
  const holderBalances: HolderBalances = new Map();
  for (const holder of Array.from(holders)) {
    const balance: ethers.BigNumber = await contract.balanceOf(holder, {
      blockTag: blockNumber, // for a consistent totalSupply
    });
    if (!ethers.constants.Zero.eq(balance)) {
      holderBalances.set(holder, balance.toString());
      supply = supply.add(balance);
    }
  }
  return {holderBalances, supply: supply.toString()};
}

async function fetchHoldersFromTransferEvents(
  currentBlockNumber: number,
  contract: ethers.Contract,
  config: Config,
  startBlock: number,
): Promise<Set<string>> {
  // set up a filter that emits all transfer events
  const transferFilter = contract.filters.Transfer();

  // initialize variables for loop
  const holders: Set<string> = new Set();
  // loop from top of the blockchain and grab all addresses from transfer
  // events
  for (
    let block = startBlock;
    block < currentBlockNumber;
    block += config.blockIncrement
  ) {
    holdersDebugLog("token holders: ", holders.size);
    holdersDebugLog(`through block ${block}`);
    holdersDebugLog(
      (100 * (currentBlockNumber - block)) / (currentBlockNumber - startBlock),
      "% of blocks remaining: ",
      block + "/" + currentBlockNumber,
    );
    const newTransfers = await contract.queryFilter(
      transferFilter,
      block,
      block + config.blockIncrement < currentBlockNumber
        ? block + config.blockIncrement
        : currentBlockNumber,
    );
    for (const transfer of newTransfers) {
      const {args} = transfer;
      if (args) {
        if (args.from) holders.add(args.from);
        if (args.to) holders.add(args.to);
      }
    }
  }
  return holders;
}
