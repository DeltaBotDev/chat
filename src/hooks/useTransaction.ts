import {
  FinalExecutionOutcome,
  Transaction,
  Wallet,
} from "@near-wallet-selector/core";
import { Account } from "near-api-js";
import { EthTransactionParams, SignRequestData } from "near-safe";
import { EVMWalletAdapter, SolanaWalletAdapter } from "../types";
import {
  Transaction as SolanaTransaction,
  ComputeBudgetProgram,
  RpcResponseAndContext,
  SignatureStatus,
  Connection,
} from "@solana/web3.js";
import bs58 from "bs58";

export interface SuccessInfo {
  near: {
    receipts: FinalExecutionOutcome[];
    transactions: Transaction[];
    encodedTxn?: string;
  };
  solana?: {
    signatures: string;
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
  solanaTransactions?: any;
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
  }: HandleTxnOptions): Promise<SuccessInfo> => {
    const hasNoWalletOrAccount =
      !wallet && !account && !evmWallet?.address && !solanaWallet?.publicKey;
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
    if (solanaTransactions && solanaWallet) {
      solanaResult = await executeWithSolanaWallet(
        solanaTransactions,
        solanaWallet
      );
    }

    return {
      near: {
        receipts: Array.isArray(nearResult) ? nearResult : [],
        transactions: transactions || [],
      },
      ...(solanaResult && { solana: { signatures: solanaResult } }),
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
  transactions: any,
  solanaWallet: SolanaWalletAdapter
)=> {
  const {
    connection,
    sendTransaction,
    connected,
    publicKey
  } = solanaWallet;

  if (!connected || !connection) {
    throw new Error("Solana wallet not connected");
  }

  if (!transactions) {
    throw new Error("No transactions to execute");
  }

  try {
    const deserializedTransaction = deserializeTransaction(transactions);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const transactionArray = Array.isArray(deserializedTransaction)
      ? deserializedTransaction
      : [deserializedTransaction];
    const transaction = new SolanaTransaction().add(...transactionArray);
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = publicKey;
    const priorityFee = await getPriorityFeeEstimate(transaction);
    console.log("estimated priorityFee:", priorityFee);
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 500000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee,
      })
    );

    const sendOptions = {
      skipPreflight: true,
      maxRetries: 10,
      preflightCommitment: "finalized",
    };
    const signature = await sendTransaction?.(transaction, connection, {
      ...sendOptions,
    });

    const confirmation = await pollForTransactionConfirmation(
      connection,
      signature
    );
    console.log("confirmation", confirmation);
    if (!confirmation.value || confirmation.value?.err) {
      throw new Error(
        confirmation.value?.err
          ? `send transaction failed: ${
              typeof confirmation.value.err === "string"
                ? confirmation.value.err
                : JSON.stringify(confirmation.value.err)
            }`
          : `send transaction failed, please try again later`
      );
    }

    return signature;
  } catch (error) {
    console.error("Error executing Solana transaction:", error);
    throw error;
  }
};

function deserializeTransaction(base64String: string) {
  try {
    console.log("deserializeTransaction", base64String);
    const buffer = Buffer.from(base64String, "base64");
    console.log("deserializeTransaction buffer", buffer);

    const transaction = SolanaTransaction.from(buffer);
    console.log("deserializeTransaction transaction", transaction);
    return transaction;
    
  } catch (error) {
    console.error("Error deserializing transaction:", error);
    throw error;
  }
}

async function getPriorityFeeEstimate(transaction: SolanaTransaction) {
  const defaultPriorityFee = 300000;
  try {
    if (process.env.NEXT_PUBLIC_NETWORK !== "mainnet")
      return defaultPriorityFee;

    const res = await fetch(`https://solana-helius.deltarpc.com/`, {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method: "getPriorityFeeEstimate",
        params: [
          {
            transaction: bs58.encode(
              transaction.serialize({ verifySignatures: false })
            ),
            options: { priorityLevel: "High" },
          },
        ],
      }),
    });
    const {result}=await res.json();
    const priorityFee = Number(result?.priorityFeeEstimate || 0)
    return priorityFee ?? defaultPriorityFee;
  } catch (error) {
    console.error(error);
    return defaultPriorityFee;
  }
}

async function pollForTransactionConfirmation(
  connection: Connection,
  signature: string,
  timeout = 120000
): Promise<RpcResponseAndContext<SignatureStatus | null>> {
  const startTime = Date.now();
  let done = false;
  let status: RpcResponseAndContext<SignatureStatus | null> | null = null;
  while (!done && Date.now() - startTime < timeout) {
    status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    if (
      status?.value?.confirmationStatus === "finalized" ||
      status?.value?.err
    ) {
      done = true;
    } else {
      await sleep(2000);
    }
  }
  if (!status) {
    throw new Error(
      `Transaction confirmation failed for signature ${signature}`
    );
  }
  return status;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
