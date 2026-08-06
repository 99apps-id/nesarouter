"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="id">
      <body>
        <main className="app-error" role="alert">
          <p className="app-error-kicker">NesaRouter</p>
          <h1>Aplikasi tidak dapat dimuat</h1>
          <p>Terjadi kesalahan sementara saat menyiapkan aplikasi.</p>
          <button className="button primary" type="button" onClick={reset}>
            Muat ulang
          </button>
        </main>
      </body>
    </html>
  );
}
