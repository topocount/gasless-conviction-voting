// borrowed from carlbardhal
require("dotenv").config();
const { writeFile } = require("fs").promises;

const Ceramic = require("@ceramicnetwork/http-client").default;
const { createDefinition, publishSchema } = require("@ceramicstudio/idx-tools");
const { Ed25519Provider } = require("key-did-provider-ed25519");
const { DID } = require("dids");
const ThreeIdResolver = require("@ceramicnetwork/3id-did-resolver").default;
const KeyDidResolver = require("key-did-resolver").default;
const ConvictionStateSchema = require("./schemas/conviction-state.json");
const ConvictionsSchema = require("./schemas/convictions.json");
const ProposalSchema = require("./schemas/proposal.json");
const getCaipFromErc20Address = require("./util");

const SEED = process.env.THREE_ID_SEED;
const CERAMIC_HOST = process.env.CERAMIC_API_URL;
const ADDRESS = process.env.ERC20_ADDRESS;

const config = {
  did: null,
  erc20Contract: getCaipFromErc20Address(ADDRESS, 1),
  definitions: {},
  schemas: {},
};

const ceramic = new Ceramic(CERAMIC_HOST);

async function run() {
  console.log("Bootstrapping schemas and definitions");

  const provider = new Ed25519Provider(
    Uint8Array.from(SEED.split(",").map(Number.parseInt))
  );

  const resolver = {
    ...KeyDidResolver.getResolver(),
    ...ThreeIdResolver.getResolver(ceramic),
  };

  ceramic.did = new DID({ resolver });
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
          schema.commitId.toUrl()
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
      }
    )
  );

  console.log("Writing config.json", config);
  await writeFile("./src/config.json", JSON.stringify(config));

  console.log("Config written to src/config.json file:", config);
  process.exit(0);
}

run().catch(console.error);
