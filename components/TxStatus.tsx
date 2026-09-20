import { txUrl } from "@/lib/tx";

export function TxStatus({
  err,
  hash,
  step,
}: {
  err?: string | null;
  hash?: string | null;
  step?: "idle" | "approve" | "sign" | string;
}) {
  return (
    <>
      {step === "gas" ? <p className="muted">Weesh is covering gas…</p> : null}
      {step === "fee" ? <p className="muted">Weesh fee — confirm in wallet…</p> : null}
      {step === "approve" ? <p className="muted">Approve in your wallet…</p> : null}
      {step === "sign" ? <p className="muted">Confirm in your wallet…</p> : null}
      {err ? <p className="err">{err}</p> : null}
      {hash ? (
        <p className="ok">
          Done.{" "}
          <a href={txUrl(hash)} target="_blank" rel="noreferrer">
            View transaction
          </a>
        </p>
      ) : null}
    </>
  );
}
