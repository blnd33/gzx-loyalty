'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4 text-center">
      <div>
        <h1 className="heading text-2xl">Something went wrong</h1>
        <p className="mt-2 text-muted">Check the internet connection and try again. Nothing was saved twice.</p>
        <button className="btn-primary mt-6" onClick={reset}>Try again</button>
      </div>
    </main>
  );
}
