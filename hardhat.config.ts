import { HardhatUserConfig } from "hardhat/config";
require('dotenv').config()
import "@nomicfoundation/hardhat-toolbox";
const {API_URL, PRIVATE_KEY, API_KEY} = process.env

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    goerli: {
      url: API_URL,
      accounts: [PRIVATE_KEY as string]
    }
  }
};

export default config;
