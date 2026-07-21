"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("NesaRouter page error", error);
  }, [error]);

  return (
    <main className="app-error" role="alert">
      <img src="/favicon.svg" alt="" width="48" height="48" />
      <p className="app-error-kicker">NesaRouter</p>
      <h1>Halaman tidak dapat dimuat</h1>
      <p>Terjadi kesalahan sementara. Konfigurasi dan data router Anda tetap aman.</p>
      <button className="button primary" type="button" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
