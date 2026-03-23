const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let orders = [];
let nextId = 1;

// ── GET /orders — app polls every 60s ──────────────────────────────────
app.get('/orders', (req, res) => {
  res.json({ orders, count: orders.length });
});

// ── POST /orders — Google Apps Script sends here on form submit ─────────
app.post('/orders', (req, res) => {
  const body = req.body;
  if (!body || (!body.trainName && !body.train_name)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const order = {
    id:            `form_${Date.now()}_${nextId++}`,
    trainNumber:   body.trainNumber   || body.train_number   || '',
    trainName:     body.trainName     || body.train_name     || '',
    date:          body.date          || '',
    time:          body.time          || '',
    coach:         body.coach         || '',
    seatNumber:    body.seatNumber    || body.seat_number    || '',
    persons:       parseInt(body.persons) || 0,
    contactPerson: body.contactPerson || body.contact_person || '',
    contactNumber: body.contactNumber || body.contact_number || body.phone || '',
    foodItems:     body.foodItems     || body.food_items     || body.food || '',
    packing:       (body.packing || 'individual').toLowerCase(),
    plates:        body.plates === true || body.plates === 'Yes' || body.plates === 'true',
    notes:         body.notes         || body.special_instructions || '',
    status:        'received',
    cost:          '',
    source:        'form',
    receivedAt:    new Date().toISOString()
  };
  orders.push(order);
  console.log(`✅ New order: ${order.trainName} #${order.trainNumber} — ${order.persons} pax — ${order.contactPerson}`);
  res.status(201).json({ success: true, id: order.id });
});

// ── PATCH /orders/:id — MOD 5: app sends status + cost on Delivered ─────
// This also writes back to Google Sheets via the Sheets API if configured
app.patch('/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { status, cost } = req.body;
  if (status) order.status = status;
  if (cost !== undefined) order.cost = cost;
  order.updatedAt = new Date().toISOString();

  console.log(`📝 Order ${order.id} updated — Status: ${order.status}, Cost: ₹${order.cost||'—'}`);

  // ── Optional: Write back to Google Sheets ──────────────────────────────
  // If you set SHEETS_WEBHOOK_URL as an environment variable on Render,
  // this will also update the Google Sheet row automatically.
  // See README for how to set this up.
  if (process.env.SHEETS_WEBHOOK_URL) {
    const https = require('https');
    const data = JSON.stringify({
      orderId:   order.id,
      status:    order.status,
      cost:      order.cost,
      trainName: order.trainName,
      trainNumber: order.trainNumber
    });
    try {
      const url = new URL(process.env.SHEETS_WEBHOOK_URL);
      const reqOptions = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      };
      const r = https.request(reqOptions);
      r.write(data); r.end();
    } catch(e) { console.warn('Sheets webhook failed:', e.message); }
  }

  res.json({ success: true, id: order.id, status: order.status, cost: order.cost });
});

// ── DELETE /orders/:id ─────────────────────────────────────────────────
app.delete('/orders/:id', (req, res) => {
  const before = orders.length;
  orders = orders.filter(o => o.id !== req.params.id);
  res.json({ deleted: before - orders.length });
});

// ── Health check ───────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: '🍱 Catering Orders API running',
    ordersInQueue: orders.length,
    uptime: Math.round(process.uptime()) + 's'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🍱 Catering API on port ${PORT}`));
