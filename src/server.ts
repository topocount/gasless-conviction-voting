import {checkConfig} from "./config";
import {CeramicStorage} from "./ceramic";
import {Snapshot} from "./snapshot";

import express from "express";
import cron from "node-cron";

const PORT = 3000;
async function main(): Promise<void> {
  const config = await checkConfig();

  const {chainId, ceramicApiUrl, holder, alpha, beta, rho, interval} =
    config.environment;

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
    alpha,
    beta,
    rho,
  };

  const snapshot = new Snapshot(ceramicStorage, snapshotConfig);

  cron.schedule(cron_string, () => {
    snapshot.updateSnapshot();
  });

  const app = express();

  app.get("/", (req, res) => {
    res.send(publicConfig);
  });

  app.get("/proposals/:address", async (req, res) => {
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

  app.get("/snapshot", async (req, res) => {
    snapshot.updateSnapshot();
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
