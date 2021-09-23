import {mkdirSync} from "fs";

type TokenId = {
  chainId: string;
  address: string;
};

export function getTokenIdFromCAIP10(id: string): TokenId {
  const caip10Re = /^eip155:[0-9]{1,}:0x[0-9a-fA-F]{40}$/;
  if (!caip10Re.test(id)) {
    throw new Error(
      "invalid CAIP10 Identifier; Must be of the form `eip155:<chain id>:<token address>`",
    );
  }
  const [, chainId, address] = id.split(":");
  return {
    chainId,
    address,
  };
}

/**
 * Create a CAIP10 identifier from address and chain ID
 */
export function getCaipFromErc20Address(
  address: string,
  chainId: string | number,
): string {
  return `eip155:${chainId}:${address}`;
}

/**
 * Make a directory, if it doesn't already exist.
 */
export function mkdirx(path: string): void {
  try {
    mkdirSync(path, {recursive: true});
  } catch (e: any) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
}

export function getAlpha(interval: number, halfLifeString: string): number {
  const halfLife = Number.parseInt(halfLifeString);
  const MIN_INTERVAL = 3;
  if (interval % MIN_INTERVAL > 0)
    throw new Error(
      `SNAPSHOT_INTERVAL_HOURS must be a multiple of ${MIN_INTERVAL}`,
    );

  if (24 / interval != Math.floor(24 / interval))
    throw new Error("interval must divide evenly into 24 hours");
  if (interval > 24) throw new Error("Interval must be no longer than a day");

  return 2 ** (-1 / ((24 * halfLife) / interval));
}
