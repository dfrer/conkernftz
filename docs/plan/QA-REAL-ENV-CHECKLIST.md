# QA — owner real-environment checklist (QA-FINAL)

> Things the agent **cannot** verify itself — they need the real desktop app + real credentials,
> live networks, money, or the owner's wallet/keys. The agent drove every one of these **as far as
> the UI allows** (against the mock) with no runtime errors; this list is what remains for the owner
> to run once and confirm. Nothing here is a known bug — it's unverifiable-by-agent by nature
> (non-custodial, audit-gated, owner-holds-keys). Check off as you go.

## Run the app
```
pnpm -C packages/ui start
```

## Storage / publish (real uploads)
- [ ] **Pinata (IPFS)** upload — Settings → provider `pinata` + JWT; Publish → Upload assets. Confirm a real CID + the `baseURI` written to `.upload-manifest.json` and shown in the Readiness strip.
- [ ] **Irys (Arweave)** upload — provider `irys` + key; Publish → Upload assets. Confirm the gateway URL.

## On-chain (testnet only — never mainnet without an audit)
- [ ] **EVM Launch deploy** (Base Sepolia) via **Deployer key file** — Launch → Preflight → Deploy; confirm the contract address is saved back to the project.
- [ ] **EVM Launch deploy via WalletConnect** — Launch → Connect wallet (scan with a phone wallet) → Deploy/admin tx signs in your wallet (non-custodial; no key file).
- [ ] **Browser MetaMask console** — Launch → "Sign in browser (MetaMask extension)"; confirm the console opens and a tx signs via the extension.
- [ ] **Sale ops** — set caps/prices, open allowlist phase (upload an allowlist CSV → Merkle root set + proofs embedded), advance to public, reveal (point `tokenURI` at uploaded metadata), freeze, withdraw to treasury.
- [ ] **Owner mint** — Publish → Owner mint a few editions; confirm tokens appear.
- [ ] **Solana** — Candy Machine create/upload/mint on devnet (Publish → Candy: …).

## Mint experience + site (real output)
- [ ] **Mint FX reveal motion** — watch the pack-rip reveal play in real time (timing/easing only judgeable live); confirm it feels right with your hero art.
- [ ] **Generate + Preview site locally** — Site → Generate site → Preview locally; confirm the static bundle renders and the mint widget works against the deployed testnet contract.
- [ ] **Deploy site** to each host you use — Vercel / Netlify / GitHub Pages / IPFS / Arweave; confirm the live URL + custom domain.

## Fal AI (owner's key — do NOT mass-generate)
- [ ] **fal.ai generation** — Fal AI → paste your key → generate one image/video; confirm it saves into the project's `fal/` folder. (Rotate the key after supervised use.)

## Native / OS integration
- [ ] **Native pickers** — New project "Choose folder", image uploads (Site wallpaper/Image widget), "Open project folder / build folder" buttons open the OS file manager.
- [ ] **Window chrome** — resize, min/max, the frameless/native title bar behave correctly on your OS.

## Sign-off
- [ ] All of the above behave correctly end-to-end → the QA sweep's real-environment portion is confirmed.
