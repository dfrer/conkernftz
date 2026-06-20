// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721A} from "erc721a/contracts/ERC721A.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ConkernftzLaunch — phased public mint (allowlist → fixed-price public → reveal)
/// @notice Launch-grade companion to `ConkernftzCollection`. Immutable, non-upgradeable,
///         fixed-supply art mint built only from audited primitives. See
///         `docs/EVM_LAUNCH_SPEC.md` for the design, invariants, and threat model this
///         implements. THIS CONTRACT IS AUDIT-GATED: testnet-first, external audit before any
///         mainnet deploy.
/// @dev Token ids are 1-indexed (`_startTokenId() == 1`) to match `ConkernftzCollection` and the
///      metadata upload pipeline, where token N lives at `<baseURI>N.json`.
contract ConkernftzLaunch is ERC721A, ERC2981, Ownable2Step, ReentrancyGuard, Pausable {
    /// @dev Closed (default) blocks all public mints; Allowlist and Public open the two phases.
    enum Phase {
        Closed,
        Allowlist,
        Public
    }

    // --- Immutable launch parameters ---
    uint256 public immutable maxSupply;
    /// @notice Hash committed at construction (concatenated asset/DNA hash) for fair-mint proof.
    bytes32 public immutable provenanceHash;

    // --- Sale configuration (owner-set; frozen once Public opens) ---
    Phase public phase = Phase.Closed;
    uint256 public allowlistPrice; // wei per token in the allowlist phase
    uint256 public publicPrice; // wei per token in the public phase
    uint256 public publicWalletCap; // max tokens any one wallet may mint in the public phase
    uint96 public maxPerTx; // anti-griefing per-transaction batch ceiling (both phases)
    bytes32 public allowlistRoot; // root over (address, maxQty) leaves; cap travels in the proof

    /// @notice Once the phase first advances to Public, prices/caps/root are frozen (decision §9.5).
    bool public configLocked;

    // --- Mint accounting (for invariants & per-wallet caps) ---
    mapping(address => uint256) public allowlistMinted;
    mapping(address => uint256) public publicMinted;
    uint256 public ownerMinted;

    // --- Metadata / reveal ---
    string private placeholderURI;
    string private revealedBaseURI;
    bool public revealed;
    bool public metadataFrozen;

    // --- Proceeds ---
    address public treasury;

    event PhaseChanged(Phase indexed phase);
    event PricesSet(uint256 allowlistPrice, uint256 publicPrice);
    event CapsSet(uint256 publicWalletCap, uint96 maxPerTx);
    event AllowlistRootSet(bytes32 root);
    event TreasurySet(address indexed treasury);
    event Revealed(string baseURI);
    event MetadataFrozen();
    event Withdrawn(address indexed to, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        string memory placeholderURI_,
        bytes32 provenanceHash_,
        address treasury_,
        address royaltyReceiver_,
        uint96 royaltyFeeBps_
    ) ERC721A(name_, symbol_) Ownable(msg.sender) {
        require(maxSupply_ > 0, "maxSupply=0");
        require(treasury_ != address(0), "treasury=0");
        maxSupply = maxSupply_;
        provenanceHash = provenanceHash_;
        placeholderURI = placeholderURI_;
        treasury = treasury_;
        if (royaltyReceiver_ != address(0)) {
            _setDefaultRoyalty(royaltyReceiver_, royaltyFeeBps_);
        }
    }

    // 1-indexed token ids, matching ConkernftzCollection + the metadata directory.
    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    // --- Minting (checks-effects-interactions; nonReentrant; pausable) ---

    /// @notice Mint during the allowlist phase. `allowedQty` is the caller's per-address cap,
    ///         bound into the Merkle leaf; the proof both proves membership and the cap.
    function allowlistMint(uint256 qty, uint256 allowedQty, bytes32[] calldata proof)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(phase == Phase.Allowlist, "allowlist closed");
        require(qty > 0 && qty <= maxPerTx, "bad qty");
        // Leaf MUST match merkle.ts: keccak256(bytes.concat(keccak256(abi.encode(addr, allowedQty)))).
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, allowedQty))));
        require(MerkleProof.verifyCalldata(proof, allowlistRoot, leaf), "bad proof");
        require(allowlistMinted[msg.sender] + qty <= allowedQty, "over allowlist cap");
        require(_totalMinted() + qty <= maxSupply, "over supply");
        require(msg.value == allowlistPrice * qty, "wrong value");

        allowlistMinted[msg.sender] += qty; // effects before interaction
        _mint(msg.sender, qty);
    }

    /// @notice Mint during the public phase, within the per-wallet cap.
    function publicMint(uint256 qty) external payable whenNotPaused nonReentrant {
        require(phase == Phase.Public, "public closed");
        require(qty > 0 && qty <= maxPerTx, "bad qty");
        require(publicMinted[msg.sender] + qty <= publicWalletCap, "over wallet cap");
        require(_totalMinted() + qty <= maxSupply, "over supply");
        require(msg.value == publicPrice * qty, "wrong value");

        publicMinted[msg.sender] += qty; // effects before interaction
        _mint(msg.sender, qty);
    }

    /// @notice Team/treasury mint. Owner only, no payment, callable in any phase.
    function ownerMint(address to, uint256 qty) external onlyOwner {
        require(to != address(0), "to=0");
        require(qty > 0, "qty=0");
        require(_totalMinted() + qty <= maxSupply, "over supply");
        ownerMinted += qty;
        _mint(to, qty);
    }

    // --- Admin (onlyOwner) ---

    function setPhase(Phase newPhase) external onlyOwner {
        phase = newPhase;
        if (newPhase == Phase.Public) {
            configLocked = true; // freeze prices/caps/root once public opens (one-way)
        }
        emit PhaseChanged(newPhase);
    }

    function setPrices(uint256 allowlistPrice_, uint256 publicPrice_) external onlyOwner {
        require(!configLocked, "config locked");
        allowlistPrice = allowlistPrice_;
        publicPrice = publicPrice_;
        emit PricesSet(allowlistPrice_, publicPrice_);
    }

    function setCaps(uint256 publicWalletCap_, uint96 maxPerTx_) external onlyOwner {
        require(!configLocked, "config locked");
        require(maxPerTx_ > 0, "maxPerTx=0");
        publicWalletCap = publicWalletCap_;
        maxPerTx = maxPerTx_;
        emit CapsSet(publicWalletCap_, maxPerTx_);
    }

    function setAllowlistRoot(bytes32 root) external onlyOwner {
        require(!configLocked, "config locked");
        allowlistRoot = root;
        emit AllowlistRootSet(root);
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "treasury=0");
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setDefaultRoyalty(address receiver, uint96 feeBps) external onlyOwner {
        _setDefaultRoyalty(receiver, feeBps);
    }

    /// @notice Set the revealed metadata base URI. Blocked once metadata is frozen.
    function reveal(string calldata baseURI) external onlyOwner {
        require(!metadataFrozen, "metadata frozen");
        revealedBaseURI = baseURI;
        revealed = true;
        emit Revealed(baseURI);
    }

    /// @notice Permanently lock metadata — no further reveal/baseURI changes. One-way.
    function freezeMetadata() external onlyOwner {
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    /// @notice Pull all proceeds to the treasury (a Safe multisig). nonReentrant; reverts on
    ///         zero balance or a failed transfer.
    function withdraw() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "nothing to withdraw");
        address to = treasury;
        require(to != address(0), "treasury=0");
        (bool ok, ) = payable(to).call{value: bal}("");
        require(ok, "withdraw failed");
        emit Withdrawn(to, bal);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Views ---

    /// @notice Pre-reveal returns the shared placeholder; post-reveal returns `<baseURI>id.json`.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        return revealed ? string.concat(revealedBaseURI, _toString(tokenId), ".json") : placeholderURI;
    }

    /// @notice Total tokens minted so far (never decreases; ERC721A has no burn here).
    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721A, ERC2981)
        returns (bool)
    {
        return ERC721A.supportsInterface(interfaceId) || ERC2981.supportsInterface(interfaceId);
    }
}
