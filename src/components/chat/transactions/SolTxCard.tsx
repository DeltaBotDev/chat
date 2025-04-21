import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../ui/accordion";
import { Button } from "../../ui/button";
import { useAccount } from "../../AccountContext";
import { TransactionResult } from "./TransactionResult";
import LoadingMessage from "../LoadingMessage";

interface SolTxCardProps {
  solanaTransactions: any[];
  messageBackgroundColor: string;
  borderColor: string;
  textColor: string;
  buttonColor?: string;
}

export const SolTxCard = ({
  solanaTransactions,
  messageBackgroundColor,
  borderColor,
  textColor,
  buttonColor,
}: SolTxCardProps) => {
  const { solanaWallet, solanaAddress } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [txResult, setTxResult] = useState<{ signatures: string[] } | null>(
    null
  );
  const [walletConnected, setWalletConnected] = useState(false);

  // 监控钱包连接状态
  useEffect(() => {
    if (solanaWallet && solanaAddress) {
      setWalletConnected(true);
      console.log("Solana wallet connected:", solanaAddress);
    } else {
      setWalletConnected(false);
      console.log("Solana wallet not connected");
    }
  }, [solanaWallet, solanaAddress]);

  const handleSmartAction = async () => {
    if (!solanaWallet || !solanaAddress) {
      setErrorMsg("No Solana wallet connected");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    try {
      // 处理多个交易
      if (solanaTransactions.length > 1) {
        const signedTransactions =
          await solanaWallet.signAllTransactions(solanaTransactions);

        const signatures = [];
        for (const signedTx of signedTransactions) {
          const result = await solanaWallet.sendTransaction(
            signedTx,
            solanaWallet.connection,
            {
              skipPreflight: false,
              preflightCommitment: "confirmed",
            }
          );
          signatures.push(result.signature);
        }

        setTxResult({
          signatures,
        });
      } else if (solanaTransactions.length === 1) {
        // 处理单个交易
        const result = await solanaWallet.sendTransaction(
          solanaTransactions[0],
          solanaWallet.connection,
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          }
        );

        setTxResult({
          signatures: [result.signature],
        });
      }
    } catch (error: any) {
      console.error("Error executing Solana transaction:", error);
      setErrorMsg(error.message || "Failed to execute transaction");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div
        className='bitte-w-full bitte-flex bitte-flex-col bitte-gap-4'
        style={{ color: textColor }}
      >
        <Card
          className='bitte-w-full'
          style={{
            backgroundColor: messageBackgroundColor,
            borderColor,
          }}
        >
          <CardHeader>
            <CardTitle className='bitte-text-[16px]'>
              Solana Transaction{" "}
              {walletConnected
                ? "(Wallet Connected)"
                : "(Wallet Not Connected)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='bitte-flex bitte-flex-col bitte-gap-4'>
              <div className='bitte-text-sm'>
                <p>
                  Found {solanaTransactions.length} transaction(s) to execute on
                  Solana
                </p>
                <p className='bitte-mt-2'>
                  Account:{" "}
                  {solanaAddress ? solanaAddress : "No account connected"}
                </p>
              </div>

              {solanaTransactions.length > 0 && (
                <Accordion type='single' collapsible className='bitte-w-full'>
                  {solanaTransactions.map((tx, index) => (
                    <AccordionItem key={index} value={`tx-${index}`}>
                      <AccordionTrigger>
                        Transaction {index + 1}
                      </AccordionTrigger>
                      <AccordionContent>
                        <pre className='bitte-text-xs bitte-overflow-auto bitte-max-h-80'>
                          {JSON.stringify(tx, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </CardContent>

          {errorMsg && !isLoading ? (
            <div className='bitte-flex bitte-flex-col bitte-items-center bitte-gap-4 bitte-px-6 bitte-pb-6 bitte-text-center bitte-text-sm'>
              <p className='bitte-text-red-300'>
                An error occurred trying to execute your transaction: {errorMsg}
                .
              </p>
              <Button
                className='bitte-w-1/2'
                variant='outline'
                onClick={() => {
                  setErrorMsg("");
                }}
              >
                Dismiss
              </Button>
            </div>
          ) : null}

          {isLoading ? <LoadingMessage color={textColor} /> : null}
          {txResult ? (
            <TransactionResult
              result={{ solana: { signatures: txResult.signatures } }}
              textColor={textColor}
              accountId={solanaAddress}
            />
          ) : null}
          {!isLoading && !errorMsg && !txResult ? (
            <CardFooter className='bitte-flex bitte-items-center bitte-gap-6'>
              <>
                <Button variant='outline' className='bitte-w-1/2'>
                  Decline
                </Button>

                <Button
                  className='bitte-w-1/2'
                  onClick={handleSmartAction}
                  disabled={isLoading || !walletConnected}
                  style={{ backgroundColor: buttonColor }}
                >
                  {isLoading
                    ? "Confirming..."
                    : walletConnected
                      ? "Approve"
                      : "Connect Wallet First"}
                </Button>
              </>
            </CardFooter>
          ) : null}
        </Card>
      </div>
    </>
  );
};
