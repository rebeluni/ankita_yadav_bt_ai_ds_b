import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// --- PASTE YOUR VALUES HERE ---
const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/pOI1RTeEpxFUL_zbmW3C2";
const OPERATOR_PRIVATE_KEY = "5c6966c782e4880456248f20c60ec20886ca8a0e308197a62abde1cce9f4546e";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: RPC_URL,
      accounts: [OPERATOR_PRIVATE_KEY],
    },
  },
};

export default config;