import {checkConfig, getDebug} from "./config";
// set debug var before invoking all tooling that can use it
process.env.DEBUG = getDebug();

import {CeramicStorage} from "./ceramic";
import {Snapshot} from "./snapshot";

import express from "express";
import cors from "cors";
import cron from "node-cron";

const PORT = 3000;
async function main(): Promise<void> {
  const config = await checkConfig();

  const {
    chainId,
    ceramicApiUrl,
    holder,
    alpha,
    beta,
    rho,
    interval,
    allowedOrigins,
    proposers,
    treasury,
  } = config.environment;

  const cron_string = `0 */${interval} * * *`;

  const publicConfig = {
    environment: {
      ...config.environment,
      schedule: cron_string,
      threeIdSeed: undefined,
      holder: undefined,
    },
    ceramic: config.ceramic,
  };

  const ceramicStorage = new CeramicStorage(chainId, config, ceramicApiUrl);

  const snapshotConfig = {
    holdersConfig: holder,
    treasury,
    alpha,
    beta,
    rho,
  };

  const snapshot = new Snapshot(ceramicStorage, snapshotConfig);

  cron.schedule(cron_string, () => {
    snapshot.updateSnapshot();
  });

  const app = express();

  const corsConfig = {
    origin: allowedOrigins,
  };

  // @ts-expect-error type for middleware overload doesn't exist
  app.get("/", cors(corsConfig), (req, res) => {
    res.send(publicConfig);
  });

  // @ts-expect-error type for middleware overload doesn't exist
  app.get("/proposals/:address", cors(corsConfig), async (req, res) => {
    const address = req.params.address;
    if (proposers && !proposers.includes(address)) {
      res.sendStatus(403);
      return;
    }
    try {
      await ceramicStorage.addProposals(req.params.address);
    } catch (e) {
      console.error(e);
      if (e?.message?.startsWith("Bad address")) res.sendStatus(400);
      else res.sendStatus(500);
      return;
    }
    res.sendStatus(200);
  });

  // the below routes are for use by server admins (making local calls on
  // the server for testing purposes and are therefore not cors-enabled

  app.get("/snapshot", async (req, res) => {
    await snapshot.updateSnapshot();
    res.sendStatus(200);
  });

  app.get("/state", async (req, res) => {
    const result = await snapshot.storage.fetchOrCreateStateDocument();
    res.send(result);
  });

  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
}

main().catch(console.error);
