import { Pool } from "pg";

// Singleton pool — reused across hot reloads in dev
const globalForPg = globalThis as unknown as { _pgPool?: Pool };

function getPool(): Pool {
  if (!globalForPg._pgPool) {
    globalForPg._pgPool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://devuser:devpassword@postgres:5432/appdb",
    });
  }
  return globalForPg._pgPool;
}

async function seedDb(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id   SERIAL PRIMARY KEY,
      name TEXT        NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM items");
  if (rows[0].n === 0) {
    await pool.query(`
      INSERT INTO items (name) VALUES
        ('Hello from PostgreSQL 🎉'),
        ('Running locally with GWS 🚀'),
        ('Next.js + Postgres = ❤️')
    `);
  }
}

export default async function Home() {
  const pool = getPool();

  let items: { id: number; name: string; created_at: string }[] = [];
  let error: string | null = null;

  try {
    await seedDb(pool);
    const result = await pool.query<{ id: number; name: string; created_at: string }>(
      "SELECT id, name, created_at::text FROM items ORDER BY id"
    );
    items = result.rows;
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main>
      <h1>Supabase Test App</h1>
      <p style={{ color: "#666" }}>
        Connected to PostgreSQL via{" "}
        <code>{process.env.DATABASE_URL ?? "postgresql://devuser:***@postgres:5432/appdb"}</code>
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
          <strong>Database error:</strong> {error}
        </div>
      ) : (
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            marginTop: "1rem",
          }}
        >
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
