// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ConkernftzLaunch} from "../contracts/ConkernftzLaunch.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC721A} from "erc721a/contracts/IERC721A.sol";

/// @dev Unit + fuzz coverage for ConkernftzLaunch. The allowlist root and proofs below are
///      generated off-chain by the SAME OpenZeppelin StandardMerkleTree library `src/merkle.ts`
///      uses (see test "allowlistMint accepts a JS-generated proof"), so this suite proves the
///      JS↔Solidity leaf encoding agrees end-to-end (threat T13).
contract ConkernftzLaunchTest is Test {
    ConkernftzLaunch internal nft;

    address internal treasury = address(0xBEEF);
    address internal royalty = address(0xBEEF);

    // Allowlist fixture (addresses chosen to avoid the 0x01..0x09 precompiles).
    address internal alice = address(0xA1); // cap 3
    address internal bob = address(0xB2); // cap 1
    address internal carol = address(0xC3); // cap 5
    bytes32 internal constant ROOT =
        0xeb323ab49623ac36b9684cae7ac5b19f2f5f3462d88a076380b14f3bd6e442ac;

    uint256 internal constant MAX_SUPPLY = 100;
    uint256 internal constant ALLOWLIST_PRICE = 0.01 ether;
    uint256 internal constant PUBLIC_PRICE = 0.02 ether;
    uint256 internal constant PUBLIC_WALLET_CAP = 2;
    uint96 internal constant MAX_PER_TX = 5;

    function setUp() public {
        nft = new ConkernftzLaunch(
            "Conker Launch",
            "CONK",
            MAX_SUPPLY,
            "ipfs://placeholder",
            keccak256("provenance"),
            treasury,
            royalty,
            500 // 5%
        );
        nft.setPrices(ALLOWLIST_PRICE, PUBLIC_PRICE);
        nft.setCaps(PUBLIC_WALLET_CAP, MAX_PER_TX);
        nft.setAllowlistRoot(ROOT);
    }

    function _aliceProof() internal pure returns (bytes32[] memory p) {
        p = new bytes32[](2);
        p[0] = 0x05f62f893c44a1ad8fc03fe90a37f272a067bf038bc86693b4c3bc05dc908be5;
        p[1] = 0xc5dcb44fb37a0dbde26c4af0aea3569eeb1d25720a0707f5e7ae3224a67bab0f;
    }

    function _carolProof() internal pure returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = 0x6bb24759d3f7c94ecebf988ac37bd87f37ecca7550eec486254d4ed1ab3d23f6;
    }

    // --- Construction / initial state ---

    function test_InitialState() public view {
        assertEq(nft.maxSupply(), MAX_SUPPLY);
        assertEq(uint8(nft.phase()), uint8(ConkernftzLaunch.Phase.Closed));
        assertEq(nft.treasury(), treasury);
        assertEq(nft.provenanceHash(), keccak256("provenance"));
        assertEq(nft.owner(), address(this));
        assertEq(nft.totalMinted(), 0);
        assertFalse(nft.revealed());
    }

    function test_Constructor_RevertZeroSupply() public {
        vm.expectRevert(bytes("maxSupply=0"));
        new ConkernftzLaunch("n", "s", 0, "", bytes32(0), treasury, royalty, 0);
    }

    function test_Constructor_RevertZeroTreasury() public {
        vm.expectRevert(bytes("treasury=0"));
        new ConkernftzLaunch("n", "s", 1, "", bytes32(0), address(0), royalty, 0);
    }

    // --- ownerMint ---

    function test_OwnerMint() public {
        nft.ownerMint(alice, 2);
        assertEq(nft.balanceOf(alice), 2);
        assertEq(nft.totalMinted(), 2);
        assertEq(nft.ownerMinted(), 2);
        assertEq(nft.ownerOf(1), alice); // 1-indexed
    }

    function test_OwnerMint_RevertNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.ownerMint(alice, 1);
    }

    function test_OwnerMint_RevertOverSupply() public {
        vm.expectRevert(bytes("over supply"));
        nft.ownerMint(alice, MAX_SUPPLY + 1);
    }

    // --- allowlistMint ---

    function test_AllowlistMint_AcceptsJsGeneratedProof() public {
        nft.setPhase(ConkernftzLaunch.Phase.Allowlist);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        nft.allowlistMint{value: ALLOWLIST_PRICE * 2}(2, 3, _aliceProof());
        assertEq(nft.balanceOf(alice), 2);
        assertEq(nft.allowlistMinted(alice), 2);
    }

    function test_AllowlistMint_EnforcesPerAddressCap() public {
        nft.setPhase(ConkernftzLaunch.Phase.Allowlist);
        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        nft.allowlistMint{value: ALLOWLIST_PRICE * 3}(3, 3, _aliceProof()); // hits cap exactly
        vm.expectRevert(bytes("over allowlist cap"));
        nft.allowlistMint{value: ALLOWLIST_PRICE}(1, 3, _aliceProof());
        vm.stopPrank();
    }

    function test_AllowlistMint_RevertWrongPhase() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(bytes("allowlist closed"));
        nft.allowlistMint{value: ALLOWLIST_PRICE}(1, 3, _aliceProof());
    }

    function test_AllowlistMint_RevertForgedAllowedQty() public {
        nft.setPhase(ConkernftzLaunch.Phase.Allowlist);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        // Claiming a higher cap than the leaf was built with breaks the proof.
        vm.expectRevert(bytes("bad proof"));
        nft.allowlistMint{value: ALLOWLIST_PRICE}(1, 99, _aliceProof());
    }

    function test_AllowlistMint_RevertProofReuseByOther() public {
        nft.setPhase(ConkernftzLaunch.Phase.Allowlist);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        // bob cannot mint with alice's proof — the leaf binds msg.sender.
        vm.expectRevert(bytes("bad proof"));
        nft.allowlistMint{value: ALLOWLIST_PRICE}(1, 3, _aliceProof());
    }

    function test_AllowlistMint_RevertWrongValue() public {
        nft.setPhase(ConkernftzLaunch.Phase.Allowlist);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(bytes("wrong value"));
        nft.allowlistMint{value: ALLOWLIST_PRICE - 1}(1, 3, _aliceProof());
    }

    function test_AllowlistMint_RevertBadQty() public {
        nft.setPhase(ConkernftzLaunch.Phase.Allowlist);
        vm.deal(alice, 1 ether);
        vm.startPrank(alice);
        vm.expectRevert(bytes("bad qty"));
        nft.allowlistMint{value: 0}(0, 3, _aliceProof());
        vm.expectRevert(bytes("bad qty"));
        nft.allowlistMint{value: ALLOWLIST_PRICE * 6}(6, 3, _aliceProof()); // > maxPerTx
        vm.stopPrank();
    }

    // --- publicMint ---

    function test_PublicMint_Happy() public {
        nft.setPhase(ConkernftzLaunch.Phase.Public);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        nft.publicMint{value: PUBLIC_PRICE * 2}(2);
        assertEq(nft.balanceOf(bob), 2);
        assertEq(nft.publicMinted(bob), 2);
    }

    function test_PublicMint_RevertWrongPhase() public {
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(bytes("public closed"));
        nft.publicMint{value: PUBLIC_PRICE}(1);
    }

    function test_PublicMint_RevertOverWalletCap() public {
        nft.setPhase(ConkernftzLaunch.Phase.Public);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(bytes("over wallet cap"));
        nft.publicMint{value: PUBLIC_PRICE * 3}(3); // cap is 2
    }

    function test_PublicMint_RevertWrongValue() public {
        nft.setPhase(ConkernftzLaunch.Phase.Public);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(bytes("wrong value"));
        nft.publicMint{value: PUBLIC_PRICE + 1}(1);
    }

    // --- config locking ---

    function test_ConfigLocksOnPublic() public {
        nft.setPhase(ConkernftzLaunch.Phase.Public);
        assertTrue(nft.configLocked());
        vm.expectRevert(bytes("config locked"));
        nft.setPrices(1, 2);
        vm.expectRevert(bytes("config locked"));
        nft.setCaps(1, 1);
        vm.expectRevert(bytes("config locked"));
        nft.setAllowlistRoot(bytes32(uint256(1)));
    }

    // --- reveal / metadata ---

    function test_RevealAndTokenURI() public {
        nft.ownerMint(alice, 1);
        assertEq(nft.tokenURI(1), "ipfs://placeholder");
        nft.reveal("ipfs://base/");
        assertTrue(nft.revealed());
        assertEq(nft.tokenURI(1), "ipfs://base/1.json");
    }

    function test_TokenURI_RevertNonexistent() public {
        vm.expectRevert(IERC721A.URIQueryForNonexistentToken.selector);
        nft.tokenURI(999);
    }

    function test_FreezeMetadata_BlocksReveal() public {
        nft.freezeMetadata();
        assertTrue(nft.metadataFrozen());
        vm.expectRevert(bytes("metadata frozen"));
        nft.reveal("ipfs://base/");
    }

    // --- withdraw ---

    function test_Withdraw_PullsToTreasury() public {
        nft.setPhase(ConkernftzLaunch.Phase.Public);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        nft.publicMint{value: PUBLIC_PRICE * 2}(2);

        uint256 before = treasury.balance;
        nft.withdraw();
        assertEq(treasury.balance, before + PUBLIC_PRICE * 2);
        assertEq(address(nft).balance, 0);

        vm.expectRevert(bytes("nothing to withdraw"));
        nft.withdraw();
    }

    function test_Withdraw_RevertNonOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.withdraw();
    }

    // --- pause ---

    function test_Pause_BlocksMint() public {
        nft.setPhase(ConkernftzLaunch.Phase.Public);
        nft.pause();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        nft.publicMint{value: PUBLIC_PRICE}(1);
        nft.unpause();
        vm.prank(bob);
        nft.publicMint{value: PUBLIC_PRICE}(1);
        assertEq(nft.balanceOf(bob), 1);
    }

    // --- ownership (two-step) ---

    function test_TwoStepOwnership() public {
        address newOwner = makeAddr("newOwner");
        nft.transferOwnership(newOwner);
        assertEq(nft.owner(), address(this)); // not yet
        assertEq(nft.pendingOwner(), newOwner);
        vm.prank(newOwner);
        nft.acceptOwnership();
        assertEq(nft.owner(), newOwner);
    }

    // --- royalties / interfaces ---

    function test_RoyaltyInfo() public view {
        (address recv, uint256 amount) = nft.royaltyInfo(1, 10_000);
        assertEq(recv, royalty);
        assertEq(amount, 500); // 5% of 10000
    }

    function test_SupportsInterfaces() public view {
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC165
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC721
        assertTrue(nft.supportsInterface(0x2a55205a)); // ERC2981
    }

    // --- fuzz ---

    function testFuzz_PublicMint_ExactValueOnly(uint256 value) public {
        nft.setPhase(ConkernftzLaunch.Phase.Public);
        vm.assume(value <= 100 ether);
        vm.deal(bob, 200 ether);
        vm.prank(bob);
        if (value == PUBLIC_PRICE) {
            nft.publicMint{value: value}(1);
            assertEq(nft.balanceOf(bob), 1);
        } else {
            vm.expectRevert(bytes("wrong value"));
            nft.publicMint{value: value}(1);
        }
    }

    function testFuzz_AllowlistMint_WithinCap(uint256 qty) public {
        nft.setPhase(ConkernftzLaunch.Phase.Allowlist);
        qty = bound(qty, 1, 3); // alice's cap
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        nft.allowlistMint{value: ALLOWLIST_PRICE * qty}(qty, 3, _aliceProof());
        assertEq(nft.allowlistMinted(alice), qty);
        assertLe(nft.totalMinted(), MAX_SUPPLY);
    }

    function testFuzz_OwnerMint_NeverExceedsSupply(uint256 qty) public {
        qty = bound(qty, 1, MAX_SUPPLY * 2);
        if (qty > MAX_SUPPLY) {
            vm.expectRevert(bytes("over supply"));
            nft.ownerMint(alice, qty);
        } else {
            nft.ownerMint(alice, qty);
            assertEq(nft.totalMinted(), qty);
            assertLe(nft.totalMinted(), MAX_SUPPLY);
        }
    }
}
