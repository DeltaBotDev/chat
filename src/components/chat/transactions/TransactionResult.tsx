import { MoveUpRight } from "lucide-react";
import { Network } from "near-safe";
import { getNearblocksURL, shortenString } from "../../../lib/utils";

export const TransactionResult = ({
  result: { evm, near, solana },
  accountId,
  textColor,
}: any) => {
  const scanUrl = evm?.txHash
    ? `${Network.fromChainId(evm.chainId).scanUrl}/tx/${evm.txHash}`
    : null;

  const getSolanaScanURL = (signature: string, cluster?: string) => {
    const baseUrl = cluster === "devnet" 
      ? "https://explorer.solana.com/tx/" 
      : "https://solscan.io/tx/";
    return `${baseUrl}${signature}${cluster === "devnet" ? "?cluster=devnet" : ""}`;
  };

  return (
    <div className="bitte-mt-4">
      <p className="bitte-text-center bitte-text-[14px] bitte-font-semibold">
        Transaction success
      </p>
      <div
        className="bitte-flex bitte-flex-col bitte-gap-4 bitte-p-6 bitte-text-[14px]"
        style={{ color: textColor }}
      >
        {evm?.txHash && scanUrl && (
          <div className="bitte-flex bitte-items-center bitte-justify-between bitte-px-6 bitte-text-[14px]">
            <div>EVM Transaction</div>
            <a
              className="bitte-flex bitte-gap-1 bitte-items-center"
              href={scanUrl}
              target='_blank'
              rel='noopener noreferrer'
            >
              {shortenString(evm.txHash, 10)}
              <MoveUpRight width={12} height={12} />
            </a>
          </div>
        )}
        {near?.receipts &&
          near.receipts.map((receipt: any) => (
            <div
              key={receipt.transaction.hash}
              className="bitte-flex bitte-items-center bitte-justify-between bitte-px-6 bitte-text-[14px]"
            >
              <div>Near Transaction</div>
              <a
                className="bitte-flex bitte-gap-1 bitte-items-center"
                href={getNearblocksURL(accountId, receipt.transaction.hash)}
                target='_blank'
                rel='noopener noreferrer'
              >
                {shortenString(receipt.transaction.hash, 10)}
                <MoveUpRight width={12} height={12} />
              </a>
            </div>
          ))}
        {solana?.signatures &&
          solana.signatures.map((signature: string) => (
            <div
              key={signature}
              className="bitte-flex bitte-items-center bitte-justify-between bitte-px-6 bitte-text-[14px]"
            >
              <div>Solana Transaction</div>
              <a
                className="bitte-flex bitte-gap-1 bitte-items-center"
                href={getSolanaScanURL(signature, solana.cluster)}
                target='_blank'
                rel='noopener noreferrer'
              >
                {shortenString(signature, 10)}
                <MoveUpRight width={12} height={12} />
              </a>
            </div>
          ))}
      </div>
    </div>
  );
};
