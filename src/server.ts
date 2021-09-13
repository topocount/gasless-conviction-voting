import {checkConfig} from "./config";
import {CeramicStorage} from "./ceramic";
import {Snapshot} from "./snapshot";
import cron from "node-cron";
async function main(): Promise<void> {
  const config = await checkConfig();

  const {chainId, ceramicApiUrl, holder, alpha, beta, rho, interval} =
    config.environment;
  const ceramicStorage = new CeramicStorage(
    chainId,
    config.ceramic,
    ceramicApiUrl,
  );

  const snapshotConfig = {
    holdersConfig: holder,
    alpha,
    beta,
    rho,
  };

  const snapshot = new Snapshot(ceramicStorage, snapshotConfig);

  cron.schedule(`0 */${interval} * * *`, () => {
    snapshot.updateSnapshot();
  });

  console.log("Add express service next");
}

main()
  .then(() => console.log("service started"))
  .catch(console.error);
