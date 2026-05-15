import { PublicKey } from "@solana/web3.js";

export const RISE_PROGRAM_ID = new PublicKey("RiseZSHaLdj7pfn1tisUoSdG2i3QcVz9sQKuaRG9rar");
export const MAYFLOWER_PROGRAM_ID = new PublicKey("AVMmmRzwc2kETQNhPiFVnyu62HrgsQXTD6D7SnSfEz7v");

export const RISE_PROGRAM_ID_DEVNET = new PublicKey("7gDn1L2Bmg53royeUgvZtWujfvxS9TmpchtBToP9zDhB");
export const MAYFLOWER_PROGRAM_ID_DEVNET = new PublicKey("MD2pPJCjpUT5ttJFUVeP2Xka1ZSvCJMZUoX4XTdPdet");

export const RISE_TENANT_MAINNET = new PublicKey("5scY2JGWLnBubCMbWrn1gi8FQEP8SPjvQ1hfjW4ktYUb");
export const RISE_TENANT_SEED_MAINNET = new PublicKey("Eg4Akr8HRv3gy4MaSp3zgKgC5qnN1V5ZTqAjhT54xJ9L");
export const MAYFLOWER_TENANT_MAINNET = new PublicKey("HeBDu9g5EN6qdDJWijHHpxYuMBE6aWvy1BmzFyEa7Q7C");
export const TEAM_WALLET = new PublicKey("7p9Wd66uwCdZdAm7EPMooXdghSB9yG4iKpT69ipmms8D");

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

export const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const USDC_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const API_BASE_MAINNET = "https://public.rise.rich";
export const API_BASE_DEVNET = "https://publicdev.rise.rich";

export type Network = "mainnet" | "devnet";

export function programIds(network: Network) {
  return network === "mainnet"
    ? { rise: RISE_PROGRAM_ID, mayflower: MAYFLOWER_PROGRAM_ID }
    : { rise: RISE_PROGRAM_ID_DEVNET, mayflower: MAYFLOWER_PROGRAM_ID_DEVNET };
}

export function apiBase(network: Network): string {
  return network === "mainnet" ? API_BASE_MAINNET : API_BASE_DEVNET;
}
