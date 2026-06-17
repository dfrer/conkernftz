import fs from 'node:fs/promises';
import path from 'node:path';

// The Core Candy Machine SDK + mpl-core peer-depend on an older umi than the workspace's
// (umi 1.2). They load and run correctly at runtime (verified), but their *types* clash with
// umi 1.2, so all SDK access goes through lazy, widened-specifier imports (-> any) to keep the
// build green. The pure builders + merkle wrappers below are the unit-tested surface; the
// network operations require a funded devnet wallet to validate end-to-end.
const MPL_CORE_CM: string = '@metaplex-foundation/mpl-core-candy-machine';
const MPL_CORE: string = '@metaplex-foundation/mpl-core';
const UMI_BUNDLE: string = '@metaplex-foundation/umi-bundle-defaults';
const UMI: string = '@metaplex-foundation/umi';

// Minimal structural types for the lazily-imported SDKs (cast from `any` imports). They
// describe only the surface this module uses, keeping calls typed without importing the
// SDKs' umi-version-mismatched declarations.
interface UmiInstance {
  identity: unknown;
  eddsa: { createKeypairFromSecretKey(secret: Uint8Array): unknown };
  use(plugin: unknown): UmiInstance;
}
interface Confirmable {
  sendAndConfirm(umi: unknown): Promise<{ signature: Uint8Array }>;
}
interface UmiHelpers {
  some<T>(value: T): unknown;
  sol(amount: number): unknown;
  publicKey(address: string): unknown;
  dateTime(seconds: number): unknown;
  generateSigner(umi: unknown): { publicKey: { toString(): string } };
  keypairIdentity(signer: unknown): unknown;
  createSignerFromKeypair(umi: unknown, kp: unknown): unknown;
}
interface CmSdk {
  mplCandyMachine(): unknown;
  create(umi: unknown, input: unknown): Confirmable;
  addConfigLines(umi: unknown, input: unknown): Confirmable;
  mintV1(umi: unknown, input: unknown): Confirmable;
  getMerkleRoot(addresses: string[]): Uint8Array;
  getMerkleProof(addresses: string[], address: string): Uint8Array[];
}
interface CoreSdk {
  mplCore(): unknown;
  createCollection(umi: unknown, input: unknown): Confirmable;
}
interface UmiBundleSdk {
  createUmi(endpoint: string): UmiInstance;
}

// ---------------- Pure builders (no SDK; unit-tested) ----------------

export interface CandyItem {
  name: string;
  uri: string;
}

/** Build candy-machine config lines from uploaded metadata (name + JSON URI per token). */
export function buildConfigLines(items: CandyItem[]): CandyItem[] {
  return items.map((it, i) => {
    if (!it.uri) throw new Error(`Config line ${i} is missing a uri`);
    return { name: it.name, uri: it.uri };
  });
}

export interface GuardsConfig {
  solPayment?: { sol: number; destination: string };
  startDate?: { date: string | number };
  mintLimit?: { id: number; limit: number };
  allowList?: { addresses: string[] };
}

export interface ResolvedGuards {
  solPayment?: { sol: number; destination: string };
  startDate?: { unixSeconds: number };
  mintLimit?: { id: number; limit: number };
  allowList?: { addresses: string[] };
}

/** Normalize a guards config (e.g. parse start dates) into a plain, testable shape. */
export function resolveGuards(g: GuardsConfig): ResolvedGuards {
  const out: ResolvedGuards = {};
  if (g.solPayment) out.solPayment = { sol: g.solPayment.sol, destination: g.solPayment.destination };
  if (g.startDate) out.startDate = { unixSeconds: toUnixSeconds(g.startDate.date) };
  if (g.mintLimit) out.mintLimit = { id: g.mintLimit.id, limit: g.mintLimit.limit };
  if (g.allowList) out.allowList = { addresses: g.allowList.addresses };
  return out;
}

function toUnixSeconds(date: string | number): number {
  if (typeof date === 'number') return Math.floor(date);
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) throw new Error(`Invalid startDate: ${date}`);
  return Math.floor(ms / 1000);
}

/** Load an allowlist file (JSON array or newline/comma-separated addresses). */
export async function loadAllowlist(projectRoot: string, filePath: string): Promise<string[]> {
  const p = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
  const raw = (await fs.readFile(p, 'utf8')).trim();
  const list = raw.startsWith('[')
    ? (JSON.parse(raw) as unknown[]).map((x) => String(x))
    : raw.split(/[\r\n,]+/);
  return list.map((s) => s.trim()).filter((s) => s.length > 0);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex.replace(/^0x/, ''), 'hex'));
}

// ---------------- Merkle (allowList guard) — SDK-backed, runtime-tested ----------------

/** Compute the allowList merkle root using the candy-guard's exact hashing. */
export async function getAllowlistRoot(addresses: string[]): Promise<Uint8Array> {
  const cm = (await import(MPL_CORE_CM)) as CmSdk;
  return new Uint8Array(cm.getMerkleRoot(addresses));
}

/** Compute the merkle proof for one address (passed as the allowList mintArg). */
export async function getAllowlistProof(addresses: string[], address: string): Promise<Uint8Array[]> {
  const cm = (await import(MPL_CORE_CM)) as CmSdk;
  return cm.getMerkleProof(addresses, address).map((p) => new Uint8Array(p));
}

// ---------------- Network operations (lazy SDK; require devnet validation) ----------------

export interface CmWalletConfig {
  walletKeypairPath: string;
  rpcUrl?: string;
}

export interface CreateCandyMachineParams extends CmWalletConfig {
  collection: { name: string; uri: string };
  itemsAvailable: number;
  guards?: ResolvedGuards;
  nameLength?: number;
  uriLength?: number;
}

