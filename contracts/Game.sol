// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
import "hardhat/console.sol";
contract Game {
    address private owner;

    enum Choice {
        None,
        Rock,
        Paper,
        Scissors
    }

    enum Stages {
        FirstCommit,
        SecondCommit,
        FirstReveal,
        SecondReveal,
        Result
    }

    struct CommitChoice {
        address playerAddress;
        bytes32 hash;
        Choice choice;
    }

    modifier ownerOnly() {
        require(msg.sender == owner, "Only for owner");
        _;
    }

    modifier playersOnly() {
        require(
            msg.sender == players[0].playerAddress ||
            msg.sender == players[1].playerAddress,
            "Only for players"
        );
        _;
    }

    modifier atStage(Stages _stage) {
        require(stage == _stage, "Wrong stage");
        _;
    }

    modifier atNotStage(Stages _stage) {
        require(stage != _stage, "Wrong stage");
        _;
    }

    event Commit(address player);
    event Reveal(address player, Choice choice);
    event Result(address winner);

    CommitChoice[2] public players;
    Stages public stage = Stages.FirstCommit;

    constructor() {
        owner = msg.sender;
    }

    function commit(bytes32 _hash)
    external
    atNotStage(Stages.FirstReveal)
    atNotStage(Stages.SecondReveal)
    atNotStage(Stages.Result)
    {
        uint256 playerIndex;

        if (stage == Stages.FirstCommit) {
            playerIndex = 0;
        } else if (stage == Stages.SecondCommit) {
            playerIndex = 1;
        }

        players[playerIndex] = CommitChoice(msg.sender, _hash, Choice.None);

        emit Commit(msg.sender);

        if (stage == Stages.FirstCommit) {
            stage = Stages.SecondCommit;

        } else {
            stage = Stages.FirstReveal;
        }
    }

    function reveal(uint choiceOrder, bytes32 secret)
    external
    playersOnly
    atNotStage(Stages.FirstCommit)
    atNotStage(Stages.SecondCommit)
    atNotStage(Stages.Result)
    {
        Choice choice = Choice(choiceOrder);

        require(
            choice == Choice.Rock ||
            choice == Choice.Paper ||
            choice == Choice.Scissors,
            "invalid choice"
        );

        uint8 playerIndex;

        if (players[0].playerAddress == msg.sender) {
            playerIndex = 0;
        } else if (players[1].playerAddress == msg.sender) {
            playerIndex = 1;
        }

        CommitChoice storage commitChoice = players[playerIndex];

        require(
            keccak256(abi.encodePacked(msg.sender, choiceOrder, secret)) ==
            commitChoice.hash,
            "invalid hash"
        );

        commitChoice.choice = choice;

        emit Reveal(msg.sender, commitChoice.choice);

        if (stage == Stages.FirstReveal) {
            stage = Stages.SecondReveal;
        } else {
            stage = Stages.Result;
        }
    }

    function result() external playersOnly atStage(Stages.Result) {
        address winner;

        if (players[0].choice == Choice.Rock) {
            if (players[1].choice == Choice.Paper) {
                winner = players[1].playerAddress;
            } else if (players[1].choice == Choice.Scissors) {
                // Rock beats scissors
                winner = players[0].playerAddress;
            }
        } else if (players[0].choice == Choice.Paper) {
            if (players[1].choice == Choice.Rock) {
                // Paper beats rock
                winner = players[0].playerAddress;
            } else if (players[1].choice == Choice.Scissors) {
                // Paper loses to scissors
                winner = players[1].playerAddress;
            }
        } else if (players[0].choice == Choice.Scissors) {
            if (players[1].choice == Choice.Rock) {
                // Scissors lose to rock
                winner = players[1].playerAddress;
            } else if (players[1].choice == Choice.Paper) {
                // Scissors beats paper
                winner = players[0].playerAddress;
            }
        }

        reset();
        emit Result(winner);
    }

    function reset() internal {
        delete players;
        stage = Stages.FirstCommit;
    }

    function resetGame() external ownerOnly {
        reset();
    }
}
