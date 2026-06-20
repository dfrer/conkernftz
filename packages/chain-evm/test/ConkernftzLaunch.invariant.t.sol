// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ConkernftzLaunch} from "../contracts/ConkernftzLaunch.sol";

/// @dev Bounded actor harness for the invariant fuzzer. Exercises publicMint / ownerMint /
///      withdraw in the Public phase, tracking ghost sums the invariants check against contract
///      state. Each action self-bounds to valid ranges so the sequence makes real progress.
contract LaunchHandler is Test {
    ConkernftzLaunch public nft;
    address internal immutable ownerAddr;
    address internal constant TEAM = address(0xD00D);

    uint256 public ghostPublicMinted;
    uint256 public ghostOwnerMinted;
    uint256 public ghostPaid;
    uint256 public ghostWithdrawn;

    uint256 internal immutable publicPrice;
    uint256 internal immutable walletCap;
    uint256 internal immutable maxPerTx;
    address[] internal actors;

    constructor(ConkernftzLaunch _nft) {
        nft = _nft;
        ownerAddr = _nft.owner();
        publicPrice = _nft.publicPrice();
        walletCap = _nft.publicWalletCap();
        maxPerTx = _nft.maxPerTx();
        for (uint256 i = 0; i < 5; i++) {
            actors.push(address(uint160(uint256(0x1000) + i)));
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function publicMint(uint256 actorSeed, uint256 qty) external {
        address a = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 minted = nft.publicMinted(a);
        uint256 remainingCap = walletCap > minted ? walletCap - minted : 0;
        uint256 remainingSupply = nft.maxSupply() - nft.totalMinted();
        uint256 maxQ = _min(_min(remainingCap, remainingSupply), maxPerTx);
        if (maxQ == 0) return;
        qty = bound(qty, 1, maxQ);
        uint256 cost = publicPrice * qty;
        vm.deal(a, cost);
        vm.prank(a);
        nft.publicMint{value: cost}(qty);
        ghostPublicMinted += qty;
        ghostPaid += cost;
    }

    function ownerMint(uint256 qty) external {
        uint256 remainingSupply = nft.maxSupply() - nft.totalMinted();
        if (remainingSupply == 0) return;
        qty = bound(qty, 1, _min(remainingSupply, 10));
        vm.prank(ownerAddr);
        nft.ownerMint(TEAM, qty);
        ghostOwnerMinted += qty;
    }

    function withdraw() external {
        uint256 bal = address(nft).balance;
        if (bal == 0) return;
        vm.prank(ownerAddr);
        nft.withdraw();
        ghostWithdrawn += bal;
    }
}

contract ConkernftzLaunchInvariantTest is Test {
    ConkernftzLaunch internal nft;
    LaunchHandler internal handler;
    address internal treasury = address(0xBEEF);
    uint256 internal constant MAX_SUPPLY = 50;

    function setUp() public {
        nft = new ConkernftzLaunch(
            "Conker", "CONK", MAX_SUPPLY, "ipfs://ph", keccak256("p"), treasury, treasury, 500
        );
        nft.setPrices(0.01 ether, 0.02 ether);
        nft.setCaps(5, 5); // publicWalletCap=5, maxPerTx=5
        nft.setPhase(ConkernftzLaunch.Phase.Public);
        handler = new LaunchHandler(nft);
        targetContract(address(handler));
    }

    /// Invariant 1: supply never exceeds the cap.
    function invariant_SupplyWithinMax() public view {
        assertLe(nft.totalMinted(), nft.maxSupply());
    }

    /// Invariant 2: every minted token is attributable to exactly one path.
    function invariant_AccountingSum() public view {
        assertEq(handler.ghostPublicMinted() + handler.ghostOwnerMinted(), nft.totalMinted());
    }

    /// On-chain ownerMinted counter matches the ghost.
    function invariant_OwnerMintedTracks() public view {
        assertEq(nft.ownerMinted(), handler.ghostOwnerMinted());
    }

    /// Invariant 3: funds conservation — the contract holds exactly paid minus withdrawn.
    function invariant_FundsConservation() public view {
        assertEq(address(nft).balance, handler.ghostPaid() - handler.ghostWithdrawn());
    }
}
