import { PostgrestClient } from "@supabase/postgrest-js";

const rest = new PostgrestClient(
  process.env.POSTGREST_URL ?? "http://postgrest:3000"
);

export default async function Home() {
  let items: { id: number; name: string; created_at: string }[] = [];
  let error: string | null = null;

  try {
    const { data, error: pgError } = await rest
      .from("items")
      .select("id, name, created_at")
      .order("id");

    if (pgError) throw new Error(pgError.message);
    items = (data ?? []) as typeof items;
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main>
      <h1>Supabase Test App</h1>
      <p style={{ color: "#666" }}>
        Reading from PostgREST →{" "}
        <code>{process.env.POSTGREST_URL ?? "http://postgrest:3000"}/items</code>
      </p>

      {error ? (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "1rem",
            color: "#991b1b",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "1rem" }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Created At</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={tdStyle}>{item.id}</td>
                <td style={tdStyle}>{item.name}</td>
                <td style={tdStyle}>{item.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "0.5rem 1rem",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  padding: "0.5rem 1rem",
};

