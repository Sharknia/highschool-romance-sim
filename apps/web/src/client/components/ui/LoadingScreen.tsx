export function LoadingScreen({ label }: { label: string }) {
  return (
    <section className="loading-screen">
      <span className="loading-ring" aria-hidden="true" />
      <span>{label}</span>
    </section>
  );
}
