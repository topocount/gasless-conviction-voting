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
import {Config} from "../src/bootstrap";

import rawConfig from "./config/ceramic.json";
const URI = "http://127.0.0.1:7007";
let ethProvider: any;
let addresses: string[];

// TODO: Write a ceramic config parser
const config = rawConfig as Config;

export function encodeRpcMessage(method: string, params?: string[]): any {
  return {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };
}

const GANACHE_CONF = {
  // Same as hardhat
  mnemonic: "test test test test test test test test test test test junk",
};

const GANACHE_CHAIN_ID = "1337";
const send = (provider: any, data: any): Promise<any> =>
  new Promise((resolve, reject) =>
    provider.send(data, (err: any, res: any) => {
      if (err) reject(err);
      else resolve(res.result);
    }),
  );

export const emptyState = {
  context: "eip155:1:0xfb5453340C03db5aDe474b27E68B6a9c6b2823Eb",
  supply: "0",
  blockHeight: 0,
  participants: [],
  proposals: [],
};

async function createMockHolderAndProposal(
  addressIndex: number,
  amount = 100,
): Promise<void> {
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
  const ethAuthProvider = new EthereumAuthProvider(
    ethProvider,
    addresses[addressIndex],
  );

  const accountId = await ethAuthProvider.accountId();

  const accountLink = await Caip10Link.fromAccount(ceramic, accountId);

  await accountLink.setDid(ceramic.did.id, ethAuthProvider);

  const proposalRecordId = await idx.set("proposal", {
    amount: amount.toString(),
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

export async function setEthCeramicProvider(): Promise<{
  createMockHolderAndProposal: (arg0: number) => Promise<void>;
  addresses: string[];
  ceramicStorage: CeramicStorage;
  resetState: () => Promise<void>;
}> {
  ethProvider = ganache.provider(GANACHE_CONF);
  addresses = await send(ethProvider, encodeRpcMessage("eth_accounts"));

  ethProvider.manager.personal_sign = (
    data: any,
    address: string,
    callback: any,
  ): void => {
    const account = ethProvider.manager.state.accounts[address.toLowerCase()];
    const result = sigUtils.personalSign(account.secretKey, {data});
    callback(null, result);
  };
  console.log("test before reset");
  await resetState();
  console.log("test after reset");
  return {createMockHolderAndProposal, addresses, ceramicStorage, resetState};
}

const ceramicStorage = new CeramicStorage(GANACHE_CHAIN_ID, config, URI);

async function resetState() {
  await ceramicStorage.setStateDocument(emptyState);
}