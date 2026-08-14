"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type WalletOverview = {
  wallet: { balance: number; currency: string };
  withdrawals: Array<{ amount: number; status: string }>;
};

const emptyOverview: WalletOverview = {
  wallet: { balance: 0, currency: "USD" },
  withdrawals: [],
};

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

export function TopbarWallet({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const [overview, setOverview] = useState(emptyOverview);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/finance/overview");
      if (response.ok) setOverview((await response.json()) as WalletOverview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Auto-refresh on custom event
    const handleUpdate = () => void load();
    window.addEventListener("wallet:updated", handleUpdate);

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      void load();
    }, 10000);

    return () => {
      window.removeEventListener("wallet:updated", handleUpdate);
      clearInterval(interval);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  const pending = overview.withdrawals
    .filter((item) => ["PENDING", "APPROVED", "PROCESSING"].includes(item.status))
    .reduce((total, item) => total + item.amount, 0);

  return (
    <div className="top-wallet" ref={containerRef}>
      <button
        className="top-wallet-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">▣</span>
        <small>Billetera</small>
        <strong>{loading ? "…" : money.format(overview.wallet.balance)}</strong>
      </button>
      {open && (
        <section className="top-wallet-popover" aria-label="Resumen de billetera">
          <div className="top-wallet-heading">
            <strong>Mi billetera</strong>
            <button
              type="button"
              aria-label="Actualizar billetera"
              onClick={() => void load()}
            >
              ↻
            </button>
          </div>
          <div className="top-wallet-row">
            <span>Disponible para retiro</span>
            <strong>{money.format(overview.wallet.balance)}</strong>
          </div>
          <div className="top-wallet-row pending">
            <span>Retiros en proceso</span>
            <strong>{money.format(pending)}</strong>
          </div>
          <button
            className="top-wallet-open"
            type="button"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            Ver billetera completa →
          </button>
        </section>
      )}
    </div>
  );
}
