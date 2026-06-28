export const metadata = {
  title: "Harness Reports Access",
  description: "Owner login for Harness Reports",
};

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    returnTo?: string;
  }>;
};

function getSafeReturnTo(value?: string): string {
  if (!value || !value.startsWith("/")) return "/reports";
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) || {};
  const returnTo = getSafeReturnTo(params.returnTo);
  const errorMessage =
    params.error === "invalid"
      ? "Invalid owner credentials."
      : params.error === "forbidden"
        ? "Owner role required."
        : undefined;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 20% 20%, #172554, transparent 45%), linear-gradient(160deg, #020617, #0f172a)",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "min(92vw, 420px)",
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 20px 50px rgba(0,0,0,.35)",
          color: "#e2e8f0",
        }}
      >
        <p style={{ margin: 0, color: "#38bdf8", fontSize: "0.9rem", letterSpacing: ".08em", textTransform: "uppercase" }}>
          Owner Login
        </p>
        <h1 style={{ margin: "8px 0 10px", fontSize: "1.8rem" }}>Harness Reports Access</h1>
        <p style={{ margin: "0 0 18px", color: "#94a3b8", lineHeight: 1.5 }}>
          Sign in with the same owner account used on <span style={{ color: "#e2e8f0" }}>slimyai.xyz</span>.
        </p>
        {errorMessage ? (
          <p style={{ margin: "0 0 14px", color: "#fca5a5", fontWeight: 600 }}>{errorMessage}</p>
        ) : null}
        <form method="post" action="/api/session/login">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.95rem" }}>
            Email or Username
          </label>
          <input
            name="email"
            autoComplete="username"
            required
            style={{
              width: "100%",
              borderRadius: "10px",
              border: "1px solid #475569",
              background: "#020617",
              color: "#e2e8f0",
              padding: "12px 13px",
              marginBottom: "14px",
            }}
          />
          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.95rem" }}>
            Password
          </label>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={{
              width: "100%",
              borderRadius: "10px",
              border: "1px solid #475569",
              background: "#020617",
              color: "#e2e8f0",
              padding: "12px 13px",
              marginBottom: "18px",
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              border: 0,
              borderRadius: "10px",
              padding: "12px 14px",
              background: "#0ea5e9",
              color: "#082f49",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign in as owner
          </button>
        </form>
      </section>
    </main>
  );
}
