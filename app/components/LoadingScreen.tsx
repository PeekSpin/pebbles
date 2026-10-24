export function LoadingScreen({ admin = false }: { admin?: boolean }) {
  return <main className={`loading-screen${admin ? " loading-screen-admin" : ""}`} aria-busy="true" aria-live="polite">
    <div className="loading-mark" aria-hidden="true"><span /><span /><span /></div>
    <p className="loading-eyebrow">{admin ? "Pebbles Studio" : "Pebbles"}</p>
    <p className="loading-message">Loading your {admin ? "workspace" : "experience"}<span className="loading-dots">...</span></p>
  </main>;
}
