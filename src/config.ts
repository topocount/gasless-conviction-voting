import dotenv from "dotenv";
import {run, Config as CeramicConfig} from "./bootstrap";
import {Config as HoldersConfig} from "./holders";
import {readFileSync, promises} from "fs";
import {join as pathJoin} from "path";
import {mkdirx, getAlpha} from "./util";
import {ethers} from "ethers";
import {randomBytes} from "@stablelib/random";

const {providers} = ethers;
const {appendFile} = promises;

const DEFAULT_CONFIG_PATH = "config";
const CERAMIC_FILE_NAME = "ceramic.json";

const RHO_DEFAULT = 1;
const BLOCK_INCREMENT_DEFAULT = 50000;

const notFound = (e: any): boolean => e.code === "ENOENT";

export function getDebug(path = ".env"): string | undefined {
  dotenv.config({path});
  const {DEBUG} = process.env;
  return DEBUG;
}

export type PublicEnvironment = {
  chainId: string;
  proposers: Array<string>;
  ceramicApiUrl: string;
  alpha: number;
  beta: number;
  rho: number;
  interval: number;
  schedule: string;
  threeIdSeed: void;
  holder: void;
};

export type PublicConfig = {
  ceramic: CeramicConfig;
  environment: PublicEnvironment;
};

export interface Environment {
  chainId: string;
  proposers?: Array<string>;
  treasury?: string;
  allowedOrigins: Array<string>;
  threeIdSeed: Uint8Array;
  ceramicApiUrl: string;
  holder: HoldersConfig;
  alpha: number;
  beta: number;
  rho: number;
  interval: number;
}

export type Config = {
  ceramic: CeramicConfig;
  environment: Environment;
};

export async function getCeramicAppConfig(
  env: Environment,
  path = DEFAULT_CONFIG_PATH,
): Promise<CeramicConfig> {
  mkdirx(path);
  let config;
  const filePath = pathJoin(path, CERAMIC_FILE_NAME);
  try {
    config = JSON.parse(readFileSync(filePath, {encoding: "utf8"}));
  } catch (e) {
    if (notFound(e)) {
      config = await run(filePath, env);
    } else throw e;
  }
  return config;
}

export function checkEnvironment(pathToDotEnv = ".env"): Environment {
  dotenv.config({path: pathToDotEnv});
  const {
    ALLOWED_ORIGINS,
    ALPHA,
    BLOCK_INCREMENT,
    CERAMIC_API_URL,
    CHAIN_ID,
    ERC20_ADDRESS,
    ETH_RPC,
    HALF_LIFE_DAYS,
    MAX_FUND_PROPORTION,
    NODE_ENV,
    PROPOSER_ADDRESSES,
    RHO,
    SNAPSHOT_INTERVAL_HOURS,
    START_BLOCK,
    THREE_ID_SEED,
    TREASURY_ADDRESS,
  } = process.env;

  if (!ETH_RPC) throw new Error("Please set an ETH_RPC url in your .env file");
  if (!CERAMIC_API_URL) throw new Error("Please set a CERAMIC_API_URL in .env");
  if (!ERC20_ADDRESS)
    throw new Error(
      "Please set an ERC20_ADDRESS with a `0x` prefix in your .env file",
    );
  if (!CHAIN_ID) throw new Error("Please add a numeric CHAIN_ID to .env");

  const startBlock = START_BLOCK ? Number.parseInt(START_BLOCK) : 0;

  const ethRpc = ETH_RPC;

  const blockIncrement: number = BLOCK_INCREMENT
    ? Number.parseInt(BLOCK_INCREMENT)
    : BLOCK_INCREMENT_DEFAULT;

  const ceramicApiUrl = CERAMIC_API_URL;
  const chainId = CHAIN_ID;
  const erc20Address = ERC20_ADDRESS;

  let threeIdSeed = null;
  if (!THREE_ID_SEED) {
    threeIdSeed = randomBytes(32);
    appendFile(
      ".env",
      `# 3ID_seed for use with Ceramic\nTHREE_ID_SEED=${threeIdSeed}\n`,
    );
  } else {
    threeIdSeed = Uint8Array.from(
      THREE_ID_SEED.split(",").map(Number.parseInt),
    );
  }

  let allowedOrigins = ["*"];
  if (ALLOWED_ORIGINS) {
    allowedOrigins = ALLOWED_ORIGINS.split(",");
  } else if (NODE_ENV === "production")
    throw new Error("No universal cors allowed in production");

  let alpha = null;
  if (ALPHA) {
    alpha = Number.parseFloat(ALPHA);
  }
  if (!SNAPSHOT_INTERVAL_HOURS)
    throw new Error("Please set SNAPSHOT_INTERVAL_HOURS");
  const interval = Number.parseInt(SNAPSHOT_INTERVAL_HOURS);
  if (alpha == null) {
    if (!HALF_LIFE_DAYS)
      throw new Error(
        "Please enter the half life for conviction in days as HALF_LIFE_ALPHA or a manual ALPHA in .env",
      );
    alpha = getAlpha(interval, HALF_LIFE_DAYS);
  }

  if (!MAX_FUND_PROPORTION)
    throw new Error("Please enter a MAX_FUND_PROPORTION in .env");

  const beta = Number.parseFloat(MAX_FUND_PROPORTION);

  let rho = RHO_DEFAULT;
  if (RHO) rho = Number.parseFloat(RHO);

  let treasury: string | undefined;
  if (TREASURY_ADDRESS) treasury = TREASURY_ADDRESS;

  let proposers: Array<string> | undefined;

  if (PROPOSER_ADDRESSES) {
    proposers = PROPOSER_ADDRESSES.split(",");
  }
  const holder = {
    provider: new providers.JsonRpcProvider(ethRpc),
    erc20Address,
    blockIncrement,
    startBlock,
  };
  return {
    allowedOrigins,
    threeIdSeed,
    ceramicApiUrl,
    chainId,
    interval,
    alpha,
    beta,
    rho,
    treasury,
    proposers,
    holder,
  };
}

export async function checkConfig(): Promise<Config> {
  const environmentConfig = checkEnvironment();
  const ceramicConfig = await getCeramicAppConfig(environmentConfig);

  return {
    ceramic: ceramicConfig,
    environment: environmentConfig,
  };
}
