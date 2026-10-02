import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/db";

const kinds = ["customer", "deal", "quote", "invoice", "settings"];
const currencies = ["ZMW", "ZAR", "USD", "EUR", "GBP", "AUD"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

const unauthorized = () => Response.json({ error: "Please sign in." }, { status: 401 });
const invalid = (error: string) => Response.json({ error }, { status: 400 });

// Lower-cased document number, used by the unique index to reject duplicates.
const docKey = (d: Rec) =>
  typeof d.docNumber === "string" && d.docNumber.trim() ? d.docNumber.trim().toLowerCase() : null;

const amount = (d: Rec) => {
  const sub = d.items.reduce((s: number, x: Rec) => s + Math.round(x.qty * x.price * 100) / 100, 0);
  const off = Math.round(sub * d.discount) / 100;
  const tax = Math.round((sub - off) * d.tax) / 100;
  return Math.round((sub - off + tax) * 100) / 100;
};

// Next free KA#### number for a kind (quotations start at 24, invoices at 39).
async function nextNumber(kind: string) {
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const [last] = await conn.query<RowDataPacket[]>(
      "SELECT MAX(CAST(SUBSTR(doc_number_key, 3) AS UNSIGNED)) AS value FROM records WHERE kind = ? AND doc_number_key REGEXP '^ka[0-9]+$'",
      [kind],
    );
    const start = Math.max(kind === "quote" ? 24 : 39, Number(last[0]?.value || 0) + 1);
    await conn.query(
      "INSERT INTO counters (kind, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = GREATEST(value + 1, VALUES(value))",
      [kind, start],
    );
    const [row] = await conn.query<RowDataPacket[]>("SELECT value FROM counters WHERE kind = ?", [kind]);
    await conn.commit();
    return "KA" + String(row[0].value).padStart(4, "0");
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function GET() {
  try {
    if (!(await getCurrentUser())) return unauthorized();
    const [rows] = await pool().query<RowDataPacket[]>("SELECT * FROM records ORDER BY id DESC");
    return Response.json(
      rows.map((r) => ({ ...JSON.parse(r.data), id: r.id, kind: r.kind, source: r.source })),
    );
  } catch (e) {
    console.error(e);
    return Response.json({ error: "Could not load records. Please retry." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    if (!(await getCurrentUser())) return unauthorized();
    const b: Rec = await req.json();
    const db = pool();

    if (b.action === "convert") {
      const [found] = await db.query<RowDataPacket[]>(
        "SELECT * FROM records WHERE id = ? AND kind = 'quote'",
        [b.id],
      );
      const q = found[0];
      if (!q) return Response.json({ error: "Quotation not found" }, { status: 404 });

      const [existing] = await db.query<RowDataPacket[]>("SELECT id FROM records WHERE source = ?", [q.id]);
      if (existing.length) return Response.json({ ok: true });

      const data = {
        ...JSON.parse(q.data),
        docNumber: await nextNumber("invoice"),
        notes: "",
        status: "Unpaid",
        paid: 0,
        date: new Date().toISOString().slice(0, 10),
        due: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      };
      try {
        await db.query("INSERT INTO records (kind, data, source, doc_number_key) VALUES ('invoice', ?, ?, ?)", [
          JSON.stringify(data),
          q.id,
          docKey(data),
        ]);
      } catch (e) {
        // Someone converted the same quotation at the same moment; that's fine.
        if (!String(e).includes("records_source_unique")) throw e;
      }
      return Response.json({ ok: true });
    }

    const d: Rec = b.data;
    if (!kinds.includes(b.kind) || !d || typeof d !== "object") return invalid("Invalid record");
    if (b.kind === "customer" && !d.name?.trim()) return invalid("Customer name is required.");
    if (
      b.kind === "settings" &&
      (!d.business?.trim() || !currencies.includes(d.currency) || !Number.isFinite(d.tax) || d.tax < 0 || d.tax > 100)
    ) {
      return invalid("Check business name, currency, and tax.");
    }

    if (["deal", "quote", "invoice"].includes(b.kind)) {
      if (!currencies.includes(d.currency) || !Number.isInteger(Number(d.customer))) {
        return invalid("Choose a customer and currency.");
      }
      const [customer] = await db.query<RowDataPacket[]>(
        "SELECT id FROM records WHERE id = ? AND kind = 'customer'",
        [Number(d.customer)],
      );
      if (!customer.length) return invalid("Customer not found.");
    }

    if (
      b.kind === "deal" &&
      (!d.title?.trim() ||
        !Number.isFinite(d.value) ||
        d.value < 0 ||
        !["Lead", "Qualified", "Proposal", "Won", "Lost"].includes(d.stage))
    ) {
      return invalid("Check opportunity details.");
    }

    if (["quote", "invoice"].includes(b.kind)) {
      if (d.docNumber !== undefined && typeof d.docNumber !== "string") return invalid("Document number must be text.");
      d.docNumber = d.docNumber?.trim() || "";
      if (d.docNumber && !/^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$/.test(d.docNumber)) {
        return invalid("Use up to 40 letters, numbers, spaces, dots, slashes, underscores, or hyphens for the document number.");
      }
      if (b.id && !d.docNumber) return invalid("Enter a document number.");
      if (d.docNumber) {
        const [duplicate] = await db.query<RowDataPacket[]>(
          "SELECT id FROM records WHERE kind = ? AND doc_number_key = ? AND id <> ?",
          [b.kind, docKey(d), b.id || 0],
        );
        if (duplicate.length) {
          return Response.json(
            { error: `This ${b.kind === "quote" ? "quotation" : "invoice"} number is already in use. Choose another number.` },
            { status: 409 },
          );
        }
      }
      if (
        !Array.isArray(d.items) ||
        !d.items.length ||
        d.items.length > 200 ||
        d.items.some(
          (x: Rec) => !x.description?.trim() || !Number.isFinite(x.qty) || x.qty <= 0 || !Number.isFinite(x.price) || x.price < 0,
        ) ||
        !Number.isFinite(d.tax) ||
        d.tax < 0 ||
        d.tax > 100 ||
        !Number.isFinite(d.discount) ||
        d.discount < 0 ||
        d.discount > 100
      ) {
        return invalid("Check items, tax, and discount.");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !/^\d{4}-\d{2}-\d{2}$/.test(d.due) || d.due < d.date) {
        return invalid("Check issue and due dates.");
      }
      if (b.kind === "quote" && !["Draft", "Sent", "Accepted", "Declined"].includes(d.status)) {
        return invalid("Invalid quotation status.");
      }
      if (b.kind === "invoice") {
        if (!Number.isFinite(d.paid) || d.paid < 0 || d.paid > amount(d)) {
          return invalid("Payment must be between zero and the invoice total.");
        }
        d.status = d.paid >= amount(d) ? "Paid" : d.paid > 0 ? "Partially paid" : "Unpaid";
      }
    }

    if (b.id) {
      const [result] = await db.query<ResultSetHeader>(
        "UPDATE records SET data = ?, doc_number_key = ? WHERE id = ? AND kind = ?",
        [JSON.stringify(d), docKey(d), b.id, b.kind],
      );
      if (!result.affectedRows) return Response.json({ error: "Record not found." }, { status: 404 });
    } else {
      if (["quote", "invoice"].includes(b.kind) && !d.docNumber) d.docNumber = await nextNumber(b.kind);
      await db.query("INSERT INTO records (kind, data, doc_number_key) VALUES (?, ?, ?)", [
        b.kind,
        JSON.stringify(d),
        docKey(d),
      ]);
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    if (String(e).includes("records_kind_document_number_unique")) {
      return Response.json({ error: "This document number is already in use. Choose another number." }, { status: 409 });
    }
    return Response.json({ error: "Could not save. Your input has been kept; please retry." }, { status: 503 });
  }
}
