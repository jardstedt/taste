/**
 * Wallet connection utilities for x402 payment in the MCP test client.
 * Supports MetaMask (browser wallet) and private key signers.
 */

import { createWalletClient, createPublicClient, custom, http, publicActions, type Address, type Hex } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { getUSDCBalance } from 'x402/shared/evm';

export type { Address } from 'viem';

export type WalletNetwork = 'base' | 'base-sepolia';

// x402's SignerWallet = Client with PublicActions & WalletActions
// We use `any` to satisfy the complex generic constraints from x402
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EvmSigner = any;

const chains = { base, 'base-sepolia': baseSepolia } as const;

const chainIds: Record<WalletNetwork, string> = {
  base: '0x2105',        // 8453
  'base-sepolia': '0x14a34', // 84532
};

export async function connectBrowserWallet(network: WalletNetwork): Promise<{
  signer: EvmSigner;
  address: Address;
}> {
  const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error('No browser wallet found. Install MetaMask.');

  // Request accounts
  const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[];
  if (!accounts.length) throw new Error('No accounts returned');
  const address = accounts[0] as Address;

  // Switch to correct network
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIds[network] }],
    });
  } catch (switchErr) {
    const err = switchErr as { code?: number };
    if (err.code === 4902) {
      throw new Error(`Please add the ${network} network to your wallet`);
    }
    throw switchErr;
  }

  const signer = createWalletClient({
    account: address,
    chain: chains[network],
    transport: custom(eth as Parameters<typeof custom>[0]),
  }).extend(publicActions) as EvmSigner;

  return { signer, address };
}

export async function connectPrivateKey(network: WalletNetwork, privateKey: string): Promise<{
  signer: EvmSigner;
  address: Address;
}> {
  // Dynamically import to avoid bundling private key utils unless needed
  const { privateKeyToAccount } = await import('viem/accounts');
  const hex = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex;
  let account;
  try {
    account = privateKeyToAccount(hex);
  } catch {
    throw new Error('Invalid private key format');
  }

  const signer = createWalletClient({
    account,
    chain: chains[network],
    transport: http(),
  }).extend(publicActions) as EvmSigner;

  return { signer, address: account.address };
}

export async function fetchUsdcBalance(network: WalletNetwork, address: Address): Promise<string> {
  const client = createPublicClient({
    chain: chains[network],
    transport: http(),
  });

  const raw = await getUSDCBalance(client, address);
  // USDC has 6 decimals
  return (Number(raw) / 1_000_000).toFixed(2);
}

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
