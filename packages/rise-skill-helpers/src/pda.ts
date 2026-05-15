import { PublicKey } from "@solana/web3.js";
import {
  RISE_PROGRAM_ID,
  MAYFLOWER_PROGRAM_ID,
  RISE_PROGRAM_ID_DEVNET,
  MAYFLOWER_PROGRAM_ID_DEVNET,
  Network,
} from "./constants";

function programs(network: Network) {
  return network === "mainnet"
    ? { rise: RISE_PROGRAM_ID, mayflower: MAYFLOWER_PROGRAM_ID }
    : { rise: RISE_PROGRAM_ID_DEVNET, mayflower: MAYFLOWER_PROGRAM_ID_DEVNET };
}

function findPda(seeds: Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, programId)[0];
}

const enc = (s: string) => Buffer.from(s);

// --- Rise PDAs ---

export function riseTenant(seed: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("tenant"), seed.toBuffer()], programs(network).rise);
}

export function riseMarket(
  tenant: PublicKey,
  marketMeta: PublicKey,
  network: Network = "mainnet",
): PublicKey {
  return findPda([enc("market"), tenant.toBuffer(), marketMeta.toBuffer()], programs(network).rise);
}

export function personalAccount(
  riseMarketAddr: PublicKey,
  owner: PublicKey,
  network: Network = "mainnet",
): PublicKey {
  return findPda(
    [enc("personal_account"), riseMarketAddr.toBuffer(), owner.toBuffer()],
    programs(network).rise,
  );
}

export function cashEscrow(riseMarketAddr: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("cash_escrow"), riseMarketAddr.toBuffer()], programs(network).rise);
}

export function creatorEscrow(riseMarketAddr: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("creator_escrow"), riseMarketAddr.toBuffer()], programs(network).rise);
}

/**
 * Per `mint_main`, NOT per market. All markets sharing the same collateral mint
 * (e.g. all USDC-collateral markets) share one team escrow.
 */
export function teamEscrow(mintMain: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("team_escrow"), mintMain.toBuffer()], programs(network).rise);
}

export function teamConfig(network: Network = "mainnet"): PublicKey {
  return findPda([enc("team_config")], programs(network).rise);
}

// --- Mayflower PDAs ---

export function mayflowerTenant(seed: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("tenant"), seed.toBuffer()], programs(network).mayflower);
}

export function marketGroup(seed: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("market_group"), seed.toBuffer()], programs(network).mayflower);
}

export function mayflowerMarket(seed: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("market"), seed.toBuffer()], programs(network).mayflower);
}

export function marketMeta(seed: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("market_meta"), seed.toBuffer()], programs(network).mayflower);
}

/**
 * Mayflower `mint_options` PDA — appears in `initMarket`'s remaining accounts
 * and other Mayflower flows that touch the bonding curve's mint configuration.
 */
export function mintOptions(marketMetaAddr: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("mint_options"), marketMetaAddr.toBuffer()], programs(network).mayflower);
}

export function marketLinear(marketMetaAddr: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("market_linear"), marketMetaAddr.toBuffer()], programs(network).mayflower);
}

export function liqVaultMain(marketMetaAddr: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("liq_vault_main"), marketMetaAddr.toBuffer()], programs(network).mayflower);
}

export function revEscrowGroup(marketMetaAddr: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("rev_escrow_group"), marketMetaAddr.toBuffer()], programs(network).mayflower);
}

export function revEscrowTenant(marketMetaAddr: PublicKey, network: Network = "mainnet"): PublicKey {
  return findPda([enc("rev_escrow_tenant"), marketMetaAddr.toBuffer()], programs(network).mayflower);
}

export function personalPosition(
  marketMetaAddr: PublicKey,
  owner: PublicKey,
  network: Network = "mainnet",
): PublicKey {
  return findPda(
    [enc("personal_position"), marketMetaAddr.toBuffer(), owner.toBuffer()],
    programs(network).mayflower,
  );
}

export function personalPositionEscrow(
  personalPositionAddr: PublicKey,
  network: Network = "mainnet",
): PublicKey {
  return findPda(
    [enc("personal_position_escrow"), personalPositionAddr.toBuffer()],
    programs(network).mayflower,
  );
}

/** Mayflower's global log account. `mut` on every Mayflower op — potential bottleneck at scale. */
export function logAccount(network: Network = "mainnet"): PublicKey {
  return findPda([enc("log")], programs(network).mayflower);
}
