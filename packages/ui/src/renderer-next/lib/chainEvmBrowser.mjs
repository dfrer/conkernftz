// Browser-only facade for the chain adapter. The package root also exports deployment helpers
// that read private-key files with node:fs; renderer/site builds must never traverse that branch.
export const LAUNCH_PHASES = ['closed', 'allowlist', 'public'];
export { dumpAllowlist } from '../../../../chain-evm/dist/merkle.js';
export { parseAllowlist } from '../../../../chain-evm/dist/allowlistFile.js';
export { explorerTxUrl, toAddEthereumChainParams } from '../../../../chain-evm/dist/chains.js';
export { planMint, buildMintCall } from '../../../../chain-evm/dist/mintPlan.js';
export { conkernftzLaunchAbi, conkernftzLaunchBytecode } from '../../../../chain-evm/dist/launch-artifact.js';
