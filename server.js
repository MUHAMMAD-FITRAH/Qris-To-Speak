const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

// __dirname SUDAH ADA di CommonJS → JANGAN deklarasi ulang
app.use(express.static(path.join(__dirname, "public")));

// In-memory store (demo)
const invoices = new Map();
const sseClients = new Set();

// SSE endpoint (kasir listen di sini)
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

// Broadcast helper
function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const c of sseClients) c.write(msg);
}

// Buat invoice baru
app.post("/api/invoice/new", (req, res) => {
  const invoiceId = "INV-" + Math.random().toString(36).slice(2, 10).toUpperCase();

  invoices.set(invoiceId, {
    status: "OPEN",
    amount: null,
    createdAt: Date.now(),
    paidAt: null
  });

  res.json({
    ok: true,
    invoiceId,
    payUrl: `/pay.html?invoice=${encodeURIComponent(invoiceId)}`
  });
});

// Cek invoice
app.get("/api/invoice/:id", (req, res) => {
  const inv = invoices.get(req.params.id);
  if (!inv) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  res.json({ ok: true, invoiceId: req.params.id, ...inv });
});

// Bayar (DEMO)
app.post("/api/invoice/:id/pay", (req, res) => {
  const inv = invoices.get(req.params.id);
  if (!inv) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  if (inv.status === "PAID") {
    return res.json({ ok: true, alreadyPaid: true });
  }

  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ ok: false, error: "INVALID_AMOUNT" });
  }

  inv.status = "PAID";
  inv.amount = amount;
  inv.paidAt = Date.now();

  // Kirim event ke kasir
  broadcast("paid", {
    invoiceId: req.params.id,
    amount,
    ts: inv.paidAt
  });

  res.json({ ok: true, invoiceId: req.params.id, amount });
});

// Start server
app.listen(8080, () => {
  console.log("✅ Server jalan");
  console.log(`👉 http://localhost:8080/`);
});
