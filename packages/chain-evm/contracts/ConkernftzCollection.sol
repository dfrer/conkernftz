// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Conkernftz generative collection
/// @notice Minimal, audited-primitive ERC-721 with a settable baseURI, sequential owner
///         minting, and ERC-2981 royalties. Designed to pair with a metadata directory
///         uploaded to IPFS where token N lives at `<baseURI>N.json`.
contract ConkernftzCollection is ERC721, ERC2981, Ownable {
    using Strings for uint256;

    uint256 public nextTokenId = 1;
    uint256 public immutable maxSupply; // 0 = unlimited
    string private baseTokenURI;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        uint256 maxSupply_,
        address royaltyReceiver_,
        uint96 royaltyFeeBps_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        baseTokenURI = baseURI_;
        maxSupply = maxSupply_;
        if (royaltyReceiver_ != address(0)) {
            _setDefaultRoyalty(royaltyReceiver_, royaltyFeeBps_);
        }
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        baseTokenURI = baseURI_;
    }

    /// @notice tokenURI is `<baseURI><tokenId>.json` to match the uploaded metadata directory.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory base = _baseURI();
        return bytes(base).length > 0 ? string.concat(base, tokenId.toString(), ".json") : "";
    }

    /// @notice Mint `quantity` sequential tokens to `to`. Owner only (team/treasury mint).
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        require(quantity > 0, "quantity=0");
        require(maxSupply == 0 || nextTokenId - 1 + quantity <= maxSupply, "exceeds maxSupply");
        for (uint256 i = 0; i < quantity; i++) {
            _safeMint(to, nextTokenId);
            unchecked {
                nextTokenId++;
            }
        }
    }

    function totalSupply() external view returns (uint256) {
        return nextTokenId - 1;
    }

    function setDefaultRoyalty(address receiver, uint96 feeBps) external onlyOwner {
        _setDefaultRoyalty(receiver, feeBps);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
