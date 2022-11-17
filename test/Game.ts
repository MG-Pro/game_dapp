import {loadFixture} from '@nomicfoundation/hardhat-network-helpers'
import {expect} from 'chai'
import {ethers} from 'hardhat'
import {ContractReceipt} from '@ethersproject/contracts/src.ts'
import {ContractTransaction} from 'ethers'

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
    await expect(contract.connect(user1).commit(hash1)).to.emit(contract, 'Commit').withArgs(user1.address)

    const [hash2] = getHash(user2.address, Choice.Rock)
    await expect(contract.connect(user2).commit(hash2)).to.emit(contract, 'Commit').withArgs(user2.address)

    const player1 = await contract.players(0)
    const player2 = await contract.players(1)

    expect(player1.hash).to.equal(hash1)
    expect(player2.hash).to.equal(hash2)
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

    await expect(contract.connect(user1).reveal(choice1, secret1)).to.emit(contract, 'Reveal').withArgs(user1.address, choice1)
    await expect(contract.connect(user2).reveal(choice2, secret2)).to.emit(contract, 'Reveal').withArgs(user2.address, choice2)
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
    const [hash1] = getHash(user1.address, choice1);
    await contract.connect(user1).commit(hash1)
    const choice2 = Choice.Paper

    const [hash2] = getHash(user2.address, choice2)
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

    async function gameProcess(choice1: Choice, choice2: Choice): Promise<ContractTransaction> {
      const {contract, user1, user2} = await loadFixture(deploy)

      const [hash1, secret1] = getHash(user1.address, choice1);
      await contract.connect(user1).commit(hash1)

      const [hash2, secret2] = getHash(user2.address, choice2)
      await contract.connect(user2).commit(hash2)
      await contract.connect(user1).reveal(choice1, secret1)
      await contract.connect(user2).reveal(choice2, secret2)

      return contract.connect(user1).result()
    }


    it('Should show result: Paper beats Rock', async () => {
      const {contract, user1} = await loadFixture(deploy)
      const winner = user1.address
      const req = gameProcess(Choice.Paper, Choice.Rock)

      await expect(req).to.emit(contract, 'Result').withArgs(winner)
    })

    it('Should show result: Paper loses to Scissors', async () => {
      const {contract, user2} = await loadFixture(deploy)
      const winner = user2.address
      const req = gameProcess(Choice.Paper, Choice.Scissors)

      await expect(req).to.emit(contract, 'Result').withArgs(winner)
    })

    it('Should show result: Rock beats Scissors', async () => {
      const {contract, user1} = await loadFixture(deploy)
      const winner = user1.address
      const req = gameProcess(Choice.Rock, Choice.Scissors)

      await expect(req).to.emit(contract, 'Result').withArgs(winner)
    })

    it('Should show result: Rock loses Paper', async () => {
      const {contract, user2} = await loadFixture(deploy)
      const winner = user2.address
      const req = gameProcess(Choice.Rock, Choice.Paper)

      await expect(req).to.emit(contract, 'Result').withArgs(winner)
    })

    it('Should show result: Scissors loses to Rock', async () => {
      const {contract, user2} = await loadFixture(deploy)
      const winner = user2.address
      const req = gameProcess(Choice.Scissors, Choice.Rock)

      await expect(req).to.emit(contract, 'Result').withArgs(winner)
    })

    it('Should show result: Scissors beats to Paper', async () => {
      const {contract, user1} = await loadFixture(deploy)
      const winner = user1.address
      const req = gameProcess(Choice.Scissors, Choice.Paper)

      await expect(req).to.emit(contract, 'Result').withArgs(winner)
    })

    it('Should show result: standoff', async () => {
      const {contract} = await loadFixture(deploy)
      const req = gameProcess(Choice.Rock, Choice.Rock)
      await expect(req).to.emit(contract, 'Result').withArgs(ethers.constants.AddressZero)

    })

    it('Should show result: standoff', async () => {
      const {contract} = await loadFixture(deploy)
      const req = gameProcess(Choice.Paper, Choice.Paper)
      await expect(req).to.emit(contract, 'Result').withArgs(ethers.constants.AddressZero)
    })

    it('Should show result: standoff', async () => {
      const {contract} = await loadFixture(deploy)
      const req = gameProcess(Choice.Scissors, Choice.Scissors)
      await expect(req).to.emit(contract, 'Result').withArgs(ethers.constants.AddressZero)
    })
  })
})


