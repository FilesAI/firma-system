import { ethers } from "ethers";
import { XLAYER_RPC, USDT_ADDRESS } from "./config.js";
import { createLogger } from "./logger.js";
import { createOnchaiosSigner, OnchaiosSigner } from "./onchainos-signer.js";

const log = createLogger("Wallet");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(XLAYER_RPC);
}

/**
 * @deprecated Use getAgentSigner() instead — TEE manages all keys.
 */
export function getSigner(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey, getProvider());
}

/**
 * Create an OnchaiosSigner for the given agent wallet.
 * All signing is delegated to onchainos CLI → OKX TEE.
 */
export function getAgentSigner(
  accountId: string,
  walletAddress: string,
): OnchaiosSigner {
  return createOnchaiosSigner(accountId, walletAddress, getProvider());
}

export function getUsdtContract(
  signerOrProvider: ethers.Signer | ethers.Provider,
): ethers.Contract {
  return new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signerOrProvider);
}

export async function getOkbBalance(address: string): Promise<string> {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export async function getUsdtBalance(address: string): Promise<string> {
  const usdt = getUsdtContract(getProvider());
  const decimals = await usdt.decimals();
  const balance = await usdt.balanceOf(address);
  return ethers.formatUnits(balance, decimals);
}

export async function approveUsdt(
  signer: ethers.Signer,
  spender: string,
  amount: string,
): Promise<string> {
  const usdt = getUsdtContract(signer);
  const decimals = await usdt.decimals();
  const amountWei = ethers.parseUnits(amount, decimals);
  const tx = await usdt.approve(spender, amountWei);
  const receipt = await tx.wait();
  log.tx("USDT Approve", receipt.hash);
  return receipt.hash;
}

export async function transferUsdt(
  signer: ethers.Signer,
  to: string,
  amount: string,
): Promise<string> {
  const usdt = getUsdtContract(signer);
  const decimals = await usdt.decimals();
  const amountWei = ethers.parseUnits(amount, decimals);
  const tx = await usdt.transfer(to, amountWei);
  const receipt = await tx.wait();
  log.tx("USDT Transfer", receipt.hash);
  return receipt.hash;
}

export async function printWalletStatus(
  name: string,
  address: string,
): Promise<void> {
  const okb = await getOkbBalance(address);
  const usdt = await getUsdtBalance(address);
  log.info(`${name}: OKB=${okb}, USDT=${usdt}, addr=${address}`);
}