export interface CreateCandyMachineResult {
  candyMachine: string;
  collection: string;
}

interface UmiBundle {
  umi: UmiInstance;
  umiMod: UmiHelpers;
  cm: CmSdk;
  core: CoreSdk;
}

async function initUmi(cfg: CmWalletConfig): Promise<UmiBundle> {
  const bundle = (await import(UMI_BUNDLE)) as UmiBundleSdk;
  const umiMod = (await import(UMI)) as UmiHelpers;
  const cm = (await import(MPL_CORE_CM)) as CmSdk;
  const core = (await import(MPL_CORE)) as CoreSdk;
  const endpoint = cfg.rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const umi = bundle.createUmi(endpoint).use(cm.mplCandyMachine()).use(core.mplCore());
  const secret = JSON.parse(await fs.readFile(path.resolve(cfg.walletKeypairPath), 'utf8')) as number[];
  const kp = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secret));
  umi.use(umiMod.keypairIdentity(umiMod.createSignerFromKeypair(umi, kp)));
  return { umi, umiMod, cm, core };
}

function buildSdkGuards(umiMod: UmiHelpers, g: ResolvedGuards | undefined): Record<string, unknown> {
  const guards: Record<string, unknown> = {};
  if (!g) return guards;
  const some = umiMod.some;
  if (g.solPayment) {
    guards.solPayment = some({ lamports: umiMod.sol(g.solPayment.sol), destination: umiMod.publicKey(g.solPayment.destination) });
  }
  if (g.startDate) guards.startDate = some({ date: umiMod.dateTime(g.startDate.unixSeconds) });
  if (g.mintLimit) guards.mintLimit = some({ id: g.mintLimit.id, limit: g.mintLimit.limit });
  return guards;
}

/**
 * Create an MPL Core collection + Candy Machine with guards. Requires a funded wallet on the
 * target cluster. Validate on devnet before mainnet-beta.
 */
export async function createCandyMachine(params: CreateCandyMachineParams): Promise<CreateCandyMachineResult> {
  const { umi, umiMod, cm, core } = await initUmi(params);
  const collectionSigner = umiMod.generateSigner(umi) as { publicKey: { toString(): string } };
  await (
    core.createCollection(umi, {
      collection: collectionSigner,
      name: params.collection.name,
      uri: params.collection.uri,
    }) as { sendAndConfirm: (u: unknown) => Promise<unknown> }
  ).sendAndConfirm(umi);

  const candyMachineSigner = umiMod.generateSigner(umi) as { publicKey: { toString(): string } };
  const guards = buildSdkGuards(umiMod, params.guards);
  if (params.guards?.allowList) {
    const root = await getAllowlistRoot(params.guards.allowList.addresses);
    guards.allowList = umiMod.some({ merkleRoot: root });
  }
  await (
    cm.create(umi, {
      candyMachine: candyMachineSigner,
      collection: collectionSigner.publicKey,
      collectionUpdateAuthority: umi.identity,
      itemsAvailable: params.itemsAvailable,
      isMutable: true,
      configLineSettings: umiMod.some({
        prefixName: '',
        nameLength: params.nameLength ?? 32,
        prefixUri: '',
        uriLength: params.uriLength ?? 200,
        isSequential: false,
      }),
      guards,
    }) as { sendAndConfirm: (u: unknown) => Promise<unknown> }
  ).sendAndConfirm(umi);

  return { candyMachine: candyMachineSigner.publicKey.toString(), collection: collectionSigner.publicKey.toString() };
}

export interface InsertItemsParams extends CmWalletConfig {
  candyMachine: string;
  items: CandyItem[];
  batchSize?: number;
}

/** Insert config lines (token name/uri) into a candy machine in batches. */
export async function insertItems(params: InsertItemsParams): Promise<{ inserted: number }> {
  const { umi, umiMod, cm } = await initUmi(params);
  const lines = buildConfigLines(params.items);
  const batch = Math.max(1, params.batchSize ?? 10);
  const candyMachine = umiMod.publicKey(params.candyMachine);
  for (let i = 0; i < lines.length; i += batch) {
    const chunk = lines.slice(i, i + batch);
    await (
      cm.addConfigLines(umi, { candyMachine, index: i, configLines: chunk }) as {
        sendAndConfirm: (u: unknown) => Promise<unknown>;
      }
    ).sendAndConfirm(umi);
  }
  return { inserted: lines.length };
}

export interface CmMintParams extends CmWalletConfig {
  candyMachine: string;
  collection: string;
  /** Optional sol payment destination (required if the solPayment guard is set). */
  solPaymentDestination?: string;
}

/**
 * Mint one asset from a candy machine (public phase). Allowlist-gated mints additionally
 * require a `route` proof step; see docs. Requires a funded wallet — validate on devnet.
 */
export async function mintFromCandyMachine(params: CmMintParams): Promise<{ asset: string; signature: string }> {
  const { umi, umiMod, cm } = await initUmi(params);
  const asset = umiMod.generateSigner(umi) as { publicKey: { toString(): string } };
  const mintArgs: Record<string, unknown> = {};
  if (params.solPaymentDestination) {
    mintArgs.solPayment = umiMod.some({ destination: umiMod.publicKey(params.solPaymentDestination) });
  }
  const res = (await (
    cm.mintV1(umi, {
      candyMachine: umiMod.publicKey(params.candyMachine),
      asset,
      collection: umiMod.publicKey(params.collection),
      mintArgs,
    }) as { sendAndConfirm: (u: unknown) => Promise<{ signature: Uint8Array }> }
  ).sendAndConfirm(umi)) as { signature: Uint8Array };
  return { asset: asset.publicKey.toString(), signature: bytesToHex(res.signature) };
}
