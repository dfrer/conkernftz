import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { keccak256, encodeAbiParameters, concatHex, getAddress, isAddress, type Hex } from 'viem';

/**
 * Allowlist Merkle tree — the security-critical JS↔Solidity boundary for `ConkernftzLaunch`.
 *
 * Leaf model (spec §3, decision A): each entry binds a minter address to the maximum quantity
 * that address may mint in the allowlist phase. The cap travels in the proof, so the contract
 * needs no per-address storage to enforce it.
 *
 * Encoding (MUST match the Solidity verification exactly — see `allowlistMint`):
 *   leaf = keccak256(bytes.concat(keccak256(abi.encode(address, uint256 maxQty))))
 * This is OpenZeppelin's `StandardMerkleTree` scheme: leaves are double-hashed and sibling
 * pairs are sorted, which makes forged/second-preimage proofs (an internal node replayed as a
 * leaf) infeasible. The `merkle.test.ts` cross-impl test recomputes the leaf with viem and
 * asserts it equals the tree's leaf hash, so any drift between the two implementations fails CI.
 */

/** ABI types of an allowlist leaf. MUST equal the Solidity `abi.encode(address, uint256)`. */
export const ALLOWLIST_LEAF_ENCODING = ['address', 'uint256'] as const;

/** Tag identifying the on-disk dump format, so loaders can reject mismatched encodings. */
export const ALLOWLIST_FORMAT = 'conkernftz-allowlist/standard-v1' as const;

export interface AllowlistEntry {
  /** Minter address (any case; normalized to a checksum address internally). */
  address: string;
  /** Max tokens this address may mint in the allowlist phase. Integer >= 1. */
  maxQty: number;
}

export interface AllowlistProof {
  /** Checksummed minter address. */
  address: Hex;
  /** The per-address cap that is bound into the leaf (passed to `allowlistMint`). */
  maxQty: number;
  /** Merkle proof verifying `(address, maxQty)` against the root. */
  proof: Hex[];
}

/** Serializable allowlist artifact: the root plus a ready-to-use proof for every entry. */
export interface AllowlistDump {
  format: typeof ALLOWLIST_FORMAT;
  root: Hex;
  /** Total addresses on the list (convenience for tooling / sanity checks). */
  count: number;
  entries: AllowlistProof[];
}

/** A tree value as OZ expects it: a `[address, maxQty]` tuple with the qty as a decimal string. */
type LeafValue = [Hex, string];

/**
 * Validate and normalize raw entries into the tuple form the tree consumes. Throws on a bad
 * address, a non-integer or < 1 quantity, or a duplicate address (case-insensitive) — these are
 * configuration errors that would silently lock real minters out, so they fail loudly here.
 */
function normalize(entries: AllowlistEntry[]): LeafValue[] {
  if (entries.length === 0) throw new Error('allowlist is empty');
  const seen = new Set<string>();
  return entries.map(({ address, maxQty }, i) => {
    if (!isAddress(address)) throw new Error(`entry ${i}: invalid address ${address}`);
    if (!Number.isInteger(maxQty) || maxQty < 1) {
      throw new Error(`entry ${i} (${address}): maxQty must be an integer >= 1, got ${maxQty}`);
    }
    const checksummed = getAddress(address);
    const key = checksummed.toLowerCase();
    if (seen.has(key)) throw new Error(`duplicate address in allowlist: ${checksummed}`);
    seen.add(key);
    return [checksummed, String(maxQty)];
  });
}

/** Build the OZ StandardMerkleTree for an allowlist. */
export function buildAllowlistTree(entries: AllowlistEntry[]): StandardMerkleTree<LeafValue> {
  return StandardMerkleTree.of(normalize(entries), [...ALLOWLIST_LEAF_ENCODING]);
}

/** The Merkle root to set on-chain via `setAllowlistRoot`. */
export function allowlistRoot(entries: AllowlistEntry[]): Hex {
  return buildAllowlistTree(entries).root as Hex;
}

/**
 * Recompute a leaf hash with viem, exactly mirroring the contract's
 * `keccak256(bytes.concat(keccak256(abi.encode(address, allowedQty))))`. Used by the cross-impl
 * test to guarantee the two implementations never drift (threat T13).
 */
export function leafHash(address: string, maxQty: number): Hex {
  const inner = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [getAddress(address), BigInt(maxQty)],
    ),
  );
  return keccak256(concatHex([inner]));
}

/** Build the full serializable dump (root + a proof per entry) for the CLI / UI to consume. */
export function dumpAllowlist(entries: AllowlistEntry[]): AllowlistDump {
  const tree = buildAllowlistTree(entries);
  const proofs: AllowlistProof[] = [];
  for (const [i, value] of tree.entries()) {
    proofs.push({
      address: value[0],
      maxQty: Number(value[1]),
      proof: tree.getProof(i) as Hex[],
    });
  }
  return { format: ALLOWLIST_FORMAT, root: tree.root as Hex, count: proofs.length, entries: proofs };
}

/**
 * Look up the proof for a single address (e.g. the connected wallet in the mint UI). Returns
 * `null` if the address is not on the list. Case-insensitive on the address.
 */
export function proofForAddress(entries: AllowlistEntry[], address: string): AllowlistProof | null {
  if (!isAddress(address)) return null;
  const target = getAddress(address).toLowerCase();
  const tree = buildAllowlistTree(entries);
  for (const [i, value] of tree.entries()) {
    if (value[0].toLowerCase() === target) {
      return { address: value[0], maxQty: Number(value[1]), proof: tree.getProof(i) as Hex[] };
    }
  }
  return null;
}

/**
 * Verify a proof off-chain (mirror of the on-chain check) — useful for previewing eligibility in
 * the UI before spending gas, and for the round-trip test.
 */
export function verifyAllowlistProof(
  root: Hex,
  address: string,
  maxQty: number,
  proof: Hex[],
): boolean {
  if (!isAddress(address)) return false;
  return StandardMerkleTree.verify(
    root,
    [...ALLOWLIST_LEAF_ENCODING],
    [getAddress(address), String(maxQty)],
    proof,
  );
}
