import {promises} from "fs";

import Ceramic from "@ceramicnetwork/http-client";
import {createDefinition, publishSchema} from "@ceramicstudio/idx-tools";
import {Ed25519Provider} from "key-did-provider-ed25519";
import {DID} from "dids";
import ThreeIdResolver from "@ceramicnetwork/3id-did-resolver";
import KeyDidResolver from "key-did-resolver";
import ConvictionStateSchema from "./schemas/conviction-state.json";
import ConvictionsSchema from "./schemas/convictions.json";
import ProposalSchema from "./schemas/proposal.json";
import {Environment} from "./config";
import {getCaipFromErc20Address} from "./util";

export type Config = {
  did: string;
  erc20Contract: string;
  schemas?: any;
  definitions?: any;
};

const {writeFile} = promises;
export async function run(
  path: string,
  environment: Environment,
): Promise<Config> {
  console.log("Bootstrapping schemas and definitions");

  const url_arg = process.argv[1].endsWith("bootstrap.ts")
    ? process.argv[2]
    : null;
  const {chainId, threeIdSeed, ceramicApiUrl, holder} = environment;

  const {erc20Address} = holder;

  const ceramicHost = url_arg || ceramicApiUrl;

  const config: Config = {
    did: "",
    erc20Contract: getCaipFromErc20Address(erc20Address, chainId),
    schemas: {},
    definitions: {},
  };

  const ceramic = new Ceramic(ceramicHost);

  const provider = new Ed25519Provider(threeIdSeed);

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
