// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

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
        bytes16 commitment;
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
            "Only for players. Firstly make commit"
        );
        _;
    }

    modifier atStage(Stages _stage) {
        require(stage == _stage);
        _;
    }

    event Commit(address player);
    event Reveal(address player, Choice choice);
    event Result(address winner);

    CommitChoice[2] public players;
    Stages private stage = Stages.FirstCommit;

    constructor() {
        owner = msg.sender;
    }

    function commit(bytes16 commitment)
    external
    atStage(Stages.FirstCommit)
    atStage(Stages.SecondCommit)
    {
        uint256 playerIndex;

        if (stage == Stages.FirstCommit) {
            playerIndex = 0;
        } else if (stage == Stages.SecondCommit) {
            playerIndex = 1;
        } else {
            revert("both players have already played");
        }

        players[playerIndex] = CommitChoice(
            msg.sender,
            commitment,
            Choice.None
        );

        emit Commit(msg.sender);

        if (stage == Stages.FirstCommit) {
            stage = Stages.SecondCommit;
        } else {
            stage = Stages.FirstReveal;
        }
    }

    function reveal(Choice choice, bytes32 blindingFactor)
    external
    playersOnly
    atStage(Stages.FirstReveal)
    atStage(Stages.SecondReveal)
    {
        require(
            choice == Choice.Rock ||
            choice == Choice.Paper ||
            choice == Choice.Scissors,
            "invalid choice"
        );

        uint256 playerIndex;
        if (players[0].playerAddress == msg.sender) {
            playerIndex = 0;
        } else if (players[1].playerAddress == msg.sender) {
            playerIndex = 1;
        }

        CommitChoice storage commitChoice = players[playerIndex];

        // Check the hash to ensure the commitment is correct
        require(
            keccak256(abi.encodePacked(msg.sender, choice, blindingFactor)) ==
            commitChoice.commitment,
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

        if (players[0].choice == Choice.None) {
            winner = players[1].playerAddress;
        } else if (players[1].choice == Choice.None) {
            winner = players[0].playerAddress;
        } else if (players[0].choice == Choice.Rock) {
            assert(
                players[1].choice == Choice.Paper ||
                players[1].choice == Choice.Scissors
            );
            if (players[1].choice == Choice.Paper) {
                winner = players[1].playerAddress;
            } else if (players[1].choice == Choice.Scissors) {
                // Rock beats scissors
                winner = players[0].playerAddress;
            }
        } else if (players[0].choice == Choice.Paper) {
            assert(
                players[1].choice == Choice.Rock ||
                players[1].choice == Choice.Scissors
            );
            if (players[1].choice == Choice.Rock) {
                // Paper beats rock
                winner = players[0].playerAddress;
            } else if (players[1].choice == Choice.Scissors) {
                // Paper loses to scissors
                winner = players[1].playerAddress;
            }
        } else if (players[0].choice == Choice.Scissors) {
            assert(
                players[1].choice == Choice.Paper ||
                players[1].choice == Choice.Rock
            );
            if (players[1].choice == Choice.Rock) {
                // Scissors lose to rock
                winner = players[1].playerAddress;
            } else if (players[1].choice == Choice.Paper) {
                // Scissors beats paper
                winner = players[0].playerAddress;
            }
        } else {
            revert("invalid choice");
        }

        emit Result(winner);

        reset();
    }

    function reset() internal {
        delete players;
        stage = Stages.FirstCommit;
    }

    function resetGame() external ownerOnly {
        reset();
    }
}
