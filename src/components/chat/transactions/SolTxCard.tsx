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
import { TransactionButtonProps, TransactionContainerProps } from "../../../types";
import DefaultTxContainer from "../default-components/DefaultTxContainer";
import DefaultTxApproveButton from "../default-components/DefaultTxApproveButton";
import DefaultTxDeclineButton from "../default-components/DefaultTxDeclineButton";
import { useTransaction } from "../../../hooks/useTransaction";
interface SolTxCardProps {
  solanaTransactions: string | string[];
  messageBackgroundColor: string;
  borderColor: string;
  textColor: string;
  customTxContainer?: React.ComponentType<TransactionContainerProps>;
  customApproveTxButton?: React.ComponentType<TransactionButtonProps>;
  customDeclineTxButton?: React.ComponentType<TransactionButtonProps>;
}

export const SolTxCard = ({
  solanaTransactions,
  messageBackgroundColor,
  borderColor,
  textColor,
  customTxContainer: TxContainer = DefaultTxContainer,
  customApproveTxButton: ApproveButton = DefaultTxApproveButton,
  customDeclineTxButton: DeclineButton = DefaultTxDeclineButton,
}: SolTxCardProps) => {
  const { solanaWallet, solanaAddress } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [txResult, setTxResult] = useState<{ signatures: string[] } | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);

  const [transactions, setTransactions] = useState<string[]>([]);

  useEffect(() => {
    if (solanaWallet && solanaAddress) {
      setWalletConnected(true);
      console.log("Solana wallet connected:", solanaAddress);
    } else {
      setWalletConnected(false);
      console.log("Solana wallet not connected");
    }
  }, [solanaWallet, solanaAddress]);

  useEffect(() => {
    try {
      const txArray = Array.isArray(solanaTransactions) 
        ? solanaTransactions 
        : [solanaTransactions];
      
      setTransactions(txArray);
      console.log(`Processing ${txArray.length} Solana transaction(s)`);
    } catch (error) {
      console.error("Error processing transactions:", error);
      setErrorMsg("Error processing transaction data");
    }
  }, [solanaTransactions]);

  const {handleTxn}=useTransaction({solanaWallet})

  const handleSmartAction = async () => {
    setIsLoading(true);
    try {
      const result = await handleTxn({ solanaTransactions, });
      if(result.solana?.signatures){
        setTxResult({signatures:Array.isArray(result.solana.signatures)?result.solana.signatures:[result.solana.signatures]})
      }
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : `Unknown error: ${JSON.stringify(error)}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = () => {
    
  };

  const formatTransaction = (tx: string, index: number) => {
    try {
      return (
        <AccordionItem key={index} value={`tx-${index}`}>
          <AccordionTrigger>
            Transaction {index + 1}
          </AccordionTrigger>
          <AccordionContent>
            <pre className='bitte-text-xs bitte-overflow-auto bitte-max-h-80'>
              [Base64 Transaction] {tx.substring(0, 50)}...
            </pre>
          </AccordionContent>
        </AccordionItem>
      );
    } catch (error) {
      console.error("Error formatting transaction:", error);
      return (
        <AccordionItem key={index} value={`tx-${index}`}>
          <AccordionTrigger>
            Transaction {index + 1} (Error)
          </AccordionTrigger>
          <AccordionContent>
            <pre className='bitte-text-xs bitte-overflow-auto bitte-max-h-80 bitte-text-red-300'>
              Error formatting transaction
            </pre>
          </AccordionContent>
        </AccordionItem>
      );
    }
  };

  return (
    <>
      <div
        className='bitte-w-full bitte-flex bitte-flex-col bitte-gap-4'
        style={{ color: textColor }}
      >
        <TxContainer
          style={{
            backgroundColor: messageBackgroundColor,
            borderColor: borderColor,
            textColor: textColor,
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
                  Found {transactions.length} transaction(s) to execute on
                  Solana
                </p>
                <p className='bitte-mt-2'>
                  Account:{" "}
                  {solanaAddress ? solanaAddress : "No account connected"}
                </p>
              </div>

              {transactions.length > 0 && (
                <Accordion type='single' collapsible className='bitte-w-full'>
                  {transactions.map((tx, index) => formatTransaction(tx, index))}
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
                <DeclineButton
                  onClick={handleDecline}
                  disabled={isLoading}
                  label="Decline"
                />

                <ApproveButton
                  onClick={handleSmartAction}
                  disabled={isLoading || !walletConnected}
                  isLoading={isLoading}
                  label={walletConnected ? "Approve" : "Connect Wallet First"}
                />
              </>
            </CardFooter>
          ) : null}
        </TxContainer>
      </div>
    </>
  );
};
