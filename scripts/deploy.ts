import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('Deploying contracts with the account:', deployer.address)

  const Game = await ethers.getContractFactory('Game')
  const game = await Game.deploy()

  await game.deployed();

  console.log(`Contract deployed to: ${game.address}`);
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
