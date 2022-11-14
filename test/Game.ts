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

  it('Should reverted with Wrong stage', async () => {
    const {contract, user1, user2} = await loadFixture(deploy)

    const choice1 = Choice.None
    const [hash1] = getHash(user1.address, choice1);
    await contract.connect(user1).commit(hash1)
    const choice2 = Choice.Paper

    const [hash2] = getHash(user2.address, choice2)
    await contract.connect(user2).commit(hash2)

    await expect(contract.connect(user1).commit(hash1)).to.revertedWith('Wrong stage')
    await expect(contract.connect(user2).commit(hash2)).to.revertedWith('Wrong stage')
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

  it('Should reverted with invalid choice', async () => {
    const {contract, user1, user2} = await loadFixture(deploy)

    const choice1 = Choice.None
    const [hash1, secret1] = getHash(user1.address, choice1);
    await contract.connect(user1).commit(hash1)
    const choice2 = Choice.Paper

    const [hash2, secret2] = getHash(user2.address, choice2)
    await contract.connect(user2).commit(hash2)

    await expect(contract.connect(user1).reveal(choice1, secret1)).to.revertedWith('invalid choice')
  })

  it('Should reset game by owner', async () => {
    const {contract, user1, user2, deployer} = await loadFixture(deploy)

    const choice1 = Choice.None
    const [hash1, secret1] = getHash(user1.address, choice1);
    await contract.connect(user1).commit(hash1)
    const choice2 = Choice.Paper

    const [hash2, secret2] = getHash(user2.address, choice2)
    await contract.connect(user2).commit(hash2)

    await contract.connect(deployer).resetGame()

    expect(await contract.connect(user1).stage()).to.equal(0)
  })

  it('Should reverted if not owner', async () => {
    const {contract, user1} = await loadFixture(deploy)
    await expect(contract.connect(user1).resetGame()).to.revertedWith('Only for owner')
  })

  it('Should reverted if not players', async () => {
    const {contract, user1, user2, deployer} = await loadFixture(deploy)
    const choice1 = Choice.Scissors
    const [hash1, secret1] = getHash(user1.address, choice1);
    await contract.connect(user1).commit(hash1)

    const choice2 = Choice.Paper
    const [hash2, secret2] = getHash(user2.address, choice2)
    await contract.connect(user2).commit(hash2)

    await contract.connect(user1).reveal(choice1, secret1)
    await contract.connect(user2).reveal(choice2, secret2)

    await expect(contract.connect(deployer).reveal(choice2, secret2)).to.revertedWith('Only for players')
    await expect(contract.connect(deployer).result()).to.revertedWith('Only for players')
  })

  it('Should reverted invalid hash', async () => {
    const {contract, user1, user2} = await loadFixture(deploy)
    const choice1 = Choice.Scissors
    const [hash1, secret1] = getHash(user1.address, choice1);
    await contract.connect(user1).commit(hash1)

    const choice2 = Choice.Paper
    const [hash2, secret2] = getHash(user2.address, choice2)
    await contract.connect(user2).commit(hash2)

    await expect(contract.connect(user1).reveal(choice1, secret2)).to.revertedWith('invalid hash')
  })

  it('Should set correct stages', async () => {
    const {contract, user1, user2} = await loadFixture(deploy)

    expect(await contract.connect(user1).stage()).to.equal(0)

    const choice1 = Choice.Scissors
    const [hash1, secret1] = getHash(user1.address, choice1);
    await contract.connect(user1).commit(hash1)
    expect(await contract.connect(user1).stage()).to.equal(1)

    const choice2 = Choice.Paper
    const [hash2, secret2] = getHash(user2.address, choice2)
    await contract.connect(user2).commit(hash2)
    expect(await contract.connect(user1).stage()).to.equal(2)

    await contract.connect(user1).reveal(choice1, secret1)
    expect(await contract.connect(user1).stage()).to.equal(3)

    await contract.connect(user2).reveal(choice2, secret2)
    expect(await contract.connect(user1).stage()).to.equal(4)

    await contract.connect(user1).result()
    expect(await contract.connect(user1).stage()).to.equal(0)
  })

  describe('Result', () => {

    async function gameProcess(choice1: Choice, choice2: Choice): Promise<ContractReceipt> {
      const {contract, user1, user2} = await loadFixture(deploy)

      const [hash1, secret1] = getHash(user1.address, choice1);
      await contract.connect(user1).commit(hash1)

      const [hash2, secret2] = getHash(user2.address, choice2)
      await contract.connect(user2).commit(hash2)
      await contract.connect(user1).reveal(choice1, secret1)
      await contract.connect(user2).reveal(choice2, secret2)

      const tx = await contract.connect(user1).result()
      return await tx.wait()
    }


    it('Should show result: Paper beats Rock', async () => {
      const {user1} = await loadFixture(deploy)
      const winner = user1.address
      const res = await gameProcess(Choice.Paper, Choice.Rock)

      expect(res.events?.[0]?.args?.winner).to.equal(winner)
    })

    it('Should show result: Paper loses to Scissors', async () => {
      const {user2} = await loadFixture(deploy)
      const winner = user2.address
      const res = await gameProcess(Choice.Paper, Choice.Scissors)

      expect(res.events?.[0]?.args?.winner).to.equal(winner)
    })

    it('Should show result: Rock beats Scissors', async () => {
      const {user1} = await loadFixture(deploy)
      const winner = user1.address
      const res = await gameProcess(Choice.Rock, Choice.Scissors)

      expect(res.events?.[0]?.args?.winner).to.equal(winner)
    })

    it('Should show result: Rock loses Paper', async () => {
      const {user2} = await loadFixture(deploy)
      const winner = user2.address
      const res = await gameProcess(Choice.Rock, Choice.Paper)

      expect(res.events?.[0]?.args?.winner).to.equal(winner)
    })

    it('Should show result: Scissors loses to Rock', async () => {
      const {user2} = await loadFixture(deploy)
      const winner = user2.address
      const res = await gameProcess(Choice.Scissors, Choice.Rock)

      expect(res.events?.[0]?.args?.winner).to.equal(winner)
    })

    it('Should show result: Scissors beats to Paper', async () => {
      const {user1} = await loadFixture(deploy)
      const winner = user1.address
      const res = await gameProcess(Choice.Scissors, Choice.Paper)

      expect(res.events?.[0]?.args?.winner).to.equal(winner)
    })

    it('Should show result: standoff', async () => {
      const res = await gameProcess(Choice.Rock, Choice.Rock)
      expect(res.events?.[0]?.args?.winner).to.equal(ethers.constants.AddressZero)
    })

    it('Should show result: standoff', async () => {
      const res = await gameProcess(Choice.Paper, Choice.Paper)
      expect(res.events?.[0]?.args?.winner).to.equal(ethers.constants.AddressZero)
    })

    it('Should show result: standoff', async () => {
      const res = await gameProcess(Choice.Scissors, Choice.Scissors)
      expect(res.events?.[0]?.args?.winner).to.equal(ethers.constants.AddressZero)
    })
  })
})


