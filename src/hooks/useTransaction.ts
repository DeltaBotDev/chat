import {
  FinalExecutionOutcome,
  Transaction,
  Wallet,
} from "@near-wallet-selector/core";
import { Account } from "near-api-js";
import { EthTransactionParams, SignRequestData } from "near-safe";
import { EVMWalletAdapter, SolanaWalletAdapter } from "../types";

export interface SuccessInfo {
  near: {
    receipts: FinalExecutionOutcome[];
    transactions: Transaction[];
    encodedTxn?: string;
  };
  solana?: {
    signatures: string[];
    transactions: any[];
  };
}

interface UseTransactionProps {
  account?: Account;
  wallet?: Wallet;
  evmWallet?: EVMWalletAdapter;
  solanaWallet?: SolanaWalletAdapter;
}

interface HandleTxnOptions {
  transactions?: Transaction[];
  evmData?: SignRequestData;
  solanaTransactions?: any[];
  solanaConnection?: any;
}

export const useTransaction = ({
  account,
  wallet,
  evmWallet,
  solanaWallet,
}: UseTransactionProps) => {
  const handleTxn = async ({
    transactions,
    evmData,
    solanaTransactions,
    solanaConnection,
  }: HandleTxnOptions): Promise<SuccessInfo> => {
    const hasNoWalletOrAccount = !wallet && !account && !evmWallet?.address && !solanaWallet?.publicKey;
    if (hasNoWalletOrAccount) {
      throw new Error("No wallet or account provided");
    }

    let nearResult;
    if (transactions) {
      nearResult = account
        ? await executeWithAccount(transactions, account)
        : await executeWithWallet(transactions, wallet);
    }

    if (evmData && evmWallet) {
      await executeWithEvmWallet(evmData, evmWallet);
    }

    let solanaResult;
    if (solanaTransactions && solanaWallet && solanaConnection) {
      solanaResult = await executeWithSolanaWallet(solanaTransactions, solanaWallet, solanaConnection);
    }

    return {
      near: {
        receipts: Array.isArray(nearResult) ? nearResult : [],
        transactions: transactions || [],
      },
      ...(solanaResult && { solana: solanaResult }),
    };
  };

  return {
    handleTxn,
  };
};

export const executeWithAccount = async (
  transactions: Transaction[],
  account: Account
): Promise<FinalExecutionOutcome[]> => {
  const results = await Promise.all(
    transactions.map(async (txn) => {
      if (txn.actions.every((action) => action.type === "FunctionCall")) {
        try {
          return await account.functionCall({
            contractId: txn.receiverId,
            methodName: txn.actions[0].params.methodName,
            args: txn.actions[0].params.args,
            attachedDeposit: BigInt(txn.actions[0].params.deposit),
            gas: BigInt(txn.actions[0].params.gas),
            walletCallbackUrl: window.location.href,
          });
        } catch (error) {
          console.error(
            `Transaction failed for contract ${txn.receiverId}, method ${txn.actions[0].params.methodName}:`,
            error
          );
          return null;
        }
      }
      return null;
    })
  );
  return results.filter(
    (result): result is FinalExecutionOutcome => result !== null
  );
};

export const executeWithWallet = async (
  transactions: Transaction[],
  wallet: Wallet | undefined
): Promise<void | FinalExecutionOutcome[]> => {
  if (!wallet) {
    throw new Error("Can't have undefined account and wallet");
  }
  return wallet.signAndSendTransactions({
    transactions: transactions,
    callbackUrl: window.location.href,
  });
};

export const executeWithEvmWallet = async (
  evmData: SignRequestData,
  evmWallet: EVMWalletAdapter
): Promise<void> => {
  if (!Array.isArray(evmData.params)) {
    throw new Error("Invalid transaction parameters");
  }

  if (
    !evmData.params.every(
      (tx): tx is EthTransactionParams => typeof tx === "object" && "to" in tx
    )
  ) {
    throw new Error("Invalid transaction parameters");
  }

  const txPromises = evmData.params.map((tx) => {
    const rawTxParams = {
      to: tx.to,
      value: tx.value ? BigInt(tx.value) : BigInt(0),
      data: tx.data || "0x",
      from: tx.from,
      gas: tx.gas ? BigInt(tx.gas) : undefined,
    };

    return evmWallet.sendTransaction(rawTxParams);
  });

  await Promise.all(txPromises);
};

export const executeWithSolanaWallet = async (
  transactions: any[],
  solanaWallet: SolanaWalletAdapter,
  connection: any
): Promise<{ signatures: string[]; transactions: any[] }> => {
  // 检查钱包是否连接
  if (solanaWallet.connected === false) {
    throw new Error("Solana wallet not connected");
  }
  
  // 检查是否有交易
  if (!transactions || transactions.length === 0) {
    throw new Error("No transactions to execute");
  }

  try {
    // 处理多个交易
    if (transactions.length > 1) {
      const signedTransactions = await solanaWallet.signAllTransactions(transactions);
      
      const signatures = [];
      for (const signedTx of signedTransactions) {
        const result = await solanaWallet.sendTransaction(signedTx, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        signatures.push(result.signature);
      }
      
      return {
        signatures,
        transactions,
      };
    } else if (transactions.length === 1) {
      // 处理单个交易
      const result = await solanaWallet.sendTransaction(transactions[0], connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      return {
        signatures: [result.signature],
        transactions,
      };
    }
    
    return {
      signatures: [],
      transactions: [],
    };
  } catch (error) {
    console.error("Error executing Solana transaction:", error);
    throw error;
  }
};
