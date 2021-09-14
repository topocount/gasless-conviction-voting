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

const notFound = (e: any): boolean => e.code === "ENOENT";

export type Environment = {
  chainId: string;
  threeIdSeed: Uint8Array;
  ceramicApiUrl: string;
  holder: HoldersConfig;
  alpha: number;
  beta: number;
  rho: number;
  interval: number;
};

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
    ETH_RPC,
    BLOCK_INCREMENT,
    QUIET_INTERVAL_THRESHOLD,
    THREE_ID_SEED,
    CERAMIC_API_URL,
    ERC20_ADDRESS,
    CHAIN_ID,
    SNAPSHOT_INTERVAL_HOURS,
    HALF_LIFE_DAYS,
    ALPHA,
    MAX_FUND_PROPORTION,
    RHO,
  } = process.env;

  if (!ETH_RPC) throw new Error("Please set an ETH_RPC url in your .env file");
  if (!CERAMIC_API_URL) throw new Error("Please set a CERAMIC_API_URL in .env");
  if (!ERC20_ADDRESS)
    throw new Error(
      "Please set an ERC20_ADDRESS with a `0x` prefix in your .env file",
    );
  if (!CHAIN_ID) throw new Error("Please add a numeric CHAIN_ID to .env");

  const ethRpc = ETH_RPC;
  const blockIncrement = BLOCK_INCREMENT;
  const quietIntervalThreshold = QUIET_INTERVAL_THRESHOLD;
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
  let alpha = null;
  if (ALPHA) {
    alpha = Number.parseInt(ALPHA);
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

  const beta = Number.parseInt(MAX_FUND_PROPORTION);

  let rho = 1;
  if (RHO) rho = Number.parseInt(RHO);

  const holder = {
    provider: new providers.JsonRpcProvider(ethRpc),
    erc20Address,
    blockIncrement,
    quietIntervalThreshold,
  };
  return {
    threeIdSeed,
    ceramicApiUrl,
    chainId,
    interval,
    alpha,
    beta,
    rho,
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

// checkConfig().then(console.log).catch(console.error);
