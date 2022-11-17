// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

contract Player {
    address private gameContract;
    address private player;

    enum Choice {
        None,
        Rock,
        Paper,
        Scissors
    }

    modifier playerOnly() {
        require(msg.sender == player, "Only for player");
        _;
    }

    function setGameContract(address _contract) external {
        require(gameContract == address(0), "Game running");
        player = msg.sender;
        gameContract = _contract;
    }

    function commitCall(bytes32 _hash) external playerOnly {
        (bool success, ) = gameContract.call(
            abi.encodeWithSignature("commit(bytes32)", _hash)
        );
        require(success);
    }

    function revealCall(Choice _choice, bytes32 _secret) external playerOnly {
        (bool success, ) = gameContract.call(
            abi.encodeWithSignature("reveal(uint256,bytes32)", _choice, _secret)
        );
        require(success, "revealCall failed");
    }

    function resultCall() external playerOnly {
        (bool success, ) = gameContract.call(
            abi.encodeWithSignature("result()")
        );
        require(success);
        reset();
    }

    function reset() internal {
        delete player;
        delete gameContract;
    }
}
