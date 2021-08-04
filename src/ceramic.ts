require("dotenv").config();
const fs = require("fs");
// import type { GetPermissionFn } from "3id-did-provider";
import CeramicClient from "@ceramicnetwork/http-client";
import { Ed25519Provider } from "key-did-provider-ed25519";
import ThreeIdResolver from "@ceramicnetwork/3id-did-resolver";
import { TileDocument } from "@ceramicnetwork/stream-tile";
import KeyDidResolver from "key-did-resolver";
import { DID } from "dids";
import { IDX } from "@ceramicstudio/idx";
import { randomBytes } from "@stablelib/random";
import { ethers } from "ethers";
import { Caip10Link } from "@ceramicnetwork/stream-caip10-link";

import { Convictions, ConvictionState, Participants, Proposal } from "./types";

let seed: Uint8Array;

interface AuthenticatedCeramicClient extends CeramicClient {
  did: DID;
}
if (!process.env.THREE_ID_SEED) {
  seed = randomBytes(32);
  fs.appendFileSync(
    ".env",
    `# 3ID_seed for use with Ceramic\nTHREE_ID_SEED=${seed}\n`
  );
} else {
  seed = Uint8Array.from(
    process.env.THREE_ID_SEED.split(",").map((i) => Number.parseInt(i))
  );
}

async function authCeramic(): Promise<AuthenticatedCeramicClient> {
  const ceramic = new CeramicClient(process.env.CERAMIC_API_URL);

  const provider = new Ed25519Provider(seed);
  const resolver = {
    ...KeyDidResolver.getResolver(),
    ...ThreeIdResolver.getResolver(ceramic),
  };
  ceramic.did = new DID({ resolver });

  const authCeramic: any = ceramic;
  ceramic.did.setProvider(provider);
  await ceramic.did.authenticate();
  console.log("authenticated");
  if (!ceramic.did) throw new Error("did not installed");
  return authCeramic;
}

async function testCeramic() {
  const ceramic = await authCeramic();
  const doc = await TileDocument.create(
    ceramic,
    { foo: "bar" },
    {
      controllers: [ceramic.did.id],
      family: "doc family",
    }
  );

  const id = doc.id.toString();
  const test = await TileDocument.load(ceramic, id);
  console.log("should load doc: ", test.content);
}

async function initCeramic() {
  const ceramic = await authCeramic();
  // Convert eth address to did
  const toDID = async (address: string): Promise<string> => {
    const { did } = await Caip10Link.fromAccount(ceramic, `${address}@ip155:1`);
    if (!did) throw new Error("no did");
    return did;
  };
}

async function createIdx(): Promise<IDX> {
  const ceramic = await authCeramic();
  return new IDX({ ceramic });
}
testCeramic().catch((e) => console.log(e));

export async function fetchConvictionDocID(address: string, idx: IDX) {
  const did = await toDID(address);
  if (!did) return;
  return idx.getRecordID(config.definitions.convictions, did);
}
function fetchHolderDocuments() {}

function fetchStateDocument() {}
function setStateDocument() {}
