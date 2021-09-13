import dotenv from "dotenv";
import {promises} from "fs";
import {randomBytes} from "@stablelib/random";

import Ceramic from "@ceramicnetwork/http-client";
import {createDefinition, publishSchema} from "@ceramicstudio/idx-tools";
import {Ed25519Provider} from "key-did-provider-ed25519";
import {DID} from "dids";
import ThreeIdResolver from "@ceramicnetwork/3id-did-resolver";
import KeyDidResolver from "key-did-resolver";
import ConvictionStateSchema from "./schemas/conviction-state.json";
import ConvictionsSchema from "./schemas/convictions.json";
import ProposalSchema from "./schemas/proposal.json";
import {getCaipFromErc20Address} from "./util";

dotenv.config();

export type Config = {
  did: string;
  erc20Contract: string;
  schemas?: any;
  definitions?: any;
};

const {writeFile, appendFile} = promises;
let SEED: string;
if (!process.env.THREE_ID_SEED) {
  const newSeed = randomBytes(32);
  appendFile(
    ".env",
    `# 3ID_seed for use with Ceramic\nTHREE_ID_SEED=${newSeed}\n`,
  );
  SEED = newSeed.join();
} else {
  SEED = process.env.THREE_ID_SEED;
}
const CERAMIC_HOST = process.argv[2] || process.env.CERAMIC_API_URL;
if (!process.env.ERC20_ADDRESS)
  throw new Error(
    "Please set an ERC20_ADDRESS with a `0x` prefix in your .env file",
  );
if (!process.env.CHAIN_ID)
  throw new Error("Please add a numeric CHAIN_ID to .env");
const ADDRESS: string = process.env.ERC20_ADDRESS;
const CHAIN_ID: string = process.env.CHAIN_ID;

const config: Config = {
  did: "",
  erc20Contract: getCaipFromErc20Address(ADDRESS, CHAIN_ID),
  schemas: {},
  definitions: {},
};

const ceramic = new Ceramic(CERAMIC_HOST);

export async function run(path: string): Promise<Config> {
  console.log("Bootstrapping schemas and definitions");

  const provider = new Ed25519Provider(
    Uint8Array.from(SEED.split(",").map(Number.parseInt)),
  );

  const resolver = {
    ...KeyDidResolver.getResolver(),
    ...ThreeIdResolver.getResolver(ceramic),
  };

  ceramic.did = new DID({resolver});
  ceramic.did.setProvider(provider);
  await ceramic.did.authenticate();
  console.log("Ceramic initialized", ceramic?.did?.id);

  config.did = ceramic?.did?.id;

  await Promise.all(
    [ConvictionStateSchema, ConvictionsSchema, ProposalSchema].map(
      async (content) => {
        const schema = await publishSchema(ceramic, {
          content,
          name: content.title,
        });
        console.log(
          "Schema published:",
          content.title,
          schema.commitId.toUrl(),
        );

        const def = await createDefinition(ceramic, {
          name: content.title.toLowerCase(),
          description: content.title,
          schema: schema.commitId.toUrl(),
        });

        console.log("Definition created:", content.title, def.id.toString());

        // Add to config
        config.schemas[content.title] = schema.commitId.toUrl();
        config.definitions[content.title.toLowerCase()] = def.id.toString();

        return {
          key: content.title,
          value: schema.commitId.toUrl(),
        };
      },
    ),
  );

  console.log("Writing ceramic.json", config);
  await writeFile(path, JSON.stringify(config, null, 2));

  console.log(`Config written to ${path}:`, config);
  return config;
}

//run().catch(console.error);
