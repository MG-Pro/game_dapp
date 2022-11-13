import {time, loadFixture} from '@nomicfoundation/hardhat-network-helpers'
import {anyValue} from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import {expect} from 'chai'
import {ethers} from 'hardhat'
import {ContractReceipt} from '@ethersproject/contracts/src.ts'

describe('Game', function () {

  enum Choice {
    None,
    Rock ,
    Paper ,
    Scissors,
  }

  function getHash(userAddress: string, choice: Choice): [string, string] {
    const secret = ethers.utils.formatBytes32String('test' + choice)
    return  [ethers.utils.solidityKeccak256(
      ['address', 'uint', 'bytes32', ],
      [userAddress, choice, secret]),
      secret]
  }

  async function deploy() {
    const [deployer, user1, user2] = await ethers.getSigners()
    const Game = await ethers.getContractFactory('Game', deployer)
    const contract = await Game.deploy()
    await contract.deployed()
    return {contract, user1, user2, deployer}
  }

  it('Should set commits of players', async () => {
    const {contract, user1, user2} = await loadFixture(deploy)

    const [hash1] = getHash(user1.address, Choice.Paper);
    const tx1 = await contract.connect(user1).commit(hash1)
    const res1: ContractReceipt = await tx1.wait();
    const player1 = await contract.players(0)

    const [hash2] = getHash(user2.address, Choice.Rock)
    const tx2 = await contract.connect(user2).commit(hash2)
    const res2: ContractReceipt = await tx2.wait();
    const player2 = await contract.players(1)

    expect(player1.hash).to.equal(hash1)
    expect(player2.hash).to.equal(hash2)

    expect(res1.events?.[0]?.args?.player).to.equal(user1.address)
    expect(res2.events?.[0]?.args?.player).to.equal(user2.address)
  })

  it('Should reveal choices of players', async () => {
    const {contract, user1, user2} = await loadFixture(deploy)

    const choice1 = Choice.Paper
    const [hash1, secret1] = getHash(user1.address, choice1);
    await contract.connect(user1).commit(hash1)

    const choice2 = Choice.Rock
    const [hash2, secret2] = getHash(user2.address, choice2)
    await contract.connect(user2).commit(hash2)

    const rtx1 = await contract.connect(user1).reveal(choice1, secret1)
    const rtx2 = await contract.connect(user2).reveal(choice2, secret2)
    const res1 = await rtx1.wait()
    const res2 = await rtx2.wait()

    expect(res1.events?.[0]?.args?.choice).to.equal(choice1)
    expect(res2.events?.[0]?.args?.choice).to.equal(choice2)
  })

})


