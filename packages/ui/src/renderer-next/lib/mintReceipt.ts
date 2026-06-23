// Parse minted token ids out of a transaction receipt's logs (OC-3b). After a buyer mints, the
// live widget reads which token ids they got from the ERC-721 Transfer(from=0x0) events, then maps
// each to its rarity tier (the embedded tierMap) to drive the reveal. Pure + unit-tested — the only
// chain-dependent step (fetching the receipt) lives in the widget; this logic needs no chain.

/** keccak256("Transfer(address,address,uint256)") — the ERC-721/20 Transfer event topic0. */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000';

export interface RawLog {
  address: string;
  topics: string[];
}

/**
 * Token ids minted by `contract` in these logs — i.e. ERC-721 `Transfer` events whose `from` is the
 * zero address (a mint). ERC-721 indexes `tokenId` as the 3rd indexed topic, so a true ERC-721 mint
 * log has 4 topics; ERC-20 Transfers (3 topics, value in data) are ignored. Returns ascending,
 * de-duplicated ids.
 */
export function mintedTokenIds(logs: RawLog[], contract: string): number[] {
  const target = contract.toLowerCase();
  const ids = new Set<number>();
  for (const log of logs ?? []) {
    const topics = log?.topics ?? [];
    if ((log?.address ?? '').toLowerCase() !== target) continue;
    if ((topics[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue;
    if ((topics[1] ?? '') !== ZERO_TOPIC) continue; // from == 0x0 → mint
    const idTopic = topics[3]; // ERC-721 tokenId (indexed); absent for ERC-20
    if (!idTopic) continue;
    try {
      ids.add(Number(BigInt(idTopic)));
    } catch {
      /* skip malformed topic */
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** Map minted token ids → tier labels via the embedded edition→tier map ('' = common/default back). */
export function tiersForTokens(tokenIds: number[], tierMap: Record<number, string> | undefined): string[] {
  if (!tierMap) return tokenIds.map(() => '');
  return tokenIds.map((id) => tierMap[id] ?? '');
}
