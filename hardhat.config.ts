import "@nomiclabs/hardhat-waffle";
import "hardhat-watcher";
// import { task } from "hardhat/config";

export default {
  solidity: "0.8.4",
  paths: {
    sources: "./contract",
  },

  watcher: {
    testing: {
      tasks: [{command: "test"}],
      files: ["./test/**/*", "./src/**/*"],
    },
  },
};
