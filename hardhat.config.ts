import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: process.env.RPC_URL || "",
      accounts:
        process.env.OPERATOR_PRIVATE_KEY !== undefined ? [process.env.OPERATOR_PRIVATE_KEY] : [],
    },
  },
};

export default config;