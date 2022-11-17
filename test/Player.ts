import {ethers} from 'hardhat'
import {loadFixture} from '@nomicfoundation/hardhat-network-helpers'
import {expect} from 'chai'

describe('Player', function () {
  enum Choice {
    None,
    Rock ,
    Paper ,
    Scissors,
  }

  function getHash(userAddress: string, choice: Choice): [string, string] {
    const secret = ethers.utils.formatBytes32String('test' + choice)
    return  [ethers.utils.solidityKeccak256(
      ['address', 'uint', 'bytes32'],
      [userAddress, choice, secret]),
      secret]
  }

  async function deployGame() {
    const [deployer, user1] = await ethers.getSigners()
    const Game = await ethers.getContractFactory('Game', deployer)
    const contractGame = await Game.deploy()
    await contractGame.deployed()
    return {contractGame, user1, deployer}
  }

  async function deployPlayer() {
    const [, , user2] = await ethers.getSigners()
    const Player = await ethers.getContractFactory('Player', user2)
    const contractPlayer = await Player.deploy()
    await contractPlayer.deployed()
    return {contractPlayer, user2}
  }

  it('Should show result: Paper beats Rock', async () => {
    const {contractGame, user1} = await loadFixture(deployGame)
    const {contractPlayer, user2} = await loadFixture(deployPlayer)
    const winner = user1.address

    const choice1 = Choice.Scissors
    const [hash1, secret1] = getHash(user1.address, choice1);
    await contractGame.connect(user1).commit(hash1)

    const choice2 = Choice.Paper
    const [hash2, secret2] = getHash(contractPlayer.address, choice2)
    await contractPlayer.connect(user2).setGameContract(contractGame.address)
    await contractPlayer.connect(user2).commitCall(hash2)

    await contractGame.connect(user1).reveal(choice1, secret1)
    await contractPlayer.connect(user2).revealCall(choice2, secret2)

    await expect(contractPlayer.connect(user2).resultCall()).to.emit(contractGame, 'Result').withArgs(winner)
  })
})
