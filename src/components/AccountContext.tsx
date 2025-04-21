import { Wallet } from "@near-wallet-selector/core";
import { Account } from "near-api-js";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { EVMWalletAdapter, SolanaWalletAdapter, WalletOptions } from "../types";

interface AccountContextType {
  wallet?: Wallet;
  account?: Account;
  accountId: string | null;
  evmWallet?: EVMWalletAdapter;
  evmAddress?: string;
  chainId?: number;
  solanaWallet?: SolanaWalletAdapter;
  solanaAddress?: string;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

interface AccountProviderProps {
  children: ReactNode;
  wallet?: WalletOptions;
}

export function AccountProvider({
  children,
  wallet: { near, evm, solana } = {},
}: AccountProviderProps) {
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    const getAccountId = async () => {
      if (!accountId && near?.wallet) {
        const accounts = await near.wallet.getAccounts();
        setAccountId(
          accounts?.[0]?.accountId || near.account?.accountId || null
        );
      }
    };
    getAccountId();
  }, [near, accountId]);

  useEffect(() => {
    if (!near?.account && !near?.wallet && !evm && !solana) {
      console.warn(
        "No wallet or account configured - users will not be able to send transactions"
      );
    }
  }, [near, evm, solana]);

  return (
    <AccountContext.Provider
      value={{
        wallet: near?.wallet,
        account: near?.account,
        accountId,
        evmWallet: evm,
        evmAddress: evm?.address,
        chainId: evm?.chainId,
        solanaWallet: solana,
        solanaAddress: solana?.publicKey?.toString(),
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccount must be used within a AccountProvider");
  }
  return context;
}
